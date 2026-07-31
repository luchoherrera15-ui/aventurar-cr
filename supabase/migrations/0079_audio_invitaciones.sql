-- ============================================================
-- BOOKEA — Música en las invitaciones y archivos pesados
--
-- El generador solo aceptaba imágenes (4 MB) y videos (6 MB), y todo
-- viajaba en base64 dentro del POST: Vercel corta el body cerca de los
-- 4,5 MB, así que el techo real era ese. Ahora el navegador sube el
-- archivo DIRECTO al bucket y manda solo la URL, con lo que el límite
-- pasa a ser el del bucket.
--
--   1. audio_urls: la música de fondo de cada invitación.
--   2. El bucket público sube su techo a 100 MB.
--
-- OJO: el bucket manda solo si el tope global del proyecto es mayor.
-- En Supabase → Storage → Settings, "Upload file size limit" tiene que
-- estar en 100 MB o más; si el proyecto está en 50 MB, ese gana.
-- ============================================================

alter table invitaciones
  add column if not exists audio_urls text[] default array[]::text[];

comment on column invitaciones.audio_urls is
  'Música de fondo de la invitación: URLs públicas del bucket ranchos-fotos.';

update storage.buckets
   set file_size_limit = 104857600  -- 100 MB
 where id = 'ranchos-fotos';
