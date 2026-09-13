import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  canEditMeasurement,
  canGenerateOrder,
  canReviewMeasurement,
  hasAnyRole,
  requireUser,
} from '@/lib/auth';
import { displayName, formatDateTime } from '@/lib/format';
import { MEASUREMENT_STATUS } from '@/lib/status';
import {
  Alert,
  BackLink,
  DataRow,
  PageHeader,
  Section,
  StatusChip,
} from '@/components/ui';
import { HistoryIcon } from '@/components/icons';
import { MeasurementTree, type TreeItem } from './tree';
import { MeasurementNotes, SubmitForReview, UnlockToggle } from './workflow';
import type { Location, Measurement, Room } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('measurements')
    .select('code')
    .eq('id', id)
    .maybeSingle();
  return { title: data?.code ?? 'Relevamiento' };
}

interface ItemRow {
  id: string;
  room_id: string;
  label: string | null;
  quantity: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  sort_order: number;
  product_type: { name: string } | null;
  photos: { count: number }[];
  item_notes: { count: number }[];
  audios: { count: number }[];
  parts: { count: number }[];
}

export default async function RelevamientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: measurementRow } = await supabase
    .from('measurements')
    .select(
      `*,
       project:projects(id, code, name, client_name, address),
       assignee:users!measurements_assigned_to_fkey(id, full_name, email),
       reviewer:users!measurements_reviewed_by_fkey(id, full_name, email)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!measurementRow) notFound();
  const measurement = measurementRow as unknown as Measurement & {
    reviewer?: { full_name: string | null } | null;
  };
  const projectId = measurement.project_id;

  const [{ data: locationRows }, { data: itemRows }, { data: orderRow }] = await Promise.all([
    supabase.from('locations').select('*').eq('project_id', projectId).order('sort_order'),
    supabase
      .from('measurement_items')
      .select(
        `id, room_id, label, quantity, width_mm, height_mm, depth_mm, sort_order,
         product_type:product_types(name),
         photos:item_photos(count),
         item_notes:item_notes(count),
         audios:item_audio(count),
         parts:item_parts(count)`,
      )
      .eq('measurement_id', id)
      .order('sort_order'),
    supabase
      .from('production_orders')
      .select('id, number, status')
      .eq('measurement_id', id)
      .maybeSingle(),
  ]);

  const locations = (locationRows ?? []) as unknown as Location[];
  const locationIds = locations.map((l) => l.id);

  const { data: roomRows } = locationIds.length
    ? await supabase
        .from('rooms')
        .select('*')
        .in('location_id', locationIds)
        .order('sort_order')
    : { data: [] };

  const rooms = (roomRows ?? []) as unknown as Room[];

  const items: TreeItem[] = ((itemRows ?? []) as unknown as ItemRow[]).map((row) => ({
    id: row.id,
    room_id: row.room_id,
    label: row.label,
    quantity: row.quantity,
    width_mm: row.width_mm,
    height_mm: row.height_mm,
    depth_mm: row.depth_mm,
    product_name: row.product_type?.name ?? 'Producto',
    photos: row.photos?.[0]?.count ?? 0,
    notes: row.item_notes?.[0]?.count ?? 0,
    audios: row.audios?.[0]?.count ?? 0,
    parts: row.parts?.[0]?.count ?? 0,
  }));

  const canEdit = canEditMeasurement(user, measurement);
  const canReview = canReviewMeasurement(user, measurement);
  const canOrder = canGenerateOrder(user, measurement);
  const isSupervisor = hasAnyRole(user, 'supervisor');

  return (
    <>
      <BackLink href={`/obras/${projectId}`} label={measurement.project?.name ?? 'Obra'} />

      <PageHeader
        title={measurement.code}
        subtitle={
          <>
            {measurement.project?.client_name}
            {measurement.project?.address ? ` · ${measurement.project.address}` : ''}
          </>
        }
        action={<StatusChip {...MEASUREMENT_STATUS[measurement.status]} />}
      />

      {measurement.status === 'corregir' && measurement.review_notes ? (
        <div className="mb-4">
          <Alert tone="danger" title="Devuelto para corregir">
            <p className="whitespace-pre-line">{measurement.review_notes}</p>
            <p className="mt-1 text-xs">
              {displayName(measurement.reviewer)} · {formatDateTime(measurement.reviewed_at)}
            </p>
          </Alert>
        </div>
      ) : null}

      {measurement.status === 'a_revisar' ? (
        <div className="mb-4">
          <Alert tone="warn" title="En revisión">
            El relevamiento está bloqueado para edición mientras el supervisor lo revisa.
          </Alert>
        </div>
      ) : null}

      {measurement.status === 'aprobado' && !measurement.unlocked_for_edit ? (
        <div className="mb-4">
          <Alert tone="ok" title="Aprobado">
            Aprobado por {displayName(measurement.reviewer)} el{' '}
            {formatDateTime(measurement.approved_at)}. No se puede modificar sin
            autorización del supervisor.
          </Alert>
        </div>
      ) : null}

      {measurement.unlocked_for_edit && measurement.status === 'aprobado' ? (
        <div className="mb-4">
          <Alert tone="warn" title="Edición autorizada">
            Un supervisor habilitó la edición de este relevamiento aprobado.
          </Alert>
        </div>
      ) : null}

      {orderRow ? (
        <div className="mb-4">
          <Alert tone="info" title={`Orden ${orderRow.number}`}>
            <Link href={`/ordenes/${orderRow.id}`} className="font-semibold underline">
              Ver la orden de producción
            </Link>
          </Alert>
        </div>
      ) : null}

      <Section title="Ambientes e ítems">
        <MeasurementTree
          measurementId={id}
          projectId={projectId}
          locations={locations}
          rooms={rooms}
          items={items}
          canEdit={canEdit}
        />
      </Section>

      <Section title="Observaciones">
        <MeasurementNotes
          measurementId={id}
          notes={measurement.notes}
          canEdit={canEdit}
        />
      </Section>

      <Section title="Datos del relevamiento">
        <dl className="card-pad">
          <DataRow label="Medidor" value={displayName(measurement.assignee)} />
          <DataRow label="Creado" value={formatDateTime(measurement.created_at)} />
          <DataRow label="Ítems cargados" value={items.length} />
          {measurement.submitted_at ? (
            <DataRow label="Enviado a revisión" value={formatDateTime(measurement.submitted_at)} />
          ) : null}
          {measurement.approved_at ? (
            <DataRow label="Aprobado" value={formatDateTime(measurement.approved_at)} />
          ) : null}
        </dl>
      </Section>

      <div className="space-y-3">
        {canEdit && items.length > 0 ? <SubmitForReview measurementId={id} /> : null}

        {canEdit && items.length === 0 ? (
          <Alert tone="info">
            Agregá al menos un ítem para poder enviar el relevamiento a revisión.
          </Alert>
        ) : null}

        {canReview ? (
          <Link
            href={`/relevamientos/${id}/revision`}
            className="btn-primary w-full py-4 text-base"
          >
            REVISAR RELEVAMIENTO
          </Link>
        ) : null}

        {canOrder ? (
          <Link href={`/relevamientos/${id}/orden`} className="btn-success w-full py-4">
            GENERAR ORDEN DE PRODUCCIÓN
          </Link>
        ) : null}

        {isSupervisor && measurement.status === 'aprobado' ? (
          <UnlockToggle measurementId={id} unlocked={measurement.unlocked_for_edit} />
        ) : null}

        <Link
          href={`/relevamientos/${id}/historial`}
          className="btn-secondary btn-sm w-full"
        >
          <HistoryIcon className="size-4" />
          Ver historial
        </Link>
      </div>
    </>
  );
}
