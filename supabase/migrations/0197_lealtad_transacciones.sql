-- ============================================================
-- BOOKEA — Loyalty Intelligence: el evento comercial (0197)
--
-- El sello no es el dato principal; LA COMPRA QUE LO GENERA sí.
-- Hasta hoy el módulo guarda el efecto (transacciones_puntos: +1
-- sello) y pierde la causa (¿cuánto se gastó? ¿en qué?). Esta
-- migración agrega `lealtad_transacciones`: una fila por evento
-- comercial del mostrador — monto, producto, qué otorgó — para que
-- Wallet y QR sigan siendo interfaces y el backend conserve la venta.
--
-- La tabla es ADITIVA: el flujo actual de sellos, canjes y pases no
-- cambia de comportamiento. El código escribe acá "de paso" al
-- acreditar, y si esta migración no está pegada degrada en silencio
-- (mismo patrón que el resto del panel).
--
-- También se amplía `acreditar_lealtad` con un parámetro opcional
-- `p_sellos`: la regla nueva «1 sello por cada ₡X de compra»
-- (beneficio jsonb: sellosPor = "monto") la calcula el SERVIDOR con
-- floor(monto / montoPorSello) y se la pasa al RPC, que la somete a
-- los mismos topes de siempre. Sin el parámetro, el RPC se comporta
-- EXACTAMENTE igual que desde la 0125.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. lealtad_transacciones — el evento comercial del mostrador
-- ------------------------------------------------------------
-- La referencia al cliente es `miembro_id`, el MISMO patrón que el
-- ledger (transacciones_puntos, 0060): del miembro salen el pase y la
-- persona. `rancho_id` y `programa_id` van desnormalizados a propósito:
-- son el eje de TODAS las lecturas (métricas por negocio y por
-- programa) y de la RLS, y así una consulta no necesita tres joins.
create table if not exists lealtad_transacciones (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  programa_id uuid not null references programa_lealtad(id) on delete cascade,
  -- Mismo criterio que el ledger: si el miembro se borra (el cliente
  -- eliminó su cuenta), su historial comercial se va con él.
  miembro_id uuid not null references miembros(id) on delete cascade,
  -- Colones. null = compra sin monto: el flujo actual (sello por
  -- visita, sin preguntar cuánto) sigue valiendo tal cual.
  monto numeric check (monto is null or (monto >= 0 and monto <= 10000000)),
  -- Producto o concepto, en palabras del negocio ("Matcha latte").
  producto text check (producto is null or char_length(producto) <= 120),
  -- Qué otorgó este evento. Sellos para tarjetas de sellos; puntos
  -- (o colones de cashback/gift card) para las demás.
  sellos_otorgados integer not null default 0
    check (sellos_otorgados >= 0 and sellos_otorgados <= 100000),
  puntos_otorgados numeric check (puntos_otorgados is null or puntos_otorgados >= 0),
  -- Si el evento fue un canje, acá queda enlazado. Hoy los canjes se
  -- leen de `canjes` (0060/0125); la columna existe para poder anclar
  -- el canje a su venta sin otra migración.
  canje_id uuid references canjes(id) on delete set null,
  -- La MISMA referencia de idempotencia que entró al ledger
  -- (escaneo:serial:intento, panel:…, o el número de factura): con
  -- ella una fila de acá se cruza con su movimiento de sellos.
  referencia text check (referencia is null or char_length(referencia) <= 100),
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table lealtad_transacciones is
  'El EVENTO COMERCIAL detrás de cada sello (0197): monto, producto y '
  'qué otorgó. El ledger (transacciones_puntos) sigue siendo la fuente '
  'de verdad del saldo; esta tabla es la fuente de verdad de la VENTA. '
  'Escribe solo el servidor; el negocio la lee a través del panel.';

-- Los dos ejes de lectura (métricas por negocio y por programa)…
create index if not exists lealtad_transacciones_rancho_idx
  on lealtad_transacciones (rancho_id, created_at desc);
create index if not exists lealtad_transacciones_programa_idx
  on lealtad_transacciones (programa_id, created_at desc);
-- …el FK de miembros (sin él, borrar un miembro escanea la tabla)…
create index if not exists lealtad_transacciones_miembro_idx
  on lealtad_transacciones (miembro_id, created_at desc);
create index if not exists lealtad_transacciones_canje_idx
  on lealtad_transacciones (canje_id) where canje_id is not null;
-- …y la idempotencia: un reintento del mostrador (misma llave de
-- intento) no registra la misma compra dos veces.
create unique index if not exists lealtad_transacciones_referencia_unica
  on lealtad_transacciones (rancho_id, referencia)
  where referencia is not null;

alter table lealtad_transacciones enable row level security;

-- Lee quien administra el negocio (dueño o equipo, mismo criterio que
-- el resto de las tablas de lealtad desde la 0125: gestiona_rancho).
-- anon no ve NADA. Escribir, solo el servidor con la service key: una
-- venta fabricada desde el navegador sería una métrica inventada, así
-- que no hay política de insert/update/delete a propósito.
drop policy if exists "Quien administra el negocio lee sus transacciones"
  on lealtad_transacciones;
create policy "Quien administra el negocio lee sus transacciones"
  on lealtad_transacciones
  for select to authenticated
  using (gestiona_rancho(rancho_id));

grant select on lealtad_transacciones to authenticated;
grant all on lealtad_transacciones to service_role;

-- ------------------------------------------------------------
-- 2. acreditar_lealtad gana `p_sellos` (opcional)
-- ------------------------------------------------------------
-- La regla «1 sello por cada ₡X» no cabe en la fórmula de la 0125
-- (puntos_por_visita + floor(puntos_por_colon × monto)): 1/4500 no es
-- representable exacto y floor lo redondearía mal justo en los
-- múltiplos. El servidor calcula floor(monto / montoPorSello) leyendo
-- el beneficio de la base — nunca el navegador — y lo pasa acá, donde
-- se le aplican los MISMOS topes y validaciones de siempre.
--
-- Se borra la firma vieja antes de crear la nueva: dos firmas
-- conviviendo harían ambigua la llamada de 5 argumentos que hace todo
-- el código existente. Con `default null`, esas llamadas siguen
-- entrando igual y se comportan igual.
drop function if exists public.acreditar_lealtad(uuid, integer, text, uuid, text);

create or replace function public.acreditar_lealtad(
  p_miembro_id uuid,
  p_monto integer,      -- colones enteros; null = visita sin monto
  p_referencia text,    -- llave de idempotencia; null = siempre entra
  p_usuario_id uuid,    -- quién lo originó; null = sistema
  p_motivo text,
  -- Sellos YA CALCULADOS por el servidor (regla por monto, 0197).
  -- null = la fórmula de la 0125, exactamente como siempre.
  p_sellos integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_miembro record;
  v_programa record;
  v_zona text;
  v_hoy date;
  v_otorgados_hoy integer;
  v_puntos integer;
  v_saldo integer;
  v_estado text;
begin
  if p_monto is not null and p_monto < 0 then
    return jsonb_build_object('otorgado', false, 'motivo', 'El monto no puede ser negativo.');
  end if;
  if p_sellos is not null and p_sellos < 0 then
    return jsonb_build_object('otorgado', false, 'motivo', 'Los sellos no pueden ser negativos.');
  end if;

  -- El lock serializa TODO el movimiento de este miembro: dos cajas
  -- acreditando a la vez no pueden leer el mismo saldo.
  perform pg_advisory_xact_lock(hashtext('lealtad:' || p_miembro_id::text));

  select m.id, m.estado, m.programa_id into v_miembro
  from miembros m where m.id = p_miembro_id;
  if v_miembro.id is null then
    return jsonb_build_object('otorgado', false, 'motivo', 'Esa membresía no existe.');
  end if;
  if v_miembro.estado <> 'activa' then
    return jsonb_build_object('otorgado', false, 'motivo',
      'Esa membresía está ' || v_miembro.estado || '.');
  end if;

  select p.*, r.zona_horaria into v_programa
  from programa_lealtad p join ranchos r on r.id = p.rancho_id
  where p.id = v_miembro.programa_id;

  -- Estado efectivo: la columna nueva manda; sin ella, el booleano de
  -- la 0060. Mismo criterio que estadoDelPrograma en reglas.ts.
  v_estado := coalesce(v_programa.estado,
                       case when v_programa.activo then 'activo' else 'pausado' end);
  if v_estado <> 'activo' then
    return jsonb_build_object('otorgado', false, 'motivo',
      'El programa está en estado ' || v_estado || ' y no acumula.');
  end if;

  v_zona := coalesce(v_programa.zona_horaria, 'America/Costa_Rica');
  v_hoy := (now() at time zone v_zona)::date;

  if v_programa.inicio is not null and v_hoy < v_programa.inicio then
    return jsonb_build_object('otorgado', false, 'motivo', 'El programa todavía no arranca.');
  end if;
  if v_programa.fin is not null and v_hoy > v_programa.fin then
    return jsonb_build_object('otorgado', false, 'motivo', 'El programa ya terminó.');
  end if;

  -- La compra mínima solo aplica si la operación TRAE monto (una
  -- tarjeta de sellos pura no pregunta cuánto se gastó).
  if v_programa.compra_minima is not null and p_monto is not null
     and p_monto < v_programa.compra_minima then
    return jsonb_build_object('otorgado', false, 'motivo',
      'La compra mínima para acumular es ₡' || v_programa.compra_minima || '.');
  end if;

  -- p_sellos manda cuando viene (regla por monto, calculada en el
  -- servidor); si no, la MISMA fórmula que reglas.ts desde la 0125.
  v_puntos := coalesce(p_sellos,
              v_programa.puntos_por_visita
              + coalesce(floor(v_programa.puntos_por_colon * p_monto)::int, 0));
  if v_puntos <= 0 then
    return jsonb_build_object('otorgado', false, 'motivo', 'Esta operación no genera puntos.');
  end if;
  if v_programa.max_por_transaccion is not null and v_puntos > v_programa.max_por_transaccion then
    v_puntos := v_programa.max_por_transaccion;
  end if;

  if v_programa.max_diario_cliente is not null then
    select coalesce(sum(t.puntos), 0) into v_otorgados_hoy
    from transacciones_puntos t
    where t.miembro_id = p_miembro_id and t.tipo = 'ganado'
      and (t.created_at at time zone v_zona)::date = v_hoy;
    if v_otorgados_hoy >= v_programa.max_diario_cliente then
      return jsonb_build_object('otorgado', false, 'motivo',
        'Este cliente ya llegó a su tope de hoy.');
    end if;
    v_puntos := least(v_puntos, v_programa.max_diario_cliente - v_otorgados_hoy);
  end if;

  select coalesce(sum(puntos), 0) into v_saldo
  from transacciones_puntos where miembro_id = p_miembro_id;

  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, referencia,
       saldo_anterior, saldo_posterior, usuario_id, reglas)
    values
      (p_miembro_id, 'ganado', v_puntos,
       coalesce(nullif(trim(p_motivo), ''), 'Acumulación'),
       nullif(trim(p_referencia), ''),
       v_saldo, v_saldo + v_puntos, p_usuario_id,
       jsonb_build_object(
         'puntos_por_visita', v_programa.puntos_por_visita,
         'puntos_por_colon', v_programa.puntos_por_colon,
         'compra_minima', v_programa.compra_minima,
         'max_por_transaccion', v_programa.max_por_transaccion,
         'max_diario_cliente', v_programa.max_diario_cliente,
         'monto', p_monto,
         'sellos_fijos', p_sellos));
  exception when unique_violation then
    -- La referencia ya entró: mismo evento, segunda petición. No es un
    -- error — es la idempotencia haciendo su trabajo.
    return jsonb_build_object('otorgado', false, 'motivo', 'ya-otorgado', 'saldo', v_saldo);
  end;

  update pases_wallet
     set saldo_cache = v_saldo + v_puntos, actualizado_en = now()
   where miembro_id = p_miembro_id;

  return jsonb_build_object('otorgado', true, 'puntos', v_puntos, 'saldo', v_saldo + v_puntos);
end;
$$;

-- Permisos: mismo criterio que la 0125 — la 0083 revocó EXECUTE por
-- defecto, y este RPC va SOLO a service_role. La identidad y el acceso
-- al negocio los comprueba el servidor ANTES de invocar: un cliente
-- autenticado no puede acreditarse sellos, con o sin p_sellos.
revoke all on function public.acreditar_lealtad(uuid, integer, text, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.acreditar_lealtad(uuid, integer, text, uuid, text, integer)
  to service_role;
