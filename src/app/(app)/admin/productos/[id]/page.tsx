import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Alert, BackLink, PageHeader } from '@/components/ui';
import { FieldEditor } from './field-editor';
import type { MaterialCategory, ProductField, ProductType } from '@/lib/types';

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('admin');
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: productRow }, { data: fieldRows }, { data: categoryRows }] =
    await Promise.all([
      supabase
        .from('product_types')
        .select('*, family:product_families(name)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('product_fields')
        .select('*')
        .eq('product_type_id', id)
        .order('sort_order'),
      supabase.from('material_categories').select('*').order('sort_order'),
    ]);

  if (!productRow) notFound();
  const product = productRow as unknown as ProductType & { family: { name: string } | null };

  return (
    <>
      <BackLink href="/admin/productos" label="Productos" />
      <PageHeader
        title={product.name}
        subtitle={`${product.family?.name ?? ''} · ${product.code}`}
      />

      <div className="mb-4">
        <Alert tone="info">
          Cantidad, ancho, alto, profundidad y observaciones se muestran siempre. Acá se
          configuran los campos propios de este producto.
        </Alert>
      </div>

      <FieldEditor
        productTypeId={id}
        fields={(fieldRows ?? []) as unknown as ProductField[]}
        categories={(categoryRows ?? []) as unknown as MaterialCategory[]}
      />
    </>
  );
}
