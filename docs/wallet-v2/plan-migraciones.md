# Plan de migraciones — Wallet V2

> **Actualización Fase 2B**: las migraciones 1–9 de este plan se
> implementaron y aplicaron **en local** como `0156`–`0165` (10
> archivos — el plan original agrupaba en 9 pasos lo que terminó
> siendo 10 migraciones reales, al separar el encolado-desde-RPC del
> resto de la sincronización). Ninguna se aplicó a producción. Ver la
> matriz completa, con evidencia de prueba por migración, en
> `fase-2b-resultado.md`.

> Solo planificación. Ninguna de estas migraciones existe como archivo
> todavía — se crean y se aplican en Fase 2B, una por una, cada una con
> su propia confirmación antes de la siguiente si toca datos reales.
> Numeración provisional (`01xx_wallet_v2_*`) — el número real de
> migración lo asigna Fase 2B según el último número aplicado en ese
> momento (hoy va por 0155).

## Orden y dependencias

```
1. wallet_v2_columnas_programa      (independiente)
2. wallet_v2_columnas_miembros      (independiente)
3. wallet_v2_columnas_pases_wallet  (independiente, NO borra columnas viejas todavía)
4. wallet_v2_columnas_transacciones (independiente)
5. wallet_v2_columnas_registros_dispositivo (independiente)
6. wallet_v2_tabla_sync_pendiente   (independiente)
   ↓
7. [backfill de datos — script, no migración SQL] saldo: pases_wallet → miembros
   ↓ (requiere 2 y 3 aplicadas, y 7 verificado)
8. wallet_v2_rpc_canjear_recompensa_con_reglas  (corrige el gap de concurrencia de §7 en decisiones-tablas.md)
   ↓ (requiere producto: alta crea cuenta — fuera de SQL)
9. wallet_v2_programa_cuenta_id_confirmada  (marca las filas ya enlazadas, no fuerza NOT NULL)
   ↓ (solo cuando 9 confirme 100%, en una fase futura, NO en Fase 2B)
10. [futura, no planificada todavía] wallet_v2_programa_cuenta_id_not_null
11. [futura, no planificada todavía] wallet_v2_retirar_saldo_de_pases_wallet
12. [futura, no planificada todavía] wallet_v2_retirar_columnas_pausa_diseno
```

Las migraciones 1–6 son independientes entre sí y de bajo riesgo: todas
son `ADD COLUMN ... DEFAULT` o `CREATE TABLE`, ninguna reescribe filas
existentes, ninguna tiene el patrón de "un solo guard para múltiples
columnas" que ya causó dos incidentes reales en este repo (Fase 0 §5) —
cada `ADD COLUMN` lleva su propio `IF NOT EXISTS`.

---

## 1. `wallet_v2_columnas_programa`

- **Qué hace**: agrega `diseno_version`, `cuenta_id_confirmada` a
  `programa_lealtad`; crea el trigger `programa_lealtad_incrementar_diseno`.
- **Riesgo**: bajo. Columnas con default, trigger `BEFORE UPDATE` que no
  afecta ninguna fila hasta el primer cambio de diseño posterior a la
  migración.
- **Rollback**: `DROP TRIGGER`, `ALTER TABLE ... DROP COLUMN` — sin
  pérdida de datos operativos (las columnas nuevas no tienen todavía
  ningún consumidor esperándolas).

## 2. `wallet_v2_columnas_miembros`

- **Qué hace**: agrega `saldo_cache`, `saldo_actualizado_en` a `miembros`.
- **Riesgo**: bajo por sí sola — nadie lee estas columnas hasta que el
  código de los 3 RPC cambie (paso posterior, no parte de esta migración).
- **Rollback**: `DROP COLUMN`.

## 3. `wallet_v2_columnas_pases_wallet`

- **Qué hace**: agrega `update_tag`, `ultima_generacion_en`,
  `google_revision`, `google_ultimo_payload_hash`,
  `apple_ultimo_status_registro`, `motivo_ultima_generacion`. **No
  borra** `saldo_cache`/`actualizado_en` — eso es la migración 11, futura,
  después de confirmar el backfill.
- **Riesgo**: bajo.
- **Rollback**: `DROP COLUMN` de las 6 nuevas.

## 4. `wallet_v2_columnas_transacciones`

- **Qué hace**: agrega `unidad`, `correlation_id`,
  `compra_base_colones`, `basis_points`, `moneda`; amplía el `CHECK` de
  `tipo` con los 9 valores nuevos (cashback y reversiones explícitas).
- **Riesgo**: bajo-medio. Ampliar un `CHECK` con más valores permitidos
  nunca invalida una fila existente (los valores viejos siguen siendo
  válidos) — el riesgo real es de disciplina de código: cualquier
  `INSERT` nuevo que use un `tipo` fuera de la lista ampliada sigue
  rechazándose, que es lo que se quiere.
- **Rollback**: `DROP COLUMN` de las 5 nuevas; revertir el `CHECK` al
  dominio de 3 valores — seguro mientras ninguna fila real haya usado
  todavía un valor nuevo (los primeros días después de aplicar).

## 5. `wallet_v2_columnas_registros_dispositivo`

- **Qué hace**: agrega `ultimo_push_en`, `ultimo_push_status`,
  `ultimo_error`, `intentos_fallidos`.
- **Riesgo**: bajo.
- **Rollback**: `DROP COLUMN`.

## 6. `wallet_v2_tabla_sync_pendiente`

- **Qué hace**: crea `wallet_sync_pendiente` completa (tabla, índices,
  RLS habilitada sin políticas — mismo patrón que
  `registros_dispositivo`).
- **Riesgo**: bajo — tabla nueva, ningún código la usa hasta que Fase 3
  la conecte.
- **Rollback**: `DROP TABLE`.

---

## 7. Backfill de saldo (script, no migración SQL)

- **Qué hace**: para cada fila de `miembros`, calcula el saldo real
  sumando `transacciones_puntos` (recalculado desde el ledger, no
  copiado de `pases_wallet.saldo_cache` — ver `migracion-legacy.md`) y lo
  escribe en `miembros.saldo_cache`/`saldo_actualizado_en`.
- **Prerrequisito**: migraciones 2 y 3 aplicadas.
- **Riesgo**: bajo con el volumen actual (2 filas de `miembros`); el
  script debe ser idempotente (se puede correr dos veces sin duplicar
  nada, porque es un `UPDATE`, no un `INSERT`) para poder re-ejecutarlo
  sin miedo si algo interrumpe la corrida.
- **Verificación obligatoria antes de continuar**: comparar el resultado
  contra `pases_wallet.saldo_cache` (que todavía no se toca) — deben
  coincidir salvo drift preexistente ya documentado como riesgo conocido.
- **Rollback**: no aplica — es una lectura+escritura de una columna sin
  consumidores todavía; se puede dejar como está o limpiar con
  `UPDATE miembros SET saldo_cache = 0` sin efecto en producción.

## 8. `wallet_v2_rpc_canjear_recompensa_con_reglas`

- **Qué hace**: `CREATE OR REPLACE FUNCTION canjear_recompensa(...)` —
  agrega, dentro del `pg_advisory_xact_lock` ya existente, la validación
  de `uso_unico`/`max_por_cliente`/`max_global`/vigencia de **tarjeta**
  (hoy solo en `canje.ts`, sin lock — el gap de concurrencia real
  encontrado en el inventario).
- **Riesgo**: medio — es la única migración de esta lista que cambia
  comportamiento de un camino ya en uso (aunque con 0 canjes reales
  today, según el inventario). Debe acompañarse de tests de integración
  contra la función antes de aplicar (ver `docs/wallet-v2/pruebas-reales.md`,
  Fase 10) y de correr en un entorno de prueba primero.
- **Rollback**: `CREATE OR REPLACE FUNCTION` con el cuerpo anterior —
  el repo ya versiona el SQL de la función previa en la migración 0125
  original, así que el rollback es "aplicar ese cuerpo de nuevo", sin
  necesitar una migración inversa especial.

## 9. `wallet_v2_programa_cuenta_id_confirmada`

- **Qué hace**: marca `cuenta_id_confirmada = true` en cada
  `programa_lealtad` donde exista una `cuenta` real con el mismo
  `rancho_id` (y, si `cuenta_id` está NULL pero la cuenta existe, la
  enlaza como parte del mismo backfill). **Depende de una decisión de
  producto previa**: que `/lealtad/nuevo/actions.ts` ya esté creando
  `cuentas` en el alta nueva (si no, esta migración solo repararía el
  histórico, no cerraría el problema hacia adelante).
- **Riesgo**: bajo-medio — toca datos reales de producción (hoy 1 fila),
  pero es un `UPDATE` reversible, nunca borra nada.
- **Rollback**: `UPDATE programa_lealtad SET cuenta_id_confirmada =
  false` — o, si se enlazó `cuenta_id` como parte del mismo paso,
  `UPDATE ... SET cuenta_id = NULL` restaura el estado anterior exacto.

---

## Futuras, explícitamente NO planificadas para Fase 2B

Estas requieren que el paso anterior esté **confirmado en producción por
un tiempo**, no solo aplicado — no tienen fecha ni número de migración
todavía:

- **`wallet_v2_programa_cuenta_id_not_null`**: forzar `cuenta_id NOT
  NULL` en `programa_lealtad`. Solo después de que el 100% de las filas
  reales tengan `cuenta_id_confirmada = true` — hoy sería 0%, porque el
  único programa real todavía no está enlazado.
- **`wallet_v2_retirar_saldo_de_pases_wallet`**: `DROP COLUMN
  saldo_cache, actualizado_en` de `pases_wallet`. Solo después de que
  ningún archivo de `src/` los lea (grep en cero) por al menos un
  despliegue completo sin incidentes.
- **`wallet_v2_retirar_columnas_pausa_diseno`**: retira las 6 columnas de
  bandera de `pases_wallet` una vez que pausa y diseño migraron a
  `wallet_sync_pendiente` y corrieron en paralelo sin discrepancias (ver
  `migracion-legacy.md`).
- **Limpieza de `cuentas_equipo`/`llave_idempotencia`**: decisión del
  dueño, no técnica — documentadas como deuda, no se tocan hasta
  instrucción explícita.

## Plan de rollback general de la fase

Si algo de 1–6 falla en producción: cada migración es independiente y
aditiva, así que revertir una no exige revertir las demás. Si el
**backfill** (7) revela drift inesperado entre `pases_wallet.saldo_cache`
y el ledger recalculado: se detiene ahí, se investiga la causa (es
evidencia de un bug, no un problema del backfill), y no se avanza a
ningún paso posterior hasta resolverlo — el sistema sigue funcionando
igual que hoy mientras tanto, porque nada dejó de leer las columnas
viejas todavía.
