import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { BackLink, PageHeader } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';
import type { MaterialCategory } from '@/lib/types';

export const metadata: Metadata = { title: 'Catálogos' };

export default async function CatalogosPage() {
  await requireRole('admin');
  const supabase = await createClient();

  const [{ data: categoryRows }, { count: photoCount }] = await Promise.all([
    supabase.from('material_categories').select('*').order('sort_order'),
    supabase.from('photo_categories').select('id', { count: 'exact', head: true }),
  ]);

  const categories = (categoryRows ?? []) as unknown as MaterialCategory[];

  const counts = new Map<string, number>();
  for (const category of categories) {
    const { count } = await supabase
      .from('materials')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', category.id);
    counts.set(category.id, count ?? 0);
  }

  return (
    <>
      <BackLink href="/admin" label="Administración" />
      <PageHeader title="Catálogos" subtitle="Valores que se ofrecen al cargar un ítem" />

      <ul className="card divide-y divide-slate-100">
        {categories.map((category) => (
          <li key={category.id}>
            <Link href={`/admin/catalogos/${category.key}`} className="list-row">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{category.name}</p>
                {category.description ? (
                  <p className="truncate text-sm text-muted">{category.description}</p>
                ) : null}
              </div>
              <span className="text-sm tabular-nums text-muted">
                {counts.get(category.id) ?? 0}
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
        <li>
          <Link href="/admin/catalogos/fotos" className="list-row">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Categorías de fotografía</p>
              <p className="truncate text-sm text-muted">
                Vista general, laterales, piso, techo, detalle, croquis
              </p>
            </div>
            <span className="text-sm tabular-nums text-muted">{photoCount ?? 0}</span>
            <ChevronRightIcon className="size-5 shrink-0 text-slate-400" />
          </Link>
        </li>
      </ul>
    </>
  );
}
