import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Alert, BackLink, PageHeader } from '@/components/ui';
import { NewUserForm, UserCard, type ManagedUser } from './user-manager';
import type { AppRole } from '@/lib/types';

export const metadata: Metadata = { title: 'Usuarios' };

export default async function UsuariosPage() {
  const current = await requireRole('admin');
  const supabase = await createClient();

  const [{ data: userRows }, { data: roleRows }] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, phone, is_active')
      .order('full_name'),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  const rolesByUser = new Map<string, AppRole[]>();
  for (const row of (roleRows ?? []) as { user_id: string; role: AppRole }[]) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role);
    rolesByUser.set(row.user_id, list);
  }

  const users: ManagedUser[] = (
    (userRows ?? []) as unknown as Omit<ManagedUser, 'roles'>[]
  ).map((user) => ({ ...user, roles: rolesByUser.get(user.id) ?? [] }));

  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <>
      <BackLink href="/admin" label="Administración" />
      <PageHeader title="Usuarios" subtitle={`${users.length} usuarios`} />

      {!hasServiceKey ? (
        <div className="mb-4">
          <Alert tone="warn" title="Alta de usuarios no disponible">
            Falta configurar SUPABASE_SERVICE_ROLE_KEY. Mientras tanto los usuarios se
            crean desde el panel de Supabase y acá se les asignan los roles.
          </Alert>
        </div>
      ) : (
        <div className="mb-4">
          <NewUserForm />
        </div>
      )}

      <ul className="space-y-3">
        {users.map((user) => (
          <li key={user.id}>
            <UserCard user={user} isSelf={user.id === current.id} />
          </li>
        ))}
      </ul>
    </>
  );
}
