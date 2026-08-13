# Fundación visual y de movimiento de Bookea

Base reutilizable para todas las pantallas. Vive en
[`src/app/globals.css`](../src/app/globals.css) (tokens y utilidades) y en dos
componentes de servidor. **No hay dependencias nuevas**: no se instaló ninguna
librería de animación porque CSS alcanza.

---

## 1. Color — y su alcance

> ⚠️ **La identidad de Bookea aplica SOLO dentro de Lealtad.** El resto del sitio
> (marketplace, mi-negocio, invitaciones, admin) conserva su paleta sin cambios.

**Cómo funciona.** Todo el color del repo son alias de siete variables (`--navy`,
`--orange`, `--muted`…). El layout [`src/app/lealtad/layout.tsx`](../src/app/lealtad/layout.tsx)
envuelve el módulo en `.lealtad`, y ahí esas siete variables se **re-declaran**.

La consecuencia práctica: **cualquier componente que ya existe adopta la paleta de
Lealtad con solo entrar en ese contenedor.** Sin duplicarlo, sin un prop `variante`,
sin tocar su JSX. La alternativa era clonar componentes con clases nuevas — la
duplicación que el proyecto prohíbe, y que en un mes se separa en dos copias.

| Rol | Token Tailwind | Dentro de `.lealtad` | Fuera |
|---|---|---|---|
| Azul principal | `bookea-azul` | `#062653` | `#16295E` |
| Naranja de acción | `bookea-naranja` | `#FF6A00` | `#EE7420` |
| Gris descriptor | `bookea-gris` | `#53657F` | `#585858` |
| Fondo claro | `bookea-fondo` | `#F5F7FA` | `#F6F6F6` |
| Bordes | `bookea-linea` | `#DFE5EE` | `#E2E2E2` |
| Tinta | `bookea-tinta` | `#10203A` | `#161616` |
| Fondos oscuros | `bookea-azul-profundo` / `-elevado` | `#041A3A` / `#0B3168` | — |

**Nunca hardcodear un hex en JSX**: rompe el scope y el componente deja de adaptarse.

### La regla del naranja (importante)

El naranja de marca **no pasa contraste como texto ni con letra blanca encima**.
Medido:

| Combinación | Contraste | Veredicto |
|---|---|---|
| `#FF6A00` como texto sobre blanco | 2.87:1 | ❌ reprueba AA |
| Blanco sobre `#FF6A00` | 2.87:1 | ❌ reprueba AA |
| **Azul `#062653` sobre `#FF6A00`** | **5.19:1** | ✅ |
| **`bookea-naranja-fuerte` sobre blanco** | **6.22:1** | ✅ |
| Gris descriptor sobre blanco | 5.94:1 | ✅ |
| Azul sobre blanco | 14.89:1 | ✅ |

Entonces:

- **Botón naranja → letra azul**, no blanca.
- **Naranja como texto** (precios, enlaces, kickers) → `bookea-naranja-fuerte`.
- ¿Hace falta relleno naranja con letra blanca? → `bookea-naranja-fuerte`.

```tsx
// ✅ botón de acción
<button className="presionable rounded-xl bg-bookea-naranja px-5 py-3 font-bold text-bookea-azul">
  Reservar
</button>

// ✅ precio
<span className="font-extrabold text-bookea-naranja-fuerte">₡25 000</span>
```

## 2. Tipografía

**Montserrat** en Lealtad; **Figtree** en el resto de Bookea.

Montserrat se carga en [`lealtad/layout.tsx`](../src/app/lealtad/layout.tsx), no en
el raíz: así el marketplace ni siquiera descarga la familia. La cascada de
`.lealtad` la aplica, con Figtree de respaldo.

Para títulos, la utilidad `titulo` (peso 800 + interletrado cerrado) en vez de
repetir `font-extrabold tracking-tight` en cada encabezado.

## 3. Espaciado, radios y sombras

**Espaciado:** la escala de Tailwind, sin tokens propios. Inventar una segunda
escala solo agrega una tabla de equivalencias que nadie recuerda.

**Radios** (ya existían, se documentan): chips `rounded-lg` 8px · botones e inputs
`rounded-xl` 12px · cards `rounded-2xl` 14px · bloques `rounded-3xl` 18px · modales
`rounded-4xl` 24px. `rounded-full` **solo** para círculos de verdad.

**Sombras:** tres niveles, todas del azul de marca con alfa (una sombra gris sobre
fondo azulado se ve sucia).

| Token | Uso |
|---|---|
| `shadow-plano` | card en reposo |
| `shadow-elevado` | card en hover |
| `shadow-flotante` | modales, menús, hojas |

## 4. Movimiento

Tres duraciones y **una sola curva** — un sistema con cinco easings se siente
descoordinado.

| Token | Valor | Para |
|---|---|---|
| `--duracion-micro` | 200 ms | hover, press, focus, chips |
| `--duracion-card` | 300 ms | cards, acordeones, pasos |
| `--duracion-revelado` | 420 ms | entrada de secciones |
| `--ease-bookea` | `cubic-bezier(0.22, 1, 0.36, 1)` | todo |

Todo anima **solo `transform`, `opacity`, color y sombra**. Nada que dispare
layout.

### Utilidades

| Clase | Qué hace |
|---|---|
| `elevar` | Sube 3px + escala 1.015 en hover; se hunde al presionar. Para cards. |
| `presionable` | Escala 0.98 al presionar, sin desplazamiento. Para botones y controles. Incluye el estado `:disabled`. |
| `esqueleto` | Barrido de carga. La **forma** la pone quien lo usa. |
| `pasos` / `paso` | Transición entre pasos de un asistente, sin salto de altura. |
| `desplegable` | Expandir y contraer **sin animar `height`**. |

```tsx
<article className="elevar rounded-2xl border border-bookea-linea bg-white p-5 shadow-plano">…</article>
```

**Expandir/contraer** usa `grid-template-rows: 0fr → 1fr`, que el navegador sí
interpola — no hace falta medir el contenido ni inventar un `max-height`:

```tsx
<div className="desplegable" data-abierto={abierto}>
  <div><p>Contenido que crece y se achica solo.</p></div>
</div>
```

**Pasos** apila todo en una celda de grid 1×1, así el contenedor mide el paso más
alto y no salta al cambiar. Estados: `entrando`, `activo`, `saliendo`.

```tsx
<div className="pasos">
  {etapas.map((e) => (
    <div key={e.id} className="paso" data-estado={estadoDe(e)}>{e.contenido}</div>
  ))}
</div>
```

### Revelado al hacer scroll

El `IntersectionObserver` ya existe y es **uno solo para toda la página**
([`RevealOnScroll`](../src/components/reveal-on-scroll.tsx), montado en el layout).
No crear otro.

Para marcar un elemento con escalonado:
[`<Revelar>`](../src/components/revelar.tsx) — componente de **servidor**, así que
revelar una grilla de 30 cards no manda un byte de JS extra.

```tsx
{negocios.map((n, i) => (
  <Revelar key={n.id} indice={i}><CardNegocio negocio={n} /></Revelar>
))}
```

Cuando el `div` extra rompa una grilla, usar el helper sobre el elemento propio:

```tsx
<li data-reveal style={estiloRevelado(i)}>…</li>
```

Escalonado de 60 ms, **topado en 320 ms**: sin tope, el elemento 30 esperaría 1,8 s
y eso se lee como lentitud, no como estilo.

> ⚠️ El contenido nace **visible**. Si el JS no corre, se ve todo igual y solo se
> pierde la animación. Nunca usar esto para ocultar algo por otra razón.

## 5. Accesibilidad

- **Foco visible** en todo lo enfocable **dentro de Lealtad**, vía `:focus-visible`
  (anillo al navegar con teclado, no al hacer clic). Sobre fondo oscuro, envolver en
  `.sobre-oscuro` y el anillo se vuelve blanco. Está scopeado a propósito: global
  cambiaría el foco de todo el sitio, fuera del alcance del módulo.
- **`prefers-reduced-motion`** apaga los desplazamientos, no la interfaz: los
  cambios de color y el anillo de foco siguen, porque son información.
- Contraste: ver la tabla del naranja arriba.

## 6. Qué NO hacer

- No instalar una librería de animación. No hay ninguna y CSS alcanza.
- No crear otro `IntersectionObserver`.
- No duplicar los esqueletos: las piezas están en
  [`src/app/esqueleto.tsx`](../src/app/esqueleto.tsx).
- No animar `height` ni `width`.
- No hardcodear hex en componentes.
