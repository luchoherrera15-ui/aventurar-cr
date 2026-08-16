# Convivencia con el sistema actual — Wallet V2

> **Actualización Fase 2B**: la estrategia expand-verify-contract se
> siguió tal cual para el saldo — se aplicó "expand" (0159), "verify"
> quedó documentado en `reconciliacion-saldos.md`, y "contract" sigue
> explícitamente fuera de alcance. El hallazgo real más importante de
> la implementación: el trigger de inmutabilidad del ledger (0160)
> bloquea incluso el `DELETE` en cascada de un miembro con historial —
> ver `fase-2b-resultado.md` §7, una implicación operativa real que
> este documento no había anticipado.

> Porque el diseño de `decisiones-tablas.md` **evoluciona las tablas
> existentes en vez de crear un juego paralelo**, la migración es mucho
> más simple de lo que un esquema en inglés separado habría exigido: casi
> todo es `ADD COLUMN` con default, que no rompe ningún código que no lo
> use todavía. El único movimiento de datos real es el saldo
> (`pases_wallet` → `miembros`) y la única pieza nueva de comportamiento
> es la cola `wallet_sync_pendiente`. No hace falta dual-write para
> ninguna de las dos, por las razones que siguen.

## Matriz de estrategia por estructura

| Estructura actual | Estructura V2 | Estrategia | Riesgo | Rollback |
|---|---|---|---|---|
| `cuentas` | Sin cambio de esquema | **Cerrar adopción** (producto): `/lealtad/nuevo/actions.ts` crea la cuenta | Bajo — insertar una fila más en un flujo que ya inserta 4-5 filas | Revertir el commit del actions.ts; no hay dato que limpiar (la cuenta creada de más simplemente queda sin programa apuntándole) |
| `programa_lealtad` | +2 columnas, trigger nuevo | **Ampliar** | Bajo — columnas con default, trigger no afecta filas existentes hasta el primer `UPDATE` de diseño | `DROP TRIGGER`, `ALTER TABLE ... DROP COLUMN` (reversible, sin pérdida de datos operativos) |
| `miembros` | +2 columnas | **Ampliar** (recibe el saldo) | Medio — requiere backfill correcto antes de que nada lea de acá | Ver "Migración del saldo" abajo |
| `pases_wallet` | +6 columnas, -2 (eventual) | **Ampliar**, luego **convertir en compatibilidad** para las 2 que se retiran | Medio — ver abajo | Columnas nuevas: trivial. Columnas retiradas: mantenerlas unos días como espejo antes de dropear (ver abajo) |
| `transacciones_puntos` | +2 columnas, `CHECK` ampliado | **Ampliar** | Bajo — ampliar un `CHECK` con más valores permitidos nunca invalida filas existentes | `DROP COLUMN`, revertir el `CHECK` al dominio anterior |
| `registros_dispositivo` | +4 columnas | **Ampliar** | Bajo | Trivial |
| `recompensas`/`canjes`/`intentos_canje` | Sin cambio de tabla; RPC corregido | **Ampliar comportamiento** | Medio — un RPC mal migrado puede rechazar canjes válidos | `CREATE OR REPLACE FUNCTION` con la versión anterior guardada en el propio archivo de migración (patrón que el repo ya usa) |
| `aviso-de-pausa.ts` / `aviso-de-diseno.ts` (código, no tabla) | Migran a `wallet_sync_pendiente` | **Migrar por feature flag** | Medio-alto — es el único cambio que toca un mecanismo ya probado en producción | Ver "Migración de pausa/diseño" abajo |
| `cuentas_equipo` | Sin cambio | **Deprecar** (no eliminar en Fase 2) | Ninguno — 1 fila, sin tráfico | No aplica — no se toca |
| `llave_idempotencia` (columna de `canjes`) | Sin cambio | **Documentar como muerta** | Ninguno | No aplica |
| `ranchos.plan_lealtad` | Sin cambio de esquema | **Mantener como respaldo** hasta que `cuenta_id` esté siempre poblado (decisión pendiente del dueño, pregunta 5 de `modelo-existente.md`) | Bajo mientras se mantenga el patrón de fallback de `cuenta.ts` | No aplica |

---

## Migración del saldo (`pases_wallet.saldo_cache` → `miembros.saldo_cache`)

**Por qué NO hace falta dual-write**: el saldo cacheado es, por
definición, una **proyección derivable** del ledger (`transacciones_puntos`)
en cualquier momento — no es la fuente de verdad. Eso significa que el
backfill no depende de sincronizar dos escrituras concurrentes: se puede
**recalcular desde cero** en cualquier momento sin riesgo de perder nada.

Orden:
1. Migración A: `ALTER TABLE miembros ADD COLUMN saldo_cache ... DEFAULT
   0`. Sin efecto en producción — nadie lee esta columna todavía.
2. Backfill (script, no migración SQL): para cada `miembro`, sumar su
   ledger real (`transacciones_puntos`) — no copiar el valor viejo de
   `pases_wallet.saldo_cache`, **recalcular**, así cualquier drift
   histórico entre los dos `pases_wallet` de un mismo miembro (Apple vs
   Google, si alguna vez divergieron) se corrige en el mismo paso en vez
   de arrastrarse.
3. Código: los 3 RPC (`acreditar_lealtad`, `canjear_recompensa`,
   `revertir_movimiento`) pasan a escribir `miembros.saldo_cache` **en
   vez de** `pases_wallet.saldo_cache` — cambio atómico dentro de la
   misma transacción que ya tienen, un solo deploy.
4. Verificación: correr en paralelo, por una ventana corta, una
   comparación de solo lectura (`miembros.saldo_cache` recién escrito vs.
   el `pases_wallet.saldo_cache` viejo que todavía no se tocó) — deben
   coincidir siempre que no haya drift previo; si no coinciden, es
   evidencia real de un bug a investigar antes de continuar, no algo a
   ignorar.
5. Solo después de la verificación: `pases_wallet.saldo_cache`/
   `actualizado_en` se marcan deprecated en el código (se dejan de leer
   en todos lados) y se retiran en una migración de limpieza posterior
   —no en la misma migración que las crea, para poder revertir el paso 3
   sin perder columnas.

**Rollback en cualquier punto**: como el paso 2 es recalculable y el paso
3 es un cambio de código (no de esquema), revertir es "volver a leer/
escribir `pases_wallet.saldo_cache`" — sin migración inversa de datos.

---

## Migración de pausa/diseño → `wallet_sync_pendiente`

**Por qué esta SÍ necesita más cuidado**: a diferencia del saldo,
`aviso-de-pausa.ts`/`aviso-de-diseno.ts` son mecanismos **ya en
producción y ya probados** (con su propia suite de tests, cron cada 10
minutos). Reemplazarlos de golpe arriesga un mecanismo que hoy funciona
bien por uno nuevo sin el mismo kilometraje.

**Estrategia — feature flag por tipo de aviso, no por negocio**:
1. Migración: crear `wallet_sync_pendiente` (tabla nueva, sin tocar
   ninguna columna existente — cero riesgo de romper lo que ya corre).
2. Código: el mecanismo de **saldo/sello** (el que hoy NO tiene ningún
   patrón de cola — el gap real de la Fase 0) es el primero en escribir a
   la tabla nueva, porque no hay nada que migrar, solo algo que agregar.
   Esto ya resuelve el hallazgo más grave de la Fase 0 sin tocar código
   que funciona.
3. Pausa y diseño **se quedan como están** (columnas de bandera en
   `pases_wallet`) durante Fase 3, en paralelo con la tabla nueva. Se
   migran en una fase posterior, uno a la vez, detrás de una constante de
   código (no una columna de base de datos — no hace falta un flag
   persistido para esto, es un `if` de qué función llama el cron),
   comparando resultados durante una ventana antes de retirar las
   columnas viejas.
4. Solo cuando los tres motivos (saldo, pausa, diseño) escriban a la
   tabla nueva, se retiran `pase_en_pausa`/`pausa_avisada_en`/
   `pausa_error`/`diseno_pendiente`/`diseno_avisado_en`/`diseno_error` de
   `pases_wallet`.

**Plan de cutover**: por tipo de aviso, no por negocio ni por programa —
más simple de razonar y de revertir que un cutover parcial por cuenta.

**Plan de rollback**: mientras las columnas viejas no se hayan
eliminado (punto 4), volver es cambiar qué función llama el cron. Después
de eliminarlas, el rollback es restaurar las columnas desde la migración
de creación (siguen versionadas en `supabase/migrations/`) — mismo patrón
que ya usa el repo para cualquier reversión de columna.

---

## Por qué NO hace falta un feature flag general de "Wallet V2 encendido"

El diseño no introduce una segunda familia de tablas que convivan con la
vieja — evoluciona la única que existe. Eso significa que no hay "modo
legacy" vs "modo V2" del lado de los datos: en todo momento hay **una**
`programa_lealtad`, **una** `pases_wallet`, etc. Lo único que necesita
corte explícito es el comportamiento (§ pausa/diseño arriba), y ahí el
corte es por tipo de aviso, ya cubierto.

## Los datos actuales son de prueba, pero no se eliminan en esta fase

Confirmado por el inventario: `programa_lealtad`=1, `miembros`=2,
`pases_wallet`=3, `canjes`=0, `suscripciones`=0. Ninguna migración de
Fase 2B debe incluir un `DELETE`/`TRUNCATE` — todo backfill es aditivo
(`ADD COLUMN` + `UPDATE` para llenarla, nunca `DELETE` de filas).
