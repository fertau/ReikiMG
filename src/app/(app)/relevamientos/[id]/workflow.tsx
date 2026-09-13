'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  FormMessage,
  SubmitButton,
  TextAreaField,
} from '@/components/form';
import { submitForReview, toggleUnlock, updateMeasurementNotes } from '../actions';

export function SubmitForReview({ measurementId }: { measurementId: string }) {
  const router = useRouter();

  return (
    <ActionForm
      action={submitForReview}
      className="space-y-3"
      onSuccess={() => router.refresh()}
    >
      {(state) => (
        <>
          <FormError state={state} />
          <input type="hidden" name="id" value={measurementId} />
          <SubmitButton className="btn-primary w-full py-4 text-base" pendingLabel="Enviando…">
            ENVIAR A REVISIÓN
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function MeasurementNotes({
  measurementId,
  notes,
  canEdit,
}: {
  measurementId: string;
  notes: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();

  if (!canEdit) {
    return (
      <p className="card-pad text-sm whitespace-pre-line text-slate-700">
        {notes?.trim() ? notes : 'Sin observaciones.'}
      </p>
    );
  }

  return (
    <ActionForm
      action={updateMeasurementNotes}
      className="card-pad space-y-3"
      onSuccess={() => router.refresh()}
    >
      {(state) => (
        <>
          <FormError state={state} />
          <FormMessage state={state} />
          <input type="hidden" name="id" value={measurementId} />
          <TextAreaField
            name="notes"
            label="Observaciones generales del relevamiento"
            rows={3}
            defaultValue={notes ?? ''}
            placeholder="Accesos, horarios de obra, condiciones particulares…"
          />
          <SubmitButton className="btn-secondary btn-sm w-full">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function UnlockToggle({
  measurementId,
  unlocked,
}: {
  measurementId: string;
  unlocked: boolean;
}) {
  const router = useRouter();

  return (
    <ActionForm action={toggleUnlock} onSuccess={() => router.refresh()}>
      {(state) => (
        <>
          <FormError state={state} />
          <input type="hidden" name="id" value={measurementId} />
          <input type="hidden" name="unlock" value={unlocked ? '0' : '1'} />
          <SubmitButton className="btn-secondary btn-sm w-full">
            {unlocked ? 'Bloquear edición' : 'Autorizar edición del medidor'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
