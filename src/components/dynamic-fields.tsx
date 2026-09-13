'use client';

import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/form';
import type { Material, ProductField } from '@/lib/types';

export interface FieldValueMap {
  [fieldId: string]: { value: unknown; value_text: string | null };
}

function defaultFor(field: ProductField, current?: { value: unknown }): string {
  if (current === undefined) return field.default_value ?? '';
  const raw = current.value;
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object' && raw !== null && 'material_id' in raw) {
    return String((raw as { material_id: string }).material_id);
  }
  return String(raw);
}

/**
 * Renderiza los campos configurados para el producto. La definición vive en
 * product_fields, así que agregar un producto nuevo no toca este componente.
 */
export function DynamicFields({
  fields,
  catalogs,
  values = {},
  errors = {},
}: {
  fields: ProductField[];
  catalogs: Record<string, Material[]>;
  values?: FieldValueMap;
  errors?: Record<string, string>;
}) {
  if (fields.length === 0) return null;

  const sections = fields.reduce<Record<string, ProductField[]>>((acc, field) => {
    (acc[field.section] ??= []).push(field);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(sections).map(([section, sectionFields]) => (
        <fieldset key={section} className="space-y-4">
          <legend className="section-title mb-1">{section}</legend>

          {sectionFields.map((field) => {
            const name = `f_${field.id}`;
            const error = errors[name];
            const current = values[field.id];

            switch (field.field_type) {
              case 'textarea':
                return (
                  <TextAreaField
                    key={field.id}
                    name={name}
                    label={field.label}
                    required={field.is_required}
                    hint={field.help_text ?? undefined}
                    defaultValue={defaultFor(field, current)}
                    error={error}
                  />
                );

              case 'number':
                return (
                  <TextField
                    key={field.id}
                    name={name}
                    label={field.unit ? `${field.label} (${field.unit})` : field.label}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    required={field.is_required}
                    hint={field.help_text ?? undefined}
                    defaultValue={defaultFor(field, current)}
                    error={error}
                  />
                );

              case 'boolean': {
                const checked =
                  current !== undefined
                    ? current.value === true || current.value === 'true'
                    : field.default_value === 'true';
                return (
                  <CheckboxField
                    key={field.id}
                    name={name}
                    label={field.label}
                    hint={field.help_text ?? undefined}
                    defaultChecked={checked}
                  />
                );
              }

              case 'select':
                return (
                  <SelectField
                    key={field.id}
                    name={name}
                    label={field.label}
                    required={field.is_required}
                    hint={field.help_text ?? undefined}
                    defaultValue={defaultFor(field, current)}
                    options={(field.options ?? []).map((option) => ({
                      value: option,
                      label: option,
                    }))}
                    error={error}
                  />
                );

              case 'multiselect': {
                const selected = Array.isArray(current?.value)
                  ? (current!.value as string[])
                  : [];
                return (
                  <div key={field.id}>
                    <span className="label">{field.label}</span>
                    <div className="space-y-2">
                      {(field.options ?? []).map((option) => (
                        <label
                          key={option}
                          className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300"
                        >
                          <input
                            type="checkbox"
                            name={`${name}[]`}
                            value={option}
                            defaultChecked={selected.includes(option)}
                            className="size-5 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                          />
                          <span className="text-sm text-slate-700">{option}</span>
                        </label>
                      ))}
                    </div>
                    {error ? <p className="field-error">{error}</p> : null}
                  </div>
                );
              }

              case 'catalog': {
                const materials = catalogs[field.catalog_key ?? ''] ?? [];
                return (
                  <SelectField
                    key={field.id}
                    name={name}
                    label={field.unit ? `${field.label} (${field.unit})` : field.label}
                    required={field.is_required}
                    hint={
                      materials.length === 0
                        ? 'Sin opciones cargadas en el catálogo'
                        : (field.help_text ?? undefined)
                    }
                    defaultValue={defaultFor(field, current)}
                    options={materials.map((material) => ({
                      value: material.id,
                      label: material.name,
                    }))}
                    error={error}
                  />
                );
              }

              default:
                return (
                  <TextField
                    key={field.id}
                    name={name}
                    label={field.label}
                    required={field.is_required}
                    hint={field.help_text ?? undefined}
                    defaultValue={defaultFor(field, current)}
                    error={error}
                  />
                );
            }
          })}
        </fieldset>
      ))}
    </>
  );
}
