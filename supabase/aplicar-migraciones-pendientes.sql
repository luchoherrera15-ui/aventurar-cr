-- ============================================================
-- AVENTUREA CR — Script consolidado de migraciones 0014 a 0021
--
-- Corre TODO lo pendiente en el orden correcto y de una sola vez.
-- Cada bloque es idempotente: si una migración ya se aplicó, esa
-- parte no hace nada. Se puede correr entero sin miedo, sin
-- importar hasta dónde se había llegado antes.
-- ============================================================


-- ############################################################
-- 0014_tipo_lugar_salones.sql
-- ############################################################

-- ============================================================
-- AVENTUREA CR — Subcategoría "tipo de lugar" para salones/ranchos,
-- para poder filtrar el directorio como Salas de eventos, Ranchos
-- para fiestas, Fincas para fiestas, etc. Es seguro correr esta
-- migración varias veces.
-- ============================================================

alter table ranchos add column if not exists tipo_lugar text;

alter table ranchos drop constraint if exists ranchos_tipo_lugar_check;
alter table ranchos add constraint ranchos_tipo_lugar_check
  check (
    tipo_lugar is null or tipo_lugar in (
      'sala_eventos',
      'rancho_fiestas',
      'lugar_fiestas_infantiles',
      'finca_fiestas',
      'hotel_eventos',
      'restaurante',
      'parque_piscina',
      'centro_negocios'
    )
  );

-- ############################################################
-- 0015_cedula_reservas.sql
-- ############################################################

-- ============================================================
-- AVENTUREA CR — Número de cédula del cliente en cada reserva
-- (solo el número, sin foto de documento), para poder identificar
-- a quien reserva en caso de daños o problemas en el evento.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table reservas add column if not exists cedula text;

alter table reservas drop constraint if exists reservas_cedula_check;
alter table reservas add constraint reservas_cedula_check
  check (cedula is null or cedula ~ '^[0-9-]{7,14}$');

-- ############################################################
-- 0016_portal_proveedores.sql
-- ############################################################

-- ============================================================
-- AVENTUREA CR — Portal público por proveedor
--
-- Cada negocio (salón, DJ, catering, mobiliario, animador...)
-- pasa a tener su propia página dentro del sitio: galería de
-- fotos, redes sociales, presentación larga y, en el caso de
-- los lugares, la lista de amenidades que ofrece.
--
-- La columna `fotos` (jsonb) ya existía desde 0008 pero nunca
-- se usó — a partir de acá guarda la galería del portal.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Redes sociales y presentación del portal
-- ------------------------------------------------------------

alter table ranchos add column if not exists instagram text;
alter table ranchos add column if not exists facebook text;
alter table ranchos add column if not exists tiktok text;
alter table ranchos add column if not exists sitio_web text;
alter table ranchos add column if not exists descripcion_larga text;

-- ------------------------------------------------------------
-- 2. Amenidades del lugar (piscina, parrilla, cancha, etc.)
--
-- Por ahora solo se llenan para categoria = 'salon'. Los
-- servicios móviles (DJ, catering...) tendrán su propio set
-- de características en una fase posterior.
-- ------------------------------------------------------------

alter table ranchos add column if not exists amenidades text[] not null default '{}';

-- Índice GIN para poder filtrar el directorio por amenidad
-- ("mostrame solo los que tienen piscina") sin escanear todo.
create index if not exists ranchos_amenidades_idx
  on ranchos using gin (amenidades);

-- ############################################################
-- 0017_liberar_hold_temporal.sql
-- ############################################################

-- ============================================================
-- AVENTUREA CR — Arregla que al cambiar de fecha el bloqueo
-- temporal anterior no se liberaba.
--
-- La política de borrado (0004/0005) solo deja borrar holds
-- YA VENCIDOS:
--
--   using (estado = 'temporal' and expira_en < now())
--
-- Por eso, cuando alguien elegía una fecha y después se pasaba
-- a otra, el `delete` que soltaba la anterior no borraba nada:
-- la fecha quedaba tomada los 10 minutos completos. Explorando
-- el calendario una sola persona bloqueaba varias fechas y a
-- los dos cambios ya no podía reservar ninguna.
--
-- No aflojamos la política (si cualquiera pudiera borrar holds
-- ajenos, se podría sabotear a quien está llenando el formulario).
-- En su lugar se libera con una función security definer que
-- solo borra el hold si lo creó la misma conexión, igual que
-- el resto de las defensas anti-bot de 0012.
-- ============================================================

create or replace function public.liberar_hold_temporal(
  p_id uuid,
  p_ip text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas int;
begin
  delete from reservas
  where id = p_id
    and estado = 'temporal'
    and creado_por_ip is not distinct from p_ip;

  get diagnostics v_borradas = row_count;
  return v_borradas > 0;
end;
$$;

grant execute on function public.liberar_hold_temporal(uuid, text)
  to anon, authenticated;

-- ############################################################
-- 0018_taxonomia_y_terminos.sql
-- ############################################################

-- ============================================================
-- AVENTUREA CR — Taxonomía de dos niveles + términos por proveedor
--
-- 1. `categoria` pasa a ser la categoría general que se ve en la
--    barra de navegación (lugares, alimentación, animación,
--    organización, decoración, otros) y la nueva `subcategoria`
--    guarda el rubro concreto (queques, mariachis, floristerías...).
--    Los valores viejos se remapean sin perder nada.
--
-- 2. Cada proveedor puede tener sus propios términos y condiciones
--    y su monto mínimo de contratación.
--
-- La columna `tipo_lugar` queda como está (sin usar) en vez de
-- borrarse, para poder volver atrás si hiciera falta.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Subcategoría
-- ------------------------------------------------------------

alter table ranchos add column if not exists subcategoria text;

-- Backfill ANTES de tocar `categoria`, que es de donde sale el dato.
update ranchos set subcategoria = tipo_lugar
  where categoria = 'salon' and tipo_lugar is not null and subcategoria is null;
update ranchos set subcategoria = 'sala_eventos'
  where categoria = 'salon' and subcategoria is null;
update ranchos set subcategoria = 'dj_discomovil'
  where categoria = 'dj' and subcategoria is null;
update ranchos set subcategoria = 'animadores'
  where categoria = 'animador' and subcategoria is null;
update ranchos set subcategoria = 'sillas_mesas'
  where categoria = 'mobiliario' and subcategoria is null;
update ranchos set subcategoria = 'revelacion_sexo'
  where categoria = 'revelacion_sexo' and subcategoria is null;
update ranchos set subcategoria = 'otro'
  where categoria = 'otro' and subcategoria is null;

-- ------------------------------------------------------------
-- 2. Remapeo de la categoría general
-- ------------------------------------------------------------

alter table ranchos drop constraint if exists ranchos_categoria_check;

update ranchos set categoria = 'lugares'    where categoria = 'salon';
update ranchos set categoria = 'animacion'  where categoria in ('dj', 'animador');
update ranchos set categoria = 'decoracion' where categoria = 'mobiliario';
update ranchos set categoria = 'otros'      where categoria in ('revelacion_sexo', 'otro');

alter table ranchos alter column categoria set default 'lugares';

alter table ranchos add constraint ranchos_categoria_check
  check (categoria in (
    'lugares', 'alimentacion', 'animacion',
    'organizacion', 'decoracion', 'otros'
  ));

alter table ranchos drop constraint if exists ranchos_subcategoria_check;
alter table ranchos add constraint ranchos_subcategoria_check
  check (subcategoria is null or subcategoria in (
    -- Lugares
    'sala_eventos', 'rancho_fiestas', 'lugar_fiestas_infantiles',
    'finca_fiestas', 'hotel_eventos', 'restaurante',
    'parque_piscina', 'centro_negocios',
    -- Alimentación
    'catering', 'queques', 'catering_infantil', 'bebidas_domicilio',
    'mesas_dulces', 'food_trucks', 'comidas_domicilio', 'parrillada',
    -- Animación
    'dj_discomovil', 'luces_sonido', 'grupos_musicales', 'fiestas_neon',
    'animadores', 'maestros_ceremonias', 'mariachis',
    'payasos_pintacaritas', 'magos', 'inflables',
    'animacion_infantil', 'polvora',
    -- Organización
    'articulos_fiesta', 'invitaciones', 'fotografos', 'photo_booth',
    'edecanes', 'wedding_planner', 'produccion_audiovisual',
    'agencias_btl', 'organizacion_eventos', 'articulos_promocionales',
    -- Decoración
    'decoracion_eventos', 'decoracion_infantil', 'floristerias',
    'toldos', 'tarimas', 'exhibidores_stands', 'graderias',
    'sillas_mesas', 'manteles', 'equipo_eventos',
    -- Otros
    'revelacion_sexo', 'transporte', 'seguridad',
    'banos_portatiles', 'planta_electrica', 'otro'
  ));

create index if not exists ranchos_subcategoria_idx on ranchos (subcategoria);

-- ------------------------------------------------------------
-- 3. Términos y condiciones propios + monto mínimo
--
-- `terminos` vacío significa "usar los que trae la plataforma":
-- así un negocio que nunca los tocó siempre muestra los vigentes.
-- ------------------------------------------------------------

alter table ranchos add column if not exists terminos jsonb not null default '[]'::jsonb;
alter table ranchos add column if not exists monto_minimo numeric;

notify pgrst, 'reload schema';

-- ############################################################
-- 0019_ubicacion_y_cantones.sql
-- ############################################################

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

-- ############################################################
-- 0020_detalles_por_servicio.sql
-- ############################################################

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

-- ############################################################
-- 0021_barras_de_producto.sql
-- ############################################################

-- ============================================================
-- AVENTUREA CR — Barras de producto dentro de Alimentación
--
-- Coffee bar, matcha bar, barra de cócteles y compañía: son un
-- rubro por sí solo (se contratan aparte del catering) y hoy no
-- tenían dónde entrar. Se suman a la lista permitida de
-- `subcategoria`, junto con bartenders.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos drop constraint if exists ranchos_subcategoria_check;
alter table ranchos add constraint ranchos_subcategoria_check
  check (subcategoria is null or subcategoria in (
    -- Lugares
    'sala_eventos', 'rancho_fiestas', 'lugar_fiestas_infantiles',
    'finca_fiestas', 'hotel_eventos', 'restaurante',
    'parque_piscina', 'centro_negocios',
    -- Alimentación
    'catering', 'queques', 'catering_infantil', 'bebidas_domicilio',
    'mesas_dulces', 'food_trucks', 'comidas_domicilio', 'parrillada',
    'bartender', 'barra_cocteles', 'barra_cafe', 'barra_matcha',
    'barra_cerveza', 'barra_jugos', 'barra_helados', 'barra_snacks',
    -- Animación
    'dj_discomovil', 'luces_sonido', 'grupos_musicales', 'fiestas_neon',
    'animadores', 'maestros_ceremonias', 'mariachis',
    'payasos_pintacaritas', 'magos', 'inflables',
    'animacion_infantil', 'polvora',
    -- Organización
    'articulos_fiesta', 'invitaciones', 'fotografos', 'photo_booth',
    'edecanes', 'wedding_planner', 'produccion_audiovisual',
    'agencias_btl', 'organizacion_eventos', 'articulos_promocionales',
    -- Decoración
    'decoracion_eventos', 'decoracion_infantil', 'floristerias',
    'toldos', 'tarimas', 'exhibidores_stands', 'graderias',
    'sillas_mesas', 'manteles', 'equipo_eventos',
    -- Otros
    'revelacion_sexo', 'transporte', 'seguridad',
    'banos_portatiles', 'planta_electrica', 'otro'
  ));

notify pgrst, 'reload schema';

-- ============================================================
-- 0022 — Los horarios de alquiler los define el dueño
-- ============================================================

alter table ranchos
  add column if not exists horarios_bloques jsonb not null default '[]'::jsonb;

-- El horario de la reserva pasa a guardarse como texto libre (el
-- rótulo del bloque que el dueño configuró), no como un código fijo.
alter table reservas drop constraint if exists reservas_horario_bloque_check;

notify pgrst, 'reload schema';

-- ============================================================
-- 0023 — El dueño elige qué foto va en cada lugar
-- ============================================================

-- Vacío = la plataforma escoge una automáticamente, como antes.
alter table ranchos add column if not exists foto_presentacion text;

notify pgrst, 'reload schema';

-- ============================================================
-- 0024 — Panel económico del propietario
-- ============================================================

-- ------------------------------------------------------------
-- 1. Fechas de cobro y monto final
-- ------------------------------------------------------------

alter table reservas add column if not exists deposito_pagado_en timestamptz;
alter table reservas add column if not exists saldo_pagado_en timestamptz;
alter table reservas add column if not exists monto_cobrado_final numeric;

-- Las que ya estaban marcadas como cobradas quedan con la fecha más
-- razonable que tenemos: el adelanto, cuando se creó la reserva; el
-- saldo, el día del evento. Es una aproximación de una sola vez para
-- que el histórico no arranque vacío.
update reservas
set deposito_pagado_en = created_at
where deposito_validado and deposito_pagado_en is null;

update reservas
set saldo_pagado_en = fecha::timestamptz
where evento_pagado and saldo_pagado_en is null;

create index if not exists reservas_cobros_idx
  on reservas (rancho_id, fecha);

-- ------------------------------------------------------------
-- 2. Gastos del negocio
--
-- Sin esto el panel diría cuánto facturó, no cuánto ganó.
-- ------------------------------------------------------------

create table if not exists gastos_rancho (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  fecha date not null,
  concepto text not null,
  categoria text not null default 'otro'
    check (categoria in (
      'personal', 'insumos', 'mantenimiento',
      'servicios', 'publicidad', 'otro'
    )),
  monto numeric not null check (monto >= 0),
  nota text,
  created_at timestamptz not null default now()
);

create index if not exists gastos_rancho_fecha_idx
  on gastos_rancho (rancho_id, fecha);

alter table gastos_rancho enable row level security;
grant select, insert, update, delete on gastos_rancho to authenticated;

-- Los gastos son privados: cada dueño ve y toca únicamente los suyos.
drop policy if exists "Cada dueño administra sus gastos" on gastos_rancho;
create policy "Cada dueño administra sus gastos" on gastos_rancho
  for all to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  )
  with check (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

notify pgrst, 'reload schema';
