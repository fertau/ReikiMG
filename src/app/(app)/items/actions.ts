'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import {
  fail,
  optionalNumber,
  optionalText,
  parseForm,
  succeed,
  type ActionState,
} from '@/lib/action-state';
import type { FieldType } from '@/lib/types';

const FIELD_PREFIX = 'f_';

interface FieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
}

interface FieldRow {
  item_id: string;
  field_id: string;
  value: unknown;
  value_text: string;
}

interface FieldPlan {
  rows: FieldRow[];
  clears: string[];
}

/**
 * Traduce los campos dinámicos del formulario a filas de item_field_values.
 * Valida antes de tocar la base para no dejar un ítem creado a medias, y guarda
 * el valor tipado en `value` más una versión legible en `value_text`, que es la
 * que termina impresa en la orden de producción.
 */
async function planDynamicFields(
  supabase: SupabaseClient,
  productTypeId: string,
  formData: FormData,
): Promise<{ ok: true; plan: FieldPlan } | { ok: false; error: string }> {
  const { data: fieldRows } = await supabase
    .from('product_fields')
    .select('id, field_key, label, field_type, is_required')
    .eq('product_type_id', productTypeId)
    .eq('is_active', true);

  const fields = (fieldRows ?? []) as FieldDef[];
  if (fields.length === 0) return { ok: true, plan: { rows: [], clears: [] } };

  const catalogIds = new Set<string>();
  for (const field of fields) {
    if (field.field_type !== 'catalog') continue;
    const raw = formData.get(`${FIELD_PREFIX}${field.id}`);
    if (typeof raw === 'string' && raw) catalogIds.add(raw);
  }

  const catalogNames = new Map<string, string>();
  if (catalogIds.size > 0) {
    const { data: materials } = await supabase
      .from('materials')
      .select('id, name')
      .in('id', [...catalogIds]);
    for (const material of materials ?? []) {
      catalogNames.set(material.id, material.name);
    }
  }

  const rows: Omit<FieldRow, 'item_id'>[] = [];
  const clears: string[] = [];

  for (const field of fields) {
    const key = `${FIELD_PREFIX}${field.id}`;

    if (field.field_type === 'boolean') {
      const checked = formData.get(key) === '1';
      rows.push({ field_id: field.id, value: checked, value_text: checked ? 'Sí' : 'No' });
      continue;
    }

    if (field.field_type === 'multiselect') {
      const values = formData
        .getAll(`${key}[]`)
        .filter((v): v is string => typeof v === 'string' && v !== '');
      if (values.length === 0) {
        if (field.is_required) return { ok: false, error: `El campo "${field.label}" es obligatorio.` };
        clears.push(field.id);
        continue;
      }
      rows.push({ field_id: field.id, value: values, value_text: values.join(', ') });
      continue;
    }

    const raw = formData.get(key);
    const text = typeof raw === 'string' ? raw.trim() : '';

    if (text === '') {
      if (field.is_required) return { ok: false, error: `El campo "${field.label}" es obligatorio.` };
      clears.push(field.id);
      continue;
    }

    if (field.field_type === 'number') {
      const parsed = Number(text.replace(',', '.'));
      if (Number.isNaN(parsed)) {
        return { ok: false, error: `El campo "${field.label}" debe ser numérico.` };
      }
      rows.push({
        field_id: field.id,
        value: parsed,
        value_text: text.replace(',', '.'),
      });
      continue;
    }

    if (field.field_type === 'catalog') {
      rows.push({
        field_id: field.id,
        value: { material_id: text },
        value_text: catalogNames.get(text) ?? text,
      });
      continue;
    }

    rows.push({ field_id: field.id, value: text, value_text: text });
  }

  return { ok: true, plan: { rows: rows as FieldRow[], clears } };
}

/** Escribe el plan ya validado. */
async function applyDynamicFields(
  supabase: SupabaseClient,
  itemId: string,
  plan: FieldPlan,
): Promise<string | null> {
  if (plan.clears.length > 0) {
    await supabase
      .from('item_field_values')
      .delete()
      .eq('item_id', itemId)
      .in('field_id', plan.clears);
  }

  if (plan.rows.length > 0) {
    const { error } = await supabase
      .from('item_field_values')
      .upsert(
        plan.rows.map((row) => ({ ...row, item_id: itemId })),
        { onConflict: 'item_id,field_id' },
      );
    if (error) return `No se pudieron guardar las características: ${error.message}`;
  }

  return null;
}

const itemSchema = z.object({
  measurement_id: z.string().uuid(),
  room_id: z.string().uuid('Elegí un ambiente'),
  product_type_id: z.string().uuid('Elegí un producto'),
  label: optionalText,
  quantity: z.coerce.number().int().min(1, 'La cantidad mínima es 1').default(1),
  width_mm: optionalNumber,
  height_mm: optionalNumber,
  depth_mm: optionalNumber,
  notes: optionalText,
});

export async function createItem(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(itemSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();

  const planned = await planDynamicFields(supabase, parsed.data.product_type_id, formData);
  if (!planned.ok) return fail(planned.error);

  const { count } = await supabase
    .from('measurement_items')
    .select('id', { count: 'exact', head: true })
    .eq('measurement_id', parsed.data.measurement_id);

  const { data: inserted, error } = await supabase
    .from('measurement_items')
    .insert({ ...parsed.data, sort_order: (count ?? 0) + 1 })
    .select('id, measurement_id, product_type:product_types(name), room:rooms(name)')
    .single();

  if (error) return fail(`No se pudo crear el ítem: ${error.message}`);

  const data = inserted as unknown as {
    id: string;
    product_type: { name: string } | null;
    room: { name: string } | null;
  };

  const fieldError = await applyDynamicFields(supabase, data.id, planned.plan);
  if (fieldError) {
    revalidatePath(`/relevamientos/${parsed.data.measurement_id}`);
    return { ok: true, id: data.id, message: fieldError };
  }

  await logEvent(supabase, user.id, {
    entityType: 'item',
    entityId: data.id,
    measurementId: parsed.data.measurement_id,
    action: 'item.created',
    description: `agregó el ítem ${data.product_type?.name ?? ''} en ${data.room?.name ?? ''}`.trim(),
  });

  revalidatePath(`/relevamientos/${parsed.data.measurement_id}`);
  return succeed('Ítem creado', data.id);
}

const itemUpdateSchema = itemSchema.extend({ id: z.string().uuid() });

export async function updateItem(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(itemUpdateSchema, formData);
  if (parsed.error) return parsed.error;

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  const planned = await planDynamicFields(supabase, values.product_type_id, formData);
  if (!planned.ok) return fail(planned.error);

  const { error } = await supabase.from('measurement_items').update(values).eq('id', id);
  if (error) return fail(`No se pudo guardar: ${error.message}`);

  const fieldError = await applyDynamicFields(supabase, id, planned.plan);
  if (fieldError) return fail(fieldError);

  await logEvent(supabase, user.id, {
    entityType: 'item',
    entityId: id,
    measurementId: values.measurement_id,
    action: 'item.updated',
    description: 'modificó las medidas de un ítem',
    metadata: {
      ancho: values.width_mm,
      alto: values.height_mm,
      profundidad: values.depth_mm,
      cantidad: values.quantity,
    },
  });

  revalidatePath(`/items/${id}`);
  revalidatePath(`/relevamientos/${values.measurement_id}`);
  return succeed('Medidas guardadas', id);
}

export async function deleteItem(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  const measurementId = String(formData.get('measurement_id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from('measurement_items').delete().eq('id', id);

  if (!error) {
    await logEvent(supabase, user.id, {
      entityType: 'item',
      entityId: id,
      measurementId,
      action: 'item.deleted',
      description: 'eliminó un ítem del relevamiento',
    });
  }

  revalidatePath(`/relevamientos/${measurementId}`);
}
