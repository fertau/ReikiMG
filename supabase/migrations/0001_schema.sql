-- =====================================================================
-- ReikiMG · 0001 · Esquema base
-- Relevamientos y órdenes de producción para vidrios, cerramientos,
-- mamparas, barandas, frentes y sistemas de cristal templado.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Enums
-- Los estados del flujo son enums porque gobiernan permisos y
-- transiciones. Las etiquetas visibles se editan desde workflow_statuses.
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'app_role') then
    create type public.app_role as enum (
  'admin', 'medidor', 'supervisor', 'produccion', 'administracion'
);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'project_status') then
    create type public.project_status as enum (
  'pendiente', 'en_medicion', 'relevado', 'a_revisar',
  'corregir', 'aprobado', 'en_produccion', 'finalizado'
);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'measurement_status') then
    create type public.measurement_status as enum (
  'en_curso', 'a_revisar', 'corregir', 'aprobado', 'orden_generada', 'anulado'
);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'order_status') then
    create type public.order_status as enum (
  'generada', 'en_produccion', 'finalizada', 'anulada'
);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'location_kind') then
    create type public.location_kind as enum (
  'unidad', 'piso', 'departamento', 'sector', 'otro'
);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'part_kind') then
    create type public.part_kind as enum (
  'vidrio', 'perfileria', 'herraje', 'otro'
);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'field_type') then
    create type public.field_type as enum (
  'text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'catalog'
);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.doc_counters (
  scope       text    not null,
  year        integer not null,
  last_value  integer not null default 0,
  primary key (scope, year)
);

-- Numeración correlativa por año (OB-2026-0001, REL-2026-0001, OP-2026-00125).
create or replace function public.next_doc_number(
  p_scope text, p_prefix text, p_width integer default 4
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::int;
  v_next integer;
begin
  insert into public.doc_counters (scope, year, last_value)
  values (p_scope, v_year, 1)
  on conflict (scope, year)
    do update set last_value = public.doc_counters.last_value + 1
  returning last_value into v_next;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, p_width, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- Usuarios y roles
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists users_email_key on public.users (lower(email));
drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.users (id),
  unique (user_id, role)
);
create index if not exists user_roles_user_id_idx on public.user_roles (user_id);

-- Alta automática del perfil al crearse el usuario en auth.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do update set email = excluded.email;

  -- El rol se asigna desde administración; por defecto el usuario entra sin permisos.
  insert into public.user_roles (user_id, role)
  select new.id, (new.raw_user_meta_data ->> 'role')::public.app_role
  where new.raw_user_meta_data ->> 'role' is not null
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- Catálogos editables desde administración
-- ---------------------------------------------------------------------
create table if not exists public.workflow_statuses (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('project', 'measurement', 'order')),
  code        text not null,
  label       text not null,
  color       text not null default 'slate',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (scope, code)
);
drop trigger if exists workflow_statuses_updated_at on public.workflow_statuses;
create trigger workflow_statuses_updated_at before update on public.workflow_statuses
  for each row execute function public.set_updated_at();

create table if not exists public.photo_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label       text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists photo_categories_updated_at on public.photo_categories;
create trigger photo_categories_updated_at before update on public.photo_categories
  for each row execute function public.set_updated_at();

-- material_categories agrupa todos los catálogos de materiales:
-- tipos de vidrio, espesores, colores, terminaciones, perfilería, herrajes, etc.
create table if not exists public.material_categories (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists material_categories_updated_at on public.material_categories;
create trigger material_categories_updated_at before update on public.material_categories
  for each row execute function public.set_updated_at();

create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.material_categories (id) on delete cascade,
  code         text,
  name         text not null,
  attrs        jsonb not null default '{}'::jsonb,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists materials_category_code_key
  on public.materials (category_id, code) where code is not null;
create index if not exists materials_category_idx on public.materials (category_id) where is_active;
drop trigger if exists materials_updated_at on public.materials;
create trigger materials_updated_at before update on public.materials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Productos y campos dinámicos
-- ---------------------------------------------------------------------
create table if not exists public.product_families (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  icon        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists product_families_updated_at on public.product_families;
create trigger product_families_updated_at before update on public.product_families
  for each row execute function public.set_updated_at();

create table if not exists public.product_types (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.product_families (id) on delete restrict,
  code         text not null unique,
  name         text not null,
  description  text,
  requires_depth boolean not null default false,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists product_types_family_idx on public.product_types (family_id) where is_active;
drop trigger if exists product_types_updated_at on public.product_types;
create trigger product_types_updated_at before update on public.product_types
  for each row execute function public.set_updated_at();

-- Definición de los campos que se muestran al cargar un ítem de este producto.
create table if not exists public.product_fields (
  id               uuid primary key default gen_random_uuid(),
  product_type_id  uuid not null references public.product_types (id) on delete cascade,
  field_key        text not null,
  label            text not null,
  field_type       public.field_type not null default 'text',
  section          text not null default 'Características',
  unit             text,
  options          jsonb,       -- select/multiselect: ["Izquierda","Derecha"]
  catalog_key      text,        -- field_type='catalog': material_categories.key
  is_required      boolean not null default false,
  help_text        text,
  default_value    text,
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (product_type_id, field_key)
);
create index if not exists product_fields_type_idx on public.product_fields (product_type_id) where is_active;
drop trigger if exists product_fields_updated_at on public.product_fields;
create trigger product_fields_updated_at before update on public.product_fields
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Obras
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  code           text unique,
  client_name    text not null,
  name           text not null,
  address        text,
  contact_name   text,
  contact_phone  text,
  assigned_to    uuid references public.users (id) on delete set null,
  scheduled_date date,
  status         public.project_status not null default 'pendiente',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.users (id) default auth.uid(),
  search_text    text generated always as (
    coalesce(code, '') || ' ' || client_name || ' ' || name || ' ' || coalesce(address, '')
    || ' ' || coalesce(contact_name, '')
  ) stored
);
create index if not exists projects_search_idx on public.projects using gin (search_text gin_trgm_ops);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_assigned_idx on public.projects (assigned_to);

create or replace function public.projects_set_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code is null then
    new.code := public.next_doc_number('project', 'OB', 4);
  end if;
  return new;
end;
$$;
drop trigger if exists projects_set_code on public.projects;
create trigger projects_set_code before insert on public.projects
  for each row execute function public.projects_set_code();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Estructura física de la obra: Unidad/Sector -> Ambiente
-- Se define a nivel obra para poder reutilizarla entre relevamientos.
-- ---------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  kind        public.location_kind not null default 'unidad',
  name        text not null,
  floor       text,
  notes       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.users (id) default auth.uid()
);
create index if not exists locations_project_idx on public.locations (project_id);
drop trigger if exists locations_updated_at on public.locations;
create trigger locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();

create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations (id) on delete cascade,
  name         text not null,
  notes        text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.users (id) default auth.uid()
);
create index if not exists rooms_location_idx on public.rooms (location_id);
drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Relevamientos
-- ---------------------------------------------------------------------
create table if not exists public.measurements (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  code              text unique,
  status            public.measurement_status not null default 'en_curso',
  assigned_to       uuid references public.users (id) on delete set null,
  notes             text,
  submitted_at      timestamptz,
  submitted_by      uuid references public.users (id),
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.users (id),
  review_notes      text,               -- motivo obligatorio al devolver
  approved_at       timestamptz,
  approved_by       uuid references public.users (id),
  unlocked_for_edit boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.users (id) default auth.uid()
);
create index if not exists measurements_project_idx on public.measurements (project_id);
create index if not exists measurements_status_idx on public.measurements (status);
create index if not exists measurements_assigned_idx on public.measurements (assigned_to);

create or replace function public.measurements_set_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.code is null then
    new.code := public.next_doc_number('measurement', 'REL', 4);
  end if;
  if new.assigned_to is null then
    new.assigned_to := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists measurements_set_code on public.measurements;
create trigger measurements_set_code before insert on public.measurements
  for each row execute function public.measurements_set_code();
drop trigger if exists measurements_updated_at on public.measurements;
create trigger measurements_updated_at before update on public.measurements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Ítems / productos medidos
-- ---------------------------------------------------------------------
create table if not exists public.measurement_items (
  id               uuid primary key default gen_random_uuid(),
  measurement_id   uuid not null references public.measurements (id) on delete cascade,
  room_id          uuid not null references public.rooms (id) on delete restrict,
  product_type_id  uuid not null references public.product_types (id) on delete restrict,
  label            text,
  quantity         integer not null default 1 check (quantity > 0),
  width_mm         numeric(10, 2),
  height_mm        numeric(10, 2),
  depth_mm         numeric(10, 2),
  notes            text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.users (id) default auth.uid()
);
create index if not exists measurement_items_measurement_idx on public.measurement_items (measurement_id);
create index if not exists measurement_items_room_idx on public.measurement_items (room_id);
drop trigger if exists measurement_items_updated_at on public.measurement_items;
create trigger measurement_items_updated_at before update on public.measurement_items
  for each row execute function public.set_updated_at();

create table if not exists public.item_field_values (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.measurement_items (id) on delete cascade,
  field_id    uuid not null references public.product_fields (id) on delete cascade,
  value       jsonb,
  value_text  text,          -- representación legible para PDF y búsquedas
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (item_id, field_id)
);
create index if not exists item_field_values_item_idx on public.item_field_values (item_id);
drop trigger if exists item_field_values_updated_at on public.item_field_values;
create trigger item_field_values_updated_at before update on public.item_field_values
  for each row execute function public.set_updated_at();

create table if not exists public.item_photos (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.measurement_items (id) on delete cascade,
  storage_path  text not null unique,
  category      text not null default 'general',
  caption       text,
  mime_type     text,
  byte_size     integer,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.users (id) default auth.uid()
);
create index if not exists item_photos_item_idx on public.item_photos (item_id);

create table if not exists public.item_notes (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.measurement_items (id) on delete cascade,
  body        text not null check (length(btrim(body)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.users (id) default auth.uid()
);
create index if not exists item_notes_item_idx on public.item_notes (item_id);
drop trigger if exists item_notes_updated_at on public.item_notes;
create trigger item_notes_updated_at before update on public.item_notes
  for each row execute function public.set_updated_at();

create table if not exists public.item_audio (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references public.measurement_items (id) on delete cascade,
  storage_path      text not null unique,
  duration_seconds  numeric(8, 2),
  mime_type         text,
  byte_size         integer,
  -- Preparado para transcripción automática posterior.
  transcript        text,
  transcript_status text not null default 'pendiente'
    check (transcript_status in ('pendiente', 'procesando', 'listo', 'error', 'omitido')),
  created_at        timestamptz not null default now(),
  created_by        uuid references public.users (id) default auth.uid()
);
create index if not exists item_audio_item_idx on public.item_audio (item_id);

-- ---------------------------------------------------------------------
-- Despiece
-- ---------------------------------------------------------------------
create table if not exists public.item_parts (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.measurement_items (id) on delete cascade,
  kind         public.part_kind not null,
  quantity     numeric(10, 2) not null default 1 check (quantity > 0),
  width_mm     numeric(10, 2),
  height_mm    numeric(10, 2),
  length_mm    numeric(10, 2),
  material_id  uuid references public.materials (id) on delete set null,
  description  text,
  code         text,
  unit         text,
  thickness    text,
  finish       text,
  color        text,
  notes        text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.users (id) default auth.uid()
);
create index if not exists item_parts_item_idx on public.item_parts (item_id, kind);
drop trigger if exists item_parts_updated_at on public.item_parts;
create trigger item_parts_updated_at before update on public.item_parts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Órdenes de producción
-- ---------------------------------------------------------------------
create table if not exists public.production_orders (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,
  measurement_id  uuid not null references public.measurements (id) on delete restrict,
  project_id      uuid not null references public.projects (id) on delete restrict,
  status          public.order_status not null default 'generada',
  issued_at       timestamptz not null default now(),
  due_date        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users (id) default auth.uid()
);
create index if not exists production_orders_project_idx on public.production_orders (project_id);
create index if not exists production_orders_status_idx on public.production_orders (status);

create or replace function public.production_orders_set_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.number is null then
    new.number := public.next_doc_number('production_order', 'OP', 5);
  end if;
  return new;
end;
$$;
drop trigger if exists production_orders_set_number on public.production_orders;
create trigger production_orders_set_number before insert on public.production_orders
  for each row execute function public.production_orders_set_number();
drop trigger if exists production_orders_updated_at on public.production_orders;
create trigger production_orders_updated_at before update on public.production_orders
  for each row execute function public.set_updated_at();

-- El snapshot congela el ítem al momento de emitir la orden: lo que produce
-- taller no cambia aunque después se autorice editar el relevamiento.
create table if not exists public.production_order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.production_orders (id) on delete cascade,
  item_id     uuid references public.measurement_items (id) on delete set null,
  sort_order  integer not null default 0,
  snapshot    jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists production_order_items_order_idx on public.production_order_items (order_id);

-- ---------------------------------------------------------------------
-- Historial / auditoría
-- ---------------------------------------------------------------------
create table if not exists public.workflow_history (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,
  entity_id       uuid,
  project_id      uuid references public.projects (id) on delete cascade,
  measurement_id  uuid references public.measurements (id) on delete cascade,
  action          text not null,
  description     text not null,
  metadata        jsonb not null default '{}'::jsonb,
  actor_id        uuid references public.users (id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists workflow_history_measurement_idx on public.workflow_history (measurement_id, created_at desc);
create index if not exists workflow_history_project_idx on public.workflow_history (project_id, created_at desc);
