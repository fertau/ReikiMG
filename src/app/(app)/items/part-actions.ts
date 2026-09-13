'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
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
import { PART_KIND_LABELS } from '@/lib/status';

const baseSchema = z.object({
  item_id: z.string().uuid(),
  kind: z.enum(['vidrio', 'perfileria', 'herraje', 'otro']),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a cero'),
  width_mm: optionalNumber,
  height_mm: optionalNumber,
  length_mm: optionalNumber,
  material_id: optionalText,
  description: optionalText,
  code: optionalText,
  unit: optionalText,
  thickness: optionalText,
  finish: optionalText,
  color: optionalText,
  notes: optionalText,
});

type PartValues = z.infer<typeof baseSchema>;

/** Reglas mínimas por tipo: sin esto, taller recibe filas que no se pueden producir. */
function validateKind(values: PartValues): string | null {
  switch (values.kind) {
    case 'vidrio':
      if (!values.width_mm || !values.height_mm) {
        return 'El vidrio necesita ancho y alto.';
      }
      if (!values.material_id && !values.description) {
        return 'Indicá el tipo de vidrio.';
      }
      return null;
    case 'perfileria':
      if (!values.material_id && !values.description) {
        return 'Indicá qué perfil es.';
      }
      if (!values.length_mm) return 'El perfil necesita una longitud.';
      return null;
    default:
      if (!values.material_id && !values.description) {
        return 'Agregá una descripción.';
      }
      return null;
  }
}

export async function addPart(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(baseSchema, formData);
  if (parsed.error) return parsed.error;

  const invalid = validateKind(parsed.data);
  if (invalid) return fail(invalid);

  const supabase = await createClient();

  const { count } = await supabase
    .from('item_parts')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', parsed.data.item_id)
    .eq('kind', parsed.data.kind);

  const { data, error } = await supabase
    .from('item_parts')
    .insert({ ...parsed.data, sort_order: (count ?? 0) + 1 })
    .select('id')
    .single();

  if (error) return fail(`No se pudo agregar la fila: ${error.message}`);

  const { data: item } = await supabase
    .from('measurement_items')
    .select('measurement_id')
    .eq('id', parsed.data.item_id)
    .maybeSingle();

  await logEvent(supabase, user.id, {
    entityType: 'item_part',
    entityId: data.id,
    measurementId: item?.measurement_id ?? null,
    action: 'part.added',
    description: `agregó una fila de despiece (${PART_KIND_LABELS[parsed.data.kind]})`,
  });

  revalidatePath(`/items/${parsed.data.item_id}/despiece`);
  revalidatePath(`/items/${parsed.data.item_id}`);
  return succeed('Fila agregada', data.id);
}

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export async function updatePart(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(updateSchema, formData);
  if (parsed.error) return parsed.error;

  const invalid = validateKind(parsed.data);
  if (invalid) return fail(invalid);

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from('item_parts').update(values).eq('id', id);
  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath(`/items/${values.item_id}/despiece`);
  return succeed('Fila actualizada', id);
}

export async function deletePart(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from('item_parts').delete().eq('id', id);

  if (!error) {
    await logEvent(supabase, user.id, {
      entityType: 'item_part',
      entityId: id,
      action: 'part.deleted',
      description: 'eliminó una fila del despiece',
    });
  }

  revalidatePath(`/items/${itemId}/despiece`);
  revalidatePath(`/items/${itemId}`);
}
