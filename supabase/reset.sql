-- =====================================================================
-- ReikiMG · Reseteo
--
-- Borra TODO lo que crean las migraciones y deja el proyecto como estaba.
-- Sirve cuando una migración quedó a medias ("type ... already exists",
-- "relation ... already exists") y hay que reintentar desde cero.
--
-- Se puede correr aunque el esquema esté incompleto: todo va con IF EXISTS.
--
-- ⚠️  BORRA LOS DATOS. Correr sólo sobre un proyecto que todavía no está
--     en uso. Después, ejecutar migraciones-completas.sql otra vez.
-- =====================================================================

-- 1. Trigger sobre auth.users (vive fuera del esquema public)
drop trigger if exists on_auth_user_created on auth.users;

-- 2. Políticas de Storage
--
-- Sólo se quitan las políticas. Los buckets NO se borran acá: Supabase
-- bloquea el DELETE directo sobre storage.buckets y storage.objects
-- (trigger storage.protect_delete), y hay que usar la Storage API o el
-- panel. Tampoco hace falta: 0003 los recrea con ON CONFLICT DO UPDATE,
-- así que un bucket ya existente se actualiza en lugar de fallar.
drop policy if exists "reikimg_media_select" on storage.objects;
drop policy if exists "reikimg_media_insert" on storage.objects;
drop policy if exists "reikimg_media_update" on storage.objects;
drop policy if exists "reikimg_media_delete" on storage.objects;

-- 3. Tablas (cascade arrastra índices, triggers y claves foráneas)
drop table if exists public.workflow_history        cascade;
drop table if exists public.production_order_items  cascade;
drop table if exists public.production_orders       cascade;
drop table if exists public.item_parts              cascade;
drop table if exists public.item_audio              cascade;
drop table if exists public.item_notes              cascade;
drop table if exists public.item_photos             cascade;
drop table if exists public.item_field_values       cascade;
drop table if exists public.measurement_items       cascade;
drop table if exists public.measurements            cascade;
drop table if exists public.rooms                   cascade;
drop table if exists public.locations               cascade;
drop table if exists public.projects                cascade;
drop table if exists public.product_fields          cascade;
drop table if exists public.product_types           cascade;
drop table if exists public.product_families        cascade;
drop table if exists public.materials               cascade;
drop table if exists public.material_categories     cascade;
drop table if exists public.photo_categories        cascade;
drop table if exists public.workflow_statuses       cascade;
drop table if exists public.user_roles              cascade;
drop table if exists public.users                   cascade;
drop table if exists public.doc_counters            cascade;

-- 4. Funciones
drop function if exists public.storage_measurement_id        cascade;
drop function if exists public.measurements_sync_project_status cascade;
drop function if exists public.measurements_guard_transition cascade;
drop function if exists public.item_is_readable              cascade;
drop function if exists public.item_is_editable              cascade;
drop function if exists public.item_measurement_id           cascade;
drop function if exists public.measurement_is_editable       cascade;
drop function if exists public.measurement_is_readable       cascade;
drop function if exists public.project_is_writable           cascade;
drop function if exists public.project_is_readable           cascade;
drop function if exists public.is_production                 cascade;
drop function if exists public.can_read_all                  cascade;
drop function if exists public.is_admin                      cascade;
drop function if exists public.has_role                      cascade;
drop function if exists public.production_orders_set_number  cascade;
drop function if exists public.measurements_set_code         cascade;
drop function if exists public.projects_set_code             cascade;
drop function if exists public.handle_new_auth_user          cascade;
drop function if exists public.next_doc_number               cascade;
drop function if exists public.set_updated_at                cascade;
drop function if exists public._seed_field                   cascade;

-- 5. Tipos enumerados
drop type if exists public.field_type          cascade;
drop type if exists public.part_kind           cascade;
drop type if exists public.location_kind       cascade;
drop type if exists public.order_status        cascade;
drop type if exists public.measurement_status  cascade;
drop type if exists public.project_status      cascade;
drop type if exists public.app_role            cascade;

-- Verificación: las tres columnas tienen que dar 0.
select
  (select count(*) from pg_tables
     where schemaname = 'public'
       and tablename in ('users','projects','measurements','measurement_items')) as tablas,
  (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typname in ('app_role','project_status','measurement_status'))      as tipos,
  (select count(*) from pg_policies where schemaname = 'storage'
     and policyname like 'reikimg%')                                             as politicas_storage;
