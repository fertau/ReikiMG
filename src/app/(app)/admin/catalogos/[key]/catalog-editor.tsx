'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  SubmitButton,
  TextField,
} from '@/components/form';
import { Disclosure } from '@/components/disclosure';
import { saveMaterial, savePhotoCategory, toggleMaterial } from '../../catalog-actions';
import type { Material, PhotoCategory } from '@/lib/types';

export function MaterialEditor({
  categoryId,
  categoryKey,
  materials,
}: {
  categoryId: string;
  categoryKey: string;
  materials: Material[];
}) {
  const router = useRouter();

  const form = (close: () => void, material?: Material) => (
    <ActionForm
      action={saveMaterial}
      className="space-y-3"
      onSuccess={() => {
        close();
        router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          {material ? <input type="hidden" name="id" value={material.id} /> : null}
          <input type="hidden" name="category_id" value={categoryId} />
          <input type="hidden" name="category_key" value={categoryKey} />
          <TextField
            name="name"
            label="Nombre"
            required
            autoFocus
            defaultValue={material?.name ?? ''}
            error={state.fieldErrors?.name}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              name="code"
              label="Código"
              defaultValue={material?.code ?? ''}
              error={state.fieldErrors?.code}
            />
            <TextField
              name="sort_order"
              label="Orden"
              type="number"
              defaultValue={material?.sort_order ?? materials.length * 10 + 10}
            />
          </div>
          <SubmitButton className="btn-primary btn-sm w-full">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );

  return (
    <>
      <div className="mb-4">
        <Disclosure label="Agregar" variant="primary">
          {(close) => form(close)}
        </Disclosure>
      </div>

      <ul className="space-y-2">
        {materials.map((material) => (
          <li key={material.id} className="card-pad">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{material.name}</p>
                <p className="text-xs text-muted">
                  {material.code ? `${material.code} · ` : ''}orden {material.sort_order}
                </p>
              </div>
              <form action={toggleMaterial}>
                <input type="hidden" name="id" value={material.id} />
                <input type="hidden" name="category_key" value={categoryKey} />
                <input type="hidden" name="active" value={material.is_active ? '0' : '1'} />
                <button
                  type="submit"
                  className={
                    material.is_active
                      ? 'chip bg-emerald-100 text-emerald-700 ring-emerald-200'
                      : 'chip bg-zinc-100 text-zinc-600 ring-zinc-200'
                  }
                >
                  {material.is_active ? 'Activo' : 'Inactivo'}
                </button>
              </form>
            </div>
            <div className="mt-2">
              <Disclosure label="Editar" variant="ghost">
                {(close) => form(close, material)}
              </Disclosure>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PhotoCategoryEditor({ categories }: { categories: PhotoCategory[] }) {
  const router = useRouter();

  const form = (close: () => void, category?: PhotoCategory) => (
    <ActionForm
      action={savePhotoCategory}
      className="space-y-3"
      onSuccess={() => {
        close();
        router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <TextField
            name="label"
            label="Etiqueta"
            required
            autoFocus
            defaultValue={category?.label ?? ''}
            error={state.fieldErrors?.label}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              name="code"
              label="Código"
              required
              defaultValue={category?.code ?? ''}
              hint="Sin espacios"
              error={state.fieldErrors?.code}
            />
            <TextField
              name="sort_order"
              label="Orden"
              type="number"
              defaultValue={category?.sort_order ?? categories.length * 10 + 10}
            />
          </div>
          <SubmitButton className="btn-primary btn-sm w-full">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );

  return (
    <>
      <div className="mb-4">
        <Disclosure label="Agregar categoría" variant="primary">
          {(close) => form(close)}
        </Disclosure>
      </div>

      <ul className="space-y-2">
        {categories.map((category) => (
          <li key={category.id} className="card-pad">
            <p className="font-semibold text-ink">{category.label}</p>
            <p className="text-xs text-muted">
              {category.code} · orden {category.sort_order}
            </p>
            <div className="mt-2">
              <Disclosure label="Editar" variant="ghost">
                {(close) => form(close, category)}
              </Disclosure>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
