'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, isAdmin } from '@/lib/auth';
import {
  fail,
  optionalText,
  parseForm,
  requiredText,
  succeed,
  type ActionState,
} from '@/lib/action-state';

async function requireAdmin(): Promise<string | null> {
  const user = await getSessionUser();
  return isAdmin(user) ? user!.id : null;
}

const materialSchema = z.object({
  id: optionalText,
  category_id: z.string().uuid(),
  category_key: z.string(),
  code: optionalText,
  name: requiredText('El nombre'),
  sort_order: z.coerce.number().int().default(0),
});

export async function saveMaterial(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) return fail('Sólo un administrador puede editar catálogos.');

  const parsed = parseForm(materialSchema, formData);
  if (parsed.error) return parsed.error;

  const { id, category_key, ...values } = parsed.data;
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from('materials').update(values).eq('id', id)
    : await supabase.from('materials').insert(values);

  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath(`/admin/catalogos/${category_key}`);
  return succeed(id ? 'Actualizado' : 'Agregado');
}

export async function toggleMaterial(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const id = String(formData.get('id') ?? '');
  const key = String(formData.get('category_key') ?? '');
  const active = formData.get('active') === '1';
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('materials').update({ is_active: active }).eq('id', id);
  revalidatePath(`/admin/catalogos/${key}`);
}

const photoCategorySchema = z.object({
  id: optionalText,
  code: requiredText('El código', 40),
  label: requiredText('La etiqueta'),
  sort_order: z.coerce.number().int().default(0),
});

export async function savePhotoCategory(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) return fail('Sólo un administrador puede editar catálogos.');

  const parsed = parseForm(photoCategorySchema, formData);
  if (parsed.error) return parsed.error;

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from('photo_categories').update(values).eq('id', id)
    : await supabase.from('photo_categories').insert(values);

  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath('/admin/catalogos/fotos');
  return succeed(id ? 'Actualizado' : 'Agregado');
}

const familySchema = z.object({
  id: optionalText,
  code: requiredText('El código', 40),
  name: requiredText('El nombre'),
  sort_order: z.coerce.number().int().default(0),
});

export async function saveProductFamily(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) return fail('Sólo un administrador puede editar productos.');

  const parsed = parseForm(familySchema, formData);
  if (parsed.error) return parsed.error;

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from('product_families').update(values).eq('id', id)
    : await supabase.from('product_families').insert(values);

  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath('/admin/productos');
  return succeed(id ? 'Actualizado' : 'Familia creada');
}

const productSchema = z.object({
  id: optionalText,
  family_id: z.string().uuid('Elegí una familia'),
  code: requiredText('El código', 40),
  name: requiredText('El nombre'),
  description: optionalText,
  requires_depth: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().default(0),
});

export async function saveProductType(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) return fail('Sólo un administrador puede editar productos.');

  const parsed = parseForm(
    productSchema.extend({
      requires_depth: z
        .union([z.literal('1'), z.literal('')])
        .optional()
        .transform((value) => value === '1'),
    }),
    formData,
  );
  if (parsed.error) return parsed.error;

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  const { data, error } = id
    ? await supabase.from('product_types').update(values).eq('id', id).select('id').single()
    : await supabase.from('product_types').insert(values).select('id').single();

  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath('/admin/productos');
  return succeed(id ? 'Producto actualizado' : 'Producto creado', data.id);
}

export async function toggleProductType(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === '1';
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('product_types').update({ is_active: active }).eq('id', id);
  revalidatePath('/admin/productos');
}

const fieldSchema = z.object({
  id: optionalText,
  product_type_id: z.string().uuid(),
  field_key: z
    .string()
    .trim()
    .min(1, 'La clave es obligatoria')
    .regex(/^[a-z0-9_]+$/, 'Usá sólo minúsculas, números y guión bajo'),
  label: requiredText('La etiqueta'),
  field_type: z.enum([
    'text',
    'textarea',
    'number',
    'select',
    'multiselect',
    'boolean',
    'catalog',
  ]),
  section: requiredText('La sección', 60),
  unit: optionalText,
  catalog_key: optionalText,
  options_text: optionalText,
  help_text: optionalText,
  is_required: z
    .union([z.literal('1'), z.literal('')])
    .optional()
    .transform((value) => value === '1'),
  sort_order: z.coerce.number().int().default(0),
});

export async function saveProductField(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) return fail('Sólo un administrador puede editar campos.');

  const parsed = parseForm(fieldSchema, formData);
  if (parsed.error) return parsed.error;

  const { id, options_text, ...values } = parsed.data;

  const options =
    options_text
      ?.split('\n')
      .map((option) => option.trim())
      .filter(Boolean) ?? null;

  if ((values.field_type === 'select' || values.field_type === 'multiselect') && !options?.length) {
    return fail('Cargá al menos una opción, una por línea.');
  }
  if (values.field_type === 'catalog' && !values.catalog_key) {
    return fail('Elegí el catálogo del que se toman las opciones.');
  }

  const payload = { ...values, options: options?.length ? options : null };
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from('product_fields').update(payload).eq('id', id)
    : await supabase.from('product_fields').insert(payload);

  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath(`/admin/productos/${values.product_type_id}`);
  return succeed(id ? 'Campo actualizado' : 'Campo agregado');
}

export async function deleteProductField(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const id = String(formData.get('id') ?? '');
  const productTypeId = String(formData.get('product_type_id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('product_fields').delete().eq('id', id);
  revalidatePath(`/admin/productos/${productTypeId}`);
}
