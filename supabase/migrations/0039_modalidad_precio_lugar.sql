-- ------------------------------------------------------------
-- Modalidad de cobro para Lugares: hasta ahora la única forma era
-- rangos de precio por cantidad de invitados (precio_tiers), y si el
-- número de invitados caía en un hueco entre rangos, salía "Cotización
-- personalizada" — confuso para el cliente y para el dueño, que no
-- tenía forma de decir "yo cobro por hora" o "yo cobro un fijo".
--
-- Ahora el dueño elige una de tres modalidades desde su panel:
--   - rango_personas: los rangos de siempre (precio_tiers), sin cambios.
--   - hora: un precio fijo por hora (precio_hora_lugar).
--   - fijo: un precio único para todo el evento (precio_fijo_lugar).
-- El sitio público refleja automáticamente la que el dueño configuró.
-- ------------------------------------------------------------

alter table ranchos
  add column if not exists modalidad_precio_lugar text not null default 'rango_personas'
    check (modalidad_precio_lugar in ('rango_personas', 'hora', 'fijo'));

alter table ranchos add column if not exists precio_hora_lugar numeric check (precio_hora_lugar is null or precio_hora_lugar >= 0);
alter table ranchos add column if not exists precio_fijo_lugar numeric check (precio_fijo_lugar is null or precio_fijo_lugar >= 0);

notify pgrst, 'reload schema';
