
-- ============================================================
-- BOOKEA — El programa de lealtad se vuelve operable (0125)
--
-- La 0060 dejó el esqueleto (programa, miembros, ledger, canjes,
-- pases); la 0121/0122 la presentación; esta migración agrega lo que
-- falta para OPERAR: reglas de acumulación con topes, ciclo de vida
-- del programa, recompensas con stock y vigencia, el canje atómico, la
-- reversión auditable y la cola de eventos para el POS.
--
-- TODO aditivo: columnas anulables sin backfill, tablas nuevas, y dos
-- RPCs que concentran la parte transaccional. Ninguna fila existente
-- cambia de comportamiento.
--
-- ------------------------------------------------------------
-- DECISIONES QUE ESTA MIGRACIÓN FIJA (y por qué)
--
-- 1. El estado del programa es una columna NUEVA y anulable. La 0060
--    solo tenía el booleano `activo`; null acá = se deriva de él
--    (true→activo, false→pausado), así ningún programa necesita
--    backfill. 'borrador' y 'archivado' solo existen para filas que
--    los declaren a propósito.
--
-- 2. El ledger gana saldo_anterior/saldo_posterior POR MOVIMIENTO,
--    calculados DENTRO del RPC bajo advisory lock. El saldo sigue
--    siendo derivable (sum(puntos)); las dos columnas son la pista de
--    auditoría que permite detectar un ledger tocado a mano: si
--    saldo_posterior - saldo_anterior ≠ puntos, alguien escribió por
--    fuera. En movimientos viejos quedan null y no significan nada.
--
-- 3. La acumulación y el canje se mueven a SQL. En JS eran dos
--    consultas separadas (leer saldo, insertar) y dos peticiones
--    simultáneas podían gastar el mismo saldo. El advisory lock por
--    miembro serializa; el unique parcial (miembro_id, referencia) ya
--    existente sigue siendo la idempotencia.
--
-- 4. En SQL la fórmula de puntos NO necesita el truco de micro-tasa
--    entera que usa src/lib/lealtad/reglas.ts: `numeric` de Postgres
--    es decimal exacto, floor(0.29 * 100) = 29 de verdad. Las dos
--    implementaciones DEBEN dar lo mismo — los tests de reglas.ts son
--    el contrato.
--
-- 5. Los negocios "solo lealtad" NO son una vertical nueva. Se auditó
--    agregar vertical='lealtad' y hay una docena de caminos que caen
--    en silencio a la rama de eventos (el alta la degradaría sin error
--    visible). Un negocio de solo-lealtad es un rancho normal en
--    estado 'pendiente': la RLS de la 0008 ya lo hace invisible al
--    público, y NADA del módulo de lealtad exige estado='aprobado'.
--
-- 6. `registrarConsentimiento` (0082/0083) ya sirve para el opt-in de
--    marketing de lealtad con origen='lealtad' — no se duplica nada.
--    La inscripción NO otorga consentimiento de marketing: son dos
--    cosas y la spec lo exige separado.
-- ============================================================

-- ------------------------------------------------------------
-- 1. programa_lealtad: ciclo de vida + reglas de acumulación
-- ------------------------------------------------------------
alter table programa_lealtad add column if not exists estado text;
alter table programa_lealtad add column if not exists compra_minima integer;
alter table programa_lealtad add column if not exists max_por_transaccion integer;
alter table programa_lealtad add column if not exists max_diario_cliente integer;
alter table programa_lealtad add column if not exists inicio date;
alter table programa_lealtad add column if not exists fin date;
alter table programa_lealtad add column if not exists terminos text;

alter table programa_lealtad drop constraint if exists programa_lealtad_estado_check;
alter table programa_lealtad add constraint programa_lealtad_estado_check
  check (estado is null or estado in ('borrador', 'activo', 'pausado', 'archivado'));

alter table programa_lealtad drop constraint if exists programa_lealtad_reglas_check;
alter table programa_lealtad add constraint programa_lealtad_reglas_check
  check (
    (compra_minima is null or compra_minima between 0 and 10000000)
    and (max_por_transaccion is null or max_por_transaccion between 1 and 100000)
    and (max_diario_cliente is null or max_diario_cliente between 1 and 100000)
    and (fin is null or inicio is null or fin >= inicio)
    and (terminos is null or char_length(terminos) <= 2000)
  );

comment on column programa_lealtad.estado is
  'Ciclo de vida (0125): borrador/activo/pausado/archivado. null = se '
  'deriva del booleano activo de la 0060 (true=activo, false=pausado). '
  'Solo el ACTIVO acumula y canjea; pausado conserva todo.';

-- ------------------------------------------------------------
-- 2. recompensas: tipo, valor, stock, vigencia, límites, POS
-- ------------------------------------------------------------
alter table recompensas add column if not exists tipo text;
alter table recompensas add column if not exists valor numeric;
alter table recompensas add column if not exists imagen_url text;
alter table recompensas add column if not exists vigencia_desde date;
alter table recompensas add column if not exists vigencia_hasta date;
alter table recompensas add column if not exists stock_total integer;
alter table recompensas add column if not exists limite_por_cliente integer;
alter table recompensas add column if not exists sku text;
alter table recompensas add column if not exists instrucciones text;

alter table recompensas drop constraint if exists recompensas_detalle_check;
alter table recompensas add constraint recompensas_detalle_check
  check (
    (tipo is null or tipo in
      ('producto', 'servicio', 'descuento_porcentaje', 'descuento_fijo', 'personalizada'))
    -- El valor solo tiene sentido en los descuentos, y con rangos
    -- distintos: un porcentaje de 150% o un fijo negativo son errores
    -- de digitación que no deben poder guardarse.
    and (tipo is distinct from 'descuento_porcentaje'
         or (valor is not null and valor > 0 and valor <= 100))
    and (tipo is distinct from 'descuento_fijo'
         or (valor is not null and valor > 0 and valor <= 10000000))
    and (imagen_url is null or imagen_url ~ '^https://')
    and (vigencia_hasta is null or vigencia_desde is null or vigencia_hasta >= vigencia_desde)
    and (stock_total is null or stock_total between 1 and 1000000)
    and (limite_por_cliente is null or limite_por_cliente between 1 and 10000)
    and (sku is null or char_length(sku) <= 60)
    and (instrucciones is null or char_length(instrucciones) <= 500)
  );

comment on column recompensas.stock_total is
  'Cuántas se pueden canjear EN TOTAL (0125). null = sin límite. NO es '
  'un contador que se descuenta: el RPC cuenta los canjes no anulados '
  'contra este tope, así el número nunca se desincroniza.';

-- El conteo de stock y de límite por cliente necesita este índice: sin
-- él, cada canje escanearía la tabla entera de canjes.
create index if not exists canjes_recompensa_idx on canjes (recompensa_id)
  where estado <> 'anulado';
create index if not exists canjes_miembro_idx on canjes (miembro_id, created_at desc);

-- ------------------------------------------------------------
-- 3. miembros: origen de inscripción + administración del negocio
-- ------------------------------------------------------------
alter table miembros add column if not exists origen text;
alter table miembros drop constraint if exists miembros_origen_check;
alter table miembros add constraint miembros_origen_check
  check (origen is null or char_length(origen) <= 40);

comment on column miembros.origen is
  'Cómo se inscribió (0125): wallet (bajó su pase), panel (lo inscribió '
  'el negocio). null = anterior a esta migración. La inscripción NO '
  'implica consentimiento de marketing: eso vive en consentimientos '
  '(0082) con origen=lealtad, y es un paso aparte.';

-- La 0060 dejó a miembros SIN política de UPDATE: ni el negocio podía
-- pausar una membresía desde el navegador. Quien administra el negocio
-- puede cambiarle el estado; el cliente sigue sin poder tocarla (no
-- hay política para él, y así un cliente no se reactiva solo).
drop policy if exists "El negocio administra sus membresías" on miembros;
create policy "El negocio administra sus membresías" on miembros
  for update to authenticated
  using (exists (
    select 1 from programa_lealtad p
    where p.id = programa_id and gestiona_rancho(p.rancho_id)
  ))
  with check (exists (
    select 1 from programa_lealtad p
    where p.id = programa_id and gestiona_rancho(p.rancho_id)
  ));
grant update on miembros to authenticated;

-- ------------------------------------------------------------
-- 4. transacciones_puntos: auditoría del movimiento
-- ------------------------------------------------------------
alter table transacciones_puntos add column if not exists saldo_anterior integer;
alter table transacciones_puntos add column if not exists saldo_posterior integer;
alter table transacciones_puntos add column if not exists reglas jsonb;
alter table transacciones_puntos add column if not exists usuario_id uuid
  references auth.users(id) on delete set null;
alter table transacciones_puntos add column if not exists reversion_de uuid
  references transacciones_puntos(id) on delete set null;

-- Un movimiento se revierte UNA vez: el segundo intento choca acá y no
-- hay forma de duplicar la compensación ni con dos clics simultáneos.
create unique index if not exists transacciones_puntos_reversion_unica
  on transacciones_puntos (reversion_de) where reversion_de is not null;

comment on column transacciones_puntos.reglas is
  'Snapshot de las reglas vigentes al momento del movimiento (0125). '
  'Cambiar el programa después NO reinterpreta lo ya otorgado: cada '
  'fila carga las reglas con las que se calculó.';

-- ------------------------------------------------------------
-- 5. canjes: auditoría de entrega, idempotencia y POS manual
-- ------------------------------------------------------------
alter table canjes add column if not exists entregado_en timestamptz;
alter table canjes add column if not exists entregado_por uuid
  references auth.users(id) on delete set null;
alter table canjes add column if not exists anulado_motivo text;
alter table canjes add column if not exists transaccion_id uuid
  references transacciones_puntos(id) on delete set null;
alter table canjes add column if not exists referencia text;
alter table canjes add column if not exists factura_ref text;
alter table canjes add column if not exists pos_registrado_en timestamptz;
alter table canjes add column if not exists pos_registrado_por uuid
  references auth.users(id) on delete set null;

alter table canjes drop constraint if exists canjes_textos_check;
alter table canjes add constraint canjes_textos_check
  check (
    (anulado_motivo is null or char_length(anulado_motivo) <= 200)
    and (referencia is null or char_length(referencia) <= 100)
    and (factura_ref is null or char_length(factura_ref) <= 60)
  );

-- La idempotencia del canje: un doble POST con la misma referencia
-- crea UN canje. (El débito del ledger ya tenía la suya.)
create unique index if not exists canjes_referencia_unica
  on canjes (miembro_id, referencia) where referencia is not null;

comment on column canjes.transaccion_id is
  'El débito del ledger que pagó este canje (0125). La 0060 los dejaba '
  'sueltos y la consistencia canje↔ledger era pura convención.';

-- ------------------------------------------------------------
-- 6. integraciones_pos + eventos_integracion (la cola)
-- ------------------------------------------------------------
create table if not exists integraciones_pos (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null unique references ranchos(id) on delete cascade,
  -- 'manual' = Bookea le dice al personal qué poner en la factura y
  -- alguien lo marca como registrado. 'api' queda declarado para el
  -- primer proveedor real; hoy no existe ninguno.
  modo text not null default 'manual' check (modo in ('manual', 'api')),
  proveedor text check (proveedor is null or char_length(proveedor) <= 40),
  -- Configuración NO sensible (urls, ids de tienda). Los secretos van
  -- en variables de entorno, jamás acá.
  config jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table integraciones_pos enable row level security;

drop policy if exists "Quien administra el negocio ve su integración" on integraciones_pos;
create policy "Quien administra el negocio ve su integración" on integraciones_pos
  for all to authenticated
  using (gestiona_rancho(rancho_id))
  with check (gestiona_rancho(rancho_id));

grant select, insert, update, delete on integraciones_pos to authenticated;
grant all on integraciones_pos to service_role;

create table if not exists eventos_integracion (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  tipo text not null check (tipo in ('canje', 'acumulacion', 'reversion')),
  payload jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'fallido', 'descartado')),
  intentos integer not null default 0 check (intentos >= 0),
  ultimo_error text check (ultimo_error is null or char_length(ultimo_error) <= 500),
  proximo_intento_en timestamptz,
  referencia_externa text check (
    referencia_externa is null or char_length(referencia_externa) <= 100
  ),
  -- El outbox no procesa el mismo evento dos veces aunque el worker se
  -- reinicie a mitad de corrida.
  idempotencia text unique check (
    idempotencia is null or char_length(idempotencia) <= 120
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eventos_integracion_cola_idx
  on eventos_integracion (proximo_intento_en)
  where estado in ('pendiente', 'fallido');
create index if not exists eventos_integracion_rancho_idx
  on eventos_integracion (rancho_id, created_at desc);

alter table eventos_integracion enable row level security;

-- El dueño VE su cola (la pantalla de Integraciones); solo el servidor
-- escribe — un evento fabricado desde el navegador sería una venta
-- inventada en el POS.
drop policy if exists "Quien administra el negocio ve sus eventos" on eventos_integracion;
create policy "Quien administra el negocio ve sus eventos" on eventos_integracion
  for select to authenticated
  using (gestiona_rancho(rancho_id));

grant select on eventos_integracion to authenticated;
grant all on eventos_integracion to service_role;

-- ------------------------------------------------------------
-- 7. RPC: acreditar_lealtad — la acumulación atómica
-- ------------------------------------------------------------
create or replace function public.acreditar_lealtad(
  p_miembro_id uuid,
  p_monto integer,      -- colones enteros; null = visita sin monto
  p_referencia text,    -- llave de idempotencia; null = siempre entra
  p_usuario_id uuid,    -- quién lo originó; null = sistema
  p_motivo text
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

  -- La MISMA fórmula que reglas.ts. `numeric` es decimal exacto: acá
  -- floor(0.29 × 100) = 29 sin el truco de micro-tasa del lado JS.
  v_puntos := v_programa.puntos_por_visita
              + coalesce(floor(v_programa.puntos_por_colon * p_monto)::int, 0);
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
         'monto', p_monto));
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

-- ------------------------------------------------------------
-- 8. RPC: canjear_recompensa — el canje atómico
-- ------------------------------------------------------------
create or replace function public.canjear_recompensa(
  p_miembro_id uuid,
  p_recompensa_id uuid,
  p_usuario_id uuid,
  p_referencia text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_miembro record;
  v_programa record;
  v_rec record;
  v_estado text;
  v_hoy date;
  v_saldo integer;
  v_canjeados integer;
  v_del_cliente integer;
  v_tx_id uuid;
  v_canje_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('lealtad:' || p_miembro_id::text));

  select m.id, m.estado, m.programa_id into v_miembro
  from miembros m where m.id = p_miembro_id;
  if v_miembro.id is null or v_miembro.estado <> 'activa' then
    return jsonb_build_object('ok', false, 'motivo', 'Esa membresía no está activa.');
  end if;

  select p.*, r.zona_horaria into v_programa
  from programa_lealtad p join ranchos r on r.id = p.rancho_id
  where p.id = v_miembro.programa_id;

  v_estado := coalesce(v_programa.estado,
                       case when v_programa.activo then 'activo' else 'pausado' end);
  if v_estado <> 'activo' then
    return jsonb_build_object('ok', false, 'motivo',
      'El programa está en estado ' || v_estado || ' y no canjea.');
  end if;

  select * into v_rec from recompensas where id = p_recompensa_id;
  if v_rec.id is null or v_rec.programa_id <> v_miembro.programa_id then
    -- El mismo mensaje para "no existe" y "es de otro programa": no se
    -- delata qué recompensas existen fuera de este negocio.
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa no está disponible.');
  end if;
  if not v_rec.activo then
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa está desactivada.');
  end if;

  v_hoy := (now() at time zone coalesce(v_programa.zona_horaria, 'America/Costa_Rica'))::date;
  if v_rec.vigencia_desde is not null and v_hoy < v_rec.vigencia_desde then
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa todavía no está vigente.');
  end if;
  if v_rec.vigencia_hasta is not null and v_hoy > v_rec.vigencia_hasta then
    return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa ya venció.');
  end if;

  -- Stock y límite por cliente se CUENTAN bajo el lock, no se
  -- descuentan de un contador: el número nunca se desincroniza. Los
  -- anulados no ocupan stock.
  if v_rec.stock_total is not null then
    select count(*) into v_canjeados from canjes
    where recompensa_id = p_recompensa_id and estado <> 'anulado';
    if v_canjeados >= v_rec.stock_total then
      return jsonb_build_object('ok', false, 'motivo', 'Esa recompensa se agotó.');
    end if;
  end if;
  if v_rec.limite_por_cliente is not null then
    select count(*) into v_del_cliente from canjes
    where recompensa_id = p_recompensa_id and miembro_id = p_miembro_id
      and estado <> 'anulado';
    if v_del_cliente >= v_rec.limite_por_cliente then
      return jsonb_build_object('ok', false, 'motivo',
        'Este cliente ya canjeó su máximo de esa recompensa.');
    end if;
  end if;

  select coalesce(sum(puntos), 0) into v_saldo
  from transacciones_puntos where miembro_id = p_miembro_id;
  if v_saldo < v_rec.costo_puntos then
    return jsonb_build_object('ok', false, 'motivo',
      'Saldo insuficiente: tiene ' || v_saldo || ' y la recompensa cuesta '
      || v_rec.costo_puntos || '.');
  end if;

  -- Débito y canje EN LA MISMA transacción, atados por transaccion_id.
  -- La 0060 los dejaba sueltos y la consistencia era pura convención.
  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, referencia,
       saldo_anterior, saldo_posterior, usuario_id)
    values
      (p_miembro_id, 'canjeado', -v_rec.costo_puntos,
       'Canje: ' || v_rec.nombre, nullif(trim(p_referencia), ''),
       v_saldo, v_saldo - v_rec.costo_puntos, p_usuario_id)
    returning id into v_tx_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'ya-canjeado', 'saldo', v_saldo);
  end;

  insert into canjes
    (miembro_id, recompensa_id, puntos, estado, transaccion_id,
     entregado_en, entregado_por, referencia)
  values
    (p_miembro_id, p_recompensa_id, v_rec.costo_puntos, 'entregado', v_tx_id,
     now(), p_usuario_id, nullif(trim(p_referencia), ''))
  returning id into v_canje_id;

  update pases_wallet
     set saldo_cache = v_saldo - v_rec.costo_puntos, actualizado_en = now()
   where miembro_id = p_miembro_id;

  return jsonb_build_object('ok', true, 'canje_id', v_canje_id,
    'saldo', v_saldo - v_rec.costo_puntos, 'recompensa', v_rec.nombre,
    'sku', v_rec.sku, 'instrucciones', v_rec.instrucciones);
end;
$$;

-- ------------------------------------------------------------
-- 9. RPC: revertir_movimiento — la compensación auditable
-- ------------------------------------------------------------
create or replace function public.revertir_movimiento(
  p_transaccion_id uuid,
  p_usuario_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx record;
  v_saldo integer;
begin
  select * into v_tx from transacciones_puntos where id = p_transaccion_id;
  if v_tx.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Ese movimiento no existe.');
  end if;
  if v_tx.reversion_de is not null then
    return jsonb_build_object('ok', false, 'motivo',
      'Una reversión no se revierte: se registra el movimiento correcto.');
  end if;

  perform pg_advisory_xact_lock(hashtext('lealtad:' || v_tx.miembro_id::text));

  select coalesce(sum(puntos), 0) into v_saldo
  from transacciones_puntos where miembro_id = v_tx.miembro_id;

  -- El unique parcial sobre reversion_de garantiza UNA compensación
  -- por movimiento, aun con dos clics simultáneos.
  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, saldo_anterior, saldo_posterior,
       usuario_id, reversion_de)
    values
      (v_tx.miembro_id, 'ajuste', -v_tx.puntos,
       coalesce(nullif(trim(p_motivo), ''), 'Reversión'),
       v_saldo, v_saldo - v_tx.puntos, p_usuario_id, v_tx.id);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'motivo', 'Ese movimiento ya fue revertido.');
  end;

  -- Si el movimiento pagaba un canje, el canje queda anulado con su
  -- motivo — y deja de ocupar stock.
  update canjes
     set estado = 'anulado',
         anulado_motivo = coalesce(nullif(trim(p_motivo), ''), 'Movimiento revertido')
   where transaccion_id = v_tx.id and estado <> 'anulado';

  update pases_wallet
     set saldo_cache = v_saldo - v_tx.puntos, actualizado_en = now()
   where miembro_id = v_tx.miembro_id;

  return jsonb_build_object('ok', true, 'saldo', v_saldo - v_tx.puntos);
end;
$$;

-- ------------------------------------------------------------
-- 10. Permisos de los RPC
-- ------------------------------------------------------------
-- La 0083 revocó EXECUTE por defecto a toda función nueva del schema:
-- sin estos grants explícitos, los tres RPC fallan con permission
-- denied aunque existan. Van SOLO a service_role: la identidad y el
-- acceso al negocio los comprueba el servidor ANTES de invocar — un
-- cliente autenticado no puede acreditarse puntos ni canjearse nada.
revoke all on function public.acreditar_lealtad(uuid, integer, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.canjear_recompensa(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.revertir_movimiento(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.acreditar_lealtad(uuid, integer, text, uuid, text)
  to service_role;
grant execute on function public.canjear_recompensa(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.revertir_movimiento(uuid, uuid, text)
  to service_role;
