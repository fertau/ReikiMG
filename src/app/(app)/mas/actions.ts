'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import {
  fail,
  optionalText,
  parseForm,
  requiredText,
  succeed,
  type ActionState,
} from '@/lib/action-state';

const schema = z.object({
  full_name: requiredText('El nombre'),
  phone: optionalText,
});

export async function updateProfile(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return fail('Sesión vencida.');

  const parsed = parseForm(schema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { error } = await supabase.from('users').update(parsed.data).eq('id', user.id);

  if (error) return fail(`No se pudo guardar: ${error.message}`);

  revalidatePath('/', 'layout');
  return succeed('Datos actualizados');
}
