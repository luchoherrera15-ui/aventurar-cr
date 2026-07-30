-- ============================================================
-- BOOKEA — Alta de hospedajes + país y zona horaria (0062)
--
-- 1. Categorías de la vertical de Hospedajes en el check de
--    ranchos.categoria (la columna vertical ya acepta 'hospedajes'
--    desde la 0055 — el bloqueo era solo de aplicación).
-- 2. País y zona horaria por negocio: arrancamos solo con Costa
--    Rica, pero el esquema queda listo para el mundo — cada negocio
--    guarda su país (ISO-3166 alpha-2) y su zona horaria IANA, y los
--    motores de horarios la leerán de acá en vez de asumir CR.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos drop constraint if exists ranchos_categoria_check;
alter table ranchos add constraint ranchos_categoria_check
  check (categoria in (
    -- Eventos
    'lugares', 'alimentacion', 'animacion',
    'organizacion', 'decoracion', 'otros',
    -- Citas ('otros' es compartida)
    'belleza', 'barberia', 'unas', 'spa', 'consultorio',
    -- Hospedajes
    'casa', 'villa', 'hotel', 'cabana', 'apartamento', 'experiencia'
  ));

alter table ranchos add column if not exists pais text not null default 'CR'
  check (char_length(pais) = 2);
alter table ranchos add column if not exists zona_horaria text not null
  default 'America/Costa_Rica';

create index if not exists ranchos_pais_idx on ranchos (pais);
