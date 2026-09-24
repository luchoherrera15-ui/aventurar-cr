import type { ReactNode } from "react";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL LENGUAJE DEL HOME — medido contra take.app, no a ojo
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (23 sep 2026), con take.app en pantalla: «mirá cómo
 * está: directa, poco TEXTO, TÍTULOS GRANDES Y MOCKUPS EXPLICATIVOS.
 * Quiero que bookea.lat se vea así».
 *
 * Lo que se midió en esa página, y que este archivo convierte en regla:
 *
 *   · El `h1` y TODOS los `h2` miden lo MISMO: 48 px, interletrado
 *     −0.025em, interlínea 1.1. No hay jerarquía por tamaño entre el
 *     héroe y las secciones — cada sección grita igual de fuerte.
 *   · La bajada es UNA sola frase: 20 px, gris, centrada, y no pasa de
 *     unos 576 px de ancho aunque la pantalla sea de 1440.
 *   · 96 px de aire arriba y abajo de cada sección.
 *   · Fondos alternados: blanco, gris muy claro, blanco…
 *   · Todo CENTRADO. Nada de dos columnas con el texto a un lado.
 *   · La sección mide 1400–1600 px de alto con 25–60 palabras: el que
 *     ocupa el espacio es el MOCKUP, no el texto.
 *
 * ── LA REGLA DE TEXTO QUE SE SIGUE ACÁ ──────────────────────────────
 *
 *   Título: 6 palabras o menos.  Bajada: 20 palabras o menos.
 *
 * Y una consecuencia importante para este proyecto: la honestidad ya
 * NO vive en un recuadro aparte de «hasta acá llega». Vive DENTRO de
 * la única frase. «Te llegan por WhatsApp, listos para preparar» dice
 * la verdad y vende, en el mismo renglón. El recuadro de letra chica
 * era la forma de ser honesto cuando sobraba texto; con una sola frase,
 * el límite ES el mensaje.
 *
 * `titulo` (globals.css) ya trae Figtree 800 con −0.025em: el
 * interletrado de la marca y el de take.app coinciden, así que no hubo
 * que inventar nada.
 */

/** 48 px arriba, encogiendo parejo hasta el teléfono. */
export const TITULO_GRANDE =
  "titulo text-balance text-[clamp(32px,5.4vw,48px)] leading-[1.08] text-[color:var(--tinta)]";

/**
 * El encabezado de una sección: rótulo chico, título grande, una frase.
 *
 * `children` es la bajada y es OPCIONAL a propósito: hay secciones que
 * se explican con el mockup y no necesitan ni una línea.
 */
export function Encabezado({
  rotulo,
  titulo,
  children,
}: {
  rotulo: string;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[760px] text-center">
      <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
        {rotulo}
      </p>
      <h2 className={`mt-4 ${TITULO_GRANDE}`}>{titulo}</h2>
      {children ? (
        // 576 px es el ancho medido de la bajada de take.app. No es un
        // número arbitrario: una línea de texto gris que cruza 1200 px
        // se lee como un párrafo de documento, no como una promesa.
        <p className="mx-auto mt-5 max-w-[576px] text-pretty text-[17px] leading-relaxed text-[color:var(--tinta-suave)] sm:text-[20px]">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Una sección: 96 px de aire, siempre sobre papel blanco.
 *
 * ── SE FUERON LOS FONDOS ALTERNADOS (dueño, 23 sep 2026) ────────────
 *
 * «Fondo blanco, cards un poco más oscuros que el blanco del fondo.»
 *
 * Antes las secciones alternaban blanco y gris para marcar el ritmo.
 * Ahora TODAS son blancas y el ritmo lo marca la TARJETA: el único
 * salto de color de la página es el de `--superficie` contra el papel.
 * Con un solo salto, ese salto se nota — que es justo lo que hace que
 * el mockup se lea como un objeto apoyado sobre la página.
 *
 * `fondo` sobrevive por compatibilidad con las secciones que ya lo
 * pasaban, pero hoy no cambia nada. Se deja para no tocar diez
 * archivos por un prop que probablemente vuelva.
 */
export function Seccion({
  children,
  id,
}: {
  children: ReactNode;
  fondo?: "blanco" | "gris";
  id?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 bg-[color:var(--papel)] px-5 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px]">{children}</div>
    </section>
  );
}

/**
 * El escenario del mockup: centrado, ancho y con aire arriba.
 *
 * `ancho` no es un capricho de maquetación — decide qué tan cerca se
 * mira el producto. Un teléfono pide poco ancho; una pantalla de panel
 * pide todo el que haya.
 */
export function Escenario({
  children,
  ancho = "amplio",
}: {
  children: ReactNode;
  ancho?: "telefono" | "medio" | "amplio";
}) {
  const max =
    ancho === "telefono"
      ? "max-w-[300px]"
      : ancho === "medio"
        ? "max-w-[640px]"
        : "max-w-[900px]";
  return <div className={`mx-auto mt-12 w-full ${max} sm:mt-14`}>{children}</div>;
}

/**
 * La nota al pie de una demostración.
 *
 * Sigue existiendo —si se enseñan datos inventados hay que decirlo—
 * pero ahora es UNA línea chica y centrada, no un recuadro.
 */
export function NotaDemo({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-5 max-w-[520px] text-center text-[13px] text-[color:var(--tinta-suave)]">
      {children}
    </p>
  );
}

/**
 * Dos o más escenas que SE REEMPLAZAN en el mismo lugar.
 *
 * Pedido del dueño (24 sep 2026): «primero que salga lo de cuando
 * alguien está agendando la cita, luego que desaparezca y aparezca la
 * parte del barbero — que los cuadros se reemplacen».
 *
 * Antes las dos mitades se apilaban y la tarjeta quedaba larguísima.
 * Acá las escenas van superpuestas y se cruzan con una transición de
 * opacidad: la caja mide siempre lo mismo y cuenta el doble.
 *
 * ⚠️ El alto es FIJO y se pasa a mano. Con alto automático la tarjeta
 * daría un salto cada vez que cambia de escena, que es exactamente el
 * defecto que esto viene a resolver.
 */
export function Escenas({
  alto,
  activa,
  escenas,
}: {
  alto: number;
  activa: number;
  escenas: ReactNode[];
}) {
  return (
    <div className="relative" style={{ height: alto }}>
      {escenas.map((e, i) => (
        <div
          key={i}
          // `pointer-events-none` en la que no se ve: si no, la escena
          // oculta seguiría tapando los clics de la visible.
          // El cruce va con la duración y la curva del sistema (antes
          // era un duration-500 suelto — ver ui-ux-expert §3).
          className={`absolute inset-0 transition-opacity ${
            i === activa ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{
            transitionDuration: "var(--duracion-revelado, 420ms)",
            transitionTimingFunction: "var(--ease-bookea, ease-out)",
          }}
          aria-hidden={i !== activa}
        >
          {e}
        </div>
      ))}
    </div>
  );
}

/**
 * Una lista de «esto también viene incluido», con el check verde en su
 * disco claro.
 *
 * Es el patrón de la página de precios de take.app, y funciona por una
 * razón concreta: el verde dice «sí, lo tenés» sin escribirlo, así que
 * cada línea puede ser solo el nombre de la función. Tres palabras en
 * vez de una frase — que es la regla de texto de esta página.
 *
 * Lo que entra acá tiene que EXISTIR: es una lista de promesas.
 */
export function ListaIncluye({ items }: { items: readonly string[] }) {
  return (
    <ul className="mx-auto mt-10 grid max-w-[720px] gap-x-8 gap-y-3 text-left sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[11px] font-extrabold text-[color:var(--ok)]"
          >
            ✓
          </span>
          <span className="text-[15px] leading-snug text-[color:var(--tinta-suave)]">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * El marco sobre el que se apoyan las demostraciones.
 *
 * Va en `--superficie`, un punto más oscuro que el papel: es el pedido
 * literal del dueño y también lo que hace que el mockup se vea apoyado
 * sobre la página en vez de recortado en ella. Sin sombra pesada ni
 * borde grueso — el salto de color alcanza.
 */
export function Marco({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      // `aria-hidden`: son demostraciones, no interfaz. Que un lector
      // de pantalla las recorra como si fueran controles de verdad
      // sería prometerle al usuario algo que no puede hacer acá.
      aria-hidden
      className={`select-none overflow-hidden rounded-[18px] border border-[color:var(--linea)] bg-[color:var(--superficie)] text-left ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * La puerta de cada producto: un BOTÓN, no un renglón de texto.
 *
 * Pedido del dueño (24 sep 2026): «el botón que dice ver más colocalo
 * en un card que sea como un botón, no un texto, para que se vea
 * mejor».
 *
 * Va en `--papel` sobre la tarjeta, que es `--superficie`: el mismo
 * truco del resto de la página —un solo salto de color— pero al revés,
 * así el botón se ve apoyado ENCIMA de la tarjeta en vez de recortado
 * en ella.
 *
 * ⚠️ ES UN `span`, NO UN `a`. Las cuatro tarjetas ya son un `<Link>`
 * entero: un enlace adentro de otro enlace es HTML inválido y React lo
 * marca. El `href` vive afuera; esto solo tiene que PARECER el botón
 * que ya es toda la tarjeta. De ahí que reaccione a `group-hover`: la
 * tarjeta se pinta cuando el mouse está en cualquier parte de ella,
 * que es exactamente dónde se puede hacer clic.
 */
export function VerMas({
  children = "Ver más",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 rounded-[12px] border border-[color:var(--linea)] bg-[color:var(--papel)] px-5 py-2.5 text-[13.5px] font-extrabold text-[color:var(--tinta)] shadow-[0_1px_2px_rgba(20,22,26,0.05)] transition-colors group-hover:border-[color:var(--acento)] group-hover:bg-[color:var(--acento)] group-hover:text-white ${className}`}
    >
      {children}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </span>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA VENTANA — el mockup recortado por el borde de la tarjeta
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026), con take.app en pantalla: «mirá los
 * reales que se ven estos mockups de los teléfonos, quiero que los
 * nuestros se vean así».
 *
 * Fui a medir qué hacen distinto, porque no es la foto: es UNA técnica.
 *
 * ── EL TELÉFONO NO ENTRA ENTERO. SE ASOMA. ──────────────────────────
 *
 * En take.app el teléfono se sale por arriba y por abajo del área de
 * imagen: se ve una FRANJA del aparato, nunca la silueta completa. Eso
 * cambia dos cosas a la vez:
 *
 *   1. **Se puede hacer grande.** Un teléfono entero adentro de una
 *      tarjeta de 300 px tiene que medir 145 px de ancho, y a ese
 *      tamaño su contenido queda en 8 px: ilegible. El mismo teléfono
 *      recortado mide 280 px y su contenido se LEE.
 *   2. **Deja de leerse como un juguete.** Una silueta completa
 *      flotando con aire alrededor se ve como un ícono de teléfono. Un
 *      recorte se lee como una ventana a algo que sigue existiendo
 *      fuera del marco.
 *
 * Es el mismo motivo por el que una foto de producto bien hecha rara
 * vez muestra el objeto entero y centrado.
 *
 * ── LAS OTRAS DOS COSAS QUE COPIÉ ───────────────────────────────────
 *
 * · El área de imagen va **a sangre**: toca los tres bordes de la
 *   tarjeta, sin margen. El aire está DENTRO de la ventana, no
 *   alrededor.
 * · La ventana tiene **su propio fondo**, un punto más oscuro que la
 *   tarjeta. Ese salto es lo que separa «la foto» del «texto» sin
 *   necesidad de una línea.
 *
 * `desde` decide desde qué borde se asoma: `arriba` para un teléfono
 * (se ve la cabecera de la pantalla, que es donde está la marca del
 * negocio) y `centro` para una pieza que ya mide lo justo y no hay que
 * recortar —las dos demos, que están hechas a 268 px—.
 */
export function Ventana({
  children,
  alto = 300,
  desde = "arriba",
  className = "",
}: {
  children: ReactNode;
  alto?: number;
  desde?: "arriba" | "centro";
  className?: string;
}) {
  return (
    <div
      // `aria-hidden`: son demostraciones, no interfaz. Que un lector de
      // pantalla las recorra como si fueran controles de verdad sería
      // prometerle algo que acá no puede hacer.
      aria-hidden
      style={{ height: alto }}
      className={`relative select-none overflow-hidden bg-[color:var(--superficie-2)] ${className}`}
    >
      <div
        className={`absolute inset-x-0 flex justify-center px-5 ${
          desde === "arriba"
            ? "top-0 pt-7"
            : "top-1/2 -translate-y-1/2 items-center"
        }`}
      >
        <div className="w-full max-w-[320px]">{children}</div>
      </div>
    </div>
  );
}
