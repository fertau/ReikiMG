import type { MeasurementStatus, OrderStatus, ProjectStatus } from '@/lib/types';

/**
 * Clases fijas para que Tailwind las detecte en el build. El color de cada
 * estado se configura en workflow_statuses; acá sólo se traduce a estilo.
 */
export const STATUS_COLORS: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  cyan: 'bg-cyan-100 text-cyan-700 ring-cyan-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  red: 'bg-red-100 text-red-700 ring-red-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  violet: 'bg-violet-100 text-violet-700 ring-violet-200',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'slate' },
  en_medicion: { label: 'En medición', color: 'blue' },
  relevado: { label: 'Relevado', color: 'cyan' },
  a_revisar: { label: 'A revisar', color: 'amber' },
  corregir: { label: 'Corregir', color: 'red' },
  aprobado: { label: 'Aprobado', color: 'green' },
  en_produccion: { label: 'En producción', color: 'violet' },
  finalizado: { label: 'Finalizado', color: 'zinc' },
};

export const MEASUREMENT_STATUS: Record<
  MeasurementStatus,
  { label: string; color: string }
> = {
  en_curso: { label: 'En curso', color: 'blue' },
  a_revisar: { label: 'A revisar', color: 'amber' },
  corregir: { label: 'Corregir', color: 'red' },
  aprobado: { label: 'Aprobado', color: 'green' },
  orden_generada: { label: 'Orden generada', color: 'violet' },
  anulado: { label: 'Anulado', color: 'zinc' },
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  generada: { label: 'Generada', color: 'blue' },
  en_produccion: { label: 'En producción', color: 'violet' },
  finalizada: { label: 'Finalizada', color: 'green' },
  anulada: { label: 'Anulada', color: 'zinc' },
};

export const LOCATION_KIND_LABELS: Record<string, string> = {
  unidad: 'Unidad',
  piso: 'Piso',
  departamento: 'Departamento',
  sector: 'Sector',
  otro: 'Otro',
};

export const PART_KIND_LABELS: Record<string, string> = {
  vidrio: 'Vidrios',
  perfileria: 'Perfilería',
  herraje: 'Herrajes',
  otro: 'Otros materiales',
};
