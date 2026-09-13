import type { OrderItemSnapshot, PartKind } from '@/lib/types';

export interface OrderPdfData {
  number: string;
  issuedAt: string;
  dueDate: string | null;
  status: string;
  notes: string | null;
  clientName: string;
  projectName: string;
  projectCode: string;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  measurementCode: string;
  measuredBy: string;
  approvedBy: string;
  items: (OrderItemSnapshot & { photoUrls: Record<string, string> })[];
}

export const PART_ORDER: PartKind[] = ['vidrio', 'perfileria', 'herraje', 'otro'];

export const PART_LABELS: Record<PartKind, string> = {
  vidrio: 'Vidrios',
  perfileria: 'Perfilería',
  herraje: 'Herrajes',
  otro: 'Otros materiales',
};

export function partMeasure(part: OrderItemSnapshot['parts'][number]): string {
  if (part.kind === 'vidrio' && part.width_mm && part.height_mm) {
    return `${part.width_mm} × ${part.height_mm} mm`;
  }
  if (part.kind === 'perfileria' && part.length_mm) {
    return `${part.length_mm} mm`;
  }
  return '';
}

export function partDetail(part: OrderItemSnapshot['parts'][number]): string {
  return [part.thickness, part.finish, part.color, part.code].filter(Boolean).join(' · ');
}

export function itemDimensions(item: OrderItemSnapshot): string {
  const parts = [item.width_mm, item.height_mm, item.depth_mm].filter(
    (value) => value !== null && value !== undefined,
  );
  return parts.length > 0 ? `${parts.join(' × ')} mm` : '—';
}
