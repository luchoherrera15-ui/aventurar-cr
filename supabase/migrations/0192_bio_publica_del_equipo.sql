
-- ============================================================
-- BOOKEA — Bio pública de cada persona del equipo (0192)
--
-- El dueño pidió que, en el app móvil, tocar a alguien en "Equipo"
-- abra una bio completa: sobre mí, títulos o acreditaciones, y
-- cuánta gente atendió. Hasta hoy `equipo_rancho` solo guardaba
-- nombre, rol y foto — nada de esto existía.
--
-- Dos piezas:
--
--   1. `equipo_rancho.bio` / `.titulos` — texto libre que el dueño
--      escribe desde el panel (Equipo → tocar a la persona). NULL en
--      los recursos que no son personas (tipo = 'espacio' | 'equipo'),
--      igual que `capacidad` queda NULL en los que sí lo son (0076).
--
--   2. La vista `estadisticas_miembro_citas` — "Atendidos: N personas"
--      y "Citas: N citas" por persona, en números agregados. Mismo
--      criterio de "atendida" que ya usa /api/citas/[id]/stats para el
--      total del negocio (confirmada, con hora, fecha ya pasada):
--      hoy esa cuenta existía SOLO agregada por negocio, no por
--      persona. Se resuelve con una vista, no con otro viaje al sitio:
--      el teléfono ya puede leer `reservas` filtrando por miembro a
--      través de una vista pública, igual que `disponibilidad_citas`
--      (0055) y `calificaciones_rancho` (0033) — ninguna fila de
--      `reservas` sale completa, solo el conteo agregado por columna.
--
-- No hay reseñas por persona: `resenas` (0033) es por `rancho_id`, no
-- por `miembro_id`. No se inventa esa columna acá — la bio muestra las
-- reseñas del NEGOCIO, que es el dato real que ya existe.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas nuevas en equipo_rancho
-- ------------------------------------------------------------

alter table equipo_rancho add column if not exists bio text;
alter table equipo_rancho drop constraint if exists equipo_rancho_bio_check;
alter table equipo_rancho add constraint equipo_rancho_bio_check
  check (bio is null or char_length(bio) <= 1000);

alter table equipo_rancho add column if not exists titulos text;
alter table equipo_rancho drop constraint if exists equipo_rancho_titulos_check;
alter table equipo_rancho add constraint equipo_rancho_titulos_check
  check (titulos is null or char_length(titulos) <= 600);

comment on column equipo_rancho.bio is
  '"Sobre mí" de la bio pública: texto libre que escribe el dueño. NULL en '
  'recursos que no son personas (tipo = espacio | equipo).';
comment on column equipo_rancho.titulos is
  'Títulos o acreditaciones de la bio pública, texto libre (una línea por '
  'título, se parte en el cliente). NULL en recursos que no son personas.';

-- Las políticas de la 0055 ya cubren estas columnas: lectura pública
-- del equipo de un negocio aprobado, y el dueño (o admin) administra
-- todo su equipo por entero (`for all`). No hace falta política nueva.

-- ------------------------------------------------------------
-- 2. Atendidos y citas, por persona — números agregados
-- ------------------------------------------------------------

create or replace view estadisticas_miembro_citas as
select
  e.id as miembro_id,
  e.rancho_id,
  count(r.id) as citas_atendidas,
  count(distinct coalesce(r.cliente_id::text, r.correo)) as personas_atendidas
from equipo_rancho e
left join reservas r
  on r.miembro_id = e.id
  and r.estado = 'confirmada'
  and r.hora_inicio is not null
  and r.fecha < (now() at time zone 'America/Costa_Rica')::date
group by e.id, e.rancho_id;

comment on view estadisticas_miembro_citas is
  'Cuántas citas atendió cada persona del equipo y cuántos clientes '
  'distintos, en números agregados (sin nombre, correo ni fecha de nadie). '
  'Mismo criterio de "atendida" que /api/citas/[id]/stats: confirmada, con '
  'hora, ya pasada.';

grant select on estadisticas_miembro_citas to anon, authenticated;

notify pgrst, 'reload schema';
