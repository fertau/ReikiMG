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
