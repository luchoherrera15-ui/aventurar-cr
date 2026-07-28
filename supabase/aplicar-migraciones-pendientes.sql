-- ============================================================
-- AVENTUREA CR — Script consolidado de migraciones 0014 a 0039
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

-- (Se quitó el re-add del check de subcategoría de esta migración:
--  usaba la lista vieja y reventaba contra filas ya guardadas con
--  las subcategorías que agregó la 0021. La versión completa del
--  check se instala más abajo, en el bloque de la 0021.)
alter table ranchos drop constraint if exists ranchos_subcategoria_check;

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

-- ============================================================
-- 0025 — Reparación de permisos de la tabla reservas
--
-- Si tu proyecto se quedó con la política original (solo dejaba
-- insertar con estado='pendiente', antes del hold temporal de 10
-- minutos), reservar tira "new row violates row-level security
-- policy for table reservas". Este bloque la deja en el estado
-- correcto sin importar cuál tenías puesta.
-- ============================================================

grant select, insert, update, delete on reservas to anon, authenticated;

drop policy if exists "Cualquiera crea una reserva pendiente" on reservas;
drop policy if exists "Cualquiera crea una reserva o un hold temporal" on reservas;
create policy "Cualquiera crea una reserva o un hold temporal"
  on reservas for insert
  to anon, authenticated
  with check (estado in ('pendiente', 'temporal'));

drop policy if exists "Cualquiera completa su propio hold temporal" on reservas;
create policy "Cualquiera completa su propio hold temporal"
  on reservas for update
  to anon, authenticated
  using (estado = 'temporal')
  with check (estado in ('temporal', 'pendiente'));

drop policy if exists "Cualquiera borra un hold temporal ya vencido" on reservas;
create policy "Cualquiera borra un hold temporal ya vencido"
  on reservas for delete
  to anon, authenticated
  using (estado = 'temporal' and expira_en < now());

notify pgrst, 'reload schema';

-- ============================================================
-- 0026 — Completar la reserva por función, no por UPDATE directo
--
-- Arregla "new row violates row-level security policy for table
-- reservas" justo al confirmar la reserva (paso 'temporal' ->
-- 'pendiente'), con el mismo patrón security definer que ya usan
-- liberar_hold_temporal y redimir_codigo_descuento.
-- ============================================================

create or replace function public.completar_reserva_temporal(
  p_id uuid,
  p_nombre text,
  p_contacto text,
  p_cedula text,
  p_tipo_evento text,
  p_invitados integer,
  p_horario_bloque text,
  p_monto_total numeric,
  p_deposito_monto numeric,
  p_metodo_pago text,
  p_deposito_comprobante_url text,
  p_terminos_aceptados boolean,
  p_notas text,
  p_codigo_descuento text,
  p_descuento_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho_id uuid;
begin
  update reservas
  set
    nombre = p_nombre,
    contacto = p_contacto,
    cedula = p_cedula,
    tipo_evento = p_tipo_evento,
    invitados = p_invitados,
    horario_bloque = p_horario_bloque,
    monto_total = p_monto_total,
    deposito_monto = p_deposito_monto,
    metodo_pago = p_metodo_pago,
    deposito_comprobante_url = p_deposito_comprobante_url,
    terminos_aceptados = p_terminos_aceptados,
    notas = p_notas,
    codigo_descuento = p_codigo_descuento,
    descuento_monto = p_descuento_monto,
    estado = 'pendiente'
  where id = p_id
    and estado = 'temporal'
  returning rancho_id into v_rancho_id;

  return v_rancho_id;
end;
$$;

grant execute on function public.completar_reserva_temporal(
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, text, text, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 0027 — Cuentas de cobro del proveedor (SINPE / banco)
-- ============================================================

alter table ranchos add column if not exists sinpe_numero text;
alter table ranchos add column if not exists sinpe_titular text;
alter table ranchos add column if not exists cuenta_banco text;
alter table ranchos add column if not exists cuenta_numero text;
alter table ranchos add column if not exists cuenta_titular text;
alter table ranchos add column if not exists cuenta_tipo text;

notify pgrst, 'reload schema';

-- ============================================================
-- 0028 — Aceptación explícita del aviso de prohibiciones
-- ============================================================

alter table reservas
  add column if not exists aviso_prohibiciones_aceptado boolean not null default false;

drop function if exists public.completar_reserva_temporal(
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, text, text, numeric
);

create or replace function public.completar_reserva_temporal(
  p_id uuid,
  p_nombre text,
  p_contacto text,
  p_cedula text,
  p_tipo_evento text,
  p_invitados integer,
  p_horario_bloque text,
  p_monto_total numeric,
  p_deposito_monto numeric,
  p_metodo_pago text,
  p_deposito_comprobante_url text,
  p_terminos_aceptados boolean,
  p_aviso_prohibiciones_aceptado boolean,
  p_notas text,
  p_codigo_descuento text,
  p_descuento_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho_id uuid;
begin
  update reservas
  set
    nombre = p_nombre,
    contacto = p_contacto,
    cedula = p_cedula,
    tipo_evento = p_tipo_evento,
    invitados = p_invitados,
    horario_bloque = p_horario_bloque,
    monto_total = p_monto_total,
    deposito_monto = p_deposito_monto,
    metodo_pago = p_metodo_pago,
    deposito_comprobante_url = p_deposito_comprobante_url,
    terminos_aceptados = p_terminos_aceptados,
    aviso_prohibiciones_aceptado = p_aviso_prohibiciones_aceptado,
    notas = p_notas,
    codigo_descuento = p_codigo_descuento,
    descuento_monto = p_descuento_monto,
    estado = 'pendiente'
  where id = p_id
    and estado = 'temporal'
  returning rancho_id into v_rancho_id;

  return v_rancho_id;
end;
$$;

grant execute on function public.completar_reserva_temporal(
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, boolean, text, text, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 0029 — Correo y WhatsApp obligatorios y separados en la reserva
-- ============================================================

alter table reservas add column if not exists correo text;
alter table reservas add column if not exists whatsapp text;

drop function if exists public.completar_reserva_temporal(
  uuid, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, boolean, text, text, numeric
);

create or replace function public.completar_reserva_temporal(
  p_id uuid,
  p_nombre text,
  p_correo text,
  p_whatsapp text,
  p_cedula text,
  p_tipo_evento text,
  p_invitados integer,
  p_horario_bloque text,
  p_monto_total numeric,
  p_deposito_monto numeric,
  p_metodo_pago text,
  p_deposito_comprobante_url text,
  p_terminos_aceptados boolean,
  p_aviso_prohibiciones_aceptado boolean,
  p_notas text,
  p_codigo_descuento text,
  p_descuento_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho_id uuid;
begin
  update reservas
  set
    nombre = p_nombre,
    correo = p_correo,
    whatsapp = p_whatsapp,
    cedula = p_cedula,
    tipo_evento = p_tipo_evento,
    invitados = p_invitados,
    horario_bloque = p_horario_bloque,
    monto_total = p_monto_total,
    deposito_monto = p_deposito_monto,
    metodo_pago = p_metodo_pago,
    deposito_comprobante_url = p_deposito_comprobante_url,
    terminos_aceptados = p_terminos_aceptados,
    aviso_prohibiciones_aceptado = p_aviso_prohibiciones_aceptado,
    notas = p_notas,
    codigo_descuento = p_codigo_descuento,
    descuento_monto = p_descuento_monto,
    estado = 'pendiente'
  where id = p_id
    and estado = 'temporal'
  returning rancho_id into v_rancho_id;

  return v_rancho_id;
end;
$$;

grant execute on function public.completar_reserva_temporal(
  uuid, text, text, text, text, text, integer, text, numeric, numeric,
  text, text, boolean, boolean, text, text, numeric
) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 0030 — Rebrand: renombra el rancho insignia a Bookear CR
-- ============================================================

update ranchos
set nombre = 'Bookear CR — Rancho de Eventos'
where nombre = 'Aventurea CR — Rancho de Eventos';

notify pgrst, 'reload schema';

-- ============================================================
-- 0031 — URL propia por rancho (bookearcr.com/nombrecorto)
-- ============================================================

create extension if not exists unaccent;

alter table ranchos add column if not exists slug text;

create unique index if not exists ranchos_slug_key
  on ranchos (slug)
  where slug is not null;

create or replace function public.slugify(p_texto text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(unaccent(coalesce(p_texto, ''))),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

do $$
declare
  fila record;
  base text;
  candidato text;
  sufijo int;
begin
  for fila in
    select id, nombre from ranchos where slug is null order by created_at asc
  loop
    base := public.slugify(fila.nombre);
    if base = '' then
      base := 'rancho';
    end if;

    candidato := base;
    sufijo := 1;
    while exists (select 1 from ranchos where slug = candidato) loop
      sufijo := sufijo + 1;
      candidato := base || sufijo::text;
    end loop;

    update ranchos set slug = candidato where id = fila.id;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- 0032 — Rol "cliente" para la app móvil
-- ============================================================

alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'dueno_rancho', 'cliente'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    coalesce(new.raw_user_meta_data->>'rol', 'dueno_rancho')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table reservas add column if not exists cliente_id uuid references auth.users(id) on delete set null;

create or replace function public.completar_reserva_temporal(
  p_id uuid,
  p_nombre text,
  p_correo text,
  p_whatsapp text,
  p_cedula text,
  p_tipo_evento text,
  p_invitados integer,
  p_horario_bloque text,
  p_monto_total numeric,
  p_deposito_monto numeric,
  p_metodo_pago text,
  p_deposito_comprobante_url text,
  p_terminos_aceptados boolean,
  p_aviso_prohibiciones_aceptado boolean,
  p_notas text,
  p_codigo_descuento text,
  p_descuento_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho_id uuid;
begin
  update reservas
  set
    nombre = p_nombre,
    correo = p_correo,
    whatsapp = p_whatsapp,
    cedula = p_cedula,
    tipo_evento = p_tipo_evento,
    invitados = p_invitados,
    horario_bloque = p_horario_bloque,
    monto_total = p_monto_total,
    deposito_monto = p_deposito_monto,
    metodo_pago = p_metodo_pago,
    deposito_comprobante_url = p_deposito_comprobante_url,
    terminos_aceptados = p_terminos_aceptados,
    aviso_prohibiciones_aceptado = p_aviso_prohibiciones_aceptado,
    notas = p_notas,
    codigo_descuento = p_codigo_descuento,
    descuento_monto = p_descuento_monto,
    cliente_id = auth.uid(),
    estado = 'pendiente'
  where id = p_id
    and estado = 'temporal'
  returning rancho_id into v_rancho_id;

  return v_rancho_id;
end;
$$;

drop policy if exists "El equipo ve todas las reservas" on reservas;
create policy "El equipo ve todas las reservas" on reservas
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
    or cliente_id = auth.uid()
  );

notify pgrst, 'reload schema';

-- ============================================================
-- 0033 — Fase 1 del rediseño: unidad de precio, favoritos,
-- reseñas y filas configurables del home
-- ============================================================

alter table ranchos add column if not exists unidad_precio text not null default 'evento';
alter table ranchos drop constraint if exists ranchos_unidad_precio_check;
alter table ranchos add constraint ranchos_unidad_precio_check
  check (unidad_precio in ('evento', 'persona', 'hora', 'bloque_horas'));

create table if not exists favoritos (
  cliente_id uuid not null references auth.users(id) on delete cascade,
  rancho_id uuid not null references ranchos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cliente_id, rancho_id)
);

alter table favoritos enable row level security;

drop policy if exists "Cada quien ve sus favoritos" on favoritos;
create policy "Cada quien ve sus favoritos" on favoritos
  for select to authenticated
  using (cliente_id = auth.uid());

drop policy if exists "Cada quien agrega sus favoritos" on favoritos;
create policy "Cada quien agrega sus favoritos" on favoritos
  for insert to authenticated
  with check (cliente_id = auth.uid());

drop policy if exists "Cada quien quita sus favoritos" on favoritos;
create policy "Cada quien quita sus favoritos" on favoritos
  for delete to authenticated
  using (cliente_id = auth.uid());

grant select, insert, delete on favoritos to authenticated;

create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  reserva_id uuid not null references reservas(id) on delete cascade,
  calificacion integer not null check (calificacion between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  unique (reserva_id)
);

alter table resenas enable row level security;

drop policy if exists "Cualquiera lee las reseñas" on resenas;
create policy "Cualquiera lee las reseñas" on resenas
  for select to anon, authenticated
  using (true);

drop policy if exists "El cliente reseña su propia reserva confirmada" on resenas;
create policy "El cliente reseña su propia reserva confirmada" on resenas
  for insert to authenticated
  with check (
    cliente_id = auth.uid()
    and exists (
      select 1 from reservas r
      where r.id = reserva_id
        and r.cliente_id = auth.uid()
        and r.rancho_id = resenas.rancho_id
        and r.estado = 'confirmada'
    )
  );

drop policy if exists "El cliente edita su propia reseña" on resenas;
create policy "El cliente edita su propia reseña" on resenas
  for update to authenticated
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());

drop policy if exists "El cliente borra su propia reseña" on resenas;
create policy "El cliente borra su propia reseña" on resenas
  for delete to authenticated
  using (cliente_id = auth.uid());

grant select on resenas to anon;
grant select, insert, update, delete on resenas to authenticated;

create or replace view calificaciones_rancho as
  select rancho_id, round(avg(calificacion)::numeric, 2) as promedio, count(*) as total
  from resenas
  group by rancho_id;

grant select on calificaciones_rancho to anon, authenticated;

create table if not exists home_secciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('categoria', 'ubicacion', 'manual')),
  titulo text not null,
  subtitulo text,
  categoria text,
  subcategoria text,
  provincia text,
  canton text,
  rancho_ids uuid[],
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table home_secciones enable row level security;

drop policy if exists "Cualquiera ve las secciones activas del home" on home_secciones;
create policy "Cualquiera ve las secciones activas del home" on home_secciones
  for select to anon, authenticated
  using (activo = true or is_admin());

drop policy if exists "El admin administra las secciones del home" on home_secciones;
create policy "El admin administra las secciones del home" on home_secciones
  for all to authenticated
  using (is_admin())
  with check (is_admin());

grant select on home_secciones to anon;
grant select, insert, update, delete on home_secciones to authenticated;

notify pgrst, 'reload schema';

-- ############################################################
-- 0034_mensajeria.sql
-- ############################################################

-- ------------------------------------------------------------
-- Mensajería cliente-proveedor, tipo Airbnb: un hilo por reserva, no
-- un chat libre sin reserva de por medio. Evita spam a proveedores
-- que nadie contactó todavía, y da un contexto claro a cada hilo
-- (qué rancho, qué fecha).
-- ------------------------------------------------------------

create table if not exists conversaciones (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references reservas(id) on delete cascade,
  rancho_id uuid not null references ranchos(id) on delete cascade,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  proveedor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists conversaciones_cliente_idx on conversaciones (cliente_id);
create index if not exists conversaciones_proveedor_idx on conversaciones (proveedor_id);

-- cliente_id, rancho_id y proveedor_id se completan solos a partir de
-- la reserva — así quien crea la fila (cliente o proveedor) no puede
-- inventar quién más participa del hilo; alcanza con mandar reserva_id.
create or replace function conversacion_completar_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select r.cliente_id, r.rancho_id into new.cliente_id, new.rancho_id
  from reservas r where r.id = new.reserva_id;

  if new.rancho_id is null then
    raise exception 'La reserva % no tiene un proveedor asociado', new.reserva_id;
  end if;
  if new.cliente_id is null then
    raise exception 'La reserva % no tiene un cliente asociado', new.reserva_id;
  end if;

  select ra.owner_id into new.proveedor_id from ranchos ra where ra.id = new.rancho_id;
  return new;
end;
$$;

drop trigger if exists conversacion_defaults on conversaciones;
create trigger conversacion_defaults
  before insert on conversaciones
  for each row execute function conversacion_completar_defaults();

alter table conversaciones enable row level security;

drop policy if exists "Participantes ven su conversación" on conversaciones;
create policy "Participantes ven su conversación" on conversaciones
  for select to authenticated
  using (cliente_id = auth.uid() or proveedor_id = auth.uid());

-- Puede abrir el hilo el cliente de esa reserva o el dueño del rancho
-- reservado — quien escriba primero. cliente_id/proveedor_id reales
-- los pone el trigger de arriba, no lo que mande esta policy.
drop policy if exists "Cliente o proveedor de la reserva abren el hilo" on conversaciones;
create policy "Cliente o proveedor de la reserva abren el hilo" on conversaciones
  for insert to authenticated
  with check (
    exists (
      select 1 from reservas r
      join ranchos ra on ra.id = r.rancho_id
      where r.id = reserva_id
        and (r.cliente_id = auth.uid() or ra.owner_id = auth.uid())
    )
  );

grant select, insert on conversaciones to authenticated;

-- ------------------------------------------------------------

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists mensajes_conversacion_idx on mensajes (conversacion_id, created_at);

alter table mensajes enable row level security;

drop policy if exists "Participantes leen los mensajes de su hilo" on mensajes;
create policy "Participantes leen los mensajes de su hilo" on mensajes
  for select to authenticated
  using (
    exists (
      select 1 from conversaciones c
      where c.id = conversacion_id
        and (c.cliente_id = auth.uid() or c.proveedor_id = auth.uid())
    )
  );

drop policy if exists "Participantes escriben en su hilo" on mensajes;
create policy "Participantes escriben en su hilo" on mensajes
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from conversaciones c
      where c.id = conversacion_id
        and (c.cliente_id = auth.uid() or c.proveedor_id = auth.uid())
    )
  );

-- A propósito no hay policy de update ni de delete: un mensaje mandado
-- no se edita ni se borra.
grant select, insert on mensajes to authenticated;

-- ------------------------------------------------------------
-- "Leído hasta" por participante, en su propia tabla — separado de
-- mensajes para que marcar como leído no abra la puerta a alterar el
-- contenido de un mensaje ajeno con un update disfrazado.
-- ------------------------------------------------------------

create table if not exists conversacion_lecturas (
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  leido_hasta timestamptz not null default now(),
  primary key (conversacion_id, usuario_id)
);

alter table conversacion_lecturas enable row level security;

drop policy if exists "Cada quien ve su propia marca de lectura" on conversacion_lecturas;
create policy "Cada quien ve su propia marca de lectura" on conversacion_lecturas
  for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "Cada quien marca su propia lectura" on conversacion_lecturas;
create policy "Cada quien marca su propia lectura" on conversacion_lecturas
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from conversaciones c
      where c.id = conversacion_id
        and (c.cliente_id = auth.uid() or c.proveedor_id = auth.uid())
    )
  );

drop policy if exists "Cada quien actualiza su propia lectura" on conversacion_lecturas;
create policy "Cada quien actualiza su propia lectura" on conversacion_lecturas
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

grant select, insert, update on conversacion_lecturas to authenticated;

-- ------------------------------------------------------------
-- Realtime: los mensajes nuevos llegan en vivo sin recargar la
-- pantalla, en vez de tener que hacer polling.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensajes'
  ) then
    alter publication supabase_realtime add table mensajes;
  end if;
end $$;


-- ############################################################
-- 0035_catalogo_servicios.sql
-- ############################################################

-- ------------------------------------------------------------
-- Catálogo por negocio (menús, paquetes, productos) + pedido
-- estructurado en la reserva.
--
-- La meta: que un catering pueda publicar su menú, un DJ sus
-- paquetes, un alquiler su inventario — y que el cliente arme su
-- pedido al reservar la fecha, en vez de irse a WhatsApp a
-- preguntar "¿qué tienen?". El flujo de reservas de Lugares no se
-- toca: esto es para las demás categorías.
-- ------------------------------------------------------------

create table if not exists rancho_items (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 120),
  descripcion text check (descripcion is null or char_length(descripcion) <= 500),
  -- Precio opcional: "a cotizar" también es válido.
  precio numeric check (precio is null or precio >= 0),
  -- Cómo se cobra ese ítem: "por persona", "por unidad", "por hora"...
  unidad text check (unidad is null or char_length(unidad) <= 40),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rancho_items_rancho_idx on rancho_items (rancho_id, orden);

alter table rancho_items enable row level security;

-- El catálogo es parte del portal público del negocio.
drop policy if exists "Catálogo visible para todos" on rancho_items;
create policy "Catálogo visible para todos" on rancho_items
  for select to anon, authenticated
  using (true);

drop policy if exists "Dueño administra su catálogo" on rancho_items;
create policy "Dueño administra su catálogo" on rancho_items
  for all to authenticated
  using (
    is_admin() or exists (
      select 1 from ranchos r where r.id = rancho_id and r.owner_id = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from ranchos r where r.id = rancho_id and r.owner_id = auth.uid()
    )
  );

grant select on rancho_items to anon, authenticated;
grant insert, update, delete on rancho_items to authenticated;

-- El pedido que armó el cliente al reservar, como snapshot:
-- { items: [{ item_id, nombre, precio, unidad, cantidad }], total_estimado }
-- Snapshot a propósito — si el proveedor cambia precios después, lo
-- pedido queda como estaba al momento de pedirlo.
alter table reservas add column if not exists detalle_pedido jsonb;


-- ############################################################
-- 0036_drop_home_secciones.sql
-- ############################################################

-- ------------------------------------------------------------
-- Se elimina home_secciones (las secciones manuales de la portada,
-- de la 0033). El inicio ahora es el directorio con rieles armados
-- automáticamente por categoría, así que la tabla y su panel de
-- admin (/admin/portada) quedaron sin uso.
-- ------------------------------------------------------------

drop table if exists home_secciones cascade;


-- ############################################################
-- 0037_consultas_chat.sql
-- ############################################################

-- ------------------------------------------------------------
-- Chat de consulta ANTES de reservar.
--
-- Hasta ahora cada conversación nacía de una reserva (un hilo por
-- reserva). Para eliminar WhatsApp del todo falta el caso "tengo una
-- duda antes de reservar": un hilo directo cliente ↔ negocio sin
-- reserva de por medio. Mismas tablas, mismo realtime, misma bandeja
-- — solo se permite que reserva_id sea null en ese caso, con UN hilo
-- de consulta por cliente y negocio (si después reserva, esa reserva
-- abre su propio hilo como siempre).
-- ------------------------------------------------------------

alter table conversaciones alter column reserva_id drop not null;

-- Un solo hilo de consulta por (negocio, cliente). Los hilos con
-- reserva ya tienen su unique propio en reserva_id (los null no chocan
-- entre sí en un unique normal, por eso este índice parcial aparte).
create unique index if not exists conversaciones_consulta_unica
  on conversaciones (rancho_id, cliente_id)
  where reserva_id is null;

-- El trigger que completa cliente/rancho/proveedor ahora tiene dos
-- caminos: con reserva (igual que antes, todo sale de la reserva) o
-- sin reserva (consulta: el cliente es quien inserta — auth.uid(), no
-- lo que diga el payload — y el proveedor sale del rancho indicado).
create or replace function conversacion_completar_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reserva_id is not null then
    select r.cliente_id, r.rancho_id into new.cliente_id, new.rancho_id
    from reservas r where r.id = new.reserva_id;

    if new.rancho_id is null then
      raise exception 'La reserva % no tiene un proveedor asociado', new.reserva_id;
    end if;
    if new.cliente_id is null then
      raise exception 'La reserva % no tiene un cliente asociado', new.reserva_id;
    end if;
  else
    if new.rancho_id is null then
      raise exception 'Una consulta necesita el rancho_id del negocio';
    end if;
    new.cliente_id := auth.uid();
    if new.cliente_id is null then
      raise exception 'Iniciá sesión para abrir una consulta';
    end if;
  end if;

  select ra.owner_id into new.proveedor_id from ranchos ra where ra.id = new.rancho_id;
  if new.proveedor_id is null then
    raise exception 'El negocio % no existe', new.rancho_id;
  end if;
  return new;
end;
$$;

-- La policy de insert suma el caso consulta: cualquier cuenta con
-- sesión puede abrirle un hilo a un negocio aprobado que no sea suyo.
drop policy if exists "Cliente o proveedor de la reserva abren el hilo" on conversaciones;
create policy "Cliente o proveedor de la reserva abren el hilo" on conversaciones
  for insert to authenticated
  with check (
    (
      reserva_id is not null
      and exists (
        select 1 from reservas r
        join ranchos ra on ra.id = r.rancho_id
        where r.id = reserva_id
          and (r.cliente_id = auth.uid() or ra.owner_id = auth.uid())
      )
    )
    or (
      reserva_id is null
      and exists (
        select 1 from ranchos ra
        where ra.id = rancho_id
          and ra.estado = 'aprobado'
          and ra.owner_id <> auth.uid()
      )
    )
  );


-- ############################################################
-- 0038_recordatorios.sql
-- ############################################################

-- ------------------------------------------------------------
-- Recordatorio de evento (1 día antes): el cron de Vercel manda el
-- correo al cliente y al proveedor, y marca la reserva para no
-- avisar dos veces.
-- ------------------------------------------------------------

alter table reservas add column if not exists recordatorio_enviado boolean not null default false;


-- ############################################################
-- 0039_modalidad_precio_lugar.sql
-- ############################################################

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

notify pgrst, 'reload schema';
