'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fail, parseForm, type ActionState } from '@/lib/action-state';

const schema = z.object({
  email: z.string().trim().min(1, 'Ingresá tu email').email('Email inválido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(schema, formData);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });

  if (error) {
    return fail(
      error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : 'No se pudo iniciar sesión. Intentá de nuevo.',
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return fail('Tu usuario está desactivado. Consultá con administración.');
    }
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
