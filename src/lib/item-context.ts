import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { canEditMeasurement, requireUser } from '@/lib/auth';
import type { Location, Measurement, MeasurementItem, ProductType, Room } from '@/lib/types';

export interface ItemContext {
  supabase: SupabaseClient;
  item: MeasurementItem & {
    product_type: ProductType;
    room: Room & { location: Location };
    measurement: Measurement;
  };
  canEdit: boolean;
  title: string;
}

/** Carga el ítem con su contexto y resuelve permisos de edición. */
export async function loadItemContext(itemId: string): Promise<ItemContext> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('measurement_items')
    .select(
      `*,
       product_type:product_types(*),
       room:rooms(*, location:locations(*)),
       measurement:measurements(*)`,
    )
    .eq('id', itemId)
    .maybeSingle();

  if (!data) notFound();

  const item = data as unknown as ItemContext['item'];

  return {
    supabase,
    item,
    canEdit: canEditMeasurement(user, item.measurement),
    title: item.label || item.product_type.name,
  };
}
