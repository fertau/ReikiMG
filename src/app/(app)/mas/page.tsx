import Link from 'next/link';
import type { Metadata } from 'next';
import { isAdmin, requireUser } from '@/lib/auth';
import { PageHeader, Section } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';
import { initials } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/types';
import { signOut } from '../../login/actions';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Más' };

export default async function MasPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="Más" />

      <div className="card-pad mb-5 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
          {initials(user.full_name, user.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{user.full_name ?? user.email}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <p className="text-xs text-muted">
            {user.roles.length > 0
              ? user.roles.map((role) => ROLE_LABELS[role]).join(' · ')
              : 'Sin rol asignado'}
          </p>
        </div>
      </div>

      {isAdmin(user) ? (
        <Section title="Configuración">
          <ul className="card divide-y divide-slate-100">
            <li>
              <Link href="/admin" className="list-row">
                <span className="flex-1 font-semibold text-ink">Administración</span>
                <ChevronRightIcon className="size-5 text-slate-400" />
              </Link>
            </li>
            <li>
              <Link href="/admin/usuarios" className="list-row">
                <span className="flex-1 text-slate-700">Usuarios y roles</span>
                <ChevronRightIcon className="size-5 text-slate-400" />
              </Link>
            </li>
            <li>
              <Link href="/admin/productos" className="list-row">
                <span className="flex-1 text-slate-700">Productos y campos</span>
                <ChevronRightIcon className="size-5 text-slate-400" />
              </Link>
            </li>
            <li>
              <Link href="/admin/catalogos" className="list-row">
                <span className="flex-1 text-slate-700">Catálogos</span>
                <ChevronRightIcon className="size-5 text-slate-400" />
              </Link>
            </li>
          </ul>
        </Section>
      ) : null}

      <Section title="Mis datos">
        <ProfileForm fullName={user.full_name} phone={user.phone} />
      </Section>

      <Section title="Instalar en el celular">
        <div className="card-pad text-sm text-slate-700">
          <p className="mb-2">
            ReikiMG funciona como aplicación instalada, con ícono propio y sin barra del
            navegador.
          </p>
          <p className="mb-1">
            <strong>Android (Chrome):</strong> menú ⋮ → “Agregar a pantalla principal”.
          </p>
          <p>
            <strong>iPhone (Safari):</strong> Compartir → “Agregar a inicio”.
          </p>
        </div>
      </Section>

      <form action={signOut}>
        <button type="submit" className="btn-secondary w-full text-red-600">
          Cerrar sesión
        </button>
      </form>
    </>
  );
}
