'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import {
  fail,
  optionalText,
  parseForm,
  requiredText,
  succeed,
  type ActionState,
} from '@/lib/action-state';
import { ROLES, type AppRole } from '@/lib/types';

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  full_name: requiredText('El nombre'),
  phone: optionalText,
  role: z.enum(ROLES as [AppRole, ...AppRole[]]),
});

/** Alta de usuario. Usa service role, por eso valida el rol del llamante primero. */
export async function createUser(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getSessionUser();
  if (!isAdmin(current)) return fail('Sólo un administrador puede crear usuarios.');

  const parsed = parseForm(createSchema, formData);
  if (parsed.error) return parsed.error;

  let admin;
  try {
    admin = createAdminClient();
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : 'Falta la clave de servicio.');
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      role: parsed.data.role,
    },
  });

  if (error) return fail(`No se pudo crear el usuario: ${error.message}`);

  const supabase = await createClient();
  await logEvent(supabase, current!.id, {
    entityType: 'user',
    entityId: data.user?.id ?? null,
    action: 'user.created',
    description: `dio de alta al usuario ${parsed.data.full_name} (${parsed.data.role})`,
  });

  revalidatePath('/admin/usuarios');
  return succeed('Usuario creado', data.user?.id);
}

const rolesSchema = z.object({
  user_id: z.string().uuid(),
  roles: z.union([z.array(z.enum(ROLES as [AppRole, ...AppRole[]])), z.string()]).optional(),
});

export async function updateUserRoles(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getSessionUser();
  if (!isAdmin(current)) return fail('Sólo un administrador puede asignar roles.');

  const parsed = parseForm(rolesSchema, formData);
  if (parsed.error) return parsed.error;

  const raw = parsed.data.roles;
  const roles = Array.isArray(raw) ? raw : raw ? [raw as AppRole] : [];

  if (parsed.data.user_id === current!.id && !roles.includes('admin')) {
    return fail('No podés quitarte tu propio rol de administrador.');
  }

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', parsed.data.user_id);

  if (deleteError) return fail(`No se pudieron actualizar los roles: ${deleteError.message}`);

  if (roles.length > 0) {
    const { error } = await supabase
      .from('user_roles')
      .insert(roles.map((role) => ({ user_id: parsed.data.user_id, role })));
    if (error) return fail(`No se pudieron asignar los roles: ${error.message}`);
  }

  await logEvent(supabase, current!.id, {
    entityType: 'user',
    entityId: parsed.data.user_id,
    action: 'user.roles_changed',
    description: `cambió los roles a: ${roles.join(', ') || 'ninguno'}`,
  });

  revalidatePath('/admin/usuarios');
  return succeed('Roles actualizados');
}

export async function toggleUserActive(formData: FormData): Promise<void> {
  const current = await getSessionUser();
  if (!isAdmin(current)) return;

  const userId = String(formData.get('user_id') ?? '');
  const active = formData.get('active') === '1';
  if (!userId || userId === current!.id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from('users')
    .update({ is_active: active })
    .eq('id', userId);

  if (!error) {
    await logEvent(supabase, current!.id, {
      entityType: 'user',
      entityId: userId,
      action: active ? 'user.activated' : 'user.deactivated',
      description: active ? 'activó a un usuario' : 'desactivó a un usuario',
    });
  }

  revalidatePath('/admin/usuarios');
}
