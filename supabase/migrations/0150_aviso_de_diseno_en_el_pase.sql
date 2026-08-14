-- ============================================================
-- BOOKEA — El aviso de que la TARJETA CAMBIÓ, en el pase ya instalado (0150)
--
-- El dueño reportó dos síntomas y son el mismo bug de fondo: «los
-- cambios no llegan al teléfono». Uno ya estaba resuelto (acreditar un
-- sello SÍ avisa: `avisarCambioDePase` corre por `after()` desde el
-- escáner, el mostrador manual, el canje, la reversión y las citas —
-- ver a64faac). El que faltaba es este: el dueño entra a
-- `/lealtad/panel/[id]/editar/[programaId]`, cambia un color, el icono
-- del sello, la meta, el % del cupón o las reglas, guarda, la pantalla
-- dice «Guardado» — y ningún teléfono se entera. `guardarPrograma` y
-- `guardarBeneficio` (pases-actions.ts) nunca tocaban un pase.
--
-- ------------------------------------------------------------
-- POR QUÉ ES OTRA BANDERA Y NO LA MISMA DE LA 0147
-- ------------------------------------------------------------
-- `pase_en_pausa` (0147) contesta una pregunta de DOS estados posibles
-- (¿este pase muestra el aviso de pausa, sí o no?) y los dos los define
-- el propio programa, así que una bandera booleana alcanza para
-- describir «lo que este pase debería mostrar ahora mismo».
--
-- Un cambio de diseño no tiene ese segundo estado: no hay una cosa a la
-- que «volver» — cada guardado es un cambio nuevo y distinto del
-- anterior (un color hoy, un icono mañana). Lo único que hace falta
-- saber es «¿a este pase todavía le falta el ÚLTIMO cambio?», y esa
-- pregunta la contesta una bandera que el guardado ENCIENDE para todos
-- los pases del programa y que el trabajo por tandas APAGA de a uno
-- cuando Apple o Google aceptan el cambio — el mismo mecanismo de
-- reclamo con update condicional que ya prueban las 23 pruebas de la
-- 0147, aplicado a una pregunta distinta.
--
-- ------------------------------------------------------------
-- QUÉ RESUELVE CADA COLUMNA
-- ------------------------------------------------------------
--   · diseno_pendiente  — este pase tiene un cambio de diseño sin
--     entregar. El guardado del dueño la ENCIENDE para todos los pases
--     de su programa (una sola sentencia, sin importar si son 3 o
--     3.000); el trabajo por tandas la APAGA de a uno, después de
--     avisarle a Apple o a Google.
--   · diseno_avisado_en — cuándo se le entregó a ESTE pase el último
--     cambio de diseño. No alcanza con `actualizado_en`: la pisa
--     cualquier refresco de saldo (motor.ts, google.ts).
--   · diseno_error — por qué no se pudo la última vez. Se limpia sola
--     en cuanto el aviso entra; lo que quede acá es lo que sigue
--     fallando HOY.
--
-- Aditiva e idempotente: no borra ni cambia ninguna fila y se puede
-- correr las veces que haga falta. Si la 0060 (`pases_wallet`) no
-- estuviera pegada, avisa por NOTICE y no revienta.
-- ============================================================

do $pases0150$
begin
  if to_regclass('public.pases_wallet') is null then
    raise notice 'AVISO 0150: falta pases_wallet (0060). No se agrega el aviso de diseño.';
    return;
  end if;

  -- ------------------------------------------------------------
  -- 1. diseno_pendiente — a este pase le falta el último cambio
  -- ------------------------------------------------------------
  -- `false` por defecto y NOT NULL: todo lo emitido hasta hoy ya
  -- muestra el único diseño que tuvo, así que no le "falta" nada.
  alter table public.pases_wallet
    add column if not exists diseno_pendiente boolean not null default false;

  -- ------------------------------------------------------------
  -- 2. diseno_avisado_en — cuándo se le entregó el último cambio
  -- ------------------------------------------------------------
  alter table public.pases_wallet
    add column if not exists diseno_avisado_en timestamptz;

  -- ------------------------------------------------------------
  -- 3. diseno_error — por qué NO se pudo
  -- ------------------------------------------------------------
  -- El rastro que hace falta para contestar «¿por qué esta tarjeta no
  -- se actualizó?» sin leer logs de hace tres días:
  --
  --   select serial_number, plataforma, diseno_error
  --     from pases_wallet where diseno_error is not null;
  alter table public.pases_wallet
    add column if not exists diseno_error text;

  execute $c$comment on column public.pases_wallet.diseno_pendiente is
    'true = al dueño se le guardo un cambio de diseno o reglas de la tarjeta (0150) que '
    'este pase todavia no recibio. Lo enciende el guardado del editor '
    '(pases-actions.ts: guardarPrograma / guardarBeneficio) para TODOS los pases del '
    'programa de una sola vez; lo apaga el trabajo por tandas '
    '(src/lib/wallet/aviso-de-diseno.ts) de a uno, despues de que Apple o Google '
    'aceptaron el cambio.'$c$;

  execute $c$comment on column public.pases_wallet.diseno_avisado_en is
    'Cuando se le entrego a este pase el ultimo cambio de diseno o reglas (0150). '
    'Distinta de actualizado_en, que la pisa cada refresco de saldo.'$c$;

  execute $c$comment on column public.pases_wallet.diseno_error is
    'Por que no se pudo avisarle a este pase el ultimo cambio de diseno (0150). '
    'null = sin problema. Se limpia sola cuando el aviso entra.'$c$;
end
$pases0150$;


-- ------------------------------------------------------------
-- 4. El índice de lo que queda por avisar
-- ------------------------------------------------------------
-- El trabajo por tandas pregunta siempre lo mismo: «pases vigentes con
-- la bandera encendida». Va por `execute` y no escrito derecho, por lo
-- mismo que en la 0146/0147: PL/pgSQL resuelve los nombres de un
-- statement normal al ejecutarlo por primera vez, y este índice nombra
-- una columna que se acaba de agregar arriba.
do $idx0150$
begin
  if to_regclass('public.pases_wallet') is null then return; end if;

  execute 'create index if not exists pases_wallet_diseno_pendiente_idx '
       || 'on public.pases_wallet (miembro_id) where activo and diseno_pendiente';
end
$idx0150$;


-- ------------------------------------------------------------
-- 5. Nada de RLS nueva, y no es un olvido
-- ------------------------------------------------------------
-- Las tres columnas viajan dentro de `pases_wallet`, que desde la 0060
-- solo le da SELECT a `authenticated` sobre su propio pase y ningún
-- UPDATE. El único escritor es el servidor con la llave de servicio,
-- igual que el resto del módulo de wallet — `guardarPrograma` y
-- `guardarBeneficio` corren con la sesión del dueño para `programa_lealtad`
-- (esa sí tiene política propia) pero encienden `diseno_pendiente` con
-- `createAdminClient()`, igual que ya hacen para leer el plan de la
-- cuenta.
