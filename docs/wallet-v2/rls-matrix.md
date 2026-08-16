# Matriz de acceso — Wallet V2

> **Actualización Fase 2B**: aplicado en local. Hallazgo nuevo durante
> la implementación, no anticipado en esta matriz: `programa_lealtad`
> otorga `UPDATE`/`INSERT` de TABLA COMPLETA a `authenticated` — así
> que las columnas internas nuevas (`diseno_version`,
> `cuenta_id_confirmada`) necesitaron un trigger de protección propio
> (`0165`) para no quedar escribibles por cualquier dueño/colaborador.
> Ver `fase-2b-resultado.md`.

> La mayoría de las filas de esta matriz describen políticas **que ya
> existen y se conservan** (confirmadas en `modelo-existente.md`). Se
> marca explícitamente qué es nuevo (§`wallet_sync_pendiente`) y qué se
> corrige (§`programa_lealtad`, columnas visibles a `anon`).
>
> Regla transversal, ya vigente y que Wallet V2 no cambia: **aunque una
> tabla tenga RLS, las funciones sensibles (los 3 RPC) también comprueban
> ownership en su propio cuerpo** — RLS es la última barrera, no la única.
> Los endpoints públicos de Apple **nunca** usan la sesión web del
> usuario — se autorizan exclusivamente con `Authorization: ApplePass
> <auth_token>`, comparado en tiempo constante.

## Roles

| Rol | Cómo se identifica |
|---|---|
| Visitante | `anon` — sin sesión |
| Cliente afiliado | `authenticated`, `auth.uid()` coincide con `miembros.cliente_id` o con `mi_persona()` |
| Propietario | `authenticated`, dueño de la `cuenta`/`rancho` (`owner_id = auth.uid()`) |
| Empleado autorizado | `authenticated`, fila en `rancho_colaboradores` con permiso — hoy binario, no granular a nivel de tabla salvo `rol`/`permisos_lealtad` |
| Admin de plataforma | `authenticated`, `is_admin()` (vía `perfiles.rol`) |
| Service role | `service_role` — bypassa RLS, usado por server actions/RPC/rutas API |
| Endpoints públicos Apple | Sin sesión Supabase — autorización propia (`Authorization: ApplePass <token>`) |
| Worker de sincronización | Corre con `service_role` (cron → API route → `createAdminClient()`) — no es un rol de Postgres nuevo |

---

## `cuentas`

| Comando | Rol | Condición | Riesgo de enumeración |
|---|---|---|---|
| SELECT | Propietario, empleado (`pertenece_a_cuenta`), admin | ownership real | Bajo — sin acceso `anon` |
| INSERT | Propietario | `owner_id = auth.uid()` | — |
| UPDATE | Propietario, empleado de cuenta (no el de mostrador), admin | `gestiona_cuenta`; `plan` protegido por trigger aparte | — |
| DELETE | Propietario real, admin | — | — |

Sin cambios respecto de hoy.

## `programa_lealtad`

| Comando | Rol | Condición | Riesgo de enumeración |
|---|---|---|---|
| SELECT | Visitante, cliente, cualquiera | `activo = true OR dueño OR admin` | **Medio, ya existente**: `anon` lee la tabla completa sin recorte de columna si `activo` — incluye `pausado_por_cobro`, `mensaje_promocional`, `exige_verificacion_para_canjear`. No es un dato sensible tipo cuenta bancaria, pero es más de lo que un visitante necesita para ver la tarjeta pública. **Recomendación para Fase 2B**: recortar por columna igual que ya se hizo con `ranchos`/`recompensas` (excluir `pausado_por_cobro`, `mensaje_promocional*`, `poster_config`). No se ejecuta en Fase 2A. |
| INSERT/UPDATE/DELETE | Propietario, admin | `gestiona_cuenta` si `cuenta_id` está seteado | Sin cambios |
| UPDATE — `diseno_version` | Solo vía trigger (§`modelo-propuesto.md`) | No editable directo, ni por dueño | Nuevo — mismo patrón que el trigger de `plan_lealtad`/`estado` |

## `miembros`

| Comando | Rol | Condición | Riesgo |
|---|---|---|---|
| SELECT | Cliente propio, dueño/admin del programa | `cliente_id=auth.uid() OR persona_id=mi_persona() OR dueño` | Bajo |
| INSERT | Cliente propio (alta por QR es server-side con `service_role`) | `programa activo` | Bajo |
| UPDATE | Dueño/admin | **Acotado a la columna `estado`** desde 0148 — nadie desde el cliente puede reescribir `persona_id`/`programa_id` | Ninguno — ya cerrado |
| UPDATE — `saldo_cache`/`saldo_actualizado_en` (nuevas, §`modelo-propuesto.md`) | Solo `service_role` | Ningún grant a `authenticated` en estas 2 columnas nuevas | Nuevo — se agrega explícito al `grant` para que no hereden el `update(estado)` existente por accidente |
| DELETE | Nadie (fuera de `service_role`) | — | — |

## `pases_wallet`

| Comando | Rol | Condición | Riesgo |
|---|---|---|---|
| SELECT | Cliente propio (vía `miembros`) | — | Bajo |
| INSERT/UPDATE/DELETE | Nadie desde `authenticated` — solo `service_role` | Sin cambios | — |

Columnas nuevas (`update_tag`, `google_revision`, etc.): mismo grant que
hoy — `select` para el cliente propio, escritura solo `service_role`. No
se agrega ningún grant nuevo a `authenticated`.

## `registros_dispositivo`

| Comando | Rol | Condición | Riesgo |
|---|---|---|---|
| Todos | Solo `service_role` | RLS habilitada, cero policies para ningún rol de aplicación | Ninguno — "100% del servidor", sin cambios |

Las 4 columnas nuevas de trazabilidad heredan el mismo candado.

## `transacciones_puntos`

| Comando | Rol | Condición | Riesgo |
|---|---|---|---|
| SELECT | Cliente propio, dueño/admin | mismo patrón que `miembros`/`pases_wallet` | Bajo |
| INSERT/UPDATE/DELETE | Nadie desde `authenticated` — solo dentro de las RPC (`service_role`) | Sin cambios | — |

## `recompensas`

| Comando | Rol | Condición | Riesgo |
|---|---|---|---|
| SELECT | Visitante, cliente | `activa AND vigente AND programa activo` (0148); `sku`/`instrucciones` excluidas del grant a `anon` | Bajo, ya corregido |
| ALL | Dueño, admin | — | — |

## `canjes` / `intentos_canje`

| Comando | Rol | Condición | Riesgo |
|---|---|---|---|
| SELECT | Cliente propio (`canjes`), dueño/admin | — | Bajo |
| INSERT/UPDATE/DELETE | Nadie desde `authenticated` | Solo `service_role` vía RPC | — |

## `wallet_sync_pendiente` (nueva)

| Comando | Rol | Condición | Riesgo |
|---|---|---|---|
| Todos | Solo `service_role` | RLS habilitada, cero policies — mismo patrón que `registros_dispositivo` | Ninguno |
| Lectura para el dueño ("¿mi pase está sincronizando?") | No directa — vía RPC `security definer` de solo lectura si Fase 9 lo requiere | A diseñar en Fase 9, no en Fase 2A | — |

## `personas` / `personas_negocio` / `personas_duplicados` / `consentimientos_persona` / `sesiones_persona`

Sin cambios — confirmado en el inventario que el modelo actual ya es
correcto: `personas` sin ningún grant de escritura a `authenticated`
(solo RPC `security definer`), `personas_negocio` como el único punto
donde vive el permiso de un negocio sobre una persona, `sesiones_persona`
con `revoke all` total salvo `service_role`, `personas_duplicados`
visible solo a admin (cruza datos de dos negocios a propósito).

---

## Endpoints públicos de Apple

| Endpoint | Autorización | Nota |
|---|---|---|
| `POST/DELETE /v1/devices/.../registrations/...` | `Authorization: ApplePass <auth_token>`, comparación en tiempo constante | Sin sesión Supabase |
| `GET /v1/devices/.../registrations/{passTypeId}` | Sin autenticación — por diseño del protocolo Apple | Solo devuelve `serialNumbers`/`lastUpdated`, nada sensible |
| `GET /v1/passes/{passTypeId}/{serial}` | `Authorization: ApplePass <auth_token>` | Sirve el `.pkpass` |
| `POST /v1/log` | Sin autenticación — por diseño del protocolo Apple | Solo logging, nunca escribe estado de negocio |

Ninguno de los cuatro cambia con Wallet V2 — ya cumplen el patrón
correcto (Fase 0 §1).

## Worker de sincronización

Corre como `service_role` (misma identidad que el resto de los crons,
ej. `pases-en-pausa.yml`), invocado por GitHub Actions con
`CRON_SECRET` (comparación **no** timing-safe hoy — hallazgo de la Fase 0,
sección 11, punto 1; se corrige junto con la implementación del worker en
Fase 3, no en Fase 2A). El worker nunca actúa "como" un negocio ni como
un cliente — su identidad es siempre la plataforma.
