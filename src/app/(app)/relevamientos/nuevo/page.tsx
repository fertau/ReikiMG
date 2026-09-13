import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { PROJECT_STATUS } from '@/lib/status';
import { Alert, EmptyState, PageHeader, StatusChip } from '@/components/ui';
import { SearchIcon } from '@/components/icons';
import { createMeasurement } from '../actions';
import type { Project } from '@/lib/types';

export const metadata: Metadata = { title: 'Nuevo relevamiento' };

export default async function NuevoRelevamientoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { q = '', error } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('projects')
    .select('id, code, name, client_name, address, status, scheduled_date')
    .not('status', 'in', '("finalizado")')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(40);

  if (q.trim()) query = query.ilike('search_text', `%${q.trim()}%`);

  const { data } = await query;
  const projects = (data ?? []) as unknown as Project[];
  const canMeasure = hasAnyRole(user, 'medidor', 'supervisor');

  return (
    <>
      <PageHeader
        title="Nuevo relevamiento"
        subtitle="Elegí la obra donde vas a medir"
      />

      {error === 'obra' ? (
        <div className="mb-4">
          <Alert tone="danger">Seleccioná una obra para continuar.</Alert>
        </div>
      ) : null}

      {!canMeasure ? (
        <Alert tone="warn" title="Sin permisos de medición">
          Tu rol no habilita la creación de relevamientos.
        </Alert>
      ) : (
        <>
          <form method="get" className="mb-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Buscar obra o cliente…"
                className="input pl-10"
                aria-label="Buscar obra"
              />
            </div>
          </form>

          {projects.length === 0 ? (
            <EmptyState
              title="No hay obras disponibles"
              description={
                q
                  ? 'Probá con otro criterio de búsqueda.'
                  : 'Pedí que te asignen una obra para poder relevar.'
              }
              action={
                hasAnyRole(user, 'supervisor') ? (
                  <Link href="/obras/nueva" className="btn-primary btn-sm">
                    Crear obra
                  </Link>
                ) : null
              }
            />
          ) : (
            <ul className="space-y-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <form action={createMeasurement} className="card-pad">
                    <input type="hidden" name="project_id" value={project.id} />
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{project.name}</p>
                        <p className="truncate text-sm text-muted">
                          {project.code} · {project.client_name}
                        </p>
                        {project.address ? (
                          <p className="truncate text-sm text-muted">{project.address}</p>
                        ) : null}
                        {project.scheduled_date ? (
                          <p className="text-xs text-muted">
                            Fecha: {formatDate(project.scheduled_date)}
                          </p>
                        ) : null}
                      </div>
                      <StatusChip {...PROJECT_STATUS[project.status]} />
                    </div>
                    <button type="submit" className="btn-primary w-full">
                      Relevar esta obra
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
