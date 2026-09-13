'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ActionForm,
  FormError,
  SubmitButton,
  TextAreaField,
} from '@/components/form';
import { approveMeasurement, returnMeasurement } from '../../actions';

export function ReviewActions({ measurementId }: { measurementId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'return'>('none');

  return (
    <div className="space-y-3">
      {mode === 'none' ? (
        <>
          <ActionForm
            action={approveMeasurement}
            onSuccess={() => {
              router.push(`/relevamientos/${measurementId}`);
              router.refresh();
            }}
          >
            {(state) => (
              <div className="space-y-3">
                <FormError state={state} />
                <input type="hidden" name="id" value={measurementId} />
                <SubmitButton
                  className="btn-success w-full py-4 text-base"
                  pendingLabel="Aprobando…"
                >
                  APROBAR
                </SubmitButton>
              </div>
            )}
          </ActionForm>

          <button
            type="button"
            onClick={() => setMode('return')}
            className="btn-danger w-full py-4 text-base"
          >
            DEVOLVER PARA CORREGIR
          </button>
        </>
      ) : (
        <ActionForm
          action={returnMeasurement}
          className="card-pad space-y-3"
          onSuccess={() => {
            router.push(`/relevamientos/${measurementId}`);
            router.refresh();
          }}
        >
          {(state) => (
            <>
              <FormError state={state} />
              <input type="hidden" name="id" value={measurementId} />
              <TextAreaField
                name="review_notes"
                label="Motivo de la devolución"
                rows={4}
                required
                autoFocus
                placeholder="Ej.: falta la foto del lateral izquierdo y el espesor del paño fijo del baño 2."
                hint="El medidor va a ver este texto. Sé concreto: qué falta y dónde."
                error={state.fieldErrors?.review_notes}
              />
              <SubmitButton className="btn-danger w-full" pendingLabel="Devolviendo…">
                Devolver para corregir
              </SubmitButton>
              <button
                type="button"
                onClick={() => setMode('none')}
                className="btn-ghost btn-sm w-full"
              >
                Cancelar
              </button>
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
