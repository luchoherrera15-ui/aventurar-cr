# bookea.lat — Wireframe en texto

> **22 de septiembre de 2026.** El paso entre `arquitectura.md` (qué es
> cada cosa) y el diseño visual (cómo se ve). Sección por sección, con
> seis datos por sección: **qué aparece · qué mockup muestra · qué CTA
> tiene · qué rutas alimenta · qué producto real demuestra · actual vs
> futuro**.
>
> Cero código. Cero mockup visual todavía.

---

## 0. Las reglas de la casa

### Regla 1 — La landing solo promete lo que existe

No es una regla nueva: **ya está escrita en el código**, y la escribió
este repo defendiéndose de su propia maqueta. En
`src/components/home/como-funciona.tsx` hay dos comentarios que valen
como jurisprudencia:

> «La maqueta decía "filtrá por zona y fecha". La fecha no filtra en
> Citas —no existe una consulta de disponibilidad transversal al
> directorio— así que prometerla acá sería la misma mentira que se sacó
> del buscador.»

> «⚠️ La maqueta prometía "opiniones verificadas". En la base hay CERO
> reseñas: la sección existe y funciona, pero ninguna de las reservas
> terminó en una. Se cae la palabra, no el paso.»

Ese es el estándar. Cada sección de este wireframe lleva su línea
**ACTUAL / FUTURO** por la misma razón.

### Regla 2 — Sin cifras inventadas

No hay reseñas, no hay estrellas, no hay «+500 negocios confían en
nosotros». La portada no inventa números: ya es una regla del repo. Si
la sección de prueba social no se puede llenar con verdad, **no va**.

### Regla 3 — Mostrar el render real, no una captura

El repo ya resolvió esto y conviene no perderlo: `VistaPagina`
(`src/components/solutions/vista-pagina.tsx`) es **el mismo componente**
que pinta `/s/[slug]`, la vista previa del panel y los mockups de la
landing. Cuando el dueño acomoda su página y ve cómo queda, está mirando
ese render, no una imitación.

**La landing de bookea.lat hereda ese patrón**: donde se pueda mostrar el
producto vivo, se muestra vivo. Una captura envejece y miente; un render
no puede mentir porque es el producto.

---

## 1. La decisión que este wireframe obliga a tomar

Antes de la sección 1 hay un choque que no se puede esquivar:

**Hoy `/` es una portada B2C**: héroe con buscador en cápsula de cuatro
tramos (`buscador-hero.tsx`) y rieles de catálogo. El visitante que llega
busca un negocio.

**El wireframe propuesto es B2B**: «Todo tu negocio, en un solo lugar» +
«Crear mi negocio». El visitante que llega **tiene** un negocio.

Son dos personas distintas arriba del fold y **no caben las dos**.

### La evidencia para decidir

| A favor de B2B arriba | A favor de B2C arriba |
|---|---|
| El directorio está casi vacío: la última limpia registrada dejó **2 negocios** en producción y Citas quedó **vacía al público** | El SEO del sitio se construyó sobre el directorio |
| Los clientes que **pagan hoy** son negocios de Lealtad (Pura Matcha, Praia, Café Oscuro) | Ya hubo una migración SEO de dos despliegues para separar portada de directorio — rehacerla cuesta |
| Todo lo CONSTRUIDO del repo (Business, Link, Lealtad, CRM) es para el dueño | Un marketplace vacío no se llena solo desde el lado B2B |

**Recomendación**: B2B arriba del fold, Discover como sección y como
`/descubrir` con canónico propio. La razón no es de gusto: **un
marketplace con dos negocios no puede ser la promesa principal de la
portada sin romper la regla 1.**

**Verificar antes de construir**: cuántos negocios publicados hay hoy en
producción. El dato de arriba es de agosto y puede haber cambiado. Si el
directorio se llenó, esta decisión se revisa.

---

## 2. Header y navegación

**Qué aparece**
Logo · Descubrir · Para negocios · Producto · Precios · Recursos ·
[Iniciar sesión] [Crear mi negocio]

**Qué existe hoy**
`HeaderSimple` con las **cinco puertas** de
`src/components/nav/taxonomia-navegacion.ts`: `citas`, `eventos`,
`hospedaje`, `experiencias`, `servicios` (en el teléfono van en un cajón;
restaurantes salió del nav el 21 de agosto). Más la puerta B2B a
`/negocios`.

**Rutas que alimenta**

| Ítem | Ruta | Estado |
|---|---|---|
| Descubrir | `/descubrir` | **NO EXISTE** — hoy es `/` |
| Para negocios | `/negocios` | ✅ existe |
| Producto | `/productos/*` | **NO EXISTE** |
| Precios | `/precios` | **NO EXISTE** — y no se puede escribir todavía (ver abajo) |
| Recursos | `/ayuda`, `/blog` | `/ayuda` ✅ · `/blog` NO EXISTE |

**ACTUAL vs FUTURO**
De los cinco ítems, **uno funciona** (`Para negocios`). El nav se publica
con lo que existe y se agrega a medida que se construye. Un menú con
cuatro links muertos es peor que un menú de dos.

> ⚠️ **`/precios` está bloqueado por una decisión de negocio, no de
> diseño.** Hoy el precio existe por producto (`/lealtad/planes`,
> `/solutions/panel/[id]/plan`); no está decidido cómo se cobra el
> paquete completo (`arquitectura.md` §9.5). Sin esa decisión, la página
> de precios no se puede escribir sin inventar.

---

## 3. HERO — arriba del fold

**Qué aparece**
- Título: «Todo tu negocio, en un solo lugar.»
- Bajada: «Gestioná reservas, clientes, lealtad y ventas desde una sola plataforma.»
- CTA primario: **Crear mi negocio**
- CTA secundario: **Ver cómo funciona** (ancla a la sección 4)
- Sin cifras, sin logos de clientes, sin estrellas (regla 2)

**Qué mockup muestra**
El panel real de Business en un marco de escritorio, **no un collage**.
Pieza a reusar: la coreografía de `src/app/linksy/mockups-vivos.tsx` —
escenario con el dispositivo en perspectiva y las piezas que brotan del
centro con rebote escalonado. Ya está construida y probada; cambia el
contenido, no el mecanismo.

Captura real disponible por `scripts/captura-panel-linksy.mjs` (el mismo
patrón sirve para el panel de Business).

**CTA**: `Crear mi negocio` → `/mi-negocio/nuevo`

**Rutas que alimenta**: `/mi-negocio/nuevo` ✅ · `/mi-negocio/login` ✅

**Producto real que demuestra**: Bookea Business (`/mi-negocio/[id]`)

**ACTUAL** — todo lo que promete la bajada existe: reservas ✅, clientes
✅, lealtad ✅. **«Ventas» es el término frágil**: los pedidos viven en
Link, no en Business, y salen por WhatsApp. Mejor «pedidos» que «ventas»,
o se cae la palabra.

---

## 4. SECCIÓN — Tu negocio en Bookea

**Qué aparece**
El dashboard en el centro, rodeado de seis etiquetas: Reservas ·
Clientes · Lealtad · Marketing · Pagos · Analytics. Mensaje único:
«Administrá tu negocio desde un solo lugar.» **No una lista de 20
features.**

**Qué mockup muestra**
Captura real de `/mi-negocio/[id]` con datos de demo (hay negocios
sembrados: Steph Nails para Citas, y la familia `demo-*` para eventos).

**CTA**: `Ver el panel por dentro` → `/productos/reservas` (a crear)

**Rutas que alimenta**: `/mi-negocio/[id]` ✅ y sus hijas (`citas`,
`clientes`, `finanzas`, `precios`, `promos`, `reservas`, `asistente`)

**Producto real**: Business App + motor de módulos (`modulos.ts`, 0108)

**ACTUAL vs FUTURO** — de las seis etiquetas del anillo:

| Etiqueta | Estado |
|---|---|
| Reservas | ✅ CONSTRUIDO |
| Clientes | ✅ CONSTRUIDO (`fichas_cliente`) |
| Lealtad | ✅ CONSTRUIDO |
| Pagos | ✅ CONSTRUIDO |
| Analytics | ✅ CONSTRUIDO (métricas + Estadísticas de Lealtad) |
| **Marketing** | ⚠️ **PARCIAL** — las campañas existen, pero el módulo está `disponible: false` en el panel general |

Marketing se puede mostrar **si** la sección 8 lo demuestra desde
Lealtad, que es donde sí funciona. Mostrarlo como pestaña del panel
general sería prometer una pantalla que no se abre.

---

## 5. SECCIÓN — Presencia digital

**Qué aparece**
«Tu negocio tiene su propio espacio digital.» Embudo visual: Instagram ·
TikTok · Google · WhatsApp · QR → `bookea.lat/s/tu-negocio` → la página.

**Qué mockup muestra**
**`VistaPagina` renderizando una página real** dentro de
`src/components/solutions/telefono.tsx`. No es una captura: es el
producto corriendo dentro de la landing. Banco disponible:
`/s/prueba-solutions`.

**CTA**: `Crear mi página` → `/solutions/crear`

**Rutas que alimenta**: `/s/[slug]` ✅ · `/s/[slug]/menu` ✅ ·
`/solutions/crear` ✅ · `/productos/bookea-link` (a crear)

**Producto real**: Bookea Link (hoy Linksy) — 13 tablas `solutions_*`

**ACTUAL** — links ✅, menú por secciones ✅, pedidos armados con
personalización por plato ✅, planes Gratis/Pro ✅, dominio propio ✅,
21 países y 19 monedas ✅, Instagram Auto Reply ✅.

> 🔴 **Regla de marca**: en esta sección **no se escribe «Linksy» ni una
> vez** — y tampoco se vende «Bookea Link» como producto con nombre
> propio. De cara al cliente esto es, simplemente, **tu página de
> Bookea**. No hay marca nueva que aprender. `Bookea Link` queda como
> nombre técnico interno.
>
> El dominio `linksy.lat` sigue vivo redirigiendo, **para siempre**: hay
> QR impresos que lo llevan grabado (`arquitectura.md` §8).

---

## 6. SECCIÓN — Reservas

**Qué aparece**
«Tus clientes reservan. Vos administrás.» Agenda · Disponibilidad ·
Profesionales · Servicios · Recordatorios.

**Qué mockup muestra**
La agenda real de `/mi-negocio/[id]/citas` + la cara pública del calendario
de reserva. Piezas existentes a reusar: `escena-citas.tsx`
(`src/app/publicar/`), ya construida para el mockup móvil.

**CTA**: `Empezar a recibir reservas` → `/mi-negocio/nuevo`

**Rutas que alimenta**: `/citas/[slug]` ✅ · `/citas/[slug]/reservar` ✅ ·
`/eventos/[id]/reservar` ✅ · `/mi-negocio/[id]/citas` ✅

**Producto real**: el motor de agenda (`reservas`, `bloqueos_agenda`,
`horarios_recurso`, `lista_espera`, `src/lib/agenda/`)

**ACTUAL** — reserva instantánea ✅, equipo y horarios ✅, importación y
exportación de calendario por `.ics` ✅ (en las dos direcciones),
recordatorios ✅.
**FUTURO** — **mesas no existe** como recurso reservable: `?mesa=N` hoy
solo viaja en el QR. No prometer «reservá tu mesa».

---

## 7. SECCIÓN — Lealtad

Esta sección **crece** respecto del plan original, y con razón: Lealtad
no es una idea futura, es el producto más maduro del repo y el que tiene
clientes reales pagando.

**Qué aparece**
«Convertí clientes ocasionales en clientes frecuentes.» El ciclo:
Apple Wallet → Sellos → Puntos → Recompensas → Nueva visita.

**Qué mockup muestra**
El pase de Wallet como pantalla de teléfono — **ya está construido**: es
la composición de los mockups de Linksy (el pase dentro de `<Telefono>`).
Más la tarjeta pública `/tarjeta/[slug]`.

**CTA**: `Crear mi tarjeta` → `/lealtad/nuevo`

**Rutas que alimenta**: `/lealtad` ✅ · `/lealtad/nuevo` ✅ ·
`/lealtad/panel/[id]` ✅ · `/tarjeta/[slug]` ✅ · `/lealtad/planes` ✅ ·
`/lealtad/industrias/[slug]` ✅

**Producto real**: Bookea Lealtad (12+ tablas, Apple y Google Wallet, API
pública, campañas automáticas)

**ACTUAL** — sellos y puntos ✅, recompensas y canje ✅, Apple Wallet ✅
(con actualización automática probada en iPhone real), Google Wallet ✅,
Estadísticas con filtros y CSV ✅, moderadores ✅, agenda de reuniones de
ayuda ✅, configurador en vivo ✅.

**Banco de demo**: usar **PruebaCafé Aroma** o **«Prueba de Café»**.
**Nunca Pura Matcha ni Praia** — son clientes reales.

---

## 8. SECCIÓN — Clientes + Marketing

**Qué aparece**
«Conocé a tus clientes. Volvé a conectar con ellos.»
Ficha de cliente (reservas, compras, puntos, última visita hace 63 días)
→ flecha → automatización («Te extrañamos 👋 — 10% en tu próxima visita»).

**Qué mockup muestra**
La ficha real de `/mi-negocio/[id]/clientes/[clave]` al lado del editor de
campaña automática de Lealtad.

**CTA**: `Ver cómo funciona el CRM` → `/productos/clientes` (a crear)

**Rutas que alimenta**: `/mi-negocio/[id]/clientes` ✅ ·
`/mi-negocio/[id]/clientes/[clave]` ✅ · el panel de campañas de Lealtad ✅

**Producto real**: `fichas_cliente` (0228) + `personas` (0138) +
`campanas_lealtad` con automáticas (0226)

**ACTUAL** — la ficha ✅, la identidad sin cuenta ✅, las campañas
automáticas ✅ (el ejemplo «te extrañamos» **es una campaña que ya
existe**, no una idea).
**FUTURO** — el módulo `marketing` del panel general está
`disponible: false`. **Esta sección demuestra desde Lealtad**, que es
donde corre. Si el copy sugiere «campañas para cualquier negocio», se
está prometiendo el módulo que no abre.

Vale la pena que el copy cuente la parte que ningún competidor tiene:
**una persona no es una cuenta**. Quien escanea el QR, deja su WhatsApp y
se lleva el pase **es la misma persona** que mañana abre cuenta, con el
mismo saldo. Eso es `personas` y está en producción.

---

## 9. SECCIÓN — Para cada negocio

**Qué aparece**
«Bookea se adapta a tu negocio», en **cinco familias, no 17 tarjetas**:

| Familia | Tipos |
|---|---|
| Belleza | Barberías · Uñas · Salones · Spa · Masajes |
| Fitness | Gimnasios · CrossFit · Pilates · Yoga · Entrenador |
| Salud | Consultorios · Profesionales |
| Academias | Academias y clases |
| Eventos | Lugares · Proveedores · Hospedaje · Restaurantes |

Más un `Ver todos los tipos →`.

> Las familias **no se inventan acá**: son las de `modulos.ts`
> (`belleza`, `fitness`, `salud`, `academia`, `eventos`, `otro`). La
> sección se arma **leyendo ese archivo**, no con una lista escrita a
> mano en la landing. Así no se desincroniza nunca.

**Qué mockup muestra**
El mismo panel cambiando de forma según el tipo — que es literalmente lo
que hace `resolverModulos`. Es la demo más honesta del producto.

**CTA**: `Crear mi negocio` → `/mi-negocio/nuevo/[vertical]`

**Rutas que alimenta**: `/mi-negocio/nuevo/[vertical]` ✅ · `/publicar` ✅

**Producto real**: los 18 tipos y 20 módulos de `modulos.ts`

**ACTUAL** — los 18 tipos existen y el panel se arma solo ✅.
**FUTURO** — **no hay tipo `tienda`**. Si la landing dice «tiendas», está
vendiendo un rubro que el selector no ofrece. Entra agregando un tipo a
`modulos.ts`, no escribiéndolo en la portada.

---

## 10. SECCIÓN — Descubrir

**Qué aparece**
«Descubrí lugares y experiencias.» El buscador en cápsula + los rieles de
catálogo.

**Qué mockup muestra**
Nada de mockup: **la sección es el producto**. Se reusan
`buscador-hero.tsx` (la cápsula de cuatro tramos — la excepción de estilo
Airbnb confirmada por el dueño) y `rieles-catalogo.tsx`.

**CTA**: buscar, o `Ver todo` → `/descubrir` (a crear)

**Rutas que alimenta**: `/` ✅ · `/citas/[slug]` ✅ · `/eventos/[id]` ✅ ·
`/hospedajes` ✅ · `/restaurantes/[slug]` ✅

**Producto real**: Discover (`ranchos` por `vertical`)

**ACTUAL vs FUTURO** — ⚠️ la sección depende del inventario, **pero el
repo ya resolvió esto y no hay que inventar nada**.
`src/lib/carriles-home.ts` degrada la portada sola, en tres niveles por
vertical:

| Nivel | Cuándo | Qué dibuja |
|---|---|---|
| **A** | Hay negocios de sobra | Carriles por rubro |
| **B** | Hay negocios pero no alcanzan para carriles | Grilla quieta |
| **C** | No hay nada de esa vertical | **No dibuja la fila** |

Y la política de umbrales está razonada en el propio archivo:
`MIN_CARRIL = 3` para un rubro, «porque una fila "Uñas" con una sola
tarjeta, entre otras cinco filas llenas, grita que ese rubro está vacío».
Pero para las cuatro verticales el umbral es **1**, con este argumento:

> «Si Hospedajes tiene un solo negocio publicado, esconderlo significa
> que ese negocio —que pagó por estar— no aparece en la portada. La regla
> que sí se respeta es la otra: una vertical SIN negocios no dibuja su
> fila, en vez de un riel vacío con flechas muertas.»

**Consecuencia para el wireframe**: la sección **se puede publicar hoy
sin riesgo de verse vacía** — se apaga sola. Lo que el conteo real decide
no es si la sección va, sino **si Discover merece estar arriba del fold**
(§1). Verificar el conteo sigue siendo necesario para eso.

---

## 11. SECCIÓN — Celebrar

> **Celebrar es un producto aparte**, no un módulo de Bookea. Si aparece
> en el home, es como *«también existe esto»* — un enlace al final, nunca
> una de las capacidades de la plataforma. El home de Bookea no debe
> leerse como cinco productos compitiendo.

**Qué aparece**
«También podés crear experiencias con Bookea.» Invitaciones · RSVP ·
Álbumes · Eventos. Una banda al pie, no un bloque protagonista.

**Qué mockup muestra**
Una invitación real animada. Hay captura automatizada:
`scripts/celebrar-captura-invitacion.mjs`, y demos en `/celebrar/demos`.

**CTA**: `Conocé Celebrar` → `/celebrar`

**Rutas que alimenta**: `/celebrar` ✅ · `/celebrar/demos` ✅ ·
`/celebrar/plantillas` ✅

**Producto real**: Celebrar (14 tablas, 1 960 plantillas, créditos,
Stripe, partners)

**ACTUAL** — todo eso existe. **Pero está sin desplegar** (local, sin
commit), y convive con el producto viejo de invitaciones
(`/invitaciones`, `/i/[slug]`). **No se enlaza desde la portada hasta que
esté en producción y hasta que se decida cuál de los dos sobra**
(`arquitectura.md` §9.2).

---

## 12. SECCIÓN — Foorkie

**No va.** Por dos razones, y la segunda es la definitiva:

1. Nada está construido, y el alcance tiene preguntas abiertas (`arquitectura.md` §9.6). Publicarla sería exactamente lo que la regla 1 prohíbe.
2. **Foorkie es un producto aparte.** Aunque estuviera terminado, no sería una sección del home de Bookea.

Cuando exista, tendrá su propia entrada — no una pata en este home.

---

## 13. CTA final + footer

**Qué aparece**
«Empezá a construir tu negocio en Bookea.» / «Creá tu perfil, configurá
tus servicios y empezá a recibir clientes.» + [Crear mi negocio]

Footer: `SiteFooter` (ya existe) con `/politicas`, `/privacidad`,
`/terminos`, `/ayuda`.

**CTA**: `/mi-negocio/nuevo` ✅

**ACTUAL** — el recorrido completo funciona hoy de punta a punta:

```
crear negocio → elegir tipo → el panel se arma solo
     → bookea.lat/s/mi-negocio → el cliente reserva
     → la reserva entra al panel → la persona queda en el CRM
     → gana sellos → una campaña la trae de vuelta
```

---

## 14. Inventario de piezas reutilizables

Antes de dibujar nada, esto ya está construido y probado:

| Pieza | Dónde | Para qué sirve acá |
|---|---|---|
| `VistaPagina` | `src/components/solutions/vista-pagina.tsx` | Renderiza el producto vivo (sección 5) |
| `Telefono` | `src/components/solutions/telefono.tsx` | El marco del teléfono |
| `MockupsVivos` | `src/app/linksy/mockups-vivos.tsx` | Escenario con piezas que brotan, en perspectiva, con coreografía escalonada |
| `escena-citas` / `escena-eventos` | `src/app/publicar/` | Mockups de agenda y eventos |
| `BuscadorHero` | `src/components/home/buscador-hero.tsx` | La cápsula de cuatro tramos |
| `RielesCatalogo` | `src/components/home/rieles-catalogo.tsx` | Los rieles de Discover |
| `ComoFunciona` | `src/components/home/como-funciona.tsx` | La banda navy de tres pasos |
| `captura-panel-linksy.mjs` | `scripts/` | Capturas reales del panel |
| `celebrar-captura-invitacion.mjs` | `scripts/` | Capturas de invitación |

**El home nuevo se arma en su mayor parte con piezas que ya existen.** Lo
verdaderamente nuevo son el héroe B2B y los anillos de las secciones 4 y
7.

---

## 15. Lo que NO va (confirmado contra el repo)

| No va | Por qué |
|---|---|
| **Bookea Pay como producto** | Stripe existe como infraestructura, no como producto vendible |
| **Bookea Commerce como producto** | Los pedidos viven dentro de Link, y salen por WhatsApp |
| **Bookea Store / «tiendas»** | No existe el tipo `tienda` en `modulos.ts` |
| **Delivery e inventario** | `inventario` está `disponible: false`; delivery no existe |
| **Cinco rutas SEO nuevas de golpe** | `/descubrir`, `/productos/*`, `/precios`, `/recursos`, `/blog` — ninguna existe; `/precios` además está bloqueada por una decisión de cobro |
| **Reseñas, estrellas o «+N negocios»** | Cero reseñas en la base. Regla 2 |
| **«Reservá tu mesa»** | Mesas no es un recurso reservable |
| **Fusionar las tres entidades** | Fase 2, con plan propio |
| **Apagar `linksy.lat`** | QR impresos lo llevan grabado. Queda como redirect permanente, para siempre |
| **La palabra «Linksy» en la landing** | Dejó de existir como producto |
| **Vender «Bookea Link» como marca** | De cara al cliente es «tu página de Bookea». Sin marca nueva que aprender |
| **Celebrar o Foorkie como capacidades de Bookea** | Son productos aparte: comparten infraestructura, no interfaz |

---

## 16. Antes de dibujar: tres cosas que verificar

1. **¿Cuántos negocios publicados hay hoy en producción?** Define si Discover va arriba, abajo o afuera (§10). Es el único dato que puede invertir la recomendación de §1.
2. **¿Cómo se cobra el paquete completo?** Sin eso no hay `/precios` (§2).
3. **¿Celebrar se despliega antes o después del rediseño?** Define si la sección 11 se publica o se guarda.

---

## 17. Nota aparte: `CLAUDE.md` quedó desactualizado

Las instrucciones del proyecto señalan
`src/components/home/nav-categorias.tsx` como la excepción de la cápsula
estilo Airbnb. **Ese archivo ya no existe**: la cápsula vive hoy en
`src/components/home/buscador-hero.tsx` («una cápsula de cuatro tramos»).
La decisión sigue vigente; el puntero no. Conviene corregirlo antes de
que alguien la «arregle» por error.

---

*Siguiente paso, cuando esto se apruebe: el diseño visual, sección por
sección, sobre este esqueleto.*
