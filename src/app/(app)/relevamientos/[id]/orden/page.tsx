import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, requireUser } from '@/lib/auth';
import { loadMeasurementFull } from '@/lib/measurement-data';
import { Alert, BackLink, DataRow, PageHeader, Section } from '@/components/ui';
import { OrderForm, itemSubtitle, type OrderItemOption } from './order-form';

export const metadata = { title: 'Generar orden' };

export default async function GenerarOrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const full = await loadMeasurementFull(supabase, id);
  if (!full) notFound();

  if (!hasAnyRole(user, 'supervisor')) redirect(`/relevamientos/${id}`);

  const { measurement, project, items } = full;

  const { data: existing } = await supabase
    .from('production_orders')
    .select('id, number')
    .eq('measurement_id', id)
    .maybeSingle();

  if (existing) redirect(`/ordenes/${existing.id}`);

  if (measurement.status !== 'aprobado') {
    return (
      <>
        <BackLink href={`/relevamientos/${id}`} label={measurement.code} />
        <PageHeader title="Generar orden" />
        <Alert tone="warn" title="El relevamiento no está aprobado">
          Sólo se puede emitir una orden a partir de un relevamiento aprobado.
        </Alert>
      </>
    );
  }

  const paths = items.flatMap((entry) => entry.photos.map((photo) => photo.storage_path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('item-photos')
      .createSignedUrls(paths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) urls.set(entry.path, entry.signedUrl);
    }
  }

  const options: OrderItemOption[] = items.map((entry) => ({
    id: entry.item.id,
    title: entry.item.label || entry.productType.name,
    subtitle: `${entry.location.name} · ${entry.room.name} — ${itemSubtitle(
      entry.item.quantity,
      entry.item.width_mm,
      entry.item.height_mm,
      entry.item.depth_mm,
    )}`,
    photos: entry.photos.map((photo) => ({
      id: photo.id,
      url: urls.get(photo.storage_path) ?? null,
      category: photo.category,
      caption: photo.caption,
    })),
  }));

  return (
    <>
      <BackLink href={`/relevamientos/${id}`} label={measurement.code} />
      <PageHeader title="Generar orden de producción" subtitle={project.name} />

      <Section title="Resumen">
        <dl className="card-pad">
          <DataRow label="Obra" value={project.name} />
          <DataRow label="Cliente" value={project.client_name} />
          <DataRow label="Relevamiento" value={measurement.code} />
          <DataRow label="Ítems" value={items.length} />
        </dl>
      </Section>

      <OrderForm measurementId={id} items={options} />
    </>
  );
}
