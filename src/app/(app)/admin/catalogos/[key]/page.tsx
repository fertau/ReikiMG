import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { BackLink, PageHeader } from '@/components/ui';
import { MaterialEditor, PhotoCategoryEditor } from './catalog-editor';
import type { Material, MaterialCategory, PhotoCategory } from '@/lib/types';

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireRole('admin');
  const { key } = await params;
  const supabase = await createClient();

  if (key === 'fotos') {
    const { data } = await supabase
      .from('photo_categories')
      .select('*')
      .order('sort_order');

    return (
      <>
        <BackLink href="/admin/catalogos" label="Catálogos" />
        <PageHeader title="Categorías de fotografía" />
        <PhotoCategoryEditor categories={(data ?? []) as unknown as PhotoCategory[]} />
      </>
    );
  }

  const { data: categoryRow } = await supabase
    .from('material_categories')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (!categoryRow) notFound();
  const category = categoryRow as unknown as MaterialCategory;

  const { data: materialRows } = await supabase
    .from('materials')
    .select('*')
    .eq('category_id', category.id)
    .order('sort_order');

  return (
    <>
      <BackLink href="/admin/catalogos" label="Catálogos" />
      <PageHeader title={category.name} subtitle={category.description ?? undefined} />
      <MaterialEditor
        categoryId={category.id}
        categoryKey={category.key}
        materials={(materialRows ?? []) as unknown as Material[]}
      />
    </>
  );
}
