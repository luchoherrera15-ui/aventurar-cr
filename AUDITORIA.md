# AUDITORÍA — Bookea vs. especificación "Plataforma de Citas, Clientes y Retención"

> Fase 0 del prompt maestro. Fecha: 2026-07-31.
> Informe de brechas + estado de ejecución del plan.

## Estado del plan

| Fase | Estado |
|---|---|
| **0 · Hallazgos críticos** (C-1) | ✅ Hecho — migración [0081](supabase/migrations/0081_crear_cita_motor_pro.sql) + motor pro en web y app |
| **1 · Consentimiento y baja** (C-2) | ✅ Hecho — migración [0082](supabase/migrations/0082_consentimientos_correo.sql), página `/baja`, webhook de rebotes, filtro en campañas |
| 2 · Clientes y retención | Pendiente — el corazón del producto |
| 3-9 | Pendientes (ver §E) |

**C-3 (identidad del cliente por negocio) sigue abierto** y hay que decidirlo al arrancar la Fase 2: es lo que determina si `dias_sin_volver` nace confiable.

---

## A. Qué existe hoy

**Bookea (bookea.lat) no es un SaaS de citas puro: es un marketplace multi-vertical** con cuatro verticales activas — `eventos`, `citas`, `hospedajes`, `restaurantes` — sobre una sola infraestructura. La especificación describe un producto que aquí es *una vertical* (citas) dentro de algo más grande. Eso cambia el mapa mental, no la viabilidad: casi todo lo que la spec pide se puede montar sobre lo que ya hay.

**Arquitectura**: Next.js 16 (App Router) + TypeScript estricto + Tailwind 4, deploy en Vercel. Supabase (Postgres + Auth + Storage) con 80 migraciones en `/supabase/migrations`. App móvil Expo (`mobile/`) contra la MISMA base. Correos con Resend (`src/lib/email.ts`, ~870 líneas de plantillas transaccionales con marca). Push nativo (`push_tokens`). Dos crons de Vercel: `/api/recordatorios` (diario 8am CR) y `/api/auto-cobro`. IA con Anthropic SDK (importador de agenda, generador de invitaciones, asistente del negocio). No usa shadcn/ui: sistema de componentes propio.

**Modelo multi-tenant real** (los nombres de la spec → los del repo):

| Spec | Repo | Nota |
|---|---|---|
| `organizaciones` | `ranchos` (con `vertical`) | tenant = negocio; RLS por `owner_id` |
| `sucursales` | — | no existe |
| `staff` / recursos | `equipo_rancho` | `tipo`: profesional / espacio / equipo |
| `horarios_staff` | `horarios_recurso` + `ranchos.detalles.horario_citas` | herencia: sin filas → horario del negocio |
| `servicios` | `rancho_items` | `duracion_minutos`, `buffer_min`, `precio`, `es_paquete_base` |
| `servicios_staff` | `servicios_recurso` | N:N con trigger de mismo-negocio |
| `bloqueos` | `bloqueos_agenda` | + vista pública SIN el motivo |
| `citas` | `reservas` (con `hora_inicio`, `duracion_minutos`, `miembro_id`) | una cita ES una reserva con hora |
| `clientes` | `perfiles` / `auth.users` | cuentas de plataforma, NO ficha por negocio |
| `pagos` | columnas de `reservas` (depósito/saldo/método) | sin tabla de pagos propia |
| `promociones` | `codigos_descuento` + `promociones_dia` | sin métricas de conversión |
| lealtad (extra, no está en la spec) | `programa_lealtad`, `miembros`, `transacciones_puntos` (ledger), `recompensas`, `canjes`, `giftcards`, `pases_wallet` | ya funciona, otorga puntos al marcar cita cumplida |

**Lo que ya corre de verdad en la vertical citas**:
- Reserva pública instantánea: `/citas/[slug]` → servicio → profesional (o "cualquiera") → horas libres reales → confirmada al instante ([crear_cita, 0055](supabase/migrations/0055_vertical_citas.sql)). Sin depósito (decisión v1: se paga en el local).
- Anti doble-booking **a nivel de base**: trigger `reservas_respeta_cupo_dia` + `pg_advisory_xact_lock` por negocio+fecha, y revalidación dentro del RPC. No usa `EXCLUDE USING gist`, pero cumple la función.
- Motor de disponibilidad puro y testeado ([disponibilidad.ts](src/lib/agenda/disponibilidad.ts) + [test](src/lib/agenda/disponibilidad.test.ts)): horario por recurso con herencia, buffers, bloqueos, asignación servicio↔recurso, "cualquiera disponible".
- Estados de asistencia: `cumplida` / `no_asistio` / `cancelada` con marcas de tiempo (0061).
- Agenda del día en el panel web ([agenda-citas.tsx](src/app/mi-rancho/[id]/citas/agenda-citas.tsx)) y agenda por horas en la app móvil (`/negocio/[id]/agenda`).
- Calendario: exportar feed .ics con token secreto (0071) e importar/sincronizar agendas externas (0072).
- Importador de agenda (papel → plataforma), manual gratis o con IA como add-on de pago (0077), con bitácora de consumo y freno anti fuerza bruta.
- Recordatorio T-1 por correo y push, solicitud de reseña post-evento, reseñas de citas cumplidas.
- Panel financiero del dueño (ingresos por mes, semanas, por cobrar, gastos por sección), giftcards, lealtad, mensajería/chat con el cliente, verificación de proveedores, admin seccionado por vertical.

**RLS**: verifiqué mecánicamente las ~53 tablas creadas en migraciones — **todas** tienen `enable row level security`. Además hay patrones maduros: tablas solo-servidor (RLS niega por defecto, escribe la service key), vistas públicas que ocultan columnas sensibles, `security definer` con `set search_path`.

**El corazón de la spec — CRM de retención — hoy no existe.** No hay ficha de cliente por negocio, ni `dias_sin_volver`, ni estados Nuevo/Activo/En riesgo/Dormido/Perdido, ni segmentación, ni campañas por negocio, ni motor de automatizaciones, ni cumpleaños (no hay campo de fecha de nacimiento en ningún lado). La materia prima sí está: `reservas` guarda `cliente_id`, montos, estados de asistencia y fechas — la ficha se puede *derivar* sin migrar datos históricos.

---

## B. Tabla comparativa contra la especificación

Estados: `Completo` / `Parcial` / `No existe` / `Existe distinto`. Esfuerzo: S (horas) / M (1-2 días) / L (varios días).

### §3 Multi-tenant y roles

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Tenant con aislamiento RLS | Completo | `ranchos` + políticas en todas las tablas | — | — | — |
| Sucursales | No existe | — | modelo y UI multi-sucursal | L | Baja |
| Rol `owner` | Existe distinto | `ranchos.owner_id` (1 dueño por negocio) | nada, mientras no haya equipos con login | — | — |
| Roles `staff` / `recepcion` (usuarios con login y permisos) | No existe | `equipo_rancho` son *recursos*, no usuarios | tabla usuarios↔negocio con rol + políticas | L | Media |
| Rol `cliente` con portal | Completo | rol `cliente` (0032/0056), `/cuenta` | — | — | — |
| RLS en TODAS las tablas | Completo | verificado en las 80 migraciones | — | — | — |

### §4 Agenda y citas

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Vista día | Completo | panel web (agenda del día) + app móvil por horas | — | — | — |
| Vista semana / mes / por recurso (web) | No existe | — | calendario del panel web | L | Alta |
| Crear cita manual (buscar/crear cliente al vuelo) | Parcial | reserva manual + importador 0077 | buscar cliente existente al vuelo | M | Alta |
| Duración y precio por servicio | Completo | `rancho_items` | — | — | — |
| Sobrescribir precio en cita puntual | Parcial | `monto_cobrado_final` al cobrar | editarlo al agendar | S | Baja |
| Buffer posterior por servicio | Parcial | `buffer_min` (0061) — solo lo respeta el motor del navegador | **el RPC `crear_cita` no lo valida** (ver C-1) | M | Crítica |
| Cita con múltiples servicios | No existe | `reserva_items` lo soportaría; el RPC toma 1 ítem | RPC y UI multi-servicio | M | Media |
| Estados de cita | Existe distinto | `pendiente/confirmada/cumplida/no_asistio/cancelada`(+`temporal`, `bloqueada`) | falta `en_curso` (¿hace falta?) | S | Baja |
| Reagendar drag & drop | No existe | hoy se edita/cancela | vista calendario primero | L | Media |
| Citas recurrentes | No existe | — | generación de serie | M | Media |
| Lista de espera | No existe | — | tabla + aviso al liberarse | M | Baja |
| Bloqueos (vacaciones, almuerzo…) | Completo | `bloqueos_agenda` + vista sin motivo | — | — | — |
| Anti doble-booking en la BD | Existe distinto | trigger + advisory locks (0055/0061), no `EXCLUDE gist` | nada — cumple (ver D-2) | — | — |
| Portal público por negocio | Existe distinto | `/citas/[slug]` (no `/b/{slug}`) | nada | — | — |
| Depósito para confirmar (por servicio) | No existe | decisión v1: pago en local; depósito sí existe en eventos | flujo de depósito en citas | L | Media |
| Reglas: anticipación mín., cancelación, máx. días a futuro | Parcial | solo "fecha futura" en el RPC | config por negocio + validación | M | Alta |

### §5 Ficha de cliente y trazabilidad (corazón del sistema)

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Ficha de cliente por negocio | No existe | datos regados en `reservas` (nombre/correo/whatsapp por reserva) | tabla/vista clientes-por-negocio | L | **Alta** |
| Fecha de nacimiento, cómo nos conoció, etiquetas, notas | No existe | — | columnas + UI | M | Alta |
| `dias_sin_volver` visible y ordenable | No existe | derivable de `reservas.fecha` + `estado='cumplida'` | métricas calculadas | M | **Alta** |
| `frecuencia_promedio`, visitas, gasto, ticket, `tasa_no_show` | No existe | derivable (`monto_cobrado_final`, `no_asistio_en`…) | motor de métricas | M | Alta |
| `estado_cliente` (Nuevo/Activo/En riesgo/Dormido/Perdido) | No existe | — | cálculo + umbral configurable | M | **Alta** |
| Historial completo (línea de tiempo) | Parcial | reservas + chat + reseñas por cliente existen sueltos | vista unificada en la ficha | M | Alta |
| Dashboard de retención ("estos 27 están por perderse") | No existe | — | pantalla dedicada | L | **Alta** |
| Cumpleaños del mes | No existe | no hay campo | campo + consentimiento + UI | S | Media |
| Nuevos que nunca regresaron / retención / LTV | No existe | — | métricas | M | Alta |

### §6 Segmentación

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Constructor de segmentos (AND/OR) | No existe | — | modelo + UI | L | Alta |
| Segmentos guardados y dinámicos | No existe | — | tabla `segmentos` | M | Alta |
| Precargados ("Dormidos 60-120", etc.) | No existe | — | seeds | S | Media |
| Conteo previo (N personas, M con correo y opt-in) | No existe | — | depende de consentimiento (§8) | S | Alta |

### §7 Promociones

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| % / monto fijo con vigencia y cupos | Completo | `codigos_descuento` (0013): tipo, usos máx., vence | — | — | — |
| Promos automáticas por día de semana | Completo | `promociones_dia`, visibles en el sitio | — | — | — |
| 2x1 / combos / gratis a N visitas | Parcial | `recompensas`+`canjes` de lealtad cubren "gratis a N visitas" vía puntos | tipos combo/2x1 | M | Media |
| Aplicación automática al agendar/cobrar | Parcial | código de descuento en reservas de eventos | descuentos en el flujo de citas | M | Media |
| Métricas por promo (usos, ingreso, reactivados) | No existe | solo `usos_actuales` | panel de resultados + atribución | M | Alta |
| Página pública de promos | Parcial | promos del día en la página del negocio | página dedicada (¿hace falta?) | S | Baja |

### §8 Campañas y correos

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Capa de envío con marca | Completo | [email.ts](src/lib/email.ts) (Resend, degradación sin API key) | abstracción formal de proveedor (opcional) | S | Baja |
| Campañas POR NEGOCIO a un segmento | No existe | solo campañas de plataforma (admin, sin tracking) | flujo promo→segmento→plantilla→enviar | L | **Alta** |
| Plantillas con variables (`{{nombre}}`, `{{dias_sin_volver}}`…) | No existe | plantillas transaccionales hardcodeadas | motor de plantillas | M | Alta |
| Tracking (abiertos, clics, rebotes) | No existe | — | webhooks de Resend + `campanas_envios` | M | Alta |
| **Atribución: cuántos agendaron en 14 días** | No existe | — | enlace campaña→reserva | M | **Alta** |
| Consentimiento, desuscripción, Ley 8968 | No existe | **ningún flag `acepta_marketing`, ningún link de baja** | ver C-2 — bloquea todo envío masivo | M | **Crítica** |
| Límites anti-spam (4/mes, 7 días entre campañas) | No existe | — | contador por cliente | S | Alta |
| WhatsApp: links `wa.me` prellenados | Parcial | wa.me en restaurantes; whatsapp guardado en reservas | botón wa.me en ficha/campañas | S | Media |

### §9 Automatizaciones

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Recordatorio 24h antes | Completo | cron [recordatorios](src/app/api/recordatorios/route.ts), correo+push, bandera una-sola-vez | — | — | — |
| Recordatorio 2h antes | No existe | el cron corre 1 vez al día | cron horario o programación | M | Media |
| Gracias + reseña post-cita | Completo | reseña solicitada (eventos) / cita cumplida reseñable al instante | — | — | — |
| "Te extrañamos" (en riesgo / dormido) | No existe | — | depende de §5 | M | Alta |
| Cumpleaños | No existe | no hay campo | depende de §5 | S | Media |
| Seguimiento primera visita +30 días | No existe | — | depende de §5 | S | Media |
| No-show → tarea de seguimiento | Parcial | `no_asistio` se registra | aviso/acción posterior | S | Media |
| "Ya toca tu retoque" (X días por servicio) | No existe | — | campo por servicio + regla | M | Media |
| Motor de reglas configurable + log auditable | No existe | trabajos hardcodeados con banderas en `reservas` | tablas `automatizaciones(_ejecuciones)` | L | Media |

### §10 Verticales (belleza / salud / nutrición)

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Campos dinámicos por vertical | No existe | `ranchos.detalles` (jsonb) es del negocio, no del cliente | `fichas_vertical` JSONB | M | Media |
| Notas clínicas con acceso restringido + auditoría | No existe | `reservas.notas` es genérico | tablas sensibles + `auditoria_accesos` | L | Media |
| Medidas de nutrición + gráficos | No existe | — | tabla `medidas` + UI | M | Baja |
| Fotos antes/después | Parcial | Storage + álbumes existen para negocios | álbum por cliente | M | Baja |

### §11 Cobros y operación

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Registro de pago (efectivo/tarjeta/SINPE/transferencia/mixto) | Parcial | depósito+saldo con sinpe/transferencia (eventos); citas sin registro de método | método de pago al marcar cumplida | M | Alta |
| Adelantos y saldos | Completo | `deposito_*`, `saldo_pagado_en`, panel Finanzas, auto-cobro | — | — | — |
| Cierre de caja diario | No existe | — | modelo + UI | M | Media |
| Comisiones del staff | No existe | — | % por servicio + reporte | M | Media |
| Inventario básico | Parcial | `capacidad_dia` por ítem (alquileres); no stock de productos | productos + movimientos | L | Baja |
| Esquema listo para factura electrónica (no implementar) | Parcial | `cedula` en reservas (0015) | campos de actividad/consecutivo | S | Baja |

### §12 Reportes

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Ingresos por periodo | Completo | Finanzas del dueño + admin (ingresos/balance) | por servicio/profesional | M | Media |
| Ocupación de agenda | Parcial | % de 30 días solo para "lugares" ([metricas.ts](src/app/mi-rancho/[id]/metricas.ts)) | ocupación por recurso en citas | M | Media |
| Servicios más vendidos | No existe | derivable de `reserva_items` | reporte | S | Media |
| Nuevos vs. recurrentes, retención, no-show | No existe | — | depende de §5 | M | Alta |
| Rendimiento de promos y campañas | No existe | — | depende de §7/§8 | M | Alta |
| Exportación CSV | No existe | — | endpoints de export | S | Media |

### §13 Diseño

| Requisito | Estado | Dónde está | Qué falta | Esfuerzo | Prioridad |
|---|---|---|---|---|---|
| Identidad propia (no Fresha/Booksy) | Completo | sistema propio (paleta aventurea/navy/naranja), regla explícita en CLAUDE.md | — | — | — |
| Mobile-first en pantallas críticas | Completo | app nativa Expo comparte la base; web responsive | — | — | — |
| Modo claro y oscuro (web) | No existe | no hay `dark:` en `src/` | decisión de producto (la app móvil manda) | L | Baja |
| Estados vacíos y skeletons | Parcial | estados vacíos sí; skeletons irregulares | pulido | S | Baja |
| Onboarding guiado | Parcial | `/publicar` + `/mi-rancho/nuevo/[vertical]` | paso "importar clientes CSV" | M | Media |

### §14 Esquema de base de datos

| Requisito | Estado | Nota |
|---|---|---|
| Índices `(negocio, fecha)` citas y `(negocio, última visita)` clientes | Parcial | `reservas_citas_idx`, `reservas_miembro_fecha_idx` ✓; el de clientes no existe (no hay tabla) |
| `EXCLUDE USING gist` anti-solape | Existe distinto | trigger + advisory lock — ver D-2 |
| `clientes_metricas` por trigger + job nocturno | No existe | pieza central de la Fase Clientes |
| Soft delete en clientes y citas | Existe distinto | citas nunca se borran (estados `cancelada`/`rechazada`); no hay `deleted_at` |
| RLS desde la primera migración | Completo | ✓ |
| `consentimientos`, `auditoria_accesos` | No existe | van con §8 y §10 |

---

## C. Hallazgos críticos

**C-1 · El RPC `crear_cita` no aprendió lo de la migración 0061.**
[crear_cita (0055)](supabase/migrations/0055_vertical_citas.sql) valida el horario del negocio y el choque de citas, pero **ignora `bloqueos_agenda`, `horarios_recurso` y `buffer_min`** — todos agregados después (0061). El motor del navegador ([disponibilidad.ts](src/lib/agenda/disponibilidad.ts)) sí los respeta, así que la UI no ofrece esas horas… pero el RPC está expuesto a `authenticated`: cualquier cliente con sesión puede llamarlo directo y **reservar en vacaciones del profesional, fuera del horario propio del recurso, o pisando el buffer de limpieza de la cita anterior**. Es exactamente el anti-patrón "validación solo en el frontend" que la spec manda marcar. Corrección: replicar en el RPC (y en el trigger) las tres validaciones. Esfuerzo M. **Se corrige antes que cualquier funcionalidad nueva.**

**C-2 · No existe infraestructura de consentimiento ni desuscripción.**
No hay flag `acepta_marketing`, ni tabla de consentimientos, ni link de baja en ningún correo, ni supresión de rebotados. Para lo transaccional de hoy (confirmaciones, recordatorios) es aceptable; para el producto que pide la spec (campañas de reactivación) es **bloqueante legal (Ley 8968)**. Hay que construirlo ANTES de la primera campaña, no después. Ojo: la página admin de [campañas de plataforma](src/app/admin/(dashboard)/campanas/page.tsx) ya envía correo masivo a todas las cuentas sin opt-out — conviene ponerle el link de baja en cuanto exista la pieza.

**C-3 · Datos del cliente sin dueño claro para el CRM.**
El "cliente" de un negocio hoy es una mezcla: a veces `cliente_id` (cuenta de plataforma), a veces solo `nombre`+`whatsapp` tecleados por el dueño (reserva manual/importada). Antes de calcular `dias_sin_volver` hay que decidir la identidad del cliente por negocio (¿se agrupa por teléfono? ¿por correo?) — si no, un mismo cliente aparecerá triplicado y las métricas de retención nacerán mentirosas. No es un bug de seguridad, pero sí un riesgo de datos que condiciona todo el corazón del producto.

*(Verifiqué específicamente: RLS en todas las tablas ✓; secretos solo en servidor ✓ — `addons_negocio` e `intentos_desbloqueo` solo-servidor, token de calendario en tabla aparte precisamente porque `ranchos` es público; vistas públicas sin datos personales ✓.)*

---

## D. Diferencias de criterio (no cambio nada sin tu aprobación)

**D-1 · Hora local CR vs. UTC.** La spec pide todo en UTC con zona por negocio. El repo guarda `fecha date` + `hora_inicio time` en hora de Costa Rica — decisión *documentada* en la 0061: CR no tiene horario de verano y web, app, triggers y RPCs hablan ese idioma. **Recomiendo mantener lo actual.** Migrar a UTC tocaría todo el sistema por un beneficio que solo aparece con negocios fuera de CR (los `bloqueos_agenda` ya son `timestamptz`, lo mixto ya se maneja). Se revisa el día que haya multi-país real.

**D-2 · Trigger + advisory locks vs. `EXCLUDE USING gist`.** El constraint de exclusión es más declarativo, pero lo actual serializa por negocio+fecha, cubre también el cupo diario de eventos y **ya está en producción probado**. Recomiendo mantenerlo; C-1 se arregla dentro de este mismo mecanismo.

**D-3 · "Clientes" como cuentas de plataforma vs. CRM por negocio.** La spec asume que cada negocio "posee" su cartera. Bookea es marketplace: el cliente tiene UNA cuenta y reserva en varios negocios. Recomiendo un **CRM derivado**: una capa por negocio (métricas, etiquetas, notas, consentimiento por-negocio) calculada sobre las reservas, sin duplicar la identidad. El negocio ve su relación con el cliente; la cuenta sigue siendo una.

**D-4 · Roles.** La spec pide owner/admin/staff/recepcion por organización. Hoy: un dueño por negocio y `equipo_rancho` como recursos sin login. Recomiendo **posponer** los roles de equipo hasta que un negocio real lo pida — es esfuerzo L y no toca el diferenciador.

**D-5 · Motor de automatizaciones configurable.** La spec pide reglas disparador→condición→acción editables desde la UI. Lo que hay (crons con banderas una-sola-vez) es más simple y auditable. Recomiendo el camino intermedio: **automatizaciones predefinidas activables por negocio con su log de ejecuciones**, no un constructor genérico de reglas. Cubre los 9 casos de la tabla de la spec con la mitad del costo.

**D-6 · shadcn/ui y modo oscuro web.** La spec los pide; el repo tiene sistema propio (y CLAUDE.md manda identidad propia) y la web no tiene modo oscuro. Recomiendo mantener el sistema propio y dejar el modo oscuro web como decisión de producto aparte.

**D-7 · Depósito en citas.** La spec lo pide configurable por servicio; la 0055 documenta la decisión v1 de pagar en el local. Existe todo el mecanismo de depósitos en eventos para heredarlo. Recomiendo agendarlo (fase Cobros), no adelantarlo.

---

## E. Plan de trabajo propuesto

Reordeno las fases de la §15 según lo que realmente falta. Las fases 1, 2, 4 y media 5 de la spec **ya existen** — el orden nuevo ataca primero lo crítico y después el diferenciador, que está a cero.

| # | Fase | Contenido | Esfuerzo |
|---|---|---|---|
| **0** | **Hallazgos críticos** | C-1: `crear_cita` valida bloqueos + horario del recurso + buffer. Migración nueva, sin tocar datos. | M |
| **1** | **Consentimiento y baja** (C-2) | Flag de marketing por cliente↔negocio, tabla `consentimientos`, link de desuscripción en correos, supresión de rebotes. Se construye ANTES de cualquier campaña. | M |
| **2** | **Clientes y retención** (§5 — el corazón) | Resolver identidad (C-3), métricas por cliente↔negocio (`dias_sin_volver`, frecuencia, gasto, no-show, `estado_cliente`), lista ordenable, ficha con historial, dashboard de retención, cumpleaños, importar clientes CSV. Web + app móvil. | L |
| **3** | **Segmentos** (§6) | Constructor con filtros combinables, segmentos guardados dinámicos, precargados, conteo con opt-in. | M-L |
| **4** | **Campañas** (§7+§8) | Flujo promo→segmento→plantilla→enviar, variables, tracking vía webhooks de Resend, **atribución a 14 días**, límites anti-spam, wa.me. Métricas por promoción. | L |
| **5** | **Automatizaciones** (§9, versión D-5) | "Te extrañamos", dormidos, cumpleaños, seguimiento de primera visita, retoque por servicio — predefinidas, activables por negocio, con log. | M-L |
| **6** | **Agenda pro** (§4 restante) | Vista semana/por recurso en web, reglas de reserva configurables, multi-servicio, recurrentes, cobro de cita con método de pago. | L |
| **7** | **Operación** (§11) | Cierre de caja, comisiones, depósito en citas (D-7). | M-L |
| **8** | **Verticales sensibles** (§10) | `fichas_vertical` JSONB, notas clínicas con acceso restringido + auditoría, medidas de nutrición. Después del CRM porque cuelga de la ficha. | L |
| **9** | **Reportes y export** (§12) | Retención, ocupación por recurso, top servicios, rendimiento de campañas, CSV. Mucho sale gratis de las fases 2-4. | M |
| — | Pospuesto (D-4, §3) | Sucursales y roles staff/recepción — hasta que un negocio real lo pida. | — |

**Por qué este orden**: la fase 0 cierra el único hueco de integridad real; la 1 es prerequisito legal de todo lo demás; las 2-4 construyen exactamente los 3 criterios de aceptación que definen el producto (ordenar por días sin volver → campaña en 3 clics → ver cuántos volvieron); la 5 lo vuelve automático. Todo lo demás es ensanchar.

Cada fase: rama propia, propuesta de archivos y migraciones antes de codear, y freno al final para que la pruebes — como manda el prompt. Paridad web↔móvil en cada entrega donde aplique.
