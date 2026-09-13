'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { logEvent } from '@/lib/history';
import { fail, parseForm, succeed, type ActionState } from '@/lib/action-state';

const schema = z.object({
  item_id: z.string().uuid(),
  body: z.string().trim().min(1, 'Escribí la nota').max(4000),
});

export async function addNote(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(schema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('item_notes')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error) return fail(`No se pudo guardar la nota: ${error.message}`);

  const { data: item } = await supabase
    .from('measurement_items')
    .select('measurement_id')
    .eq('id', parsed.data.item_id)
    .maybeSingle();

  await logEvent(supabase, user.id, {
    entityType: 'item_note',
    entityId: data.id,
    measurementId: item?.measurement_id ?? null,
    action: 'note.added',
    description: 'agregó una nota',
  });

  revalidatePath(`/items/${parsed.data.item_id}/notas`);
  revalidatePath(`/items/${parsed.data.item_id}`);
  return succeed('Nota guardada', data.id);
}

export async function deleteNote(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  const itemId = String(formData.get('item_id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from('item_notes').delete().eq('id', id);

  if (!error) {
    await logEvent(supabase, user.id, {
      entityType: 'item_note',
      entityId: id,
      action: 'note.deleted',
      description: 'eliminó una nota',
    });
  }

  revalidatePath(`/items/${itemId}/notas`);
  revalidatePath(`/items/${itemId}`);
}
