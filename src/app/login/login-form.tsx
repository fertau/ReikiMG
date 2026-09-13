'use client';

import { ActionForm, FormError, SubmitButton, TextField } from '@/components/form';
import { signIn } from './actions';

export function LoginForm() {
  return (
    <ActionForm action={signIn} className="space-y-4">
      {(state) => (
        <>
          <FormError state={state} />
          <TextField
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="nombre@empresa.com"
            required
            error={state.fieldErrors?.email}
          />
          <TextField
            name="password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            error={state.fieldErrors?.password}
          />
          <SubmitButton pendingLabel="Ingresando…">Ingresar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
