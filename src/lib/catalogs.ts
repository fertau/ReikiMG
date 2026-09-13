import type { SupabaseClient } from '@supabase/supabase-js';
import type { Material, ProductField } from '@/lib/types';

export interface ProductFieldBundle {
  fields: ProductField[];
  catalogs: Record<string, Material[]>;
}

/**
 * Campos configurados para un producto junto con las opciones de catálogo
 * que necesitan. Se resuelve en el servidor para que el formulario del
 * celular llegue completo en el primer render.
 */
export async function loadProductFields(
  supabase: SupabaseClient,
  productTypeId: string,
): Promise<ProductFieldBundle> {
  const { data: fieldRows } = await supabase
    .from('product_fields')
    .select('*')
    .eq('product_type_id', productTypeId)
    .eq('is_active', true)
    .order('sort_order');

  const fields = (fieldRows ?? []) as unknown as ProductField[];
  const keys = [
    ...new Set(
      fields
        .filter((field) => field.field_type === 'catalog' && field.catalog_key)
        .map((field) => field.catalog_key as string),
    ),
  ];

  if (keys.length === 0) return { fields, catalogs: {} };

  const { data: categoryRows } = await supabase
    .from('material_categories')
    .select('id, key')
    .in('key', keys);

  const categories = (categoryRows ?? []) as { id: string; key: string }[];
  if (categories.length === 0) return { fields, catalogs: {} };

  const { data: materialRows } = await supabase
    .from('materials')
    .select('*')
    .in(
      'category_id',
      categories.map((category) => category.id),
    )
    .eq('is_active', true)
    .order('sort_order');

  const byCategory = new Map(categories.map((category) => [category.id, category.key]));
  const catalogs: Record<string, Material[]> = {};

  for (const material of (materialRows ?? []) as unknown as Material[]) {
    const key = byCategory.get(material.category_id);
    if (!key) continue;
    (catalogs[key] ??= []).push(material);
  }

  return { fields, catalogs };
}

/** Todos los materiales de una categoría, por clave. Se usa en el despiece. */
export async function loadCatalog(
  supabase: SupabaseClient,
  key: string,
): Promise<Material[]> {
  const { data: category } = await supabase
    .from('material_categories')
    .select('id')
    .eq('key', key)
    .maybeSingle();

  if (!category) return [];

  const { data } = await supabase
    .from('materials')
    .select('*')
    .eq('category_id', category.id)
    .eq('is_active', true)
    .order('sort_order');

  return (data ?? []) as unknown as Material[];
}
