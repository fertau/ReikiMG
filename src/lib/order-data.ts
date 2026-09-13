import type { SupabaseClient } from '@supabase/supabase-js';
import { displayName, formatDate } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status';
import type { OrderPdfData } from '@/lib/order-pdf';
import type { OrderItemSnapshot, ProductionOrder } from '@/lib/types';

export interface LoadedOrder {
  order: ProductionOrder;
  snapshots: OrderItemSnapshot[];
  photoUrls: Map<string, string>;
  pdf: OrderPdfData;
}

/** Orden con sus ítems congelados y las URLs firmadas de las fotos incluidas. */
export async function loadOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<LoadedOrder | null> {
  const { data: orderRow } = await supabase
    .from('production_orders')
    .select(
      `*,
       project:projects(*),
       measurement:measurements(
         id, code,
         assignee:users!measurements_assigned_to_fkey(id, full_name, email),
         approver:users!measurements_approved_by_fkey(id, full_name, email)
       ),
       author:users!production_orders_created_by_fkey(id, full_name)`,
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!orderRow) return null;

  const order = orderRow as unknown as ProductionOrder & {
    measurement: {
      code: string;
      assignee: { full_name: string | null; email: string } | null;
      approver: { full_name: string | null; email: string } | null;
    } | null;
  };

  const { data: itemRows } = await supabase
    .from('production_order_items')
    .select('snapshot')
    .eq('order_id', orderId)
    .order('sort_order');

  const snapshots = ((itemRows ?? []) as { snapshot: OrderItemSnapshot }[]).map(
    (row) => row.snapshot,
  );

  const paths = snapshots.flatMap((snapshot) =>
    snapshot.photos.map((photo) => photo.storage_path),
  );

  const photoUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('item-photos')
      .createSignedUrls(paths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) photoUrls.set(entry.path, entry.signedUrl);
    }
  }

  const pdf: OrderPdfData = {
    number: order.number,
    issuedAt: formatDate(order.issued_at),
    dueDate: order.due_date ? formatDate(order.due_date) : null,
    status: ORDER_STATUS[order.status].label,
    notes: order.notes,
    clientName: order.project?.client_name ?? '',
    projectName: order.project?.name ?? '',
    projectCode: order.project?.code ?? '',
    address: order.project?.address ?? null,
    contactName: order.project?.contact_name ?? null,
    contactPhone: order.project?.contact_phone ?? null,
    measurementCode: order.measurement?.code ?? '',
    measuredBy: displayName(order.measurement?.assignee),
    approvedBy: displayName(order.measurement?.approver),
    items: snapshots.map((snapshot) => ({
      ...snapshot,
      photoUrls: Object.fromEntries(
        snapshot.photos
          .map((photo) => [photo.id, photoUrls.get(photo.storage_path)] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
      ),
    })),
  };

  return { order, snapshots, photoUrls, pdf };
}
