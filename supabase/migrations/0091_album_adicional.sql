-- ============================================================
-- BOOKEA — El álbum digital como complemento del pedido (0091)
--
-- En la página de paquetes, cada uno lleva ahora un "agregá el álbum
-- digital de 180 fotos" que suma al total. Es lo mismo que ya se vendía
-- suelto en los paquetes con álbum (Destello, Celebración, Legado),
-- pero ofrecido como extra de los tres principales.
--
-- DÓNDE VIVE EL PRECIO, que es lo único delicado acá.
--
-- La 0087 sacó el precio del navegador: los montos salen de
-- `paquetes_invitacion` y el pedido se crea por función. Si el álbum se
-- cobrara sumando 45 a lo que mande el formulario, se reabriría
-- exactamente el agujero que esa migración cerró — el cliente marcaría
-- el checkbox y podría mandar cualquier número.
--
-- Así que el álbum entra como una fila más del catálogo y lo único que
-- viaja desde el navegador es un booleano: lo quiero / no lo quiero. El
-- precio lo busca la base, igual que el del paquete.
--
--   `paquetes_invitacion.es_complemento` — separa lo que se vende SOLO
--     como extra de los paquetes que se venden por sí mismos. Sin esto,
--     el álbum aparecería como un cuarto paquete en cualquier pantalla
--     que liste la tabla.
--   `pedidos_invitacion.con_album` — si este pedido lo lleva.
--
-- `monto_crc` pasa a ser paquete + complementos: es "lo que de verdad
-- se cobra", que es lo que suma el reporte de ingresos. `precio_usd` y
-- `precio_crc` siguen siendo los del PAQUETE solo, para que se pueda
-- ver de dónde salió el total.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El catálogo distingue paquetes de complementos
-- ------------------------------------------------------------

alter table paquetes_invitacion
  add column if not exists es_complemento boolean not null default false;

comment on column paquetes_invitacion.es_complemento is
  'true = se vende solo como extra de un paquete (el álbum), no por sí mismo. Las pantallas de venta listan los paquetes con es_complemento = false.';

insert into paquetes_invitacion
  (id, nombre, precio_usd, precio_crc, tiene_panel, es_complemento, orden)
values
  ('album_180', 'Álbum digital de 180 fotos', 45, null, false, true, 20)
on conflict (id) do update set
  nombre = excluded.nombre,
  precio_usd = excluded.precio_usd,
  precio_crc = excluded.precio_crc,
  es_complemento = excluded.es_complemento,
  orden = excluded.orden;

-- ------------------------------------------------------------
-- 2. El pedido recuerda si lo lleva
-- ------------------------------------------------------------

alter table pedidos_invitacion
  add column if not exists con_album boolean not null default false;

comment on column pedidos_invitacion.con_album is
  'El cliente agregó el álbum digital de 180 fotos. El precio ya está sumado en monto_crc.';

-- ------------------------------------------------------------
-- 3. Crear el pedido, ahora con el complemento
--
-- Misma firma de antes más `p_con_album` al final, con default: el
-- código que todavía no lo manda sigue funcionando y crea pedidos sin
-- álbum, que es lo correcto.
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
  p_contacto_whatsapp text default null,
  p_con_album boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paquete paquetes_invitacion%rowtype;
  v_monto_album integer := 0;
  v_fila pedidos_invitacion%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Entrá con tu cuenta para hacer el pedido.';
  end if;

  -- El paquete tiene que ser un paquete, no un complemento: sin este
  -- filtro alguien pediría 'album_180' como si fuera un paquete de $45.
  select * into v_paquete from paquetes_invitacion
   where id = p_paquete and activo and not es_complemento;
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

  -- Lo único que llega del navegador sobre el álbum es el booleano de
  -- arriba. El precio se busca acá.
  if p_con_album then
    v_monto_album := coalesce(monto_paquete_crc('album_180'), 0);
    if v_monto_album = 0 then
      raise exception 'El álbum digital no está disponible en este momento.';
    end if;
  end if;

  insert into pedidos_invitacion (
    cliente_id, paquete,
    precio_usd, precio_crc, monto_crc, con_album,
    tipo_evento, nombre_evento, anfitriones, fecha_evento, hora,
    lugar_nombre, lugar_direccion, maps_url, tematica, colores,
    cantidad_invitados, fecha_limite_confirmacion, mensaje, idioma,
    contacto_nombre, contacto_whatsapp, contacto_correo, estado
  ) values (
    auth.uid(), v_paquete.id,
    -- precio_* son los del PAQUETE; monto_crc es el total cobrado.
    v_paquete.precio_usd, v_paquete.precio_crc,
    monto_paquete_crc(v_paquete.id) + v_monto_album,
    p_con_album,
    left(p_tipo_evento, 60), left(p_nombre_evento, 160),
    left(p_anfitriones, 200), p_fecha_evento, left(p_hora, 20),
    left(p_lugar_nombre, 160), left(p_lugar_direccion, 300),
    left(p_maps_url, 500), left(p_tematica, 200), left(p_colores, 160),
    case when p_cantidad_invitados > 0 then p_cantidad_invitados end,
    p_fecha_limite_confirmacion, left(p_mensaje, 1200),
    coalesce(nullif(left(p_idioma, 20), ''), 'es'),
    left(p_contacto_nombre, 120), left(p_contacto_whatsapp, 40),
    left(p_contacto_correo, 160),
    'pendiente_pago'
  )
  returning * into v_fila;

  return jsonb_build_object(
    'id', v_fila.id,
    'paquete', v_fila.paquete,
    'monto_crc', v_fila.monto_crc,
    'con_album', v_fila.con_album,
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

-- La firma cambió (un parámetro más), así que los permisos se vuelven a
-- otorgar sobre la nueva. La vieja queda huérfana y se retira.
revoke all on function public.crear_pedido_invitacion(
  text, text, text, date, text, text, text, text, text, text, text,
  text, text, int, date, text, text, text, boolean
) from public, anon;
grant execute on function public.crear_pedido_invitacion(
  text, text, text, date, text, text, text, text, text, text, text,
  text, text, int, date, text, text, text, boolean
) to authenticated;

drop function if exists public.crear_pedido_invitacion(
  text, text, text, date, text, text, text, text, text, text, text,
  text, text, int, date, text, text, text
);

notify pgrst, 'reload schema';
