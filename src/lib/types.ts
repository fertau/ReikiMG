export type AppRole = 'admin' | 'medidor' | 'supervisor' | 'produccion' | 'administracion';

export const ROLES: AppRole[] = [
  'admin',
  'medidor',
  'supervisor',
  'produccion',
  'administracion',
];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  medidor: 'Medidor',
  supervisor: 'Supervisor',
  produccion: 'Producción',
  administracion: 'Administración',
};

export type ProjectStatus =
  | 'pendiente'
  | 'en_medicion'
  | 'relevado'
  | 'a_revisar'
  | 'corregir'
  | 'aprobado'
  | 'en_produccion'
  | 'finalizado';

export type MeasurementStatus =
  | 'en_curso'
  | 'a_revisar'
  | 'corregir'
  | 'aprobado'
  | 'orden_generada'
  | 'anulado';

export type OrderStatus = 'generada' | 'en_produccion' | 'finalizada' | 'anulada';

export type LocationKind = 'unidad' | 'piso' | 'departamento' | 'sector' | 'otro';

export type PartKind = 'vidrio' | 'perfileria' | 'herraje' | 'otro';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'catalog';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface SessionUser extends AppUser {
  roles: AppRole[];
}

export interface Project {
  id: string;
  code: string;
  client_name: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  assigned_to: string | null;
  scheduled_date: string | null;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  assignee?: Pick<AppUser, 'id' | 'full_name' | 'email'> | null;
}

export interface Measurement {
  id: string;
  project_id: string;
  code: string;
  status: MeasurementStatus;
  assigned_to: string | null;
  notes: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  unlocked_for_edit: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  project?: Project | null;
  assignee?: Pick<AppUser, 'id' | 'full_name' | 'email'> | null;
}

export interface Location {
  id: string;
  project_id: string;
  kind: LocationKind;
  name: string;
  floor: string | null;
  notes: string | null;
  sort_order: number;
}

export interface Room {
  id: string;
  location_id: string;
  name: string;
  notes: string | null;
  sort_order: number;
  location?: Location | null;
}

export interface ProductFamily {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductType {
  id: string;
  family_id: string;
  code: string;
  name: string;
  description: string | null;
  requires_depth: boolean;
  sort_order: number;
  is_active: boolean;
  family?: ProductFamily | null;
}

export interface ProductField {
  id: string;
  product_type_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  section: string;
  unit: string | null;
  options: string[] | null;
  catalog_key: string | null;
  is_required: boolean;
  help_text: string | null;
  default_value: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface MaterialCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Material {
  id: string;
  category_id: string;
  code: string | null;
  name: string;
  attrs: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
}

export interface MeasurementItem {
  id: string;
  measurement_id: string;
  room_id: string;
  product_type_id: string;
  label: string | null;
  quantity: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  room?: Room | null;
  product_type?: ProductType | null;
}

export interface ItemFieldValue {
  id: string;
  item_id: string;
  field_id: string;
  value: unknown;
  value_text: string | null;
}

export interface ItemPhoto {
  id: string;
  item_id: string;
  storage_path: string;
  category: string;
  caption: string | null;
  mime_type: string | null;
  byte_size: number | null;
  sort_order: number;
  created_at: string;
  created_by: string | null;
  author?: Pick<AppUser, 'id' | 'full_name'> | null;
}

export interface ItemNote {
  id: string;
  item_id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  author?: Pick<AppUser, 'id' | 'full_name'> | null;
}

export interface ItemAudio {
  id: string;
  item_id: string;
  storage_path: string;
  duration_seconds: number | null;
  mime_type: string | null;
  byte_size: number | null;
  transcript: string | null;
  transcript_status: string;
  created_at: string;
  created_by: string | null;
  author?: Pick<AppUser, 'id' | 'full_name'> | null;
}

export interface ItemPart {
  id: string;
  item_id: string;
  kind: PartKind;
  quantity: number;
  width_mm: number | null;
  height_mm: number | null;
  length_mm: number | null;
  material_id: string | null;
  description: string | null;
  code: string | null;
  unit: string | null;
  thickness: string | null;
  finish: string | null;
  color: string | null;
  notes: string | null;
  sort_order: number;
  material?: Material | null;
}

export interface ProductionOrder {
  id: string;
  number: string;
  measurement_id: string;
  project_id: string;
  status: OrderStatus;
  issued_at: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  project?: Project | null;
  measurement?: Measurement | null;
  author?: Pick<AppUser, 'id' | 'full_name'> | null;
}

/** Ítem congelado al momento de emitir la orden. */
export interface OrderItemSnapshot {
  item_id: string;
  label: string | null;
  location: string;
  location_kind: string;
  room: string;
  product: string;
  family: string;
  quantity: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  notes: string | null;
  fields: { label: string; value: string; section: string }[];
  parts: {
    kind: PartKind;
    quantity: number;
    width_mm: number | null;
    height_mm: number | null;
    length_mm: number | null;
    description: string;
    code: string | null;
    unit: string | null;
    thickness: string | null;
    finish: string | null;
    color: string | null;
    notes: string | null;
  }[];
  photos: { id: string; storage_path: string; category: string; caption: string | null }[];
  item_notes: string[];
}

export interface ProductionOrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  sort_order: number;
  snapshot: OrderItemSnapshot;
}

export interface WorkflowEvent {
  id: string;
  entity_type: string;
  entity_id: string | null;
  project_id: string | null;
  measurement_id: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
  actor?: Pick<AppUser, 'id' | 'full_name'> | null;
}

export interface WorkflowStatus {
  id: string;
  scope: 'project' | 'measurement' | 'order';
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface PhotoCategory {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}
