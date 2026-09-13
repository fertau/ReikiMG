import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, requireUser } from '@/lib/auth';
import { formatDate, displayName } from '@/lib/format';
import { PROJECT_STATUS } from '@/lib/status';
import { EmptyState, PageHeader, StatusChip } from '@/components/ui';
import { PlusIcon, SearchIcon } from '@/components/icons';
import type { AppUser, Project, ProjectStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Obras' };

const PROJECT_STATUS_ENTRIES = Object.entries(PROJECT_STATUS) as [
  ProjectStatus,
  { label: string; color: string },
][];

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    responsable?: string;
    relev?: string;
  }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;

  const q = params.q?.trim() ?? '';
  const estado = params.estado ?? '';
  const responsable = params.responsable ?? '';
  const relev = params.relev ?? '';

  let query = supabase
    .from('projects')
    .select(
      relev
        ? 'id, code, client_name, name, address, contact_name, status, scheduled_date, assignee:users!projects_assigned_to_fkey(id, full_name, email), measurements!inner(id, status)'
        : 'id, code, client_name, name, address, contact_name, status, scheduled_date, assignee:users!projects_assigned_to_fkey(id, full_name, email)',
    )
    .order('updated_at', { ascending: false })
    .limit(60);

  if (q) query = query.ilike('search_text', `%${q}%`);
  if (estado) query = query.eq('status', estado);
  if (responsable) query = query.eq('assigned_to', responsable);
  if (relev) query = query.eq('measurements.status', relev);

  const [{ data: rows, error }, { data: staffRows }] = await Promise.all([
    query,
    supabase
      .from('users')
      .select('id, full_name, email, is_active')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  const projects = (rows ?? []) as unknown as Project[];
  const staff = (staffRows ?? []) as unknown as AppUser[];
  const canCreate = hasAnyRole(user, 'supervisor');
  const hasFilters = Boolean(q || estado || responsable || relev);

  return (
    <>
      <PageHeader
        title="Obras"
        subtitle={`${projects.length} resultado${projects.length === 1 ? '' : 's'}`}
        action={
          canCreate ? (
            <Link href="/obras/nueva" className="btn-primary btn-sm shrink-0">
              <PlusIcon className="size-4" />
              Nueva
            </Link>
          ) : null
        }
      />

      <form method="get" className="card-pad mb-4 space-y-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Cliente, obra, dirección…"
            className="input pl-10"
            aria-label="Buscar"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            name="estado"
            defaultValue={estado}
            className="input appearance-none py-2.5 text-sm"
            aria-label="Estado"
          >
            <option value="">Todos los estados</option>
            {PROJECT_STATUS_ENTRIES.map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>

          <select
            name="responsable"
            defaultValue={responsable}
            className="input appearance-none py-2.5 text-sm"
            aria-label="Responsable"
          >
            <option value="">Todos los responsables</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {displayName(person)}
              </option>
            ))}
          </select>
        </div>

        {relev ? <input type="hidden" name="relev" value={relev} /> : null}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary btn-sm flex-1">
            Buscar
          </button>
          {hasFilters ? (
            <Link href="/obras" className="btn-secondary btn-sm">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <EmptyState
          title="No se pudo cargar el listado"
          description={error.message}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Sin resultados' : 'Todavía no hay obras'}
          description={
            hasFilters
              ? 'Probá con otro criterio de búsqueda.'
              : canCreate
                ? 'Creá la primera obra para empezar a relevar.'
                : 'Cuando te asignen una obra la vas a ver acá.'
          }
          action={
            canCreate && !hasFilters ? (
              <Link href="/obras/nueva" className="btn-primary btn-sm">
                Nueva obra
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/obras/${project.id}`} className="list-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink">{project.name}</p>
                  </div>
                  <p className="truncate text-sm text-muted">
                    {project.code} · {project.client_name}
                  </p>
                  {project.address ? (
                    <p className="truncate text-sm text-muted">{project.address}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted">
                    {project.assignee ? displayName(project.assignee) : 'Sin responsable'}
                    {project.scheduled_date
                      ? ` · ${formatDate(project.scheduled_date)}`
                      : ''}
                  </p>
                </div>
                <StatusChip {...PROJECT_STATUS[project.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
