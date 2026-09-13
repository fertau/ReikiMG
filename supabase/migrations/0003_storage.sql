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
