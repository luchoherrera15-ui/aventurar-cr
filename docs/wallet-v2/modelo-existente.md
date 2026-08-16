# Modelo de datos existente en Bookea — insumo para el diseño de Wallet V2

> Documento de síntesis de solo lectura. Combina seis reportes de inventario (entidad canónica de negocio, planes y capacidades, esquema de lealtad/Wallet, identidad de personas, recompensas y canjes, storage/branding), reconciliando lo que se solapa y marcando explícitamente lo que quedó sin confirmar. No propone diseño nuevo.
>
> **Nota de método:** los seis reportes se corrieron con acceso distinto a producción. Algunos (esquema de lealtad/Wallet, recompensas/canjes, storage/branding) confirmaron conteos reales vía `service_role`/PostgREST. Otros (entidad de negocio, identidad de personas) tuvieron ese acceso bloqueado por el entorno de sandbox y documentan solo lo confirmable por código o por la llave `anon`. El reporte de planes y capacidades logró conteos agregados adicionales que llenan parte de ese vacío. Donde un conteo viene de una fuente parcial se indica explícitamente.

---

## Resumen ejecutivo

`ranchos` es la entidad canónica del marketplace (154+ migraciones, ~90 archivos de `src/`), pero **no** es la pieza correcta para colgar Lealtad/Wallet: un negocio de Lealtad no siempre quiere estar en el directorio. Esa pieza ya existe, deliberada y documentada: `cuentas` (0134), con dueño propio, equipo con roles granulares y una costura *opcional* hacia `ranchos`. El problema es que su adopción está **incompleta**: el alta activa hoy (`/lealtad/nuevo/actions.ts`) no crea fila en `cuentas`, y esto ya es un hecho en producción, no solo un riesgo teórico — la única fila real de `programa_lealtad` tiene `cuenta_id` NULL pese a existir una `cuenta` con el mismo `rancho_id`. Cualquier diseño de Wallet V2 que asuma `cuenta_id` siempre poblado se rompe contra datos reales de hoy.

Hallazgos que más pesan para Wallet V2:
1. **El plan de Lealtad vive duplicado en 4 columnas** (`ranchos.plan_lealtad`, `cuentas.plan`, `solicitudes_lealtad.plan`, `suscripciones.plan`) y **ya diverge en producción** (el negocio con `cuentas.plan='basico'` tiene `ranchos.plan_lealtad=null`).
2. **`cuentas_equipo` es una tabla muerta**: se construyó en 0134 para asientos de equipo de Lealtad pero el tope real (`administradores`) se sigue midiendo contra `rancho_colaboradores`, un recurso compartido con todo el marketplace.
3. **El patrón de seguridad del módulo de Lealtad es consistente y aprovechable**: tablas sensibles = RLS de solo lectura para `authenticated` + escritura solo por `service_role` dentro de 3 RPC con `pg_advisory_xact_lock`; toda la autorización real vive en TypeScript (`verificarAccesoLealtad`), no en Postgres.
4. **La identidad del cliente es `personas.id`, global a la plataforma** (no `auth.users.id` ni `miembros.id`); el permiso de un negocio sobre una persona vive en `personas_negocio`, separado del vínculo. `miembros.id` puede reapuntarse por fusión, por eso `pases_wallet.objeto_externo` existe para que Google Wallet sobreviva a eso.
5. **Branding hoy vive en dos buckets distintos según el camino de alta** (`ranchos-fotos` vs `comprobantes`), ninguno con RLS que valide dueño real del objeto, y con asimetría de fallo entre plataformas: Apple se degrada en silencio ante una imagen rota, Google puede rechazar el pase completo.
6. **Solo 2 de 10 capacidades "reales" del catálogo de planes están realmente segmentadas por plan** (`cercania`, `diseno_a_medida`); el resto las tienen los 4 planes por igual, así que `puede()` es casi decorativo hoy — relevante si Wallet V2 quiere vender diferenciación por plan.

---

## 1. La entidad canónica de negocio

**Veredicto:** `ranchos` es la entidad canónica del directorio público (marketplace) — confirmado por 154 migraciones y ~90 archivos que la consumen como tal, pese a que el nombre viene de cuando el producto solo vendía ranchos para bodas. No existe una tabla `proveedores`, `perfil_negocio` ni `cuentas_negocio` que compita por ese rol; `proveedores` solo aparece como parte del nombre `verificacion_proveedores` (KYC, no la entidad) y `cuentas_negocio` no existe en el repo.

Existe una candidata real y deliberada para add-ons como Lealtad: **`cuentas`** (migración 0134), creada explícitamente como *"la raíz del negocio en Bookea, mañana cuelgan de acá Citas, Hospedajes y la ficha de marketplace"*. Hoy es un envoltorio **parcial**, no un reemplazo: solo la usa Lealtad, y el propio código (`src/lib/lealtad/cuenta.ts`) trata a `ranchos` como fuente de verdad de respaldo mientras dura la transición.

| Estructura | Propósito real | Consumidores (archivo:línea) | Datos existentes | RLS | Problemas encontrados |
|---|---|---|---|---|---|
| **`ranchos`** | LA entidad de negocio del marketplace. Empezó como "directorio de ranchos" (0008), ampliada con `categoria` (0010) a cualquier proveedor de eventos y con `vertical` (0055) a citas/hospedajes/restaurantes. PK `id uuid`. Dueño único: `owner_id uuid not null references auth.users(id) on delete cascade`, FK directa a Supabase Auth, sin tabla intermedia. | `src/lib/negocio-propio.ts:31-34`, `src/app/mi-negocio/[id]/page.tsx:288-295` (gate `owner_id === user.id \|\| esAdmin \|\| gestiona_rancho`), `src/app/lealtad/nuevo/actions.ts:265-292` (el alta de Lealtad sigue creando una fila `ranchos`), `src/lib/wallet/generar.ts:125` (Wallet filtra pases por `rancho_id`), ~90 archivos más. | 8 filas `estado='aprobado'` visibles con la llave `anon` (`content-range: 0-0/8`). El reporte de planes obtuvo, por otra vía, el total real de la columna `plan_lealtad`: **12 filas** (11 `null`, 1 `'prueba'`) — es decir, hay ~4 ranchos adicionales en estados no aprobados cuyo desglose exacto (pendiente/rechazado) no quedó confirmado por ningún reporte. Por vertical (solo aprobados): `citas:4, eventos:2, restaurantes:2`. ~50 columnas agregadas en 140+ migraciones. | **SELECT**: `anon`+`authenticated`, `estado='aprobado' OR owner_id=auth.uid() OR is_admin()` (0008) — a nivel de **columna** (0140 anon / 0148 authenticated) sin `sinpe_numero, sinpe_titular, cuenta_banco, cuenta_numero, cuenta_titular, cuenta_tipo`, solo `service_role` las lee. **INSERT**: `authenticated`, `owner_id=auth.uid() AND estado='pendiente'` o admin (0009) — un colaborador NO puede crear negocios (0116). **UPDATE**: dueño/colaborador/admin, pero `estado` solo lo cambia admin (trigger `rancho_bloquear_estado_no_admin`, 0008); `owner_id`/`id` solo dueño saliente o admin (trigger `ranchos_proteger_dueno`, 0116); `plan_lealtad` solo admin o `service_role` (trigger `ranchos_proteger_plan_lealtad`, 0148). **DELETE**: solo `is_admin()` (0009) — ni el dueño puede borrar su propio negocio. | (1) Las 6 columnas de cobro estuvieron expuestas por `grant` de tabla completa hasta 0140 (anon)/0148 (authenticated) — **ya cerrado**, lección documentada en el propio SQL. (2) El alta de Lealtad sigue creando una fila `ranchos` con `estado:'pendiente'` incluso para negocios que nunca van a publicarse en el marketplace — usa `ranchos` como contenedor de identidad aunque el negocio no quiera estar en el directorio. |
| **`perfiles`** | El ROL de la cuenta (`admin` vs `dueno_rancho`), no el negocio. PK = `auth.users.id`, se autocompleta por trigger `handle_new_user`. Tabla de identidad/rol de usuario, no de negocio. | `src/lib/auth.ts:46,69-73,83-87,103-108,127` — el rol se resuelve siempre con una consulta a esta tabla en cada request, nunca desde metadata de sesión/JWT. | Sin conteo confirmado en ningún reporte (con `anon`: `401 permission denied`, confirma que no hay `grant` a `anon`). | **SELECT**: `authenticated`, `id=auth.uid() OR is_admin()` (0008). **INSERT**: solo vía trigger de servidor. **UPDATE**: solo admin edita el rol de otros (0009). **DELETE**: no se encontró policy (cascada desde `auth.users`). | Ninguno relevante a Wallet V2 — confirma que el rol nunca puede falsificarse desde el cliente. |
| **`rancho_colaboradores`** | EMPLEADO/COLABORADOR con acceso al panel de UN negocio del marketplace. PK compuesta `(rancho_id, usuario_id)` — acceso binario (administra o no), sin rol granular a este nivel. Reutiliza `auth.users`, no crea cuentas paralelas. | `src/lib/negocio-propio.ts:51-54`, `supabase/migrations/0116_colaboradores_negocio.sql:97-141` (`gestiona_rancho`/`es_colaborador_rancho`, `security definer`), `src/app/mi-negocio/[id]/page.tsx:290-298`. | Sin conteo confirmado (tabla sin columna `id`, sin acceso `anon`). | **SELECT**: el propio colaborador, el dueño, o admin. **INSERT** ("invitar"): solo el dueño o admin — un colaborador no puede sumar a otro, a propósito. **DELETE** ("sacar"): dueño, admin, o el propio colaborador renunciando. **UPDATE**: no existe policy — cambiar nivel de acceso es "borrar e invitar de nuevo". 11 tablas del negocio replican el acceso del dueño para `es_colaborador_rancho(rancho_id)`, con exclusión deliberada de `verificacion_proveedores`. | Es acceso "todo o nada" por negocio — no hay roles tipo "solo ver reportes". Ese patrón granular SÍ existe, pero solo dentro de Lealtad, vía `rancho_colaboradores.rol`/`.permisos_lealtad` (ver sección 2). Si Wallet V2 necesita un rol acotado tipo "solo mostrador", ese patrón ya existe en Lealtad, no acá. |
| **`modulos_negocio`** | Qué módulos del panel tiene encendidos cada negocio (agenda, clientes, membresías…) — override sobre el default de `tipo_negocio`. Comentario propio del SQL: *"a diferencia de `addons_negocio`, acá el dueño SÍ escribe: un módulo no es algo que se cobre"*. No es un plan pago. | `src/lib/business/modulos.ts` (537 líneas), `src/app/mi-negocio/[id]/modulos-actions.ts`. | Sin conteo (401 con `anon`, esperado — solo `authenticated` dueño/colaborador/admin). | **ALL** para `authenticated`: `is_admin() OR rancho_id IN (SELECT id FROM ranchos WHERE owner_id=auth.uid())`, más política aditiva de colaborador (0116). | Ninguno. **No** es donde vive el add-on de Lealtad (eso es `addons_negocio`, sección 2) — mezclar ambas repetiría el mismo dato con dos reglas de escritura distintas (ya advertido en la 0108). |
| **`cuentas` + `cuentas_equipo`** (0134) | La "raíz de negocio" aspiracional, hoy usada exclusivamente por Lealtad. Dueño propio (`owner_id`), equipo con roles granulares (`propietario/administrador/colaborador` + `permisos jsonb` en `cuentas_equipo`), costura opcional y única hacia `ranchos` (`rancho_id uuid unique ... on delete set null` — `null` = negocio que existe solo en Lealtad). | `supabase/migrations/0134_cuentas_raiz_de_lealtad.sql:47-100`, `src/lib/lealtad/cuenta.ts` (resuelve `cuenta_id` con fallback a `ranchos`), `src/app/lealtad/panel/[id]/equipo-actions.ts:75`, `crear-actions.ts:96,202-244`. | **1 fila** en `cuentas`, `plan='basico'` (conteo confirmado en el reporte de planes). El backfill de 0134 creó una `cuenta` por cada `programa_lealtad` que ya existía al correrla, pero **el alta nueva vigente no toca `cuentas` en absoluto** — confirmado también con datos reales: el único `programa_lealtad` de producción tiene `cuenta_id` NULL pese a existir esta cuenta con el mismo `rancho_id` (ver sección 3). `cuentas_equipo`: 1 fila (`propietario`, del backfill). | `SELECT`: `pertenece_a_cuenta` (incluye colaborador de mostrador). `INSERT`: cualquiera, firmando `owner_id=auth.uid()`. `UPDATE`: `gestiona_cuenta` (dueño + admin/colaborador de cuenta, NO el de mostrador), con `plan` protegido aparte por trigger (0148, mismo patrón que `ranchos.plan_lealtad`). `DELETE`: solo dueño real o admin de plataforma. | **Adopción parcial real, confirmada con datos, no solo con código**: los negocios dados de alta después de 0134 quedan con `programa_lealtad.cuenta_id = null` y dependen 100% del fallback a `ranchos`. `cuentas_equipo` es además una **tabla muerta** en la práctica — ver hallazgo cruzado en sección 2. |
| **`verificacion_proveedores`** | KYC del dueño al publicar (cédula + red social) — tabla satélite 1:1 con `ranchos` (PK = `rancho_id`), separada a propósito porque `ranchos` se lee con `select *` en páginas públicas. | `supabase/migrations/0046_verificacion_proveedores.sql`, revisión en `/admin`. | Sin conteo (sin `grant` a `anon`). | SELECT/INSERT: dueño del rancho o admin. Sin UPDATE/DELETE salvo `service_role`. | La 0046 declaró policies pero **olvidó el `grant`** de tabla — sin él, RLS "correcta" igual devolvía `permission denied` al dueño legítimo; corregido en 0063. Mismo patrón de bug ("política sin grant = tabla invisible") que se repite y documenta en 0119/0140/0148 — lección recurrente del código base, relevante si Wallet V2 agrega tablas nuevas. |
| **`proveedores`, `cuentas_negocio`, "perfil de negocio"** | **No existen como tablas.** | — | — | — | Se aclara para cerrar la duda: no hay tabla compitiendo por el rol de "negocio" fuera de `ranchos` y, parcialmente, `cuentas`. |

### RLS de `ranchos`, política por política

| Comando | Rol | Condición exacta | Migración |
|---|---|---|---|
| SELECT | `anon`, `authenticated` | `estado = 'aprobado' OR owner_id = auth.uid() OR is_admin()` | 0008 |
| SELECT (colaborador) | `authenticated` | `es_colaborador_rancho(id)` | 0116 |
| SELECT — columnas | `anon`, `authenticated` | Todas menos `sinpe_numero, sinpe_titular, cuenta_banco, cuenta_numero, cuenta_titular, cuenta_tipo` | 0140 (anon), 0148 (authenticated) |
| INSERT | `authenticated` | `(owner_id = auth.uid() AND estado = 'pendiente') OR is_admin()` | 0008, ampliada 0009 |
| UPDATE | `authenticated` | `owner_id = auth.uid() OR is_admin()` | 0008 |
| UPDATE (colaborador) | `authenticated` | `es_colaborador_rancho(id)` | 0116 |
| UPDATE — trigger `estado` | — | Si `NOT is_admin()`, el cambio de `estado` se revierte silenciosamente | 0008 |
| UPDATE — trigger `owner_id`/`id` | — | Si cambia y quien ejecuta no es el `owner_id` viejo ni admin, `raise exception 42501` | 0116 |
| UPDATE — trigger `plan_lealtad` | — | Si cambia y quien ejecuta no es admin, `raise exception 42501` | 0148 |
| DELETE | `authenticated` | `is_admin()` — el dueño no puede borrar su propio negocio | 0009 |

### Recomendación explícita del reporte original

No crear una tabla `business` paralela, pero tampoco colgar Wallet V2 directamente de `ranchos.id`. `ranchos` debe seguir siendo la entidad del directorio público; `cuentas` (0134) es la pieza correcta para que Wallet V2 cuelgue de ella, porque ya trae dueño, equipo con roles y plan propios. El riesgo real no es "falta la tabla", es que **la adopción de `cuentas` está incompleta**: antes de diseñar Wallet V2 sobre `cuenta_id`, hay que cerrar el alta (`/lealtad/nuevo/actions.ts`) para que cree la `cuenta` igual que el backfill de 0134, o Wallet V2 debe traer el mismo patrón de fallback que ya usa `src/lib/lealtad/cuenta.ts`.

---

## 2. Planes y capacidades

`src/lib/lealtad/planes.ts` es lógica pura en TypeScript (701 líneas, sin Supabase), con una suite de pruebas (`planes.test.ts`, 700 líneas) que actúa como candado de producto — no es solo un catálogo de precios, es donde vive la definición de qué existe de verdad.

**Dos listas de ids:**
- `PLANES_OFRECIDOS = ["prueba", "arranque", "impulso", "ilimitado"]` — lo que se vende hoy (catálogo 0141).
- `PLANES_RETIRADOS = ["gratis", "basico", "estandar", "enterprise", "esencial", "crece", "pro", "empresa"]` — catálogos 0124/0131/0133, nunca se borran porque hay cuentas reales con esos valores (confirmado: `cuentas.plan='basico'` existe, la cuenta que menciona el propio código como "Rancho Las Torres").
- `esPlan()` acepta ambas listas (para que `definicionDe` nunca devuelva null en una cuenta vieja); `esPlanOfrecido()` solo la primera (bloquea elegir un plan retirado armando un POST a mano — agujero real ya documentado).

**`Capacidad` (20 valores, dos grupos):** 10 "que existen de verdad" (`wallet`, `tipos_de_tarjeta`, `reglas_y_vencimientos`, `personalizacion_tarjeta`, `poster_qr`, `modo_mostrador`, `equipo_con_permisos`, `analitica`, `cercania`, `diseno_a_medida`) y 10 en `CAPACIDADES_SIN_PRODUCTO` (`notificaciones`, `analitica_avanzada`, `segmentacion`, `campanas_programadas`, `webhooks`, `api`, `exportacion`, `pos`, `roles_avanzados`, `franquicias`, `sla`, `marca_blanca`, `soporte_dedicado`) — una prueba impide que un plan ofrecido liste una de estas.

**Hallazgo clave:** de las 10 capacidades "reales", **8 las tienen los cuatro planes por igual** (`INCLUIDO_SIEMPRE`) — Prueba y Arranque corren el mismo código que Ilimitado en wallet, personalización, reglas, póster, mostrador, equipo, analítica. Solo **`cercania` y `diseno_a_medida`** están realmente segmentadas (solo Ilimitado). El único lugar donde `puede()` decide algo en código de servidor es `src/lib/wallet/generar.ts:322` (para `cercania`) — el resto es promesa de marketing, no gate activo.

**`LimitesPlan` (6 campos, solo 3 se exigen de verdad):**

| Campo | ¿Se exige? | Dónde |
|---|---|---|
| `clientesActivos` | Sí | `wallet/generar.ts:199-224` y `wallet/google.ts:543-570`, vía `personasActivasDe()` en `src/lib/lealtad/cupo.ts:84` |
| `programas` | Sí | `crear-actions.ts:227-260` |
| `administradores` | Sí | `equipo-actions.ts:58-92` (`equipoLleno`) — **cuenta `rancho_colaboradores`, no `cuentas_equipo`** |
| `notificacionesMes` | No — 0 en los cuatro planes, sin producto (el push de Wallet es mudo) | — |
| `sedes` | No — en 1 en los cuatro, no existe tabla de sucursales | — |
| `automatizaciones` | No — en 0, cero código | — |

`tipos` (qué clases de tarjeta trae cada paquete) sí se exige, vía `crear-actions.ts:216-225` y `pases-actions.ts:315-316,627-628` (`planIncluyeTipo()`/`tiposDelPlan()`).

### Dónde se guarda el plan — duplicación deliberada (transición 0134)

No es una columna, son **cuatro**, todas con el mismo `CHECK` (los IDs de `PLANES_ID`):

| Columna | Migración | Rol |
|---|---|---|
| `ranchos.plan_lealtad` | 0124 | Original. Hoy es el **respaldo de transición** |
| `cuentas.plan` | 0134 | **Fuente de verdad** desde 0134 (`planEfectivo()`, `cuenta.ts:48-53`: la cuenta gana siempre que tenga plan, si no cae al rancho) |
| `solicitudes_lealtad.plan` | 0126 | El paquete pedido en la cola de alta manual (SINPE) |
| `suscripciones.plan` | 0143 | El plan que Stripe dice que se está cobrando (puede ser `null` si el `price_id` no está mapeado) |

`aplicarPlanEn()` (`src/lib/pagos/puerta-supabase.ts:832-868`) escribe **en los dos primeros a la vez** cuando activa un cobro de Stripe, y hace `upsert` en `addons_negocio` (`lealtad: activo=true`).

**Divergencia confirmada en producción** (conteo agregado real): `ranchos.plan_lealtad` tiene 11 filas en `null` y 1 en `'prueba'` (12 ranchos totales); `cuentas.plan` tiene 1 fila en `'basico'`. El negocio con plan real (`basico`) tiene su `cuentas.plan` correcto pero su `ranchos.plan_lealtad` ya no coincide — exactamente el riesgo de drift que el propio comentario de `cuenta.ts` anticipa.

### ¿Existe un sistema de planes para el marketplace general?

**No.** Publicar un negocio y tomar reservas es gratis, sin escalones de precio. Lo que existe son dos sistemas distintos y no jerárquicos, ninguno tarifado por escalón:
1. **`src/lib/business/modulos.ts`** — `tipo_negocio` determina qué secciones del panel ve el dueño, corregido por `modulos_negocio` (sección 1). Organización de panel, no tarificación.
2. **`src/lib/addons.ts` + `addons_negocio`** — complementos de pago *por negocio*: `asistente_ia`, `agenda_ia`, `lealtad`, `pases_cercania`. Doctrina explícita: "si algo se puede hacer a mano, la versión a mano es gratis para siempre — lo que se cobra es que la IA lo haga". `lealtad` en esta tabla es solo el **interruptor** que enciende el módulo; el paquete (Prueba/Arranque/Impulso/Ilimitado) es un concepto aparte (`plan_lealtad`/`cuentas.plan`).

### Stripe/suscripciones — activación y desactivación

`supabase/migrations/0143_suscripciones_stripe.sql` crea `suscripciones` (espejo de Stripe) y `eventos_stripe` (idempotencia por `stripe_event_id` PK). Única puerta de activación: `src/app/api/stripe/webhook/route.ts` → `procesarEventoStripe()` (`src/lib/pagos/suscripciones.ts`) — nunca desde la página de éxito del navegador ("cualquiera se regalaría el paquete de $89 tecleando una dirección", cita del código). El plan sale de `price_id` mapeado por variables de entorno. **El plan nunca se degrada solo**: una cancelación o mora solo cambia `suscripciones.estado` y, si corresponde, pausa el programa (`programa_lealtad.estado='pausado'`, `pausado_por_cobro` de 0146) sin borrar nada. Producción hoy: 0 filas en `suscripciones` y `eventos_stripe` — todavía no hay ningún cobro por Stripe activado; el único camino usado es SINPE manual o el alta gratis instantánea.

### Tabla de estructuras

| Estructura | Propósito real | Consumidores (archivo:línea) | Datos existentes | RLS | Problemas encontrados |
|---|---|---|---|---|---|
| `src/lib/lealtad/planes.ts` (catálogo en código) | Única fuente de verdad de capacidades y topes del módulo Lealtad; producto, no dato de cliente | `puede()`: `wallet/generar.ts:322`. `estadoDelLimite()`: `lealtad-estado.tsx:62`, `seccion-plan.tsx:57,61`, `page.tsx:397`, `complementos-panel.tsx:439`. `tiposDelPlan()`/`planIncluyeTipo()`: `crear-actions.ts:216-227`, `pases-actions.ts:315-316,627-628`, `selector-tipo.tsx:56,96`. `definicionDe()`: `equipo-actions.ts:79`, `metricas.tsx:120`, `google.ts:553`, `generar.ts:209` | N/A (no es tabla) | N/A | Solo 3 de 6 límites se exigen; solo 1 de 10 capacidades reales (`cercania`) se gatea con `puede()` en servidor |
| `ranchos.plan_lealtad` (0124) | Plan del rancho — respaldo de transición desde 0134 | `cuenta.ts:48`; leído en `equipo-actions.ts:64`, `crear-actions.ts:191`, `page.tsx`, `google.ts`, `generar.ts` | 12 ranchos: 11 `null`, 1 `'prueba'` | Hereda RLS de `ranchos` (sección 1) | Ya diverge de `cuentas.plan` en producción |
| `cuentas.plan` (0134) | Fuente de verdad del plan desde 0134 | `planEfectivo()` (`cuenta.ts:48-53`); escrito por `aplicarPlanEn` (`puerta-supabase.ts:837`) | 1 cuenta, `plan='basico'` (retirado, sigue resolviendo) | RLS de `cuentas` (sección 1) | Ninguno propio — el problema está en la columna hermana de `ranchos` |
| `cuentas_equipo` (0134) | Diseñada como asientos del plan de Lealtad, separados de `rancho_colaboradores` | **Ninguno** — cero lecturas/escrituras en `src/` fuera de un comentario en `planes.ts:31` | 1 fila (`propietario`, solo el backfill) | RLS completa (`gestiona_cuenta`/`pertenece_a_cuenta`) pero sin tráfico | **Tabla muerta.** El tope `administradores` se exige contra `rancho_colaboradores`, no contra esta tabla — la 0134 construyó la tabla "correcta" y el código nunca la adoptó |
| `rancho_colaboradores.rol`/`.permisos_lealtad` (0127) | El equipo REAL que cuenta contra `limites.administradores`; compartido con el resto del marketplace, extendido con rol/checklist de Lealtad | `equipo-actions.ts:58-92` (`equipoLleno`); `permisos.ts:64` | No auditado directamente | RLS general de `rancho_colaboradores` (sección 1) + política de UPDATE de 0127 restringida a `rol`/`permisos_lealtad` | El tope de "equipo" de Lealtad en realidad cuenta colaboradores del rancho entero, no un recurso exclusivo de Lealtad aunque el catálogo lo venda como tal |
| `solicitudes_lealtad` (0126) | Cola de alta/cambio de plan por SINPE manual, atendida desde `/admin/complementos` | `alta-desde-solicitud.ts`, `plan-actions.ts`, `nuevo/actions.ts`, `puerta-supabase.ts:727-802` (Stripe también reutiliza esta cola) | 0 filas | SELECT propio+admin; INSERT propio (siempre `pendiente`); UPDATE solo `estado`/`atendida_por`/`atendida_en`, solo admin | Ninguno funcional; vacía hoy |
| `suscripciones` (0143) | Espejo de lo que Stripe cobra | `puerta-supabase.ts`; `suscripciones.ts` | 0 filas | SELECT solo del dueño; sin INSERT/UPDATE/DELETE para `authenticated` — solo `service_role` | Ninguno; diseño defensivo (idempotencia, "nunca degrada solo") |
| `eventos_stripe` (0143) | Idempotencia de webhooks, PK = `stripe_event_id` | `puerta-supabase.ts:84-114` | 0 filas | RLS activa, cero políticas — invisible al cliente | Ninguno |
| `addons_negocio` (0077/0090) | Complementos de pago por negocio — interruptor booleano con vencimiento opcional, no un plan | `addons.ts`; encendido por `aplicarPlanEn` y `/admin/complementos` | 5 filas: `agenda_ia`×2, `asistente_ia`×2, `lealtad`×1 | No auditada en detalle | Ninguno relevante al foco |
| `cupo.ts` (`personasActivasDe`) + RPCs `personas_activas_de_la_cuenta`/`personas_activas_del_negocio` (0142) | Conteo real contra `limites.clientesActivos`: por CUENTA, deduplicando por persona, solo pases `activa` | `wallet/generar.ts:205-224`, `wallet/google.ts:549-570` | 2 filas en `miembros`, ambas `activa` | `security definer`, `grant execute` solo `authenticated`/`service_role` | El RPC `alta_persona_por_qr` (0138) inserta en `miembros` sin pasar por este conteo — hoy nadie lo llama desde `src/` pero es fuga latente el día que se conecte |
| `catalogo-publico.ts` | Filtro de `planes.ts` para exponer por HTTP a la landing y a la app móvil (`GET /api/lealtad/planes`) | `mobile/src/lib/planes-lealtad.ts` (cross-repo); `/lealtad/planes`, `/lealtad/nuevo` | N/A | N/A | Es el único puente web↔móvil para precios — ya hubo desincronización una vez, documentado en el propio archivo |
| Sistema de planes del marketplace general | **No existe.** Publicar/reservar es gratis | `src/lib/business/modulos.ts` | N/A | N/A | Confirmado como sistema conceptualmente independiente de `planes.ts` |

### Evaluación de cierre contra campos típicos de un plan de Wallet V2

| Campo pedido | Estado |
|---|---|
| `max_clientes` | Existe y se exige (`clientesActivos`, dos puertas de Wallet). Listo. |
| `max_programas` | Existe y se exige (`programas`). Listo. |
| `max_miembros` (equipo) | Es `administradores` — existe y se exige, pero contra recurso compartido con el resto del marketplace (`rancho_colaboradores`, no `cuentas_equipo`). |
| `max_plantillas` | **No existe.** Ni en `plantillas-poster.ts` ni en `paletas.ts` hay tope por plan. Habría que crear el campo y decidir qué es "una plantilla". |
| Mecánicas permitidas | Existe y se exige (`tipos`/`tiposDelPlan`/`planIncluyeTipo`). Listo. |
| Branding personalizado | Existe como capacidad (`personalizacion_tarjeta`) pero **no segmentada** — los 4 planes la tienen igual. Diferenciar "cuánto" branding (dominio propio, remitente propio) es capacidad nueva (`marca_blanca` está en `CAPACIDADES_SIN_PRODUCTO`). |
| Notificaciones | Declarada (`notificacionesMes`) pero **sin producto** — el push de Wallet es mudo. Construir el envío es prerrequisito antes de vender un tope. |
| Analítica | Existe como capacidad pero no segmentada; `analitica_avanzada` está en `CAPACIDADES_SIN_PRODUCTO`. |
| Empleados | Existe (`administradores`), se exige, pero mide un recurso no exclusivo de Lealtad. |
| Importación de clientes | **No existe en absoluto.** Ni capacidad, ni límite, ni tabla. Es la brecha más grande. |

**Recomendación del reporte original:** mantener el catálogo en código (no migrar a tabla) — los planes son producto uniforme y la disciplina de "plan retirado nunca pierde sus topes" está implementada como invariantes probadas, más caro de replicar de forma segura en SQL/RLS. Si aparece necesidad real de override por-cuenta, agregar una columna de excepción explícita y estrecha en `cuentas` (nunca resta lo que el plan incluye, solo suma), no mover el catálogo a tabla. Antes de tipar campos nuevos, resolver los dos problemas de integridad heredados: (a) decidir si se sigue escribiendo `ranchos.plan_lealtad` o se completa la migración a "cuenta como única raíz"; (b) decidir si el tope de equipo de Lealtad debe medirse contra `cuentas_equipo` (adoptarla) o `rancho_colaboradores` (borrar la otra).

---

## 3. Esquema de lealtad y Wallet

Acceso usado: `createAdminClient()` (`src/lib/supabase/admin.ts`) con `SUPABASE_SERVICE_ROLE_KEY`, conteos `count:"exact", head:true` (agregados, cero filas traídas, nunca PII). Esquema reconstruido leyendo cada `ALTER/CREATE TABLE/POLICY` de 0060 y 0120–0155 en orden cronológico.

**Conteos agregados confirmados en vivo:**

| Tabla | Filas |
|---|---|
| `programa_lealtad` | 1 |
| `miembros` | 2 |
| `pases_wallet` | 3 (2 `apple`, 1 `google`) |
| `registros_dispositivo` | 1 |
| `transacciones_puntos` | 1 (tipo `ganado`) |

Base de demo/desarrollo, casi vacía — sin volumen real todavía. Estos números coinciden con los obtenidos independientemente por los reportes de recompensas/canjes (`programa_lealtad`=1, `miembros`=2) y de storage (`programa_lealtad`=1) — corroboración cruzada, no contradicción.

### `programa_lealtad`

Fila de configuración de UN programa de lealtad: reglas de acumulación, ciclo de vida, apariencia del pase de Wallet, reglas de vigencia/canje. No es "el negocio" — cuelga hoy de **dos padres a la vez** (`rancho_id` NOT NULL, `cuenta_id` opcional desde 0134, que además dropeó el `unique` original de `rancho_id` — ya no es 1:1). **Confirmado en vivo, con datos reales**: el único programa de producción tiene `rancho_id` poblado pero `cuenta_id` en NULL, pese a existir 1 fila en `cuentas` con `rancho_id` apuntando al mismo negocio — la costura de 0134 no está enlazada para este programa aunque la cuenta exista (esto reconcilia y confirma con datos el hallazgo cualitativo de la sección 1).

**Columnas** (acumuladas 0060→0152):

| Columna | Tipo | Origen | Constraint/CHECK |
|---|---|---|---|
| `id` | uuid PK | 0060 | `default gen_random_uuid()` |
| `rancho_id` | uuid NOT NULL | 0060 | FK `ranchos(id) on delete cascade`. `unique` original **dropeado en 0134** |
| `nombre` | text NOT NULL | 0060 | `char_length(trim(nombre)) between 1 and 80` |
| `puntos_por_visita` | integer NOT NULL default 1 | 0060 | `>= 0` |
| `puntos_por_colon` | numeric NOT NULL default 0 | 0060 | `>= 0` |
| `activo` | boolean NOT NULL default true | 0060 | — |
| `created_at` | timestamptz NOT NULL | 0060 | — |
| `modo` | text | 0121, ampliado 0135 | `null or in ('sellos','cashback','puntos','cupon','descuento','membresia','giftcard','evento')` |
| `pase_color_fondo` / `pase_color_sello` | text | 0122 | `null or ~ '^#[0-9A-Fa-f]{6}$'` |
| `pase_logo_url` | text | 0122 | `null or ~ '^https://'` |
| `estado` | text | 0125 | `null or in ('borrador','activo','pausado','archivado')` |
| `compra_minima` | integer | 0125 | `null or 0..10000000` |
| `max_por_transaccion` / `max_diario_cliente` | integer | 0125 | `null or 1..100000` |
| `inicio` / `fin` | date | 0125 | `fin >= inicio` si ambos |
| `terminos` | text | 0125 | `<= 2000` |
| `pase_banner_url` | text | 0132 | — |
| `pase_codigo_formato` | text NOT NULL default 'qr' | 0132 | `in ('qr','code128')` |
| `pase_texto_reverso` | text | 0132 | `<= 500` |
| `pase_mostrar_saldo` / `pase_mostrar_progreso` | boolean NOT NULL default true | 0132 | — |
| `poster_config` | jsonb NOT NULL default `{}` | 0132 | `jsonb_typeof = 'object'` |
| `cuenta_id` | uuid | 0134 | FK `cuentas(id) on delete cascade` |
| `beneficio` | jsonb NOT NULL default `{}` | 0135 | `jsonb_typeof = 'object'` |
| `vigente_desde` / `vigente_hasta` | date | 0136 | `hasta >= desde` |
| `uso_unico` | boolean NOT NULL default false | 0136 | — |
| `max_por_cliente` | integer | 0136 | `null or 1..100000` |
| `max_global` | integer | 0136 | `null or 1..10000000` |
| `dias_permitidos` | smallint[] NOT NULL default `{}` | 0136 | subconjunto de `[0..6]`, largo ≤7 |
| `hora_desde` / `hora_hasta` | time | 0136 | — |
| `exige_verificacion_para_canjear` | boolean NOT NULL default false | 0138 | — |
| `pase_sello_icono` | text | 0145 | `null or in (12 ids fijos)` |
| `pausado_por_cobro` | boolean NOT NULL default false | 0146 | — |
| `mensaje_promocional` / `mensaje_promocional_en` | text / timestamptz | 0152 | — |

**Índices**: PK; `programa_lealtad_cuenta_idx (cuenta_id)` [0134]; `programa_lealtad_pausado_por_cobro_idx (rancho_id) WHERE pausado_por_cobro` [0146, parcial].

**Trigger**: `programa_reja_del_corte` — `BEFORE UPDATE OF estado, activo, pausado_por_cobro ... WHEN (old.pausado_por_cobro)` [0148]: bloquea reactivar el programa o borrar la marca de corte, excepto `service_role` o admin.

**RLS**: `"Programa activo visible para todos"` SELECT `anon, authenticated` — `activo OR (dueño del rancho OR admin)` [0060]. `"El dueño administra su programa"` FOR ALL `authenticated` — dueño/admin, `with check` exige `gestiona_cuenta` si se setea `cuenta_id` (reescrita en 0148 A4). **Grant `anon`: tabla entera**, sin recorte por columna (a diferencia de `recompensas`/`ranchos`) — cualquier visitante anónimo ve `pausado_por_cobro`, `exige_verificacion_para_canjear`, `mensaje_promocional`, etc. `authenticated`: `select, insert, update, delete` de tabla entera, solo el trigger protege 3 columnas puntuales.

**Consumidores**: `lealtad-operar-actions.ts:68-71`, `crear-actions.ts`, `pases-actions.ts`, `editar/[programaId]/page.tsx`, `datos-lealtad.ts`, `marketing-actions.ts`, `poster/poster-actions.ts`, `ayuda-actions.ts`, `cupo.ts`, `motor.ts`, `wallet/generar.ts`, `wallet/google.ts`, `tarjeta/[slug]/page.tsx` y `actions.ts`, `citas/[slug]/page.tsx`, `admin/(dashboard)/lealtad/[id]/page.tsx`, `admin/(dashboard)/complementos/page.tsx`.

### `miembros`

Afiliación de una identidad a un programa. Desde 0138 dejó de requerir cuenta de Supabase — `persona_id` (identidad global, deduplicada por teléfono/correo, ver sección 4) es la llave real; `cliente_id` es enriquecimiento opcional. **Confirmado en vivo**: `persona_id IS NULL` → 0 filas (backfill completo), `cliente_id IS NULL` → 1 fila — ya hay en producción un miembro dado de alta por QR sin cuenta de Bookea.

**Columnas**: `id`, `programa_id` (FK cascade), `cliente_id` (FK `auth.users`, nullable desde 0138, `on delete set null`), `paquete_id` (FK set null), `estado` NOT NULL default `'activa'` CHECK `in ('activa','pausada','cancelada')`, `created_at`, `origen` text `<=40` [0125], `persona_id` uuid FK `personas(id) on delete restrict` [0138]. El `unique(programa_id, cliente_id)` original fue **eliminado** en 0138.

**Índices**: `miembros_cliente_idx (cliente_id)`; `miembros_programa_persona_idx UNIQUE (programa_id, persona_id)` [llave real hoy]; `miembros_programa_cuenta_idx UNIQUE (programa_id, cliente_id) WHERE cliente_id is not null` [red de seguridad]; `miembros_persona_idx (persona_id)`.

**Trigger**: `miembros_persona` `BEFORE INSERT OR UPDATE` → `miembros_resolver_persona()`: si llega solo `cliente_id`, resuelve `persona_id` solo.

**RLS**: SELECT — `cliente_id=auth.uid() OR persona_id=mi_persona() OR dueño/admin del rancho`. INSERT — `cliente_id=auth.uid() AND (persona_id null o propio) AND programa activo`. UPDATE [0125] — dueño/admin del rancho, pero **0148 (A3) lo acotó a `grant update (estado) only`** — un colaborador ya no puede reescribir `persona_id`/`cliente_id`/`programa_id` de una fila ajena. `anon`: sin acceso. `service_role`: total.

**Consumidores**: `lealtad-operar-actions.ts:61-75` (`guardYMiembro`), `escaner-actions.ts`, `wallet/generar.ts:222-225` (insert al emitir pase Apple), `google.ts` (equivalente Google), `src/app/cuenta/page.tsx:113-117` (único lugar que de verdad depende de la policy SELECT con sesión), `cuenta/page.tsx:289-300` y `cuenta/lealtad/page.tsx:61-69` (con `admin`/service key pese a ser pantallas del cliente — la RLS casi no se ejercita en producción), `crear-actions.ts`, `pases-actions.ts`, `tarjeta/[slug]/actions.ts`.

### `pases_wallet`

Un pase por (miembro, plataforma) — el objeto en el teléfono. `saldo_cache` es **solo espejo**; la fuente de verdad es `transacciones_puntos` (`motor.ts:9-11,31-42`; las 3 RPC actualizan `saldo_cache` con `UPDATE` directo después de escribir el ledger).

**Columnas**: `id`, `miembro_id` (FK cascade), `plataforma` CHECK `in ('apple','google')`, `serial_number` NOT NULL UNIQUE, `auth_token` NOT NULL, `saldo_cache` NOT NULL default 0, `actualizado_en`, `created_at`, `activo` boolean default true [0138], `objeto_externo` text [0138 — id del objeto en Google, sobrevive a fusiones de persona], `pase_en_pausa`/`pausa_avisada_en`/`pausa_error` [0147], `diseno_pendiente`/`diseno_avisado_en`/`diseno_error` [0150], `ultima_descarga_en` [0151]. `unique(miembro_id, plataforma)` reemplazado en 0138 por índice parcial (permite pases "heredados" con `activo=false`).

**Índices**: `serial_number` UNIQUE; `pases_wallet_vigente_idx UNIQUE (miembro_id, plataforma) WHERE activo`; `pases_wallet_pausa_pendiente_idx`; `pases_wallet_diseno_pendiente_idx`.

**RLS**: única política — `"Cada quien ve su pase"` SELECT `authenticated` vía `miembros.cliente_id`/`persona_id`. **Grant: SOLO `select`**, nunca insert/update/delete desde el cliente. `service_role`: implícito total — crea, firma y actualiza saldo/pausa/diseño/descarga.

**Consumidores**: `wallet/generar.ts:266-278`, `google.ts`, `wallet/servicio.ts` (Web Service Apple: auth de `auth_token`, updates de saldo), `api/wallet/v1/passes/[passTypeId]/[serial]/route.ts` (sirve el `.pkpass`, escribe `ultima_descarga_en`), `aviso-de-pausa.ts`, `aviso-de-diseno.ts`, `mensaje-promocional.ts`, `metricas.tsx`, `lealtad-secciones.tsx`.

### `registros_dispositivo`

Registro PassKit (device↔pase) para el push a Apple. Mitad "server-to-server" del protocolo Apple Wallet. **Columnas** (sin cambios desde 0060): `device_library_id`, `push_token`, `pass_type_id`, `serial_number` (FK `pases_wallet(serial_number) on delete cascade`), `created_at`; PK compuesta `(device_library_id, serial_number)`.

**RLS**: habilitada y **cero políticas** para cualquier rol (a propósito — "100% del servidor"). Sin `grant` a `anon`/`authenticated` en ninguna migración. `service_role`: implícito.

**Consumidores** (todos server-to-server): `wallet/servicio.ts:192,207,240,265`, `api/wallet/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts:45,51,84`, `.../[passTypeId]/route.ts:32`, `aviso-de-pausa.ts:544,567`, `metricas.tsx:73`, `lealtad-secciones.tsx:146`. Confirmado: **la app móvil no toca ninguna de las 5 tablas de lealtad** (grep sin resultados en `mobile/`).

### `transacciones_puntos`

El ledger — única fuente de verdad del saldo. Nunca se escribe desde el navegador; las 3 RPC (0125/0139) son el único camino de escritura, limitadas a `service_role`.

**Columnas**: `id`, `miembro_id` (FK cascade), `tipo` CHECK `in ('ganado','canjeado','ajuste')`, `puntos` integer (`ganado`→`>0`, `canjeado`→`<0`, `ajuste`→`<>0`), `motivo` `<=200`, `referencia`, `created_at`, `saldo_anterior`/`saldo_posterior`, `reglas` jsonb (snapshot), `usuario_id` (FK set null), `reversion_de` (FK a sí misma, set null).

**Índices**: `transacciones_puntos_miembro_idx (miembro_id, created_at desc)`; `transacciones_puntos_referencia_unica UNIQUE (miembro_id, referencia) WHERE referencia is not null` [idempotencia]; `transacciones_puntos_reversion_unica UNIQUE (reversion_de) WHERE reversion_de is not null`.

**RLS**: única política SELECT — mismo patrón que `miembros`/`pases_wallet` (propio, o dueño/admin del rancho). **Grant: solo `select`**, cero insert/update/delete fuera de las RPC.

**Nota de rendimiento**: `motor.ts:31-42` (`consultarSaldo`) trae **todas** las filas del miembro y suma en JavaScript en vez de `sum()` en SQL — funciona hoy por el volumen mínimo, no escala con historial largo.

### Los 3 RPC (todas `SECURITY DEFINER`, `EXECUTE` solo `service_role`)

Ninguna verifica identidad por sí misma más allá de `p_usuario_id` (solo para auditoría) — **toda la autorización real vive en TypeScript**, en la capa que las llama (`verificarAccesoLealtad` + `guardYMiembro`).

- **`acreditar_lealtad(p_miembro_id, p_monto, p_referencia, p_usuario_id, p_motivo)`**: `pg_advisory_xact_lock` por miembro; exige miembro activo y programa efectivamente activo; valida ventana `inicio`/`fin` en zona horaria del rancho; valida `compra_minima`; calcula puntos; aplica `max_por_transaccion`/`max_diario_cliente`; idempotencia por `(miembro_id, referencia)`; snapshot de reglas; refresca `saldo_cache`. Consumidores: `lealtad-operar-actions.ts:106`, `escaner-actions.ts:172`.
- **`canjear_recompensa(p_miembro_id, p_recompensa_id, p_usuario_id, p_referencia)`**: ver detalle completo en sección 5.
- **`revertir_movimiento(p_transaccion_id, p_usuario_id, p_motivo)`**: ver detalle completo en sección 5.

### Tabla resumen

| Estructura | Propósito real | Datos existentes | RLS | Problemas encontrados |
|---|---|---|---|---|
| `programa_lealtad` | Config de UNA tarjeta; cuelga a la vez de `rancho_id` y `cuenta_id` | 1 fila; `activo=true`; `cuenta_id` NULL pese a existir cuenta con el mismo `rancho_id` | `anon` SELECT tabla completa si `activo` (sin recorte por columna); `authenticated` FOR ALL si dueño/admin | La costura `cuenta_id` no está poblada en el único programa real; `anon` lee columnas operativas sin recorte |
| `miembros` | Afiliación identidad↔programa; `persona_id` es la llave real desde 0138 | 2 filas; `persona_id` NULL→0; `cliente_id` NULL→1 | SELECT/INSERT propios; UPDATE restringido a `estado` (0148 A3) | Casi ningún consumidor real ejercita la policy SELECT — el 90% lee con `createAdminClient()` |
| `pases_wallet` | El objeto en el teléfono; `saldo_cache` es espejo | 3 filas (2 apple, 1 google); `activo=true` en las 3 | SOLO `select` del propio pase; sin insert/update/delete | Ninguno estructural |
| `registros_dispositivo` | Registro PassKit device↔pase | 1 fila | RLS habilitada, cero políticas; sin grant | Ninguno — doble candado coherente con el resto del módulo |
| `transacciones_puntos` | El ledger; saldo se calcula sumando | 1 fila, tipo `ganado` | SOLO `select`; cero insert/update/delete fuera de RPC | `motor.ts:consultarSaldo` suma en JS, no escala con historial largo |

### Notas transversales para Wallet V2

1. La autorización real de las 3 RPC vive 100% en TypeScript — cualquier nuevo llamador (integración POS, más superficie de Wallet V2) debe replicar exactamente ese guard.
2. `programa_lealtad` sigue con dos padres vivos y en la única fila real **no están enlazados** — cualquier diseño que dependa de `cuenta_id` debe verificar primero cuál de los dos está poblado, como ya hace `cupo.ts`.
3. Patrón consistente en las 5 tablas: RLS de solo lectura para `authenticated` + escritura solo por `service_role` dentro de RPC/rutas server. Wallet V2 puede apoyarse en ese patrón salvo que agregue una tabla que el navegador deba escribir directo.

---

## 4. Identidad de personas (clientes/miembros)

**¿Un "miembro" es global, por-negocio o por-programa?** Es **por-programa** en la tabla (`miembros.programa_id`, único junto a `persona_id`), pero la identidad detrás (`personas`) es **global a toda la plataforma**: una fila en `personas` por persona, y una fila en `miembros` por cada tarjeta a la que se afilia, todas apuntando a la misma `persona_id`. El negocio nunca aparece en `miembros` directamente, solo vía `programa_lealtad.rancho_id`/`cuenta_id`.

**¿Puede la misma persona ser miembro de dos negocios sin que uno vea los datos del otro?** Sí, es el diseño (`src/lib/lealtad/personas.ts:26-32`, comentario "LA PERSONA ES GLOBAL, EL PERMISO ES POR NEGOCIO"). `resolver_persona()` la encuentra por correo/teléfono y no crea una persona nueva; se crea una fila nueva en `personas_negocio` (el vínculo). El aislamiento vive ahí: la RLS de `personas_negocio` solo deja ver filas donde `gestiona_rancho(rancho_id)` o `pertenece_a_cuenta(cuenta_id)` es cierto. `personas` en sí también tiene RLS: un negocio solo lee una persona si `ve_persona()` encuentra un vínculo suyo (0139:458-482). Solo el admin de plataforma ve el cruce completo, vía `is_admin()` o la vista `vista_personas_negocio`.

**¿Dónde se guarda teléfono/nombre/correo — una tabla o repetido?** La identidad canónica (deduplicación + RLS) vive en **una sola fila por persona** en `public.personas`, con índices únicos parciales sobre `(pais, telefono)` y sobre `correo`. Fuera de eso el dato se repite, a propósito, como copia/snapshot (nunca como fuente de verdad) en:
- `clientes_negocio` (CRM del dueño, 0109) — notas privadas con su propio `correo`/`telefono` tecleados; desde 0138 tiene `persona_id` que la enlaza, pero no se sincroniza automáticamente si `personas` cambia después.
- `consentimientos_persona` — guarda `correo`/`telefono` como **foto del dato al momento del consentimiento** (deliberado: es la prueba legal).
- `consentimientos` (tabla vieja de 0082) — recibe un espejo desde `alta_persona_por_qr` para no romper `/baja` y el webhook de Resend que ya la usan.

### Miembros de lealtad vs. usuarios que reservan en el marketplace

Son sistemas separados con una costura opcional, no la misma huella. El booking (`reservas`, 0001) referencia clientes directamente por `auth.users.id`, sin pasar por `personas` en ningún punto; ni `reservas` ni `clientes_negocio` tocan `personas` salvo por la columna `persona_id` que 0138 agregó a `clientes_negocio` como enlace de conveniencia (no la usa `reservas`).

`personas.cliente_id` (nullable, `on delete set null`) es la única costura: si alguien afiliado a lealtad por el póster (sin cuenta) después abre una cuenta de Bookea con el mismo correo, `resolver_persona()`/`enlazar_cuenta_a_persona()` (disparado por trigger `after insert on auth.users`) cuelga esa cuenta de la persona ya existente. Si nunca abre cuenta, sigue siendo una `persona` completa con pase, saldo e historial, sin fila en `auth.users`. Al revés: alguien que solo reserva en el marketplace y nunca toca lealtad no tiene fila en `personas` — solo se crea vía `resolver_persona()`, cuyos únicos llamadores son el flujo de lealtad.

### Fusión de personas (`fusionada_en`)

Tiene código de aplicación real, no solo esquema preparado, con una salvedad importante: el RPC `fusionar_personas(ganadora, perdedora)` (0138:1732) es robusto y `grant`eado a `service_role` — muda ledger, pases (los reapunta con `activo=false` en vez de borrarlos), vínculos, consentimientos, sesiones, y deja la perdedora con `fusionada_en` apuntando a la ganadora (nunca se borra). **No se encontró ningún llamador de `fusionar_personas` en `src/` ni `mobile/`** — no hay pantalla de admin que lo invoque. Lo que sí corre solo, automáticamente, es la **detección**: `resolver_persona()` inserta en `personas_duplicados` cuando dos identificadores apuntan a personas distintas, dejando el par para que "un humano lo resuelva" — y ese humano no tiene todavía puerta de UI ni script.

### Tabla de estructuras — identidad

| Estructura | Propósito real | Consumidores (archivo:línea) | Datos existentes | RLS | Problemas encontrados |
|---|---|---|---|---|---|
| **`public.personas`** | Identidad raíz global, keyed por contacto normalizado (`telefono` 8 dígitos, `correo` lowercase), no por cuenta. `cliente_id` es enriquecimiento opcional. Única puerta de creación: `resolver_persona()`. | Escritura: solo `resolver_persona`/`fusionar_personas`/triggers (`service_role`). Lectura: `src/lib/lealtad/personas.ts:246-327` (`personaDelToken`, `personaDeCuenta`, `duenosDelContacto`), `wallet/google.ts:701-709` (saludo del pase). | Sin conteo real obtenido (sandbox bloqueó la llamada de red). Cualitativo: nace por 3 caminos — alta por QR, backfill de miembros preexistentes, trigger `on_auth_user_persona` en cada signup. | SELECT único (`ve_persona(id)`: admin, propia persona, o negocio con vínculo). **Cero políticas de INSERT/UPDATE/DELETE para `authenticated`** — solo `service_role`. | Ninguno grave — diseño deliberadamente cerrado (0138:499-504: escritura desde el navegador = robo de identidad ajena). |
| **`public.personas_negocio`** | EL permiso: un negocio "ve" a una persona si y solo si existe esta fila. Separada de `clientes_negocio` (notas editables del dueño) porque este vínculo es respaldo de consentimiento y no puede perderse si el dueño borra una ficha. | `personas.ts` (indirecto, vía `alta_persona_por_qr`); vista `vista_personas_negocio`. | Sin conteo real. Única por `(persona_id, cuenta_id)` y por `(persona_id, rancho_id)`. | SELECT: admin, `gestiona_rancho`/`pertenece_a_cuenta`, o `persona_id = mi_persona()`. Sin escritura para `authenticated`. | Ninguno grave. |
| **`public.personas_duplicados`** | Cola de revisión manual: pares de personas donde un contacto nuevo resolvió a otra persona ya existente (no se fusionan solas). | Se escribe desde `resolver_persona()`/`alta_persona_por_qr()`. **No se encontró lector/UI en `src/` ni `mobile/`.** | Sin conteo real. | SELECT solo admin (deliberado — un par de duplicados cruza información entre negocios). | **Cola sin salida de UI**: se acumulan casos "para que un humano resuelva" pero no hay pantalla de admin ni llamador de `fusionar_personas`. Infraestructura preparada, flujo no cerrado. |
| **`public.consentimientos_persona`** | Ledger append-only de consentimientos por persona, separado por ámbito (`bookea`/`negocio`) y canal (`whatsapp`/`correo`/`sms`), con el texto exacto aceptado — cumplimiento Ley 8968. | `alta_persona_por_qr()` escribe una fila por canal/ámbito; `persona_acepta()` la lee; `vista_personas_negocio` la expone agregada. | Sin conteo real. Una fila nueva por cada alta con consentimiento decidido. | SELECT: admin, el propio negocio (`ambito='negocio'`), o `persona_id = mi_persona()`. **Grant por columna**: `ip`/`user_agent` NO se conceden a `authenticated`. Sin escritura para `authenticated`. | Ninguno grave. |
| **`public.sesiones_persona`** | Cookie de sesión (httpOnly) para volver a ver la tarjeta sin cuenta ni OTP repetido. Autoridad de conveniencia, no autoridad para canjear. | `personas.ts:246-257` (`personaDelToken`), `632-649` (`abrirSesionDePersona`); `tarjeta/[slug]/actions.ts:94-171`. | Sin conteo real. `expira_en` default 180 días. | RLS con **cero políticas** — `revoke all from anon, authenticated`, solo `service_role`. | Ninguno grave. |
| **`miembros.cliente_id`/`.persona_id`** (0138) | Antes: `cliente_id not null references auth.users`, único obligatorio — sin cuenta no había membresía. 0138 invierte la jerarquía: `persona_id` es la llave real, `cliente_id` baja a nullable. Ver detalle estructural completo en sección 3. | `wallet/generar.ts:176,222-241`, `google.ts:569-583`, `wallet/identidad.ts` (`buscarMiembroDelPase`, `filaDeAfiliacion`) — buscan por `persona_id` primero, `cliente_id` como respaldo. | Ver sección 3 (2 filas; `persona_id` NULL→0, `cliente_id` NULL→1). | Ver sección 3 — UPDATE de `authenticated` acotado a la sola columna `estado` desde 0148 A3. | Ninguno grave — diseño documenta y cierra el riesgo de re-parenting vía grant por columna. |

### Relación con el resto del marketplace

| Estructura | Propósito real | Datos/RLS | Problemas |
|---|---|---|---|
| **`auth.users`** (Supabase Auth) | Identidad de sesión de todo Bookea (booking + lealtad + admin), no específica de lealtad. En lealtad, solo vía `personas.cliente_id` y `miembros.cliente_id`. | Gestionada por Supabase, fuera de `public`. | N/A |
| **`clientes_negocio`** (0109) | CRM derivado de reservas — notas/etiquetas privadas del dueño. **No es la misma tabla que `personas_negocio`**: ésta es editable/borrable por el dueño, la otra es un hecho de plataforma que ni el dueño puede borrar. | RLS 0109: dueño (`rancho_id in mis ranchos`) + admin en lectura. `persona_id` (0138/0153) es enlace opcional. | Documentado en el propio 0109 con **datos de salud potenciales** (`tipo_negocio='consultorio'`) — separación de `personas_negocio` es correcta por eso. |
| **`reservas`** (booking) | Reserva del marketplace; NO pasa por `personas` en absoluto. | Fuera de alcance de este inventario. | Confirma que booking y lealtad son huellas de identidad separadas, unidas solo por `auth.users` cuando ambas existen para la misma persona. |

### Notas para Wallet V2

- La identidad que Wallet V2 debe tratar como "el cliente" es **`personas.id`**, no `auth.users.id` ni `miembros.id` — `miembros.id` cambia con una fusión (el pase viejo queda `activo=false` reapuntado), y `pases_wallet.objeto_externo` existe justo para que Google Wallet sobreviva a ese reapuntado.
- El "portero" de `alta_persona_por_qr` (`persona_protegida()`, cierre de "robo de sellos") es relevante si Wallet V2 agrega más puntos de entrada de identidad (ej. deep link sin QR): cualquier puerta nueva que llame a `resolver_persona`/`alta_persona_por_qr` hereda ese portero automáticamente.
- La cola de `personas_duplicados` sin UI de resolución es una brecha operativa si Wallet V2 aumenta el volumen de altas por QR (más superficie para colisiones de teléfono compartido).

---

## 5. Recompensas y canjes

**Conteos agregados confirmados en producción hoy** (PostgREST + service key, `select=id` + `count=exact`, sin PII):

| Tabla | Filas |
|---|---|
| `programa_lealtad` | 1 |
| `miembros` | 2 |
| `recompensas` | 1 |
| `canjes` | **0** |
| `intentos_canje` | **0** |

Ningún canje se ha procesado nunca en producción. El módulo está desplegado pero sin uso real — los hallazgos de abajo son sobre el código, no sobre patrones observados en datos.

**Costo de una recompensa**: entero fijo, `recompensas.costo_puntos` (`check (costo_puntos > 0)`, `0060:226`) — no un porcentaje. Se fija a mano por el dueño (`pases-actions.ts:834-909`, validado `786-827`). Excepción: en tarjetas de sellos, el costo de la recompensa-meta se re-sincroniza automáticamente al editar el beneficio (`sincronizarMetaDeSellos`, `pases-actions.ts:488-521`), tomado de `beneficio.requeridos`.

**Meta para desbloquear**: dos cosas distintas. Qué recompensa es "la meta" que muestra el pase es 100% automático — la recompensa activa más barata (`order by costo_puntos ascending limit 1`, `pases-actions.ts:504-509`; mismo criterio en `wallet/tarjeta.ts:201-203`), sin campo persistido. Si el saldo ya alcanza es automático, comparado en el momento del canje (`0125:500-504`) — sin estado "desbloqueada" persistido.

**Vigencia**: dos capas independientes, con protección desigual. Por recompensa: `vigencia_desde`/`vigencia_hasta` (`0125:92-93,112`), revalidada **dentro del RPC bajo el advisory lock** (`0125:470-476`). Por programa/tarjeta entera: `vigente_desde`/`vigente_hasta` (`0136:42-49`), consumida por `programas.ts:79-95`/`canje.ts:126-147` — pero solo en capa de aplicación (`lealtad-operar-actions.ts:212-227`), **antes** del RPC, **sin lock**.

**Inventario limitado**: `recompensas.stock_total` (`0125:94,113,119-122`), no es contador que se decrementa — el RPC lo **cuenta** contra `canjes` con `estado <> 'anulado'` dentro del mismo lock, race-safe.

**Límite de canjes por cliente**: por recompensa, `limite_por_cliente` (`0125:95,114`), contado igual que el stock, bajo lock. Por programa/tarjeta, `uso_unico`/`max_por_cliente`/`max_global` (`0136:52-61`), enforced **solo en `autorizarCanje`, en JS, sin lock, antes del RPC** (`canje.ts:171-193`).

**Repetible o un solo uso**: lo decide `limite_por_cliente` (null=repetible, 1=un solo uso) combinado con `uso_unico`/`max_por_cliente` a nivel de tarjeta. `mostrador.ts:411-613` muestra qué pone cada uno de los 8 tipos de tarjeta al nacer (ej. sellos no-repetible → `limitePorCliente:1`; evento → `limitePorCliente:1` + `stockTotal`=capacidad; membresía → `limitePorCliente:null`).

**Reversión de un canje**: no se revierte el canje directamente, se revierte la transacción del ledger que lo pagó, vía `revertir_movimiento(p_transaccion_id, ...)` (`0125:542-597`, endurecida en `0139:113-194`): mismo lock, inserta movimiento `ajuste` compensatorio (`+costo_puntos`, enlazado por `reversion_de`, único parcial impide revertir dos veces), marca `canjes.estado='anulado'` con `anulado_motivo`, actualiza `saldo_cache`. **Guarda desde 0139**: si la compensación dejaría el saldo negativo, se rechaza entero (`codigo:'saldo-insuficiente-para-revertir'`) — solo aplica a revertir una acreditación ya gastada; revertir un canje siempre suma, nunca cae en esta guarda.

**Actor que autoriza**: `canjes.entregado_por` y `transacciones_puntos.usuario_id`, con el `user.id` de la sesión que operó (dueño, admin, o colaborador con permiso `canjear`, `verificarAccesoLealtad`). `usuario_id=null` = "sistema". El PIN de mostrador (`fijar_pin_colaborador`/`pin_valido`, 0137/0148) existe en la base pero **no lo llama ninguna pantalla** (cero resultados en grep) — capacidad muerta, documentada así en el propio comentario de `0148:472-475`.

**Código o comprobante para el cliente**: no existe código de canje separado. La "prueba" es el pase mismo — su QR/código de barras (`barcodes[0].message = serialNumber`) es fijo, no cambia por canje; lo que cambia es el contenido del pase tras el push. El `canje_id` (UUID) nunca se muestra al cliente, se usa internamente para `eventos_integracion.idempotencia`. El empleado ve `instrucciones`/`sku` (texto de caja) y puede anotar `factura_ref` vía `marcarCanjeEnPos`.

### Idempotencia — mecanismo real, no el nombre de la columna

1. **La `llave_idempotencia` de la 0137 está muerta.** Columna e índice único parcial existen (`0137:33-42`), pero **ningún INSERT del código le escribe nada** (grep en todo `src/`/`supabase/`: cero resultados fuera de la propia migración). El propio comentario de `lealtad-operar-actions.ts:241-245` lo confirma sin darse cuenta: *"`llaveDeCanje` existía desde la 0137 con sus 23 pruebas y CERO llamadores"* — pero lo que conecta no es esa columna, es el parámetro `p_referencia` del RPC.
2. **El constraint que de verdad corta el doble toque** es `transacciones_puntos_referencia_unica` (`0060:187-189`, único parcial sobre `(miembro_id, referencia)`). `canjear_recompensa` inserta primero en `transacciones_puntos` con esa `referencia` **dentro de `begin/exception when unique_violation`** (`0125:508-519`); solo si eso tiene éxito inserta en `canjes` (sin try/catch propio, `0125:521-527`).
3. **Consecuencia verificada**: `canjes_referencia_unica` (`0125:207-208`) y el índice de `llave_idempotencia` (0137) son redes redundantes en la práctica — ambos INSERT usan el mismo string de `referencia`, así que el de `transacciones_puntos` siempre choca primero.
4. **La llave real** la arma `llaveDeCanje({miembroId, recompensaId, ahoraCR})` = `"${miembroId}:${recompensaId}:${minuto}"` (`canje.ts:225-232`, hora CR), usada como `p_referencia = "canje:" + llaveDeCanje(...)` **solo si el llamador no mandó su propia `referencia`** (número de factura del POS gana si existe).
5. **Doble clic dentro del mismo minuto**: `pg_advisory_xact_lock(hashtext('lealtad:'||miembro_id))` (`0125:441`) serializa las dos llamadas. La segunda choca `unique_violation` (SQLSTATE `23505`) sobre `transacciones_puntos_referencia_unica`, atrapado **dentro de la función PL/pgSQL** — el RPC devuelve `200 OK` con `{ok:false, motivo:'ya-canjeado', saldo}` (nunca un error crudo). `mostrador.ts:75-83` lo traduce a: *"Ese premio ya se entregó hace un momento — no se le cobró dos veces."* Se registra en `intentos_canje` con `aprobado:false, motivo:'ya-canjeado'`.

**Gap real encontrado (no cubierto por 0137)**: las reglas de 0136 (`uso_unico`, `max_por_cliente`, `max_global`, vigencia/horario de la *tarjeta*) se evalúan en `revisarReglas`/`autorizarCanje` **antes** del RPC y **sin ningún lock** (`lealtad-operar-actions.ts:582-680`). El RPC de 0125 solo revalida saldo, stock y límite-por-*recompensa*, nunca `uso_unico`/`max_por_cliente`/`max_global` — esas columnas no aparecen en ningún `where` del RPC. Dos peticiones concurrentes que caigan en minutos distintos (referencia distinta) pasan ambas por `revisarReglas` viendo `canjesDelCliente=0` (porque ninguna escribió `canjes` todavía) y ambas llegan a un RPC que no vuelve a preguntar por `uso_unico`: **un cupón de un solo uso podría canjearse dos veces por esta vía**, algo que el stock/límite-por-recompensa sí evita porque está dentro del lock.

### Tabla de estructuras

| Estructura | Propósito real | Consumidores (archivo:línea) | Datos existentes | RLS | Problemas encontrados |
|---|---|---|---|---|---|
| `recompensas` | Catálogo de premios canjeables por programa; costo fijo, tipo/valor/vigencia/stock/límite-por-cliente desde 0125. La más barata activa es "la meta" (derivado). | Owner CRUD: `pases-actions.ts:834-938`, UI `editor-recompensas.tsx`. Lectura pública filtrada (0148). Lectura interna con service key: `escaner-actions.ts`, `lealtad-operar-actions.ts`, `wallet/generar.ts`, `wallet/google.ts`, `/tarjeta/[slug]`, `/citas/[slug]`, póster. | 1 fila | SELECT: `anon`/`authenticated` solo si activa+vigente+programa activo (0148 A5, reemplaza `using(true)` original); `sku`/`instrucciones` excluidas del grant a `anon`. ALL: dueño del rancho o admin. | (1) `costo_puntos`/stock/límite validados dos veces con criterios ligeramente distintos (JS vs CHECK Postgres), mantenidos en paralelo. (2) Ningún test de integración cubre la política RLS pública de 0148. |
| `canjes` | Registro de canjes completados (débito real del ledger). `estado`: `pendiente`→`entregado`→(`anulado`). Ligado 1:1 a la transacción del ledger vía `transaccion_id` desde 0125. | Escritura: exclusivamente el RPC `canjear_recompensa` y el trigger de `revertir_movimiento`. Lectura: `lealtad-secciones-cliente.tsx`, `auditoria-resumen.tsx`, `pases-panel.tsx`. | **0 filas** | SELECT: cliente ve las suyas, dueño/admin las de su programa. **Sin INSERT/UPDATE/DELETE para `authenticated`** — solo `service_role` vía el RPC. | (1) `llave_idempotencia` (0137) es columna muerta. (2) `canjes_referencia_unica` (0125) redundante en la práctica. (3) Reglas de tarjeta (0136) no revalidadas dentro del RPC — ventana de carrera real entre `revisarReglas` (sin lock) y el commit. |
| `intentos_canje` | Auditoría de TODO intento (aprobado o rechazado), separada de `canjes` a propósito — un rechazo no mueve el ledger. Guarda `MotivoRechazo` sin CHECK cerrado, para no exigir migración por cada motivo nuevo. | Escritura: `anotarIntento` en `lealtad-operar-actions.ts:689-714`, disparada `after()` (fire-and-forget). Lectura: sección Auditoría del panel. | **0 filas** | SELECT: solo dueño/admin del programa. **Sin policy de INSERT para nadie** — únicamente `service_role`. | (1) Escritura vía `after()` sin reintento ni cola: un fallo de red se pierde silenciosamente. (2) `anotarIntento` no lleva su propia llave de idempotencia — un doble clic verdaderamente concurrente (antes del lock) puede dejar dos filas de auditoría; inofensivo por ser solo bitácora. |

---

## 6. Storage y branding

**Hallazgo principal: hay DOS buckets distintos guardando el mismo dato lógico**, según por dónde se creó la tarjeta:

| Camino de alta | Bucket | Ruta | Código |
|---|---|---|---|
| Panel del dueño (`/lealtad/panel/[id]`, tarjeta ya existe) | `ranchos-fotos` | `lealtad/logos/<user_id>/<uuid>.<ext>`, `lealtad/bandas/<user_id>/<uuid>.<ext>` | `src/components/subir-imagen.tsx:37,127,129-138`, invocado desde `creador-tarjeta.tsx:285-304` y `seccion-tarjeta-digital.tsx:232-250` |
| Onboarding público (`/lealtad/nuevo`, negocio nuevo) | `comprobantes` | `logos-negocio/alta-<timestamp>.<ext>` (mezclado con `solicitudes-lealtad/alta-<timestamp>.<ext>`, comprobante de depósito) | `src/app/lealtad/nuevo/wizard-alta.tsx:140-151,166-180` |

Ambos terminan escribiendo la misma columna (`programa_lealtad.pase_logo_url`/`pase_banner_url`, ver sección 3), vía `crear-actions.ts` en el primer caso y `nuevo/actions.ts:309,367` en el segundo. El comentario de la migración 0132 (línea 129-131) documenta la intención original — "va al bucket `comprobantes`, que ya es público" —, pero el creador del panel diverge de eso sin que nadie lo haya actualizado. La única validación real es a nivel de aplicación (`esUrlDeNuestroStorage`: exige `https` + patrón `/storage/v1/object/public/<bucket>/`); a nivel de base el único CHECK es `pase_logo_url ~ '^https://'` (0122:71-73) — no exige bucket, así que este desvío es invisible para el esquema.

### Tabla de estructuras

| Estructura | Propósito real | Consumidores (archivo:línea) | Datos existentes (agregado, prod) | RLS | Problemas encontrados |
|---|---|---|---|---|---|
| Bucket `ranchos-fotos` | Bucket genérico de fotos de rancho, reusado por el creador/editor del panel de lealtad para logo y banda del pase | `subir-imagen.tsx:37,129-138`; leído en generación por `wallet/generar.ts:375-384` (`bajarImagen`, fetch plano) | `lealtad/logos/`: 1 carpeta de usuario, 3 archivos. `lealtad/bandas/`: 3 carpetas, 11 archivos. Ninguno referenciado hoy por la única fila de `programa_lealtad` | `public=true` (0011). SELECT: `anon, authenticated` sin restricción. INSERT/UPDATE/DELETE: `to authenticated using (bucket_id='ranchos-fotos')` — **sin comprobar dueño del objeto** | Cualquier cuenta autenticada puede sobrescribir o borrar el logo/banda de OTRO negocio vía Storage API directa (la app respeta la carpeta `<user_id>/` por convención, no por RLS). **14 archivos huérfanos** confirmados: se sube al elegir el archivo, no al guardar el formulario; "Quitar" (`subir-imagen.tsx:166-175`) solo limpia el estado, nunca llama `storage.remove()` |
| Bucket `comprobantes` | Nació para comprobantes de depósito (0003); reusado desde 0130/0132 para el logo del pase del wizard de alta de negocio nuevo | `wizard-alta.tsx:140-151,166-180`; leído igual por `bajarImagen` en `generar.ts:375-384` | No medido por separado (mismo bucket que comprobantes de pago reales) | `public=true` desde 0144 (antes `false` — "alguien lo cambió a mano en el dashboard", según el propio comentario de 0144). INSERT: `anon, authenticated`. SELECT: solo `authenticated` + `is_admin()`/`puede_ver_comprobante()` (0148) — pero como el bucket es público, la ruta `/object/public/...` **bypasea esa política igual**. Sin UPDATE/DELETE para `authenticated` | Logo de marca de un negocio viviendo en el mismo bucket que comprobantes de pago de clientes reales, con políticas pensadas para documentos sensibles, no para branding público. Contradice el bucket que usa el panel para el mismo dato |
| `programa_lealtad.pase_logo_url`/`pase_banner_url`/`pase_color_fondo`/`pase_color_sello`/`pase_sello_icono` | Lo que el generador de `.pkpass` y el objeto de Google leen para pintar el pase (columnas detalladas en sección 3, 0122/0132/0145) | `wallet/tarjeta.ts:29-56` (`ConfigPase`), poblado por `tarjetaDesdeFila` (153-177); consumido por `generar.ts:296-313` (Apple) y `google.ts:186,326,357` (Google) | 1 fila total. 0 con `pase_logo_url`, 0 con `pase_banner_url`, 0 con `pase_sello_icono`. 1 con `pase_color_fondo` (colores personalizados sin imagen) | RLS ver sección 3 (SELECT `anon,authenticated` si `activo=true` o dueño/admin; ALL dueño/admin) | El CHECK de base solo exige `^https://` y formato hex — no ata la URL a un bucket propio ni a dimensiones esperadas; esa validación vive solo en `esUrlDeNuestroStorage` de la capa de aplicación |
| `solicitudes_lealtad.pase_logo_url`/`pase_color` | Staging del logo/color ANTES de que exista el negocio: lo que la persona sube en `/lealtad/nuevo`; al aprobar, `nuevo/actions.ts` los copia a `programa_lealtad` | `0130_solicitud_de_alta.sql:47-54`; escrito por `nuevo/actions.ts:155`; copiado en `crearGratisAlInstante` (líneas 309,367). Ver sección 2 para el resto de columnas/RLS de esta tabla | No medido en este pase | Ver sección 2 | Mismo problema del hallazgo principal: la URL que llega acá viene del bucket `comprobantes`, no de `ranchos-fotos` |
| Pipeline de subida: `subir-imagen.tsx` + `comprimir-imagen.ts` | Comprime/reencoda EN EL NAVEGADOR antes de subir directo al bucket (sin pasar por server action, por el techo de body de Vercel) | `subir-imagen.tsx:94-144` (validación+subida); `comprimir-imagen.ts:70-166` (resize/reencode) | N/A (código) | N/A — corre con la sesión del usuario, sin política propia más allá de la del bucket destino | Validación de tipo MIME es **solo cliente** (`archivo.type.startsWith("image/")`, `subir-imagen.tsx:98`) — nada revalida los bytes en el servidor antes de que el objeto quede público. `image/svg+xml` pasa el filtro MIME pero `comprimirImagen` lo salta sin procesar (`comprimir-imagen.ts:97`, es vectorial) |
| Renderizador de assets del pase: `src/lib/wallet/imagenes.ts` (sharp) | Dibuja en el servidor, EN CADA generación/refresco (no cacheado): recorte a cover, máscara circular de cada sello, trim del logo, velo sobre la banda | `dibujarBanda`, `dibujarTiraDeSellos`, `dibujarLogo`, `dibujarIcono`; invocado desde `generar.ts:299-313` | N/A (código) | N/A — corre server-side con `createAdminClient()`, nunca con sesión del cliente | Ninguno grave: degradación contemplada (`escalones-tira.ts`) ante imagen rota o formato ilegible — el pase nunca se cae, se degrada a texto/color plano con `console.warn` |
| 8 paletas de color: `src/lib/lealtad/paletas.ts` | Terna de 3 colores por tipo de tarjeta (oscuro→medio→claro); solo `colores[0]` (fondo) y `colores[2]` (acento del sello) llegan al pase real | `PALETAS`, `coloresDePaleta` (84-86), `paletaDeLosColores` (97-105); aplicado por `plantillas-color.tsx` | Estáticas en código, no en base | N/A | Ninguno: `paletas.test.ts` fuerza por identidad que landing y creador lean el mismo arreglo, y que las 8 cumplan contraste WCAG AA contra texto blanco fijo de Apple |

### URLs públicas vs. firmadas, y qué pasa si se rompen

**Son URLs públicas estables, nunca firmadas.** Ambos buckets tienen `public=true` (0011, 0144) y sirven en la forma fija `https://<proyecto>.supabase.co/storage/v1/object/public/<bucket>/<ruta>`, sin expiración. `esUrlDeNuestroStorage` (`src/lib/storage-publico.ts:57-90`) valida explícitamente ese patrón — una URL firmada (`/object/sign/`) sería rechazada si se intentara guardar.

**Qué pasa si el objeto desaparece o el bucket se vuelve privado** (ya pasó una vez con `comprobantes`, según el propio comentario de 0144):
- **Apple**: cada generación/refresco hace `fetch` fresco (`bajarImagen()`, `generar.ts:375-384`) y traga cualquier error devolviendo `null`. La escalera de degradación (`escalones-tira.ts`) prueba banda+logo → solo banda → solo logo → ninguno, sin tumbar el pase — solo `console.warn`. Si el objeto vuelve a existir, el siguiente refresh lo recupera solo.
- **Google**: la URL se manda TAL CUAL a la API (`programLogo`/`heroImage`, `google.ts:186,326,357`) — Google la descarga, no el servidor de Bookea. El propio comentario del código (`google.ts:338-342`) advierte que si esa URL falla, **Google rechaza el `loyaltyObject`/`loyaltyClass` ENTERO** — razón por la que el equipo decidió no generar un equivalente de tira de sellos para Android. **Asimetría real entre plataformas**: Apple se degrada en silencio, Google puede fallar la emisión/actualización completa del pase.

### Procesamiento de imágenes

1. **Al subir (navegador, `comprimir-imagen.ts`)**: redimensiona por canvas (512px logo / 1200px banda), reencoda a JPEG (o PNG si `conservarAlfa` y hay transparencia real, solo para logos — el fondo del pase es navy). Techo de 2 MB medido DESPUÉS de comprimir. Si el canvas falla, sube el original sin tocar.
2. **Al generar el pase (servidor, `imagenes.ts`, sharp)**: cover-crop exacto a medidas Apple, `rotate()` por EXIF, `trim()` del logo, máscara circular por sello, velo sobre la banda. Se re-ejecuta desde cero en CADA generación — sin caché de la imagen renderizada.

No hay validación de tipo MIME server-side en ningún punto — solo el chequeo de `File.type` en el navegador.

### Notas para Wallet V2

El conteo real de uso es mínimo (1 fila en `programa_lealtad`, 0 con logo o banda), consistente con que el panel standalone de lealtad es trabajo reciente — pero los 14 archivos huérfanos en `ranchos-fotos/lealtad/*` muestran que el patrón "sube al elegir, no al guardar, sin borrar al reemplazar/cancelar" ya genera basura incluso a esta escala. Antes de diseñar V2 conviene decidir: ¿un solo bucket para branding de lealtad, separado de `comprobantes` (que debería quedar solo para documentos de pago)? ¿URLs firmadas de larga duración en vez de públicas permanentes, dado que hoy cualquiera con la URL puede verla y cualquier cuenta autenticada puede sobrescribir/borrar el objeto de otro negocio en `ranchos-fotos`?

---

## 7. Preguntas abiertas para el diseño de Wallet V2

Cosas que los seis reportes **no pudieron confirmar con certeza** (por bloqueo de acceso, por ausencia de UI/llamador, o por quedar como decisión explícitamente pendiente en el propio código) — deben tratarse como riesgo conocido, no asumirse:

1. **Conteos de identidad de personas sin confirmar con datos reales.** El reporte de identidad no pudo ejecutar ninguna consulta contra producción (el sandbox bloqueó la llamada de red): no se sabe cuántas filas tiene `personas`, `personas_negocio`, `personas_duplicados` (pendientes de fusión), `consentimientos_persona`, ni `sesiones_persona` activas, ni cuántas personas están vinculadas a 2+ negocios. Las queries quedaron listas para correr a mano en el SQL Editor pero no se corrieron.

2. **Desglose exacto de `ranchos` por estado.** Se confirmó `estado='aprobado'`=8 (vía `anon`) y un total de 12 ranchos (vía la columna `plan_lealtad`, conteo agregado del reporte de planes), pero no quedó confirmado cómo se reparten los ~4 restantes entre `pendiente`/`rechazado`/otros estados, ni si esos 4 tienen relación con Lealtad.

3. **Conteos de `perfiles`, `modulos_negocio`, `rancho_colaboradores` y `verificacion_proveedores`.** Ningún reporte obtuvo cifras reales para estas cuatro tablas (solo confirmación de que sus RLS/grants bloquean `anon`, lo cual es correcto pero no da volumen).

4. **Si `/lealtad/nuevo/actions.ts` va a corregirse para crear fila en `cuentas`.** Es una decisión de producto/ingeniería pendiente, no un hecho verificable en el código actual — mientras no se resuelva, cualquier diseño de Wallet V2 que asuma `programa_lealtad.cuenta_id` siempre poblado va a fallar contra el dato real de hoy (el único programa de producción tiene `cuenta_id` NULL).

5. **Si `ranchos.plan_lealtad` se sigue escribiendo como respaldo o se completa la migración a "`cuentas` como única raíz".** El propio código de `cuenta.ts` deja esto como transición abierta; ya hay drift confirmado en producción y no hay fecha ni decisión documentada de cierre.

6. **Qué tabla es la real para "equipo" de Lealtad: `rancho_colaboradores` (en uso, compartida con todo el marketplace) o `cuentas_equipo` (diseñada para esto en 0134, RLS completa, cero tráfico).** Ninguno de los reportes encontró una decisión tomada — es una ambigüedad de arquitectura que Wallet V2 heredaría si vende "asientos de equipo" como parte de su propio catálogo.

7. **Si la ventana de carrera en `canjear_recompensa` (reglas de tarjeta de 0136 — `uso_unico`, `max_por_cliente`, `max_global` — evaluadas sin lock antes del RPC) es un riesgo aceptado o pendiente de arreglo.** Es un gap real confirmado por lectura de código, pero no hay incidente ni decisión registrada sobre si se corrige antes de escalar el volumen de canjes que traería Wallet V2.

8. **Si el PIN de colaborador de mostrador (`fijar_pin_colaborador`/`pin_valido`, 0137/0148) es una capacidad que Wallet V2 debe activar (construir la pantalla que la llame) o código muerto para retirar.** Existe en la base, tiene RLS, pero cero llamadores confirmados por grep.

9. **Si `fusionar_personas` y la cola de `personas_duplicados` deben quedar manuales para siempre o si Wallet V2 necesita construir la UI de resolución.** El RPC existe y es robusto, pero no hay pantalla de admin ni decisión documentada sobre quién la opera ni con qué frecuencia se espera que se use.

10. **Estrategia de bucket y tipo de URL para branding de Lealtad (logo/banda del pase).** Ningún reporte encontró una decisión tomada entre mantener dos buckets (`ranchos-fotos` vs `comprobantes`), consolidar en uno nuevo dedicado a Lealtad, o pasar de URLs públicas permanentes a firmadas — se señala como pregunta abierta en el propio reporte de storage, no como hallazgo cerrado.

11. **Si el pipeline de `sharp` (`src/lib/wallet/imagenes.ts`) maneja SVG igual que un raster.** El reporte de storage marca esto explícitamente como "no confirmado" — `comprimir-imagen.ts` en el navegador salta el procesamiento de SVG a propósito, pero no se verificó el comportamiento del lado del servidor al generar el `.pkpass`/objeto de Google.

12. **Confiabilidad de las cifras "datos existentes" citadas en este documento en general.** Como los seis reportes corrieron con niveles de acceso distintos a producción (algunos con `service_role` real, otros bloqueados por el sandbox), cualquier número que aquí aparece como "confirmado" debería re-verificarse en el SQL Editor antes de usarse como base de capacity planning para Wallet V2 — especialmente los conteos de tablas de identidad (punto 1) y de negocio (`perfiles`, `rancho_colaboradores`, etc., punto 3).
