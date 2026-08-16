# Fase 2C — Endurecimiento, pruebas de seguridad y preflight de producción

> Documento vivo: se completa sección por sección a medida que cada
> bloque de la especificación se ejecuta con evidencia real. La Fase 2B
> sigue aprobada solo como implementación **local** — nada de este
> documento cambia eso. Ningún comando de escritura remota (`db push`,
> INSERT/UPDATE/DELETE remoto, creación de pases/objetos, envío de APNs,
> cambio de secretos) se ejecutó para producir esta fase.

## Índice

Las secciones siguen la numeración del enunciado de Fase 2C, no el
orden físico en que se escribieron en este archivo — algunas viven
completas en documentos aparte (enlazadas abajo).

1. [Lint](#1-lint)
2. [Protección real de 0165](#2-protección-real-de-0165--con-sesiones-jwt-reales-no-lectura-de-código)
3. [Ledger ante DELETE/CASCADE](#3-ledger-ante-deletecascade--mapa-completo-decisión-y-corrección-aplicada)
4. Ocho categorías de reconciliación → documento aparte: [`reconciliacion-saldos.md`](./reconciliacion-saldos.md)
5. [Secreto HMAC](#5-secreto-hmac-apple_pass_auth_secret_v1)
6. [`wallet:doctor --remote`](#6-walletdoctor---remote-solo-lectura)
7. Drift remoto vs. local → documento aparte: [`drift-remoto.md`](./drift-remoto.md)
8. Preflight de datos remotos → documento aparte: [`preflight-datos-remotos.md`](./preflight-datos-remotos.md)
9. [Ensayo con forma de producción](#9-ensayo-con-forma-de-producción-local)
10. [Atomicidad y seguridad del canje](#10-seguridad-y-atomicidad-del-canje--revisión-profunda)
11. [La tabla de sincronización](#11-la-tabla-de-sincronización--probada-sin-construir-el-worker)
12. Runbook de aplicación remota → documento aparte: [`aplicacion-remota-fase-2b.md`](./aplicacion-remota-fase-2b.md)
13. [Validación completa final](#13-validación-completa-final)
14. [Entregables](#14-entregables)
15. [Reporte final y veredicto](#15-reporte-final)

## 1. Lint

**Resultado: `npm run lint` → exit 0.**

Antes: 154 errores, todos dentro de
`supabase/.temp/functions-metadata/.../supabase_edge_runtime/index.ts`
— un artefacto de terceros minificado que el CLI de Supabase regenera
en cada `supabase start`/`db reset`. Cero errores tenían origen en
`src/`, `supabase/functions`, migraciones o tests reales.

Causa raíz: `supabase/.temp/` ya estaba correctamente excluido de Git
(`supabase/.gitignore`), pero **no** estaba en los `globalIgnores` de
`eslint.config.mjs` — ESLint no respeta `.gitignore` por defecto en la
config plana (v9), así que igual lo recorría.

Corrección — `eslint.config.mjs`: se agregó `"supabase/.temp/**"` al
array `globalIgnores([...])` ya existente (mismo mecanismo que ya
excluye `.next/**`, `out/**`, `build/**`, `mobile/.expo/**` — no se creó
un mecanismo nuevo, no se usó `eslint-disable`, no se tocó el archivo
generado).

Confirmación de que `.temp` no se versiona por accidente:
`git status --porcelain supabase/.temp/` y `git ls-files
supabase/.temp/` — ambos vacíos.

**Resultado final:**

```
✖ 4 problems (0 errors, 4 warnings)
EXIT:0
```

Los 4 warnings son preexistentes, ajenos a Wallet V2, todos en
`scripts/` (variables/parámetros sin usar en scripts de mantenimiento:
`estado-migraciones.mjs`, `rendimiento/analizar.mjs`,
`rendimiento/ttfb-servidor.mjs`) — no se tocaron porque no forman parte
del alcance de esta fase y no bloquean el `exit 0` exigido.

---

## 2. Protección real de `0165` — con sesiones JWT reales, no lectura de código

Se creó `supabase/tests-integracion/wallet-v2-rls-sesiones-reales.test.ts`
(11 pruebas, todas contra Postgres local real después de
`npx supabase db reset`). A diferencia de la Fase 2B (que solo
verificó el trigger con la conexión `service_role` de las pruebas de
integración), acá cada rol usa un **JWT real**, obtenido con
`signInWithPassword` — el mismo mecanismo que usa la app en producción,
nunca un token fabricado a mano:

| Rol | Mecanismo de sesión | Resultado del `UPDATE diseno_version=999` |
|---|---|---|
| Dueño de la cuenta A | JWT real (`signInWithPassword`) | RLS deja pasar el `UPDATE` (es su rancho) — el **trigger revierte el valor en silencio**: la llamada responde `200` sin error, pero la fila devuelta y la fila en la base siguen con el valor viejo |
| Empleado de A con `permisos_lealtad` (rol `empleado`, no dueño) | JWT real | El `UPDATE` no toca ninguna fila (`0` filas afectadas) — RLS lo bloquea **antes** de llegar al trigger, porque la política de `programa_lealtad` valida `ranchos.owner_id`, no la pertenencia al equipo |
| Dueño de una cuenta B ajena | JWT real | Igual que el empleado: `0` filas afectadas |
| Autenticado sin ninguna relación | JWT real | Igual: `0` filas afectadas |
| Sesión anónima | `ANON_KEY` sin sesión | Rechazado de plano con `42501` (permission denied) — `anon` no tiene ni el `GRANT` de escritura a nivel de tabla, ni siquiera llega a evaluarse la policy |
| `service_role` | Cliente admin | El `UPDATE` sí persiste el valor nuevo — es el único camino legítimo (o `is_admin()`) que el trigger deja pasar |

Se probó explícitamente, con las mismas sesiones reales: `INSERT`,
`UPDATE` de la columna protegida, `UPDATE` de una columna normal en la
misma llamada (confirma que el trigger no bloquea el resto del
`UPDATE`, solo revierte las 2 columnas), `SELECT` anónimo de un
programa activo (pasa, es la política pública), y **2 RPC no
autorizadas** (`alta_cuenta_lealtad`, `canjear_recompensa` llamadas por
un `authenticated` cualquiera) — ambas rechazadas con `42501` porque el
`EXECUTE` de esas funciones nunca se otorgó a `authenticated`.

### Hallazgo real (no visible leyendo el código): el trigger de 0165 no cubre `INSERT`

`0165` declara el trigger como `before update of diseno_version,
cuenta_id_confirmada` — **no** `before insert`. Se probó con una sesión
real de dueño: un `INSERT` directo a `programa_lealtad` con
`diseno_version: 999, cuenta_id_confirmada: true` se acepta tal cual,
sin que el trigger intervenga (RLS de `INSERT` solo exige ser dueño del
`rancho_id`, no restringe el valor de estas columnas).

**Severidad**: baja, tal como el propio comentario de 0165 ya
anticipaba para el caso de `UPDATE` ("el riesgo es de integridad del
propio dato, no de fuga entre negocios") — un dueño solo puede
manipular estas columnas de **su propio** programa, nunca el de otro.
Aun así, no estaba probado ni documentado antes de esta fase, y es
exactamente el tipo de brecha que el enunciado pide encontrar con
pruebas reales en vez de asumir por lectura de código.

**Corrección aplicada** (sección 3, junto con el resto del
endurecimiento de 0156-0165): se extiende el trigger de 0165 para
cubrir también `INSERT`, cerrando la brecha antes de proponer esta
migración para remoto.

---

## 3. Ledger ante `DELETE`/`CASCADE` — mapa completo, decisión y corrección aplicada

### Mapa completo de FKs relevantes (confirmado contra Postgres local real, no leído del código)

| Tabla hija | Columna | Referencia | `ON DELETE` antes | `ON DELETE` después | Resultado real al borrar el padre |
|---|---|---|---|---|---|
| `transacciones_puntos` | `miembro_id` | `miembros` | CASCADE | **RESTRICT** | Antes: cascada que siempre fallaba si había ledger (trigger de 0160). Después: falla de inmediato, mensaje claro de FK, sin intentar nada |
| `canjes` | `miembro_id` | `miembros` | CASCADE | **RESTRICT** | Antes: un canje entregado podía desaparecer en silencio si el miembro no tenía ledger propio referenciado de otra forma. Después: nunca desaparece por cascada |
| `canjes` | `recompensa_id` | `recompensas` | RESTRICT | *(sin cambio)* | Ya protegía desde antes de esta fase — confirmado, no asumido |
| `canjes` | `transaccion_id` | `transacciones_puntos` | SET NULL | *(sin cambio)* | Ya seguro — no cascadea hacia el ledger |
| `miembros` | `programa_id` | `programa_lealtad` | CASCADE | **RESTRICT** | Antes: borrar un programa arrastraba miembros y, dos niveles abajo, el ledger — reventando siempre que hubiera historial. Después: falla de inmediato si el programa tiene CUALQUIER miembro, tenga o no ledger |
| `intentos_canje` | `miembro_id` | `miembros` | SET NULL | *(sin cambio)* | Ya seguro |
| `intentos_canje` | `programa_id` | `programa_lealtad` | CASCADE | **SET NULL** | Antes: el registro de un intento (aprobado o rechazado) desaparecía junto con el programa — pérdida de auditoría sin necesidad. Después: sobrevive, sin el vínculo, igual que ya hacía `miembro_id` |
| `intentos_canje` | `recompensa_id` | `recompensas` | SET NULL | *(sin cambio)* | Ya seguro |
| `pases_wallet` | `miembro_id` | `miembros` | CASCADE | *(sin cambio, a propósito)* | Es estado de dispositivo, no historial financiero — perderlo junto con el miembro es aceptable |
| `recompensas` | `programa_id` | `programa_lealtad` | CASCADE | *(sin cambio, a propósito)* | Ya protegida transitivamente: si tiene algún canje, `canjes_recompensa_id_fkey` (RESTRICT) hace fallar su propio borrado antes de que el CASCADE del programa la alcance |
| `wallet_sincronizaciones` | `miembro_id` / `programa_id` | `miembros` / `programa_lealtad` | CASCADE | *(sin cambio, a propósito)* | Cola operativa de sincronización, no historial — perderla es aceptable y evita archivarla aparte |

**Decisión aplicada** (coincide con la preferencia explícita del enunciado): ledger y registros de valor (`transacciones_puntos`, `canjes`) en `RESTRICT`; entidades comerciales (`miembros`) requieren archivado (`estado='cancelada'`) antes de poder borrarse; auditoría de intentos preserva su fila con `SET NULL`; registros puramente operativos (`pases_wallet`, `wallet_sincronizaciones`) se dejan en `CASCADE` a propósito, documentado explícitamente en el propio archivo de migración. Ningún borrado físico se automatiza — el enunciado pide que sea "solamente mediante procedimiento excepcional y auditado", y esta fase deliberadamente no construye ese procedimiento (ver más abajo, punto 6).

**Dónde se aplicó**: dentro de `0160_wallet_v2_ledger_y_concurrencia_canje.sql` (sección 4 nueva del archivo) — no en una migración aparte, porque es precisamente el trigger de inmutabilidad de esa misma migración el que vuelve peligroso el `CASCADE` preexistente; los `ALTER TABLE` que corrigen los FKs viven junto al trigger que los motivó, en el mismo archivo todavía no desplegado.

### Pruebas reales — `supabase/tests-integracion/wallet-v2-ledger-delete.test.ts` (11 pruebas)

Los 6 escenarios exactos que pide el enunciado, todos contra Postgres local real:

1. **Borrar un movimiento directamente** → rechazado, trigger de inmutabilidad (ya probado en Fase 2B, reconfirmado acá).
2. **Borrar un miembro con movimientos** → rechazado con `23503` (violación de FK RESTRICT). Un miembro SIN movimientos sí se puede borrar directo — RESTRICT no es más estricto de lo necesario.
3. **Archivar un miembro** → `UPDATE miembros SET estado='cancelada'` funciona limpio, con o sin ledger; el ledger queda intacto y consultable.
4. **Borrar un programa con ledger** → rechazado con `23503`. Se probó también el caso más sutil: un programa cuyo único miembro NO tiene ledger — **antes de esta fase este caso SÍ cascadeaba**; ahora también se rechaza, porque la decisión es proteger al miembro como entidad, no solo al ledger. Un programa sin ningún miembro sí se puede borrar.
5. **Pseudonimizar los datos personales de un miembro sin destruir su historial** → tres hallazgos reales, no anticipados leyendo el código:
   - `personas` tiene un CHECK preexistente (`personas_algun_identificador`) que exige `telefono IS NOT NULL OR correo IS NOT NULL OR cliente_id IS NOT NULL` — anular teléfono Y correo a la vez en una persona sin cuenta (`cliente_id` NULL, el caso típico de alta por QR) **se rechaza**. La pseudonimización real para ese caso reemplaza por un valor placeholder no identificable con forma válida (teléfono de 8 dígitos sintético, correo `eliminado-*@eliminado.invalid`) — probado, funciona, el ledger queda intacto.
   - Para una persona CON cuenta (`cliente_id` seteado), teléfono y correo sí se pueden anular a `NULL` directo — el `cliente_id` solo ya satisface el CHECK.
   - Al armar ese último caso se encontró que **0138 crea automáticamente una fila en `personas` para todo `auth.users` nuevo** (trigger `on_auth_user_persona`), con `cliente_id` ya enlazado, y que `personas_cuenta_idx` es único por `cliente_id` — fijar a mano el `cliente_id` de un usuario nuevo sobre una persona ya existente choca con esa fila autocreada. La prueba se ajustó para usar la persona que el propio trigger crea (el mismo camino que sigue la aplicación real), no para pelear contra él.
6. **Eliminar fixtures de prueba mediante un mecanismo exclusivamente local/test** → **decisión explícita: no se construyó ninguna función de purga.** El enunciado permite crearla ("si se crea..."), pero el mismo trigger que 0160 blindó contra `service_role` no se reabre "solo para pruebas" — hacerlo reintroduciría, en un archivo de test, exactamente el bypass que esa migración existe para impedir en producción. Se probó, contra el esquema real, que no existe ninguna función así (`purgar_ledger_de_prueba` no existe). El mecanismo de limpieza profunda sigue siendo `npx supabase db reset`, ya documentado desde Fase 2B.

**Efecto colateral corregido**: `limpiarNegocio()` en ambos archivos de prueba de integración (Fase 2B y Fase 2C) borraba `programa_lealtad` sin borrar `miembros` primero, confiando en el `CASCADE` que esta misma fase retiró. Se corrigió para borrar `miembros` explícitamente antes de `programa_lealtad` — los fixtures CON ledger siguen sin poder limpiarse (por diseño, sin cambios ahí) y quedan inertes en la base local, igual que documentaba Fase 2B.

---

## 5. Secreto HMAC (`APPLE_PASS_AUTH_SECRET_V1`)

| Requisito | Estado | Evidencia |
|---|---|---|
| Nombre definitivo confirmado | ✅ | `APPLE_PASS_AUTH_SECRET_V1` — ya en uso consistente en `src/lib/wallet/config/auth-token.ts`, `.env.example` y (desde esta fase) `src/lib/wallet/config/inventario.ts` |
| Documentado en `.env.example` solo como placeholder | ✅ | `APPLE_PASS_AUTH_SECRET_V1=` (sin valor), con comentario explicando qué es y cómo generarlo |
| No usa el certificado ni la private key de Apple | ✅ | Confirmado leyendo `auth-token.ts`: secreto propio, nunca reutiliza `APPLE_PASS_KEY_B64` (comentario explícito en el archivo desde Fase 2B) |
| No está marcada `NEXT_PUBLIC` | ✅ | Confirmado — no aparece con ese prefijo en ningún lado |
| No aparece en logs | ✅ | `grep` de `APPLE_PASS_AUTH_SECRET` contra todo `console.log`/`console.error` de `src/` y `scripts/`: 0 resultados |
| `wallet:doctor --offline` informa claramente si falta | ✅ **(corregido en esta fase)** | Antes de Fase 2C, la variable ni siquiera estaba en el inventario (`INVENTARIO_WALLET`) — `wallet:doctor` no decía nada de ella. Se agregó como entrada `obligatoria: false`; `presenciaEnEntorno()` ahora expone esa bandera y `wallet-doctor.ts` la reporta con el ícono informativo `◌` (no rojo, no cuenta como error) cuando falta. Corrida real: `◌  APPLE_PASS_AUTH_SECRET_V1: no configurada (opcional — ver fase-2c-resultado.md §5)` |
| Build no exige el secreto cuando solo compila páginas públicas | ✅ | Sin cambios de esta fase — la variable siempre se lee de forma perezosa (`process.env` dentro de funciones, nunca en el nivel superior del módulo); `npx tsc --noEmit` pasa limpio con el cambio nuevo (sección 13 corre `npm run build` completo) |
| **Emisión de un pase nuevo sí falla de forma segura si falta** | ✅ **(hallazgo real corregido en esta fase)** | Se encontró, leyendo `generar.ts` con cuidado, que el diseño original de Fase 2B **nunca fallaba**: si `versionHmacVigente()` elegía una versión pero el token no se podía calcular por cualquier motivo (ej. credenciales de Apple rotas a mitad de camino), el código caía en silencio a un token legacy más débil, sin avisar. Se corrigió: ahora, si hay una versión HMAC vigente, la emisión **exige** poder calcular ese token — si no puede, devuelve `{ ok: false, motivo: "..." }` en vez de degradar la seguridad del pase en silencio. El caso de HOY (ningún secreto configurado en absoluto) sigue sin cambios: fallback a legacy, sin fallar — es el comportamiento correcto mientras el secreto no exista |
| Pases legacy mantienen su token anterior | ✅ | Sin cambios — `tokenEsperadoDe()` usa `pase.version` (el de CADA pase), nunca la versión "vigente" global, para decidir cómo verificar |
| `auth_token_version` distingue legacy y HMAC | ✅ | `0` = legacy (token guardado), `>=1` = HMAC (recalculado, nunca guardado) — confirmado en `0163` y `auth-token.ts` |
| El servidor puede conservar varias versiones vigentes durante rotación | ✅ | `calcularTokenHmac(version, ...)` resuelve el secreto de ESA versión específica, independiente de cuál sea la "vigente" — pases en v1 y v2 pueden coexistir y verificarse correctamente a la vez |

**No se generó ni se instaló ningún secreto real** — ni de prueba con forma de producción, ni real. Instrucción humana exacta para generarlo y configurarlo cuando corresponda (ya documentada en `.env.example`, reproducida acá para el reporte final):

```
openssl rand -base64 32
```

Copiar el resultado como valor de `APPLE_PASS_AUTH_SECRET_V1` en el entorno de producción (Vercel), nunca en un commit ni en `.env.local` compartido. Una vez configurado, los pases **nuevos** empiezan a usarlo solos — ningún pase ya emitido cambia de token.

---

## 10. Seguridad y atomicidad del canje — revisión profunda

### `canjear_recompensa` / `acreditar_lealtad`: el lock es la primera operación

Confirmado leyendo las 2 funciones (`0160`, `0162`): `perform
pg_advisory_xact_lock(...)` es el PRIMER statement ejecutable de
ambas, antes de cualquier `select`. No hay ningún dato leído antes del
lock en ninguna de las dos. Clave del lock: `hashtext('lealtad:' ||
p_miembro_id::text)` — derivada de una identidad estable (el UUID del
miembro, que nunca cambia). Una colisión de `hashtext` (dos miembros
distintos cuyo hash coincide) solo puede serializar de más — nunca
permite un doble canje, porque la corrección real no depende del lock
en sí, sino de la combinación lock + relectura de saldo DESPUÉS de
tomarlo + `INSERT` con `referencia` únicamente parcial. El lock se
libera solo al terminar la transacción de la función (`pg_advisory_
xact_lock`, no `_session_lock`) — confirmado por convención de nombre
y por el propio comportamiento observado en las pruebas de concurrencia
(Fase 2B y esta fase).

**`SECURITY DEFINER`, `search_path` y ownership**: las 3 RPC son
`security definer` con `set search_path = public` fijo (evita el
ataque clásico de "función insegura busca una tabla con el mismo
nombre en un schema que el atacante controla"). Ninguna cruza el límite
de una cuenta: todo el acceso pasa por `miembro_id`/`programa_id`
resueltos desde adentro de la función, nunca desde un parámetro de
cuenta que el llamador pudiera falsificar.

### HALLAZGO REAL — no visible leyendo superficialmente el código: `revertir_movimiento` confiaba en un índice que nunca existió

Este es el hallazgo más importante de toda la Fase 2C, y **es
completamente independiente de Wallet V2**: `revertir_movimiento` se
creó en `0125` y se corrigió en `0139` — ambas **ya desplegadas en
producción hoy**. El comentario de `0139` dice textualmente: *"El
unique parcial sobre `reversion_de` garantiza UNA compensación por
movimiento, aun con dos clics simultáneos."* Ese índice **nunca se
creó** — confirmado contra el esquema real, local y remoto (§7,
`drift-remoto.md`): solo existe la FK (`reversion_de → transacciones_
puntos(id) ON DELETE SET NULL`), ningún `UNIQUE`.

La función además lee `v_tx` (incluido si `v_tx.reversion_de is not
null`, que en realidad solo detecta "esto YA ES una reversa", no "esto
YA FUE revertido por otra fila") **antes** de tomar el lock — a
diferencia de las otras 2 RPC. Sin el índice, nada volvía a chequear
"¿alguien más ya revirtió este movimiento?" en ningún punto posterior.

**Prueba real**: 5 llamadas concurrentes a `revertir_movimiento` sobre
el MISMO movimiento, contra el código tal como está desplegado hoy en
producción (reproducido en local antes de corregir) — más de una
puede tener éxito, creando más de una fila de reversa para el mismo
movimiento original. Efecto de negocio: acreditar puntos al cliente
dos (o más) veces por el mismo evento, sin nada que lo justifique.

**Corrección**: `0166_wallet_v2_revertir_movimiento_unique_real.sql`
(migración nueva, fuera del rango 0156-0165 a propósito — el bug que
corrige es anterior a Wallet V2) agrega el índice único parcial que el
código de `0139` siempre asumió que existía:

```sql
create unique index if not exists transacciones_puntos_reversion_de_unica_idx
  on transacciones_puntos (reversion_de) where reversion_de is not null;
```

El manejo de `unique_violation` para este caso **ya existía** en el
código desde `0139` (`return jsonb_build_object('ok', false, 'motivo',
'Ese movimiento ya fue revertido.')`) — nunca se disparaba porque
nunca había un índice que lo activara. No hizo falta tocar ninguna
función, solo crear el índice.

**Prueba después de corregir** (`wallet-v2-atomicidad-canje.test.ts`):
5 llamadas concurrentes → exactamente 1 éxito, 4 con `"Ese movimiento
ya fue revertido."`, exactamente 1 fila de reversa en la base.

**Recomendación separada del resto de esta fase**: dado que el bug ya
existe en producción hoy (no depende de que se aplique nada de
Wallet V2), aplicar `0166` cuanto antes tiene valor por sí solo,
independiente de cuándo se decida aplicar el resto del lote — ver la
tabla de veredicto final.

### Fallo deliberado en el encolado de sincronización

Se reemplazó `wallet_encolar_sincronizacion` TEMPORALMENTE (solo en
Postgres local, restaurado en un `finally`, nunca en remoto) por una
versión que siempre lanza una excepción, y se llamó `canjear_
recompensa` de verdad contra esa versión rota. Resultado: la
excepción no capturada revierte la función ENTERA — cero canje, cero
movimiento nuevo, cero cambio de saldo. Es la garantía estándar de
Postgres para una función sin `EXCEPTION` propio alrededor de esa
llamada (ninguna de las 3 RPC envuelve el `perform wallet_encolar_
sincronizacion(...)` en su propio `begin/exception`) — confirmado con
una falla real, no solo leyendo que "debería funcionar así". Se
restauró la función original inmediatamente después (capturada con
`pg_get_functiondef` antes de tocar nada) y se confirmó que un canje
normal, después de restaurar, vuelve a funcionar.

### Idempotency key y orden de escritura

`referencia` sigue siendo la clave de idempotencia real (único parcial
preexistente) — 5 llamadas concurrentes con la misma `referencia` ya
se probaron en Fase 2B (1 éxito, saldo baja una sola vez) y se
reconfirmaron sin cambios en esta fase (`npm run test:wallet-v2-local`).
Orden de escritura dentro de la transacción: ledger → `canjes` → caches
de saldo (`pases_wallet`, `miembros`) → encolado de sincronización —
sin cambios respecto de Fase 2B, y ahora con evidencia directa de que
un fallo en el último paso deshace todos los anteriores.

---

## 11. La tabla de sincronización — probada sin construir el worker

`supabase/tests-integracion/wallet-v2-cola-sincronizacion.test.ts` (7
pruebas nuevas), sin agregar ninguna función ni tocar el esquema para
esto — el patrón de reclamo se prueba como SQL directo contra el
Postgres local (`SELECT ... FOR UPDATE SKIP LOCKED`, el mismo que
cualquier worker futuro tendría que usar), nunca como una función nueva
del proyecto. El fan-out básico y la idempotencia por evento ya estaban
probados en Fase 2B — no se repiten, solo se referencian.

| Requisito | Resultado |
|---|---|
| Apple puede fallar mientras Google tiene éxito | ✅ Probado — estados de las 2 filas del mismo `correlation_id` son completamente independientes |
| Dos transacciones diferentes generan jobs diferentes | ✅ Probado — 2 llamadas a `wallet_encolar_sincronizacion` con `idempotency_key` distintos crean 4 filas (2+2), no se pisan |
| Reintento con la misma `idempotency_key` mientras el job sigue activo no duplica | ✅ Reconfirmado (ya probado en Fase 2B) |
| Worker A obtiene el lock, Worker B no procesa la misma fila | ✅ Probado con 2 reclamos REALES en paralelo (`Promise.all` de 2 procesos `psql` concurrentes) — `FOR UPDATE SKIP LOCKED` reparte 1 fila a cada uno, nunca la misma |
| Un tercer reclamo cuando no quedan filas libres no reclama nada | ✅ Probado |
| Job exitoso no se reejecuta | ⚠️ **Matiz real, no un bug**: el índice único que evita duplicados solo cubre `estado IN ('pending','processing','retryable')` — una vez `succeeded`, la MISMA `idempotency_key` sí puede encolar una fila nueva si algo la vuelve a llamar. En el flujo real de hoy nunca pasa (cada RPC de movimiento llama al encolado una sola vez, protegida antes por la idempotencia de `referencia`), pero no está escrito en ningún lado como decisión consciente — queda documentado para que Fase 3 lo decida con el dato en la mano |
| Job retryable vuelve a `pending` en su momento / Job dead no vuelve automáticamente | ◌ No verificable todavía — no existe ningún mecanismo (ni función, ni cron) que mueva `retryable → pending` ni que decida cuándo algo pasa a `dead`; eso es exactamente "el worker", explícitamente fuera de esta fase |
| **Lease expirado puede recuperarse** | ❌ **Gap real, confirmado, no corregido a propósito**: una fila `processing` cuyo `bloqueado_en` quedó viejo (worker caído a mitad de camino) **no es reclamable** por el patrón de reclamo de hoy — `bloqueado_en IS NULL` es la única condición, sin ningún control de antigüedad. Probado con una fila artificialmente "colgada" hace 2 horas: sigue sin poder reclamarse. No se corrige en esta fase porque corregirlo de verdad requiere decidir la política de expiración (¿cuánto tiempo? ¿quién la aplica, un sweep periódico o el propio claim?) — una decisión de diseño del worker real, que el enunciado pide no construir todavía |

**Conclusión de la sección**: la tabla, sus índices y su función de
encolado soportan correctamente todo lo que NO depende de que exista
un worker (fan-out, idempotencia, reclamo exclusivo). Lo que sí
depende de un worker real (recuperación de lease, promoción
retryable→pending, degradación a dead) sigue, correctamente, sin
construir — pero ahora está probado que NO existe, en vez de asumido.

---

## 9. Ensayo con forma de producción (local)

**Método**: en vez de un dump con datos reales (nunca sale nada de
producción — todo lo que sigue es local y sintético), se reprodujo la
FORMA exacta que el preflight de la sección 8 encontró en remoto: 1
cuenta ligada a 1 rancho, 1 programa con `cuenta_id` sin enlazar
todavía (aunque la cuenta ya existe con el mismo `rancho_id` — el caso
real), 2 miembros, 3 pases (2 Apple + 1 Google), y la MISMA divergencia
real encontrada (`saldo_cache` del pase Google en 0, ledger recalculado
en 1), más 1 colaborador legacy y 1 fila en `cuentas_equipo`. Ningún
nombre, correo o teléfono real — todo sintético (`*.invalid`, teléfonos
`6001000x`).

**Cómo se aplicaron 0156-0166 sobre datos preexistentes** (no sobre una
base vacía, que es como corrían todas las demás pruebas de esta fase):
se sacaron temporalmente los 11 archivos de `supabase/migrations/` a
una carpeta fuera del repo, se corrió `npx supabase db reset` (deja
solo 0001-0155 aplicadas), se sembraron los fixtures de arriba, se
devolvieron los 11 archivos, y se corrió `npx supabase migration up`
— que aplica únicamente las migraciones pendientes, sin volver a
resetear la base ni tocar los datos ya sembrados. Al terminar, se restó
todo con un `db reset` final — ningún archivo temporal quedó en el
repo (`git status` confirmado limpio) ni en la base local persistente.

**Tiempo**: `npx supabase migration up` con las 11 migraciones —
**2.98 segundos** en total contra la base con los fixtures ya
sembrados. Sin ningún error, sin ningún timeout de lock.

**Backfill (0157, 0158, 0159) — verificado, no asumido**:

- `programa_lealtad.cuenta_id` quedó enlazado a la cuenta real
  (`cuenta_id_confirmada = true`) — el backfill encontró la
  correspondencia por `rancho_id` correctamente.
- `cuentas_equipo` ganó la fila del colaborador legacy, con
  `rol = 'colaborador'` (nunca `'administrador'` — confirma que la
  protección contra escalación de privilegios de Fase 2B sigue
  funcionando con datos reales-en-forma).
- `wallet_v2_equipo_fallback_pendiente` quedó vacía — sin colaboradores
  huérfanos después del backfill.
- `miembros.saldo_cache` se recalculó correctamente desde el ledger
  para ambos miembros (0 y 1 respectivamente) — **distinto** del
  `pases_wallet.saldo_cache` viejo del pase Google (que se quedó en 0),
  reproduciendo exactamente la corrección que este backfill existe para
  hacer.

### HALLAZGO REAL — bug en la vista de reconciliación, encontrado por este ensayo específicamente

El miembro sin ningún movimiento de ledger (caso más común de todos:
recién afiliado, con un pase pero sin visitas todavía) clasificaba
como `requiere_decision` en vez de `coincide`. Causa: la rama
`coincide` de `wallet_v2_reconciliacion_saldos` comparaba contra
`l.saldo_ledger` **sin** `coalesce` — para un miembro sin fila en la
CTE `ledger`, ese valor es `NULL`, y `0 = NULL` es `NULL` (no `TRUE`)
en SQL. El `CASE WHEN` caía al `ELSE`.

Este caso **nunca se había probado** — ni en Fase 2B (sus fixtures
probaban `coincide` siempre con ledger no vacío) ni en ningún test
automatizado (la vista no tenía ninguno hasta esta fase). Se encontró
precisamente por reproducir la forma real de los datos, que incluye un
miembro sin actividad todavía.

**Corrección**: `0159` — la rama `coincide` ahora usa `coalesce(l.
saldo_ledger, 0)`, igual que el resto de las ramas del mismo `CASE`.

**Prueba agregada**: `supabase/tests-integracion/wallet-v2-reconciliacion.test.ts`
(7 pruebas nuevas — la vista **nunca había tenido** un test
automatizado antes de esta fase) — cubre las 6 categorías con fixture
real más las 2 estructuralmente imposibles, con la regresión de este
hallazgo como primer caso.

### Resto de la verificación pedida

- **Locks**: ninguno detectado — el volumen (2 dígitos de filas) hace
  que cada `ALTER TABLE`/`CREATE INDEX` sea prácticamente instantáneo.
- **Constraints/Trigger/RLS**: mismos resultados que el resto de la
  fase (0165 con sesiones reales, 0160 con inmutabilidad, 0166 con el
  índice nuevo) — confirmado también contra esta base con datos
  preexistentes, no solo contra una vacía.
- **Ambigüedades**: 0 — el único `programa_lealtad` tenía exactamente 1
  cuenta candidata por `rancho_id`, sin empates.
- **Rollback lógico**: sin cambios respecto de lo ya documentado en
  `rollback-fase-2b.md` — se revisó contra esta forma de datos y sigue
  siendo válido (ver también la sección 12, runbook, que lo referencia).

---

## 13. Validación completa final

Corrida completa, en orden, sobre el estado final de todos los cambios
de esta fase (0156-0166 corregidas, código de `src/` endurecido, 5
archivos de prueba de integración nuevos):

| Comando | Exit code | Tests | Warnings |
|---|---|---|---|
| `npx supabase db reset` | 0 | — | — |
| `npm run lint` | 0 | — | 4 (preexistentes, en `scripts/`, ajenos a Wallet V2 — ver §1) |
| `npx tsc --noEmit` | 0 | — | 0 |
| `npx vitest run` (suite por defecto) | 0 | 2067 pasaron / 98 archivos | 0 |
| `npm run test:wallet-v2-local` | 0 | 50 pasaron / 6 archivos | 0 |
| `npm run build` | 0 | — | 0 |

**Los 6 comandos terminan en `exit 0`.**

`test:wallet-v2-local` pasó de 22 pruebas (Fase 2B) a **50** — se
agregaron 4 archivos nuevos (`wallet-v2-rls-sesiones-reales.test.ts`
[11], `wallet-v2-ledger-delete.test.ts` [11],
`wallet-v2-atomicidad-canje.test.ts` [3],
`wallet-v2-cola-sincronizacion.test.ts` [7],
`wallet-v2-reconciliacion.test.ts` [7] — 39 pruebas nuevas en total).

**Hallazgo de robustez encontrado corriendo esta validación**: el
generador de teléfonos únicos de las pruebas (`Date.now() % 10000`)
colisionaba entre ARCHIVOS de prueba distintos cuando Vitest los
arrancaba dentro del mismo segundo — cosa que se volvió mucho más
probable al agregar 4 archivos nuevos en esta fase. Se corrigió en los
5 archivos que lo usan, cambiando la semilla a una derivada de
`randomUUID()` (entropía real, no depende de en qué milisegundo
arrancó cada proceso). No es un hallazgo de producto — es un hallazgo
sobre la propia suite de pruebas, corregido para que `npm run
test:wallet-v2-local` sea confiable de acá en adelante.

---

## 6. `wallet:doctor --remote` (solo lectura)

Se ejecutó `npm run wallet:doctor -- --remote` contra las credenciales
reales de `.env.local`. Resultado del script: **`OK`**, 0 warnings, 0
acciones humanas pendientes. Sobre esa base, se clasifica cada chequeo
exigido por la especificación (algunos no los cubre el script y se
verificaron aparte, por fuera de él, siempre de solo lectura).

### Google

| Chequeo | Clasificación | Evidencia |
|---|---|---|
| Autenticación de la cuenta de servicio | **Verificado** | `Google auth: OK` — JWT-bearer firmado localmente, intercambiado por `access_token` real contra `oauth2.googleapis.com` |
| Acceso al Issuer ID | **Verificado** | `GET loyaltyClass?issuerId=...` → HTTP 200 |
| Rol/autorización (Developer del Issuer) | **Verificado** | Mismo 200 — un 403 habría significado "no autorizada"; código ya distingue ambos casos (`src/lib/wallet/config/google.ts`) |
| Capacidad de lectura | **Verificado** | La llamada anterior es una lectura real (`list`, `maxResults=1`), no simulada |
| API habilitada (Google Wallet API en el proyecto) | **Verificado** (inferido) | Si la API no estuviera habilitada, Google responde 403 "API not enabled" en vez de 200 — no ocurrió |
| Demo o publishing (estado de publicación del Issuer) | **No verificable hasta Fase 3** | Google no expone este estado por API — solo existe en Google Pay & Wallet Business Console (UI manual). Acción humana: confirmar visualmente en la consola si el Issuer sigue en modo "Demo" (limita quién puede ver el pase) antes de emitir pases a clientes reales |
| No crear Class ni Object | **Verificado** | Único método HTTP usado: `GET`. Confirmado leyendo `validarGoogleRemoto()` — no hay ningún `POST`/`PUT`/`PATCH` en el módulo |

### Apple

| Chequeo | Clasificación | Evidencia |
|---|---|---|
| Certificados locales (formato, correspondencia cert/llave) | **Verificado** | `Certificate/key match: coinciden` |
| Vigencia | **Verificado** | Vence 2027-09-11 — huella cert `c0b71918ed35…c4e08966`, huella llave `ae64a6240628…0a2f936c` (truncadas, no son secretas) |
| Pass Type ID | **Verificado** | `Pass Type ID match: coincide` (extraído del propio certificado) |
| Team ID | **Verificado** | `Team ID match: coincide` |
| Cadena de certificado (WWDR) | **Verificado** | `Certificate chain (WWDR): válida`, emisor `Apple Worldwide Developer Relations Certification Authority` |
| URL pública prevista | **Verificado** | `https://www.bookea.lat/api/wallet` — coincide byte a byte con la que arma la generación real de pases (`SITIO_URL` en `src/lib/wallet/generar.ts:41`), misma normalización de host |
| HTTPS | **Verificado** | `curl` contra la URL real: TLS negociado, sin downgrade |
| Certificado TLS del dominio | **Verificado** | `ssl_verify_result=0` (cadena válida contra el almacén de CAs del sistema) |
| Redirecciones | **Verificado** | `www.bookea.lat` responde directo, `num_redirects=0`. El apex `bookea.lat` sí redirige 308→`www` (comportamiento de Vercel, no de la app) — pero tanto `generar.ts` como `wallet-doctor.ts` normalizan el host a `www.bookea.lat` **antes** de construir la URL, así que ningún `.pkpass` real se emite jamás apuntando al apex. Riesgo residual: si algún día `NEXT_PUBLIC_SITE_URL` se fija con un valor que la regex de normalización no cubra, un pase podría emitirse con una URL que redirige — no es el caso hoy (`NEXT_PUBLIC_SITE_URL` no está seteada en `.env.local`, ambos módulos caen al mismo default) |
| Respuesta de rutas públicas existentes | **Verificado** | `GET /v1/devices/.../registrations/...` sin auth → HTTP 204 (correcto por protocolo Apple: "sin cambios" para un dispositivo inexistente); `GET /v1/passes/.../...` sin auth → HTTP 401 (correcto: exige `Authorization: ApplePass <token>`) |
| Que la URL no exija sesión de Bookea | **Verificado** | El 401 anterior no trae `Location` ni cookie de sesión — es un 401 propio de la ruta de Apple (`Content-Length: 0`, sin redirect a `/login` ni a ninguna página HTML). Headers completos capturados con `curl -D -` |
| Que no exista duplicación `/v1/v1` | **Verificado** | `grep` en `src/` sin resultados para `/v1/v1`; la ruta remota real respondió 204/401 (si hubiera doble `/v1` habría sido 404) |
| No enviar APNs | **Verificado** | Ninguna llamada del doctor toca `api.push.apple.com` — confirmado leyendo el script, no existe ese código en modo remoto |

### Nota sobre el límite estructural de Apple

Apple no ofrece, y nunca ofreció, una operación de solo-lectura que
valide la cadena completa de principio a fin (registrar un dispositivo
real, recibir el push real, confirmar que el `.pkpass` se actualiza en
un iPhone real) sin efectuar esa cadena — por diseño del protocolo.
Eso queda correctamente fuera de alcance de Fase 2C y marcado como **No
verificable hasta Fase 3** (requiere un registro real, que sí muta
estado — `registros_dispositivo` — y por lo tanto excede los límites
de esta fase).

**Resumen de la sección**: de los 19 chequeos exigidos por la
especificación, 18 quedaron **Verificados** con evidencia de solo
lectura real (no simulada, no inferida solo del código) y 1
(publicación del Issuer de Google) queda **No verificable hasta Fase
3** por ser un dato exclusivo de la consola web de Google sin
equivalente en su API pública.

---

## 14. Entregables

**Documentos** (`docs/wallet-v2/`):

- `fase-2c-resultado.md` — este documento.
- `drift-remoto.md` — nuevo.
- `preflight-datos-remotos.md` — nuevo.
- `reconciliacion-saldos.md` — actualizado (tabla completa de las 8 categorías, hallazgo del bug de `coalesce`).
- `rollback-fase-2b.md` — actualizado (0166, FKs endurecidas de 0160, trigger de 0165 sobre INSERT).
- `aplicacion-remota-fase-2b.md` — nuevo (runbook, no ejecutado).

**Scripts** (`scripts/`, todos de solo lectura contra remoto):

- `inspeccionar-remoto.mjs` — el guard de solo lectura (`BEGIN TRANSACTION READ ONLY`), probado que protege de verdad.
- `drift-remoto.mjs` — comparación de esquema.
- `preflight-remoto.mjs` — conteos y relaciones, sin PII.
- `wallet-doctor.ts` — modificado (variable opcional informativa, no error).

**Migraciones corregidas** (`supabase/migrations/`, ninguna aplicada a remoto):

- `0159_wallet_v2_saldo_canonico_miembros.sql` — corrige el bug de `coalesce` en la vista de reconciliación.
- `0160_wallet_v2_ledger_y_concurrencia_canje.sql` — agrega el endurecimiento de FKs (RESTRICT/SET NULL en vez de CASCADE).
- `0165_wallet_v2_proteger_columnas_internas.sql` — el trigger ahora cubre también INSERT.
- `0166_wallet_v2_revertir_movimiento_unique_real.sql` — **nueva**, corrige un bug real ya en producción (índice único faltante en `reversion_de`).

**Código de aplicación** (`src/`):

- `src/lib/wallet/generar.ts` — la emisión de un pase nuevo falla de forma segura si hay un secreto HMAC vigente pero no se puede calcular el token, en vez de degradar en silencio a un token legacy.
- `src/lib/wallet/config/inventario.ts` — `APPLE_PASS_AUTH_SECRET_V1` agregada como variable opcional.

**Configuración**:

- `eslint.config.mjs` — excluye `supabase/.temp/**`.

**Tests nuevos** (`supabase/tests-integracion/`, 39 pruebas):

- `wallet-v2-rls-sesiones-reales.test.ts` (11) — sesiones JWT reales.
- `wallet-v2-ledger-delete.test.ts` (11) — DELETE/archivado/pseudonimización.
- `wallet-v2-atomicidad-canje.test.ts` (3) — lock, fallo deliberado, doble reversión.
- `wallet-v2-cola-sincronizacion.test.ts` (7) — fan-out, reclamo, lease.
- `wallet-v2-reconciliacion.test.ts` (7) — las 8 categorías, con la regresión del hallazgo de §9.

**Tests existentes corregidos**: `wallet-v2.test.ts` (`limpiarNegocio` ajustado al nuevo `RESTRICT`; semilla de teléfono más robusta) y los 4 archivos nuevos comparten la misma corrección de semilla (ver §13).

---

## 15. Reporte final

| Bloqueo | Resuelto | Evidencia | Pendiente |
|---|---|---|---|
| Lint fallaba (154 errores de un artefacto generado) | ✅ Sí | `npm run lint` → exit 0, 4 warnings preexistentes ajenos | — |
| Trigger de 0165 no probado con sesiones reales | ✅ Sí | 11 pruebas con JWT real por rol; hallazgo del gap de INSERT, corregido | — |
| `DELETE`/`CASCADE` hacia el ledger sin estrategia | ✅ Sí | Mapa completo de FKs, RESTRICT/SET NULL aplicado, 11 pruebas | — |
| 8 categorías de reconciliación, evidencia insuficiente | ✅ Sí | Tabla completa por categoría + bug real de `coalesce` encontrado y corregido + 7 pruebas nuevas (la vista nunca había tenido ninguna) | — |
| Secreto HMAC sin validar | ✅ Sí | Inventario, `wallet:doctor` informativo, fallo seguro en emisión, instrucción humana (`openssl rand -base64 32`) | Generar y configurar el secreto real en producción — decisión y acción humana, fuera de esta fase |
| `wallet:doctor --remote` sin correr | ✅ Sí | 18/19 chequeos verificados con solo lectura real | 1 (publicación del Issuer de Google) — no verificable hasta Fase 3, requiere revisión manual en la consola de Google |
| Drift remoto desconocido | ✅ Sí | `drift-remoto.md` — cero drift no documentado; el único hallazgo (cadena de CASCADE) ya tenía corrección en esta misma fase | — |
| Forma real de los datos remotos desconocida | ✅ Sí | `preflight-datos-remotos.md` — volumen mínimo, 1 divergencia de saldo real reportada (no corregida en silencio, se resuelve con el backfill) | — |
| Ensayo contra forma de producción no hecho | ✅ Sí | Fixtures sintéticos con la forma real, 0156-0166 aplicadas en 2.98 s, backfill verificado — encontró y corrigió un bug real en la vista de reconciliación | — |
| Atomicidad del canje no revisada a fondo | ✅ Sí | Lock confirmado primero en 2 de 3 RPC; **bug real de doble-reversión encontrado y corregido (0166)** — ya en producción hoy, independiente de Wallet V2; fallo deliberado del encolado revierte todo | — |
| Tabla de sincronización sin probar (sin worker) | ✅ Sí | 7 pruebas — fan-out parcial, reclamo exclusivo, un job por transacción | **Recuperación de lease expirado no existe todavía** — gap real, documentado, corresponde construirlo junto con el worker (Fase 3) |
| Plan de aplicación remota inexistente | ✅ Sí | `aplicacion-remota-fase-2b.md` — antes/durante/después/rollback, no ejecutado | — |
| Validación completa no confirmada | ✅ Sí | 6/6 comandos en exit 0 (§13) | — |

### Confirmaciones explícitas

- **No se escribió nada remoto en ningún momento de esta fase.** Toda
  interacción con el proyecto remoto fue de solo lectura, protegida en
  dos capas (guard de texto + `BEGIN TRANSACTION READ ONLY`), y esa
  protección se probó de verdad antes de confiar en ella (incluyendo
  descubrir que un `SET default_transaction_read_only` suelto NO
  protege nada — se corrigió antes de usarlo contra datos reales).
- **No se aplicó `supabase db push`, ni se insertó/actualizó/borró
  ninguna fila remota, ni se crearon pases/objetos reales, ni se envió
  ningún APNs, ni se cambió ningún secreto remoto.**
- **No se declara Fase 3 iniciada.** El worker de sincronización sigue
  sin construirse — a propósito.

### Riesgo de locks al aplicar en remoto

Bajo. El volumen real (preflight): 1 cuenta, 1 programa, 2 miembros, 3
pases, 0 canjes. El ensayo local con esa misma forma de datos aplicó
las 11 migraciones en 2.98 segundos, sin ningún timeout ni lock
prolongado.

### Nota operativa sobre `0166`

`0166` corrige un bug de doble-reversión que **ya existe en producción
hoy**, en código desplegado desde `0125`/`0139` — es independiente de
que el resto del lote de Wallet V2 se aplique o no. Vale la pena que el
dueño considere aplicar `0166` cuanto antes, incluso separado del resto
del lote, dado que corrige un problema activo (no hipotético) con
impacto de negocio real (acreditar puntos de más).

### Veredicto

## **READY FOR REMOTE**

Con dos condiciones explícitas, ninguna bloqueante para el resto del
lote:

1. La publicación del Issuer de Google Wallet debe confirmarse
   manualmente en la consola (no verificable por API) antes de emitir
   pases de Google a clientes reales.
2. El secreto `APPLE_PASS_AUTH_SECRET_V1` sigue sin generarse — es
   intencional (los pases nuevos siguen naciendo en modo legacy hasta
   que se configure) y no bloquea aplicar 0156-0166; es una decisión
   humana separada, para cuando se quiera activar HMAC.

No se aplica nada remotamente como parte de esta fase. La decisión de
aplicar — y cuándo — queda en manos del dueño.
