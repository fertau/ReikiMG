'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from '@/components/form';
import { DynamicFields, type FieldValueMap } from '@/components/dynamic-fields';
import type { ActionState } from '@/lib/action-state';
import type { Material, MeasurementItem, ProductField, Room } from '@/lib/types';

export function ItemForm({
  action,
  measurementId,
  productTypeId,
  productName,
  requiresDepth,
  rooms,
  fields,
  catalogs,
  item,
  values,
  submitLabel,
  redirectTo,
  defaultRoomId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  measurementId: string;
  productTypeId: string;
  productName: string;
  requiresDepth: boolean;
  rooms: (Room & { locationName: string })[];
  fields: ProductField[];
  catalogs: Record<string, Material[]>;
  item?: MeasurementItem;
  values?: FieldValueMap;
  submitLabel: string;
  redirectTo?: 'item' | 'measurement';
  defaultRoomId?: string;
}) {
  const router = useRouter();

  return (
    <ActionForm
      action={action}
      className="space-y-5"
      onSuccess={(state) => {
        if (redirectTo === 'item' && state.id) router.push(`/items/${state.id}`);
        else router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          <FormMessage state={state} />

          <input type="hidden" name="measurement_id" value={measurementId} />
          <input type="hidden" name="product_type_id" value={productTypeId} />
          {item ? <input type="hidden" name="id" value={item.id} /> : null}

          <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
            {productName}
          </div>

          <SelectField
            name="room_id"
            label="Ambiente"
            required
            defaultValue={item?.room_id ?? defaultRoomId ?? rooms[0]?.id ?? ''}
            placeholder="Elegí el ambiente"
            options={rooms.map((room) => ({
              value: room.id,
              label: `${room.locationName} · ${room.name}`,
            }))}
            error={state.fieldErrors?.room_id}
          />

          <TextField
            name="label"
            label="Identificación del ítem"
            placeholder="Ej.: Mampara ducha, Frente local A"
            hint="Opcional. Ayuda a distinguir ítems iguales en el mismo ambiente."
            defaultValue={item?.label ?? ''}
            error={state.fieldErrors?.label}
          />

          <fieldset className="space-y-4">
            <legend className="section-title mb-1">Medidas</legend>

            <TextField
              name="quantity"
              label="Cantidad"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              defaultValue={item?.quantity ?? 1}
              error={state.fieldErrors?.quantity}
            />

            <div className={requiresDepth ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
              <TextField
                name="width_mm"
                label="Ancho (mm)"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.width_mm ?? ''}
                error={state.fieldErrors?.width_mm}
              />
              <TextField
                name="height_mm"
                label="Alto (mm)"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.height_mm ?? ''}
                error={state.fieldErrors?.height_mm}
              />
              {requiresDepth ? (
                <TextField
                  name="depth_mm"
                  label="Prof. (mm)"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  defaultValue={item?.depth_mm ?? ''}
                  error={state.fieldErrors?.depth_mm}
                />
              ) : (
                <input type="hidden" name="depth_mm" value={item?.depth_mm ?? ''} />
              )}
            </div>
          </fieldset>

          <DynamicFields
            fields={fields}
            catalogs={catalogs}
            values={values}
            errors={state.fieldErrors ?? {}}
          />

          <TextAreaField
            name="notes"
            label="Observaciones"
            rows={3}
            defaultValue={item?.notes ?? ''}
            placeholder="Detalles de montaje, desniveles, aclaraciones para taller…"
            error={state.fieldErrors?.notes}
          />

          <SubmitButton className="btn-primary w-full py-4">{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
