'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from '@/components/form';
import { addPart, updatePart } from '../../part-actions';
import type { ItemPart, Material, PartKind } from '@/lib/types';

export type PartCatalogs = Record<string, Material[]>;

function nameOptions(materials: Material[] = []) {
  return materials.map((material) => ({ value: material.name, label: material.name }));
}

function idOptions(materials: Material[] = []) {
  return materials.map((material) => ({
    value: material.id,
    label: material.code ? `${material.name} (${material.code})` : material.name,
  }));
}

export function PartForm({
  itemId,
  kind,
  catalogs,
  part,
  onDone,
}: {
  itemId: string;
  kind: PartKind;
  catalogs: PartCatalogs;
  part?: ItemPart;
  onDone?: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(part);

  return (
    <ActionForm
      action={editing ? updatePart : addPart}
      className="space-y-3"
      resetOnSuccess={!editing}
      onSuccess={() => {
        onDone?.();
        router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          <input type="hidden" name="item_id" value={itemId} />
          <input type="hidden" name="kind" value={kind} />
          {part ? <input type="hidden" name="id" value={part.id} /> : null}

          <TextField
            name="quantity"
            label="Cantidad"
            type="number"
            inputMode="decimal"
            step="any"
            min="0.01"
            required
            defaultValue={part?.quantity ?? 1}
            error={state.fieldErrors?.quantity}
          />

          {kind === 'vidrio' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  name="width_mm"
                  label="Ancho (mm)"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  required
                  defaultValue={part?.width_mm ?? ''}
                />
                <TextField
                  name="height_mm"
                  label="Alto (mm)"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  required
                  defaultValue={part?.height_mm ?? ''}
                />
              </div>
              <SelectField
                name="material_id"
                label="Tipo de vidrio"
                placeholder="Elegí el vidrio"
                defaultValue={part?.material_id ?? ''}
                options={idOptions(catalogs.tipo_vidrio)}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  name="thickness"
                  label="Espesor"
                  placeholder="—"
                  defaultValue={part?.thickness ?? ''}
                  options={nameOptions(catalogs.espesor)}
                />
                <SelectField
                  name="finish"
                  label="Terminación"
                  placeholder="—"
                  defaultValue={part?.finish ?? ''}
                  options={nameOptions(catalogs.terminacion)}
                />
              </div>
            </>
          ) : null}

          {kind === 'perfileria' ? (
            <>
              <SelectField
                name="material_id"
                label="Perfil"
                placeholder="Elegí el perfil"
                defaultValue={part?.material_id ?? ''}
                options={idOptions(catalogs.perfileria)}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  name="length_mm"
                  label="Longitud (mm)"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  required
                  defaultValue={part?.length_mm ?? ''}
                />
                <SelectField
                  name="color"
                  label="Color"
                  placeholder="—"
                  defaultValue={part?.color ?? ''}
                  options={nameOptions(catalogs.color)}
                />
              </div>
            </>
          ) : null}

          {kind === 'herraje' ? (
            <>
              <SelectField
                name="material_id"
                label="Herraje del catálogo"
                placeholder="Sin catálogo"
                defaultValue={part?.material_id ?? ''}
                options={idOptions(catalogs.herraje)}
              />
              <TextField
                name="code"
                label="Código"
                defaultValue={part?.code ?? ''}
                placeholder="Código de proveedor"
              />
            </>
          ) : null}

          {kind === 'otro' ? (
            <TextField
              name="unit"
              label="Unidad"
              defaultValue={part?.unit ?? ''}
              placeholder="u, m, m², kg"
            />
          ) : null}

          <TextField
            name="description"
            label={kind === 'vidrio' || kind === 'perfileria' ? 'Detalle' : 'Descripción'}
            required={kind === 'herraje' || kind === 'otro'}
            defaultValue={part?.description ?? ''}
            placeholder={
              kind === 'herraje'
                ? 'Ej.: bisagra vidrio-vidrio 90°'
                : kind === 'otro'
                  ? 'Ej.: silicona neutra transparente'
                  : 'Opcional'
            }
          />

          <TextAreaField
            name="notes"
            label="Observación"
            rows={2}
            defaultValue={part?.notes ?? ''}
          />

          <SubmitButton className="btn-primary btn-sm w-full">
            {editing ? 'Guardar fila' : 'Agregar fila'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
