-- ============================================================
-- WALLET V2 — Etapa 9: trazabilidad por correlation_id, de punta a
-- punta, en UNA vista de solo lectura para diagnóstico administrativo.
--
-- LA CADENA QUE PIDE LA ETAPA 9:
--   movimiento → fila de sync → worker → APNs → consulta de seriales
--   → descarga del pkpass → versión entregada
--
-- CÓMO SE ARMA CADA ESLABÓN CON LO QUE YA EXISTE (nada de esto crea
-- columnas nuevas — todo es JOIN sobre 0060/0160/0161/0163/0164/0165):
--
--   · movimiento          → transacciones_puntos, por correlation_id
--                            (0160 agregó la columna; 0162/0164 la
--                            llenan en acreditar_lealtad/
--                            canjear_recompensa/revertir_movimiento).
--   · fila de sync/worker → wallet_sincronizaciones misma (estado,
--                            intentos, error, timestamps de lease).
--   · APNs                → NO existe un código HTTP crudo de Apple
--                            guardado en ningún lado (ver
--                            adaptador-apple.ts: `entregarApple`/
--                            `avisarPaseActualizado` solo devuelven
--                            ok/motivo, nunca un status numérico
--                            propio). El proxy real y honesto es
--                            `wallet_sincronizaciones.estado` para las
--                            filas `plataforma = 'apple'` — por eso
--                            esta vista NO inventa una columna
--                            "apns_status" aparte de `job_estado`.
--   · consulta de seriales → tampoco tiene timestamp propio: la ruta
--                            `passesUpdatedSince` (GET .../registrations/
--                            [passTypeId]) NO escribe nada al
--                            responder (ver esa ruta). La señal real
--                            más cercana es cuándo el TELÉFONO se
--                            (re)registró (`registros_dispositivo.
--                            created_at`) — se expone como
--                            `dispositivo_ultimo_registro_en`.
--   · descarga del pkpass → `pases_wallet.ultima_descarga_en` (0151):
--                            la ÚNICA señal real de "el teléfono vino
--                            a buscar el pase", escrita por la ruta
--                            GET .../passes/[passTypeId]/[serial].
--   · versión entregada    → NO se guarda un "último update_tag que sí
--                            llegó" en ningún lado hoy (fuera del
--                            alcance de esta migración: sería una
--                            columna nueva, y esta migración es
--                            "solo lectura", ninguna migración nueva
--                            además de esta vista). El proxy que SÍ
--                            existe es `version_local_esperada` de
--                            cada fila `succeeded` — la versión que
--                            ESE intento exitoso confirmó — comparado
--                            contra `pases_wallet.update_tag` actual.
--
-- GRANO DE LA VISTA: una fila por `wallet_sincronizaciones.id` (un
-- intento de sync concreto) — es el eslabón "fila de sync" de la
-- cadena, con el resto de la cadena unida alrededor de él.
--
-- QUÉ NUNCA SE MUESTRA (regla dura de la Etapa 9): ni
-- `registros_dispositivo.push_token` ni `pases_wallet.auth_token` —
-- ninguna de las dos columnas se nombra en este archivo. De
-- `registros_dispositivo` solo se agregan COUNT y MAX(created_at).
--
-- SANITIZACIÓN DE `error` — DECISIÓN, no supuesto:
--
-- Se verificó `marcarResultado()` (worker.ts) y las dos rutas que
-- construyen el `motivo` que termina ahí:
--   · adaptador-apple.ts: TODO `ResultadoSync` con `ok:false` pasa por
--     `motivoSeguro()` (trunca a 300 y tapa corridas de 24+ caracteres
--     que parezcan un secreto) antes de volver.
--   · adaptador-google.ts: TODO camino con `ok:false` pasa por
--     `sanitizarMotivo()` (tapa bloques PEM y "Bearer <token>", trunca
--     a 500) antes de volver.
-- Con eso, el camino NORMAL (adaptador → resultado → marcarResultado)
-- ya llega sanitizado. PERO se encontró un camino que NO pasa por
-- ninguno de los dos: en `ejecutarCicloDeSincronizacion` (worker.ts),
-- si un adaptador lanza una excepción sin atrapar (algo que los dos
-- adaptadores documentan que "nunca debería" hacer, pero el `catch`
-- existe justamente para el día que sí pase), el mensaje crudo
-- `e.message` se usa TAL CUAL como `motivo`, sin pasar por
-- `motivoSeguro`/`sanitizarMotivo`:
--
--   } catch (e) {
--     resultado = { ok: false, reintentable: true,
--       motivo: e instanceof Error ? e.message : "..." };
--   }
--
-- Ese `e.message` podría, en teoría, traer pegado un fragmento de
-- stack trace o un valor de configuración si algún día una librería
-- de terceros lo incluye en su Error. Por eso esta vista SÍ aplica su
-- propia capa de saneo — defensa en profundidad, no confía
-- ciegamente en que el árbol de llamadas de hoy sea el de mañana —
-- reusando la MISMA idea de `motivoSeguro()` (adaptador-apple.ts):
-- truncar y tapar corridas largas de caracteres con pinta de secreto.
-- No se llama a la función de TypeScript desde SQL (no hay FFI para
-- eso); se reimplementa el mismo patrón con `regexp_replace`, con el
-- mismo umbral (24+ caracteres de [A-Za-z0-9+/_-] con relleno = opcional).
-- ============================================================

create or replace view public.wallet_v2_diagnostico_sincronizacion as
with dispositivos as (
  select
    pw.id as pase_id,
    count(rd.*) as dispositivos_registrados,
    max(rd.created_at) as dispositivo_ultimo_registro_en
  from pases_wallet pw
  left join registros_dispositivo rd on rd.serial_number = pw.serial_number
  group by pw.id
)
select
  -- ── fila de sync / worker ──────────────────────────────────
  w.id as job_id,
  w.correlation_id,
  w.cuenta_id,
  w.programa_id,
  w.miembro_id,
  w.pase_id,
  w.plataforma,
  w.operacion,
  w.estado as job_estado,                 -- también el proxy de "APNs status" para plataforma='apple'
  w.intentos,
  w.max_intentos,
  -- La versión que ESTE intento persigue. Cuando job_estado='succeeded'
  -- es, además, la versión REALMENTE entregada (el proxy más honesto
  -- que existe hoy — ver nota de "versión entregada" arriba); para
  -- pending/retryable/dead todavía no es una entrega confirmada,
  -- solo el objetivo del intento.
  w.version_local_esperada as job_version_local_esperada,
  w.proximo_intento_en,
  w.bloqueado_en,
  w.bloqueado_por,
  w.ultimo_intento_en,
  w.exitoso_en,
  w.fallido_permanente_en,
  -- Error sanitizado — ver nota de arriba: segunda capa, independiente
  -- de la que ya aplican los adaptadores antes de escribir esta columna.
  regexp_replace(left(w.error, 500), '[A-Za-z0-9+/_-]{24,}={0,2}', '[omitido]', 'g') as error_sanitizado,
  w.created_at as job_creado_en,
  w.updated_at as job_actualizado_en,

  -- ── movimiento (transacciones_puntos, por correlation_id) ──
  t.id as transaccion_id,
  t.tipo as transaccion_tipo,
  t.motivo as transaccion_motivo,
  t.puntos as transaccion_puntos,
  t.saldo_anterior as transaccion_saldo_anterior,
  t.saldo_posterior as transaccion_saldo,     -- "Saldo" del pedido de la Etapa 9
  t.created_at as transaccion_creada_en,

  -- ── pase (update_tag, versión entregada, descarga) ─────────
  pw.update_tag as pase_update_tag,           -- "Update tag" del pedido de la Etapa 9
  pw.saldo_cache as pase_saldo_cache,
  pw.actualizado_en as pase_actualizado_en,
  pw.ultima_generacion_en as pase_ultima_generacion_en,
  pw.motivo_ultima_generacion as pase_motivo_ultima_generacion,
  pw.ultima_descarga_en as pase_ultimo_pkpass_entregado_en, -- "Último .pkpass entregado"
  pw.activo as pase_activo,

  -- ── dispositivos (SOLO conteo y fecha — nunca push_token) ──
  coalesce(d.dispositivos_registrados, 0) as dispositivos_registrados,
  d.dispositivo_ultimo_registro_en as dispositivo_ultima_consulta_en -- proxy de "Última consulta", ver nota de arriba

from wallet_sincronizaciones w
left join transacciones_puntos t on t.correlation_id = w.correlation_id
left join pases_wallet pw on pw.id = w.pase_id
left join dispositivos d on d.pase_id = w.pase_id;

comment on view public.wallet_v2_diagnostico_sincronizacion is
  'Wallet V2 (Etapa 9) — trazabilidad administrativa de solo lectura: '
  'movimiento -> fila de sync -> worker -> APNs -> consulta de '
  'seriales -> descarga del pkpass -> version entregada, todo unido '
  'por correlation_id/pase_id. NUNCA expone push_token ni auth_token '
  '(ninguna de las dos columnas se nombra en esta vista; de '
  'registros_dispositivo solo se agregan COUNT y MAX(created_at)). '
  'El error queda sanitizado con una segunda capa a nivel de vista, '
  'independiente de motivoSeguro()/sanitizarMotivo() (ver comentario '
  'de cabecera del archivo de migracion 0168 para el hallazgo exacto '
  'que justifica esta capa extra). Solo service_role — mismo patron '
  'de acceso que wallet_v2_reconciliacion_saldos (0159).';

-- Mismo patrón exacto que 0159 (wallet_v2_reconciliacion_saldos):
-- nadie del lado del navegador la lee, ni siquiera un dueño de
-- negocio autenticado — es una herramienta de diagnóstico interno.
revoke all on public.wallet_v2_diagnostico_sincronizacion from public, anon, authenticated;
grant select on public.wallet_v2_diagnostico_sincronizacion to service_role;
