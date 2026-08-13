-- ============================================================
-- BOOKEA — Canje seguro: idempotencia, auditoría y PIN (0137)
--
-- Tres agujeros del canje, cerrados en la BASE y no en la pantalla:
--
--   1. el doble toque descuenta dos veces;
--   2. un canje rechazado no deja rastro de por qué;
--   3. el PIN del colaborador no tiene dónde vivir sin quedar en
--      texto plano.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Idempotencia — el doble toque
-- ------------------------------------------------------------
-- El caso real: mostrador con señal mala, el empleado toca «canjear»,
-- no ve respuesta, y toca otra vez. Hoy eso son DOS canjes: al cliente
-- se le descuenta doble y el negocio entrega uno solo.
--
-- La llave la arma el servidor con quién, qué y en qué MINUTO
-- (`llaveDeCanje` en src/lib/lealtad/canje.ts). Dos toques del mismo
-- botón dentro del mismo minuto producen la misma llave, y el segundo
-- choca contra este índice y no escribe nada.
--
-- POR QUÉ UN ÍNDICE Y NO UNA COMPROBACIÓN ANTES DE INSERTAR:
-- «¿existe? entonces no inserto» tiene una ventana entre la pregunta y
-- la respuesta. Dos peticiones simultáneas pasan las dos por el
-- `select`, las dos ven que no existe, y las dos insertan. El índice
-- único no tiene ventana: lo resuelve el motor, dentro de la misma
-- transacción.
alter table canjes add column if not exists llave_idempotencia text;

create unique index if not exists canjes_llave_idempotencia_idx
  on canjes (llave_idempotencia)
  where llave_idempotencia is not null;

comment on column canjes.llave_idempotencia is
  'Llave del INTENTO (0137): miembro:recompensa:minuto. El índice '
  'único rebota el segundo toque del mismo botón. Parcial (where not '
  'null) para no atarse a los canjes viejos, que no la tienen.';


-- ------------------------------------------------------------
-- 2. Auditoría del canje — incluido el que NO procedió
-- ------------------------------------------------------------
-- `canjes` solo guarda los que salieron bien. Un canje RECHAZADO no
-- deja rastro, y es justo el que hay que poder explicar: el cliente
-- dice «no me lo aceptaron» y hoy no hay dónde mirar.
--
-- Tabla aparte y no un estado más de `canjes` a propósito: un intento
-- rechazado no descuenta puntos ni entrega nada, así que no es un
-- canje — meterlo ahí obligaría a filtrar por estado en cada consulta
-- de saldo, y el día que una se olvide, el saldo sale mal.
create table if not exists intentos_canje (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programa_lealtad(id) on delete cascade,
  miembro_id uuid references miembros(id) on delete set null,
  recompensa_id uuid references recompensas(id) on delete set null,

  -- Quién lo autorizó (o lo intentó). null = el sistema.
  usuario_id uuid references auth.users(id) on delete set null,

  aprobado boolean not null,

  -- El código de `MotivoRechazo` (canje.ts). null cuando se aprobó.
  -- Sin CHECK contra una lista cerrada: agregar un motivo nuevo en el
  -- código no debe pedir una migración, y un código que la base no
  -- conozca igual sirve para auditar.
  motivo text,

  created_at timestamptz not null default now()
);

create index if not exists intentos_canje_programa_idx
  on intentos_canje (programa_id, created_at desc);

alter table intentos_canje enable row level security;

-- La lee quien puede auditar el programa; la escribe solo el servidor
-- (con la llave de servicio, que salta RLS). Que el cliente pudiera
-- escribir acá haría de la auditoría un cuaderno que el auditado
-- llena.
drop policy if exists "El negocio lee sus intentos" on intentos_canje;
create policy "El negocio lee sus intentos" on intentos_canje
  for select to authenticated
  using (
    exists (
      select 1 from programa_lealtad pl
      join ranchos r on r.id = pl.rancho_id
      where pl.id = programa_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );

grant select on intentos_canje to authenticated;

comment on table intentos_canje is
  'TODO intento de canje, aprobado o no (0137). Los rechazados son los '
  'que hay que poder explicar cuando el cliente dice «no me lo '
  'aceptaron». Tabla aparte de `canjes` porque un rechazo no descuenta '
  'ni entrega nada: meterlo ahí obligaría a filtrar por estado en cada '
  'consulta de saldo.';


-- ------------------------------------------------------------
-- 3. El PIN del colaborador — hash, nunca texto plano
-- ------------------------------------------------------------
-- Autorizar un canje con PIN sirve para que el teléfono del mostrador
-- pueda quedar desbloqueado sin que cualquiera regale recompensas.
--
-- Se guarda el HASH y nunca el PIN. Un PIN en claro en la base es un
-- PIN que alguien lee en un backup, en un log de consulta o en una
-- captura de pantalla del panel de Supabase — y la gente reusa el
-- mismo cuatro dígitos de su tarjeta.
--
-- `pgcrypto` ya viene con Supabase; `crypt()` con sal de Blowfish hace
-- el hash lento a propósito, que es lo que arruina la fuerza bruta
-- sobre cuatro dígitos.
create extension if not exists pgcrypto;

alter table rancho_colaboradores add column if not exists pin_hash text;
alter table rancho_colaboradores add column if not exists pin_actualizado_en timestamptz;

comment on column rancho_colaboradores.pin_hash is
  'Hash del PIN de mostrador (0137), nunca el PIN. Se compara con '
  'crypt(intento, pin_hash) del lado del servidor. La columna NO se '
  'expone al cliente: las políticas de rancho_colaboradores solo la '
  'dejan escribir, y compararla es trabajo de una función.';

-- Poner el PIN: hashea del lado del servidor para que el valor en
-- claro no viaje a ninguna columna ni quede en el log de la sentencia.
create or replace function public.fijar_pin_colaborador(
  p_rancho uuid,
  p_usuario uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo quien gestiona el negocio reparte PINes. Sin esto, un
  -- colaborador podría ponerle el PIN a otro y operar como él.
  if not public.gestiona_rancho(p_rancho) then
    raise exception 'Sin permiso para asignar el PIN.';
  end if;

  -- Cuatro a ocho dígitos. Un PIN de un dígito no es un PIN.
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'El PIN tiene que ser de 4 a 8 dígitos.';
  end if;

  update rancho_colaboradores
  set pin_hash = crypt(p_pin, gen_salt('bf', 10)),
      pin_actualizado_en = now()
  where rancho_id = p_rancho and usuario_id = p_usuario;
end;
$$;

-- Comprobarlo. Devuelve solo true/false: nunca el hash, nunca el PIN.
create or replace function public.pin_valido(
  p_rancho uuid,
  p_usuario uuid,
  p_pin text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from rancho_colaboradores c
    where c.rancho_id = p_rancho
      and c.usuario_id = p_usuario
      and c.pin_hash is not null
      and c.pin_hash = crypt(p_pin, c.pin_hash)
  );
$$;

grant execute on function public.fijar_pin_colaborador(uuid, uuid, text) to authenticated;
grant execute on function public.pin_valido(uuid, uuid, text) to authenticated;
