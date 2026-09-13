'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, hasAnyRole } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import { loadMeasurementFull, toSnapshot } from '@/lib/measurement-data';
import { fail, optionalText, parseForm, succeed, type ActionState } from '@/lib/action-state';

const generateSchema = z.object({
  measurement_id: z.string().uuid(),
  due_date: optionalText,
  notes: optionalText,
});

/**
 * Emite la orden a partir de un relevamiento aprobado.
 * Cada ítem se guarda como snapshot: lo que taller produce no cambia aunque
 * después se autorice editar el relevamiento.
 */
export async function generateOrder(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!hasAnyRole(user, 'supervisor')) {
    return fail('Sólo un supervisor puede generar órdenes de producción.');
  }

  const parsed = parseForm(generateSchema, formData);
  if (parsed.error) return parsed.error;

  const selectedPhotos = new Set(
    formData.getAll('photos[]').filter((value): value is string => typeof value === 'string'),
  );

  const supabase = await createClient();
  const full = await loadMeasurementFull(supabase, parsed.data.measurement_id);

  if (!full) return fail('No se encontró el relevamiento.');
  if (full.measurement.status !== 'aprobado') {
    return fail('El relevamiento tiene que estar aprobado para generar la orden.');
  }
  if (full.items.length === 0) {
    return fail('El relevamiento no tiene ítems.');
  }

  const { data: existing } = await supabase
    .from('production_orders')
    .select('id, number')
    .eq('measurement_id', parsed.data.measurement_id)
    .maybeSingle();

  if (existing) {
    return fail(`Este relevamiento ya tiene la orden ${existing.number}.`);
  }

  const { data: order, error } = await supabase
    .from('production_orders')
    .insert({
      measurement_id: parsed.data.measurement_id,
      project_id: full.project.id,
      due_date: parsed.data.due_date,
      notes: parsed.data.notes,
    })
    .select('id, number')
    .single();

  if (error) return fail(`No se pudo generar la orden: ${error.message}`);

  const rows = full.items.map((entry, index) => {
    const snapshot = toSnapshot(entry);
    snapshot.photos = snapshot.photos.filter((photo) => selectedPhotos.has(photo.id));
    return {
      order_id: order.id,
      item_id: entry.item.id,
      sort_order: index + 1,
      snapshot,
    };
  });

  const { error: itemsError } = await supabase.from('production_order_items').insert(rows);

  if (itemsError) {
    await supabase.from('production_orders').delete().eq('id', order.id);
    return fail(`No se pudieron guardar los ítems de la orden: ${itemsError.message}`);
  }

  const { error: statusError } = await supabase
    .from('measurements')
    .update({ status: 'orden_generada' })
    .eq('id', parsed.data.measurement_id);

  if (statusError) {
    console.error('[orden] no se pudo actualizar el estado del relevamiento', statusError.message);
  }

  await logEvent(supabase, user!.id, {
    entityType: 'production_order',
    entityId: order.id,
    projectId: full.project.id,
    measurementId: parsed.data.measurement_id,
    action: 'order.generated',
    description: `generó la orden de producción ${order.number}`,
    metadata: { items: rows.length, fotos: selectedPhotos.size },
  });

  revalidatePath('/');
  revalidatePath('/ordenes');
  revalidatePath(`/relevamientos/${parsed.data.measurement_id}`);
  return succeed(`Orden ${order.number} generada`, order.id);
}

const ORDER_STATUSES = ['generada', 'en_produccion', 'finalizada', 'anulada'] as const;

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');

  if (!id || !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) return;
  if (!hasAnyRole(user, 'supervisor', 'produccion')) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('production_orders')
    .update({ status })
    .eq('id', id)
    .select('id, number, project_id, measurement_id')
    .single();

  if (error) {
    console.error('[orden] no se pudo cambiar el estado', error.message);
    return;
  }

  const labels: Record<string, string> = {
    generada: 'generada',
    en_produccion: 'en producción',
    finalizada: 'finalizada',
    anulada: 'anulada',
  };

  await logEvent(supabase, user.id, {
    entityType: 'production_order',
    entityId: id,
    projectId: data.project_id,
    measurementId: data.measurement_id,
    action: 'order.status_changed',
    description: `marcó la orden ${data.number} como ${labels[status]}`,
  });

  revalidatePath('/');
  revalidatePath('/ordenes');
  revalidatePath(`/ordenes/${id}`);
}
