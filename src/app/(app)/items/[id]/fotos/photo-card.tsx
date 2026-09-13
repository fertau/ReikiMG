'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from '@/components/form';
import { Disclosure } from '@/components/disclosure';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { TrashIcon } from '@/components/icons';
import { displayName, fileSize, formatDateTime } from '@/lib/format';
import { deletePhoto, updatePhoto } from '../../photo-actions';
import type { ItemPhoto, PhotoCategory } from '@/lib/types';

export function PhotoCard({
  photo,
  url,
  categories,
  canEdit,
}: {
  photo: ItemPhoto;
  url: string | null;
  categories: PhotoCategory[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const categoryLabel =
    categories.find((category) => category.code === photo.category)?.label ?? photo.category;

  return (
    <div className="card overflow-hidden">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={photo.caption ?? categoryLabel}
            loading="lazy"
            className="h-44 w-full object-cover"
          />
        </a>
      ) : (
        <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-muted">
          No se pudo cargar la imagen
        </div>
      )}

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{categoryLabel}</p>
            {photo.caption ? (
              <p className="text-sm text-slate-600">{photo.caption}</p>
            ) : null}
            <p className="text-xs text-muted">
              {displayName(photo.author)} · {formatDateTime(photo.created_at)} ·{' '}
              {fileSize(photo.byte_size)}
            </p>
          </div>

          {canEdit ? (
            <form action={deletePhoto}>
              <input type="hidden" name="id" value={photo.id} />
              <input type="hidden" name="item_id" value={photo.item_id} />
              <ConfirmSubmit
                message="¿Eliminar esta fotografía?"
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Eliminar foto"
              >
                <TrashIcon className="size-5" />
              </ConfirmSubmit>
            </form>
          ) : null}
        </div>

        {canEdit ? (
          <Disclosure label="Editar" variant="ghost">
            {(close) => (
              <ActionForm
                action={updatePhoto}
                className="space-y-3"
                onSuccess={() => {
                  close();
                  router.refresh();
                }}
              >
                {(state) => (
                  <>
                    <FormError state={state} />
                    <input type="hidden" name="id" value={photo.id} />
                    <input type="hidden" name="item_id" value={photo.item_id} />
                    <SelectField
                      name="category"
                      label="Categoría"
                      required
                      defaultValue={photo.category}
                      options={categories.map((category) => ({
                        value: category.code,
                        label: category.label,
                      }))}
                    />
                    <TextField
                      name="caption"
                      label="Observación"
                      defaultValue={photo.caption ?? ''}
                      placeholder="Ej.: desnivel de 12 mm en el piso"
                    />
                    <SubmitButton className="btn-primary btn-sm w-full">
                      Guardar
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
            )}
          </Disclosure>
        ) : null}
      </div>
    </div>
  );
}
