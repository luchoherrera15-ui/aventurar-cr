-- ============================================================
-- AVENTUREA CR — El directorio deja de ser solo de ranchos: ahora
-- cada publicación tiene una categoría (salón, mobiliario, DJ,
-- animadores, revelaciones de sexo, etc.), para armar un
-- marketplace completo de servicios para eventos.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos
  add column if not exists categoria text not null default 'salon';

alter table ranchos drop constraint if exists ranchos_categoria_check;
alter table ranchos add constraint ranchos_categoria_check
  check (categoria in ('salon', 'mobiliario', 'dj', 'animador', 'revelacion_sexo', 'otro'));

create index if not exists ranchos_categoria_idx on ranchos (categoria);
