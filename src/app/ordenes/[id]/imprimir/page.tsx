import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { loadOrder } from '@/lib/order-data';
import { itemDimensions, PART_ORDER, partDetail, partMeasure } from '@/lib/order-pdf';
import { PART_KIND_LABELS } from '@/lib/status';
import { PrintButton } from './print-button';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('production_orders')
    .select('number')
    .eq('id', id)
    .maybeSingle();
  return { title: data?.number ?? 'Orden de producción' };
}

export default async function ImprimirOrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const loaded = await loadOrder(supabase, id);
  if (!loaded) notFound();

  const { order, snapshots, photoUrls, pdf } = loaded;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 14mm; }
        .sheet { max-width: 210mm; margin: 0 auto; background: #fff; color: #0f172a; }
        .sheet table { width: 100%; border-collapse: collapse; }
        .sheet th, .sheet td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; vertical-align: top; }
        .sheet th { background: #f1f5f9; font-size: 9pt; }
        .sheet td { font-size: 9pt; }
        .item { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }
        .item-title { background: #0f172a; color: #fff; padding: 2mm 3mm; font-weight: 700; font-size: 10pt; }
        .meta td { border: 0; padding: 1px 4px 1px 0; font-size: 9pt; }
        .meta .k { font-weight: 700; width: 26mm; }
        @media print {
          body { background: #fff; }
          .sheet { max-width: none; }
        }
      `}</style>

      <div className="bg-white py-6">
        <PrintButton />

        <div className="sheet px-4 print:px-0">
          <header className="mb-4 border-b-2 border-brand-600 pb-2">
            <div className="flex items-end justify-between">
              <h1 className="text-xl font-bold">ORDEN DE PRODUCCIÓN</h1>
              <span className="text-lg font-bold">{order.number}</span>
            </div>
          </header>

          <table className="meta mb-4">
            <tbody>
              <tr>
                <td className="k">Fecha</td>
                <td>{pdf.issuedAt}</td>
                <td className="k">Cliente</td>
                <td>{pdf.clientName}</td>
              </tr>
              <tr>
                <td className="k">Obra</td>
                <td>
                  {pdf.projectName} ({pdf.projectCode})
                </td>
                <td className="k">Dirección</td>
                <td>{pdf.address ?? '—'}</td>
              </tr>
              <tr>
                <td className="k">Contacto</td>
                <td>
                  {[pdf.contactName, pdf.contactPhone].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="k">Entrega</td>
                <td>{pdf.dueDate ?? '—'}</td>
              </tr>
              <tr>
                <td className="k">Relevamiento</td>
                <td>{pdf.measurementCode}</td>
                <td className="k">Medidor</td>
                <td>{pdf.measuredBy}</td>
              </tr>
              <tr>
                <td className="k">Aprobó</td>
                <td>{pdf.approvedBy}</td>
                <td className="k">Ítems</td>
                <td>{snapshots.length}</td>
              </tr>
            </tbody>
          </table>

          {order.notes ? (
            <div className="mb-4">
              <table>
                <thead>
                  <tr>
                    <th>Indicaciones para producción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="whitespace-pre-line">{order.notes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {snapshots.map((snapshot, index) => (
            <section key={snapshot.item_id} className="item">
              <div className="item-title">
                ÍTEM {index + 1} · {snapshot.location} · {snapshot.room}
              </div>

              <table className="mb-1">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ width: '20mm' }}>Cantidad</th>
                    <th style={{ width: '42mm' }}>Medidas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {snapshot.label
                        ? `${snapshot.label} — ${snapshot.product}`
                        : snapshot.product}
                    </td>
                    <td>{snapshot.quantity}</td>
                    <td>{itemDimensions(snapshot)}</td>
                  </tr>
                </tbody>
              </table>

              {snapshot.fields.length > 0 ? (
                <table className="mb-1">
                  <tbody>
                    {Array.from(
                      { length: Math.ceil(snapshot.fields.length / 2) },
                      (_, row) => {
                        const left = snapshot.fields[row * 2]!;
                        const right = snapshot.fields[row * 2 + 1];
                        return (
                          <tr key={left.label}>
                            <td style={{ width: '32mm', fontWeight: 700 }}>{left.label}</td>
                            <td>{left.value}</td>
                            <td style={{ width: '32mm', fontWeight: 700 }}>
                              {right?.label ?? ''}
                            </td>
                            <td>{right?.value ?? ''}</td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              ) : null}

              {snapshot.parts.length > 0 ? (
                <table className="mb-1">
                  <thead>
                    <tr>
                      <th style={{ width: '22mm' }}>Tipo</th>
                      <th style={{ width: '14mm' }}>Cant.</th>
                      <th style={{ width: '28mm' }}>Medidas</th>
                      <th>Descripción</th>
                      <th style={{ width: '32mm' }}>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PART_ORDER.flatMap((kind) =>
                      snapshot.parts
                        .filter((part) => part.kind === kind)
                        .map((part, partIndex) => (
                          <tr key={`${kind}-${partIndex}`}>
                            <td>{PART_KIND_LABELS[kind]}</td>
                            <td>
                              {part.quantity}
                              {part.unit ? ` ${part.unit}` : ''}
                            </td>
                            <td>{partMeasure(part) || '—'}</td>
                            <td>
                              {[part.description, partDetail(part)]
                                .filter(Boolean)
                                .join(' · ')}
                            </td>
                            <td>{part.notes ?? ''}</td>
                          </tr>
                        )),
                    )}
                  </tbody>
                </table>
              ) : null}

              {snapshot.notes || snapshot.item_notes.length > 0 ? (
                <table className="mb-1">
                  <tbody>
                    {snapshot.notes ? (
                      <tr>
                        <td style={{ width: '26mm', fontWeight: 700 }}>Observaciones</td>
                        <td className="whitespace-pre-line">{snapshot.notes}</td>
                      </tr>
                    ) : null}
                    {snapshot.item_notes.map((note, noteIndex) => (
                      <tr key={noteIndex}>
                        <td style={{ width: '26mm', fontWeight: 700 }}>Nota</td>
                        <td className="whitespace-pre-line">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              {snapshot.photos.length > 0 ? (
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {snapshot.photos.map((photo) => {
                    const url = photoUrls.get(photo.storage_path);
                    return url ? (
                      <figure key={photo.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={photo.caption ?? photo.category}
                          className="w-full rounded border border-slate-300 object-cover"
                          style={{ maxHeight: '70mm' }}
                        />
                        <figcaption className="text-[8pt] text-slate-500">
                          {[photo.category, photo.caption].filter(Boolean).join(' · ')}
                        </figcaption>
                      </figure>
                    ) : null;
                  })}
                </div>
              ) : null}
            </section>
          ))}

          <footer className="mt-6 border-t border-slate-300 pt-2 text-[8pt] text-slate-500">
            {order.number} · {pdf.projectName} · Emitida {pdf.issuedAt}
          </footer>
        </div>
      </div>
    </>
  );
}
