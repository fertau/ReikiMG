import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ItemAudio,
  ItemNote,
  ItemPart,
  ItemPhoto,
  Location,
  Measurement,
  MeasurementItem,
  OrderItemSnapshot,
  ProductType,
  Project,
  Room,
} from '@/lib/types';

export interface FullItem {
  item: MeasurementItem;
  room: Room;
  location: Location;
  productType: ProductType;
  familyName: string;
  fields: { label: string; value: string; section: string }[];
  parts: ItemPart[];
  photos: ItemPhoto[];
  notes: ItemNote[];
  audios: ItemAudio[];
}

export interface FullMeasurement {
  measurement: Measurement;
  project: Project;
  items: FullItem[];
}

/**
 * Carga el relevamiento completo con todo lo que cuelga de cada ítem.
 * Es la fuente única para la pantalla de revisión, la generación de la orden
 * y la impresión, para que las tres muestren exactamente lo mismo.
 */
export async function loadMeasurementFull(
  supabase: SupabaseClient,
  measurementId: string,
): Promise<FullMeasurement | null> {
  const { data: measurementRow } = await supabase
    .from('measurements')
    .select('*, project:projects(*)')
    .eq('id', measurementId)
    .maybeSingle();

  if (!measurementRow) return null;

  const measurement = measurementRow as unknown as Measurement & { project: Project };

  const { data: itemRows } = await supabase
    .from('measurement_items')
    .select(
      `*,
       product_type:product_types(*, family:product_families(name)),
       room:rooms(*, location:locations(*))`,
    )
    .eq('measurement_id', measurementId)
    .order('sort_order');

  const items = (itemRows ?? []) as unknown as (MeasurementItem & {
    product_type: ProductType & { family: { name: string } | null };
    room: Room & { location: Location };
  })[];

  if (items.length === 0) {
    return { measurement, project: measurement.project, items: [] };
  }

  const itemIds = items.map((item) => item.id);

  const [{ data: valueRows }, { data: partRows }, { data: photoRows }, { data: noteRows }, { data: audioRows }] =
    await Promise.all([
      supabase
        .from('item_field_values')
        .select('item_id, value_text, field:product_fields(label, section, sort_order)')
        .in('item_id', itemIds),
      supabase
        .from('item_parts')
        .select('*, material:materials(id, name, code)')
        .in('item_id', itemIds)
        .order('kind')
        .order('sort_order'),
      supabase
        .from('item_photos')
        .select('*, author:users!item_photos_created_by_fkey(id, full_name)')
        .in('item_id', itemIds)
        .order('created_at'),
      supabase
        .from('item_notes')
        .select('*, author:users!item_notes_created_by_fkey(id, full_name)')
        .in('item_id', itemIds)
        .order('created_at'),
      supabase
        .from('item_audio')
        .select('*, author:users!item_audio_created_by_fkey(id, full_name)')
        .in('item_id', itemIds)
        .order('created_at'),
    ]);

  type ValueRow = {
    item_id: string;
    value_text: string | null;
    field: { label: string; section: string; sort_order: number } | null;
  };

  const fieldsByItem = new Map<string, FullItem['fields']>();
  for (const row of (valueRows ?? []) as unknown as ValueRow[]) {
    if (!row.field || !row.value_text) continue;
    const list = fieldsByItem.get(row.item_id) ?? [];
    list.push({
      label: row.field.label,
      value: row.value_text,
      section: row.field.section,
    });
    fieldsByItem.set(row.item_id, list);
  }
  for (const list of fieldsByItem.values()) {
    list.sort((a, b) => a.section.localeCompare(b.section) || a.label.localeCompare(b.label));
  }

  const groupBy = <T extends { item_id: string }>(rows: T[] | null) => {
    const map = new Map<string, T[]>();
    for (const row of rows ?? []) {
      const list = map.get(row.item_id) ?? [];
      list.push(row);
      map.set(row.item_id, list);
    }
    return map;
  };

  const partsByItem = groupBy(partRows as unknown as ItemPart[]);
  const photosByItem = groupBy(photoRows as unknown as ItemPhoto[]);
  const notesByItem = groupBy(noteRows as unknown as ItemNote[]);
  const audiosByItem = groupBy(audioRows as unknown as ItemAudio[]);

  return {
    measurement,
    project: measurement.project,
    items: items.map((item) => ({
      item,
      room: item.room,
      location: item.room.location,
      productType: item.product_type,
      familyName: item.product_type.family?.name ?? '',
      fields: fieldsByItem.get(item.id) ?? [],
      parts: partsByItem.get(item.id) ?? [],
      photos: photosByItem.get(item.id) ?? [],
      notes: notesByItem.get(item.id) ?? [],
      audios: audiosByItem.get(item.id) ?? [],
    })),
  };
}

/** Congela un ítem para la orden de producción. */
export function toSnapshot(full: FullItem): OrderItemSnapshot {
  return {
    item_id: full.item.id,
    label: full.item.label,
    location: full.location.name,
    location_kind: full.location.kind,
    room: full.room.name,
    product: full.productType.name,
    family: full.familyName,
    quantity: full.item.quantity,
    width_mm: full.item.width_mm,
    height_mm: full.item.height_mm,
    depth_mm: full.item.depth_mm,
    notes: full.item.notes,
    fields: full.fields,
    parts: full.parts.map((part) => ({
      kind: part.kind,
      quantity: part.quantity,
      width_mm: part.width_mm,
      height_mm: part.height_mm,
      length_mm: part.length_mm,
      description: part.material?.name ?? part.description ?? '',
      code: part.code ?? part.material?.code ?? null,
      unit: part.unit,
      thickness: part.thickness,
      finish: part.finish,
      color: part.color,
      notes: part.notes,
    })),
    photos: full.photos.map((photo) => ({
      id: photo.id,
      storage_path: photo.storage_path,
      category: photo.category,
      caption: photo.caption,
    })),
    item_notes: full.notes.map((note) => note.body),
  };
}
