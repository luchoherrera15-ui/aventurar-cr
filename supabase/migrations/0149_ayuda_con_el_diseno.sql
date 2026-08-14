-- ============================================================
-- BOOKEA — «No me gusta cómo me está quedando»: la puerta al equipo (0149)
--
-- El dueño de una barbería está armando su tarjeta en el creador, no le
-- sale como quiere, y hoy no tiene NINGUNA forma de pedirnos ayuda sin
-- salirse de Bookea. Esta tabla es esa puerta: un hilo corto entre el
-- NEGOCIO y BOOKEA sobre el diseño de una tarjeta.
--
-- ------------------------------------------------------------
-- POR QUÉ NO ES EL CHAT QUE YA EXISTE
-- ------------------------------------------------------------
-- Se estudió primero, porque reusar el chat maduro (0034/0037: RLS,
-- Realtime, push, correo, bandeja) habría sido lo barato. No entra, y
-- no por gusto: `conversaciones` está construida, hasta el fondo, para
-- el eje CLIENTE ↔ NEGOCIO.
--
--   · `rancho_id`, `cliente_id` y `proveedor_id` son NOT NULL, y los
--     dos últimos NO los elige quien inserta: los pisa el trigger
--     `conversacion_completar_defaults` con `auth.uid()` y con
--     `ranchos.owner_id`. O sea que un hilo negocio ↔ Bookea sería, por
--     construcción, un hilo del dueño consigo mismo.
--   · La política de INSERT de las consultas exige literalmente
--     `ra.owner_id <> auth.uid()` y `ra.estado = 'aprobado'`. El dueño
--     NO PUEDE abrir un hilo con su propio negocio — y los negocios que
--     nacen solo para Lealtad nacen `pendiente`, así que ni el equipo
--     podría abrirlo con ellos.
--   · Ese mismo trigger revienta si `auth.uid()` es null, así que
--     tampoco se puede crear desde el servidor con la llave de servicio.
--   · Y ningún admin de la plataforma ve `conversaciones`: no hay
--     política que se lo permita ni pantalla que las lea.
--
-- Deformar todo eso —trigger, política, índice único y la bandeja de
-- /mensajes— para meter un eje nuevo, en una tabla con conversaciones
-- vivas en producción, es exactamente el cambio que no se hace.
--
-- ------------------------------------------------------------
-- POR QUÉ TAMPOCO ES `solicitudes_lealtad` (0126/0130)
-- ------------------------------------------------------------
-- Ahí vive el «Crear personalizado» del alta, que se parece. Pero:
--
--   · `plan` es NOT NULL con CHECK: un pedido de ayuda de diseño no
--     tiene paquete, habría que inventarle uno.
--   · El índice único parcial `(rancho_id) where estado = 'pendiente'`
--     deja UNA sola fila pendiente por negocio: pedir ayuda con el
--     diseño bloquearía la solicitud del paquete, y al revés. Eso es
--     plata esperando trabada por una consulta de colores.
--   · Sus botones en /admin/complementos CREAN el negocio y le ASIGNAN
--     el plan. «Aprobar» un pedido de diseño le regalaría un paquete.
--
-- Aquello se pide UNA vez y se aprueba o se rechaza. Esto se conversa.
--
-- ------------------------------------------------------------
-- UNA SOLA TABLA, Y CADA FILA ES UN MENSAJE
-- ------------------------------------------------------------
-- `hilo_id` apunta a la fila CABEZA del propio hilo:
--
--   · `hilo_id is null`  → ES el pedido. Trae el `contexto` (el resumen
--     automático que arma src/lib/lealtad/ayuda-diseno.ts) y el estado.
--   · `hilo_id = <id>`   → es una respuesta. Solo texto y autor.
--
-- Con dos tablas habría que escribir dos juegos de políticas para el
-- mismo permiso, y el día que una cambie la otra se queda vieja.
--
-- `rancho_id` va repetido en las respuestas a propósito: así la RLS se
-- contesta con una sola llamada a `gestiona_rancho()` sin joins.
--
-- LA FILA ES LA FUENTE DE VERDAD: el correo al equipo sale del servidor
-- con `after()`, y si se pierde, el pedido sigue visible en
-- /admin/complementos. Mismo criterio que la 0126.
--
-- Aditiva e idempotente: no toca ninguna tabla que ya exista.
-- ============================================================

create table if not exists ayuda_diseno (
  id uuid primary key default gen_random_uuid(),

  -- null = esta fila ES el pedido; con valor = es una respuesta suya.
  -- `on delete cascade`: borrar el pedido se lleva su conversación.
  hilo_id uuid references ayuda_diseno(id) on delete cascade,

  -- Repetido en cada fila para que la RLS no necesite un join.
  rancho_id uuid not null references ranchos(id) on delete cascade,

  -- Sobre CUÁL tarjeta. null = todavía no existe (viene del creador).
  -- `set null` y no `cascade`: si el dueño archiva y borra la tarjeta,
  -- la conversación con el equipo no tiene por qué desaparecer.
  programa_id uuid references programa_lealtad(id) on delete set null,

  autor_id uuid not null references auth.users(id) on delete cascade,

  -- Mismo tope y misma forma que `mensajes.texto` (0034): lo que se
  -- escribe en un hilo de Bookea se mide igual en los dos lados.
  texto text not null check (char_length(trim(texto)) between 1 and 2000),

  -- El resumen automático de lo que el dueño tenía en pantalla: qué
  -- negocio, qué tarjeta, qué tipo, qué colores, qué icono, si subió
  -- logo o banda. Solo en la cabeza del hilo.
  contexto text check (contexto is null or char_length(contexto) <= 2000),

  estado text not null default 'abierta'
         check (estado in ('abierta', 'atendida', 'cerrada')),
  atendida_por uuid references auth.users(id) on delete set null,
  atendida_en  timestamptz,

  created_at timestamptz not null default now(),

  -- Una RESPUESTA es solo texto: ni contexto, ni marcas de atención.
  -- Sin esto, cerrar el hilo desde una respuesta dejaría dos filas
  -- diciendo cosas distintas sobre el mismo pedido.
  constraint ayuda_diseno_respuesta_simple check (
    hilo_id is null
    or (contexto is null and atendida_por is null and atendida_en is null)
  ),

  -- Un hilo no puede colgar de sí mismo.
  constraint ayuda_diseno_no_se_apunta check (hilo_id is null or hilo_id <> id)
);

comment on table ayuda_diseno is
  'Hilo negocio ↔ Bookea sobre el diseño de una tarjeta de lealtad. hilo_id null = el pedido; con valor = una respuesta.';
comment on column ayuda_diseno.contexto is
  'Resumen automático de lo que el dueño tenía en pantalla al pedir (src/lib/lealtad/ayuda-diseno.ts). Solo en la cabeza del hilo.';
comment on column ayuda_diseno.programa_id is
  'La tarjeta sobre la que se pide ayuda. null = todavía no existe: el pedido salió del creador.';

create index if not exists ayuda_diseno_rancho_idx
  on ayuda_diseno (rancho_id, created_at desc);

create index if not exists ayuda_diseno_hilo_idx
  on ayuda_diseno (hilo_id, created_at);

-- UN pedido abierto por negocio. No es solo contra el doble clic: es lo
-- que hace que tocar el botón otra vez lleve a la conversación que ya
-- está viva en vez de abrir una segunda que nadie va a leer.
create unique index if not exists ayuda_diseno_abierta_unq
  on ayuda_diseno (rancho_id)
  where hilo_id is null and estado = 'abierta';

alter table ayuda_diseno enable row level security;

-- ------------------------------------------------------------
-- El dueño del hilo, sin recursión de RLS
-- ------------------------------------------------------------
-- La política de INSERT necesita comprobar que la respuesta cuelga de
-- un pedido DEL MISMO negocio. Preguntárselo a `ayuda_diseno` desde una
-- política de `ayuda_diseno` es recursión infinita (la misma lección de
-- `cuentas_equipo`, ver docs/lealtad-arquitectura.md). `security
-- definer` corta el ciclo.
create or replace function public.ayuda_diseno_rancho(p_hilo uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.rancho_id
    from public.ayuda_diseno a
   where a.id = p_hilo
     and a.hilo_id is null
$$;

revoke all on function public.ayuda_diseno_rancho(uuid) from public, anon;
grant execute on function public.ayuda_diseno_rancho(uuid) to authenticated, service_role;

-- Quien gestiona el negocio ve su hilo; el admin de la plataforma ve
-- todos. (`gestiona_rancho` ya deja pasar al admin; `is_admin()` va
-- explícito para que la intención se lea sola, igual que en la 0126.)
drop policy if exists "Ver la ayuda de diseño del negocio" on ayuda_diseno;
create policy "Ver la ayuda de diseño del negocio" on ayuda_diseno
  for select to authenticated
  using (gestiona_rancho(rancho_id) or is_admin());

-- Escriben los DOS lados —ese es el punto de que sea un hilo— pero
-- siempre firmando con su propio id, y una respuesta solo puede colgar
-- de un pedido del mismo negocio. El pedido nace abierto: el estado lo
-- mueve Bookea, nunca quien pide.
drop policy if exists "Pedir ayuda y responderla" on ayuda_diseno;
create policy "Pedir ayuda y responderla" on ayuda_diseno
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and (gestiona_rancho(rancho_id) or is_admin())
    and (
      case
        when hilo_id is null then estado = 'abierta'
        else public.ayuda_diseno_rancho(hilo_id) = rancho_id
      end
    )
  );

-- Cerrar o marcar atendido es de Bookea.
drop policy if exists "Solo Bookea atiende la ayuda de diseño" on ayuda_diseno;
create policy "Solo Bookea atiende la ayuda de diseño" on ayuda_diseno
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- A propósito NO hay política de delete: un mensaje mandado no se
-- borra. Mismo criterio que `mensajes` (0034).

-- Sin grants la RLS más perfecta da "permission denied" (lección 0119).
-- El UPDATE es SOLO de las columnas de atención: ni un admin reescribe
-- por esta vía lo que el dueño pidió — eso es el registro.
grant select, insert on ayuda_diseno to authenticated;
grant update (estado, atendida_por, atendida_en) on ayuda_diseno to authenticated;
grant all on ayuda_diseno to service_role;
