-- ============================================================
-- BOOKEA — El precio del pedido lo pone la base (0087)
--
-- EL PROBLEMA
--
-- La 0075 le dio al cliente INSERT y UPDATE directos sobre sus
-- pedidos, y dejó el blindaje del precio en el servidor
-- (src/lib/invitaciones/pedido.ts). Con la anon key en el bundle, ese
-- blindaje es opcional: cualquiera habla con PostgREST sin pasar por
-- Next. Concretamente se podía
--
--   · insertar un pedido { paquete:'legado', monto_crc:100 };
--   · y peor, DESPUÉS de crearlo cambiarse el paquete de 'basico' a
--     'legado', porque la política de UPDATE solo miraba `cliente_id`
--     y `estado`, nunca qué columna se estaba tocando.
--
-- Ese segundo caso es el que duele: se paga un paquete y en el panel
-- aparece otro, con el comprobante correcto al lado.
--
-- LA SOLUCIÓN
--
-- El precio deja de ser un dato que viaja y pasa a ser un dato que la
-- base conoce: `paquetes_invitacion`. El cliente pierde INSERT y
-- UPDATE sobre `pedidos_invitacion`; en su lugar hay dos funciones de
-- permisos elevados que hacen exactamente una cosa cada una:
--
--   crear_pedido_invitacion(...)  — arma el pedido. El paquete lo elige
--     el cliente; el precio lo busca la base. Lo que venga del
--     formulario sobre plata ni se lee.
--   registrar_pago_pedido(...)    — toca SOLO método, comprobante,
--     referencia y estado. El paquete y los montos quedan fuera de su
--     alcance para siempre.
--
-- El cliente conserva SELECT de sus pedidos (los necesita para su
-- pantalla de pago). El panel admin sigue con la llave de servicio.
--
-- ORDEN DE APLICACIÓN: se puede correr esta migración con el código
-- viejo todavía arriba y viceversa. El código nuevo llama a la función
-- y, si no existe, cae al camino directo de antes; y esta migración
-- crea las funciones ANTES de quitar los permisos.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El catálogo de paquetes, con su precio
--
-- Es el espejo en base de datos de src/lib/paquetes-invitaciones.ts.
-- Ese archivo sigue mandando en lo que se MUESTRA (nombre, lema, qué
-- incluye); esta tabla manda en lo que se COBRA. Si se cambia un
-- precio hay que tocar los dos — el servidor compara y deja un aviso
-- en el log si no coinciden.
-- ------------------------------------------------------------

create table if not exists paquetes_invitacion (
  id text primary key,
  nombre text not null,
  -- Uno de los dos según la familia del paquete: los principales se
  -- venden en dólares, los de álbum en colones.
  precio_usd numeric(8, 2),
  precio_crc integer,
  -- El Básico se maneja por WhatsApp: sin panel de confirmaciones.
  tiene_panel boolean not null default true,
  activo boolean not null default true,
  orden int not null default 0,
  constraint paquetes_invitacion_tiene_precio
    check (precio_usd is not null or precio_crc is not null)
);

insert into paquetes_invitacion (id, nombre, precio_usd, precio_crc, tiene_panel, orden)
values
  ('basico',      'Básico',      20, null,  false, 1),
  ('intermedio',  'Intermedio',  40, null,  true,  2),
  ('plus',        'Plus',        60, null,  true,  3),
  ('destello',    'Destello',    null, 44900, true, 4),
  ('celebracion', 'Celebración', null, 53900, true, 5),
  ('legado',      'Legado',      null, 62900, true, 6)
on conflict (id) do update set
  nombre      = excluded.nombre,
  precio_usd  = excluded.precio_usd,
  precio_crc  = excluded.precio_crc,
  tiene_panel = excluded.tiene_panel,
  orden       = excluded.orden;

alter table paquetes_invitacion enable row level security;

-- Los precios son públicos: están en la página de venta.
drop policy if exists "Cualquiera ve los paquetes" on paquetes_invitacion;
create policy "Cualquiera ve los paquetes" on paquetes_invitacion
  for select to anon, authenticated
  using (activo);

grant select on paquetes_invitacion to anon, authenticated;

-- El tipo de cambio vivía en una variable de entorno (TIPO_CAMBIO_USD).
-- Si el precio lo calcula la base, el tipo de cambio también tiene que
-- estar acá, o los dos lados darían montos distintos.
alter table configuracion_plataforma
  add column if not exists tipo_cambio_usd numeric not null default 520;

comment on column configuracion_plataforma.tipo_cambio_usd is
  'Colones por dólar para cobrar los paquetes en USD. Espejo de TIPO_CAMBIO_USD; el valor que manda es éste.';

-- ------------------------------------------------------------
-- 2. Cuánto se cobra, en colones
--
-- Misma cuenta que hacía montoEnColones() en TypeScript: se redondea
-- a la centena para no cobrar ₡10 437.
-- ------------------------------------------------------------

create or replace function public.monto_paquete_crc(p_paquete text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p.precio_crc,
    (round((p.precio_usd * c.tipo_cambio_usd) / 100.0) * 100)::integer
  )
  from paquetes_invitacion p
  cross join configuracion_plataforma c
  where p.id = p_paquete and p.activo;
$$;

-- ------------------------------------------------------------
-- 3. Crear el pedido — el precio no viaja
-- ------------------------------------------------------------

create or replace function public.crear_pedido_invitacion(
  p_paquete text,
  p_tipo_evento text,
  p_nombre_evento text,
  p_fecha_evento date,
  p_contacto_nombre text,
  p_contacto_correo text,
  p_anfitriones text default null,
  p_hora text default null,
  p_lugar_nombre text default null,
  p_lugar_direccion text default null,
  p_maps_url text default null,
  p_tematica text default null,
  p_colores text default null,
  p_cantidad_invitados int default null,
  p_fecha_limite_confirmacion date default null,
  p_mensaje text default null,
  p_idioma text default 'es',
  p_contacto_whatsapp text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paquete paquetes_invitacion%rowtype;
  v_fila pedidos_invitacion%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Entrá con tu cuenta para hacer el pedido.';
  end if;

  select * into v_paquete from paquetes_invitacion
   where id = p_paquete and activo;
  if not found then
    raise exception 'Ese paquete no existe.';
  end if;

  if coalesce(btrim(p_nombre_evento), '') = '' then
    raise exception 'Contanos cómo se llama tu evento.';
  end if;
  if coalesce(btrim(p_contacto_nombre), '') = '' then
    raise exception 'Necesitamos tu nombre para contactarte.';
  end if;
  if p_contacto_correo not like '%@%' then
    raise exception 'Necesitamos un correo válido.';
  end if;

  insert into pedidos_invitacion (
    cliente_id, paquete,
    precio_usd, precio_crc, monto_crc,
    tipo_evento, nombre_evento, anfitriones, fecha_evento, hora,
    lugar_nombre, lugar_direccion, maps_url, tematica, colores,
    cantidad_invitados, fecha_limite_confirmacion, mensaje, idioma,
    contacto_nombre, contacto_whatsapp, contacto_correo, estado
  ) values (
    auth.uid(), v_paquete.id,
    -- Las tres columnas de plata salen del catálogo, jamás de lo que
    -- mandó quien llama. Éste es el punto entero de la migración.
    v_paquete.precio_usd, v_paquete.precio_crc, monto_paquete_crc(v_paquete.id),
    left(p_tipo_evento, 60), left(p_nombre_evento, 160),
    left(p_anfitriones, 200), p_fecha_evento, left(p_hora, 20),
    left(p_lugar_nombre, 160), left(p_lugar_direccion, 300),
    left(p_maps_url, 500), left(p_tematica, 200), left(p_colores, 160),
    case when p_cantidad_invitados > 0 then p_cantidad_invitados end,
    p_fecha_limite_confirmacion, left(p_mensaje, 1200),
    coalesce(nullif(left(p_idioma, 20), ''), 'es'),
    left(p_contacto_nombre, 120), left(p_contacto_whatsapp, 40),
    left(p_contacto_correo, 160),
    -- El estado inicial tampoco se elige: nadie nace pagado.
    'pendiente_pago'
  )
  returning * into v_fila;

  return jsonb_build_object(
    'id', v_fila.id,
    'paquete', v_fila.paquete,
    'monto_crc', v_fila.monto_crc,
    'tipo_evento', v_fila.tipo_evento,
    'nombre_evento', v_fila.nombre_evento,
    'fecha_evento', v_fila.fecha_evento,
    'hora', v_fila.hora,
    'lugar_nombre', v_fila.lugar_nombre,
    'cantidad_invitados', v_fila.cantidad_invitados,
    'contacto_nombre', v_fila.contacto_nombre,
    'contacto_whatsapp', v_fila.contacto_whatsapp,
    'contacto_correo', v_fila.contacto_correo
  );
end;
$$;

revoke all on function public.crear_pedido_invitacion(
  text, text, text, date, text, text, text, text, text, text, text,
  text, text, int, date, text, text, text
) from public, anon;
grant execute on function public.crear_pedido_invitacion(
  text, text, text, date, text, text, text, text, text, text, text,
  text, text, int, date, text, text, text
) to authenticated;

-- ------------------------------------------------------------
-- 4. Adjuntar el comprobante — y NADA más
-- ------------------------------------------------------------

create or replace function public.registrar_pago_pedido(
  p_pedido_id uuid,
  p_metodo text,
  p_comprobante_url text,
  p_referencia text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila pedidos_invitacion%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Entrá con tu cuenta.';
  end if;
  if p_metodo not in ('sinpe', 'transferencia') then
    raise exception 'Elegí cómo pagaste.';
  end if;
  if coalesce(btrim(p_comprobante_url), '') = '' then
    raise exception 'Adjuntá el comprobante para que podamos verificar el pago.';
  end if;

  -- El WHERE es la política: solo su pedido, y solo mientras siga
  -- abierto. El SET es el alcance: cuatro columnas y la fecha. El
  -- paquete y los montos no aparecen acá, así que no hay forma de
  -- moverlos desde el navegador.
  update pedidos_invitacion
     set metodo_pago     = p_metodo,
         comprobante_url = p_comprobante_url,
         referencia_pago = nullif(left(p_referencia, 120), ''),
         estado          = 'en_revision',
         pagado_en       = now()
   where id = p_pedido_id
     and cliente_id = auth.uid()
     and estado in ('pendiente_pago', 'en_revision')
  returning * into v_fila;

  if not found then
    raise exception 'No pudimos registrar tu pago. Intentá de nuevo.';
  end if;

  return jsonb_build_object(
    'paquete', v_fila.paquete,
    'nombre_evento', v_fila.nombre_evento,
    'fecha_evento', v_fila.fecha_evento,
    'contacto_correo', v_fila.contacto_correo,
    'contacto_nombre', v_fila.contacto_nombre
  );
end;
$$;

revoke all on function public.registrar_pago_pedido(uuid, text, text, text)
  from public, anon;
grant execute on function public.registrar_pago_pedido(uuid, text, text, text)
  to authenticated;

-- ------------------------------------------------------------
-- 5. Recién ahora se le quita la escritura directa al cliente
--
-- Va al final a propósito: si algo de arriba falla, la migración se
-- corta con los permisos viejos todavía puestos y nadie se queda sin
-- poder pedir su invitación.
-- ------------------------------------------------------------

drop policy if exists "El cliente crea sus pedidos" on pedidos_invitacion;
drop policy if exists "El cliente adjunta su comprobante" on pedidos_invitacion;

revoke insert, update on pedidos_invitacion from authenticated;

-- Lo único que le queda: ver los suyos (su pantalla de pago los lee).
grant select on pedidos_invitacion to authenticated;

notify pgrst, 'reload schema';
