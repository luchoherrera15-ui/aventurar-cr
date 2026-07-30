-- ============================================================
-- BOOKEA — Generador de invitaciones con IA (0073)
--
-- Extensión a invitaciones (0066): almacena configuración de
-- generación (IA), historial de costos, y estado del proceso.
--
-- - `config_ia`: JSON con temática, personajes, animaciones,
--   efectos, modelo (Opus/Fable) elegido por el usuario.
-- - `imagenes_urls`, `videos_urls`: array de URLs de uploads.
-- - `prompt_generado`: el prompt final enviado a Claude.
-- - `costo_tokens_input/output`: conteo para historial.
-- - `costo_usd`: decimal con el costo real en USD.
-- - `modelo_usado`: "opus" | "fable".
-- - `estado_generacion`: "pendiente" | "generando" | "completado" | "error".
-- - `error_generacion`: mensaje si falla.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table invitaciones
  add column if not exists config_ia jsonb default null,
  add column if not exists imagenes_urls text[] default array[]::text[],
  add column if not exists videos_urls text[] default array[]::text[],
  add column if not exists prompt_generado text default null,
  add column if not exists costo_tokens_input int default null,
  add column if not exists costo_tokens_output int default null,
  add column if not exists costo_usd decimal(8, 4) default null,
  add column if not exists modelo_usado text default null,
  add column if not exists estado_generacion text default null
    check (estado_generacion is null or estado_generacion in ('pendiente', 'generando', 'completado', 'error')),
  add column if not exists error_generacion text default null,
  add column if not exists tiempo_generacion_ms int default null;

-- Índice para búsquedas por estado de generación (para el panel del creador).
create index if not exists invitaciones_estado_gen_idx
  on invitaciones (cliente_id, estado_generacion)
  where estado_generacion is not null;
