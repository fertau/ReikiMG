'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  SubmitButton,
  TextAreaField,
  TextField,
} from '@/components/form';
import { dimensions } from '@/lib/format';
import { generateOrder } from '../../../ordenes/actions';

export interface OrderPhotoOption {
  id: string;
  url: string | null;
  category: string;
  caption: string | null;
}

export interface OrderItemOption {
  id: string;
  title: string;
  subtitle: string;
  photos: OrderPhotoOption[];
}

export function OrderForm({
  measurementId,
  items,
}: {
  measurementId: string;
  items: OrderItemOption[];
}) {
  const router = useRouter();
  const totalPhotos = items.reduce((sum, item) => sum + item.photos.length, 0);

  return (
    <ActionForm
      action={generateOrder}
      className="space-y-5"
      onSuccess={(state) => {
        if (state.id) router.push(`/ordenes/${state.id}`);
        router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          <input type="hidden" name="measurement_id" value={measurementId} />

          <div className="card-pad space-y-4">
            <TextField
              name="due_date"
              label="Fecha de entrega prevista"
              type="date"
              error={state.fieldErrors?.due_date}
            />
            <TextAreaField
              name="notes"
              label="Indicaciones para producción"
              rows={3}
              placeholder="Prioridades, condiciones de entrega, aclaraciones de taller…"
            />
          </div>

          {totalPhotos > 0 ? (
            <section>
              <h2 className="section-title mb-2 px-1">
                Fotos a incluir en la orden ({totalPhotos})
              </h2>
              <div className="space-y-3">
                {items.map((item) =>
                  item.photos.length === 0 ? null : (
                    <div key={item.id} className="card-pad">
                      <p className="font-semibold text-ink">{item.title}</p>
                      <p className="mb-2 text-sm text-muted">{item.subtitle}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {item.photos.map((photo) => (
                          <label
                            key={photo.id}
                            className="relative block cursor-pointer overflow-hidden rounded-lg bg-slate-100"
                          >
                            <input
                              type="checkbox"
                              name="photos[]"
                              value={photo.id}
                              defaultChecked
                              className="absolute top-1.5 left-1.5 z-10 size-5 rounded border-white bg-white/90 text-brand-600"
                            />
                            {photo.url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={photo.url}
                                alt={photo.caption ?? photo.category}
                                loading="lazy"
                                className="h-24 w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-24 items-center justify-center text-xs text-muted">
                                {photo.category}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          ) : null}

          <SubmitButton className="btn-success w-full py-4 text-base" pendingLabel="Generando…">
            GENERAR ORDEN DE PRODUCCIÓN
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function itemSubtitle(
  quantity: number,
  width: number | null,
  height: number | null,
  depth: number | null,
): string {
  return `${quantity > 1 ? `${quantity} × ` : ''}${dimensions(width, height, depth)}`;
}
