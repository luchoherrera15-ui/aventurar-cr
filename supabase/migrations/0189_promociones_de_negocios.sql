
-- ─────────────────────────────────────────────────────────────────────
-- 0189: los negocios publican sus propias promos.
--
-- La pestaña «Promos» de la app mostraba dos cosas prestadas: los
-- programas de lealtad de otros negocios y lo que la persona había
-- guardado con el corazón. Ninguna de las dos es una promoción. Un
-- negocio que quiere decir «20 % en corte de pelo esta semana» no
-- tenía dónde escribirlo.
--
-- Esta tabla es ese lugar. Una promo es del NEGOCIO, la escribe el
-- dueño desde su panel, y se ve mezclada con las de todos los demás
-- —Eventos y Citas juntas— en la pestaña Promos.
--
-- ── POR QUÉ NO SE REUSÓ EL DESCUENTO POR ÍTEM (0186) ────────────────
-- Son cosas distintas y conviene no confundirlas:
--
--   · El descuento de la 0186 vive EN UN ÍTEM del catálogo. Cambia el
--     precio que se cobra al reservar ese ítem. Es aritmética.
--   · Una promo de acá es un ANUNCIO. Puede no tener precio («2x1 en
--     manicura»), puede aplicar a algo que no está en el catálogo, y
--     su trabajo es que alguien entre al negocio — no descontar plata
--     en el carrito.
--
-- Meterlas en la misma tabla obligaría a que toda promo fuera un ítem
-- con precio, que es justo lo que un anuncio no es.
--
-- Es seguro correr esta migración varias veces.
-- ─────────────────────────────────────────────────────────────────────


create table if not exists promociones (
  id              uuid primary key default gen_random_uuid(),
  rancho_id       uuid not null references ranchos(id) on delete cascade,

  -- Lo que se lee en la tarjeta.
  titulo          text not null,
  descripcion     text,
  -- La foto de la promo. Si no hay, la app cae a la foto del negocio:
  -- una tarjeta sin imagen se pierde entre las demás.
  foto_url        text,

  -- El gancho, opcional y en UNA sola forma a la vez. Un negocio
  -- escribe «20 %» o escribe «₡5.000 en vez de ₡8.000», no las dos:
  -- dos números que dicen lo mismo terminan contradiciéndose.
  descuento_porcentaje numeric,
  precio_antes    integer,
  precio_ahora    integer,

  -- Cuándo vale. `desde` null = ya. `hasta` null = hasta que la
  -- apaguen. Son `date` y no `timestamptz` a propósito: una promo se
  -- piensa por días («todo agosto»), no por horas, y con timestamptz
  -- el último día se cortaba a medianoche UTC — o sea a las 6 de la
  -- tarde en Costa Rica.
  desde           date,
  hasta           date,

  -- El interruptor del dueño, aparte de las fechas: apagar una promo
  -- sin perder su texto para volver a prenderla el mes que viene.
  activa          boolean not null default true,

  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  constraint promociones_titulo_no_vacio
    check (length(btrim(titulo)) > 0),

  -- El mismo tope que la 0186, por la misma razón: un 100 % es
  -- «gratis», que es otra cosa, o un error de tipeo.
  constraint promociones_descuento_check
    check (
      descuento_porcentaje is null
      or (descuento_porcentaje >= 1 and descuento_porcentaje <= 90)
    ),

  -- O el porcentaje, o el par de precios. Nunca los dos.
  constraint promociones_un_solo_gancho
    check (
      descuento_porcentaje is null
      or (precio_antes is null and precio_ahora is null)
    ),

  -- Un «antes» que no es mayor que el «ahora» no es una rebaja.
  constraint promociones_precios_coherentes
    check (
      precio_antes is null
      or precio_ahora is null
      or precio_antes > precio_ahora
    ),

  constraint promociones_precios_positivos
    check (
      (precio_antes is null or precio_antes >= 0)
      and (precio_ahora is null or precio_ahora >= 0)
    ),

  constraint promociones_fechas_check
    check (hasta is null or desde is null or hasta >= desde)
);

comment on table promociones is
  'Las promos que publica cada negocio y se ven en la pestaña Promos de la app. Es un ANUNCIO, no un descuento de catálogo (eso es rancho_items.descuento_*, 0186).';
comment on column promociones.activa is
  'El interruptor del dueño. Apagarla no borra el texto: se puede volver a prender.';
comment on column promociones.desde is
  'date y no timestamptz: una promo se piensa por días. Con timestamptz el último día se cortaba a las 6pm hora tica.';

create index if not exists promociones_rancho_id_idx on promociones (rancho_id);
-- El índice que usa la pestaña Promos: activas, ordenadas por fecha.
create index if not exists promociones_activas_idx
  on promociones (activa, hasta) where activa;


-- ── QUIÉN VE QUÉ ─────────────────────────────────────────────────────

alter table promociones enable row level security;

-- El público ve las promos VIGENTES de negocios PUBLICADOS.
--
-- Las tres condiciones van juntas a propósito:
--   · `activa`               — el dueño la prendió
--   · la ventana de fechas   — no venció ni empezó todavía
--   · `estado = 'aprobado'`  — el negocio existe para el público
--
-- Sin la tercera, un negocio que todavía no se aprobó (o uno de
-- Lealtad, que nunca se publica — ver `en_marketplace`, 0187) podría
-- anunciarse en la pestaña Promos sin tener ficha adónde mandar a la
-- gente. La promo llevaría a una pantalla que no existe.
drop policy if exists "El público ve las promos vigentes" on promociones;
create policy "El público ve las promos vigentes" on promociones
  for select using (
    activa
    and (desde is null or desde <= (now() at time zone 'America/Costa_Rica')::date)
    and (hasta is null or hasta >= (now() at time zone 'America/Costa_Rica')::date)
    and exists (
      select 1 from ranchos r
       where r.id = promociones.rancho_id
         and r.estado = 'aprobado'
    )
  );

-- El dueño ve TODAS las suyas, vigentes o no: si no viera las
-- vencidas, no podría volver a prenderlas ni copiarles el texto.
drop policy if exists "El dueño ve sus promos" on promociones;
create policy "El dueño ve sus promos" on promociones
  for select using (
    exists (
      select 1 from ranchos r
       where r.id = promociones.rancho_id
         and (r.owner_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "El dueño crea sus promos" on promociones;
create policy "El dueño crea sus promos" on promociones
  for insert with check (
    exists (
      select 1 from ranchos r
       where r.id = promociones.rancho_id
         and (r.owner_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "El dueño edita sus promos" on promociones;
create policy "El dueño edita sus promos" on promociones
  for update using (
    exists (
      select 1 from ranchos r
       where r.id = promociones.rancho_id
         and (r.owner_id = auth.uid() or is_admin())
    )
  ) with check (
    exists (
      select 1 from ranchos r
       where r.id = promociones.rancho_id
         and (r.owner_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "El dueño borra sus promos" on promociones;
create policy "El dueño borra sus promos" on promociones
  for delete using (
    exists (
      select 1 from ranchos r
       where r.id = promociones.rancho_id
         and (r.owner_id = auth.uid() or is_admin())
    )
  );

-- `rancho_id` queda FUERA del grant de update: sin esto, el dueño de
-- un negocio podría mudarle una promo a un negocio ajeno con un update
-- de una sola columna, sin que la política lo frene (valida el rancho
-- de la fila, no que el rancho no cambie). Mismo criterio que la 0148.
grant select, insert, delete on promociones to authenticated;
grant update (
  titulo, descripcion, foto_url, descuento_porcentaje,
  precio_antes, precio_ahora, desde, hasta, activa, actualizado_en
) on promociones to authenticated;
grant select on promociones to anon;
grant all on promociones to service_role;

notify pgrst, 'reload schema';
