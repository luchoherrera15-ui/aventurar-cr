-- ============================================================
-- AVENTUREA CR — Ubicación en el mapa y búsqueda por zona
--
-- 1. Coordenadas del negocio, para armar los links de "Cómo
--    llegar" de Google Maps y Waze. No hace falta la API de
--    Google: ambos aceptan URLs públicas con lat/lng.
--
-- 2. `mapa_url` guarda el link que pegó el dueño tal cual, para
--    poder mostrarlo si algún día no se pudieron sacar las
--    coordenadas.
--
-- El cantón sigue siendo texto libre a propósito: las filas que
-- ya existen tienen lo que el dueño escribió a mano, y forzar
-- una lista cerrada las dejaría fuera. El formulario sí ofrece
-- la lista oficial, así lo nuevo entra normalizado.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos add column if not exists latitud numeric;
alter table ranchos add column if not exists longitud numeric;
alter table ranchos add column if not exists mapa_url text;

-- Rango válido de coordenadas, por si alguien pega cualquier cosa.
alter table ranchos drop constraint if exists ranchos_latitud_check;
alter table ranchos add constraint ranchos_latitud_check
  check (latitud is null or (latitud >= -90 and latitud <= 90));

alter table ranchos drop constraint if exists ranchos_longitud_check;
alter table ranchos add constraint ranchos_longitud_check
  check (longitud is null or (longitud >= -180 and longitud <= 180));

-- Para filtrar el directorio por zona sin escanear toda la tabla.
create index if not exists ranchos_canton_idx on ranchos (canton);

notify pgrst, 'reload schema';
