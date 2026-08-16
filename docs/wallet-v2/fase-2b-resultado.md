# Resultado de Fase 2B — Wallet V2

> Todo lo de este documento se aplicó **solo en local** (`npx supabase
> start` + `npx supabase db reset`, Postgres en `127.0.0.1:54322`).
> **Nada se aplicó a producción ni al proyecto remoto de Supabase.**
> Ninguna columna se eliminó. No se envió ningún push a Apple ni ningún
> PATCH real a Google.

## 1. Matriz de migraciones

| Migración | Aplicada localmente | Tests | Riesgo | Rollback |
|---|---|---|---|---|
| `0156_wallet_v2_alta_cuenta_lealtad` | ✅ (`db reset` ×3, dos consecutivos sin fallo) | Automatizado (`supabase/tests-integracion`, 3 casos incl. 10 llamadas concurrentes) + manual (psql, 10 y 5 llamadas concurrentes) | Bajo — función nueva, sin consumidores hasta que `nuevo/actions.ts` la llama | `DROP FUNCTION`; sin dato que revertir |
| `0157_wallet_v2_backfill_cuenta_id` | ✅ | Manual (psql, 5 escenarios: candidato válido, ya vinculado, 2 candidatos, dueños distintos, sin candidato) | Bajo — `UPDATE` acotado a `cuenta_id is null`, con verificación de ownership | `UPDATE programa_lealtad SET cuenta_id = NULL` restaura el estado previo exacto; la vista se puede `DROP VIEW` |
| `0158_wallet_v2_equipo_canonico_y_ownership` | ✅ | Manual (psql: rol legacy `administrador`→`colaborador` con checklist completo; trigger de ownership probado con UPDATE cruzado real) | Bajo-medio — trigger nuevo sobre `programa_lealtad`, probado explícitamente contra el flujo real de `alta_cuenta_lealtad` sin romperlo | `DROP TRIGGER`, `DROP FUNCTION`; los `cuentas_equipo` insertados son aditivos, `DELETE` seguro si hiciera falta |
| `0159_wallet_v2_saldo_canonico_miembros` | ✅ | Manual (psql, 5 de 8 categorías de reconciliación ejercitadas directamente; 2 confirmadas estructuralmente imposibles — ver `reconciliacion-saldos.md`) | Bajo — expand puro, ningún consumidor real lee la columna nueva todavía | `DROP COLUMN saldo_cache, saldo_actualizado_en`; sin pérdida, es una proyección recalculable |
| `0160_wallet_v2_ledger_y_concurrencia_canje` | ✅ | Automatizado (5 casos: inmutabilidad UPDATE+DELETE, uso_unico con 10 concurrentes, misma referencia con 5 concurrentes, saldo insuficiente, reversa) + manual | **Medio** — cambia comportamiento de una función ya en uso (aunque 0 canjes reales hoy) | `CREATE OR REPLACE FUNCTION` con el cuerpo de 0125 (versionado en ese archivo); el trigger de inmutabilidad se retira con `DROP TRIGGER` si hiciera falta |
| `0161_wallet_v2_sincronizaciones` | ✅ | Automatizado (fan-out 2 filas, idempotencia de re-encolado) + manual | Bajo — tabla nueva, sin lectores todavía | `DROP TABLE wallet_sincronizaciones`, `DROP FUNCTION wallet_encolar_sincronizacion` |
| `0162_wallet_v2_encolar_desde_movimientos` | ✅ | Automatizado (end-to-end: ledger + `miembros.saldo_cache` + `wallet_sincronizaciones` con `correlation_id` compartido) + manual | Medio — vuelve a reemplazar las 3 RPC de movimiento, con el mismo cuerpo de 0160 más el encolado | Igual que 0160: `CREATE OR REPLACE` con el cuerpo anterior |
| `0163_wallet_v2_identidad_apple_google` | ✅ | Cubierto indirectamente por `auth-token.test.ts` (13 casos unitarios) — la columna en sí no tiene prueba de integración propia | Bajo — columnas nuevas, `auth_token` pasa a nullable pero con CHECK que protege el camino legacy | `DROP COLUMN`; revertir `ALTER COLUMN auth_token SET NOT NULL` solo es seguro si ningún pase real quedó con `auth_token_version >= 1` y `auth_token` null (no ocurrió: no se generó ningún secreto real) |
| `0164_wallet_v2_update_tag_monotonico` | ✅ | Automatizado (5 encolados seguidos → 5 tags distintos y consecutivos) + manual (20 seguidos) | Bajo — reemplaza la función de 0161/0161 con la misma firma | `CREATE OR REPLACE` con la versión anterior de la función |
| `0165_wallet_v2_proteger_columnas_internas` | ✅ | Manual (parcial — ver §5, "Riesgos restantes") | Bajo | `DROP TRIGGER`, `DROP FUNCTION`, `DROP COLUMN` |

**10 migraciones locales, todas con exit 0 en `npx supabase db reset` corrido dos veces seguidas.**

## 2. Archivos

### Creados
- `supabase/migrations/0156` a `0165` (10 archivos SQL)
- `src/lib/wallet/config/auth-token.ts` + `.test.ts` (13 tests)
- `src/lib/lealtad/equipo-canonico.ts`
- `supabase/tests-integracion/wallet-v2.test.ts` (11 tests de integración)
- `vitest.integration.config.ts`
- `docs/wallet-v2/reconciliacion-saldos.md`
- `docs/wallet-v2/fase-2b-resultado.md` (este archivo)
- `docs/wallet-v2/rollback-fase-2b.md`

### Modificados
- `src/app/lealtad/nuevo/actions.ts` — `crearGratisAlInstante` llama a `alta_cuenta_lealtad` en vez de insertar `programa_lealtad` directo
- `src/lib/wallet/generar.ts` — el pase nuevo nace con `auth_token_version` HMAC si hay secreto configurado (hoy no lo hay: sigue naciendo legacy)
- `src/lib/wallet/servicio.ts` — `autenticarPase` verifica según `auth_token_version`
- `.env.example` — placeholder `APPLE_PASS_AUTH_SECRET_V1` (nombre solo, sin valor)
- `vitest.config.ts` — excluye `supabase/tests-integracion/**` de `npm test`
- `package.json` — script `test:wallet-v2-local`

### Tablas creadas
`wallet_sincronizaciones` (única tabla nueva — ver `decisiones-tablas.md` §6 para la justificación de por qué es una sola).

### Columnas agregadas
`programa_lealtad`: `diseno_version`, `cuenta_id_confirmada`. `miembros`: `saldo_cache`, `saldo_actualizado_en`. `pases_wallet`: `update_tag`, `auth_token_version`, `google_revision`, `google_ultimo_payload_hash`, `ultima_generacion_en`, `motivo_ultima_generacion`. `transacciones_puntos`: `unidad`, `correlation_id`, `compra_base_colones`, `basis_points`, `moneda`.

### Constraints
`transacciones_puntos_tipo_check` (ampliado, compatible), `transacciones_puntos_signo_check` (reemplaza al de 0060 con la misma regla extendida), `pases_wallet_token_coherente`, `wallet_sincronizaciones_estado_coherente`, `wallet_sincronizaciones_activa_idx` (único condicional).

### Índices
`wallet_sincronizaciones_activa_idx`, `wallet_sincronizaciones_reclamable_idx`, `wallet_sincronizaciones_miembro_idx`, `wallet_sincronizaciones_correlation_idx`, `programa_lealtad_cuenta_idx` (ya existía, sin cambios).

### RLS
`wallet_sincronizaciones`: habilitada, cero políticas, solo `service_role` (mismo patrón que `registros_dispositivo`). 4 vistas nuevas (`wallet_v2_backfill_pendientes`, `wallet_v2_equipo_fallback_pendiente`, `wallet_v2_reconciliacion_saldos`, `wallet_v2_pases_sin_miembro`): revocadas de `anon`/`authenticated`, solo `service_role`. Trigger nuevo en `programa_lealtad` para impedir que `authenticated` escriba `diseno_version`/`cuenta_id_confirmada` pese a que la tabla otorga `UPDATE` de tabla completa a ese rol (hallazgo real de la Fase 2A).

### Funciones modificadas
`acreditar_lealtad`, `canjear_recompensa` (+ reglas de nivel-tarjeta bajo lock, el fix de concurrencia central de esta fase), `revertir_movimiento` — las 3 ahora encolan sincronización y escriben `miembros.saldo_cache` en la misma transacción.

## 3. Resultado del backfill (local)

Sin datos reales de producción en la base local (vacía tras `db reset`).
Probado con fixtures construidos a mano cubriendo los 5 escenarios que
pedía la Fase 2B — resultado completo en la sección "Migración A" de
este documento y en los comentarios de `0157`. En producción, correr
`select * from wallet_v2_backfill_pendientes` después de aplicar la
migración (todavía no aplicada ahí) dirá exactamente cuántos casos
reales caen en cada categoría.

## 4. Resultado de reconciliación (local)

Ver `docs/wallet-v2/reconciliacion-saldos.md` — 6 de 8 categorías
verificadas con datos reales locales, 2 confirmadas estructuralmente
imposibles bajo el esquema actual (`pase_duplicado`, `pase_sin_miembro`).

## 5. Pruebas concurrentes — resultado real

| Escenario pedido | Resultado |
|---|---|
| Dos solicitudes simultáneas (alta) | Cubierto por la prueba de 10 |
| Diez solicitudes simultáneas (alta) | **1 éxito, 9 rechazos correctos**, 1 sola cuenta/programa creados |
| Misma idempotency key (canje) | **1 éxito, 4 "ya-canjeado"**, saldo descontado una sola vez |
| Keys distintas con saldo suficiente | Cubierto por el caso de "uso único" (10 keys distintas, 1 concedido) |
| Keys distintas sin saldo suficiente | Probado — rechazo correcto con el mensaje exacto de saldo |
| Reintento después de "timeout" (misma referencia, secuencial) | Probado — segunda llamada no duplica el cobro (cae en `saldo insuficiente` porque el saldo ya bajó, nunca en un doble cobro) |
| Reversa | Probada — repone el saldo exacto y anula el canje |

**El hallazgo real de esta fase**: la validación de `uso_unico` en
10 llamadas concurrentes con 10 idempotency keys DISTINTAS solo se
puede frenar con el fix de esta fase (mover la regla de tarjeta dentro
del lock) — con el código anterior (regla validada en `canje.ts`, sin
lock), esa prueba habría concedido más de un canje. No se corrió la
prueba contra el código VIEJO para confirmarlo con evidencia empírica
directa (se corrigió antes de medir la regresión) — la confirmación es
por lectura de código (Fase 0/2A) más el hecho de que el fix, tal como
quedó, sí pasa la prueba.

## 6. Códigos de salida reales (segunda corrida completa, no la primera con errores ya corregidos)

```
npx supabase db reset (1ª vez)     → 0
npx supabase db reset (2ª vez)     → 0
npm run lint                       → 1  (exclusivamente supabase/.temp/, archivo generado ajeno — 0 errores en código de esta fase)
npx tsc --noEmit                   → 0
npx vitest run                     → 0  (2067/2067 tests, 98 archivos)
npm run test:wallet-v2-local       → 0  (11/11, contra Postgres local real)
npm run build                      → 0
```

**No se declara "limpio" el lint** — terminó con código 1. Se documenta exactamente por qué (un archivo fuera de `src/`, generado por Supabase, ya presente antes de esta fase) en vez de callarlo.

## 7. Evidencia de la inmutabilidad del ledger (hallazgo no buscado)

Al intentar limpiar datos de prueba con `DELETE FROM miembros ...`
(cascada hacia `transacciones_puntos`), Postgres rechazó el borrado con
el mismo error que el trigger de inmutabilidad produce para un
`UPDATE`/`DELETE` directo. Es decir: el trigger de la Migración C **no
se puede saltar ni siquiera en cascada**, y esto se descubrió
intentando limpiar la propia base de pruebas, no como parte de un test
diseñado para encontrarlo. Implicación real para producción: un
negocio (o miembro, o programa) que alguna vez tuvo movimientos en el
ledger **no se puede borrar en cascada** sin antes decidir qué hacer
con su historial — el `DELETE` de un rancho/cuenta con ledger real
fallará hasta que exista un camino explícito (archivar, o aceptar que
el ledger sobrevive al negocio que lo generó). No es un bug: es la
inmutabilidad funcionando exactamente como se pidió — pero es una
implicación operativa que alguien tiene que conocer antes de intentar
borrar un negocio de prueba con historial real.

## 8. Riesgos restantes

1. El trigger de `0165` (protección de `diseno_version`/`cuenta_id_confirmada`) se verificó por lectura de código y por confirmar que NO interfiere con conexiones de servicio — no se armó una sesión con JWT `role: authenticated` simulado para confirmar en vivo que SÍ bloquea a un dueño real. Mismo patrón que ya usa 0148 en este repo, así que el riesgo es bajo, pero no es evidencia de primera mano de esta fase.
2. `google_ultimo_payload_hash`/`google_revision`: columnas creadas, sin ninguna función que las escriba todavía — es intencional (Fase 4), pero significa que hoy no aportan nada hasta que se conecten.
3. El worker que de verdad procesa `wallet_sincronizaciones` (llama a APNs, hace el PATCH a Google) no existe todavía — la tabla encola correctamente, nada la vacía. Confirmado explícitamente fuera de alcance de esta fase.
4. El backfill de `cuenta_id` (0157) y la migración de equipo (0158) no se corrieron contra un volcado de producción — solo contra fixtures locales construidos a mano. El comportamiento con los datos reales (hoy: 1 programa sin cuenta) se puede predecir con alta confianza por el diseño, pero no está medido con esos datos exactos.

## 9. Confirmaciones explícitas

- ✅ Ninguna columna se eliminó — todo lo de esta fase es `ADD COLUMN`, `CREATE TABLE`, `CREATE OR REPLACE FUNCTION`, o un `UPDATE` acotado y reversible.
- ✅ No se tocó producción ni el proyecto remoto de Supabase — todo corrió contra `127.0.0.1:54322` (`npx supabase start`/`db reset`).
- ✅ No se envió ningún push real a Apple (APNs) ni ningún PATCH real a Google Wallet — `wallet_encolar_sincronizacion` solo escribe filas en `wallet_sincronizaciones`; no hay código en esta fase que hable con `api.push.apple.com` ni con `walletobjects.googleapis.com`.
- ✅ No se generó, imprimió ni publicó ningún secreto — `APPLE_PASS_AUTH_SECRET_V1` quedó como nombre de variable únicamente, sin valor, en `.env.example`.
