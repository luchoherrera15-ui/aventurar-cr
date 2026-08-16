# Plan de rollback — Fase 2B/2C

> Nada de esto se ejecutó — ni Fase 2B ni Fase 2C tocaron el proyecto
> remoto. Este documento es el plan a seguir **si**, después de
> aplicar estas migraciones a producción en una fase futura, hiciera
> falta revertir alguna.
>
> **Actualización Fase 2C**: se agregó `0166` (corrige un bug real ya
> en producción, independiente de Wallet V2 — ver
> `fase-2c-resultado.md` §10) y se endurecieron `0160` (FKs del ledger,
> RESTRICT/SET NULL en vez de CASCADE) y `0165` (el trigger ahora
> también cubre INSERT). El rollback de `0160`/`0165` de abajo se
> actualizó para reflejar exactamente eso.

## Principio general

Cada migración de la 0156 a la 0166 es **aditiva o reemplaza una
función por su versión anterior** — ninguna borra una columna ni una
fila real. Eso significa que el rollback de cualquiera de ellas nunca
implica recuperar un backup: alcanza con deshacer el cambio de esquema
o volver a publicar el cuerpo anterior de la función.

## Por migración

| Migración | Cómo revertir |
|---|---|
| `0156` (RPC `alta_cuenta_lealtad`) | `DROP FUNCTION public.alta_cuenta_lealtad(uuid,uuid,integer,jsonb);` — y revertir el cambio de `src/app/lealtad/nuevo/actions.ts` al commit anterior (vuelve a insertar `programa_lealtad` directo, sin `cuenta_id`) |
| `0157` (backfill + vista) | `DROP VIEW public.wallet_v2_backfill_pendientes;` — el `UPDATE` que enlazó `cuenta_id` en filas inequívocas NO hace falta revertirlo (es correcto y deseable dejarlo), pero si hiciera falta: `UPDATE programa_lealtad SET cuenta_id = NULL WHERE cuenta_id = <el que se enlazó>` |
| `0158` (equipo canónico + ownership) | `DROP TRIGGER programa_lealtad_ownership_trg ON programa_lealtad; DROP FUNCTION public.programa_lealtad_verificar_ownership(); DROP VIEW public.wallet_v2_equipo_fallback_pendiente;` — las filas de `cuentas_equipo` creadas por la migración de roles son aditivas y seguras de dejar; si hiciera falta quitarlas: `DELETE FROM cuentas_equipo WHERE created_at >= '<fecha de la migración>'` |
| `0159` (saldo canónico) | `ALTER TABLE miembros DROP COLUMN saldo_cache, DROP COLUMN saldo_actualizado_en; DROP VIEW public.wallet_v2_reconciliacion_saldos; DROP VIEW public.wallet_v2_pases_sin_miembro;` — sin pérdida de datos: es una proyección recalculable, nunca la fuente de verdad |
| `0160` (ledger + concurrencia de canje + **Fase 2C: FKs endurecidas**) | Para el trigger de inmutabilidad: `DROP TRIGGER transacciones_puntos_inmutable_trg ON transacciones_puntos; DROP FUNCTION public.transacciones_puntos_inmutable();` — **desaconsejado salvo emergencia real**, es la protección central de esta fase. Para `canjear_recompensa`: `CREATE OR REPLACE FUNCTION` con el cuerpo exacto de la migración `0125_lealtad_operable.sql` (queda versionado ahí). El `CHECK` ampliado de `tipo` se puede achicar de nuevo SOLO si ninguna fila real usó todavía un valor nuevo — verificar primero con `SELECT DISTINCT tipo FROM transacciones_puntos WHERE tipo NOT IN ('ganado','canjeado','ajuste')`. **Para los FKs (Fase 2C)**: revertir `transacciones_puntos_miembro_id_fkey`/`canjes_miembro_id_fkey`/`miembros_programa_id_fkey` a `ON DELETE CASCADE` y `intentos_canje_programa_id_fkey` a `ON DELETE CASCADE` (con `ALTER COLUMN programa_id SET NOT NULL` de vuelta) — **desaconsejado**: revertir esto reabre exactamente el problema que Fase 2C encontró (cascadas que revientan contra el trigger de inmutabilidad, o que borran historial en silencio si no hay ledger) |
| `0161` (tabla de sincronización) | `DROP TABLE wallet_sincronizaciones; DROP FUNCTION public.wallet_encolar_sincronizacion(uuid,text,text,uuid);` — segura de borrar mientras ningún worker la esté consumiendo (no hay ninguno todavía) |
| `0162` (encolar desde movimientos) | `CREATE OR REPLACE FUNCTION` de las 3 RPC con los cuerpos de `0160`/`0125` — quita el encolado y la escritura de `miembros.saldo_cache`, sin afectar el ledger |
| `0163` (identidad Apple/Google) | `ALTER TABLE pases_wallet DROP COLUMN auth_token_version, google_revision, google_ultimo_payload_hash, ultima_generacion_en, motivo_ultima_generacion;` — **antes de esto**, confirmar `SELECT count(*) FROM pases_wallet WHERE auth_token_version > 0` = 0, porque si hay pases HMAC emitidos, revertir dejaría esos pases sin ningún token válido (su `auth_token` está en NULL a propósito). Si el conteo no es 0, migrar esos pases a token legacy ANTES de dropear (regenerar `auth_token` aleatorio para ellos) |
| `0164` (update_tag monotónico) | `CREATE OR REPLACE FUNCTION public.wallet_encolar_sincronizacion` con el cuerpo de `0161` (sin el incremento de `update_tag`) — la columna `update_tag` en sí se puede dejar, no molesta si nada la usa |
| `0165` (protección de columnas internas, **Fase 2C: ahora también cubre INSERT**) | `DROP TRIGGER programa_lealtad_proteger_columnas_sistema_trg ON programa_lealtad; DROP FUNCTION public.programa_lealtad_proteger_columnas_sistema(); ALTER TABLE programa_lealtad DROP COLUMN diseno_version, DROP COLUMN cuenta_id_confirmada;` — revertir a la versión "solo UPDATE" del trigger (sin el `if tg_op = 'INSERT'`) reabre el hallazgo de Fase 2C: un dueño podría volver a fijar `diseno_version`/`cuenta_id_confirmada` arbitrarios desde el alta |
| `0166` (índice único real de `reversion_de`, **Fase 2C — corrige un bug preexistente, no de Wallet V2**) | `DROP INDEX transacciones_puntos_reversion_de_unica_idx;` — **fuertemente desaconsejado**: sin este índice, `revertir_movimiento` (ya en producción desde 0125/0139) vuelve a permitir más de una reversa para el mismo movimiento bajo llamadas concurrentes (ver `fase-2c-resultado.md` §10) |

## Orden de rollback si hiciera falta revertir TODO

Al revés del orden de aplicación: `0166 → 0165 → 0164 → 0163 → 0162 →
0161 → 0160 → 0159 → 0158 → 0157 → 0156`. Cada paso es independiente —
no hace falta llegar hasta el final si el problema está en una
migración específica. **`0166` es un caso aparte**: como corrige un bug
ya activo en producción hoy (independiente de que se aplique el resto
del lote), revertirlo reabre ese bug — considerar dejarlo aplicado
incluso si se revierte todo lo demás.

**Antes de revertir `0162`/`0160`**: confirmar que ningún código de
`src/` esté todavía llamando a las 3 RPC esperando el comportamiento
nuevo (encolado, reglas de tarjeta bajo lock) — revertir sin haber
revertido primero el código que las llama dejaría `canjear_recompensa`
sin la protección de concurrencia que el frontend ya no valida en JS.

## Qué NO tiene rollback limpio

- Si `alta_cuenta_lealtad` (0156) ya creó `cuentas` reales en
  producción con datos de negocios reales, esas filas SON el estado
  correcto — no hay "revertir" un alta real sin perder la cuenta de
  un dueño de verdad. El rollback de código (dejar de llamar a la
  función) no borra lo ya creado, y no debería.
- Si el trigger de inmutabilidad (0160) ya impidió que algo se borrara
  en cascada (ver `fase-2b-resultado.md` §7), esa protección ya cumplió
  su función — revertirla después no deshace el hecho de que ya
  protegió datos reales.

## Feature flag — por qué esta fase no usó uno

Ninguna de las 10 migraciones necesitó un flag de aplicación (ver
`migracion-legacy.md`): todo es aditivo, y el único cambio de
comportamiento real (`canjear_recompensa` con las reglas nuevas) se
reemplaza function-por-function con `CREATE OR REPLACE`, que es en sí
mismo un mecanismo de cutover atómico — no hay un estado intermedio
donde la mitad del tráfico use la versión vieja y la mitad la nueva.
