# BOOKEA — Arquitectura congelada

> **Estado: decisiones congeladas · 22 de septiembre de 2026.**
> Este documento no propone nada: **registra lo que se decidió** y lo
> contrasta con lo que el repositorio realmente tiene hoy. Ninguna de
> estas decisiones se ejecutó todavía — no se tocó una línea de código.
>
> Complementa `bookea-business-architecture.md` (ago 2026, el panel y el
> motor de módulos) y `lealtad-arquitectura.md`. Donde choquen, manda
> este.

---

## 0. Para qué existe este documento

El rediseño de `bookea.lat` estaba bloqueado por una pregunta que no era
de diseño: **qué es cada cosa y cómo se llama**. Este documento la
contesta, para que la nueva portada comunique el sistema real y no una
versión imaginaria que después no corresponde.

Una advertencia que atraviesa todo lo que sigue: **el sistema ya
existe**. Al día de hoy el repo tiene **235 migraciones, 157 tablas y 159
rutas**. La mayor parte de lo que este mapa dibuja está construido y en
producción. Lo que falta casi nunca es un motor nuevo: es ponerle el
nombre correcto a uno que ya corre, y conectar dos que hoy se ignoran.

Por eso cada bloque de este documento lleva su estado real:

| Marca | Significa |
|---|---|
| **CONSTRUIDO** | Existe, está en producción y se usa |
| **PARCIAL** | Existe el motor o los datos, falta pantalla o falta conectar |
| **DECLARADO** | Nombrado en el código como «próximamente», sin pantalla |
| **NO EXISTE** | Solo vive en este documento |

---

## 1. Las seis decisiones congeladas

| # | Decisión | Consecuencia inmediata |
|---|---|---|
| **1** | **Bookea es la marca paraguas.** Debajo hay productos, no empresas. | Un solo header, un solo login, un solo pie de página. Los productos dejan de venderse como marcas sueltas. |
| **2** | **Linksy desaparece como producto y como marca.** Su funcionalidad se integra dentro de Bookea. De cara al cliente es **«tu página de Bookea»** — no hay marca nueva que aprender. | «Bookea Link» sobrevive **solo como nombre técnico interno** donde el repo ya lo usa; **no aparece en la comunicación comercial**. 855 menciones en 74 archivos y un dominio comprado. Ver §8. |
| **3** | **Foorkie es un producto APARTE**, con su propia propuesta de valor. Comparte infraestructura (identidad, pagos, datos), no interfaz. | No es un módulo visual de Bookea ni una pestaña del panel. No aparece como pata del home de Bookea. |
| **4** | **Celebrar es un producto APARTE**, igual que Foorkie. Comparte infraestructura, no interfaz. | No se mete dentro de Business ni se presenta como uno de los «productos Bookea» del home. |
| **5** | **La taxonomía canónica es la que ya existe**: los 18 tipos de negocio y los 20 módulos de `src/lib/business/modulos.ts`. | Queda prohibido inventar otra lista de tipos o de módulos. Cualquier mapa nuevo (una landing, un onboarding, un menú) se arma leyendo ese archivo. |
| **6** | **NO se unifican `ranchos`, `solutions_negocios` y `celebrar_perfiles` todavía.** Primero federación por identidad, después migración progresiva. | `personas` es el único puente autorizado entre productos. Ver §6. |

Las seis se tomaron el 22 de septiembre de 2026. La #2 y la #5 son las
que tienen costo de ejecución; las otras cuatro son de posicionamiento y
no rompen nada.

---

## 2. El mapa

**Bookea no es un paraguas de cinco productos que compiten.** Bookea es
**la plataforma**, y tiene tres caras. Celebrar y Foorkie son productos
aparte que se apoyan en la misma infraestructura.

```
                          BOOKEA
                   LA PLATAFORMA PRINCIPAL
                            │
             ┌──────────────┼──────────────┐
             │              │              │
         BUSINESS        PÁGINA        DISCOVER
        (el panel)    (la cara del    (descubrir
             │          negocio)       negocios)
             │              │              │
             └──────────────┼──────────────┘
                            │
                    INFRAESTRUCTURA COMPARTIDA
              identidad · pagos · media · notificaciones
                            │
             ┌──────────────┴──────────────┐
             │                             │
         CELEBRAR                      FOORKIE
      producto aparte               producto aparte
```

La lectura en una línea: **Bookea conecta al negocio con sus clientes y
centraliza su operación digital.** El negocio crea su presencia → sus
clientes interactúan → Bookea registra esas interacciones → el negocio
gestiona y fideliza → el cliente vuelve.

Celebrar y Foorkie comparten base de datos, identidad y servicios cuando
corresponde técnicamente, pero tienen su propia propuesta de valor y su
propia experiencia. **No son módulos visuales de Bookea.**

---

## 3. BOOKEA CORE — lo que está debajo de todo

Core no es un producto ni una pantalla: es el conjunto de tablas y
módulos que **más de un producto** ya usa. Nombrarlo sirve para una sola
cosa práctica: saber qué no se puede duplicar.

| Capa | Estado | Dónde vive |
|---|---|---|
| **Identidad de persona** | CONSTRUIDO | `personas`, `personas_negocio`, `sesiones_persona`, `personas_duplicados` (migración 0138) |
| **Cuentas y sesión** | CONSTRUIDO | `auth.users` de Supabase + `perfiles`, `cuentas`, `cuentas_equipo` |
| **Consentimientos y verificación** | CONSTRUIDO | `consentimientos`, `consentimientos_persona`, `verificaciones_canal` |
| **Pagos y suscripciones** | CONSTRUIDO | `cobros_plataforma`, `cobro_negocio`, `cobros_modulo`, `suscripciones`, `eventos_stripe`, `codigos_descuento` |
| **Media** | CONSTRUIDO | `media_assets`, `media_capacidades`, `media_rate_limit` + Cloudflare Images |
| **Notificaciones** | CONSTRUIDO | Resend (`src/lib/correo/`), `push_tokens`, `supresiones_correo`, `notificaciones_promocionales` |
| **Wallet** | CONSTRUIDO | `pases_wallet` + Apple Wallet y Google Wallet (`src/lib/wallet/`) |
| **IA** | CONSTRUIDO | `uso_ia`, `conocimiento_negocio` + Anthropic SDK |
| **Integraciones y API** | PARCIAL | `autorizaciones_api`, `llaves_api_lealtad`, `desarrolladores`, `integraciones_pos` — hoy solo Lealtad expone API |

### La regla de Core

Un producto nuevo **no crea** identidad, pagos, media ni notificaciones
propios. Si los necesita, los toma de acá. La única excepción viva hoy es
`celebrar_perfiles`, y está justificada en §6.

La identidad merece una nota, porque es la pieza más valiosa y la menos
obvia: desde la migración 0138 **una persona no es una cuenta**. La llave
son sus contactos reales (teléfono normalizado y correo en minúsculas), y
`auth.users` pasó a ser un enriquecimiento opcional. Quien escanea un QR,
deja su WhatsApp y se lleva el pase a Wallet **es la misma persona** que
mañana abre cuenta, con el mismo saldo y el mismo pase. El aislamiento
entre negocios no vive en la identidad: vive en el vínculo
(`personas_negocio`). Eso es exactamente el «customer profile» del mapa,
y ya está en producción.

---

## 4. Las piezas, una por una

**4.1 a 4.4 son Bookea** — las caras de una sola plataforma, no productos
que se venden por separado. **4.5 y 4.6 son productos aparte** que se
apoyan en la misma infraestructura.

### 4.1 BOOKEA DISCOVER — descubrimiento · CONSTRUIDO

El marketplace. Hoy es **una sola portada con buscador y rieles de
catálogo**, no cinco directorios.

- Portada: `src/app/page.tsx` (buscador + `RielesCatalogo`)
- Fichas: `/citas/[slug]`, `/eventos/[id]`, `/hospedajes`, `/restaurantes/[slug]`
- Datos: `ranchos` filtrado por `vertical`
- Verticales reales: **`citas`, `eventos`, `hospedajes`, `restaurantes`** (constraint en la base desde la 0076)

**Ojo con el historial**: los directorios `/citas` y `/eventos` se
quitaron a propósito en una migración SEO de dos despliegues; hoy esas
rutas conservan solo la ficha. Revivirlos como páginas de vertical es
reversible, pero es una decisión de SEO con antecedente — no un olvido.

### 4.2 BOOKEA BUSINESS — el SaaS · CONSTRUIDO

El panel del dueño: `src/app/mi-negocio/[id]/`.

| Área | Estado |
|---|---|
| Dashboard y métricas | CONSTRUIDO (`metricas.ts`, `dashboard-metricas.tsx`) |
| Agenda y reservas | CONSTRUIDO (`reservas`, `bloqueos_agenda`, `horarios_recurso`, `lista_espera`) |
| Clientes / CRM | CONSTRUIDO (`fichas_cliente` 0228, `clientes_negocio`, `crm-citas.ts`) |
| Catálogo y precios | CONSTRUIDO (`servicios_adicionales`, `precio_tiers`, `rancho_items`) |
| Finanzas | CONSTRUIDO (`gastos_rancho`, `cobro_negocio`) |
| Lealtad | CONSTRUIDO (ver 4.3) |
| Marketing | PARCIAL — las campañas existen (`campanas_negocio`, `campanas_lealtad` con automáticas, `envios_campana`) pero el módulo `marketing` está `disponible: false` en el panel general |
| Pedidos / Commerce | PARCIAL — vive en Link (`solutions_pedidos`), **no** en el panel de Business |
| Mesas | NO EXISTE — `?mesa=N` hoy solo viaja en el QR y se propaga al menú; no hay mesa como recurso reservable |
| Inventario, comisiones, expediente, clases, membresías, check-in | DECLARADO (`disponible: false`) |

El motor que decide qué ve cada negocio es `src/lib/business/modulos.ts`
(migración 0108) y funciona con **dos ejes que no son lo mismo**:

- `ranchos.vertical` — el **marketplace**: en qué directorio te encuentra el cliente.
- `ranchos.tipo_negocio` — la **operación**: qué administra el dueño.

Un gimnasio se publica en el directorio de Citas (se reserva por hora,
igual que una barbería) pero su panel es otro. `modulos_negocio` guarda
**solo las diferencias** contra el default del tipo: sin filas, el
negocio se comporta como su tipo manda.

### 4.3 BOOKEA LEALTAD — retención · CONSTRUIDO

No aparecía como bloque en el mapa original, pero es el producto más
maduro del repo y hoy tiene interfaz propia (`/lealtad/panel/[id]`),
clientes reales pagando y API pública.

`programa_lealtad`, `miembros`, `recompensas`, `canjes`,
`transacciones_puntos`, `pases_wallet`, `campanas_lealtad`,
`solicitudes_lealtad`, `agentes_lealtad`, `reuniones_lealtad`,
`lealtad_paginas`, `llaves_api_lealtad`.

**Decisión pendiente** (no la cierra este documento): si Lealtad es un
módulo de Business o un producto con nombre propio. Hoy se comporta como
producto: tiene su landing, su alta, su panel y sus planes.

### 4.4 LA PÁGINA DEL NEGOCIO — la cara pública · CONSTRUIDO (hoy como Linksy)

> **Cómo se llama esto.** De cara al cliente: **«tu página de Bookea»**.
> Nada más. No hay marca que aprender, no se dice «Linksy» y tampoco se
> vende «Bookea Link» como producto con nombre propio. `Bookea Link`
> queda como **nombre técnico interno** para hablar entre nosotros y
> nombrar carpetas; fuera del código no aparece.

La capa pública y comercial del negocio. **No es un «link in bio»**: es
la página del negocio, y su contenido depende del rubro.

- Página pública: `/s/[slug]` y `/s/[slug]/menu`
- Panel: `/solutions/panel/[id]` (+ `instagram`, `lealtad`, `mesas`, `plan`, `restaurante`)
- Datos: 13 tablas `solutions_*`
- Ya tiene: links, menú por secciones, pedidos armados con personalización por plato (0241), planes Gratis/Pro (0239), dominio propio (0234), idiomas y nutrición (0235), 21 países y 19 monedas (0236), Instagram Auto Reply (0238)

**La URL queda en `/s/[slug]`.** No se mueve a `/r/[slug]`, porque esa
ruta ya significa otra cosa: es la portada del negocio de Lealtad
(migración 0229, la que abre el QR de la mesa, con el menú primero y la
tarjeta de lealtad segunda).

> **Dos páginas públicas para el mismo negocio es el síntoma más claro de
> las tres entidades.** `/r/` sale de `ranchos`, `/s/` sale de
> `solutions_negocios`. Convergen o se reparten el trabajo, pero eso se
> decide en la fase 2 (§6), no ahora.

### 4.5 FOORKIE — producto aparte · NO EXISTE

> **Producto aparte, no módulo de Bookea.** Comparte identidad, pagos y
> base de datos cuando corresponda técnicamente, pero tiene su propia
> propuesta de valor y su propia experiencia. **No aparece como pata del
> home de Bookea.**

Nada de Foorkie está construido. Lo que hay es historia que conviene no
repetir:

- Existió **FOOD.BOOKEA**, se eliminó el 30 de agosto de 2026.
- Un intento de revivirlo el 2 de septiembre quedó archivado en la rama `mundos-home-food`.
- **El código se borró, el esquema no**: las 11 tablas `food_*` (migraciones 0190–0207) siguen en pie y con datos, pero ningún archivo de `src/` las lee. Las tres menciones que aparecen son la subcategoría «food_trucks» y un comentario en `sitemap.ts`.

Lo que **sí** queda congelado es el alcance: Foorkie descubre → el
comensal cae en la página de Bookea Link del restaurante → menú, pedido y
reserva salen de ahí. **Foorkie no tiene panel de restaurante propio**, y
si se pide que tenga menú, pedidos o lealtad, eso ya es Bookea Link.

Lo que **no** está decidido es si arranca sobre el esquema `food_*` que
quedó o sobre tablas nuevas (ver §9). Un dato a tener a mano cuando se
decida: ese esquema tiene 132 franjas y **0 reservas** — la hipótesis del
descuento por franja nunca se validó. Conviene construir chico y medir
antes de crecer.

### 4.6 CELEBRAR — producto aparte · CONSTRUIDO

> **Producto aparte, igual que Foorkie.** Comparte infraestructura, no
> interfaz. No se presenta como uno de los «productos Bookea» en el home.

`/celebrar/*`, 14 tablas `celebrar_*` (migraciones 0242–0249), con
catálogo de 1 960 plantillas, créditos, Stripe, partners, RSVP, álbumes y
bots de IA. Dominio previsto: `celebrar.lat` (`NEXT_PUBLIC_CELEBRAR_URL`,
ya cableado en el layout).

**Deuda conocida**: convive con el producto viejo de invitaciones
(`/invitaciones`, `/i/[slug]`, tablas `invitaciones`, `invitacion_rsvp`,
`paquetes_invitacion`, `pedidos_invitacion`). Dos productos de
invitaciones vivos a la vez. Este documento no decide cuál se retira,
pero deja constancia de que uno de los dos sobra.

---

## 5. La taxonomía canónica

**Fuente única de verdad: `src/lib/business/modulos.ts`.** Cualquier
menú, onboarding, landing o mapa que liste tipos o módulos se arma
leyendo ese archivo. No se escribe otra lista.

### 5.1 Los 20 módulos

| Grupo | Módulos | Con pantalla hoy |
|---|---|---|
| Agenda | `agenda` | `agenda` |
| Gestión | `clientes`, `servicios`, `equipo`, `recursos`, `fichas`, `inventario` | los tres primeros |
| Clínico | `expediente`, `formularios`, `teleconsulta`, `recetas`, `laboratorio` | ninguno |
| Finanzas | `pagos`, `comisiones`, `reportes` | `pagos`, `reportes` |
| Fitness | `membresias`, `clases`, `paquetes`, `checkin` | ninguno |
| Crecimiento | `marketing` | ninguno |

**Piso común** (`MODULOS_BASE`, todo negocio lo tiene): `agenda`,
`clientes`, `pagos`, `reportes`.

`servicios` y `equipo` quedan fuera del piso a propósito: un lugar de
eventos no tiene catálogo (cobra por fecha) y un profesional
independiente no tiene a quién asignarle nada.

**Declarar ≠ construir.** Que un tipo liste `expediente` significa «un
consultorio trabaja con expedientes», no «hay pantalla de expedientes».
`resolverModulos` borra todo lo que tenga `disponible: false` antes de
devolver el conjunto, así que un módulo sin pantalla no puede producir un
ítem de menú que lleve a un 404 — ni por default, ni por una fila escrita
a mano.

### 5.2 Los 18 tipos de negocio

| Tipo | Familia | Vertical | Módulos por defecto |
|---|---|---|---|
| `barberia` | belleza | citas | agenda, clientes, servicios, equipo, recursos, inventario, pagos, comisiones, reportes, marketing |
| `salon_belleza` | belleza | citas | agenda, clientes, servicios, equipo, fichas, recursos, inventario, paquetes, pagos, comisiones, reportes, marketing |
| `unas` | belleza | citas | agenda, clientes, servicios, equipo, fichas, inventario, paquetes, pagos, comisiones, reportes, marketing |
| `spa` | belleza | citas | agenda, clientes, servicios, equipo, fichas, recursos, inventario, paquetes, membresias, pagos, comisiones, reportes, marketing |
| `masajes` | belleza | citas | agenda, clientes, servicios, equipo, fichas, recursos, paquetes, membresias, pagos, comisiones, reportes, marketing |
| `consultorio` | salud | citas | agenda, clientes, servicios, equipo, expediente, formularios, teleconsulta, recetas, laboratorio, pagos, reportes |
| `profesional` | salud | citas | agenda, clientes, servicios, expediente, formularios, teleconsulta, pagos, reportes |
| `gimnasio` | fitness | citas | agenda, clientes, equipo, membresias, clases, checkin, pagos, reportes |
| `crossfit` | fitness | citas | agenda, clientes, equipo, clases, membresias, paquetes, checkin, pagos, reportes |
| `pilates` | fitness | citas | agenda, clientes, equipo, clases, membresias, paquetes, recursos, checkin, pagos, reportes |
| `yoga` | fitness | citas | agenda, clientes, equipo, clases, membresias, paquetes, checkin, pagos, reportes |
| `entrenador` | fitness | citas | agenda, clientes, servicios, paquetes, membresias, pagos, reportes |
| `academia` | academia | citas | agenda, clientes, equipo, clases, membresias, paquetes, pagos, reportes |
| `eventos_lugar` | eventos | eventos | agenda, clientes, pagos, reportes |
| `eventos_proveedor` | eventos | eventos | agenda, clientes, servicios, equipo, pagos, reportes |
| `hospedaje` | eventos | hospedajes | agenda, clientes, servicios, pagos, reportes |
| `restaurante` | eventos | restaurantes | agenda, clientes, servicios, equipo, recursos, pagos, reportes |
| `otro` | otro | las cuatro | agenda, clientes, servicios, pagos, reportes |

Familias del selector: **belleza, fitness, salud, academia, eventos,
otro**.

**Hueco declarado**: no hay tipo `tienda`. El mapa de marca lo nombra
(catálogo, comprar, delivery), pero en la taxonomía no existe y el módulo
que necesitaría (`inventario`) está sin pantalla. Si Tienda es un rubro
de verdad, entra por acá — agregando un tipo, no inventando un producto.

---

## 6. Las tres entidades: federación ahora, unificación después

Hoy un «negocio» es una de tres cosas distintas:

| Entidad | Producto | Página pública | Panel |
|---|---|---|---|
| `ranchos` | Discover · Business · Lealtad | `/citas/[slug]`, `/eventos/[id]`, `/r/[slug]` | `/mi-negocio/[id]`, `/lealtad/panel/[id]` |
| `solutions_negocios` | Bookea Link | `/s/[slug]` | `/solutions/panel/[id]` |
| `celebrar_perfiles` | Celebrar | `/celebrar/[slug]` | `/celebrar/app` |

### Por qué no se unifican ahora

`ranchos` sostiene 43 imports, la app móvil (que va contra **la misma
base**), el sitemap y los correos. Ya está documentado que la tabla no se
renombra jamás. Una unificación apresurada no rompe una pantalla: rompe
el marketplace, la app y el SEO a la vez.

### Fase 1 — federación controlada (lo que sí se hace)

1. **`personas` es el único puente.** Un producto que necesite saber quién es alguien lo pregunta ahí, no replica identidad.
2. **Cada entidad conserva su tabla, su slug y su alta.** Nada se mueve.
3. **Nadie escribe en la tabla de otro producto.** Si Link necesita un dato de `ranchos`, se expone por una función, no por un join nuevo.
4. **Todo producto nuevo nace federado**: identidad y pagos de Core, tablas propias para lo suyo.

### Fase 2 — unificación progresiva (después, y con plan propio)

El orden natural, de menor a mayor riesgo: primero converger las dos
páginas públicas (`/r/` y `/s/`), después el alta, y `ranchos` al final o
nunca. Cada paso necesita su propio documento; ninguno arranca antes de
que la fase 1 esté firme.

---

## 7. Inventario de URLs

159 rutas. Estas son las que importan para el mapa.

### Lo que existe y se queda

| Ruta | Qué es |
|---|---|
| `/` | Portada + buscador (Discover) |
| `/citas/[slug]`, `/eventos/[id]`, `/hospedajes`, `/restaurantes/[slug]` | Fichas del marketplace |
| `/negocios` | «Bookea para negocios» (la landing de venta) |
| `/s/[slug]`, `/s/[slug]/menu` | **Bookea Link** |
| `/r/[slug]`, `/r/[slug]/menu` | Portada del negocio de Lealtad (QR de mesa) |
| `/mi-negocio/[id]/…` | Business App |
| `/lealtad/…` | Lealtad (landing, alta, panel, planes) |
| `/celebrar/…` | Celebrar |
| `/tarjeta/[slug]` | Tarjeta de lealtad del cliente |
| `/cuenta/…` | La cuenta de la persona |
| `/admin/…` | Panel interno de Bookea |

### Lo que el mapa de marca propone y **no existe**

`/descubrir` · `/funciones` (con sus siete hijas) · `/precios` ·
`/para-negocios`

Tres notas antes de crearlas:

- `/negocios` **ya es** la página para dueños. `/para-negocios` sería un segundo nombre para lo mismo.
- `/precios` hoy existe solo por producto (`/lealtad/planes`, `/solutions/panel/[id]/plan`). Una página de precios única obliga a decidir antes cómo se cobra el paquete completo — y eso todavía no está decidido.
- `/descubrir` compite con `/`, que ya hace exactamente eso.

### Rutas que sobran y conviene revisar

`/soluciones` (redirect permanente a Linksy) · `/solutions` ·
`/linksy` · `/invitaciones` y `/invitaciones2` (contra Celebrar) ·
`/demo`, `/demo-bookea`, `/panel-demo`, `/prueba`, `/puntaleona-web`

### Dominios en juego

`bookea.lat` (+ `www`) · `linksy.lat` (+ `www`) · `celebrar.lat`
(previsto). Los interruptores son `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_LINKSY_URL` y `NEXT_PUBLIC_CELEBRAR_URL`.

---

## 8. Retirar Linksy: qué cuesta y qué ya está resuelto

### El interruptor ya existe (y esto cambia el plan)

`urlDelNegocio()` en `src/lib/solutions/tipos.ts:367` **ya resuelve la
dirección de cada negocio en tres pasos**:

1. ¿Tiene dominio propio activo? → `https://{su-dominio}`
2. ¿`host_marca === 'bookea'`? → **`bookea.lat/s/{slug}`**
3. Si no → `linksy.lat/{slug}`

Ese `host_marca` lo introdujo la migración **0239**, con
`default 'linksy'`. O sea: **la mudanza a `bookea.lat` no hay que
construirla, hay que encenderla** — cambiar el default a `'bookea'` y
rellenar los negocios existentes.

> ✅ **Verificado el 22 de septiembre**: `supabase migration list
> --linked` devuelve `0239` con `remote` lleno. **La columna existe en
> producción.** (Las notas del proyecto la daban por pendiente desde el
> 8 de septiembre; era un dato viejo.)

### Lo que sí cuesta

- **855 menciones** de «Linksy» en **74 archivos**
- Concentradas en: `src/app/solutions/panel/[id]` (13 archivos), `src/lib/solutions` (9), `src/app/linksy` (8), `src/lib/instagram` (6), 3 migraciones y 4 scripts
- `LINKSY_HOST` y el ruteo por dominio en `src/lib/solutions/dominios.ts`
- `NEXT_PUBLIC_LINKSY_URL`, que alimenta los QR

### El dominio: legado permanente, no temporal

`linksy.lat` **deja de ser un dominio de producto**: el principal es
`bookea.lat`. Pero **no se apaga nunca**, y la palabra «temporal» es la
única parte de esta decisión que conviene corregir:

Los QR de mesa se generan con `urlDelNegocio()`
(`src/app/solutions/panel/[id]/mesas/page.tsx:47`). Los que **ya se
imprimieron** llevan `linksy.lat` grabado en tinta. **El papel es
inmutable**: no hay fecha de vencimiento posible para ese redirect sin
romperle el menú a un cliente que pegó el QR en una mesa.

La estrategia correcta:

| | |
|---|---|
| **QR nuevos** | Salen con `bookea.lat/s/{slug}` en cuanto `host_marca` pase a `'bookea'` |
| **QR viejos** | `linksy.lat/{slug}` → 301 → `bookea.lat/s/{slug}`, **para siempre** |
| **La marca** | Desaparece de toda la comunicación desde el día uno |

### Orden seguro (cuando se decida ejecutar)

1. **Solo la cara visible**: textos, títulos, logos, correos. La página pasa a ser «tu página de Bookea». Cero cambios de esquema, cero cambios de URL.
2. **`host_marca` a `'bookea'`**: los links y los QR nuevos salen por `bookea.lat`. Requiere la 0239 aplicada.
3. **Las rutas internas después**: `/solutions/panel` → donde corresponda, con redirects permanentes desde las viejas.
4. **`linksy.lat` nunca se apaga**: queda redirigiendo. Es un dominio de entrada, no una marca.
5. **Los nombres de tabla `solutions_*` no se tocan.** El prefijo es historia, no producto — igual que `ranchos`.

---

## 9. Lo que este documento NO decide

Queda explícito para que nadie lo dé por cerrado:

1. **Si Lealtad es producto o módulo** de Business.
2. **Cuál de los dos productos de invitaciones se retira** (`/invitaciones` o Celebrar).
3. **Si Tienda entra como tipo de negocio** y quién construye `inventario`.
4. **Si mesas es un recurso reservable** o se queda como parámetro del QR.
5. **Cómo se cobra el paquete completo** — sin eso no hay `/precios`.
6. **Qué pasa con las 11 tablas `food_*` huérfanas** (se borran o se dejan).
7. **Cuándo y cómo converge `/r/` con `/s/`** (fase 2).

---

## 10. Qué se desbloquea

Con estas seis decisiones congeladas, la nueva `bookea.lat` ya tiene qué
comunicar:

- **Una marca**, cinco productos con nombre estable.
- **Un mensaje por producto**: Discover trae, Link convierte, Business opera, Lealtad retiene, Celebrar celebra.
- **Una taxonomía real** de 18 tipos de negocio para armar la página de rubros sin inventar nada.
- **Una promesa honesta**: en la portada solo se promete lo que este documento marca CONSTRUIDO.

El recorrido que la portada tiene que hacer creíble, y que hoy **ya
funciona de punta a punta**:

```
crear negocio → elegir tipo → el panel se arma solo
     → bookea.lat/s/mi-negocio → el cliente reserva
     → la reserva entra al panel → la persona queda en el CRM
     → gana sellos → Marketing la trae de vuelta
```

---

*Última actualización: 22 de septiembre de 2026. Cambiar una decisión de
§1 obliga a actualizar este archivo antes que el código.*
