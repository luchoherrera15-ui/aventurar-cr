
-- ============================================================
-- BOOKEA — La reversión no endeuda, y la cuenta no se roba (0139)
--
-- Dos agujeros que la auditoría marcó como críticos. No comparten
-- tabla ni mecanismo: comparten que los dos se disparan con UN clic y
-- que los dos terminan con el negocio explicándole a un cliente algo
-- indefendible.
--
-- ── 1. REVERTIR PODÍA DEJAR AL CLIENTE DEBIENDO ─────────────────────
--
-- `revertir_movimiento` (0125:573-579) inserta la compensación sin
-- mirar en qué queda el saldo. Secuencia real, cada paso un clic:
--
--     se acreditan +500 por error
--       → el cliente canja un premio de 500
--         → el dueño revierte la acreditación
--           → saldo = -500
--
-- El premio ya salió por la puerta y el cliente queda arrastrando una
-- deuda que nunca contrajo: el panel le muestra «-500» y sus próximas
-- visitas se las come el hueco antes de volver a valer algo. Nadie lo
-- impedía: `transacciones_puntos` solo restringe el SIGNO por tipo
-- (0060:172-176) y NADA mira `sum(puntos)` — ni puede, porque el saldo
-- es un agregado de muchas filas y eso no se declara en un check.
--
-- El arreglo va DENTRO del advisory lock que la función ya toma: es el
-- único punto donde el saldo que se leyó todavía vale cuando se
-- escribe. Si la compensación dejaría el saldo bajo cero, NO se
-- escribe nada y se devuelve el motivo.
--
-- El dueño no queda sin salida, queda con el orden correcto: primero
-- se revierte el CANJE —eso le devuelve los puntos al cliente y libera
-- el stock— y después la acreditación equivocada. Así el error se
-- deshace entero y nadie termina debiendo.
--
-- Revertir un canje jamás cae en esta guarda: su compensación SUMA.
-- La única que puede caer es la reversión de una acreditación cuyos
-- puntos ya se gastaron, que es exactamente el caso del reporte.
--
-- ── 2. LA POLICY DE INSERT DE `cuentas` REGALABA EL RANCHO AJENO ────
--
-- La 0134 crea `cuentas` con
--     with check (owner_id = auth.uid())            (0134:203-206)
-- y le da insert a `authenticated` (0134:232). Ese check no dice NADA
-- de `rancho_id`. O sea que cualquier usuario con sesión puede crear
-- una fila de `cuentas` A SU NOMBRE apuntando al rancho de otro
-- negocio; alcanza con que ese rancho todavía no tenga cuenta, porque
-- `rancho_id` es unique (0134:89).
--
-- Lo que se lleva el atacante no es una fila: queda de `owner_id` de
-- una cuenta ligada al negocio ajeno, así que `pertenece_a_cuenta()`
-- le devuelve verdadero — y desde la 0138 ESA función es la llave de
-- lectura de `personas`, `personas_negocio` y
-- `consentimientos_persona`. O sea los datos personales de la
-- clientela de otro negocio: nombres, correos, teléfonos y el
-- respaldo de sus consentimientos. De yapa le tapa al dueño real la
-- única fila de `cuentas` que su rancho puede llegar a tener.
--
-- El arreglo son DOS piezas, porque con una sola el robo se hace en
-- dos pasos:
--   · el `with check` del INSERT exige además gestionar ese rancho;
--   · un trigger impide MUDAR `rancho_id` en un UPDATE. Sin él se
--     inserta limpio (`rancho_id` null, que es perfectamente
--     legítimo: una cuenta de solo-lealtad no tiene rancho) y después
--     se reapunta.
--
-- Trigger y no un `with check` en la política de UPDATE: esa política
-- es `gestiona_cuenta(id)`, que incluye al ADMINISTRADOR INVITADO
-- (0134:144-162). Meterle la condición del rancho le prohibiría a ese
-- administrador hasta cambiarle el nombre a la cuenta, porque el check
-- se evalúa sobre la fila entera aunque el UPDATE no toque
-- `rancho_id`. El trigger solo se despierta cuando `rancho_id` cambia,
-- que es el único momento peligroso.
--
-- Se comprobó antes de apretar: NADIE escribe `cuentas` desde el
-- código (src/ y mobile/ solo hacen `select` — cuenta.ts:86 y
-- crear-actions.ts:152). Esta migración no le rompe ningún camino al
-- producto de hoy.
--
-- ── EL ORDEN DE PEGADO IMPORTA ──────────────────────────────────────
--
-- La sección 2 tolera que la 0134 todavía no esté pegada (guarda con
-- `to_regclass`) para no abortar el archivo entero — pero entonces NO
-- ARREGLA NADA: no hay tabla sobre la cual poner la política. Si esta
-- migración se pega ANTES que la 0134, hay que VOLVER A PEGARLA
-- después. Sale un NOTICE avisándolo.
--
-- Aditiva e idempotente. Correrla dos veces es seguro.
-- ============================================================


-- ------------------------------------------------------------
-- 1. revertir_movimiento: la compensación no puede endeudar
-- ------------------------------------------------------------
-- Se reemplaza la función entera (`create or replace`) en vez de
-- parchar: es la forma idempotente y deja el cuerpo completo a la
-- vista de quien audite, sin tener que reconstruirlo mentalmente
-- juntando dos migraciones.
--
-- El shape del resultado NO cambia: `{ok, motivo, saldo}`, que es lo
-- que lee `revertirMovimiento` en
-- src/app/lealtad/panel/[id]/lealtad-operar-actions.ts:309-321. El
-- rechazo nuevo agrega una clave `codigo` para que el día que la
-- pantalla quiera tratarlo distinto (por ejemplo, ofrecer el botón de
-- revertir el canje) tenga de dónde agarrarse; el TypeScript de hoy
-- ignora las claves que no declara y sigue compilando sin tocarse.
--
-- `plpgsql` (igual que en la 0125): Postgres NO le valida el cuerpo al
-- crearla, así que esta sección no depende de que la 0125 se haya
-- pegado antes en el mismo archivo.

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
  v_resultante integer;
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

  v_resultante := v_saldo - v_tx.puntos;

  -- ── EL ARREGLO (0139) ──────────────────────────────────────────
  -- Acá adentro es donde el saldo leído todavía vale: el lock ya está
  -- tomado y nadie más puede mover a este miembro hasta que termine la
  -- transacción. Un saldo negativo no es "un número feo": es un premio
  -- entregado que el cliente termina pagando dos veces, y el negocio
  -- sin nada que mostrarle para justificarlo.
  --
  -- No se recorta la compensación a lo que alcanza —eso dejaría el
  -- ledger diciendo que se revirtió algo que se revirtió a medias, que
  -- es peor que no revertir—. Se rechaza entero, con el camino de
  -- salida en el mensaje.
  if v_resultante < 0 then
    return jsonb_build_object(
      'ok', false,
      'codigo', 'saldo-insuficiente-para-revertir',
      'motivo',
        'No se puede revertir: al cliente le quedarían ' || v_resultante
        || ' puntos. Ya gastó esos puntos en un premio — revertí primero '
        || 'ese canje (le devuelve los puntos y libera el stock) y después '
        || 'este movimiento.',
      'saldo', v_saldo);
  end if;

  -- El unique parcial sobre reversion_de garantiza UNA compensación
  -- por movimiento, aun con dos clics simultáneos.
  begin
    insert into transacciones_puntos
      (miembro_id, tipo, puntos, motivo, saldo_anterior, saldo_posterior,
       usuario_id, reversion_de)
    values
      (v_tx.miembro_id, 'ajuste', -v_tx.puntos,
       coalesce(nullif(trim(p_motivo), ''), 'Reversión'),
       v_saldo, v_resultante, p_usuario_id, v_tx.id);
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
     set saldo_cache = v_resultante, actualizado_en = now()
   where miembro_id = v_tx.miembro_id;

  return jsonb_build_object('ok', true, 'saldo', v_resultante);
end;
$$;

-- `create or replace` conserva los privilegios de la función que ya
-- existía, pero se re-declaran igual: si en algún entorno la 0125 no
-- estaba pegada, esta migración la acaba de CREAR y ahí no hay ACL que
-- conservar. Sigue siendo solo del servidor — la identidad y el acceso
-- al negocio se comprueban en la server action, antes de invocarla.
revoke all on function public.revertir_movimiento(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.revertir_movimiento(uuid, uuid, text)
  to service_role;


-- ------------------------------------------------------------
-- 2. `cuentas`: reclamar el rancho de otro deja de ser posible
-- ------------------------------------------------------------

-- El guardián del UPDATE. Va aparte de la política porque una política
-- no puede mirar el valor VIEJO de la fila, y acá la pregunta es
-- justamente de dónde a dónde se movió `rancho_id`.
--
-- No nombra ninguna tabla —trabaja con `old`/`new`— así que se puede
-- crear aunque `cuentas` no exista todavía. Lo que sí depende de la
-- 0134 es el `create trigger`, y ese va guardado más abajo.
--
-- Tres puertas abiertas a propósito:
--   · `auth.uid() is null` → es el servidor con la service key, que ya
--     comprobó el permiso antes de llamar (mismo criterio que los RPC
--     de la 0125). Si esta puerta no existiera, un backfill o una
--     server action legítima no podría enlazar nunca una cuenta.
--   · desenlazar (`rancho_id` a null) → soltar la costura no le toma
--     nada a nadie, y es lo que la 0134 hace sola cuando se borra el
--     rancho (`on delete set null`, 0134:89). Bloquearlo rompería ese
--     camino.
--   · apuntar a un rancho que quien llama SÍ gestiona → es el enlace
--     legítimo, el que el producto va a necesitar el día que una
--     cuenta de solo-lealtad publique su ficha en el marketplace.
create or replace function public.cuentas_rancho_no_se_muda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rancho_id is not distinct from old.rancho_id then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if new.rancho_id is null then
    return new;
  end if;

  if not public.gestiona_rancho(new.rancho_id) then
    -- 42501 = insufficient_privilege. PostgREST lo devuelve como 403 y
    -- no como un 500 genérico, así que la pantalla puede distinguir
    -- "no tenés permiso" de "se cayó la base".
    raise exception 'Una cuenta no puede apuntar a un negocio que no gestionás'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- La política y el trigger sí tocan `cuentas`, y las políticas se
-- validan AL CREARSE: sin la guarda, pegar esta migración en un
-- entorno donde la 0134 todavía no corrió abortaría el archivo entero
-- —incluida la sección 1, que arregla algo que está roto HOY en
-- producción—. La sección 1 es la urgente; esta no puede tumbarla.
do $aislamiento$
begin
  if to_regclass('public.cuentas') is null then
    raise notice 'AVISO 0139: la tabla `cuentas` no existe todavía (falta pegar la 0134). El aislamiento de rancho_id NO quedó puesto: hay que volver a pegar esta migración DESPUÉS de la 0134.';
    return;
  end if;

  -- Mismo nombre de política que la 0134, a propósito: la reemplaza en
  -- su lugar en vez de convivir con ella. Dos políticas de INSERT sobre
  -- la misma tabla se combinan con OR — dejar la vieja viva no
  -- arreglaría nada.
  execute 'drop policy if exists "Cada quien abre su cuenta" on public.cuentas';
  execute 'create policy "Cada quien abre su cuenta" on public.cuentas '
       || 'for insert to authenticated '
       || 'with check (owner_id = auth.uid() '
       || '  and (rancho_id is null or public.gestiona_rancho(rancho_id)))';

  -- `before update of rancho_id` + el `when`: el trigger ni se despierta
  -- en los updates que no tocan la columna, que son casi todos (nombre,
  -- logo, plan). Lo que se está protegiendo es una costura que casi
  -- nunca se mueve.
  execute 'drop trigger if exists cuentas_rancho_ajeno on public.cuentas';
  execute 'create trigger cuentas_rancho_ajeno '
       || 'before update of rancho_id on public.cuentas '
       || 'for each row when (new.rancho_id is distinct from old.rancho_id) '
       || 'execute function public.cuentas_rancho_no_se_muda()';
end;
$aislamiento$;


-- ------------------------------------------------------------
-- 3. ¿Alguien ya lo usó?
-- ------------------------------------------------------------
-- Cerrar la puerta no dice nada de quién entró antes. El backfill de la
-- 0134 (:259-273) crea cada cuenta con `owner_id` copiado del rancho,
-- así que una cuenta cuyo dueño NO es el dueño de su rancho no la hizo
-- el backfill: o es un traspaso de negocio hecho a mano, o es
-- exactamente el abuso que esta migración acaba de cerrar.
--
-- Va como NOTICE y no como excepción: abortar la migración por un dato
-- que puede ser legítimo dejaría sin arreglar las dos cosas que sí lo
-- son. Pero hay que MIRARLO — un NOTICE se pierde entre el ruido del
-- SQL Editor.
do $auditoria$
declare
  v_sospechosas integer;
begin
  if to_regclass('public.cuentas') is null or to_regclass('public.ranchos') is null then
    return;
  end if;

  execute 'select count(*) from public.cuentas c '
       || 'join public.ranchos r on r.id = c.rancho_id '
       || 'where c.owner_id <> r.owner_id'
    into v_sospechosas;

  if v_sospechosas > 0 then
    raise notice 'AVISO 0139: hay % cuenta(s) enlazadas a un rancho de OTRO dueño. Revisalas a mano con:  select c.id, c.nombre, c.owner_id, c.rancho_id, r.owner_id as dueno_del_rancho from cuentas c join ranchos r on r.id = c.rancho_id where c.owner_id <> r.owner_id;', v_sospechosas;
  end if;
end;
$auditoria$;

comment on function public.cuentas_rancho_no_se_muda() is
  'Impide reapuntar `cuentas.rancho_id` al negocio de otro (0139). La '
  'política de INSERT cubre el alta; esto cubre el segundo paso — '
  'insertar sin rancho y mudarlo después. Sin las dos, `pertenece_a_'
  'cuenta()` abre los datos personales de la clientela ajena (0138).';
