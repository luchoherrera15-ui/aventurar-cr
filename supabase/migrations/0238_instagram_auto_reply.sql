-- ════════════════════════════════════════════════════════════════════
--  0238 · LINKSY — INSTAGRAM AUTO REPLY
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (7 sep 2026): «como Linktree: alguien comenta una
-- publicación con una palabra clave y recibe un DM automático, con la
-- opción de responder también en público». Solo con la API oficial de
-- Meta (Instagram API with Instagram Login).
--
-- ── CUATRO TABLAS, TODAS COLGADAS DE solutions_negocios ─────────────
-- La cuenta de Instagram es de UNA página de Linksy (negocio_id único):
-- es la página la que tiene un Instagram, y la persona ya es dueña de la
-- página por `solutions_negocios.owner_id`. No hay tabla de usuarios
-- nueva ni relación directa con auth.users más allá de quién conectó.
-- Mismo criterio de la 0230: prefijo propio, nada cuelga de `ranchos`.
--
-- ── EL TOKEN SE GUARDA CIFRADO Y NUNCA SALE ─────────────────────────
-- `token_cifrado` es AES-256-GCM con una clave que vive solo en el
-- entorno del servidor (src/lib/instagram/cifrado.ts). El equipo del
-- negocio puede LEER su cuenta (para pintar el panel) pero el GRANT de
-- select NO incluye esa columna: aunque una política dejara pasar, la
-- columna no se puede pedir con la llave anónima.
--
-- ── IDEMPOTENCIA EN LA BASE, NO SOLO EN EL CÓDIGO ───────────────────
-- Meta reenvía los avisos que no confirmamos (hasta 36 h). El índice
-- único (automatización, comentario) hace que el segundo INSERT del
-- mismo comentario falle: el motor lo lee como «duplicado» y no manda
-- un segundo DM. Para los comentarios que no coincidieron con nada, el
-- índice es (cuenta, comentario) con automatización nula.
--
-- ── ESCRITURA SOLO POR EL SERVIDOR ──────────────────────────────────
-- Sin políticas de insert/update/delete para `authenticated`: todo
-- entra por server actions y rutas que ya pasaron por
-- verificarAccesoSolutions. Una sola puerta (patrón 0230/0233).

-- ────────────────────────────────────────────────────────────────────
-- 1. LA CUENTA DE INSTAGRAM CONECTADA
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_instagram_cuentas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null unique references public.solutions_negocios (id) on delete cascade,
  -- Quién pasó por la pantalla de permisos. Rastro, no permiso: el
  -- acceso lo decide el equipo del negocio, no esta columna.
  conectada_por uuid references auth.users (id) on delete set null,

  -- Lo que devuelve /me de Graph.
  ig_user_id text not null unique check (ig_user_id ~ '^[0-9]{1,40}$'),
  username text not null check (char_length(username) between 1 and 80),
  nombre text check (nombre is null or char_length(nombre) <= 120),
  tipo_cuenta text not null check (tipo_cuenta in ('BUSINESS', 'MEDIA_CREATOR')),
  foto_url text check (foto_url is null or foto_url like 'https://%'),

  -- El token largo (60 días), cifrado. null = desconectada (se borra al
  -- desconectar: no se guarda una credencial que ya no se va a usar).
  token_cifrado text,
  token_vence_en timestamptz not null,
  token_refrescado_en timestamptz,
  -- Los scopes que Meta confirmó en el canje del código.
  permisos text[] not null default '{}',
  -- ¿Se logró suscribir la cuenta al campo `comments` del webhook?
  suscrito_webhook boolean not null default false,

  activa boolean not null default true,
  estado text not null default 'conectada' check (estado in ('conectada', 'reconectar', 'desconectada')),
  -- Por qué está como está, en palabras para el panel. Nunca un token.
  estado_nota text check (estado_nota is null or char_length(estado_nota) <= 300),

  conectada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.solutions_instagram_cuentas is
  'La cuenta profesional de Instagram conectada a una página de Linksy (0238). El token va cifrado y nunca sale al cliente.';

-- ────────────────────────────────────────────────────────────────────
-- 2. LAS AUTOMATIZACIONES
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_instagram_automatizaciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  cuenta_id uuid not null references public.solutions_instagram_cuentas (id) on delete cascade,

  nombre text not null check (char_length(nombre) between 1 and 80),

  -- La publicación o reel que dispara. Se elige desde la lista que da
  -- Graph; el resumen y la miniatura se guardan para pintar la lista
  -- sin volver a pedirle a Meta.
  media_id text not null check (media_id ~ '^[0-9]{1,40}$'),
  media_permalink text check (media_permalink is null or media_permalink like 'https://%'),
  media_resumen text check (media_resumen is null or char_length(media_resumen) <= 140),
  media_miniatura_url text check (media_miniatura_url is null or media_miniatura_url like 'https://%'),

  disparador text not null default 'palabra' check (disparador in ('palabra', 'cualquier_comentario')),
  modo_coincidencia text not null default 'palabra' check (modo_coincidencia in ('palabra', 'exacta', 'contiene')),

  -- El DM. Meta: texto UTF-8 de hasta 1000 bytes; el tope de 800 deja
  -- lugar al enlace, que va en su propia línea al final.
  mensaje_privado text not null check (char_length(mensaje_privado) between 2 and 800),
  enlace text check (enlace is null or (enlace like 'https://%' and char_length(enlace) <= 500)),

  respuesta_publica boolean not null default false,
  mensaje_publico text check (mensaje_publico is null or char_length(mensaje_publico) between 2 and 300),
  -- Con la pública prendida, el texto es obligatorio.
  constraint solutions_ig_auto_publica_chk check (not respuesta_publica or mensaje_publico is not null),

  activa boolean not null default true,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create index if not exists solutions_ig_auto_cuenta_media_idx
  on public.solutions_instagram_automatizaciones (cuenta_id, media_id) where activa;
create index if not exists solutions_ig_auto_negocio_idx
  on public.solutions_instagram_automatizaciones (negocio_id, creada_en desc);

comment on table public.solutions_instagram_automatizaciones is
  'Una publicación + palabras clave → un DM (y una respuesta pública opcional). 0238.';

-- ────────────────────────────────────────────────────────────────────
-- 3. LAS PALABRAS CLAVE
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_instagram_palabras (
  id uuid primary key default gen_random_uuid(),
  automatizacion_id uuid not null references public.solutions_instagram_automatizaciones (id) on delete cascade,
  -- Tal como la escribió la persona (para mostrarla) y normalizada
  -- (para no guardar «Precio» y «precio» como dos).
  palabra text not null check (char_length(palabra) between 1 and 40),
  palabra_normalizada text not null check (char_length(palabra_normalizada) between 1 and 40),
  creada_en timestamptz not null default now(),
  unique (automatizacion_id, palabra_normalizada)
);

-- ────────────────────────────────────────────────────────────────────
-- 4. LA BITÁCORA: UN EVENTO POR COMENTARIO (Y AUTOMATIZACIÓN)
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.solutions_instagram_eventos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.solutions_negocios (id) on delete cascade,
  cuenta_id uuid not null references public.solutions_instagram_cuentas (id) on delete cascade,
  -- null = el comentario no coincidió con ninguna automatización. Si la
  -- automatización se borra, el evento queda (con la referencia en null)
  -- para no perder las estadísticas de la cuenta.
  automatizacion_id uuid references public.solutions_instagram_automatizaciones (id) on delete set null,

  comentario_id text not null check (comentario_id ~ '^[0-9]{1,40}$'),
  ig_usuario_id text check (ig_usuario_id is null or ig_usuario_id ~ '^[0-9]{1,40}$'),
  ig_usuario_username text check (ig_usuario_username is null or char_length(ig_usuario_username) <= 80),
  media_id text check (media_id is null or media_id ~ '^[0-9]{1,40}$'),
  -- El comentario, recortado. Es lo que el dueño ve en la bitácora.
  texto_comentario text check (texto_comentario is null or char_length(texto_comentario) <= 500),
  palabra_coincidente text check (palabra_coincidente is null or char_length(palabra_coincidente) <= 40),

  resultado text not null default 'pendiente'
    check (resultado in ('pendiente', 'sin_coincidencia', 'enviado', 'omitido', 'error', 'limite')),
  dm_enviado boolean not null default false,
  dm_mensaje_id text,
  publica_enviada boolean not null default false,
  publica_comentario_id text,
  -- Nuestro código, nunca el cuerpo crudo de Meta ni un token.
  error_codigo text check (error_codigo is null or error_codigo in (
    'token_vencido', 'permisos', 'cuenta_incompatible', 'rate_limit', 'no_procesable',
    'dm_rechazado', 'webhook_invalido', 'api_no_disponible', 'desconocido'
  )),
  error_mensaje text check (error_mensaje is null or char_length(error_mensaje) <= 300),
  intentos integer not null default 1 check (intentos between 0 and 20),
  procesado_en timestamptz,
  creado_en timestamptz not null default now()
);

-- LA IDEMPOTENCIA. Un comentario, una automatización, una fila.
create unique index if not exists solutions_ig_eventos_unico_idx
  on public.solutions_instagram_eventos (automatizacion_id, comentario_id)
  where automatizacion_id is not null;
-- …y para los que no coincidieron: un comentario, una cuenta, una fila.
create unique index if not exists solutions_ig_eventos_sin_auto_unico_idx
  on public.solutions_instagram_eventos (cuenta_id, comentario_id)
  where automatizacion_id is null;

create index if not exists solutions_ig_eventos_negocio_idx
  on public.solutions_instagram_eventos (negocio_id, creado_en desc);
-- El freno por hora: cuántos DM salieron de esta cuenta hace poco.
create index if not exists solutions_ig_eventos_envios_idx
  on public.solutions_instagram_eventos (cuenta_id, procesado_en desc) where dm_enviado;

comment on table public.solutions_instagram_eventos is
  'Cada comentario que llegó por el webhook y qué pasó con él (0238). El índice único es la idempotencia.';

-- ────────────────────────────────────────────────────────────────────
-- 5. LOS AVISOS CRUDOS DEL WEBHOOK (para depurar)
-- ────────────────────────────────────────────────────────────────────
-- Solo lo que pasó la firma. Sin políticas: lo lee el equipo de Bookea
-- con la llave de servicio cuando algo no cuadra. El cuerpo va recortado.
create table if not exists public.solutions_instagram_webhooks (
  id uuid primary key default gen_random_uuid(),
  objeto text,
  comentarios integer not null default 0,
  cuerpo jsonb,
  recibido_en timestamptz not null default now()
);
create index if not exists solutions_ig_webhooks_recibido_idx
  on public.solutions_instagram_webhooks (recibido_en desc);

-- ────────────────────────────────────────────────────────────────────
-- 6. RLS
-- ────────────────────────────────────────────────────────────────────
alter table public.solutions_instagram_cuentas enable row level security;
alter table public.solutions_instagram_automatizaciones enable row level security;
alter table public.solutions_instagram_palabras enable row level security;
alter table public.solutions_instagram_eventos enable row level security;
alter table public.solutions_instagram_webhooks enable row level security;

-- El equipo ve lo suyo. Escribe SOLO el servidor.
drop policy if exists "El equipo ve su cuenta de Instagram" on public.solutions_instagram_cuentas;
create policy "El equipo ve su cuenta de Instagram" on public.solutions_instagram_cuentas
  for select to authenticated using (public.solutions_es_del_equipo(negocio_id));

drop policy if exists "El equipo ve sus automatizaciones" on public.solutions_instagram_automatizaciones;
create policy "El equipo ve sus automatizaciones" on public.solutions_instagram_automatizaciones
  for select to authenticated using (public.solutions_es_del_equipo(negocio_id));

drop policy if exists "El equipo ve sus palabras clave" on public.solutions_instagram_palabras;
create policy "El equipo ve sus palabras clave" on public.solutions_instagram_palabras
  for select to authenticated using (
    exists (
      select 1 from public.solutions_instagram_automatizaciones a
      where a.id = automatizacion_id and public.solutions_es_del_equipo(a.negocio_id)
    )
  );

drop policy if exists "El equipo ve su bitácora de Instagram" on public.solutions_instagram_eventos;
create policy "El equipo ve su bitácora de Instagram" on public.solutions_instagram_eventos
  for select to authenticated using (public.solutions_es_del_equipo(negocio_id));

-- Los GRANT: lectura para el equipo, y en la cuenta SIN la columna del
-- token. Todo lo demás, solo service_role.
grant select (
  id, negocio_id, conectada_por, ig_user_id, username, nombre, tipo_cuenta, foto_url,
  token_vence_en, token_refrescado_en, permisos, suscrito_webhook, activa, estado, estado_nota,
  conectada_en, actualizada_en
) on public.solutions_instagram_cuentas to authenticated;
grant select on public.solutions_instagram_automatizaciones to authenticated;
grant select on public.solutions_instagram_palabras to authenticated;
grant select on public.solutions_instagram_eventos to authenticated;

grant all on public.solutions_instagram_cuentas to service_role;
grant all on public.solutions_instagram_automatizaciones to service_role;
grant all on public.solutions_instagram_palabras to service_role;
grant all on public.solutions_instagram_eventos to service_role;
grant all on public.solutions_instagram_webhooks to service_role;

-- ────────────────────────────────────────────────────────────────────
-- 7. LIMPIEZA: los avisos crudos no viven para siempre
-- ────────────────────────────────────────────────────────────────────
create or replace function public.solutions_instagram_limpiar_webhooks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  delete from public.solutions_instagram_webhooks where recibido_en < now() - interval '30 days';
  get diagnostics v = row_count;
  return v;
end;
$$;
revoke all on function public.solutions_instagram_limpiar_webhooks() from public, anon, authenticated;
grant execute on function public.solutions_instagram_limpiar_webhooks() to service_role;

notify pgrst, 'reload schema';
