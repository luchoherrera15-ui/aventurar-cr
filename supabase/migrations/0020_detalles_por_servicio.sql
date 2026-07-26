-- ============================================================
-- AVENTUREA CR — Campos propios de cada tipo de servicio
--
-- Un catering necesita decir el mínimo de personas y si lleva
-- vajilla; un DJ, cuántas horas y qué equipo trae; un negocio de
-- mobiliario, cuántas sillas tiene. Nada de eso aplica a los
-- demás, así que en vez de sumar 40 columnas que quedarían casi
-- siempre vacías, todo va en un solo jsonb.
--
-- Qué campos existen para cada categoría se define en el código
-- (src/app/mi-rancho/campos-servicio.ts) y se valida al guardar,
-- así agregar uno nuevo no necesita migración.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos add column if not exists detalles jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
