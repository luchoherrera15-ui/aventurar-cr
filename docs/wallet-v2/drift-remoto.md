# Drift remoto vs. local — Wallet V2 (Fase 2C, sección 7)

> Todo lo de este documento se obtuvo con consultas de **solo lectura**
> contra el Supabase remoto, vía `scripts/drift-remoto.mjs` (que usa
> `scripts/inspeccionar-remoto.mjs`, nunca `scripts/aplicar-migracion.mjs`).
> Cada consulta viaja envuelta en `BEGIN TRANSACTION READ ONLY; ...;
> COMMIT;` — probado contra el Postgres local antes de confiar en él
> (ver nota en el propio script): un `SET default_transaction_read_only
> = on;` suelto NO alcanza, porque no protege la transacción implícita
> que ya empezó con el primer statement del lote; el `BEGIN` explícito
> sí. No se imprime PII — solo metadata de esquema (nombres de columna,
> tipos, definiciones de constraint/trigger/policy, grants).

## 1. Cómo se rastrea el estado de las migraciones en este proyecto

**Hallazgo, no asumido de antemano**: `supabase_migrations.schema_migrations`
— la tabla de control estándar que usa `supabase db push` — **no existe**
en el remoto (`ERROR 42P01: relation ... does not exist`). Esto no es un
error de esta fase: confirma lo que la memoria del proyecto ya
registraba (el dueño pega cada migración a mano en el SQL Editor) y
explica por qué el repo ya tiene su propio mecanismo de verificación por
**objeto testigo** (`scripts/estado-migraciones.mjs`) en vez de depender
de esa tabla. `drift-remoto.mjs` sigue el mismo patrón para 0156-0165.

**Clasificación: Esperado.** No requiere ninguna acción — es cómo
funciona este proyecto, y el propio repo ya está adaptado a eso.

## 2. Estado de 0156-0165 en remoto (por objeto testigo)

| Migración | Objeto testigo | ¿Existe en remoto? |
|---|---|---|
| 0156 | función `alta_cuenta_lealtad` | ❌ No |
| 0157 | vista `wallet_v2_backfill_pendientes` | ❌ No |
| 0158 | función `programa_lealtad_verificar_ownership` | ❌ No |
| 0159 | columna `miembros.saldo_cache` | ❌ No |
| 0160 | función `transacciones_puntos_inmutable` | ❌ No |
| 0161 | tabla `wallet_sincronizaciones` | ❌ No |
| 0162 | función `wallet_encolar_sincronizacion` | ❌ No |
| 0163 | columna `pases_wallet.auth_token_version` | ❌ No |
| 0165 | función `programa_lealtad_proteger_columnas_sistema` | ❌ No |

**Confirmado: ninguna de las 10 migraciones de Wallet V2 está aplicada
en remoto.** Cero riesgo de colisión al aplicarlas — el remoto está en
el mismo estado "pre-Fase-2B" que se asumió durante toda la
implementación local.

**Clasificación: Esperado** (Fase 2B fue explícitamente local-only).

## 3. Tablas relevantes: cuáles existen ya

De las 16 tablas de interés: **14 ya existen** (`ranchos`, `cuentas`,
`cuentas_equipo`, `rancho_colaboradores`, `programa_lealtad`,
`personas`, `personas_negocio`, `miembros`, `pases_wallet`,
`registros_dispositivo`, `transacciones_puntos`, `recompensas`,
`canjes`, `intentos_canje`) y **2 no existen todavía**
(`wallet_sincronizaciones`, `wallet_sync_pendiente` — ambas son tablas
nuevas de 0161, ninguna sorpresa).

**Clasificación: Esperado.**

## 4. Columnas nuevas de Wallet V2: cero presentes en remoto

Se comparó cada columna que 0156-0165 agregarían (`programa_lealtad.
diseno_version/cuenta_id_confirmada`, `miembros.saldo_cache/
saldo_actualizado_en`, `pases_wallet.update_tag/.../auth_token_version`,
`transacciones_puntos.unidad/correlation_id/.../moneda`,
`registros_dispositivo.ultimo_push_en/.../intentos_fallidos`) contra las
columnas reales de esas tablas en remoto: **ninguna existe todavía**.
Confirma que los `ADD COLUMN` de las migraciones 1-6 del plan son
seguros de aplicar sin colisión de nombres.

**Clasificación: Esperado / Inofensivo.**

## 5. FKs hacia el ledger — mapa completo desde el esquema remoto real

Esto alimenta directamente la sección 3 de Fase 2C (revisión de
DELETE/CASCADE); acá se deja el mapa tal como existe **hoy en
producción**, antes de ningún cambio:

| Tabla hija | Columna | Referencia | `ON DELETE` |
|---|---|---|---|
| `transacciones_puntos` | `miembro_id` | `miembros(id)` | **CASCADE** |
| `transacciones_puntos` | `reversion_de` | `transacciones_puntos(id)` (auto-referencia) | SET NULL |
| `canjes` | `transaccion_id` | `transacciones_puntos(id)` | SET NULL |
| `canjes` | `miembro_id` | `miembros(id)` | **CASCADE** |
| `intentos_canje` | `miembro_id` | `miembros(id)` | SET NULL |
| `pases_wallet` | `miembro_id` | `miembros(id)` | **CASCADE** |
| `miembros` | `programa_id` | `programa_lealtad(id)` | **CASCADE** |
| `intentos_canje` | `programa_id` | `programa_lealtad(id)` | **CASCADE** |
| `recompensas` | `programa_id` | `programa_lealtad(id)` | **CASCADE** |

**Cadena de riesgo confirmada con datos reales**: borrar una fila de
`programa_lealtad` intenta `CASCADE` a `miembros`, que a su vez intenta
`CASCADE` a `transacciones_puntos` — dos niveles de `CASCADE` en línea
directa hacia la tabla que 0160 protege con un trigger de inmutabilidad
sin excepciones. Hoy (sin el trigger de 0160 todavía aplicado) ese
`CASCADE` funcionaría sin problema; **después** de aplicar 0160, ese
mismo `DELETE` fallará siempre que el miembro/programa tenga algún
movimiento en el ledger — exactamente el comportamiento que la Fase 2B
descubrió de forma incidental al intentar limpiar datos de prueba, y
que la sección 3 de este documento (más abajo, ver
`fase-2c-resultado.md` §3) resuelve cambiando estos `CASCADE` por
`RESTRICT` en el punto que toca al ledger, antes de que 0160 se aplique
en ningún entorno con datos reales.

**Clasificación: Bloqueante — ya resuelto en el diseño de esta fase**
(ver sección 3 del reporte principal; las migraciones 0156-0165 se
corrigen en local antes de proponer aplicación remota).

## 6. Grants — coinciden con lo documentado, sin sorpresas

Se confirmó, leyendo `information_schema.role_table_grants` y
`information_schema.column_privileges` reales (no solo el código de las
migraciones que los crearon):

- **`programa_lealtad`**: `authenticated` tiene grant de tabla completa
  para `INSERT`/`UPDATE`/`DELETE` (además de `SELECT`) — confirma
  textualmente el hallazgo ya registrado en `rls-matrix.md` ("otorga
  UPDATE/INSERT de TABLA COMPLETA a authenticated"). Es la razón real
  detrás del trigger `programa_lealtad_proteger_columnas_sistema` (0165)
  que protege `diseno_version`/`cuenta_id_confirmada` — sección 2 de
  Fase 2C debe probar este trigger con sesiones JWT reales precisamente
  porque el candado no está a nivel de grant, está a nivel de trigger.
- **`miembros`**: `authenticated` **no** tiene `UPDATE` a nivel de
  tabla — solo a nivel de **columna**, y solo en `estado`
  (`information_schema.column_privileges` muestra `UPDATE` únicamente
  para `miembros.estado`, en ninguna otra columna). Confirma
  textualmente lo documentado en `rls-matrix.md` ("Acotado a la columna
  `estado` desde 0148"). Esto es relevante para 0159: las columnas
  nuevas `saldo_cache`/`saldo_actualizado_en` **no** heredan
  automáticamente ningún acceso de `authenticated` — hace falta el
  `REVOKE`/ausencia de `GRANT` explícito que la migración 0159 ya
  incluye (confirmado leyendo el archivo — no se toca en esta fase).
- **`pases_wallet`**, **`transacciones_puntos`**: `authenticated` solo
  tiene `SELECT` — sin `INSERT`/`UPDATE`/`DELETE` a nivel de tabla ni de
  columna. Coincide con `rls-matrix.md`.
- **`registros_dispositivo`**: `authenticated` no tiene ni `SELECT` —
  coincide con "100% del servidor, sin policies para ningún rol de
  aplicación".

**Clasificación: Esperado** — cero discrepancias entre lo documentado en
Fase 2A/2B y lo que existe realmente en producción.

## 7. RLS y funciones existentes

- Las 14 tablas ya existentes tienen `relrowsecurity = true`.
  `registros_dispositivo` tiene 0 policies (100% `service_role`,
  coincide con lo documentado).
- Las 3 funciones de lealtad que ya existen en producción
  (`acreditar_lealtad`, `canjear_recompensa`, `revertir_movimiento`) ya
  son `SECURITY DEFINER` con `search_path=public` fijo — la misma
  convención de seguridad que 0156-0165 extienden, no una que
  introducen desde cero.

**Clasificación: Esperado.**

## Resumen

No se encontró **ningún** drift no documentado ni sorpresivo entre el
modelo asumido en Fase 2A/2B y el esquema remoto real. El único punto
clasificado como bloqueante (la cadena de `CASCADE` hacia el ledger) ya
tiene una corrección diseñada en esta misma fase, aplicada a las
migraciones locales antes de que se propongan para remoto — ver la
sección 3 del reporte principal.
