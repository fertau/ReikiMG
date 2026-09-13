'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  FormMessage,
  SubmitButton,
  TextField,
} from '@/components/form';
import { updateProfile } from './actions';

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string | null;
  phone: string | null;
}) {
  const router = useRouter();

  return (
    <ActionForm
      action={updateProfile}
      className="card-pad space-y-3"
      onSuccess={() => router.refresh()}
    >
      {(state) => (
        <>
          <FormError state={state} />
          <FormMessage state={state} />
          <TextField
            name="full_name"
            label="Nombre y apellido"
            required
            defaultValue={fullName ?? ''}
            error={state.fieldErrors?.full_name}
          />
          <TextField
            name="phone"
            label="Teléfono"
            type="tel"
            inputMode="tel"
            defaultValue={phone ?? ''}
            error={state.fieldErrors?.phone}
          />
          <SubmitButton className="btn-secondary w-full">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
