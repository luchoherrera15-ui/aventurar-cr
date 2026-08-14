-- ============================================================
-- BOOKEA — El corte automático al terminar el mes pagado (0146)
--
-- La decisión del dueño, textual:
--
--   «Todo debe ser automático: una vez finaliza el MES, de una vez se
--    cancela su suscripción y todo deja de funcionar hasta que
--    renueven.»
--
-- La 0143 dejó escrito lo contrario («el plan no se degrada solo») y
-- eso NO cambia: el paquete sigue sin bajarse jamás. Lo que se agrega
-- es distinto y es lo que se pidió — el programa deja de OPERAR.
--
-- ------------------------------------------------------------
-- DEGRADAR ≠ APAGAR, Y POR ESO CONVIVEN
-- ------------------------------------------------------------
-- Bajar de `ilimitado` a `prueba` recorta el cupo de 1.150 clientes a
-- 25 en el mismo segundo: sobran 1.125 miembros que ya existen, y el
-- primero en enterarse es un cliente parado en el mostrador. Eso sigue
-- prohibido.
--
-- PAUSAR es otra cosa: el programa entero deja de sellar y de canjear,
-- pero no sobra nadie. Miembros, sellos, pases y movimientos quedan
-- exactamente donde estaban. Es el mismo estado `pausado` de la 0125
-- —el del botón «Pausar» del panel, el que promete «conserva todo»— y
-- el motor de canje ya lo respeta desde entonces (`autorizarCanje` en
-- src/lib/lealtad/canje.ts y el RPC de acumulación de la 0125, que
-- exige estado='activo').
--
-- O sea: esta migración NO agrega ninguna regla nueva de negación. Se
-- apoya en la que ya existía y agrega UNA sola cosa —memoria de QUIÉN
-- pausó— para que la vuelta sea exacta.
--
-- ------------------------------------------------------------
-- POR QUÉ HACE FALTA `pausado_por_cobro`
-- ------------------------------------------------------------
-- Sin esta columna, reanudar al renovar sería «activá todo lo que esté
-- pausado», y eso levantaría también la promoción que el dueño pausó a
-- mano el mes pasado porque se le acabó el producto. Una decisión de
-- una persona no la puede pisar un cobro.
--
-- Con la columna, la simetría es exacta:
--   · corte    → se pausa SOLO lo que estaba operando, y se marca.
--   · renovar  → se reactiva SOLO lo marcado, y se desmarca.
-- Todo lo demás —borradores, archivadas, y lo que el dueño pausó él—
-- ni se toca en una dirección ni en la otra.
--
-- El código NO apaga nada mientras esta columna no exista (ver
-- `pausarProgramasEn` en src/lib/pagos/puerta-supabase.ts): prefiere
-- dejar al negocio operando y avisarle al equipo antes que dejarlo
-- apagado sin forma de volver. Cancelar sin vuelta sería una trampa.
--
-- ------------------------------------------------------------
-- Aditiva e idempotente: no borra ni cambia ninguna fila y se puede
-- correr las veces que haga falta. Si la 0143 (`suscripciones`) todavía
-- no está pegada, no revienta: avisa por NOTICE y se salta esa parte.
-- ============================================================


-- ------------------------------------------------------------
-- 1. programa_lealtad.pausado_por_cobro — la memoria del corte
-- ------------------------------------------------------------
-- `false` por defecto y NOT NULL: todo lo que ya existe queda como
-- pausado POR SU DUEÑO, que es la lectura correcta — el corte
-- automático no existía cuando esas filas se escribieron, así que
-- ninguna de ellas la puso un cobro.
do $prog0146$
begin
  if to_regclass('public.programa_lealtad') is null then
    raise notice 'AVISO 0146: falta programa_lealtad (0060). No se agrega pausado_por_cobro.';
    return;
  end if;

  alter table programa_lealtad
    add column if not exists pausado_por_cobro boolean not null default false;

  execute $c$comment on column programa_lealtad.pausado_por_cobro is
    'true = a este programa lo pauso el CORTE por falta de pago (0146), no su dueno. '
    'Es lo unico que hace que la vuelta al renovar sea exacta: se reactiva solo lo '
    'marcado, nunca lo que el dueno pauso a mano. Lo escribe el webhook de Stripe con '
    'la llave de servicio; el navegador no lo toca.'$c$;
end
$prog0146$;

-- Los que están apagados por cobro: la consulta que corre la vuelta, y
-- la que hay que mirar si alguien dice «renové y no volvió». Parcial
-- porque en régimen la enorme mayoría de las filas tiene `false`.
--
-- Va por `execute` y no escrito derecho: PL/pgSQL resuelve los nombres
-- de un statement normal al ejecutarlo por primera vez, y este índice
-- nombra una columna que se acaba de agregar dos bloques más arriba.
-- Con `execute` no hay duda: se parsea recién cuando corre.
do $idx0146$
begin
  if to_regclass('public.programa_lealtad') is null then return; end if;

  execute 'create index if not exists programa_lealtad_pausado_por_cobro_idx '
       || 'on programa_lealtad (rancho_id) where pausado_por_cobro';
end
$idx0146$;


-- ------------------------------------------------------------
-- 2. suscripciones — desde cuándo está cortada y con qué paquete
-- ------------------------------------------------------------
-- La 0143 puede no estar pegada todavía (las migraciones las pega el
-- dueño a mano y siempre hay una ventana en la que el código va
-- adelante de la base). Sin la tabla, esta parte se salta entera.
do $susc0146$
begin
  if to_regclass('public.suscripciones') is null then
    raise notice 'AVISO 0146: falta suscripciones (0143). Se saltan cortada_en, plan_al_cortar y aviso_previo_en.';
    return;
  end if;

  -- Desde cuándo el negocio dejó de operar. null = está operando.
  -- No es decoración: es la única forma de responder «¿desde cuándo
  -- está apagado?» sin ir a buscarlo al panel de Stripe, y de contar
  -- después cuántos negocios se recuperaron y en cuántos días.
  alter table suscripciones add column if not exists cortada_en timestamptz;

  -- El paquete que tenía en el momento del corte. HOY es redundante
  -- —el corte no baja el plan, así que `plan` sigue diciendo lo
  -- mismo— y se guarda igual por dos razones: deja constancia de qué
  -- se apagó aunque alguien toque el plan a mano desde
  -- /admin/complementos, y es lo que haría falta el día que se decida
  -- degradar de verdad y haya que saber a qué volver.
  alter table suscripciones add column if not exists plan_al_cortar text;

  -- Cuándo se le avisó al dueño que su programa se apaga, para no
  -- repetirlo. Hace falta porque Stripe manda VARIOS
  -- `customer.subscription.updated` con `cancel_at_period_end` en true
  -- y la idempotencia por `stripe_event_id` no los frena: son eventos
  -- distintos contando el mismo hecho.
  alter table suscripciones add column if not exists aviso_previo_en timestamptz;

  execute $c$comment on column suscripciones.cortada_en is
    'Cuando el programa dejo de operar por falta de pago (0146). null = opera. '
    'El corte PAUSA, nunca borra: miembros, sellos, pases y movimientos quedan intactos.'$c$;

  execute $c$comment on column suscripciones.plan_al_cortar is
    'El paquete que tenia el negocio al cortarse (0146). Hoy el corte no baja el plan, '
    'asi que sirve de constancia; el dia que se degrade de verdad, es a lo que hay que volver.'$c$;

  execute $c$comment on column suscripciones.aviso_previo_en is
    'Cuando se le aviso al dueno la fecha en que se apaga su programa (0146). Evita '
    'repetir el correo en cada customer.subscription.updated con cancel_at_period_end.'$c$;
end
$susc0146$;


-- ------------------------------------------------------------
-- 3. Nada de RLS nueva, y no es un olvido
-- ------------------------------------------------------------
-- `pausado_por_cobro` viaja dentro de `programa_lealtad`, que ya tiene
-- sus políticas desde la 0060/0125; las tres columnas de
-- `suscripciones` viajan dentro de una tabla que `authenticated` solo
-- puede LEER (0143) y que escribe únicamente el webhook con la llave
-- de servicio.
--
-- Lo que sí hay que tener claro: un dueño PUEDE, con su sesión,
-- reactivar su propio programa desde el panel (la 0125 le da el
-- update). O sea que el corte no es una reja, es un interruptor. Poner
-- la reja de verdad —negar el update mientras `pausado_por_cobro` esté
-- en true— es una decisión de producto que todavía no se tomó, y
-- hacerlo acá de callado dejaría a un dueño sin poder despausar su
-- programa sin entender por qué. Cuando se decida, el lugar es un
-- trigger sobre programa_lealtad, no este archivo.
