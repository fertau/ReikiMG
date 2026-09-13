import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, Measurement, SessionUser } from '@/lib/types';

/**
 * Usuario autenticado con su perfil y roles. Cacheado por request para que
 * varios componentes del árbol no repitan la consulta.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from('users')
      .select('id, email, full_name, phone, is_active')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ]);

  const roles = (roleRows ?? []).map((r: { role: AppRole }) => r.role);

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? '',
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    is_active: profile?.is_active ?? true,
    roles,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!user.is_active) redirect('/login?error=inactivo');
  return user;
}

export async function requireRole(...roles: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasAnyRole(user, ...roles)) redirect('/?error=permisos');
  return user;
}

export function hasAnyRole(
  user: Pick<SessionUser, 'roles'> | null,
  ...roles: AppRole[]
): boolean {
  if (!user) return false;
  if (user.roles.includes('admin')) return true;
  return roles.some((role) => user.roles.includes(role));
}

/** Roles exactos, sin el comodín de administrador. */
export function hasExactRole(
  user: Pick<SessionUser, 'roles'> | null,
  ...roles: AppRole[]
): boolean {
  if (!user) return false;
  return roles.some((role) => user.roles.includes(role));
}

export function isAdmin(user: Pick<SessionUser, 'roles'> | null): boolean {
  return !!user?.roles.includes('admin');
}

/**
 * Espejo en cliente de measurement_is_editable(). La autoridad es la base:
 * esto sólo decide qué botones se muestran.
 */
export function canEditMeasurement(
  user: Pick<SessionUser, 'id' | 'roles'> | null,
  measurement: Pick<
    Measurement,
    'status' | 'assigned_to' | 'created_by' | 'unlocked_for_edit'
  > | null,
): boolean {
  if (!user || !measurement) return false;
  if (isAdmin(user)) return true;
  if (!user.roles.includes('medidor')) return false;
  const isOwner =
    measurement.assigned_to === user.id || measurement.created_by === user.id;
  if (!isOwner) return false;
  return (
    measurement.status === 'en_curso' ||
    measurement.status === 'corregir' ||
    measurement.unlocked_for_edit
  );
}

export function canReviewMeasurement(
  user: Pick<SessionUser, 'roles'> | null,
  measurement: Pick<Measurement, 'status'> | null,
): boolean {
  if (!user || !measurement) return false;
  return hasAnyRole(user, 'supervisor') && measurement.status === 'a_revisar';
}

export function canGenerateOrder(
  user: Pick<SessionUser, 'roles'> | null,
  measurement: Pick<Measurement, 'status'> | null,
): boolean {
  if (!user || !measurement) return false;
  return hasAnyRole(user, 'supervisor') && measurement.status === 'aprobado';
}
