'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, hasAnyRole } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import { fail, optionalText, parseForm, succeed, type ActionState } from '@/lib/action-state';

/** Crea el relevamiento y lleva directo a la pantalla de carga. */
export async function createMeasurement(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('project_id') ?? '');
  if (!projectId) redirect('/relevamientos/nuevo?error=obra');

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('measurements')
    .insert({ project_id: projectId, assigned_to: user.id })
    .select('id, code, project:projects(name)')
    .single();

  if (error) {
    console.error('[relevamiento] alta fallida', error.message);
    redirect(`/obras/${projectId}?error=relevamiento`);
  }

  await logEvent(supabase, user.id, {
    entityType: 'measurement',
    entityId: data.id,
    projectId,
    measurementId: data.id,
    action: 'measurement.created',
    description: `creó el relevamiento ${data.code}`,
  });

  revalidatePath('/');
  revalidatePath(`/obras/${projectId}`);
  redirect(`/relevamientos/${data.id}`);
}

const notesSchema = z.object({
  id: z.string().uuid(),
  notes: optionalText,
});

export async function updateMeasurementNotes(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(notesSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { error } = await supabase
    .from('measurements')
    .update({ notes: parsed.data.notes })
    .eq('id', parsed.data.id);

  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath(`/relevamientos/${parsed.data.id}`);
  return succeed('Observaciones guardadas');
}

/**
 * Envía el relevamiento a revisión. Exige contenido mínimo: sin ítems no hay
 * nada que revisar, y un supervisor perdiendo tiempo en eso es tiempo real.
 */
export async function submitForReview(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const id = String(formData.get('id') ?? '');
  if (!id) return fail('Falta el relevamiento.');

  const supabase = await createClient();

  const { count } = await supabase
    .from('measurement_items')
    .select('id', { count: 'exact', head: true })
    .eq('measurement_id', id);

  if (!count) {
    return fail('Cargá al menos un ítem antes de enviar a revisión.');
  }

  const { data, error } = await supabase
    .from('measurements')
    .update({
      status: 'a_revisar',
      submitted_at: new Date().toISOString(),
      submitted_by: user.id,
      unlocked_for_edit: false,
    })
    .eq('id', id)
    .select('id, code, project_id')
    .single();

  if (error) return fail(`No se pudo enviar a revisión: ${error.message}`);

  await logEvent(supabase, user.id, {
    entityType: 'measurement',
    entityId: id,
    projectId: data.project_id,
    measurementId: id,
    action: 'measurement.submitted',
    description: `envió el relevamiento ${data.code} a revisión`,
    metadata: { items: count },
  });

  revalidatePath('/');
  revalidatePath(`/relevamientos/${id}`);
  revalidatePath(`/obras/${data.project_id}`);
  return succeed('Relevamiento enviado a revisión');
}

export async function approveMeasurement(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!hasAnyRole(user, 'supervisor')) return fail('Sólo un supervisor puede aprobar.');

  const id = String(formData.get('id') ?? '');
  if (!id) return fail('Falta el relevamiento.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('measurements')
    .update({
      status: 'aprobado',
      approved_at: new Date().toISOString(),
      approved_by: user!.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user!.id,
      review_notes: null,
      unlocked_for_edit: false,
    })
    .eq('id', id)
    .select('id, code, project_id')
    .single();

  if (error) return fail(`No se pudo aprobar: ${error.message}`);

  await logEvent(supabase, user!.id, {
    entityType: 'measurement',
    entityId: id,
    projectId: data.project_id,
    measurementId: id,
    action: 'measurement.approved',
    description: `aprobó el relevamiento ${data.code}`,
  });

  revalidatePath('/');
  revalidatePath(`/relevamientos/${id}`);
  revalidatePath(`/obras/${data.project_id}`);
  return succeed('Relevamiento aprobado');
}

const returnSchema = z.object({
  id: z.string().uuid(),
  review_notes: z
    .string()
    .trim()
    .min(10, 'Indicá con detalle qué hay que corregir (mínimo 10 caracteres)'),
});

export async function returnMeasurement(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!hasAnyRole(user, 'supervisor')) return fail('Sólo un supervisor puede devolver.');

  const parsed = parseForm(returnSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('measurements')
    .update({
      status: 'corregir',
      review_notes: parsed.data.review_notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user!.id,
    })
    .eq('id', parsed.data.id)
    .select('id, code, project_id')
    .single();

  if (error) return fail(`No se pudo devolver: ${error.message}`);

  await logEvent(supabase, user!.id, {
    entityType: 'measurement',
    entityId: parsed.data.id,
    projectId: data.project_id,
    measurementId: parsed.data.id,
    action: 'measurement.returned',
    description: `solicitó corrección del relevamiento ${data.code}`,
    metadata: { motivo: parsed.data.review_notes },
  });

  revalidatePath('/');
  revalidatePath(`/relevamientos/${parsed.data.id}`);
  revalidatePath(`/obras/${data.project_id}`);
  return succeed('Devuelto para corregir');
}

/** Autoriza a editar un relevamiento ya aprobado. Queda registrado. */
export async function toggleUnlock(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!hasAnyRole(user, 'supervisor')) {
    return fail('Sólo un supervisor puede autorizar la edición.');
  }

  const id = String(formData.get('id') ?? '');
  const unlock = formData.get('unlock') === '1';
  if (!id) return fail('Falta el relevamiento.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('measurements')
    .update({ unlocked_for_edit: unlock })
    .eq('id', id)
    .select('id, code, project_id')
    .single();

  if (error) return fail(`No se pudo actualizar: ${error.message}`);

  await logEvent(supabase, user!.id, {
    entityType: 'measurement',
    entityId: id,
    projectId: data.project_id,
    measurementId: id,
    action: unlock ? 'measurement.unlocked' : 'measurement.locked',
    description: unlock
      ? `autorizó la edición del relevamiento ${data.code} ya aprobado`
      : `quitó la autorización de edición del relevamiento ${data.code}`,
  });

  revalidatePath(`/relevamientos/${id}`);
  return succeed(unlock ? 'Edición autorizada' : 'Edición bloqueada');
}
