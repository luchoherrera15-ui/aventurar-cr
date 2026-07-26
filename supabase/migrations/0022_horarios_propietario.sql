-- ============================================================
-- AVENTUREA CR — Los horarios de alquiler los define el dueño
--
-- Hasta ahora la página tenía escritos a mano dos bloques de 6
-- horas ("mañana y tarde" / "tarde y noche"), que son los del
-- rancho de Aventurea y no tienen por qué ser los de nadie más.
-- Cada propietario define ahora sus propios bloques.
--
-- `horarios_bloques` guarda una lista como:
--   [{"id":"...","etiqueta":"Mañana","desde":"07:00","hasta":"13:00"}]
-- Vacía significa que ese negocio no maneja bloques y no se le
-- pregunta el horario al reservar.
--
-- En `reservas.horario_bloque` pasamos a guardar el texto del
-- bloque elegido, no un código fijo: así la reserva se sigue
-- leyendo igual aunque después el dueño cambie sus horarios.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos
  add column if not exists horarios_bloques jsonb not null default '[]'::jsonb;

alter table reservas drop constraint if exists reservas_horario_bloque_check;

notify pgrst, 'reload schema';
