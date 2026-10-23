-- ============================================================
-- 0254 — IMPULSOS AUTOMÁTICOS (Lealtad)
-- ============================================================
-- Pedido del dueño: una capa de automatizaciones sobre las tarjetas de
-- lealtad que ya existen. Un negocio define "cuando pase X, esperá Y y
-- mandale Z a ese cliente" (bienvenida 5 minutos después de inscribirse,
-- «te falta 1», recuperación de inactivos…) y el sistema lo cumple solo,
-- sin que nadie tenga la página abierta.
--
-- NO es un segundo sistema de clientes ni de tarjetas: todo cuelga de
-- `ranchos`, `programa_lealtad` y `miembros`, que ya existen. Lo único
-- nuevo son tres tablas y lo mínimo para generar eventos:
--
--   impulsos_lealtad   LA CONFIGURACIÓN. Un impulso = un activador, un
--                      retraso, un horario, unas condiciones, un canal y
--                      un mensaje, de UNA tarjeta de UN negocio.
--   impulsos_eventos   LA BANDEJA DE ENTRADA. Lo que le pasó a un cliente
--                      («se inscribió», «sumó un sello», «agregó la
--                      tarjeta a Apple Wallet»). La escriben triggers que
--                      NUNCA pueden romper la operación original.
--   impulsos_tareas    LA COLA. Un mensaje a mandar a una persona, a una
--                      hora, con su estado. Persiste en la base: no depende
--                      de que nadie tenga abierto el panel.
--
-- ── POR QUÉ TRIGGERS Y NO CÓDIGO EN CADA ESCRITURA ──────────────────
-- El ledger (`transacciones_puntos`) se escribe desde el escáner, el
-- mostrador, la API pública, las citas, Foorkie, el vencimiento de sellos
-- y dos generadores de pases que insertan miembros directo. Enganchar
-- cada uno en TypeScript es olvidarse de uno. Un trigger AFTER INSERT los
-- cubre a todos, incluidos los futuros.
--
-- Los triggers cumplen tres reglas, y las tres importan:
--   1. Solo hacen un INSERT en `impulsos_eventos`. Sin red, sin lógica.
--   2. Solo escriben si la tarjeta tiene al menos un impulso ACTIVO. Un
--      negocio que no usa esto no paga ni una fila de más.
--   3. Van dentro de EXCEPTION WHEN OTHERS: si algo falla, el sello se da
--      igual. Un impulso perdido es un mensaje de menos; un sello perdido
--      es un cliente enojado.
--
-- ── LO QUE NO SE HACE ACÁ ───────────────────────────────────────────
--   · No hay pg_cron ni pg_net (el repo los descarta, ver 0110): quien
--     procesa la cola es una ruta (`/api/lealtad/impulsos`) que llama un
--     workflow de GitHub Actions cada 5 minutos, como `pases-en-pausa`.
--   · Los activadores y canales NO van en un CHECK de la base: el catálogo
--     vive en código (`src/lib/lealtad/impulsos/catalogo.ts`) para poder
--     sumar uno sin una migración. La base solo exige la forma.
--   · No se guarda fecha de nacimiento: Bookea no la tiene (ver el
--     informe). El activador `cumpleanos` queda declarado como "no
--     disponible" hasta que exista el dato.
--
-- ── VUELTA ATRÁS (nada de esto toca datos existentes) ───────────────
--   drop trigger if exists impulsos_evento_miembro on public.miembros;
--   drop trigger if exists impulsos_evento_ledger on public.transacciones_puntos;
--   drop trigger if exists impulsos_evento_pase_apple on public.registros_dispositivo;
--   drop function if exists public.impulsos_reclamar_tareas(integer, timestamptz);
--   drop function if exists public.impulsos_inactivos(uuid, date, text, integer, integer, integer);
--   drop function if exists public.impulsos_evento_miembro();
--   drop function if exists public.impulsos_evento_ledger();
--   drop function if exists public.impulsos_evento_pase_apple();
--   drop function if exists public.impulsos_tiene_activos(uuid);
--   drop function if exists public.impulsos_validar_programa();
--   drop table if exists public.impulsos_tareas;
--   drop table if exists public.impulsos_eventos;
--   drop table if exists public.impulsos_lealtad;
-- ============================================================

-- ------------------------------------------------------------
-- 1. impulsos_lealtad — la configuración
-- ------------------------------------------------------------
create table if not exists public.impulsos_lealtad (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references public.ranchos(id) on delete cascade,
  programa_id uuid not null references public.programa_lealtad(id) on delete cascade,

  nombre text not null check (char_length(btrim(nombre)) between 3 and 80),
  descripcion text check (descripcion is null or char_length(descripcion) <= 240),

  -- QUÉ LO DISPARA. Texto libre con forma; el catálogo vive en código.
  activador text not null check (activador ~ '^[a-z][a-z0-9_]{2,39}$'),
  -- Parámetros del activador (días de inactividad, cuántos sellos faltan…).
  activador_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(activador_config) = 'object'),
  -- Filtros extra: [{ "campo": "visitas", "op": "gte", "valor": 3 }, …] (todos deben cumplirse).
  condiciones jsonb not null default '[]'::jsonb
    check (jsonb_typeof(condiciones) = 'array' and jsonb_array_length(condiciones) <= 12),

  -- POR DÓNDE SALE. 'wallet' | 'correo' hoy; sms/whatsapp/push cuando haya proveedor.
  canal text not null check (canal ~ '^[a-z][a-z_]{2,19}$'),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 60),
  cuerpo text not null check (char_length(btrim(cuerpo)) between 3 and 600),

  -- CUÁNDO. El retraso se cuenta en minutos desde el evento (1 día = 1440).
  retraso_minutos integer not null default 0
    check (retraso_minutos between 0 and 525600),
  -- Ventana de envío: { modo, hora, desde, hasta, dias, siguiente_ventana }. Se interpreta
  -- en la zona horaria del NEGOCIO (`ranchos.zona_horaria`), nunca la del servidor.
  horario jsonb not null default '{}'::jsonb
    check (jsonb_typeof(horario) = 'object'),
  vigente_desde date,
  vigente_hasta date,
  check (vigente_hasta is null or vigente_desde is null or vigente_hasta >= vigente_desde),
  -- Mínimo de horas entre dos mensajes DE ESTE impulso a la misma persona.
  espera_minima_horas integer not null default 0
    check (espera_minima_horas between 0 and 8760),

  estado text not null default 'borrador'
    check (estado in ('borrador', 'activo', 'pausado', 'archivado')),
  -- De qué plantilla preconfigurada nació (solo informativo).
  plantilla text check (plantilla is null or plantilla ~ '^[a-z][a-z0-9_]{2,39}$'),
  -- Sube con cada edición: el historial dice con qué versión salió cada mensaje.
  version integer not null default 1 check (version >= 1),
  activado_en timestamptz,
  -- Los activadores por tiempo (inactividad) se revisan a lo sumo una vez por hora.
  ultimo_escaneo_en timestamptz,

  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists impulsos_lealtad_programa_idx
  on public.impulsos_lealtad (programa_id, estado);
create index if not exists impulsos_lealtad_rancho_idx
  on public.impulsos_lealtad (rancho_id, created_at desc);

-- El impulso tiene que ser del MISMO negocio que su tarjeta. `programa_id` llega del navegador y
-- `programa_lealtad` es legible por anon: sin esto, un dueño podía colgarle un impulso a la
-- tarjeta de otro negocio. Se valida en la base y también en el servidor (defensa en dos capas).
create or replace function public.impulsos_validar_programa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho uuid;
begin
  select rancho_id into v_rancho from public.programa_lealtad where id = new.programa_id;
  if v_rancho is null or v_rancho <> new.rancho_id then
    raise exception 'IMPULSO_PROGRAMA_AJENO: esa tarjeta no es de este negocio'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists impulsos_validar_programa on public.impulsos_lealtad;
create trigger impulsos_validar_programa
  before insert or update of rancho_id, programa_id on public.impulsos_lealtad
  for each row execute function public.impulsos_validar_programa();

-- ------------------------------------------------------------
-- 2. impulsos_eventos — lo que le pasó a un cliente
-- ------------------------------------------------------------
create table if not exists public.impulsos_eventos (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references public.ranchos(id) on delete cascade,
  programa_id uuid not null references public.programa_lealtad(id) on delete cascade,
  miembro_id uuid not null references public.miembros(id) on delete cascade,
  -- 'inscripcion' | 'pase_apple' | 'ledger_ganado' | 'ledger_canjeado'
  tipo text not null check (tipo ~ '^[a-z][a-z_]{2,39}$'),
  -- Identifica el hecho: el mismo hecho dos veces (reintento, trigger repetido) es UNA fila.
  clave text not null check (char_length(clave) between 1 and 200),
  ocurrido_en timestamptz not null default now(),
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  procesado_en timestamptz,
  intentos integer not null default 0,
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  unique (programa_id, tipo, clave)
);

create index if not exists impulsos_eventos_pendientes_idx
  on public.impulsos_eventos (created_at) where procesado_en is null;

-- ------------------------------------------------------------
-- 3. impulsos_tareas — la cola de mensajes
-- ------------------------------------------------------------
create table if not exists public.impulsos_tareas (
  id uuid primary key default gen_random_uuid(),
  impulso_id uuid not null references public.impulsos_lealtad(id) on delete cascade,
  rancho_id uuid not null references public.ranchos(id) on delete cascade,
  programa_id uuid not null references public.programa_lealtad(id) on delete cascade,
  miembro_id uuid not null references public.miembros(id) on delete cascade,
  evento_id uuid references public.impulsos_eventos(id) on delete set null,

  -- ANTIDUPLICADO. «Este impulso, por este hecho» es UNA tarea, pase lo que pase:
  -- un trigger repetido, un reintento del barrido o dos workers a la vez.
  clave text not null check (char_length(clave) between 1 and 240),
  canal text not null check (canal ~ '^[a-z][a-z_]{2,19}$'),
  ejecutar_en timestamptz not null,

  -- programada  espera su hora (o está lista para que la tome un worker)
  -- pendiente   falló una vez y espera su reintento (`proximo_intento_en`)
  -- procesando  un worker la tiene tomada
  -- enviada     el PROVEEDOR la aceptó (Resend, APNs, Google). No quiere decir que se vio.
  -- entregada   solo si el proveedor confirmó la entrega (hoy ningún canal lo confirma)
  -- omitida     se decidió no mandarla, con su motivo (sin consentimiento, condiciones…)
  -- fallida     se agotaron los reintentos, o el resultado quedó incierto
  -- cancelada   el impulso se pausó o se borró antes de que saliera
  estado text not null default 'programada'
    check (estado in ('programada', 'pendiente', 'procesando', 'enviada', 'entregada', 'omitida', 'fallida', 'cancelada')),
  intentos integer not null default 0,
  proximo_intento_en timestamptz,
  reclamada_en timestamptz,
  -- Se marca JUSTO ANTES de llamar al proveedor. Si el worker muere después de esta marca no se
  -- sabe si el mensaje salió: NO se reenvía solo (un correo doble es peor que uno perdido).
  envio_iniciado_en timestamptz,
  enviada_en timestamptz,
  entregada_en timestamptz,

  -- Por qué se omitió o falló: un código corto y un detalle SIN datos personales.
  motivo text check (motivo is null or motivo ~ '^[a-z][a-z0-9_]{2,59}$'),
  detalle text check (detalle is null or char_length(detalle) <= 400),
  -- Lo que se mandó, ya con las variables puestas (para el historial). Se llena al enviar.
  mensaje_titulo text check (mensaje_titulo is null or char_length(mensaje_titulo) <= 200),
  mensaje_cuerpo text check (mensaje_cuerpo is null or char_length(mensaje_cuerpo) <= 1200),
  version_impulso integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (impulso_id, clave)
);

-- Lo que mira el worker cada 5 minutos.
create index if not exists impulsos_tareas_vencidas_idx
  on public.impulsos_tareas (ejecutar_en) where estado in ('programada', 'pendiente');
create index if not exists impulsos_tareas_procesando_idx
  on public.impulsos_tareas (reclamada_en) where estado = 'procesando';
create index if not exists impulsos_tareas_impulso_idx
  on public.impulsos_tareas (impulso_id, created_at desc);
create index if not exists impulsos_tareas_miembro_idx
  on public.impulsos_tareas (miembro_id, enviada_en desc) where estado = 'enviada';
create index if not exists impulsos_tareas_rancho_idx
  on public.impulsos_tareas (rancho_id, created_at desc);

-- ------------------------------------------------------------
-- 4. RLS — lee quien gestiona el negocio; escribe SOLO el servidor
-- ------------------------------------------------------------
-- Mismo patrón que las tablas nuevas de lealtad (0125, 0183, 0197): SELECT para quien gestiona el
-- negocio (`gestiona_rancho`: dueño, colaborador o admin) y NINGUNA política de escritura. Toda
-- escritura pasa por una server action con la llave de servicio, que antes comprueba que la persona
-- es dueña o admin y que la tarjeta es de ese negocio. La bandeja de eventos no la lee nadie más
-- que el servidor: solo trae ids.
alter table public.impulsos_lealtad enable row level security;
alter table public.impulsos_eventos enable row level security;
alter table public.impulsos_tareas enable row level security;

drop policy if exists "Impulsos: los ve quien gestiona el negocio" on public.impulsos_lealtad;
create policy "Impulsos: los ve quien gestiona el negocio" on public.impulsos_lealtad
  for select to authenticated
  using (public.gestiona_rancho(rancho_id));

drop policy if exists "Tareas de impulsos: las ve quien gestiona el negocio" on public.impulsos_tareas;
create policy "Tareas de impulsos: las ve quien gestiona el negocio" on public.impulsos_tareas
  for select to authenticated
  using (public.gestiona_rancho(rancho_id));

-- Los privilegios por defecto de este proyecto no son de fiar: se piden explícitos.
revoke all on public.impulsos_lealtad from public, anon, authenticated;
revoke all on public.impulsos_eventos from public, anon, authenticated;
revoke all on public.impulsos_tareas from public, anon, authenticated;
grant select on public.impulsos_lealtad to authenticated;
grant select on public.impulsos_tareas to authenticated;
grant all on public.impulsos_lealtad to service_role;
grant all on public.impulsos_eventos to service_role;
grant all on public.impulsos_tareas to service_role;

-- ------------------------------------------------------------
-- 5. Los eventos — triggers que nunca rompen la operación original
-- ------------------------------------------------------------

-- ¿Esta tarjeta tiene al menos un impulso activo? Es lo que decide si vale la pena escribir un evento.
create or replace function public.impulsos_tiene_activos(p_programa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.impulsos_lealtad
     where programa_id = p_programa and estado = 'activo'
  );
$$;
revoke all on function public.impulsos_tiene_activos(uuid) from public, anon, authenticated;
grant execute on function public.impulsos_tiene_activos(uuid) to service_role;

-- 5a. Un cliente se inscribió.
create or replace function public.impulsos_evento_miembro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho uuid;
begin
  begin
    if new.estado is distinct from 'activa' then
      return new;
    end if;
    if not public.impulsos_tiene_activos(new.programa_id) then
      return new;
    end if;
    select rancho_id into v_rancho from public.programa_lealtad where id = new.programa_id;
    if v_rancho is null then
      return new;
    end if;
    insert into public.impulsos_eventos (rancho_id, programa_id, miembro_id, tipo, clave, ocurrido_en, datos)
    values (v_rancho, new.programa_id, new.id, 'inscripcion', 'miembro:' || new.id::text, now(),
            jsonb_build_object('origen', coalesce(to_jsonb(new) ->> 'origen', '')))
    on conflict (programa_id, tipo, clave) do nothing;
  exception when others then
    -- Un impulso perdido es un mensaje de menos; una inscripción perdida es un cliente de menos.
    raise warning 'impulsos_evento_miembro: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;
revoke all on function public.impulsos_evento_miembro() from public, anon, authenticated;

drop trigger if exists impulsos_evento_miembro on public.miembros;
create trigger impulsos_evento_miembro
  after insert on public.miembros
  for each row execute function public.impulsos_evento_miembro();

-- 5b. Se movió el ledger: un sello/puntos ganados o un canje.
-- Solo 'ganado' y 'canjeado'. Los 'ajuste' (correcciones, reversiones, vencimientos) no son algo que
-- el cliente hizo y no deben disparar un «gracias por tu visita».
create or replace function public.impulsos_evento_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programa uuid;
  v_rancho uuid;
begin
  begin
    if new.tipo not in ('ganado', 'canjeado') or new.reversion_de is not null then
      return new;
    end if;
    select programa_id into v_programa from public.miembros where id = new.miembro_id;
    if v_programa is null or not public.impulsos_tiene_activos(v_programa) then
      return new;
    end if;
    select rancho_id into v_rancho from public.programa_lealtad where id = v_programa;
    if v_rancho is null then
      return new;
    end if;
    insert into public.impulsos_eventos (rancho_id, programa_id, miembro_id, tipo, clave, ocurrido_en, datos)
    values (
      v_rancho, v_programa, new.miembro_id,
      case new.tipo when 'ganado' then 'ledger_ganado' else 'ledger_canjeado' end,
      'tx:' || new.id::text,
      coalesce(new.created_at, now()),
      jsonb_build_object(
        'puntos', new.puntos,
        'saldo_anterior', new.saldo_anterior,
        'saldo_posterior', new.saldo_posterior,
        'referencia', new.referencia
      )
    )
    on conflict (programa_id, tipo, clave) do nothing;
  exception when others then
    raise warning 'impulsos_evento_ledger: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;
revoke all on function public.impulsos_evento_ledger() from public, anon, authenticated;

drop trigger if exists impulsos_evento_ledger on public.transacciones_puntos;
create trigger impulsos_evento_ledger
  after insert on public.transacciones_puntos
  for each row execute function public.impulsos_evento_ledger();

-- 5c. Un iPhone registró el pase: el cliente lo agregó al Apple Wallet.
-- Es la señal fiable (PassKit llama a este registro solo cuando se agrega la tarjeta). La clave es el
-- NÚMERO DE SERIE del pase y no el dispositivo: un segundo iPhone, o quitar y volver a agregar el
-- mismo pase, es el mismo hecho y no vuelve a disparar. Google Wallet no tiene un aviso equivalente.
create or replace function public.impulsos_evento_pase_apple()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_miembro uuid;
  v_programa uuid;
  v_rancho uuid;
begin
  begin
    select miembro_id into v_miembro from public.pases_wallet where serial_number = new.serial_number;
    if v_miembro is null then
      return new;
    end if;
    select programa_id into v_programa from public.miembros where id = v_miembro;
    if v_programa is null or not public.impulsos_tiene_activos(v_programa) then
      return new;
    end if;
    select rancho_id into v_rancho from public.programa_lealtad where id = v_programa;
    if v_rancho is null then
      return new;
    end if;
    insert into public.impulsos_eventos (rancho_id, programa_id, miembro_id, tipo, clave, ocurrido_en, datos)
    values (v_rancho, v_programa, v_miembro, 'pase_apple', 'apple:' || new.serial_number, now(), '{}'::jsonb)
    on conflict (programa_id, tipo, clave) do nothing;
  exception when others then
    raise warning 'impulsos_evento_pase_apple: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end;
$$;
revoke all on function public.impulsos_evento_pase_apple() from public, anon, authenticated;

drop trigger if exists impulsos_evento_pase_apple on public.registros_dispositivo;
create trigger impulsos_evento_pase_apple
  after insert on public.registros_dispositivo
  for each row execute function public.impulsos_evento_pase_apple();

-- ------------------------------------------------------------
-- 6. Reclamar tareas — el control de concurrencia
-- ------------------------------------------------------------
-- Dos workers a la vez (una corrida que se pisa con la siguiente, o un reintento manual) no pueden
-- tomar la misma tarea: `FOR UPDATE SKIP LOCKED` hace que cada uno se lleve filas distintas, y el
-- UPDATE las deja en 'procesando' dentro de la misma sentencia.
--
-- Una tarea que quedó 'procesando' más de 10 minutos es de un worker que murió. Si ni siquiera había
-- llegado a llamar al proveedor (`envio_iniciado_en` vacío) vuelve a la cola; si ya lo había llamado
-- NO se sabe si salió, así que NO se reenvía: queda 'fallida' con `resultado_incierto` para que una
-- persona decida.
create or replace function public.impulsos_reclamar_tareas(
  p_limite integer default 50,
  p_ahora timestamptz default now()
)
returns setof public.impulsos_tareas
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.impulsos_tareas
     set estado = 'fallida',
         motivo = 'resultado_incierto',
         detalle = 'El envío se interrumpió y no se sabe si el mensaje salió. No se reenvía solo.',
         updated_at = p_ahora
   where estado = 'procesando'
     and reclamada_en < p_ahora - interval '10 minutes'
     and envio_iniciado_en is not null;

  update public.impulsos_tareas
     set estado = 'programada', reclamada_en = null, updated_at = p_ahora
   where estado = 'procesando'
     and reclamada_en < p_ahora - interval '10 minutes'
     and envio_iniciado_en is null;

  return query
  with elegidas as (
    select id
      from public.impulsos_tareas
     where estado in ('programada', 'pendiente')
       and ejecutar_en <= p_ahora
       and (proximo_intento_en is null or proximo_intento_en <= p_ahora)
     order by ejecutar_en
     limit greatest(1, least(coalesce(p_limite, 50), 200))
     for update skip locked
  )
  update public.impulsos_tareas t
     set estado = 'procesando',
         reclamada_en = p_ahora,
         intentos = t.intentos + 1,
         updated_at = p_ahora
    from elegidas e
   where t.id = e.id
  returning t.*;
end;
$$;
revoke all on function public.impulsos_reclamar_tareas(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.impulsos_reclamar_tareas(integer, timestamptz) to service_role;

-- ------------------------------------------------------------
-- 7. Inactivos — para el activador por tiempo
-- ------------------------------------------------------------
-- Los miembros activos de la tarjeta cuya ÚLTIMA actividad real cayó hace entre p_dias_min y p_dias_max
-- días (en la zona del negocio). Actividad real = un sello/puntos ganado o un canje, sin contar el sello
-- de bienvenida (`bienvenida:`), ni lo que se corrigió después (una reversión lo anula). Quien nunca
-- tuvo actividad NO aparece: no «dejó de venir», nunca empezó (es otro mensaje: la bienvenida).
-- El tope superior evita que activar el impulso le escriba, de golpe, a todos los que se fueron hace un año.
create or replace function public.impulsos_inactivos(
  p_programa uuid,
  p_hoy date,
  p_zona text,
  p_dias_min integer,
  p_dias_max integer,
  p_limite integer default 100
)
returns table (miembro_id uuid, ultima_actividad date)
language sql
stable
security definer
set search_path = public
as $$
  select m.id,
         max((t.created_at at time zone p_zona)::date) as ultima_actividad
    from public.miembros m
    join public.transacciones_puntos t on t.miembro_id = m.id
   where m.programa_id = p_programa
     and m.estado = 'activa'
     and t.tipo in ('ganado', 'canjeado')
     and t.reversion_de is null
     and (t.referencia is null or t.referencia not like 'bienvenida:%')
     and not exists (select 1 from public.transacciones_puntos r where r.reversion_de = t.id)
   group by m.id
  having (p_hoy - max((t.created_at at time zone p_zona)::date)) between p_dias_min and p_dias_max
   order by max((t.created_at at time zone p_zona)::date) asc
   limit greatest(1, least(coalesce(p_limite, 100), 500));
$$;
revoke all on function public.impulsos_inactivos(uuid, date, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.impulsos_inactivos(uuid, date, text, integer, integer, integer) to service_role;

notify pgrst, 'reload schema';
