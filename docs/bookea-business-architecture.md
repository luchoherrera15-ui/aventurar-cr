# BOOKEA BUSINESS — Arquitectura

> Fase 0 del plan: auditoría del sistema real antes de tocar una línea.
> Fecha: 2026-08-09. Complementa (no reemplaza) [AUDITORIA.md](../AUDITORIA.md),
> que audita la vertical Citas contra la spec de CRM/retención.

**Resumen en una línea**: Bookea ya es multi-tenant y ya tiene un motor de
reservas por hora con recursos, horarios, buffers y bloqueos. Lo que falta
para "Bookea Business" no es un motor nuevo — es un **eje nuevo de
configuración** (tipo de negocio + módulos) que decida qué se muestra, y
tres motores encima (membresías, clases, check-in).

---

## 1. Arquitectura actual

| Capa | Qué hay |
|---|---|
| Framework | Next.js 16 (App Router, RSC + server actions), React 19, TypeScript estricto, Tailwind 4 |
| Deploy | Vercel · crons en `vercel.json` y GitHub Actions |
| Datos | Supabase (Postgres + Auth + Storage). **107 migraciones** en `supabase/migrations`, todas idempotentes |
| Móvil | Expo (`mobile/`) contra la **misma** base — cualquier cambio de esquema la toca |
| Correo | Resend (`src/lib/email.ts`) · Push nativo (`push_tokens`) |
| IA | Anthropic SDK (asistente, importador de agenda, generador de invitaciones) |
| Tests | Vitest sobre la lógica **pura** (18 archivos `*.test.ts`) — no hay tests de integración |

**Estructura de carpetas** (la que importa para esto):

```
src/app/mi-negocio/[id]/       ← el panel del dueño (dashboard)
  page.tsx                     ← arma las pestañas y carga TODO en una tanda
  panel-sidebar.tsx            ← el menú lateral (client)
  dashboard-metricas.tsx       ← las tarjetas de números
  metricas.ts                  ← cálculo puro de esas tarjetas
  citas/                       ← la pantalla de agenda + su configuración
  finanzas/ · precios/ · editar/ · asistente/
src/app/citas/                 ← la cara pública de la vertical citas
src/lib/agenda/                ← el MOTOR (disponibilidad, equipo, ics, import)
src/lib/                       ← dominio puro: crm-citas, metricas-citas, finanzas…
```

**Patrón de capas real del repo** (y hay que respetarlo):

- `src/lib/**` — dominio **puro y testeable**, sin Supabase ni reloj.
- `**/actions.ts` — `"use server"`: valida sesión → valida datos → escribe.
- `page.tsx` (RSC) — carga datos y compone; nada de lógica de negocio.
- `*-panel.tsx` / `*-form.tsx` — `"use client"`, solo interacción.

⚠️ **Frontera cliente/servidor**: exportar un helper desde un módulo con
`"use client"` y consumirlo en el servidor produce un 500 invisible al
build (ya rompió Finanzas y el panel de IA). Todo lo compartido va en un
módulo **neutral** (sin la directiva), como `src/lib/addons.ts`.

---

## 2. Cómo funciona hoy Agenda / Servicios

Una **cita es una reserva con hora**. No hay tabla `citas`:

```
ranchos (vertical='citas')      ← el tenant
  └── rancho_items              ← los SERVICIOS (duracion_minutos, buffer_min, precio)
  └── equipo_rancho             ← los RECURSOS (tipo: profesional | espacio | equipo, capacidad)
        └── horarios_recurso    ← horario propio por recurso (0=dom..6=sáb)
        └── servicios_recurso   ← N:N: qué recurso da qué servicio
  └── bloqueos_agenda           ← vacaciones/horas cerradas (timestamptz)
  └── reservas                  ← LA CITA (fecha + hora_inicio + duracion_minutos + miembro_id)
        └── reserva_items       ← el detalle del pedido
  └── lista_espera              ← cuando el día se llenó
```

**Flujo de reserva pública** (`/citas/[slug]` → `reservar`):

1. El navegador calcula las horas libres con `calcularDisponibilidad()`
   ([src/lib/agenda/disponibilidad.ts](../src/lib/agenda/disponibilidad.ts)) — función **100 % pura**:
   herencia de horario (recurso → negocio), buffer del servicio, bloqueos
   recortados a la zona del negocio, "cualquier profesional" como unión.
2. El cliente elige y se llama al RPC `crear_cita` (0055 → 0081 → 0095), que
   **revalida todo del lado del servidor**: horario, bloqueos, buffer,
   asignación servicio↔recurso, y resuelve "cualquiera". El precio y el
   depósito **los pone la base**, nunca el navegador.
3. El trigger `reservas_respeta_cupo_dia` + `pg_advisory_xact_lock(negocio+fecha)`
   impide el doble-booking a nivel de base — para citas por solape de
   horario, para eventos por cupo diario.

**Panel del dueño**: `/mi-negocio/[id]` con 4 ítems (Inicio · Citas ·
Finanzas · Configuración) y `/mi-negocio/[id]/citas` con la agenda del día,
clientes (CRM derivado), reportes, lista de espera y giftcards.

---

## 3. Tablas y modelos que existen

**Núcleo reutilizable** (esto ES el core de Bookea Business):

| Concepto objetivo | Tabla real | Estado |
|---|---|---|
| `businesses` / tenant | `ranchos` (+ `vertical`, `zona_horaria`, `pais`, `detalles` jsonb) | ✅ sirve tal cual |
| `services` | `rancho_items` (`duracion_minutos`, `buffer_min`, `precio`, `capacidad_dia`) | ✅ sirve tal cual |
| `staff` | `equipo_rancho` (`tipo='profesional'`) | ✅ sirve tal cual |
| `resources` | `equipo_rancho` (`tipo='espacio'\|'equipo'`, `capacidad`) | ✅ **ya existe** |
| `staff_schedules` | `horarios_recurso` + `detalles.horario_citas` | ✅ con herencia |
| `service_staff` | `servicios_recurso` | ✅ N:N validado |
| `blocks` | `bloqueos_agenda` (+ vista pública sin motivo) | ✅ |
| `bookings` | `reservas` | ✅ (ver §5) |
| `customers` | derivado de `reservas` vía `agruparClientes()` | ✅ decisión D-3 |
| `payments` | columnas de `reservas` + `gastos_rancho` + `cobros_plataforma` | ⚠️ sin tabla propia |
| add-ons pagos | `addons_negocio` (**solo el servidor escribe**) | ✅ |
| consentimiento | `consentimientos`, `supresiones_correo` | ✅ |
| campañas por negocio | `campanas_negocio`, `envios_campana` | ✅ |
| lealtad | `programa_lealtad`, `miembros`, `transacciones_puntos`, `canjes`, `giftcards` | ✅ |

**Lo que NO existe**: `business_type`, módulos, membresías, créditos/paquetes,
clases, waitlist de clase (la `lista_espera` es por día, no por clase),
check-in, sucursales, roles de equipo con login.

**Roles**: `perfiles.rol ∈ {cliente, dueno_rancho, admin}`. El equipo
(`equipo_rancho`) son **recursos sin cuenta** — no hay login de recepción ni
de instructor.

---

## 4. Qué se puede reutilizar (y hay que reutilizar)

1. **El motor de disponibilidad** — puro, testeado, y ya entiende recursos con
   capacidad. Una clase de Pilates es "un recurso con capacidad 15": no hay
   que escribir un segundo motor.
2. **`reservas` como tabla única de reservas** — ya representa cita, evento
   (con `fecha_fin` multi-día), mesa y hospedaje. Una clase y un check-in de
   membresía caben con **una columna nueva** (`tipo_reserva`) y una FK.
3. **El CRM derivado** (`agruparClientes`) — la identidad del cliente por
   negocio ya está resuelta (cuenta → correo → teléfono → nombre).
4. **`addons_negocio` + `tiene_addon()`** — el modelo de "esto se cobra" ya
   existe y es seguro (el dueño no puede auto-regalarse un add-on).
5. **`PanelSidebar`** — ya soporta ítems con `href`, badges, íconos y alias de
   links viejos. Solo le falta agrupar.
6. **`SeccionPlegable`** — el patrón de configuración del panel.
7. **`verificarAccesoRancho()`** — el guard de servidor de todas las acciones.

---

## 5. Qué necesita refactor

| Pieza | Problema | Cómo se resuelve |
|---|---|---|
| Menú del panel | `esVerticalCitas ? [...] : [...]` cableado en `page.tsx` | se arma desde los módulos activos |
| `DashboardMetricas` | tarjetas fijas pensadas para Eventos ("Reservas este mes") | registro de widgets por tipo de negocio |
| `reservas` | no distingue cita / clase / evento salvo por `hora_inicio is not null` | columna `tipo_reserva` con default derivado |
| Capacidad | `equipo_rancho.capacidad` existe pero el motor **no la usa** (asume 1 cita por recurso) | el motor de clases la respeta (Fase 4) |
| Pagos | repartidos en columnas de `reservas` | se deja igual; membresías traen su propio ledger |
| Onboarding | pregunta la vertical, no el tipo de negocio | un paso más, opcional |

---

## 6. Qué NO se debe tocar

- **`crear_cita` (firma exacta)** — es contrato con la app móvil ya instalada.
  Se puede cambiar por dentro; **jamás** una sobrecarga ni un parámetro nuevo.
- **`fecha date` + `hora_inicio time` en hora local** (decisión D-1). Migrar a
  UTC toca web, app, triggers y RPCs por un beneficio que solo aparece con
  multi-país real.
- **Trigger + advisory lock** en vez de `EXCLUDE USING gist` (D-2): está en
  producción y cubre también el cupo diario de Eventos.
- **`ranchos.categoria`** y sus categorías públicas — es la taxonomía del
  marketplace, no la del panel. Ver §7 (riesgo R-2).
- **`addons_negocio`** como tabla solo-servidor: si el dueño pudiera escribir,
  se regalaría los complementos de pago.
- **Datos de producción.** Ninguna migración borra ni reescribe filas.

---

## 7. Riesgos de la migración

| # | Riesgo | Mitigación |
|---|---|---|
| **R-1** | La app móvil comparte la base y no se redeploya al mismo tiempo | Todo cambio de esquema **aditivo**: columnas nuevas anulables con default, tablas nuevas. La app vieja sigue funcionando porque nada de lo que lee cambia |
| **R-2** | Nuevas categorías públicas (gimnasio, pilates…) cambian el directorio y chocan con la regla de CLAUDE.md de no inventar categorías | **Se separan los ejes**: `tipo_negocio` es operativo (panel) y NO toca `categoria` (marketplace). Publicar Fitness en el directorio es una decisión de producto aparte, a confirmar |
| **R-3** | Las migraciones las pega el dueño a mano en el SQL Editor: el código puede llegar a producción antes que el esquema | Todo lector nuevo **tolera que la tabla no exista** y cae a los valores por defecto, con aviso dentro de su sección (patrón giftcards) |
| **R-4** | El menú dinámico podría cambiarle el panel a negocios que hoy funcionan | Los módulos por defecto están calibrados para producir **exactamente** el menú actual. Cubierto por tests |
| **R-5** | Módulo activado ≠ pantalla existente | El sidebar se arma de una tabla de ítems: un módulo sin pantalla simplemente no aporta ítems |
| **R-6** | Aislamiento multi-tenant en tablas nuevas | RLS obligatoria + `rancho_id` en toda tabla nueva + el `rancho_id` **nunca** se cree del navegador (siempre `verificarAccesoRancho`) |
| **R-7** | Sobre-ingeniería: 6 motores nuevos de golpe | Se entrega fase por fase, cada una con lint + tests + build verdes |

---

## 8. Arquitectura objetivo

**Dos ejes independientes**, y esta es la decisión de fondo:

```
VERTICAL (marketplace)          TIPO_NEGOCIO + MÓDULOS (operación)
dónde te encuentra el cliente   qué ve el dueño en su panel
eventos · citas ·               barberia · salon_belleza · unas · spa ·
hospedajes · restaurantes       masajes · consultorio · profesional ·
                                gimnasio · crossfit · pilates · yoga ·
                                academia · entrenador · eventos_* ·
                                hospedaje · restaurante · otro
```

Un gimnasio se publica en el directorio de Citas (reserva por hora) y
administra con módulos de Fitness. Nadie tuvo que inventar una vertical.

```
BOOKEA
├── Marketplace público        ranchos.vertical  (sin cambios)
└── Bookea Business            ranchos.tipo_negocio + modulos_negocio
    ├── CORE        agenda · clientes · servicios · equipo · recursos · pagos · reportes
    ├── FITNESS     membresias · clases · paquetes · checkin
    └── ADD-ONS     lealtad · asistente_ia · marketing        (cobrables → addons_negocio)
```

**Resolución de un módulo** (una sola función, `src/lib/business/modulos.ts`):

```
activo(modulo) = (override del negocio ?? default del tipo_negocio)
                 Y (no requiere add-on  O  tiene_addon(negocio, addon))
```

- `tipo_negocio` **anulable**: si está en null se deriva de `(vertical, categoria)`.
  Ningún negocio existente necesita migración de datos.
- `modulos_negocio` guarda **solo las diferencias** contra el default. Sin filas
  = el negocio se comporta como su tipo manda.
- El add-on manda sobre el módulo: apagar el add-on apaga la pantalla, aunque
  el módulo esté encendido.

**Modelo de reserva objetivo** (Fase 2, aditivo sobre `reservas`):

| Campo objetivo | En Bookea |
|---|---|
| `business_id` | `rancho_id` |
| `branch_id` | — (sucursales, pospuesto) |
| `customer_id` | `cliente_id` (+ contacto suelto para walk-ins) |
| `booking_type` | **`tipo_reserva`** ← columna nueva: `cita` · `clase` · `evento` · `estadia` · `mesa` |
| `service_id` | `reserva_items.item_id` / `detalle_pedido` |
| `staff_id` | `miembro_id` |
| `resource_id` | `miembro_id` con `tipo='espacio'` (mismo campo, otro tipo de recurso) |
| `start_time` / `end_time` | `fecha` + `hora_inicio` + `duracion_minutos` |
| `capacity` | `equipo_rancho.capacidad` (recurso) / `clase_ocurrencia.cupo` (Fase 4) |
| `price` / `status` / `payment_status` | `monto_total` / `estado` / `deposito_*`, `evento_pagado` |
| `source` | `origen` (`web` · `manual` · `importada` · `movil`) |

No se agregan campos duplicados: **`staff_id` y `resource_id` son el mismo
`miembro_id`** porque `equipo_rancho` ya modela ambos.

---

## 9. Plan de migración

Principio: **cero big-bang**. Cada fase es aditiva, con su migración
idempotente, y el sistema funciona igual si la migración todavía no se pegó.

| Fase | Migración | Qué entra | Compatibilidad |
|---|---|---|---|
| **1 · Core** | `0108` | `ranchos.tipo_negocio` (nullable) · `modulos_negocio` · motor de módulos · sidebar dinámico agrupado · panel de configuración · registro de widgets | Menú idéntico al de hoy para todo negocio existente |
| **2 · Scheduling** | `0109` | `reservas.tipo_reserva` (default `cita`/`evento` derivado) · capacidad real en el motor · CRM de cliente con notas/etiquetas | El motor actual es un caso particular (capacidad 1) |
| **3 · Membresías** | `0110` | `planes_membresia` · `membresias` · `creditos_membresia` · `consumos_membresia` · pausas y renovaciones | Tablas nuevas, nadie las lee si el módulo está apagado |
| **4 · Clases** | `0111` | `clases_plantilla` · `clases_ocurrencia` · reserva de clase sobre `reservas` · lista de espera por clase | La cita 1-a-1 no cambia |
| **5 · Check-in** | `0112` | token QR por membresía · `checkins` · métricas | — |
| **6 · Automatizaciones** | — | preparar arquitectura (no implementar IA todavía) | — |

**Regla de oro de cada migración**: `add column if not exists`, `create table
if not exists`, `drop policy if exists` + `create policy`. Nunca `drop
column`, nunca `delete`. Si algo hubiera que borrar, se para y se pregunta.

---

## 10. Orden recomendado de implementación

1. **Fase 1 · Core** (esta entrega) — sin ella, todo lo demás sería `if` regados.
2. **Fase 2 · Scheduling + Clientes** — `tipo_reserva` antes de que existan
   clases; el CRM antes que membresías, porque la membresía cuelga del cliente.
3. **Fase 3 · Membresías** antes que **Fase 4 · Clases**: una clase se paga con
   créditos de membresía, no al revés.
4. **Fase 5 · Check-in** — necesita membresías vigentes para validar contra algo.
5. **Fase 6 · Automatizaciones** — solo arquitectura.

**Pospuesto a propósito** (no es sobre-ingeniería hoy):
- **Sucursales**: ningún negocio real lo ha pedido; se agrega como
  `sucursal_id` anulable en `ranchos` cuando aparezca.
- **Roles de equipo con login** (recepción, instructor): hoy `equipo_rancho`
  son recursos sin cuenta. Se implementa cuando un negocio tenga que darle
  acceso a alguien que no es el dueño.
- **Facturación electrónica** y **sitio web propio**: los ids ya están
  admitidos en la base para no volver a migrar, pero no tienen pantalla.

---

## Anexo · Criterio de aceptación

Al terminar, dos negocios en la MISMA base, mismo auth, mismo motor:

| | Barbería (tipo `barberia`) | Studio (tipo `pilates`) |
|---|---|---|
| Módulos | agenda, clientes, servicios, equipo, pagos, reportes | clases, membresias, paquetes, checkin, clientes, equipo, pagos, reportes |
| Menú | Inicio · Citas · Finanzas · Configuración | Inicio · Clases · Membresías · Check-in · Clientes · Finanzas · Configuración |
| Dashboard | ingresos hoy · citas hoy · ocupación · próximas | clases hoy · reservas · ocupación · lista de espera · membresías por vencer |
