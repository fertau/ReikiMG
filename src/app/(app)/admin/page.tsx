import Link from 'next/link';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';

export const metadata: Metadata = { title: 'Administración' };

const SECTIONS = [
  {
    href: '/admin/usuarios',
    title: 'Usuarios y roles',
    description: 'Alta de usuarios, asignación de roles y baja de accesos.',
  },
  {
    href: '/admin/productos',
    title: 'Productos y campos',
    description: 'Familias, productos y los campos que se cargan en cada uno.',
  },
  {
    href: '/admin/catalogos',
    title: 'Catálogos',
    description:
      'Tipos de vidrio, espesores, colores, terminaciones, perfilería, herrajes y categorías de foto.',
  },
];

export default async function AdminPage() {
  await requireRole('admin');

  return (
    <>
      <PageHeader
        title="Administración"
        subtitle="Configuración del sistema"
      />
      <ul className="card divide-y divide-slate-100">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link href={section.href} className="list-row">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{section.title}</p>
                <p className="text-sm text-muted">{section.description}</p>
              </div>
              <ChevronRightIcon className="size-5 shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
