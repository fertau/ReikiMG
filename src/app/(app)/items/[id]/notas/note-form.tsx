'use client';

import { useRouter } from 'next/navigation';
import { ActionForm, FormError, SubmitButton, TextAreaField } from '@/components/form';
import { addNote } from '../../note-actions';

export function NoteForm({ itemId }: { itemId: string }) {
  const router = useRouter();

  return (
    <ActionForm
      action={addNote}
      className="card-pad space-y-3"
      resetOnSuccess
      onSuccess={() => router.refresh()}
    >
      {(state) => (
        <>
          <FormError state={state} />
          <input type="hidden" name="item_id" value={itemId} />
          <TextAreaField
            name="body"
            label="Nueva nota"
            rows={3}
            required
            placeholder="Ej.: el cliente pide que la puerta abra hacia el pasillo"
            error={state.fieldErrors?.body}
          />
          <SubmitButton className="btn-primary w-full">Agregar nota</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
