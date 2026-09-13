import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireUser, hasAnyRole } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { MEASUREMENT_STATUS, PROJECT_STATUS } from '@/lib/status';
import { EmptyState, Section, StatTile, StatusChip } from '@/components/ui';
import { ChevronRightIcon, PlusIcon } from '@/components/icons';
import type { Measurement, Project } from '@/lib/types';

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  return count ?? 0;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [
    obrasPendientes,
    relevEnCurso,
    relevARevisar,
    relevCorregir,
    ordenesGeneradas,
    ordenesEnProduccion,
  ] = await Promise.all([
    countRows(supabase, 'projects', 'status', 'pendiente'),
    countRows(supabase, 'measurements', 'status', 'en_curso'),
    countRows(supabase, 'measurements', 'status', 'a_revisar'),
    countRows(supabase, 'measurements', 'status', 'corregir'),
    countRows(supabase, 'production_orders', 'status', 'generada'),
    countRows(supabase, 'production_orders', 'status', 'en_produccion'),
  ]);

  // Lo que requiere acción inmediata según el rol.
  const attentionStatus = hasAnyRole(user, 'supervisor') ? 'a_revisar' : 'corregir';

  const { data: attentionRows } = await supabase
    .from('measurements')
    .select(
      'id, code, status, updated_at, review_notes, project:projects(id, code, name, client_name)',
    )
    .eq('status', attentionStatus)
    .order('updated_at', { ascending: false })
    .limit(5);

  const { data: recentRows } = await supabase
    .from('measurements')
    .select('id, code, status, updated_at, project:projects(id, code, name, client_name)')
    .order('updated_at', { ascending: false })
    .limit(5);

  const attention = (attentionRows ?? []) as unknown as Measurement[];
  const recent = (recentRows ?? []) as unknown as Measurement[];

  const { data: pendingProjectRows } = await supabase
    .from('projects')
    .select('id, code, name, client_name, address, status, scheduled_date')
    .in('status', ['pendiente', 'en_medicion'])
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(5);

  const pendingProjects = (pendingProjectRows ?? []) as unknown as Project[];

  return (
    <>
      <div className="mb-5">
        <p className="text-sm text-muted">Hola,</p>
        <h1 className="text-2xl font-bold text-ink">
          {user.full_name ?? user.email.split('@')[0]}
        </h1>
      </div>

      <Link href="/relevamientos/nuevo" className="btn-primary mb-6 w-full py-4 text-lg">
        <PlusIcon className="size-6" />
        NUEVO RELEVAMIENTO
      </Link>

      <Section title="Estado general">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label="Obras pendientes de medir"
            value={obrasPendientes}
            href="/obras?estado=pendiente"
          />
          <StatTile
            label="Relevamientos en curso"
            value={relevEnCurso}
            href="/obras?relev=en_curso"
          />
          <StatTile
            label="Pendientes de revisión"
            value={relevARevisar}
            href="/obras?relev=a_revisar"
            tone="warn"
          />
          <StatTile
            label="Devueltos para corregir"
            value={relevCorregir}
            href="/obras?relev=corregir"
            tone="danger"
          />
          <StatTile
            label="Órdenes aprobadas"
            value={ordenesGeneradas}
            href="/ordenes?estado=generada"
            tone="ok"
          />
          <StatTile
            label="Enviadas a producción"
            value={ordenesEnProduccion}
            href="/ordenes?estado=en_produccion"
          />
        </div>
      </Section>

      {attention.length > 0 ? (
        <Section
          title={
            attentionStatus === 'a_revisar'
              ? 'Esperando tu revisión'
              : 'Tenés que corregir'
          }
        >
          <ul className="card divide-y divide-slate-100">
            {attention.map((m) => (
              <li key={m.id}>
                <Link href={`/relevamientos/${m.id}`} className="list-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {m.project?.name ?? 'Obra'}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {m.code} · {m.project?.client_name}
                    </p>
                    {m.review_notes ? (
                      <p className="mt-1 line-clamp-2 text-sm text-red-700">
                        {m.review_notes}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRightIcon className="size-5 shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {pendingProjects.length > 0 ? (
        <Section
          title="Obras para medir"
          action={
            <Link href="/obras" className="text-sm font-semibold text-brand-700">
              Ver todas
            </Link>
          }
        >
          <ul className="card divide-y divide-slate-100">
            {pendingProjects.map((project) => (
              <li key={project.id}>
                <Link href={`/obras/${project.id}`} className="list-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{project.name}</p>
                    <p className="truncate text-sm text-muted">
                      {project.client_name}
                      {project.address ? ` · ${project.address}` : ''}
                    </p>
                    {project.scheduled_date ? (
                      <p className="text-xs text-muted">
                        Fecha: {formatDate(project.scheduled_date)}
                      </p>
                    ) : null}
                  </div>
                  <StatusChip {...PROJECT_STATUS[project.status]} />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Actividad reciente">
        {recent.length === 0 ? (
          <EmptyState
            title="Todavía no hay relevamientos"
            description="Empezá creando uno desde el botón de arriba."
          />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/relevamientos/${m.id}`} className="list-row">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {m.project?.name ?? 'Obra'}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {m.code} · Actualizado {formatDate(m.updated_at)}
                    </p>
                  </div>
                  <StatusChip {...MEASUREMENT_STATUS[m.status]} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
