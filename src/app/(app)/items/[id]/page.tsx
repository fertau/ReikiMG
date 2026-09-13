import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEditMeasurement, requireUser } from '@/lib/auth';
import { loadProductFields } from '@/lib/catalogs';
import { dimensions } from '@/lib/format';
import { MEASUREMENT_STATUS } from '@/lib/status';
import {
  Alert,
  BackLink,
  DataRow,
  PageHeader,
  Section,
  StatusChip,
} from '@/components/ui';
import { ConfirmSubmit } from '@/components/confirm-submit';
import type { FieldValueMap } from '@/components/dynamic-fields';
import {
  CameraIcon,
  MicIcon,
  NoteIcon,
  PartsIcon,
  TrashIcon,
} from '@/components/icons';
import { ItemForm } from '../item-form';
import { deleteItem, updateItem } from '../actions';
import type {
  ItemFieldValue,
  Location,
  Measurement,
  MeasurementItem,
  ProductType,
  Room,
} from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('measurement_items')
    .select('label, product_type:product_types(name)')
    .eq('id', id)
    .maybeSingle();
  const product = (data as unknown as { product_type: { name: string } | null } | null)
    ?.product_type?.name;
  return { title: data?.label || product || 'Ítem' };
}

const SUBSECTIONS = [
  { key: 'fotos', label: 'Fotos', icon: CameraIcon },
  { key: 'notas', label: 'Notas', icon: NoteIcon },
  { key: 'audios', label: 'Audios', icon: MicIcon },
  { key: 'despiece', label: 'Despiece', icon: PartsIcon },
] as const;

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: itemRow } = await supabase
    .from('measurement_items')
    .select(
      `*,
       product_type:product_types(*, family:product_families(name)),
       room:rooms(*, location:locations(*)),
       measurement:measurements(*)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!itemRow) notFound();

  const item = itemRow as unknown as MeasurementItem & {
    product_type: ProductType & { family: { name: string } | null };
    room: Room & { location: Location };
    measurement: Measurement;
  };

  const measurement = item.measurement;
  const canEdit = canEditMeasurement(user, measurement);

  const [{ data: valueRows }, { data: roomRows }, counts] = await Promise.all([
    supabase.from('item_field_values').select('*').eq('item_id', id),
    supabase
      .from('rooms')
      .select('*, location:locations!inner(id, name, project_id)')
      .eq('location.project_id', measurement.project_id)
      .order('sort_order'),
    Promise.all([
      supabase.from('item_photos').select('id', { count: 'exact', head: true }).eq('item_id', id),
      supabase.from('item_notes').select('id', { count: 'exact', head: true }).eq('item_id', id),
      supabase.from('item_audio').select('id', { count: 'exact', head: true }).eq('item_id', id),
      supabase.from('item_parts').select('id', { count: 'exact', head: true }).eq('item_id', id),
    ]),
  ]);

  const { fields, catalogs } = await loadProductFields(supabase, item.product_type_id);

  const values: FieldValueMap = {};
  for (const row of (valueRows ?? []) as unknown as ItemFieldValue[]) {
    values[row.field_id] = { value: row.value, value_text: row.value_text };
  }

  const rooms = ((roomRows ?? []) as unknown as (Room & { location: Location })[]).map(
    (room) => ({ ...room, locationName: room.location?.name ?? '' }),
  );

  const sectionCounts: Record<string, number> = {
    fotos: counts[0].count ?? 0,
    notas: counts[1].count ?? 0,
    audios: counts[2].count ?? 0,
    despiece: counts[3].count ?? 0,
  };

  const title = item.label || item.product_type.name;

  return (
    <>
      <BackLink href={`/relevamientos/${item.measurement_id}`} label={measurement.code} />

      <PageHeader
        title={title}
        subtitle={`${item.room.location.name} · ${item.room.name}`}
        action={<StatusChip {...MEASUREMENT_STATUS[measurement.status]} />}
      />

      <Section title="Documentación del ítem">
        <div className="grid grid-cols-2 gap-3">
          {SUBSECTIONS.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={`/items/${id}/${key}`}
              className="card flex min-h-24 flex-col justify-between p-3 transition active:scale-[0.98]"
            >
              <span className="flex items-center justify-between">
                <Icon className="size-6 text-brand-600" />
                <span className="text-xl font-bold tabular-nums text-ink">
                  {sectionCounts[key]}
                </span>
              </span>
              <span className="text-sm font-semibold text-slate-700">{label}</span>
            </Link>
          ))}
        </div>
      </Section>

      {canEdit ? (
        <Section title="Medidas y características">
          <div className="card-pad">
            <ItemForm
              action={updateItem}
              measurementId={item.measurement_id}
              productTypeId={item.product_type_id}
              productName={item.product_type.name}
              requiresDepth={item.product_type.requires_depth}
              rooms={rooms}
              fields={fields}
              catalogs={catalogs}
              item={item}
              values={values}
              submitLabel="Guardar cambios"
            />
          </div>
        </Section>
      ) : (
        <Section title="Medidas y características">
          <dl className="card-pad">
            <DataRow label="Producto" value={item.product_type.name} />
            <DataRow label="Cantidad" value={item.quantity} />
            <DataRow
              label="Medidas"
              value={dimensions(item.width_mm, item.height_mm, item.depth_mm)}
            />
            {fields.map((field) => {
              const value = values[field.id];
              if (!value?.value_text) return null;
              return (
                <DataRow key={field.id} label={field.label} value={value.value_text} />
              );
            })}
            {item.notes ? <DataRow label="Observaciones" value={item.notes} /> : null}
          </dl>
          <div className="mt-3">
            <Alert tone="info">
              El relevamiento no está en edición, por eso los datos se ven en sólo lectura.
            </Alert>
          </div>
        </Section>
      )}

      {canEdit ? (
        <form action={deleteItem} className="mt-6">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="measurement_id" value={item.measurement_id} />
          <ConfirmSubmit
            message="¿Eliminar este ítem con sus fotos, notas, audios y despiece?"
            className="btn-secondary btn-sm w-full text-red-600"
          >
            <TrashIcon className="size-4" />
            Eliminar ítem
          </ConfirmSubmit>
        </form>
      ) : null}
    </>
  );
}
