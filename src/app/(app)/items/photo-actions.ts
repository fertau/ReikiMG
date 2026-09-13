'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import { fail, optionalText, parseForm, succeed, type ActionState } from '@/lib/action-state';
import { PHOTO_BUCKET } from '@/lib/storage';

const registerSchema = z.object({
  item_id: z.string().uuid(),
  storage_path: z.string().min(1),
  category: z.string().trim().min(1).default('general'),
  caption: optionalText,
  mime_type: optionalText,
  byte_size: z.coerce.number().int().nonnegative().optional(),
});

/**
 * Registra una foto ya subida a Storage por el navegador. La subida va
 * directa al bucket para no pasar el archivo por el servidor de la app.
 */
export async function registerPhoto(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(registerSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();

  const { count } = await supabase
    .from('item_photos')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', parsed.data.item_id);

  const { data, error } = await supabase
    .from('item_photos')
    .insert({ ...parsed.data, sort_order: (count ?? 0) + 1 })
    .select('id, item_id')
    .single();

  if (error) {
    // Si no se pudo registrar, el archivo huérfano se borra del bucket.
    await supabase.storage.from(PHOTO_BUCKET).remove([parsed.data.storage_path]);
    return fail(`No se pudo guardar la foto: ${error.message}`);
  }

  const { data: item } = await supabase
    .from('measurement_items')
    .select('measurement_id')
    .eq('id', parsed.data.item_id)
    .maybeSingle();

  await logEvent(supabase, user.id, {
    entityType: 'item_photo',
    entityId: data.id,
    measurementId: item?.measurement_id ?? null,
    action: 'photo.added',
    description: 'agregó una fotografía',
    metadata: { categoria: parsed.data.category },
  });

  revalidatePath(`/items/${parsed.data.item_id}/fotos`);
  revalidatePath(`/items/${parsed.data.item_id}`);
  return succeed('Foto guardada', data.id);
}

const updateSchema = z.object({
  id: z.string().uuid(),
  item_id: z.string().uuid(),
  category: z.string().trim().min(1),
  caption: optionalText,
});

export async function updatePhoto(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(updateSchema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { error } = await supabase
    .from('item_photos')
    .update({ category: parsed.data.category, caption: parsed.data.caption })
    .eq('id', parsed.data.id);

  if (error) return fail(`No se pudo actualizar: ${error.message}`);

  revalidatePath(`/items/${parsed.data.item_id}/fotos`);
  return succeed('Foto actualizada');
}

export async function deletePhoto(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  if (!id) return;

  const supabase = await createClient();

  const { data: photo } = await supabase
    .from('item_photos')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('item_photos').delete().eq('id', id);

  if (!error) {
    if (photo?.storage_path) {
      await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
    }
    await logEvent(supabase, user.id, {
      entityType: 'item_photo',
      entityId: id,
      action: 'photo.deleted',
      description: 'eliminó una fotografía',
    });
  }

  revalidatePath(`/items/${itemId}/fotos`);
  revalidatePath(`/items/${itemId}`);
}
