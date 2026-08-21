---
name: ui-ux-expert
description: Usá este skill antes de tocar cualquier pantalla, componente, animación o estado de carga/vacío de Bookea, y cada vez que te pidan revisar, auditar o darle una pasada de calidad a una UI ya hecha ("¿se ve bien?", "revisá el diseño", "QA visual", "¿quedó responsive?"). Aplica el criterio real del repo — color/contraste, interacción, motion, microinteracciones, responsive y protocolo de QA visual — con cita a los archivos que ya lo auditaron, no principios genéricos de diseño.
---

Sos quien revisa y diseña la interfaz de Bookea con el mismo criterio que
ya está construido en el repo — no traés reglas de afuera, las aplicás y
las hacés cumplir. Bookea tiene un sistema de diseño real, medido en WCAG
y documentado con el porqué de cada decisión; la mayoría de los defectos
visuales que vas a encontrar no son "mal gusto", son una pantalla que no
usó el sistema que ya existe.

## 0 · El mapa — leé la fuente, no la copies

No hay valores repetidos en este documento porque los valores cambian y
este documento no. Antes de juzgar o escribir CSS/clases nuevas, leé:

- **[docs/fundacion-visual.md](../../../docs/fundacion-visual.md)** — color y su alcance (marketplace vs. `.lealtad`), tipografía, espaciado/radios/sombras, movimiento, accesibilidad. La base de TODO el sitio.
- **[src/components/panel/sistema.ts](../../../src/components/panel/sistema.ts)** — la extensión para `/mi-negocio`, `/lealtad/panel`, `/cuenta`: contraste medido par por par, estados semánticos, botones, tiles.
- **[src/components/panel/piezas.tsx](../../../src/components/panel/piezas.tsx)** — los componentes de servidor armados con lo de arriba (Card, Metrica, FilaPanel, esqueletos que calzan con lo real).
- **[src/lib/business/identidad.ts](../../../src/lib/business/identidad.ts)** — el catálogo de 8 acentos por tipo de negocio, con `ratioContraste()` para no aprobar un color a ojo.
- **[src/app/globals.css](../../../src/app/globals.css)** — de acá salen los `@theme`/`@utility` reales: `titulo`, `elevar`, `presionable`, `esqueleto`, `pasos`/`paso`, `desplegable`, el bloque `.lealtad :focus-visible`, y las `@keyframes` puntuales de cada pantalla.
- **[mobile/src/components/ui.tsx](../../../mobile/src/components/ui.tsx)** y **`mobile/src/lib/theme.ts`** — el mismo vocabulario, versión React Native.
- **[.claude/agents/disenador-invitaciones.md](../../agents/disenador-invitaciones.md)** — el estándar (más maximalista) para invitaciones full-screen; no lo apliques fuera de `/i/{slug}`.

Si vas a inventar un hex, un radio o una duración nueva: no. Todo sale de
acá o se audita antes de entrar. **Nunca hardcodear un hex en JSX** — es
la regla más repetida del repo porque romperla rompe el scope de
`.lealtad` y el componente deja de adaptarse.

## 1 · Criterio visual (color, contraste, tipografía, espacio)

- **El color tiene alcance, no es global.** Fuera de `.lealtad` el sitio
  usa su paleta de siempre (navy `#16295e`, naranja como acento). Dentro
  de `.lealtad` las mismas siete variables se re-declaran (navy
  `#062653`, fondo `#F5F7FA`…) y **todo componente existente hereda la
  paleta nueva solo por estar en ese contenedor** — si ves a alguien
  clonar un componente con clases `lealtad-*` en vez de confiar en el
  scope, es la duplicación que el proyecto prohíbe.
- **La acción es azul; el naranja es acento, nunca relleno de un CTA.**
  Medido pixel a pixel sobre el logo: 99,8 % navy, 0,18 % naranja. Un
  botón primario naranja está repitiendo un bug que ya estuvo en
  producción (`#FF6A00` con letra blanca = 2,87:1, reprobado). El naranja
  de marca real es `#f39200`, y sobre blanco da 2,35:1 — **no pasa ni el
  3:1 de un elemento de UI**, por eso solo vive como texto
  (`--orange-fuerte`, 6,22:1) o como acento sobre fondo oscuro.
- **Un par de color siempre trae su fondo Y su letra decididos juntos.**
  No hay "el azul de acción": hay `--accion` sobre claro y
  `--accion-claro` sobre navy, porque el mismo azul no sirve para las dos
  superficies (`--accion` sobre navy da 1,44:1 — el botón que se traga
  la franja). Si estás poniendo un color sobre un fondo nuevo, buscá el
  par ya medido antes de inventar uno.
- **Prohibido usar alfa para marcar un estado** (`text-white/60`,
  `bg-white/[.06]`): el mismo estado se lee de contraste distinto según
  lo que haya detrás y no se puede auditar una sola vez. `sistema.ts`
  reemplazó todos los `text-white/60` del rail por `--color-aventurea-rail`
  sólido por esta razón exacta — si ves un alfa nuevo marcando estado
  (no decoración), es una regresión al patrón que ya se corrigió.
- **El acento del tipo de negocio marca estado, acción y disco de
  ícono — nunca decoración genérica.** Los 8 acentos de `identidad.ts`
  están auditados (`tinta` ≥6,22:1, `sobreSolido` sobre `solido`
  ≥5,18:1); usalos vía `var(--acento…)`, nunca un hex suelto "parecido".
- **Radios**: chips 8px · botones/inputs 12px · cards 14px · bloques
  18px · modales 24px. `rounded-full` solo para círculos de verdad
  (avatares, puntos, contadores).
- **Sombras**: tres niveles nada más (`shadow-plano`/`elevado`/`flotante`),
  todas azul de marca con alfa — una sombra gris sobre fondo azulado se
  ve sucia.
- **Una tarjeta sin dato real es peor que una tarjeta de menos.**
  `Metrica` (piezas.tsx) no tiene tendencia salvo que exista el cálculo
  real detrás; no rellenes un hueco visual con un cero o un `--` que
  parezca un dato. Mismo principio detrás de `CardVacia`: decí qué va a
  aparecer ahí, no simules que ya hay algo.
- **La jerarquía la hacen tamaño y peso, no colorear cada número.**
  Cuando los montos del panel iban en naranja, la mitad de una fila
  gritaba a 2,94:1. La cifra va siempre en la tinta más fuerte
  disponible; el color se reserva para estado.

## 2 · Interacción (hover, focus, press, disabled)

- **`elevar`** (globals.css) para cards: sube 3px en hover, se hunde al
  presionar. El límite es 3px a propósito — más se siente un juguete y
  el borde pelea con la sombra.
- **Nunca combines `scale()` en hover con `will-change: transform` en el
  mismo elemento**: la capa se rasteriza una vez a 1× y escalarla
  difumina el texto (pasó de verdad: "al pasar el mouse se nublan los
  textos"). Si necesitás dar énfasis en hover, usá `translateY`, no
  `scale`, salvo que aceptes el costo de sacar `will-change` y
  re-rasterizar cada cuadro.
- **`presionable`** para botones y controles: `scale(0.98)` solo al
  presionar (`:active:not(:disabled)`), sin desplazamiento. Incluye el
  estado `:disabled` (cursor `not-allowed`, opacity 0.45) — no reinventes
  un disabled con solo `opacity-50` suelto si el control es interactivo.
- **Foco visible** con `:focus-visible` (no `:focus`, para que el anillo
  salga solo navegando con teclado) está **scopeado a `.lealtad`**
  (`globals.css:201`). Fuera de ese módulo no hay una garantía
  equivalente todavía — si tocás un control interactivo fuera de
  Lealtad, verificá con Tab que el navegador no lo esté dejando sin
  contorno de foco (no asumas que "ya está resuelto en otro lado").
  Sobre fondo oscuro envolvé en `.sobre-oscuro`: el anillo pasa a blanco.
- **Área táctil ≥44px** en todo lo tocable — regla explícita del
  estándar de invitaciones, aplicable a cualquier control nuevo pensado
  para teléfono.
- **El hover no existe en el teléfono.** Si una interacción vive solo en
  `:hover`, duplicá el gesto con un handler de toque o perdés la mitad
  de la funcionalidad en móvil.

## 3 · Motion (timing y curva del sistema)

Tres duraciones, una sola curva. Un sistema con cinco easings se siente
descoordinado — literal, es la razón documentada:

| Token | Valor | Para |
|---|---|---|
| `--duracion-micro` | 200ms | hover, press, focus, chips |
| `--duracion-card` | 300ms | cards, acordeones, pasos |
| `--duracion-revelado` | 420ms | entrada de secciones al hacer scroll |
| `--ease-bookea` | `cubic-bezier(0.22, 1, 0.36, 1)` | todo, sin excepción |

**Se anima SOLO `transform`, `opacity`, `color` y `sombra` — nunca algo
que dispare layout** (`height`, `width`, `top`, `left`). Para
expandir/contraer existe `desplegable` (`grid-template-rows: 0fr → 1fr`,
que el navegador interpola sin medir contenido ni inventar `max-height`).
Para un wizard sin salto de altura existe `pasos`/`paso` (todas las
etapas apiladas en una celda de grid 1×1). No reinventes ninguna de las
dos a mano.

**Cómo se ve una violación real (dos que están hoy en el repo, para que
sepas reconocer el patrón):**
- `booking-bottom-sheet.tsx` anima con `duration-[260ms]` y `ease-out` —
  una cuarta duración fuera del set canónico y la curva por defecto de
  Tailwind en vez de `--ease-bookea`. Además hardcodea
  `bg-[rgba(10,18,42,0.55)]` en vez de un token.
- `chat-flotante.tsx` entra con `anim-panel-entrar`
  (`cubic-bezier(0.16, 1, 0.3, 1)`, `globals.css:1066`) — una **segunda
  curva** conviviendo con `--ease-bookea`, no documentada. El mismo
  archivo además marca una pestaña inactiva con `text-white/60` a pocas
  líneas de un comentario que explica por qué esa técnica se abandonó en
  otro botón del mismo componente por bajo contraste.
- Ninguno de los componentes interactivos más vivos del sitio
  (`booking-bottom-sheet.tsx`, `chat-flotante.tsx`, `check-in-panel.tsx`)
  usa `elevar`/`presionable`/`desplegable`: todos reinventan con
  `transition-colors`/`transition-shadow` sueltos, sin `duration-*` ni
  `ease-*` explícitos — lo que significa que corren con los valores de
  fábrica de Tailwind (150ms, curva por defecto), no con el sistema.
  **No copies este patrón como si fuera el ejemplo a seguir**: es deuda,
  no estilo. Si tocás uno de estos archivos, es la oportunidad de
  migrarlo al sistema real.

**`prefers-reduced-motion`** apaga desplazamientos, nunca la interfaz: el
cambio de color y el anillo de foco siguen existiendo, porque son
información, no adorno. Cualquier `@keyframes` nueva en `globals.css`
necesita su bloque `@media (prefers-reduced-motion: reduce)` — es el
patrón repetido en cada animación puntual del archivo (búsqueda rápida:
son más de cinco bloques iguales, uno por animación con nombre propio).

## 4 · Microinteracciones — vocabulario ya construido

- **Revelado al hacer scroll**: un solo `IntersectionObserver` para toda
  la página (`RevealOnScroll`, montado en el layout) — nunca crear otro.
  Para marcar un elemento propio usá `<Revelar indice={i}>` (componente
  de servidor, cero JS extra) o `data-reveal` + `estiloRevelado(i)` a
  mano. El contenido nace **visible**; si el JS no corre, se pierde solo
  la animación, nunca el contenido. Escalonado de 60ms por elemento,
  **topado en 320ms** — sin tope, el ítem 30 de una grilla espera 1,8s y
  eso se lee como lentitud, no como estilo.
- **Esqueleto que calca la forma real.** `EsqueletoMetrica`/
  `EsqueletoCardPanel` (piezas.tsx) usan las MISMAS constantes de radio
  y padding que el componente real — si el esqueleto mide distinto, la
  página salta al llegar el contenido (regresión de CLS medible, no solo
  estética) y la espera se siente peor que un spinner liso. Un esqueleto
  nuevo que no reutiliza `SUPERFICIE_PANEL`/`RADIO_*` está mal hecho por
  definición.
- **Estado optimista con overlay por id**, no un spinner de pantalla
  completa: `check-in-panel.tsx` sobreescribe la fila que cambió
  (`sobreescritos`) y muestra el spinner solo en esa fila
  (`enProceso === f.id`) — la persona sigue viendo el resto de la lista
  mientras una fila procesa.
- **El video/cámara se oculta con `hidden`, no se desmonta.**
  `escaner-panel.tsx` mantiene el `<video>` siempre montado para evitar
  el flash negro del primer frame — aplica el mismo truco a cualquier
  cosa costosa de inicializar (cámara, mapa, reproductor).
- **Doble `requestAnimationFrame` para animar una entrada que empieza
  montada cerrada.** `booking-bottom-sheet.tsx` sincroniza
  `montado`/`visible` en el render y espera dos rAF antes de animar a
  "abierto" — sin esto, el navegador coalesce el primer frame y el panel
  aparece sin deslizar. Es el patrón correcto para cualquier
  entrar/salir controlado por estado de React sobre un elemento que
  arranca en el DOM ya "cerrado".
- **Loop infinito en GPU con pausa al pasar el mouse**: el desfile de
  invitaciones (`globals.css`, `.anim-mini-inv-desfile`) usa
  `translate3d` (no `translateX`) para subir la capa al compositor —
  importa en celular con scroll activo — y se pausa en `:hover` para que
  se pueda mirar con calma. Cualquier animación infinita de fondo debería
  tener esa misma pausa.
- **Modal con vidrio, formulario sólido.** El patrón `.modal-vidrio`
  vuelve translúcidas las superficies del modal para que el fondo se vea
  borroso a través, PERO el panel de formulario adentro (`.panel-solido`)
  se fuerza blanco sólido — el vidrio translúcido marea cuando se están
  llenando datos. Si un modal nuevo pide vidrio, el formulario adentro no
  lo hereda gratis.
- **La píldora que se vuelve punto, sin borrar el texto para lectores de
  pantalla.** `PildoraEstado colapsa` (piezas.tsx) convierte el texto
  ("Confirmada") en un punto de 8px por debajo de `sm`, pero el texto
  sigue en el árbol como `sr-only` — nunca `hidden`, porque eso sí lo
  borraría del todo. Este es el patrón de referencia para "esto no entra
  en 390px": colapsar visualmente, no accesiblemente.

## 5 · Responsive — el breakpoint real es `lg`, no `md`

- **El patrón dominante de grillas** (30+ apariciones) es
  `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (o `lg:grid-cols-4`):
  `sm` es un paso intermedio, **`lg` (1024px) es donde de verdad cambia
  el layout**. `md:` es casi inexistente en el repo (un solo archivo lo
  usa) — si estás por escribir `md:algo`, probablemente el patrón que
  buscás es `lg:`.
- **El rail de panel (`/mi-negocio`, `/lealtad/panel`, admin) se
  colapsa en un selector desplegable inline en móvil, NO en un overlay
  de pantalla completa tipo hamburguesa.** `panel-sidebar.tsx`: el menú
  de escritorio es `hidden lg:block`, y por debajo de `lg` aparece un
  botón que despliega la misma lista justo debajo, en el flujo normal
  de la página. Si un rail nuevo necesita versión móvil, este es el
  patrón a copiar — no un `<Dialog>` de pantalla completa.
- **El header del sitio (`site-header.tsx`) es deliberadamente simple**:
  no tiene rail propio, solo esconde/muestra texto con `sm:` (el
  breadcrumb, el CTA "Publicá tu espacio"). No le agregues la
  complejidad del rail de panel — son casos distintos a propósito.
- **Diseñá para 390px primero cuando el contenido es denso** (una fila
  con hora + estado + monto no tiene margen para desbordar) — es la
  regla explícita de invitaciones y aplica en cualquier fila de listado
  del panel: por eso `GRILLA_METRICAS` (sistema.ts) fuerza 2 columnas en
  teléfono SIEMPRE y nunca 3 — a 3 columnas un monto en colones no tiene
  dónde partirse.
- **Paridad con la app móvil es una disciplina manual entre dos
  proyectos npm separados**, no algo que el build verifique. Si tu
  cambio toca una pantalla con contraparte conocida en `mobile/`
  (agenda, check-in, lealtad, buscador), abrí el archivo espejo y
  decidí a propósito si necesita el mismo cambio — no lo dejes como
  deuda silenciosa. Hay un caso admitido así en
  `docs/citas-roadmap.md:149` ("Falta la paridad móvil"); no sumes otro
  sin decirlo.
- **La paleta y los radios NO calzan 1:1 con móvil todavía**: dentro de
  Lealtad, la web usa `#062653` pero `mobile/src/lib/theme.ts` sigue en
  el navy genérico `#16295e` (React Native no tiene scope de CSS custom
  properties, así que el mecanismo de `.lealtad` no tiene equivalente
  nativo). La escala de radios de móvil (8/10/14/20) tampoco calza con
  la web (8/12/14/18/24) — falta el escalón de 12px de botones. Si estás
  tocando una pantalla de Lealtad en móvil, esto ya es una divergencia
  conocida, no algo que tengas que "arreglar" sin que te lo pidan — pero
  sí algo que hay que reconocer, no repetir en un componente nuevo.
- **Móvil no tiene el vocabulario de motion todavía**: `ui.tsx` no usa
  `Animated`/`Reanimated` en ningún componente — el feedback de toque es
  un cambio binario de `opacity`, sin transición. No asumas que un
  timing/easing del lado web tiene equivalente nativo listo para copiar.

## 6 · Protocolo de QA visual — no hay red de seguridad automática

Confirmado: no existe test visual, ni de regresión, ni de accesibilidad
automatizado en este repo (sin Playwright/Puppeteer-para-UI/Chromatic,
sin `eslint-plugin-jsx-a11y`, cero `*.test.tsx` — los `*.test.ts` que
hay son de lógica de negocio, no de render). El único harness real
(`scripts/rendimiento/`, ver [docs/rendimiento.md](../../../docs/rendimiento.md))
mide performance (LCP/CLS/TBT), no apariencia. **Esto quiere decir que
vos sos la QA visual** — mirar la pantalla renderizada no es opcional
para un cambio de UI, es el único chequeo que existe. Nada de lo de
abajo es generalizable desde otro sitio del repo: hoy solo
`disenador-invitaciones.md` define un protocolo de anchos, y es
específico de `/i/{slug}`. Generalizalo vos mismo cada vez:

1. **Levantá el dev server y abrilo en el navegador** (`npm run dev`) —
   es la regla del proyecto para cualquier cambio de UI, y acá no hay
   atajo posible.
2. **Probá en tres anchos**: 390px (el piso real del tráfico), 768px, y
   1440px. Nada de scroll horizontal en ninguno.
3. **Recorré los estados a mano**: hover, focus (con Tab, no con clic —
   `:focus-visible` es lo que importa), `:active` al presionar, y
   `disabled`. Nada de esto lo cubre un test.
4. **Activá "reduced motion"** (DevTools → Rendering → Emulate CSS
   media feature `prefers-reduced-motion: reduce`) y confirmá que las
   animaciones de entrada desaparecen pero el color y el foco siguen
   funcionando.
5. **Si tocaste color**, no lo apruebes a ojo: buscá el par en
   `sistema.ts`/`fundacion-visual.md`, o corré `ratioContraste()` de
   `identidad.ts` contra el hex nuevo antes de darlo por bueno.
6. **Si agregaste un esqueleto**, ponelo al lado del contenido real y
   confirmá que mide igual — un salto acá es una regresión de CLS, no
   un detalle.
7. **Si la pantalla tiene contraparte en `mobile/`**, abrila y decidí a
   propósito si necesita el mismo cambio (sección 5).
8. **Si no podés confiar en lo que ves leyendo el código**, usá el skill
   `run` para levantar la app de verdad y mirar/capturar la pantalla en
   vez de asumir desde el diff.

## Checklist rápido — señales de que algo no sigue el sistema

- Un hex nuevo en JSX que no sale de un token.
- `text-white/60` o cualquier alfa marcando estado (no decoración).
- Una duración que no es 200/300/420ms, o una curva que no es
  `--ease-bookea`.
- `transition`/`animate` en `height`, `width`, `top` o `left`.
- Un botón de acción relleno en naranja.
- Un `<Dialog>`/overlay de pantalla completa para colapsar un rail en
  móvil (el patrón del repo es el selector inline, no el overlay).
- Un esqueleto que no usa las mismas constantes de radio/padding que el
  componente real.
- Un `IntersectionObserver` nuevo para reveal-on-scroll (ya existe uno).
- Un dato inventado (tendencia, cifra) para que una tarjeta no se vea
  vacía.
- Un componente interactivo sin `elevar`/`presionable` que reinventa su
  propia transición suelta.
- Un cambio a una pantalla con espejo conocido en `mobile/` sin abrir
  ese archivo para decidir la paridad.
