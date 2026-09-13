import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status';
import { EmptyState, PageHeader, StatusChip } from '@/components/ui';
import type { OrderStatus, ProductionOrder } from '@/lib/types';

export const metadata: Metadata = { title: 'Órdenes' };

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'generada', label: 'Aprobadas' },
  { value: 'en_produccion', label: 'En producción' },
  { value: 'finalizada', label: 'Finalizadas' },
];

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  await requireUser();
  const { estado = '' } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('production_orders')
    .select(
      'id, number, status, issued_at, due_date, project:projects(id, name, client_name, address)',
    )
    .order('issued_at', { ascending: false })
    .limit(60);

  if (estado) query = query.eq('status', estado);

  const { data } = await query;
  const orders = (data ?? []) as unknown as ProductionOrder[];

  return (
    <>
      <PageHeader
        title="Órdenes de producción"
        subtitle={`${orders.length} orden${orders.length === 1 ? '' : 'es'}`}
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => {
          const active = estado === filter.value;
          return (
            <Link
              key={filter.value}
              href={filter.value ? `/ordenes?estado=${filter.value}` : '/ordenes'}
              className={
                active
                  ? 'chip bg-brand-600 text-white ring-brand-600'
                  : 'chip bg-white text-slate-600 ring-slate-300'
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Sin órdenes"
          description="Las órdenes se generan desde un relevamiento aprobado."
        />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/ordenes/${order.id}`} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{order.number}</p>
                  <p className="truncate text-sm text-muted">
                    {order.project?.name} · {order.project?.client_name}
                  </p>
                  <p className="text-xs text-muted">
                    Emitida {formatDate(order.issued_at)}
                    {order.due_date ? ` · Entrega ${formatDate(order.due_date)}` : ''}
                  </p>
                </div>
                <StatusChip {...ORDER_STATUS[order.status as OrderStatus]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
