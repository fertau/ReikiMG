import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { BackLink, PageHeader } from '@/components/ui';
import { FamilyForm, ProductList } from './product-editor';
import type { ProductFamily, ProductType } from '@/lib/types';

export const metadata: Metadata = { title: 'Productos' };

export default async function ProductosPage() {
  await requireRole('admin');
  const supabase = await createClient();

  const [{ data: familyRows }, { data: typeRows }] = await Promise.all([
    supabase.from('product_families').select('*').order('sort_order'),
    supabase.from('product_types').select('*').order('sort_order'),
  ]);

  const families = (familyRows ?? []) as unknown as ProductFamily[];
  const types = (typeRows ?? []) as unknown as ProductType[];

  return (
    <>
      <BackLink href="/admin" label="Administración" />
      <PageHeader
        title="Productos"
        subtitle="Tocá un producto para configurar los campos que se cargan en obra"
      />

      <div className="mb-4">
        <FamilyForm families={families} />
      </div>

      <div className="space-y-4">
        {families.map((family) => (
          <ProductList
            key={family.id}
            family={family}
            products={types.filter((type) => type.family_id === family.id)}
          />
        ))}
      </div>
    </>
  );
}
