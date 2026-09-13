import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, requireUser } from '@/lib/auth';
import { displayName, formatDate, formatDateTime } from '@/lib/format';
import { MEASUREMENT_STATUS, PROJECT_STATUS } from '@/lib/status';
import {
  Alert,
  BackLink,
  DataRow,
  EmptyState,
  PageHeader,
  Section,
  StatusChip,
} from '@/components/ui';
import { PlusIcon } from '@/components/icons';
import { ProjectStructure } from './structure';
import { createMeasurement } from '../../relevamientos/actions';
import type { Location, Measurement, Project, Room, WorkflowEvent } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('projects').select('name').eq('id', id).maybeSingle();
  return { title: data?.name ?? 'Obra' };
}

export default async function ObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error: errorParam } = await searchParams;
  const supabase = await createClient();

  const { data: projectRow } = await supabase
    .from('projects')
    .select(
      '*, assignee:users!projects_assigned_to_fkey(id, full_name, email)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!projectRow) notFound();
  const project = projectRow as unknown as Project;

  const [{ data: locationRows }, { data: measurementRows }, { data: historyRows }] =
    await Promise.all([
      supabase.from('locations').select('*').eq('project_id', id).order('sort_order'),
      supabase
        .from('measurements')
        .select(
          'id, code, status, created_at, updated_at, review_notes, assignee:users!measurements_assigned_to_fkey(id, full_name, email)',
        )
        .eq('project_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('workflow_history')
        .select('*, actor:users!workflow_history_actor_id_fkey(id, full_name)')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(8),
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
  const measurements = (measurementRows ?? []) as unknown as Measurement[];
  const history = (historyRows ?? []) as unknown as WorkflowEvent[];

  const canEditProject = hasAnyRole(user, 'supervisor');
  const canMeasure = hasAnyRole(user, 'medidor', 'supervisor');

  return (
    <>
      <BackLink href="/obras" label="Obras" />

      <PageHeader
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{project.code}</span>
            <span>·</span>
            <span>{project.client_name}</span>
          </span>
        }
        action={<StatusChip {...PROJECT_STATUS[project.status]} />}
      />

      {errorParam === 'relevamiento' ? (
        <div className="mb-4">
          <Alert tone="danger" title="No se pudo crear el relevamiento">
            Verificá que tengas la obra asignada y volvé a intentar.
          </Alert>
        </div>
      ) : null}

      <Section
        title="Datos de la obra"
        action={
          canEditProject ? (
            <Link
              href={`/obras/${project.id}/editar`}
              className="text-sm font-semibold text-brand-700"
            >
              Editar
            </Link>
          ) : null
        }
      >
        <dl className="card-pad">
          <DataRow label="Dirección" value={project.address ?? '—'} />
          <DataRow label="Contacto" value={project.contact_name ?? '—'} />
          <DataRow
            label="Teléfono"
            value={
              project.contact_phone ? (
                <a href={`tel:${project.contact_phone}`} className="text-brand-700">
                  {project.contact_phone}
                </a>
              ) : (
                '—'
              )
            }
          />
          <DataRow
            label="Responsable"
            value={project.assignee ? displayName(project.assignee) : 'Sin asignar'}
          />
          <DataRow label="Fecha" value={formatDate(project.scheduled_date)} />
          {project.notes ? <DataRow label="Observaciones" value={project.notes} /> : null}
        </dl>
      </Section>

      <Section title="Relevamientos">
        {canMeasure ? (
          <form action={createMeasurement} className="mb-3">
            <input type="hidden" name="project_id" value={project.id} />
            <button type="submit" className="btn-primary w-full">
              <PlusIcon className="size-5" />
              Nuevo relevamiento
            </button>
          </form>
        ) : null}

        {measurements.length === 0 ? (
          <EmptyState
            title="Sin relevamientos"
            description="Cuando se cree el primero va a aparecer acá."
          />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {measurements.map((m) => (
              <li key={m.id}>
                <Link href={`/relevamientos/${m.id}`} className="list-row">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{m.code}</p>
                    <p className="truncate text-sm text-muted">
                      {displayName(m.assignee)} · {formatDate(m.created_at)}
                    </p>
                    {m.status === 'corregir' && m.review_notes ? (
                      <p className="mt-1 line-clamp-2 text-sm text-red-700">
                        {m.review_notes}
                      </p>
                    ) : null}
                  </div>
                  <StatusChip {...MEASUREMENT_STATUS[m.status]} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Estructura · Unidades y ambientes">
        <ProjectStructure
          projectId={project.id}
          locations={locations}
          rooms={rooms}
          canEdit={canMeasure}
        />
      </Section>

      <Section
        title="Historial"
        action={
          <Link
            href={`/obras/${project.id}/historial`}
            className="text-sm font-semibold text-brand-700"
          >
            Ver todo
          </Link>
        }
      >
        {history.length === 0 ? (
          <p className="px-1 text-sm text-muted">Sin movimientos registrados.</p>
        ) : (
          <ul className="card divide-y divide-slate-100">
            {history.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <p className="text-sm text-ink">
                  <span className="font-semibold">{displayName(event.actor)}</span>{' '}
                  {event.description}
                </p>
                <p className="text-xs text-muted">{formatDateTime(event.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

    </>
  );
}
