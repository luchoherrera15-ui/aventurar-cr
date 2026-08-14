-- ============================================================
-- BOOKEA — El aviso de la pausa en el pase que ya está instalado (0147)
--
-- La 0146 apaga el programa cuando se termina el mes pagado: se pausa,
-- no se borra nada. Falta lo que el CLIENTE ve.
--
-- La decisión del dueño, textual:
--
--   «El pase se queda con los sellos a la vista — es la tarjeta del
--    CLIENTE, no la licencia del negocio, y ya no autoriza nada porque
--    el canje se rechaza contra la base. Pero conviene cambiarle el
--    texto para que el cliente entienda por qué no le dan sellos.»
--
-- Esta migración NO cambia ni un pixel del pase: eso lo hace el código
-- (`avisoDePausa` en src/lib/wallet/tarjeta.ts). Lo único que agrega es
-- la MEMORIA de a qué pase ya se le avisó, que es lo que convierte un
-- barrido de 1.150 llamadas a Apple y Google en un trabajo reanudable.
--
-- ------------------------------------------------------------
-- POR QUÉ HACE FALTA GUARDAR ALGO
-- ------------------------------------------------------------
-- Avisarle a un pase cuesta una llamada a Apple (un push vacío, y el
-- teléfono vuelve a pedir el pase) o a Google (un PATCH del objeto).
-- Un negocio con 1.150 miembros son 1.150 llamadas, y por eso esto NO
-- puede vivir adentro del webhook de Stripe: el webhook tiene que
-- contestarle a Stripe en segundos o Stripe lo reintenta en loop.
--
-- Corriendo por tandas desde un cron, hacen falta dos cosas que ninguna
-- columna de hoy puede dar:
--
--   · REANUDABLE — si la corrida se corta en el pase 400, la siguiente
--     tiene que seguir en el 401 y no empezar de cero;
--   · IDEMPOTENTE — correrlo dos veces no puede mandar el aviso dos
--     veces.
--
-- Las dos salen de UNA bandera por pase que dice qué texto tiene ESE
-- pase encima ahora mismo. No se puede deducir de lo que ya existe:
-- `pases_wallet.actualizado_en` lo pisa cualquier refresco de saldo, y
-- `suscripciones.cortada_en` (0146) solo conoce los cortes de Stripe —
-- no la pausa que el dueño puso a mano desde el panel, que para el
-- cliente es exactamente lo mismo.
--
-- ------------------------------------------------------------
-- LA VUELTA ES LA MITAD DEL TRABAJO
-- ------------------------------------------------------------
-- La misma bandera sirve en las dos direcciones y por eso es una sola:
--
--   · programa pausado + pase sin aviso  → mandar el aviso, marcar true
--   · programa operando + pase con aviso → volver al texto normal,
--     marcar false
--
-- Si la vuelta no funcionara, el corte sería una trampa: un negocio que
-- renovó y paga, con doscientos clientes viendo «en pausa» para
-- siempre.
--
-- ------------------------------------------------------------
-- Aditiva e idempotente: no borra ni cambia ninguna fila y se puede
-- correr las veces que haga falta. Si la 0060 (`pases_wallet`) no
-- estuviera pegada, avisa por NOTICE y no revienta.
-- ============================================================

do $pases0147$
begin
  if to_regclass('public.pases_wallet') is null then
    raise notice 'AVISO 0147: falta pases_wallet (0060). No se agrega el aviso de pausa.';
    return;
  end if;

  -- ------------------------------------------------------------
  -- 1. pase_en_pausa — qué texto tiene ESTE pase encima
  -- ------------------------------------------------------------
  -- `false` por defecto y NOT NULL: todo lo emitido hasta hoy lleva el
  -- texto normal, que es la verdad. Ojo con la lectura correcta — esto
  -- NO dice si el programa está pausado (para eso está
  -- `programa_lealtad.estado`), dice qué está DIBUJADO en el teléfono
  -- del cliente. Los dos se separan justo en el rato que va entre el
  -- corte y la corrida del cron, que es el rato que este trabajo existe
  -- para cerrar.
  alter table public.pases_wallet
    add column if not exists pase_en_pausa boolean not null default false;

  -- ------------------------------------------------------------
  -- 2. pausa_avisada_en — cuándo se le avisó
  -- ------------------------------------------------------------
  -- No alcanza con `actualizado_en`: esa la pisa cada refresco de saldo
  -- de Google, así que no puede responder «¿cuándo se enteró este pase
  -- de la pausa?». Y esa pregunta se hace siempre que alguien dice «mi
  -- tarjeta sigue diciendo lo de antes».
  alter table public.pases_wallet
    add column if not exists pausa_avisada_en timestamptz;

  -- ------------------------------------------------------------
  -- 3. pausa_error — por qué NO se pudo
  -- ------------------------------------------------------------
  -- El rastro que hace falta para contestar «¿por qué este pase no se
  -- actualizó?» sin leer logs de hace tres días. Se limpia sola en
  -- cuanto el aviso entra, así que lo que quede acá es lo que sigue
  -- fallando HOY:
  --
  --   select serial_number, plataforma, pausa_error
  --     from pases_wallet where pausa_error is not null;
  alter table public.pases_wallet
    add column if not exists pausa_error text;

  execute $c$comment on column public.pases_wallet.pase_en_pausa is
    'true = este pase YA muestra el aviso de programa en pausa (0147). Es el estado del '
    'DIBUJO en el telefono, no el del programa: lo escribe el trabajo por tandas de '
    '/api/lealtad/pases-en-pausa despues de que Apple o Google aceptaron el cambio, y es '
    'lo que lo hace idempotente (no avisa dos veces) y reanudable (sigue donde quedo).'$c$;

  execute $c$comment on column public.pases_wallet.pausa_avisada_en is
    'Cuando se le entrego a este pase el ultimo cambio de texto por pausa (0147), en '
    'cualquiera de las dos direcciones. Distinta de actualizado_en, que la pisa cada '
    'refresco de saldo.'$c$;

  execute $c$comment on column public.pases_wallet.pausa_error is
    'Por que no se pudo avisarle a este pase la ultima vez (0147). null = sin problema. '
    'Se limpia sola cuando el aviso entra, asi que lo que quede aca es lo que falla hoy.'$c$;
end
$pases0147$;


-- ------------------------------------------------------------
-- 4. El índice de lo que queda por hacer
-- ------------------------------------------------------------
-- El trabajo pregunta siempre lo mismo: «pases de estos programas cuya
-- bandera todavía no coincide». Se indexa por bandera y por pase
-- vigente, que es el filtro que corta la tabla entera.
--
-- Va por `execute` y no escrito derecho, por lo mismo que en la 0146:
-- PL/pgSQL resuelve los nombres de un statement normal al ejecutarlo
-- por primera vez, y este índice nombra una columna que se acaba de
-- agregar arriba. Con `execute` se parsea recién cuando corre.
do $idx0147$
begin
  if to_regclass('public.pases_wallet') is null then return; end if;

  execute 'create index if not exists pases_wallet_pausa_pendiente_idx '
       || 'on public.pases_wallet (miembro_id) where activo and pase_en_pausa';
end
$idx0147$;


-- ------------------------------------------------------------
-- 5. Nada de RLS nueva, y no es un olvido
-- ------------------------------------------------------------
-- Las tres columnas viajan dentro de `pases_wallet`, que desde la 0060
-- solo le da SELECT a `authenticated` sobre su propio pase y no le da
-- ningún UPDATE. El único escritor es el servidor con la llave de
-- servicio, igual que el resto del módulo de wallet.
--
-- Y que el cliente PUEDA leer su `pase_en_pausa` no revela nada suyo
-- que no esté ya dibujado en la tarjeta que tiene en la mano.
