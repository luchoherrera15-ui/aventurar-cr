-- ═══════════════════════════════════════════════════════════════════
--  CELEBRAR — 0245 · créditos (monedero), confirmaciones y usos de IA
-- ═══════════════════════════════════════════════════════════════════
--
-- Tres piezas que el dueño pidió el 21 sep 2026:
--
--   1. EL MONEDERO: un libro de movimientos de créditos por cuenta
--      (compras, consumos, regalos, ajustes). El saldo es la suma. Nadie
--      escribe directo: consumir va por RPC con candado (no se puede
--      gastar dos veces el mismo saldo) y acreditar va con service role
--      (el webhook de pago, o el admin).
--   2. LAS CONFIRMACIONES en la página: lo que responde cada invitado
--      (nombre, asiste, cuántos, las preguntas que configuró el
--      anfitrión). Entran por RPC anónima contra el slug de una
--      celebración PUBLICADA; el anfitrión las ve desde su panel.
--   3. LOS USOS DE IA por campo, para el enfriamiento («generaste 3;
--      para otras 3 esperá 5 minutos») — server side, no se puede saltar.
--
-- Aditiva e idempotente. Solo tablas celebrar_*; no toca nada de Bookea.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Créditos
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.celebrar_creditos_movimientos (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  celebracion_id  uuid references public.celebrar_celebraciones(id) on delete set null,
  tipo            text not null check (tipo in ('compra', 'consumo', 'regalo', 'ajuste', 'reembolso')),
  -- Positivo acredita, negativo consume. Un consumo siempre es negativo.
  cantidad        integer not null check (cantidad <> 0),
  concepto        text not null check (char_length(concepto) between 1 and 200),
  -- El id de la sesión de pago, el pedido, etc. Único cuando existe: un
  -- webhook repetido no acredita dos veces.
  referencia      text,
  created_at      timestamptz not null default now(),
  constraint celebrar_creditos_consumo_negativo check (tipo <> 'consumo' or cantidad < 0),
  constraint celebrar_creditos_compra_positiva check (tipo not in ('compra', 'regalo', 'reembolso') or cantidad > 0)
);
create unique index if not exists celebrar_creditos_referencia_idx
  on public.celebrar_creditos_movimientos (referencia) where referencia is not null;
create index if not exists celebrar_creditos_owner_idx
  on public.celebrar_creditos_movimientos (owner_id, created_at desc);

alter table public.celebrar_creditos_movimientos enable row level security;
drop policy if exists "La dueña ve sus movimientos" on public.celebrar_creditos_movimientos;
create policy "La dueña ve sus movimientos" on public.celebrar_creditos_movimientos
  for select to authenticated using (owner_id = auth.uid());
-- Sin políticas de escritura para authenticated: solo RPC / service role.
revoke insert, update, delete, truncate, references, trigger on public.celebrar_creditos_movimientos from anon, authenticated;

/** El saldo de quien pregunta. */
create or replace function public.celebrar_saldo()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(cantidad), 0)::integer
    from public.celebrar_creditos_movimientos
   where owner_id = auth.uid();
$$;

/**
 * Consume créditos de la cuenta de quien llama, para una celebración
 * suya. Con candado por cuenta: dos consumos simultáneos no pueden
 * gastar el mismo saldo. Devuelve el saldo que queda; si no alcanza,
 * lanza 'Saldo insuficiente' con el faltante en el detalle.
 */
create or replace function public.celebrar_consumir_creditos(
  p_celebracion uuid,
  p_concepto text,
  p_cantidad integer,
  p_referencia text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_saldo integer;
begin
  if v_uid is null then
    raise exception 'Hay que iniciar sesión.' using errcode = '28000';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad tiene que ser positiva.' using errcode = '22023';
  end if;
  if p_celebracion is not null and not public.celebrar_es_duena(p_celebracion) then
    raise exception 'Esa celebración no es tuya.' using errcode = '42501';
  end if;
  -- Un candado por cuenta mientras dura la transacción.
  perform pg_advisory_xact_lock(hashtext('celebrar_creditos:' || v_uid::text));
  select coalesce(sum(cantidad), 0) into v_saldo
    from public.celebrar_creditos_movimientos where owner_id = v_uid;
  if v_saldo < p_cantidad then
    raise exception 'Saldo insuficiente' using errcode = 'P0001', detail = (p_cantidad - v_saldo)::text;
  end if;
  insert into public.celebrar_creditos_movimientos (owner_id, celebracion_id, tipo, cantidad, concepto, referencia)
  values (v_uid, p_celebracion, 'consumo', -p_cantidad, left(p_concepto, 200), p_referencia);
  return v_saldo - p_cantidad;
end;
$$;

/**
 * Acredita créditos a una cuenta: compras (webhook de pago), regalos y
 * ajustes del admin. SOLO service role. `p_referencia` única: si el
 * webhook llega dos veces, la segunda no hace nada y devuelve false.
 */
create or replace function public.celebrar_acreditar_creditos(
  p_owner uuid,
  p_cantidad integer,
  p_tipo text,
  p_concepto text,
  p_referencia text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad tiene que ser positiva.' using errcode = '22023';
  end if;
  if p_tipo not in ('compra', 'regalo', 'ajuste', 'reembolso') then
    raise exception 'Tipo inválido.' using errcode = '22023';
  end if;
  if p_referencia is not null and exists (
    select 1 from public.celebrar_creditos_movimientos where referencia = p_referencia
  ) then
    return false;
  end if;
  insert into public.celebrar_creditos_movimientos (owner_id, tipo, cantidad, concepto, referencia)
  values (p_owner, p_tipo, p_cantidad, left(p_concepto, 200), p_referencia);
  return true;
end;
$$;

revoke all on function public.celebrar_saldo() from public;
revoke all on function public.celebrar_consumir_creditos(uuid, text, integer, text) from public;
revoke all on function public.celebrar_acreditar_creditos(uuid, integer, text, text, text) from public;
grant execute on function public.celebrar_saldo() to authenticated, service_role;
grant execute on function public.celebrar_consumir_creditos(uuid, text, integer, text) to authenticated, service_role;
grant execute on function public.celebrar_acreditar_creditos(uuid, integer, text, text, text) to service_role;

-- Qué se pagó por publicar: {plan, creditos, en}. Volver a publicar la
-- misma celebración (tras despublicar) no cobra otra vez.
alter table public.celebrar_celebraciones
  add column if not exists pago_publicacion jsonb;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Confirmaciones
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.celebrar_confirmaciones (
  id              uuid primary key default gen_random_uuid(),
  celebracion_id  uuid not null references public.celebrar_celebraciones(id) on delete cascade,
  nombre          text not null check (char_length(nombre) between 1 and 120),
  asiste          boolean not null,
  personas        integer not null default 1 check (personas between 0 and 20),
  -- Las respuestas a las preguntas que configuró el anfitrión: {id: valor}.
  respuestas      jsonb not null default '{}'::jsonb check (pg_column_size(respuestas) <= 8192),
  mensaje         text check (mensaje is null or char_length(mensaje) <= 600),
  -- Teléfono o correo si el anfitrión lo pide.
  contacto        text check (contacto is null or char_length(contacto) <= 120),
  origen          text not null default 'pagina' check (origen in ('pagina', 'manual', 'whatsapp')),
  created_at      timestamptz not null default now()
);
create index if not exists celebrar_confirmaciones_celebracion_idx
  on public.celebrar_confirmaciones (celebracion_id, created_at desc);

alter table public.celebrar_confirmaciones enable row level security;
drop policy if exists "La dueña ve sus confirmaciones" on public.celebrar_confirmaciones;
create policy "La dueña ve sus confirmaciones" on public.celebrar_confirmaciones
  for select to authenticated using (public.celebrar_es_duena(celebracion_id));
drop policy if exists "La dueña anota confirmaciones a mano" on public.celebrar_confirmaciones;
create policy "La dueña anota confirmaciones a mano" on public.celebrar_confirmaciones
  for insert to authenticated with check (public.celebrar_es_duena(celebracion_id) and origen = 'manual');
drop policy if exists "La dueña corrige sus confirmaciones" on public.celebrar_confirmaciones;
create policy "La dueña corrige sus confirmaciones" on public.celebrar_confirmaciones
  for update to authenticated using (public.celebrar_es_duena(celebracion_id)) with check (public.celebrar_es_duena(celebracion_id));
drop policy if exists "La dueña borra confirmaciones" on public.celebrar_confirmaciones;
create policy "La dueña borra confirmaciones" on public.celebrar_confirmaciones
  for delete to authenticated using (public.celebrar_es_duena(celebracion_id));
revoke truncate, references, trigger on public.celebrar_confirmaciones from anon, authenticated;

/**
 * El invitado confirma desde la invitación pública. Anónimo, por slug
 * (vigente o histórico), solo si la celebración está publicada y tiene
 * la confirmación en la página. Tope de 2 000 confirmaciones por
 * celebración contra el abuso. Devuelve el id.
 */
create or replace function public.celebrar_confirmar(
  p_slug text,
  p_nombre text,
  p_asiste boolean,
  p_personas integer,
  p_respuestas jsonb default '{}'::jsonb,
  p_mensaje text default null,
  p_contacto text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cel uuid;
  v_cuantas integer;
begin
  select c.id into v_cel
    from public.celebrar_celebraciones c
   where c.deleted_at is null and c.estado = 'publicada'
     and (c.slug = lower(p_slug)
          or c.id = (select s.celebracion_id from public.celebrar_slugs s where s.slug = lower(p_slug) and s.motivo = 'historico'))
   limit 1;
  if v_cel is null then
    raise exception 'Esta invitación no está recibiendo confirmaciones.' using errcode = 'P0002';
  end if;
  if p_nombre is null or char_length(trim(p_nombre)) = 0 then
    raise exception 'Contanos tu nombre para anotarte.' using errcode = '22023';
  end if;
  select count(*) into v_cuantas from public.celebrar_confirmaciones where celebracion_id = v_cel;
  if v_cuantas >= 2000 then
    raise exception 'Esta invitación ya no recibe más confirmaciones.' using errcode = 'P0003';
  end if;
  insert into public.celebrar_confirmaciones (celebracion_id, nombre, asiste, personas, respuestas, mensaje, contacto, origen)
  values (
    v_cel,
    left(trim(p_nombre), 120),
    coalesce(p_asiste, true),
    greatest(0, least(20, coalesce(p_personas, 1))),
    coalesce(p_respuestas, '{}'::jsonb),
    nullif(left(trim(coalesce(p_mensaje, '')), 600), ''),
    nullif(left(trim(coalesce(p_contacto, '')), 120), ''),
    'pagina'
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.celebrar_confirmar(text, text, boolean, integer, jsonb, text, text) from public;
grant execute on function public.celebrar_confirmar(text, text, boolean, integer, jsonb, text, text) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Usos de IA por campo (enfriamiento de 5 minutos)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.celebrar_ia_usos (
  celebracion_id  uuid not null references public.celebrar_celebraciones(id) on delete cascade,
  -- «seccion:campo» (p. ej. hero:subtitulo) o 'invitacion' para la completa.
  clave           text not null check (char_length(clave) between 1 and 80),
  ultimo          timestamptz not null default now(),
  veces           integer not null default 1,
  primary key (celebracion_id, clave)
);
alter table public.celebrar_ia_usos enable row level security;
drop policy if exists "La dueña ve sus usos de IA" on public.celebrar_ia_usos;
create policy "La dueña ve sus usos de IA" on public.celebrar_ia_usos
  for select to authenticated using (public.celebrar_es_duena(celebracion_id));
drop policy if exists "La dueña anota sus usos de IA" on public.celebrar_ia_usos;
create policy "La dueña anota sus usos de IA" on public.celebrar_ia_usos
  for insert to authenticated with check (public.celebrar_es_duena(celebracion_id));
drop policy if exists "La dueña actualiza sus usos de IA" on public.celebrar_ia_usos;
create policy "La dueña actualiza sus usos de IA" on public.celebrar_ia_usos
  for update to authenticated using (public.celebrar_es_duena(celebracion_id)) with check (public.celebrar_es_duena(celebracion_id));
revoke delete, truncate, references, trigger on public.celebrar_ia_usos from anon, authenticated;

-- Los privilegios explícitos (no depender de los default privileges del
-- proyecto): leer movimientos, confirmaciones y usos; escribir donde las
-- políticas lo permiten. Sin esto, `celebrar_saldo()` (security invoker)
-- respondía «permission denied for table».
grant select on public.celebrar_creditos_movimientos to authenticated;
grant select, insert, update, delete on public.celebrar_confirmaciones to authenticated;
grant select, insert, update on public.celebrar_ia_usos to authenticated;
grant all on public.celebrar_creditos_movimientos, public.celebrar_confirmaciones, public.celebrar_ia_usos to service_role;
