import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, requireUser } from '@/lib/auth';
import { loadMeasurementFull } from '@/lib/measurement-data';
import { displayName, formatDateTime } from '@/lib/format';
import { MEASUREMENT_STATUS } from '@/lib/status';
import { Alert, BackLink, DataRow, PageHeader, Section, StatusChip } from '@/components/ui';
import { ItemSummary } from '@/components/item-summary';
import { ReviewActions } from './review-actions';

export const metadata = { title: 'Revisión' };

export default async function RevisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const full = await loadMeasurementFull(supabase, id);
  if (!full) notFound();

  if (!hasAnyRole(user, 'supervisor')) {
    redirect(`/relevamientos/${id}`);
  }

  const { measurement, project, items } = full;

  const paths = items.flatMap((entry) => entry.photos.map((photo) => photo.storage_path));
  const photoUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('item-photos')
      .createSignedUrls(paths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) photoUrls.set(entry.path, entry.signedUrl);
    }
  }

  const grouped = items.reduce<Record<string, typeof items>>((acc, entry) => {
    const key = `${entry.location.name} · ${entry.room.name}`;
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  const withoutParts = items.filter((entry) => entry.parts.length === 0).length;
  const withoutPhotos = items.filter((entry) => entry.photos.length === 0).length;

  return (
    <>
      <BackLink href={`/relevamientos/${id}`} label={measurement.code} />

      <PageHeader
        title="Revisión"
        subtitle={`${project.name} · ${project.client_name}`}
        action={<StatusChip {...MEASUREMENT_STATUS[measurement.status]} />}
      />

      {measurement.status !== 'a_revisar' ? (
        <div className="mb-4">
          <Alert tone="info" title="Este relevamiento no está esperando revisión">
            Estado actual: {MEASUREMENT_STATUS[measurement.status].label}.
          </Alert>
        </div>
      ) : null}

      {withoutParts > 0 || withoutPhotos > 0 ? (
        <div className="mb-4">
          <Alert tone="warn" title="Puntos a mirar antes de aprobar">
            <ul className="list-inside list-disc">
              {withoutParts > 0 ? (
                <li>
                  {withoutParts} ítem{withoutParts === 1 ? '' : 's'} sin despiece cargado.
                </li>
              ) : null}
              {withoutPhotos > 0 ? (
                <li>
                  {withoutPhotos} ítem{withoutPhotos === 1 ? '' : 's'} sin fotografías.
                </li>
              ) : null}
            </ul>
          </Alert>
        </div>
      ) : null}

      <Section title="Datos">
        <dl className="card-pad">
          <DataRow label="Obra" value={project.name} />
          <DataRow label="Dirección" value={project.address ?? '—'} />
          <DataRow label="Medidor" value={displayName(measurement.assignee)} />
          <DataRow label="Enviado" value={formatDateTime(measurement.submitted_at)} />
          <DataRow label="Ítems" value={items.length} />
          {measurement.notes ? (
            <DataRow label="Observaciones" value={measurement.notes} />
          ) : null}
        </dl>
      </Section>

      {Object.entries(grouped).map(([label, groupItems]) => (
        <Section key={label} title={label}>
          <div className="space-y-3">
            {groupItems.map((entry) => (
              <ItemSummary key={entry.item.id} full={entry} photoUrls={photoUrls} />
            ))}
          </div>
        </Section>
      ))}

      {items.length === 0 ? (
        <Alert tone="danger" title="Relevamiento vacío">
          No hay ítems cargados.{' '}
          <Link href={`/relevamientos/${id}`} className="underline">
            Volver al relevamiento
          </Link>
          .
        </Alert>
      ) : null}

      {measurement.status === 'a_revisar' ? (
        <div className="mt-6">
          <ReviewActions measurementId={id} />
        </div>
      ) : null}
    </>
  );
}
