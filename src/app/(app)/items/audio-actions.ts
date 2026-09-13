'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import { fail, optionalText, parseForm, succeed, type ActionState } from '@/lib/action-state';
import { AUDIO_BUCKET } from '@/lib/storage';

const schema = z.object({
  item_id: z.string().uuid(),
  storage_path: z.string().min(1),
  duration_seconds: z.coerce.number().nonnegative().optional(),
  mime_type: optionalText,
  byte_size: z.coerce.number().int().nonnegative().optional(),
});

/**
 * Registra una nota de voz ya subida al bucket privado.
 * transcript_status queda en 'pendiente' para que un proceso posterior de
 * transcripción pueda tomarla sin cambiar el modelo de datos.
 */
export async function registerAudio(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(schema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('item_audio')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error) {
    await supabase.storage.from(AUDIO_BUCKET).remove([parsed.data.storage_path]);
    return fail(`No se pudo guardar el audio: ${error.message}`);
  }

  const { data: item } = await supabase
    .from('measurement_items')
    .select('measurement_id')
    .eq('id', parsed.data.item_id)
    .maybeSingle();

  await logEvent(supabase, user.id, {
    entityType: 'item_audio',
    entityId: data.id,
    measurementId: item?.measurement_id ?? null,
    action: 'audio.added',
    description: 'grabó una nota de voz',
    metadata: { duracion: parsed.data.duration_seconds },
  });

  revalidatePath(`/items/${parsed.data.item_id}/audios`);
  revalidatePath(`/items/${parsed.data.item_id}`);
  return succeed('Audio guardado', data.id);
}

export async function deleteAudio(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  if (!id) return;

  const supabase = await createClient();

  const { data: audio } = await supabase
    .from('item_audio')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('item_audio').delete().eq('id', id);

  if (!error) {
    if (audio?.storage_path) {
      await supabase.storage.from(AUDIO_BUCKET).remove([audio.storage_path]);
    }
    await logEvent(supabase, user.id, {
      entityType: 'item_audio',
      entityId: id,
      action: 'audio.deleted',
      description: 'eliminó una nota de voz',
    });
  }

  revalidatePath(`/items/${itemId}/audios`);
  revalidatePath(`/items/${itemId}`);
}
