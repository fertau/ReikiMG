import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, requireUser } from '@/lib/auth';
import { loadOrder } from '@/lib/order-data';
import { formatDate } from '@/lib/format';
import { ORDER_STATUS, PART_KIND_LABELS } from '@/lib/status';
import {
  BackLink,
  DataRow,
  PageHeader,
  Section,
  StatusChip,
} from '@/components/ui';
import { PrintIcon } from '@/components/icons';
import { itemDimensions, PART_ORDER, partDetail, partMeasure } from '@/lib/order-pdf';
import { PdfButton } from './pdf-button';
import { OrderStatusActions } from './status-actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('production_orders')
    .select('number')
    .eq('id', id)
    .maybeSingle();
  return { title: data?.number ?? 'Orden' };
}

export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const loaded = await loadOrder(supabase, id);
  if (!loaded) notFound();

  const { order, snapshots, photoUrls, pdf } = loaded;
  const canChangeStatus = hasAnyRole(user, 'supervisor', 'produccion');

  return (
    <>
      <BackLink href="/ordenes" label="Órdenes" />

      <PageHeader
        title={order.number}
        subtitle={`${order.project?.name} · ${order.project?.client_name}`}
        action={<StatusChip {...ORDER_STATUS[order.status]} />}
      />

      <div className="mb-5 space-y-2">
        <PdfButton data={pdf} />
        <Link href={`/ordenes/${id}/imprimir`} className="btn-secondary w-full" target="_blank">
          <PrintIcon className="size-5" />
          Vista de impresión
        </Link>
        {canChangeStatus ? <OrderStatusActions orderId={id} status={order.status} /> : null}
      </div>

      <Section title="Datos de la orden">
        <dl className="card-pad">
          <DataRow label="Emitida" value={formatDate(order.issued_at)} />
          <DataRow label="Entrega prevista" value={formatDate(order.due_date)} />
          <DataRow label="Obra" value={`${order.project?.name} (${order.project?.code})`} />
          <DataRow label="Dirección" value={order.project?.address ?? '—'} />
          <DataRow label="Relevamiento" value={pdf.measurementCode} />
          <DataRow label="Medidor" value={pdf.measuredBy} />
          <DataRow label="Aprobó" value={pdf.approvedBy} />
          <DataRow label="Ítems" value={snapshots.length} />
        </dl>
      </Section>

      {order.notes ? (
        <Section title="Indicaciones para producción">
          <p className="card-pad text-sm whitespace-pre-line text-slate-700">{order.notes}</p>
        </Section>
      ) : null}

      {snapshots.map((snapshot, index) => (
        <Section
          key={snapshot.item_id}
          title={`Ítem ${index + 1} · ${snapshot.location} · ${snapshot.room}`}
        >
          <article className="card-pad">
            <header className="mb-3">
              <h3 className="font-semibold text-ink">
                {snapshot.label ? `${snapshot.label} — ${snapshot.product}` : snapshot.product}
              </h3>
              <p className="text-sm text-muted">
                {snapshot.quantity > 1 ? `${snapshot.quantity} × ` : ''}
                {itemDimensions(snapshot)}
              </p>
            </header>

            {snapshot.fields.length > 0 ? (
              <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1">
                {snapshot.fields.map((field) => (
                  <div key={field.label} className="text-sm">
                    <dt className="text-xs text-muted">{field.label}</dt>
                    <dd className="font-medium text-ink">{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {snapshot.parts.length > 0 ? (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-muted">
                      <th className="py-1 pr-2 font-semibold">Tipo</th>
                      <th className="py-1 pr-2 font-semibold">Cant.</th>
                      <th className="py-1 pr-2 font-semibold">Medidas</th>
                      <th className="py-1 font-semibold">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PART_ORDER.flatMap((kind) =>
                      snapshot.parts
                        .filter((part) => part.kind === kind)
                        .map((part, partIndex) => (
                          <tr key={`${kind}-${partIndex}`} className="border-b border-slate-100">
                            <td className="py-1 pr-2 text-muted">{PART_KIND_LABELS[kind]}</td>
                            <td className="py-1 pr-2 tabular-nums">
                              {part.quantity}
                              {part.unit ? ` ${part.unit}` : ''}
                            </td>
                            <td className="py-1 pr-2 tabular-nums">{partMeasure(part) || '—'}</td>
                            <td className="py-1">
                              {[part.description, partDetail(part)].filter(Boolean).join(' · ')}
                              {part.notes ? (
                                <span className="block text-xs text-muted">{part.notes}</span>
                              ) : null}
                            </td>
                          </tr>
                        )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}

            {snapshot.notes ? (
              <p className="mb-3 rounded-lg bg-slate-50 p-2 text-sm whitespace-pre-line text-slate-700">
                {snapshot.notes}
              </p>
            ) : null}

            {snapshot.item_notes.length > 0 ? (
              <ul className="mb-3 space-y-1 text-sm text-slate-700">
                {snapshot.item_notes.map((note, noteIndex) => (
                  <li key={noteIndex} className="whitespace-pre-line">
                    · {note}
                  </li>
                ))}
              </ul>
            ) : null}

            {snapshot.photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {snapshot.photos.map((photo) => {
                  const url = photoUrls.get(photo.storage_path);
                  return url ? (
                    <a
                      key={photo.id}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg bg-slate-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={photo.caption ?? photo.category}
                        loading="lazy"
                        className="h-24 w-full object-cover"
                      />
                    </a>
                  ) : null;
                })}
              </div>
            ) : null}
          </article>
        </Section>
      ))}
    </>
  );
}
