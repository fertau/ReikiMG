'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, hasAnyRole } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import {
  fail,
  optionalText,
  parseForm,
  requiredText,
  succeed,
  type ActionState,
} from '@/lib/action-state';

const PROJECT_STATUSES = [
  'pendiente',
  'en_medicion',
  'relevado',
  'a_revisar',
  'corregir',
  'aprobado',
  'en_produccion',
  'finalizado',
] as const;

const projectSchema = z.object({
  client_name: requiredText('El cliente'),
  name: requiredText('El nombre de obra'),
  address: optionalText,
  contact_name: optionalText,
  contact_phone: optionalText,
  assigned_to: optionalText,
  scheduled_date: optionalText,
  status: z.enum(PROJECT_STATUSES).default('pendiente'),
  notes: optionalText,
});

export async function createProject(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!hasAnyRole(user, 'supervisor')) {
    return fail('No tenés permisos para crear obras.');
  }

  const parsed = parseForm(projectSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .insert(parsed.data)
    .select('id, code, name')
    .single();

  if (error) return fail(`No se pudo crear la obra: ${error.message}`);

  await logEvent(supabase, user!.id, {
    entityType: 'project',
    entityId: data.id,
    projectId: data.id,
    action: 'project.created',
    description: `creó la obra ${data.code} · ${data.name}`,
  });

  revalidatePath('/obras');
  revalidatePath('/');
  return succeed('Obra creada', data.id);
}

export async function updateProject(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!hasAnyRole(user, 'supervisor')) {
    return fail('No tenés permisos para editar obras.');
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || !id) return fail('Falta el identificador de la obra.');

  const parsed = parseForm(projectSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { error } = await supabase.from('projects').update(parsed.data).eq('id', id);
  if (error) return fail(`No se pudo guardar la obra: ${error.message}`);

  await logEvent(supabase, user!.id, {
    entityType: 'project',
    entityId: id,
    projectId: id,
    action: 'project.updated',
    description: `actualizó los datos de la obra`,
  });

  revalidatePath(`/obras/${id}`);
  revalidatePath('/obras');
  return succeed('Cambios guardados', id);
}

// ---------------------------------------------------------------------------
// Estructura de la obra: unidades / sectores y ambientes
// ---------------------------------------------------------------------------

const locationSchema = z.object({
  project_id: z.string().uuid(),
  kind: z.enum(['unidad', 'piso', 'departamento', 'sector', 'otro']).default('unidad'),
  name: requiredText('El nombre'),
  floor: optionalText,
  notes: optionalText,
});

export async function createLocation(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(locationSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();

  const { count } = await supabase
    .from('locations')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', parsed.data.project_id);

  const { data, error } = await supabase
    .from('locations')
    .insert({ ...parsed.data, sort_order: (count ?? 0) + 1 })
    .select('id, name')
    .single();

  if (error) return fail(`No se pudo crear la unidad: ${error.message}`);

  await logEvent(supabase, user.id, {
    entityType: 'location',
    entityId: data.id,
    projectId: parsed.data.project_id,
    action: 'location.created',
    description: `agregó la unidad/sector "${data.name}"`,
  });

  revalidatePath(`/obras/${parsed.data.project_id}`);
  return succeed('Unidad agregada', data.id);
}

export async function deleteLocation(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from('locations').delete().eq('id', id);

  if (!error) {
    await logEvent(supabase, user.id, {
      entityType: 'location',
      entityId: id,
      projectId,
      action: 'location.deleted',
      description: 'eliminó una unidad/sector',
    });
  }

  revalidatePath(`/obras/${projectId}`);
}

const roomSchema = z.object({
  location_id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: requiredText('El nombre del ambiente'),
  notes: optionalText,
});

export async function createRoom(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(roomSchema, formData);
  if (parsed.error) return parsed.error;

  const { project_id, ...room } = parsed.data;
  const supabase = await createClient();

  const { count } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', room.location_id);

  const { data, error } = await supabase
    .from('rooms')
    .insert({ ...room, sort_order: (count ?? 0) + 1 })
    .select('id, name')
    .single();

  if (error) return fail(`No se pudo crear el ambiente: ${error.message}`);

  await logEvent(supabase, user.id, {
    entityType: 'room',
    entityId: data.id,
    projectId: project_id,
    action: 'room.created',
    description: `agregó el ambiente "${data.name}"`,
  });

  revalidatePath(`/obras/${project_id}`);
  return succeed('Ambiente agregado', data.id);
}

export async function deleteRoom(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from('rooms').delete().eq('id', id);

  if (!error) {
    await logEvent(supabase, user.id, {
      entityType: 'room',
      entityId: id,
      projectId,
      action: 'room.deleted',
      description: 'eliminó un ambiente',
    });
  }

  revalidatePath(`/obras/${projectId}`);
}
