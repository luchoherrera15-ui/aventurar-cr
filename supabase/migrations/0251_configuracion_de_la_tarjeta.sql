-- 0251 · La bolsa de configuración de cada tarjeta (programa_lealtad.configuracion)
--
-- ⚠️ NO ESTÁ CORRIDA. Se escribió el 1 oct 2026 junto con los mensajes
-- automáticos de Foorkie y se pega a mano en el SQL Editor de Supabase.
-- Es aditiva e idempotente: si la columna ya existe (alguien la creó a
-- mano), no cambia nada. Sin ella el código anda igual (ver abajo).
--
-- ------------------------------------------------------------
-- POR QUÉ
-- ------------------------------------------------------------
-- Dos cosas leen y escriben `programa_lealtad.configuracion` (jsonb):
--
--   · el ritmo de los clientes del panel de Bookea (`ritmoDelPrograma`
--     y `guardarRitmo`, ago 2026), que la trata como «el jsonb libre que
--     ya existe»;
--   · los mensajes automáticos de las tarjetas de Foorkie (1 oct 2026,
--     `src/lib/plataforma/foorkie-mensajes.ts`), bajo la clave
--     `mensajes_automaticos`:
--       { "sumar":   { "activo": true, "texto": "¡Gracias por preferirnos!" },
--         "quitar":  { "activo": true, "texto": "Tu tarjeta se modificó." },
--         "canjear": { "activo": true, "texto": "¡Gracias! Disfrutá tu premio." } }
--
-- Pero NINGUNA migración del repo la crea. Si en la base no está, el
-- ritmo se lee siempre «semanal» y no se puede guardar, y los mensajes
-- de Foorkie salen con los textos de fábrica sin poder cambiarse (la
-- ruta `programa/mensajes/guardar` contesta `sin_migracion`). Esto la
-- asegura.
--
-- jsonb y no columnas sueltas por el mismo criterio que `poster_config`
-- (0132): es configuración que se lee entera y crece de a una perilla.
-- '{}' = todo de fábrica: los textos por defecto los pone el código, así
-- cambiar la redacción no pide migración.
--
-- Sin RLS nueva: vive dentro de `programa_lealtad`, con sus políticas de
-- siempre (0060). Escribe el servidor con la llave de servicio. Lo que
-- guarda no es sensible (un ritmo y tres textos que igual aparecen en los
-- pases de los clientes).

alter table public.programa_lealtad
  add column if not exists configuracion jsonb not null default '{}'::jsonb;

-- La forma: un objeto. Solo si la columna es jsonb (si alguien la creó a
-- mano con otro tipo, no se toca) y `not valid`: lo que ya esté escrito
-- no puede tumbar la migración; vale para lo que se escriba de acá en más.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'programa_lealtad'
       and column_name = 'configuracion'
       and data_type = 'jsonb'
  ) and not exists (
    select 1 from pg_constraint where conname = 'programa_lealtad_configuracion_obj'
  ) then
    alter table public.programa_lealtad
      add constraint programa_lealtad_configuracion_obj
      check (configuracion is null or jsonb_typeof(configuracion) = 'object') not valid;
  end if;
end $$;

comment on column public.programa_lealtad.configuracion is
  'Configuración libre de la tarjeta (0251): ritmo_clientes (panel de Bookea) y '
  'mensajes_automaticos (tarjetas de Foorkie: sumar, quitar, canjear con activo y texto, '
  'ver src/lib/plataforma/foorkie-mensajes.ts). {} = todo de fábrica.';

notify pgrst, 'reload schema';
