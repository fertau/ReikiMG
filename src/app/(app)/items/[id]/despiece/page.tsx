import { loadItemContext } from '@/lib/item-context';
import { BackLink, PageHeader } from '@/components/ui';
import { dimensions } from '@/lib/format';
import { PartsGroup } from './parts-group';
import type { ItemPart, Material, PartKind } from '@/lib/types';

export const metadata = { title: 'Despiece' };

const KINDS: PartKind[] = ['vidrio', 'perfileria', 'herraje', 'otro'];
const CATALOG_KEYS = [
  'tipo_vidrio',
  'espesor',
  'terminacion',
  'color',
  'perfileria',
  'herraje',
  'material',
];

export default async function DespiecePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, item, canEdit, title } = await loadItemContext(id);

  const [{ data: partRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from('item_parts')
      .select('*, material:materials(id, name, code)')
      .eq('item_id', id)
      .order('kind')
      .order('sort_order'),
    supabase.from('material_categories').select('id, key').in('key', CATALOG_KEYS),
  ]);

  const parts = (partRows ?? []) as unknown as ItemPart[];
  const categories = (categoryRows ?? []) as { id: string; key: string }[];

  const catalogs: Record<string, Material[]> = {};
  if (categories.length > 0) {
    const { data: materialRows } = await supabase
      .from('materials')
      .select('*')
      .in(
        'category_id',
        categories.map((category) => category.id),
      )
      .eq('is_active', true)
      .order('sort_order');

    const byId = new Map(categories.map((category) => [category.id, category.key]));
    for (const material of (materialRows ?? []) as unknown as Material[]) {
      const key = byId.get(material.category_id);
      if (!key) continue;
      (catalogs[key] ??= []).push(material);
    }
  }

  return (
    <>
      <BackLink href={`/items/${id}`} label={title} />
      <PageHeader
        title="Despiece"
        subtitle={`${item.product_type.name} · ${dimensions(item.width_mm, item.height_mm, item.depth_mm)}`}
      />

      {KINDS.map((kind) => (
        <PartsGroup
          key={kind}
          itemId={id}
          kind={kind}
          parts={parts.filter((part) => part.kind === kind)}
          catalogs={catalogs}
          canEdit={canEdit}
        />
      ))}
    </>
  );
}
