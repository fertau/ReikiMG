-- =====================================================================
-- ReikiMG · 0005 · Primer administrador
--
-- El alta de usuarios desde la aplicación exige un administrador, así que
-- el primero se crea a mano una sola vez:
--
--   1. Supabase Dashboard > Authentication > Users > Add user
--      (email + contraseña, marcando "Auto Confirm User").
--   2. Reemplazar el email de abajo y ejecutar este archivo en el SQL Editor.
--
-- A partir de ahí, todas las altas se hacen desde Administración > Usuarios.
-- =====================================================================

do $$
declare
  v_email text := 'CAMBIAR@tu-empresa.com';  -- <<< reemplazar
  v_user  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);

  if v_user is null then
    raise exception 'No existe un usuario en auth.users con el email %. Crealo primero desde el panel de Supabase.', v_email;
  end if;

  insert into public.users (id, email, full_name)
  values (v_user, v_email, split_part(v_email, '@', 1))
  on conflict (id) do update set is_active = true;

  insert into public.user_roles (user_id, role)
  values (v_user, 'admin')
  on conflict (user_id, role) do nothing;

  raise notice 'Administrador configurado: %', v_email;
end;
$$;
