# Módulo CITAS / SERVICIOS — tablero de avance

Este archivo es el contrato de "no dejamos nada botado": los 49 capítulos de la
especificación, cada uno asignado a una tanda. Ninguno queda huérfano.

**No es el documento de arquitectura.** El *cómo* (decisiones, riesgos, qué no
tocar, modelo objetivo) vive en [`bookea-business-architecture.md`](./bookea-business-architecture.md)
y manda sobre este archivo. Acá solo se lleva la cuenta de qué falta y en qué orden.

Estado: ✅ hecho · 🟡 parcial (existe algo, no cumple la spec) · ⬜ falta

---

## Reglas del método

1. **Se trabaja de 3 en 3**, y las 3 piezas de una tanda son del mismo nivel de
   dependencia. No se abre la tanda siguiente hasta cerrar la actual.
2. **Terminado = las 5 casillas.** Una pieza sin las 5 no cuenta como hecha:
   - [ ] Migración numerada en `/supabase` con RLS (la pega el dueño a mano en el SQL Editor)
   - [ ] Server actions — precio y rol salen de la base, nunca del cliente
   - [ ] Panel web
   - [ ] Paridad móvil, o motivo explícito de por qué no aplica
   - [ ] `npm run build` + `npm run lint` en verde y este tablero actualizado
3. **Todo cambio de esquema es aditivo** (riesgo R-1: la app móvil comparte la
   base y no se redeploya al mismo tiempo). `add column if not exists`,
   `create table if not exists`. Nunca `drop column`, nunca `delete`.
4. **Todo lector nuevo tolera que su tabla no exista** y cae a valores por
   defecto con aviso en su sección (riesgo R-3: el código puede llegar a
   producción antes de que se pegue la migración). Patrón: giftcards.
5. **Toda tabla nueva lleva sus GRANT además de su RLS.** Crear la tabla por
   SQL no otorga el permiso de fondo, y la RLS no lo reemplaza: sin el grant,
   PostgREST responde `permission denied` a todo el mundo con las políticas
   perfectamente escritas al lado. Se olvidó en la 0119 y la tabla nació
   inservible. El par que se copia: `grant select on X to anon;` +
   `grant select, insert, update, delete on X to authenticated;` +
   `grant all on X to service_role;` (ver 0002, 0109 y 0116).
6. **El build se verifica contra el commit, no contra la carpeta.**
7. Si una pieza resulta más grande de lo pensado, se parte y la mitad que sale
   se anota acá como pieza propia. No se borra: se reprograma.

---

## Decisiones ya tomadas que este roadmap NO reabre

Están razonadas en el documento de arquitectura §6. Se listan acá porque son
justamente las que dan ganas de "empezar de nuevo":

- **No se separa `equipo_rancho` en dos tablas.** Ya está separado por
  `tipo ∈ ('profesional','espacio','equipo')` desde la 0061, con `capacidad`
  desde la 0076. Profesional y recurso son el mismo `miembro_id`.
- **No se toca la firma de `crear_cita`** — es contrato con la app móvil ya
  instalada.
- **No se migra a UTC** (`fecha` + `hora_inicio` en hora local, decisión D-1).
- **No se cambia el trigger + advisory lock** por `EXCLUDE USING gist` (D-2).
- **El CRM sigue derivado de `reservas`** (D-3); `clientes_negocio` solo guarda
  lo que no se puede derivar.
- **`ranchos.categoria` es la taxonomía del marketplace**, no la del panel.

---

## Punto de partida (lo que ya existe)

| Pieza | Dónde | Estado |
|---|---|---|
| Negocio / tenant | `ranchos` + `tipo_negocio` (0108) | ✅ |
| Módulos del panel | `modulos_negocio` (0108) | ✅ |
| Servicio | `rancho_items` (`duracion_minutos`, `buffer_min`, `precio`, `capacidad_dia`) | 🟡 sin modalidad ni política |
| Profesional y recurso | `equipo_rancho.tipo` (0061) + `capacidad` (0076) + `cupo_simultaneo` (0109) | ✅ |
| Servicio ↔ recurso | `servicios_recurso` (0061) | ✅ N:N |
| Horarios | `horarios_recurso` (0061), con herencia del negocio | ✅ |
| Bloqueos | `bloqueos_agenda` (0061) | ✅ |
| Motor de disponibilidad | `src/lib/agenda/` — puro y testeado | ✅ |
| Motor de reserva | `crear_cita_motor_pro` (0081) + trigger con advisory lock | ✅ |
| Tipo de reserva | `reservas.tipo_reserva` (0109) | ✅ |
| Agenda | `citas/agenda-citas.tsx` | 🟡 falta vista por recurso y por profesional |
| Lista de espera | `lista_espera` (0095) | 🟡 es por día, no por clase |
| Cliente del negocio | derivado + `clientes_negocio` (0109) | 🟡 sin 360° |
| Campañas | `campanas_negocio`, `envios_campana` (0094) | ✅ |
| No-show | estado en `reservas` | 🟡 no se detecta solo |
| Giftcards / lealtad | 0059, 0060 | ✅ |
| Colaboradores con login | `rancho_colaboradores` (0116) | 🟡 acceso sí, faltan los 6 roles |

**Deuda declarada en la 0109**: `cupo_simultaneo` es concurrencia genérica del
recurso, **no** la capacidad semántica de una clase. Una sala con cupo 15 hoy
acepta 15 reservas solapadas *de cualquier cosa*: dos clases distintas a la
misma hora entran. Lo resuelve la ocurrencia de clase (Tanda 3).

**Desactualizado en el documento de arquitectura** (corregir al tocarlo):
- §9 asigna `0110`/`0111`/`0112` a membresías/clases/check-in, pero esos números
  ya se usaron (media assets). La 0117, la 0118 y la 0119 son la Tanda 1;
  membresías, clases y check-in arrancan en **0120**.
- §10 da por pospuestos los "roles de equipo con login": la 0116 ya los entregó.

---

## Las tandas

El orden respeta §10 del documento de arquitectura: **membresías antes que
clases**, porque una clase se paga con créditos de membresía y no al revés;
**check-in después**, porque necesita membresías vigentes contra qué validar.

### Tanda 1 — El servicio deja de ser un ítem de catálogo · caps. 3, 4, 5 ✅ CERRADA
Migraciones 0117, 0118 y 0119, **corridas y verificadas en producción el
11-8-2026**. No tocó `equipo_rancho`. Lo verificado con la llave anónima: las
siete columnas nuevas de `rancho_items` responden, `categorias_negocio` se lee
y rechaza escritura sin sesión (42501), y `crear_cita` conserva su firma de 8
parámetros con el cuerpo de la 0118 (`prosrc like '%anticipacion_min_horas%'`
= true).

- [x] **1.1 Modalidad y capacidad declarada del servicio** ✅ — migración **0117**
      (`modalidad`, `lugar_servicio`, `cupo_min_sesion`, `cupo_max_sesion` sobre
      `rancho_items`, todas anulables). Panel web y app, los dos detrás de
      `vertical === 'citas'`. "Qué recursos requiere" ya existía: `servicios_recurso`
      (0061). **Declara, no hace cumplir**: ningún motor lee el cupo todavía — eso es
      la Tanda 3. De paso se cerró un hueco viejo de paridad: la app no podía editar
      duración en minutos ni limpieza, que la web tenía desde la 0055/0061.
- [x] **1.2 Política de reserva por servicio** ✅ — migración **0118**
      (`anticipacion_min_horas`, `anticipacion_max_dias`, `deposito_servicio`).
      **Esto sí se hace cumplir**: `crear_cita` se redefinió con la misma firma
      (quinta vez: 0055 → 0081 → 0095 → 0109 → 0118) porque la app llama al RPC
      directo y validar solo en la web dejaría el hueco abierto. El motor de
      disponibilidad y las dos pantallas de reservar además dejan de OFRECER lo
      que el RPC rechazaría. 5 tests nuevos, incluido el margen que cruza
      medianoche.
      **Se partió** (regla 7): el plazo de cancelación, "permite cancelar" y
      "permite reprogramar" se van a la Tanda 2.4.
- [x] **1.3 Categorías propias del negocio** ✅ — migración **0119**
      (`categorias_negocio`, con RLS que reusa `gestiona_rancho()` de la 0116).
      NO reemplaza a `rancho_items.grupo`: el servicio sigue apuntando a su
      sección por nombre y la tabla guarda **solo el orden**, que es lo único
      que faltaba. Una sección sin fila funciona igual que siempre. Renombrar
      arrastra los servicios; borrar no toca ninguno. Panel del dueño, `optgroup`
      en la web de reservar (que antes era una lista plana) y el orden en la
      pantalla de la app. 8 tests nuevos.
      **Un solo nivel, a propósito**: dos niveles obligaban a decidir si el ítem
      apunta al padre o al hijo y a reescribir el render en doce archivos, para
      catálogos de 8 a 20 servicios. Agregarlo después es una columna anulable.

### Tanda 2 — Monetización recurrente · caps. 15, 18, 19, 20 · migración 0120
- [x] **2.1 + 2.2 Planes, membresías y bonos** ✅ web — migración **0120**
      (`planes_membresia`, `plan_servicios`, `membresias`, `consumos_membresia`).
      Van juntas porque en la base son lo mismo: un bono es un plan de período
      `unico`. **NO se reusó `paquetes_afiliacion` (0060)**: cuelga de
      `programa_lealtad`, que es un add-on cobrable, y colgar el cobro de un
      add-on se paga caro el día que alguien lo apaga.
      El saldo es **derivado** de `consumos_membresia` (una fila por movimiento,
      negativo = devolución), nunca un contador que pueda desincronizarse.
      21 tests en `src/lib/membresias.test.ts`.
      **Falta la paridad móvil** (casilla 4): la app todavía no tiene pantalla de
      membresías. Es lo primero de la próxima tanda de trabajo.
      **Límite declarado**: `crear_cita` no descuenta solo — el consumo se marca
      desde el panel al atender. El automático necesita las reglas de cancelación
      (2.3/2.4) y de clases (Tanda 3); atarlo antes obliga a rehacerlo.
- [ ] **2.3 Políticas de cancelación y reembolso** — flexible / moderada / estricta,
      crédito, penalización, devolución parcial. Se apoya en la 0097.
- [ ] **2.4 Cancelación del cliente + su política** ← *reprogramada desde la 1.2*.
      Hoy NO existe ningún flujo donde el cliente cancele su propia cita: los
      únicos caminos son el panel del dueño (`cancelarCita`), admin y Eventos —
      y una política de cancelación no debe limitar al dueño, que siempre tiene
      que poder cancelar. Guardar `cancelacion_horas` sin ese flujo habría sido
      una columna que no gobierna nada. Entra acá, pegada a las reglas de plata
      de la 2.3: plazo de cancelación, permite cancelar, permite reprogramar.

### Tanda 3 — Clases: salda la deuda de la 0109 · caps. 3, 14 · migración 0121
- [ ] **3.1 Plantilla de clase y ocurrencia** — `clases_plantilla`, `clases_ocurrencia`
      con cupo y participantes propios. Varias reservas apuntan a la misma ocurrencia.
- [ ] **3.2 Reserva de clase sobre `reservas`** — pagada con créditos de la Tanda 2.
      La cita 1-a-1 no cambia.
- [ ] **3.3 Lista de espera por clase** — al cancelar alguien, el #1 recibe invitación
      con tiempo límite; si no acepta, pasa al siguiente. Reemplaza la de por-día.

### Tanda 4 — El ciclo de vida de la cita · caps. 10, 16, 17 · migración 0122
- [ ] **4.1 Los 10 estados del cap. 10** — sobre el estado actual, aditivo.
- [ ] **4.2 Check-in** — manual, QR y código; `checkins` + token por membresía.
- [ ] **4.3 No-show automático** — detectado al cerrar la cita sin check-in;
      penalización, consumo de bono e incidencia.

### Tanda 5 — La puerta de entrada del cliente · caps. 9, 11, 12, 21
- [ ] **5.1 Agenda con sus 5 vistas** — día, semana, mes, por recurso, por profesional.
- [ ] **5.2 Reserva online pública por servicio** — enlace propio: servicio →
      profesional → fecha → hora → datos → pago → confirmación.
- [ ] **5.3 Canal de reserva y checkout** — ampliar `reservas.origen` (hoy web ·
      manual · importada · movil) con WhatsApp, recepción, QR, marketplace, campaña.

### Tanda 6 — El cliente en el centro · caps. 22, 23, 28, 29, 30
- [ ] **6.1 Recurrencia** — "todos los martes a las 6 PM" genera las próximas citas.
- [ ] **6.2 Cliente 360° y ficha configurable por vertical** — historial, notas,
      archivos, documentos, observaciones.
- [ ] **6.3 Formularios y recordatorios ampliados** — consentimiento, cuestionario,
      firma digital; 24 h / 2 h / seguimiento sobre lo que ya hay (0038, 0092).

### Tanda 7 — Inteligencia · caps. 24, 25, 31, 32, 33, 34, 35, 36, 40, 41
- [ ] **7.1 Dashboard de capacidad y RevPAH** — ocupación, horarios críticos y
      vacíos, ingresos por hora disponible. Dashboard del módulo (cap. 40).
- [ ] **7.2 Motor de llenado** — detecta capacidad ociosa y dispara campaña,
      descuento o aviso a la lista de espera.
- [ ] **7.3 Automatizaciones, score del cliente y acciones recomendadas** — el panel
      deja de mostrar datos y empieza a decir qué hacer.

### Tanda 8 — Red · caps. 26, 27, 37, 38
- [ ] **8.1 Los 6 roles sobre `rancho_colaboradores`** — owner, manager, recepción,
      profesional, contabilidad, marketing, con permisos configurables.
- [ ] **8.2 Multisucursal** — `sucursal_id` anulable; servicios, equipo, recursos,
      horarios y precios por sucursal. Pospuesto hasta que un negocio real lo pida.
- [ ] **8.3 Marketplace de servicios + reseñas en el ranking** — se apoya en la 0071.

### Tanda 9 — Conversacional · cap. 13
- [ ] **9.1 Reserva por WhatsApp** — el asistente convierte la conversación en
      reserva consultando disponibilidad real. Se apoya en 0090 y 0093.

---

## Capítulos que no son tarea de código

Son el marco de la decisión, se releen antes de cada tanda:
**1, 2** (objetivo y concepto) · **39** (mapa de páginas del módulo, se arma tanda
a tanda) · **42, 43, 44** (arquitectura y reglas del motor — ya implementadas en
`src/lib/agenda/` y la 0081) · **45** (modelo de negocio) · **46, 47** (qué no
copiar y diferenciador) · **48, 49** (roadmap y visión).
