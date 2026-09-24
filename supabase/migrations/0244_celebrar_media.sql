-- ═══════════════════════════════════════════════════════════════════
--  CELEBRAR — 0244 · el bucket de medios (música y audio de la invitación)
-- ═══════════════════════════════════════════════════════════════════
--
-- Las FOTOS de CELEBRAR van por Cloudflare Images (subida directa desde
-- el navegador). La MÚSICA no: Cloudflare Images solo acepta imágenes.
-- Este bucket público guarda la canción de cada invitación en la
-- carpeta de su celebración: `<celebracion_id>/musica-<marca>.mp3`.
--
-- Reglas:
--   · cualquiera LEE (la invitación pública reproduce la canción);
--   · solo la dueña de la celebración ESCRIBE en su carpeta
--     (la carpeta es el primer segmento de la ruta y tiene que ser el id
--     de una celebración suya — `celebrar_es_duena`, de la 0242);
--   · 12 MB por archivo y solo tipos de audio, en el bucket mismo.
--
-- Aditiva e idempotente. No toca ningún bucket ni tabla existente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'celebrar-media',
  'celebrar-media',
  true,
  12 * 1024 * 1024,
  array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-m4a']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- La carpeta (primer segmento de la ruta) tiene que ser una celebración
-- de quien sube. `storage.foldername(name)` devuelve los segmentos de
-- carpeta; el primero es el id.
create or replace function public.celebrar_carpeta_es_mia(p_nombre text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  begin
    v_id := (storage.foldername(p_nombre))[1]::uuid;
  exception when others then
    return false;
  end;
  return public.celebrar_es_duena(v_id);
end;
$$;

revoke all on function public.celebrar_carpeta_es_mia(text) from public;
grant execute on function public.celebrar_carpeta_es_mia(text) to authenticated;

drop policy if exists "Cualquiera escucha la música de CELEBRAR" on storage.objects;
create policy "Cualquiera escucha la música de CELEBRAR"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'celebrar-media');

drop policy if exists "La dueña sube música a su celebración" on storage.objects;
create policy "La dueña sube música a su celebración"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'celebrar-media' and public.celebrar_carpeta_es_mia(name));

drop policy if exists "La dueña reemplaza la música de su celebración" on storage.objects;
create policy "La dueña reemplaza la música de su celebración"
  on storage.objects for update to authenticated
  using (bucket_id = 'celebrar-media' and public.celebrar_carpeta_es_mia(name))
  with check (bucket_id = 'celebrar-media' and public.celebrar_carpeta_es_mia(name));

drop policy if exists "La dueña borra la música de su celebración" on storage.objects;
create policy "La dueña borra la música de su celebración"
  on storage.objects for delete to authenticated
  using (bucket_id = 'celebrar-media' and public.celebrar_carpeta_es_mia(name));
