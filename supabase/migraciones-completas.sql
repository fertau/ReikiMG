-- =====================================================================
-- ReikiMG · Migraciones completas
--
-- Pegar TODO este contenido en el SQL Editor de Supabase y ejecutar.
--
-- Se puede ejecutar las veces que haga falta: si algo ya existe, se
-- deja como está. Si una corrida se cortó por la mitad, simplemente
-- volvé a ejecutarlo y completa lo que falta.
--
-- Después, por separado: 0005_bootstrap_admin.sql (hay que editarle el
-- email antes de correrlo).
-- =====================================================================

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

-- =====================================================================
-- ReikiMG · 0002 · Row Level Security y máquina de estados
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers (security definer para evitar recursión en las policies)
-- ---------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = p_role and u.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

-- Perfiles con visibilidad completa de lectura.
create or replace function public.can_read_all()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin')
      or public.has_role('supervisor')
      or public.has_role('administracion');
$$;

create or replace function public.is_production()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('produccion');
$$;

create or replace function public.project_is_readable(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_read_all()
      or public.is_production()
      or exists (
        select 1 from public.projects p
        where p.id = p_project_id
          and (p.assigned_to = auth.uid() or p.created_by = auth.uid())
      )
      or exists (
        select 1 from public.measurements m
        where m.project_id = p_project_id
          and (m.assigned_to = auth.uid() or m.created_by = auth.uid())
      );
$$;

-- Crear/editar la estructura de la obra (unidades y ambientes).
create or replace function public.project_is_writable(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin')
      or public.has_role('supervisor')
      or (public.has_role('medidor') and public.project_is_readable(p_project_id));
$$;

create or replace function public.measurement_is_readable(p_measurement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.can_read_all() then true
    when public.is_production() then exists (
      select 1 from public.measurements m
      where m.id = p_measurement_id and m.status in ('aprobado', 'orden_generada')
    )
    else exists (
      select 1 from public.measurements m
      where m.id = p_measurement_id
        and (m.assigned_to = auth.uid() or m.created_by = auth.uid())
    )
  end;
$$;

-- Única fuente de verdad sobre "se puede modificar el contenido del relevamiento".
create or replace function public.measurement_is_editable(p_measurement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.measurements m
    where m.id = p_measurement_id
      and (
        public.is_admin()
        or (
          public.has_role('medidor')
          and (m.assigned_to = auth.uid() or m.created_by = auth.uid())
          and (m.status in ('en_curso', 'corregir') or m.unlocked_for_edit)
        )
      )
  );
$$;

create or replace function public.item_measurement_id(p_item_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select measurement_id from public.measurement_items where id = p_item_id;
$$;

create or replace function public.item_is_editable(p_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.measurement_is_editable(public.item_measurement_id(p_item_id));
$$;

create or replace function public.item_is_readable(p_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.measurement_is_readable(public.item_measurement_id(p_item_id));
$$;

-- ---------------------------------------------------------------------
-- Máquina de estados del relevamiento
-- ---------------------------------------------------------------------
create or replace function public.measurements_guard_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin      boolean := public.is_admin();
  v_supervisor boolean := public.has_role('supervisor');
  v_owner      boolean := (old.assigned_to = auth.uid() or old.created_by = auth.uid());
begin
  if new.status is distinct from old.status then
    if v_admin then
      null;
    elsif v_supervisor then
      if not (
        (old.status = 'a_revisar' and new.status in ('aprobado', 'corregir'))
        or (old.status = 'aprobado' and new.status = 'orden_generada')
      ) then
        raise exception 'Transición no permitida para supervisor: % -> %', old.status, new.status
          using errcode = 'check_violation';
      end if;
    elsif v_owner and public.has_role('medidor') then
      if not (old.status in ('en_curso', 'corregir') and new.status = 'a_revisar') then
        raise exception 'Transición no permitida para el medidor: % -> %', old.status, new.status
          using errcode = 'check_violation';
      end if;
    else
      raise exception 'Sin permisos para cambiar el estado del relevamiento'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Devolver para corregir exige motivo escrito.
  if new.status = 'corregir' and coalesce(btrim(new.review_notes), '') = '' then
    raise exception 'Debe indicarse el motivo de la devolución'
      using errcode = 'check_violation';
  end if;

  -- La autorización para editar un relevamiento aprobado es de supervisión.
  if new.unlocked_for_edit is distinct from old.unlocked_for_edit
     and not (v_admin or v_supervisor) then
    raise exception 'Sólo un supervisor puede autorizar la edición de un relevamiento aprobado'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists measurements_guard_transition on public.measurements;
create trigger measurements_guard_transition
  before update on public.measurements
  for each row execute function public.measurements_guard_transition();

-- El estado de la obra sigue al del relevamiento.
create or replace function public.measurements_sync_project_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new public.project_status;
begin
  v_new := case new.status
    when 'en_curso'       then 'en_medicion'
    when 'a_revisar'      then 'a_revisar'
    when 'corregir'       then 'corregir'
    when 'aprobado'       then 'aprobado'
    when 'orden_generada' then 'en_produccion'
    else null
  end::public.project_status;

  if v_new is not null then
    update public.projects p
       set status = v_new
     where p.id = new.project_id
       and p.status <> 'finalizado'
       and p.status is distinct from v_new;
  end if;

  return new;
end;
$$;

drop trigger if exists measurements_sync_project_status on public.measurements;
create trigger measurements_sync_project_status
  after insert or update of status on public.measurements
  for each row execute function public.measurements_sync_project_status();

-- ---------------------------------------------------------------------
-- Activación de RLS
-- ---------------------------------------------------------------------
alter table public.users                 enable row level security;
alter table public.user_roles            enable row level security;
alter table public.workflow_statuses     enable row level security;
alter table public.photo_categories      enable row level security;
alter table public.material_categories   enable row level security;
alter table public.materials             enable row level security;
alter table public.product_families      enable row level security;
alter table public.product_types         enable row level security;
alter table public.product_fields        enable row level security;
alter table public.projects              enable row level security;
alter table public.locations             enable row level security;
alter table public.rooms                 enable row level security;
alter table public.measurements          enable row level security;
alter table public.measurement_items     enable row level security;
alter table public.item_field_values     enable row level security;
alter table public.item_photos           enable row level security;
alter table public.item_notes            enable row level security;
alter table public.item_audio            enable row level security;
alter table public.item_parts            enable row level security;
alter table public.production_orders     enable row level security;
alter table public.production_order_items enable row level security;
alter table public.workflow_history      enable row level security;
alter table public.doc_counters          enable row level security;

-- ---------------------------------------------------------------------
-- Usuarios y roles
-- ---------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (true);
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated using (true);
drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all on public.user_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Catálogos: lectura para todos, escritura sólo administrador
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'workflow_statuses', 'photo_categories', 'material_categories', 'materials',
    'product_families', 'product_types', 'product_fields'
  ] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_admin_all on public.%1$s', t);
    execute format(
      'create policy %1$s_admin_all on public.%1$s for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Obras
-- ---------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (public.project_is_readable(id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.is_admin() or public.has_role('supervisor'));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.is_admin() or public.has_role('supervisor'))
  with check (public.is_admin() or public.has_role('supervisor'));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Estructura (unidades / ambientes)
-- ---------------------------------------------------------------------
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations
  for select to authenticated using (public.project_is_readable(project_id));
drop policy if exists locations_write on public.locations;
create policy locations_write on public.locations
  for all to authenticated
  using (public.project_is_writable(project_id))
  with check (public.project_is_writable(project_id));

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated using (
    exists (select 1 from public.locations l
             where l.id = location_id and public.project_is_readable(l.project_id))
  );
drop policy if exists rooms_write on public.rooms;
create policy rooms_write on public.rooms
  for all to authenticated
  using (exists (select 1 from public.locations l
                  where l.id = location_id and public.project_is_writable(l.project_id)))
  with check (exists (select 1 from public.locations l
                       where l.id = location_id and public.project_is_writable(l.project_id)));

-- ---------------------------------------------------------------------
-- Relevamientos
-- ---------------------------------------------------------------------
drop policy if exists measurements_select on public.measurements;
create policy measurements_select on public.measurements
  for select to authenticated using (public.measurement_is_readable(id));
drop policy if exists measurements_insert on public.measurements;
create policy measurements_insert on public.measurements
  for insert to authenticated
  with check (
    (public.is_admin() or public.has_role('supervisor') or public.has_role('medidor'))
    and public.project_is_readable(project_id)
  );
-- El USING habilita la fila; el trigger valida qué transición puede hacer cada rol.
drop policy if exists measurements_update on public.measurements;
create policy measurements_update on public.measurements
  for update to authenticated
  using (
    public.is_admin()
    or public.has_role('supervisor')
    or (public.has_role('medidor')
        and (assigned_to = auth.uid() or created_by = auth.uid()))
  )
  with check (
    public.is_admin()
    or public.has_role('supervisor')
    or (public.has_role('medidor')
        and (assigned_to = auth.uid() or created_by = auth.uid()))
  );
drop policy if exists measurements_delete on public.measurements;
create policy measurements_delete on public.measurements
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Ítems y contenido del relevamiento
-- ---------------------------------------------------------------------
drop policy if exists measurement_items_select on public.measurement_items;
create policy measurement_items_select on public.measurement_items
  for select to authenticated using (public.measurement_is_readable(measurement_id));
drop policy if exists measurement_items_write on public.measurement_items;
create policy measurement_items_write on public.measurement_items
  for all to authenticated
  using (public.measurement_is_editable(measurement_id))
  with check (public.measurement_is_editable(measurement_id));

do $$
declare t text;
begin
  foreach t in array array[
    'item_field_values', 'item_photos', 'item_notes', 'item_audio', 'item_parts'
  ] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated
         using (public.item_is_readable(item_id))', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format(
      'create policy %1$s_write on public.%1$s for all to authenticated
         using (public.item_is_editable(item_id))
         with check (public.item_is_editable(item_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Órdenes de producción
-- ---------------------------------------------------------------------
drop policy if exists production_orders_select on public.production_orders;
create policy production_orders_select on public.production_orders
  for select to authenticated using (
    public.can_read_all() or public.is_production() or public.project_is_readable(project_id)
  );
drop policy if exists production_orders_insert on public.production_orders;
create policy production_orders_insert on public.production_orders
  for insert to authenticated
  with check (
    (public.is_admin() or public.has_role('supervisor'))
    and exists (select 1 from public.measurements m
                 where m.id = measurement_id and m.status in ('aprobado', 'orden_generada'))
  );
drop policy if exists production_orders_update on public.production_orders;
create policy production_orders_update on public.production_orders
  for update to authenticated
  using (public.is_admin() or public.has_role('supervisor') or public.is_production())
  with check (public.is_admin() or public.has_role('supervisor') or public.is_production());
drop policy if exists production_orders_delete on public.production_orders;
create policy production_orders_delete on public.production_orders
  for delete to authenticated using (public.is_admin());

drop policy if exists production_order_items_select on public.production_order_items;
create policy production_order_items_select on public.production_order_items
  for select to authenticated using (
    exists (select 1 from public.production_orders o
             where o.id = order_id
               and (public.can_read_all() or public.is_production()
                    or public.project_is_readable(o.project_id)))
  );
drop policy if exists production_order_items_insert on public.production_order_items;
create policy production_order_items_insert on public.production_order_items
  for insert to authenticated
  with check (public.is_admin() or public.has_role('supervisor'));
drop policy if exists production_order_items_delete on public.production_order_items;
create policy production_order_items_delete on public.production_order_items
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Historial: se escribe, no se edita ni se borra (sin policies de update/delete).
-- ---------------------------------------------------------------------
drop policy if exists workflow_history_select on public.workflow_history;
create policy workflow_history_select on public.workflow_history
  for select to authenticated using (
    public.can_read_all()
    or (measurement_id is not null and public.measurement_is_readable(measurement_id))
    or (project_id is not null and public.project_is_readable(project_id))
  );
drop policy if exists workflow_history_insert on public.workflow_history;
create policy workflow_history_insert on public.workflow_history
  for insert to authenticated with check (actor_id = auth.uid());

-- doc_counters queda sin policies: sólo accesible vía next_doc_number (security definer).

-- =====================================================================
-- ReikiMG · 0003 · Storage privado para fotos y audios
-- Convención de ruta: {measurement_id}/{item_id}/{archivo}
-- El primer segmento permite resolver permisos sin joins adicionales.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('item-photos', 'item-photos', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('item-audio', 'item-audio', false, 26214400,
   array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_measurement_id(p_name text)
returns uuid language plpgsql immutable as $$
begin
  return ((storage.foldername(p_name))[1])::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists "reikimg_media_select" on storage.objects;
create policy "reikimg_media_select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('item-photos', 'item-audio')
    and public.measurement_is_readable(public.storage_measurement_id(name))
  );

drop policy if exists "reikimg_media_insert" on storage.objects;
create policy "reikimg_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('item-photos', 'item-audio')
    and public.measurement_is_editable(public.storage_measurement_id(name))
  );

drop policy if exists "reikimg_media_update" on storage.objects;
create policy "reikimg_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('item-photos', 'item-audio')
    and public.measurement_is_editable(public.storage_measurement_id(name))
  );

drop policy if exists "reikimg_media_delete" on storage.objects;
create policy "reikimg_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('item-photos', 'item-audio')
    and public.measurement_is_editable(public.storage_measurement_id(name))
  );

-- =====================================================================
-- ReikiMG · 0004 · Catálogos iniciales
-- Todo lo que se carga acá es editable después desde Administración.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Etiquetas de estado
-- ---------------------------------------------------------------------
insert into public.workflow_statuses (scope, code, label, color, sort_order) values
  ('project', 'pendiente',      'Pendiente',      'slate',  10),
  ('project', 'en_medicion',    'En medición',    'blue',   20),
  ('project', 'relevado',       'Relevado',       'cyan',   30),
  ('project', 'a_revisar',      'A revisar',      'amber',  40),
  ('project', 'corregir',       'Corregir',       'red',    50),
  ('project', 'aprobado',       'Aprobado',       'green',  60),
  ('project', 'en_produccion',  'En producción',  'violet', 70),
  ('project', 'finalizado',     'Finalizado',     'zinc',   80),
  ('measurement', 'en_curso',       'En curso',        'blue',   10),
  ('measurement', 'a_revisar',      'A revisar',       'amber',  20),
  ('measurement', 'corregir',       'Corregir',        'red',    30),
  ('measurement', 'aprobado',       'Aprobado',        'green',  40),
  ('measurement', 'orden_generada', 'Orden generada',  'violet', 50),
  ('measurement', 'anulado',        'Anulado',         'zinc',   60),
  ('order', 'generada',      'Generada',      'blue',   10),
  ('order', 'en_produccion', 'En producción', 'violet', 20),
  ('order', 'finalizada',    'Finalizada',    'green',  30),
  ('order', 'anulada',       'Anulada',       'zinc',   40)
on conflict (scope, code) do nothing;

-- ---------------------------------------------------------------------
-- Categorías de fotografía
-- ---------------------------------------------------------------------
insert into public.photo_categories (code, label, sort_order) values
  ('general',   'Vista general',     10),
  ('lat_izq',   'Lateral izquierdo', 20),
  ('lat_der',   'Lateral derecho',   30),
  ('piso',      'Piso',              40),
  ('techo',     'Techo',             50),
  ('detalle',   'Detalle',           60),
  ('croquis',   'Croquis',           70),
  ('otro',      'Otro',              80)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Catálogos de materiales
-- ---------------------------------------------------------------------
insert into public.material_categories (key, name, description, sort_order) values
  ('tipo_vidrio', 'Tipos de vidrio', 'Templado, laminado, float, etc.',        10),
  ('espesor',     'Espesores',       'Espesor de vidrio en milímetros',        20),
  ('color',       'Colores',         'Colores de herrajes, perfiles y vidrio', 30),
  ('terminacion', 'Terminaciones',   'Terminación de canto y superficie',      40),
  ('perfileria',  'Perfilería',      'Perfiles de aluminio y accesorios',      50),
  ('herraje',     'Herrajes',        'Herrajes y accesorios',                  60),
  ('material',    'Otros materiales','Siliconas, burletes, fijaciones',        70)
on conflict (key) do nothing;

insert into public.materials (category_id, code, name, sort_order)
select c.id, v.code, v.name, v.sort_order
from (values
  ('tipo_vidrio', 'TPL',      'Templado incoloro',            10),
  ('tipo_vidrio', 'TPL-BR',   'Templado bronce',              20),
  ('tipo_vidrio', 'TPL-GR',   'Templado gris',                30),
  ('tipo_vidrio', 'TPL-SAT',  'Templado satinado / esmerilado',40),
  ('tipo_vidrio', 'LAM',      'Laminado 3+3',                 50),
  ('tipo_vidrio', 'LAM-44',   'Laminado 4+4',                 60),
  ('tipo_vidrio', 'FLOAT',    'Float incoloro',               70),
  ('tipo_vidrio', 'ESP',      'Espejo',                       80),
  ('tipo_vidrio', 'ESP-BR',   'Espejo bronce',                90),
  ('tipo_vidrio', 'DVH',      'DVH',                         100),
  ('espesor', '4',  '4 mm',  10),
  ('espesor', '5',  '5 mm',  20),
  ('espesor', '6',  '6 mm',  30),
  ('espesor', '8',  '8 mm',  40),
  ('espesor', '10', '10 mm', 50),
  ('espesor', '12', '12 mm', 60),
  ('color', 'NAT',   'Aluminio natural',  10),
  ('color', 'BLA',   'Blanco',            20),
  ('color', 'NEG',   'Negro',             30),
  ('color', 'NEG-M', 'Negro mate',        40),
  ('color', 'CRO',   'Cromado',           50),
  ('color', 'ACE',   'Acero inoxidable',  60),
  ('color', 'BRO',   'Bronce',            70),
  ('color', 'DOR',   'Dorado',            80),
  ('terminacion', 'PUL',  'Canto pulido',       10),
  ('terminacion', 'BIS',  'Bisel',              20),
  ('terminacion', 'MAT',  'Mateado',            30),
  ('terminacion', 'SIN',  'Sin terminación',    40),
  ('perfileria', 'U-20',   'Perfil U 20x20',        10),
  ('perfileria', 'U-25',   'Perfil U 25x25',        20),
  ('perfileria', 'ANG-30', 'Ángulo 30x30',          30),
  ('perfileria', 'TUB-40', 'Tubo 40x40',            40),
  ('perfileria', 'BAR-PAS','Pasamanos barandas',    50),
  ('herraje', 'BIS-VV',  'Bisagra vidrio-vidrio',      10),
  ('herraje', 'BIS-PV',  'Bisagra pared-vidrio',       20),
  ('herraje', 'TIR-30',  'Tirador 300 mm',             30),
  ('herraje', 'TIR-60',  'Tirador 600 mm',             40),
  ('herraje', 'CER-PP',  'Cerradura puerta de vidrio', 50),
  ('herraje', 'KIT-COR', 'Kit corredizo',              60),
  ('herraje', 'ARA-4',   'Araña 4 puntas',             70),
  ('herraje', 'BOT-REG', 'Botón regulable',            80),
  ('material', 'SIL-NEU', 'Silicona neutra',        10),
  ('material', 'SIL-EST', 'Silicona estructural',   20),
  ('material', 'BUR-U',   'Burlete U',              30),
  ('material', 'BUR-H',   'Burlete H',              40),
  ('material', 'TAR-8',   'Tarugo + tornillo 8 mm', 50)
) as v (cat_key, code, name, sort_order)
join public.material_categories c on c.key = v.cat_key
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Familias y productos
-- ---------------------------------------------------------------------
insert into public.product_families (code, name, icon, sort_order) values
  ('frentes',     'Frentes',                     'frente',     10),
  ('templado',    'Sistemas de cristal templado','templado',   20),
  ('mamparas',    'Mamparas',                    'mampara',    30),
  ('barandas',    'Barandas',                    'baranda',    40),
  ('espejos',     'Espejos',                     'espejo',     50),
  ('vidrios',     'Vidrios',                     'vidrio',     60),
  ('cerramientos','Cerramientos vidriados',      'cerramiento',70),
  ('techos',      'Techos vidriados',            'techo',      80),
  ('especiales',  'Trabajos especiales',         'especial',   90)
on conflict (code) do nothing;

insert into public.product_types (family_id, code, name, requires_depth, sort_order)
select f.id, v.code, v.name, v.requires_depth, v.sort_order
from (values
  ('frentes',     'frente_vidriado',   'Frente vidriado',          false, 10),
  ('templado',    'sistema_templado',  'Sistema de cristal templado', false, 10),
  ('mamparas',    'mampara_fija',      'Mampara fija',             false, 10),
  ('mamparas',    'mampara_corrediza', 'Mampara corrediza',        false, 20),
  ('mamparas',    'mampara_batiente',  'Mampara batiente',         false, 30),
  ('barandas',    'baranda_vidrio',    'Baranda de vidrio',        false, 10),
  ('espejos',     'espejo',            'Espejo',                   false, 10),
  ('vidrios',     'vidrio_simple',     'Vidrio simple',            false, 10),
  ('cerramientos','cerramiento',       'Cerramiento vidriado',     true,  10),
  ('techos',      'techo_vidriado',    'Techo vidriado',           false, 10),
  ('especiales',  'trabajo_especial',  'Trabajo especial',         true,  10)
) as v (family_code, code, name, requires_depth, sort_order)
join public.product_families f on f.code = v.family_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Campos dinámicos por producto
-- Cantidad, ancho, alto, profundidad y observaciones son campos base del
-- ítem y se muestran siempre; acá se define lo específico de cada producto.
-- ---------------------------------------------------------------------
create or replace function public._seed_field(
  p_product text, p_key text, p_label text, p_type public.field_type,
  p_section text, p_sort integer,
  p_unit text default null, p_options jsonb default null,
  p_catalog text default null, p_required boolean default false
) returns void language plpgsql as $$
begin
  insert into public.product_fields (
    product_type_id, field_key, label, field_type, section, unit,
    options, catalog_key, is_required, sort_order)
  select pt.id, p_key, p_label, p_type, p_section, p_unit,
         p_options, p_catalog, p_required, p_sort
  from public.product_types pt
  where pt.code = p_product
  on conflict (product_type_id, field_key) do nothing;
end;
$$;

-- Mampara (los tres tipos comparten definición)
do $$
declare p text;
begin
  foreach p in array array['mampara_fija', 'mampara_corrediza', 'mampara_batiente'] loop
    perform public._seed_field(p, 'tipo_vidrio',    'Tipo de vidrio',     'catalog', 'Vidrio', 10, null, null, 'tipo_vidrio', true);
    perform public._seed_field(p, 'espesor',        'Espesor',            'catalog', 'Vidrio', 20, 'mm', null, 'espesor', true);
    perform public._seed_field(p, 'color_herrajes', 'Color de herrajes',  'catalog', 'Herrajes', 30, null, null, 'color');
    perform public._seed_field(p, 'tipo_herrajes',  'Tipo de herrajes',   'catalog', 'Herrajes', 40, null, null, 'herraje');
    perform public._seed_field(p, 'tipo_fijacion',  'Tipo de fijación',   'select',  'Montaje', 50, null,
      '["A pared","A piso","Pared y piso","A techo","Perfil U","Botones"]'::jsonb);
    perform public._seed_field(p, 'apertura',       'Apertura',           'select',  'Montaje', 60, null,
      '["Fija","Corrediza","Batiente izquierda","Batiente derecha","Plegable"]'::jsonb);
  end loop;
end;
$$;

-- Espejo
select public._seed_field('espejo', 'tipo_vidrio',   'Tipo de espejo',   'catalog', 'Vidrio', 10, null, null, 'tipo_vidrio', true);
select public._seed_field('espejo', 'espesor',       'Espesor',          'catalog', 'Vidrio', 20, 'mm', null, 'espesor', true);
select public._seed_field('espejo', 'tipo_canto',    'Tipo de canto',    'catalog', 'Terminación', 30, null, null, 'terminacion');
select public._seed_field('espejo', 'perforaciones', 'Perforaciones',    'number',  'Terminación', 40, 'u');
select public._seed_field('espejo', 'detalle_perforaciones', 'Detalle de perforaciones', 'text', 'Terminación', 50);
select public._seed_field('espejo', 'led',           'LED',              'boolean', 'Extras', 60);
select public._seed_field('espejo', 'touch',         'Touch',            'boolean', 'Extras', 70);

-- Frente vidriado
select public._seed_field('frente_vidriado', 'cantidad_panos',  'Cantidad de paños',  'number', 'Configuración', 10, 'u', null, null, true);
select public._seed_field('frente_vidriado', 'panos_fijos',     'Paños fijos',        'number', 'Configuración', 20, 'u');
select public._seed_field('frente_vidriado', 'panos_moviles',   'Paños móviles',      'number', 'Configuración', 30, 'u');
select public._seed_field('frente_vidriado', 'ubicacion_puerta','Ubicación de puerta','select', 'Puerta', 40, null,
  '["Izquierda","Centro","Derecha","Sin puerta"]'::jsonb);
select public._seed_field('frente_vidriado', 'ancho_puerta',    'Ancho de puerta',    'number', 'Puerta', 50, 'mm');
select public._seed_field('frente_vidriado', 'sentido_apertura','Sentido de apertura','select', 'Puerta', 60, null,
  '["Hacia afuera","Hacia adentro","Doble acción","Corrediza"]'::jsonb);
select public._seed_field('frente_vidriado', 'tipo_vidrio',     'Tipo de vidrio',     'catalog','Vidrio', 70, null, null, 'tipo_vidrio', true);
select public._seed_field('frente_vidriado', 'espesor',         'Espesor',            'catalog','Vidrio', 80, 'mm', null, 'espesor', true);
select public._seed_field('frente_vidriado', 'tipo_herrajes',   'Tipo de herrajes',   'catalog','Herrajes', 90, null, null, 'herraje');
select public._seed_field('frente_vidriado', 'terminacion',     'Terminación',        'catalog','Terminación', 100, null, null, 'terminacion');

-- Sistema de cristal templado
select public._seed_field('sistema_templado', 'cantidad_panos',   'Cantidad de paños',       'number',  'Configuración', 10, 'u', null, null, true);
select public._seed_field('sistema_templado', 'configuracion',    'Configuración del sistema','select', 'Configuración', 20, null,
  '["Fijo","Fijo + puerta","Puerta doble","Corredizo","Plegable","Escaparate","Otro"]'::jsonb);
select public._seed_field('sistema_templado', 'posicion_panos',   'Posición de paños fijos y móviles', 'textarea', 'Configuración', 30);
select public._seed_field('sistema_templado', 'puerta',           'Puerta',                  'select',  'Puerta', 40, null,
  '["Sin puerta","Simple","Doble","Corrediza"]'::jsonb);
select public._seed_field('sistema_templado', 'sentido_apertura', 'Sentido de apertura',     'select',  'Puerta', 50, null,
  '["Hacia afuera","Hacia adentro","Doble acción","Corrediza"]'::jsonb);
select public._seed_field('sistema_templado', 'tipo_vidrio',      'Tipo de vidrio',          'catalog', 'Vidrio', 60, null, null, 'tipo_vidrio', true);
select public._seed_field('sistema_templado', 'espesor',          'Espesor',                 'catalog', 'Vidrio', 70, 'mm', null, 'espesor', true);
select public._seed_field('sistema_templado', 'color_accesorios', 'Color de accesorios',     'catalog', 'Herrajes', 80, null, null, 'color');
select public._seed_field('sistema_templado', 'tipo_herrajes',    'Tipo de herrajes',        'catalog', 'Herrajes', 90, null, null, 'herraje');
select public._seed_field('sistema_templado', 'fijaciones',       'Fijaciones',              'select',  'Montaje', 100, null,
  '["Perfil U piso","Perfil U techo","Botones","Araña","Pinzas","Mixta"]'::jsonb);
select public._seed_field('sistema_templado', 'obs_tecnicas',     'Observaciones técnicas',  'textarea','Montaje', 110);

-- Baranda
select public._seed_field('baranda_vidrio', 'cantidad_panos', 'Cantidad de paños', 'number',  'Configuración', 10, 'u');
select public._seed_field('baranda_vidrio', 'tipo_vidrio',    'Tipo de vidrio',    'catalog', 'Vidrio', 20, null, null, 'tipo_vidrio', true);
select public._seed_field('baranda_vidrio', 'espesor',        'Espesor',           'catalog', 'Vidrio', 30, 'mm', null, 'espesor', true);
select public._seed_field('baranda_vidrio', 'tipo_fijacion',  'Tipo de fijación',  'select',  'Montaje', 40, null,
  '["Perfil U a piso","Perfil U lateral","Botones","Pinzas","Anclaje a losa"]'::jsonb);
select public._seed_field('baranda_vidrio', 'pasamanos',      'Pasamanos',         'select',  'Montaje', 50, null,
  '["Sin pasamanos","Superior","Perimetral","Tubo redondo","Tubo cuadrado"]'::jsonb);
select public._seed_field('baranda_vidrio', 'color',          'Color',             'catalog', 'Terminación', 60, null, null, 'color');

-- Vidrio simple
select public._seed_field('vidrio_simple', 'tipo_vidrio',   'Tipo de vidrio', 'catalog', 'Vidrio', 10, null, null, 'tipo_vidrio', true);
select public._seed_field('vidrio_simple', 'espesor',       'Espesor',        'catalog', 'Vidrio', 20, 'mm', null, 'espesor', true);
select public._seed_field('vidrio_simple', 'tipo_canto',    'Tipo de canto',  'catalog', 'Terminación', 30, null, null, 'terminacion');
select public._seed_field('vidrio_simple', 'perforaciones', 'Perforaciones',  'number',  'Terminación', 40, 'u');

-- Cerramiento vidriado
select public._seed_field('cerramiento', 'cantidad_panos', 'Cantidad de paños', 'number',  'Configuración', 10, 'u');
select public._seed_field('cerramiento', 'tipo_apertura',  'Tipo de apertura',  'select',  'Configuración', 20, null,
  '["Fijo","Corredizo","Batiente","Plegable","Guillotina"]'::jsonb);
select public._seed_field('cerramiento', 'tipo_vidrio',    'Tipo de vidrio',    'catalog', 'Vidrio', 30, null, null, 'tipo_vidrio', true);
select public._seed_field('cerramiento', 'espesor',        'Espesor',           'catalog', 'Vidrio', 40, 'mm', null, 'espesor', true);
select public._seed_field('cerramiento', 'perfileria',     'Perfilería',        'catalog', 'Perfilería', 50, null, null, 'perfileria');
select public._seed_field('cerramiento', 'color',          'Color',             'catalog', 'Terminación', 60, null, null, 'color');

-- Techo vidriado
select public._seed_field('techo_vidriado', 'cantidad_panos', 'Cantidad de paños', 'number',  'Configuración', 10, 'u');
select public._seed_field('techo_vidriado', 'estructura',     'Estructura',        'select',  'Configuración', 20, null,
  '["Hierro","Aluminio","Madera","Sin estructura"]'::jsonb);
select public._seed_field('techo_vidriado', 'pendiente',      'Pendiente',         'text',    'Configuración', 30, '%');
select public._seed_field('techo_vidriado', 'tipo_vidrio',    'Tipo de vidrio',    'catalog', 'Vidrio', 40, null, null, 'tipo_vidrio', true);
select public._seed_field('techo_vidriado', 'espesor',        'Espesor',           'catalog', 'Vidrio', 50, 'mm', null, 'espesor', true);

-- Trabajo especial
select public._seed_field('trabajo_especial', 'descripcion_trabajo', 'Descripción del trabajo', 'textarea', 'Configuración', 10, null, null, null, true);
select public._seed_field('trabajo_especial', 'tipo_vidrio',         'Tipo de vidrio',          'catalog',  'Vidrio', 20, null, null, 'tipo_vidrio');
select public._seed_field('trabajo_especial', 'espesor',             'Espesor',                 'catalog',  'Vidrio', 30, 'mm', null, 'espesor');

drop function public._seed_field(text, text, text, public.field_type, text, integer, text, jsonb, text, boolean);

