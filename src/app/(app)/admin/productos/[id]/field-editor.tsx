'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionForm,
  CheckboxField,
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from '@/components/form';
import { Disclosure } from '@/components/disclosure';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { TrashIcon } from '@/components/icons';
import { deleteProductField, saveProductField } from '../../catalog-actions';
import type { FieldType, MaterialCategory, ProductField } from '@/lib/types';

const TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Lista de opciones' },
  { value: 'multiselect', label: 'Lista múltiple' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'catalog', label: 'Catálogo' },
];

const TYPE_LABELS = Object.fromEntries(
  TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<FieldType, string>;

function FieldForm({
  productTypeId,
  categories,
  field,
  fieldCount,
  onDone,
}: {
  productTypeId: string;
  categories: MaterialCategory[];
  field?: ProductField;
  fieldCount: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<FieldType>(field?.field_type ?? 'text');

  return (
    <ActionForm
      action={saveProductField}
      className="space-y-3"
      onSuccess={() => {
        onDone();
        router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          {field ? <input type="hidden" name="id" value={field.id} /> : null}
          <input type="hidden" name="product_type_id" value={productTypeId} />

          <TextField
            name="label"
            label="Etiqueta visible"
            required
            autoFocus
            defaultValue={field?.label ?? ''}
            error={state.fieldErrors?.label}
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              name="field_key"
              label="Clave interna"
              required
              defaultValue={field?.field_key ?? ''}
              hint="minúsculas_con_guión"
              error={state.fieldErrors?.field_key}
            />
            <TextField
              name="section"
              label="Sección"
              required
              defaultValue={field?.section ?? 'Características'}
              error={state.fieldErrors?.section}
            />
          </div>

          <SelectField
            name="field_type"
            label="Tipo de campo"
            required
            value={type}
            onChange={(event) => setType(event.target.value as FieldType)}
            options={TYPE_OPTIONS}
            error={state.fieldErrors?.field_type}
          />

          {type === 'select' || type === 'multiselect' ? (
            <TextAreaField
              name="options_text"
              label="Opciones"
              rows={4}
              required
              defaultValue={(field?.options ?? []).join('\n')}
              hint="Una opción por línea."
            />
          ) : null}

          {type === 'catalog' ? (
            <SelectField
              name="catalog_key"
              label="Catálogo"
              required
              defaultValue={field?.catalog_key ?? ''}
              options={categories.map((category) => ({
                value: category.key,
                label: category.name,
              }))}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <TextField
              name="unit"
              label="Unidad"
              defaultValue={field?.unit ?? ''}
              placeholder="mm, u, %"
            />
            <TextField
              name="sort_order"
              label="Orden"
              type="number"
              defaultValue={field?.sort_order ?? fieldCount * 10 + 10}
            />
          </div>

          <TextField
            name="help_text"
            label="Ayuda"
            defaultValue={field?.help_text ?? ''}
            placeholder="Texto de apoyo bajo el campo"
          />

          <CheckboxField
            name="is_required"
            label="Obligatorio"
            defaultChecked={field?.is_required ?? false}
          />

          <SubmitButton className="btn-primary btn-sm w-full">Guardar campo</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function FieldEditor({
  productTypeId,
  fields,
  categories,
}: {
  productTypeId: string;
  fields: ProductField[];
  categories: MaterialCategory[];
}) {
  return (
    <>
      <div className="mb-4">
        <Disclosure label="Nuevo campo" variant="primary">
          {(close) => (
            <FieldForm
              productTypeId={productTypeId}
              categories={categories}
              fieldCount={fields.length}
              onDone={close}
            />
          )}
        </Disclosure>
      </div>

      <ul className="space-y-2">
        {fields.map((field) => (
          <li key={field.id} className="card-pad">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {field.label}
                  {field.is_required ? <span className="text-red-600"> *</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {field.section} · {TYPE_LABELS[field.field_type]}
                  {field.catalog_key ? ` · ${field.catalog_key}` : ''}
                  {field.unit ? ` · ${field.unit}` : ''}
                </p>
                <p className="text-xs text-muted">
                  {field.field_key} · orden {field.sort_order}
                </p>
              </div>
              <form action={deleteProductField}>
                <input type="hidden" name="id" value={field.id} />
                <input type="hidden" name="product_type_id" value={productTypeId} />
                <ConfirmSubmit
                  message={`¿Eliminar el campo "${field.label}"? Se borran los valores cargados en los ítems existentes.`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Eliminar campo"
                >
                  <TrashIcon className="size-5" />
                </ConfirmSubmit>
              </form>
            </div>
            <div className="mt-2">
              <Disclosure label="Editar" variant="ghost">
                {(close) => (
                  <FieldForm
                    productTypeId={productTypeId}
                    categories={categories}
                    field={field}
                    fieldCount={fields.length}
                    onDone={close}
                  />
                )}
              </Disclosure>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
