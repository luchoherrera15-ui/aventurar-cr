"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Form from "next/form";
import { GRUPOS } from "@/components/home/grupos-categorias";
import {
  IconChevronDown,
  IconMail,
  IconSearch,
  IconSparkles,
} from "@/components/icons";

/**
 * ============================================================
 * LA BARRA DE ARRIBA DE LA PORTADA — buscar + rubros, en poco alto
 * ============================================================
 *
 * Cuarta pasada (ago 2026). El dueño pidió que la portada deje de ser
 * un héroe y pase a ser un CATÁLOGO:
 *
 *   «Necesito un marketplace de todos los lugares que tenemos
 *    registrados. Que abarque toda la página. Solo la parte de arriba
 *    con íconos pequeñitos y una barra de buscar pequeñita. Todo el
 *    resto: los negocios que tenemos registrados, POR CARRIL.»
 *
 * Así que esta pieza —que antes ocupaba media pantalla, con cuadros de
 * 96×108 px y una barra de búsqueda de 640 px centrada— se comprimió a
 * UNA FILA de ~44 px de alto: la lupa a la izquierda y los cuatro
 * grupos como chips chicos al lado. Lo que NO cambió es lo que hay
 * adentro: los mismos cuatro grupos, los mismos rubros, el mismo botón
 * de IA y los mismos desplegables accesibles.
 *
 * La taxonomía se mudó a `@/components/home/grupos-categorias`, que es
 * un módulo NEUTRO: la franja «Explorá por rubro» del final de la
 * portada es un componente de SERVIDOR y necesita la misma lista.
 * Exportarla desde acá —un `"use client"`— rompe el build en silencio.
 *
 * ── LA BÚSQUEDA ELIGE DIRECTORIO, Y NO MIENTE SOBRE CUÁL ─────────
 *
 * No existe un buscador transversal a las cuatro verticales, y esta
 * barra no lo va a fingir. Lo que sí existe son TRES directorios que
 * leen `?q=` de verdad, así que el buscador lleva un selector chiquito
 * con esos tres y manda a `<directorio>?q=<término>`:
 *
 *   /eventos       — `eventos/directorio.tsx` arranca su lupa con
 *                    `searchParams.get("q")` y filtra contra nombre,
 *                    provincia, cantón y descripción (y entiende fechas
 *                    escritas, vía `interpretarBusqueda`).
 *   /citas         — `citas/page.tsx`, `unSolo(params.q)`, en servidor.
 *   /restaurantes  — `restaurantes/page.tsx`, mismo patrón.
 *
 * ⚠️ HOSPEDAJES NO ESTÁ EN LA LISTA A PROPÓSITO. `hospedajes/page.tsx`
 * lee `?categoria=` pero NO `?q=`: ofrecerlo como destino sería mandar
 * a la persona a una lista que ignora lo que escribió. El día que ese
 * directorio lea `q`, se agrega acá una línea y listo. Mientras tanto la
 * puerta a Hospedajes es su chip, que está tres centímetros a la
 * derecha.
 *
 * POR QUÉ ESTO NO ERA OPCIONAL: la portada es ahora un catálogo con un
 * riel de Salud y belleza a la vista. Con el destino clavado en
 * /eventos, escribir «barber» en el único buscador de la pantalla no
 * encontraba la barbería que se ve justo debajo — verificado con curl:
 * `/eventos?q=SILENCE` nunca devuelve SILENCE BARBER SHOP, y
 * `/citas?q=barber` sí.
 *
 * Va con `<Form>` de next/form: navegación de cliente al enviar y, si el
 * JS todavía no cargó, degrada a un GET normal al destino que quedó
 * escrito en el `action` del HTML —el primero de la lista, /eventos—
 * con el mismo `?q=`. O sea: sin JS se comporta exactamente como antes,
 * no peor.
 *
 * El `<select>` NO lleva `name`: solo cambia a dónde apunta el form. Si
 * lo llevara, viajaría un parámetro que ningún directorio lee.
 *
 * ⚠️ REGLA DE MARCA (CLAUDE.md): la barra es un RECTÁNGULO de esquinas
 * suaves (rounded-lg). Jamás una píldora tipo Airbnb.
 *
 * ── EL BOTÓN «⋯ VER MÁS» ─────────────────────────────────────────
 * Al final de la fila, separado por una línea: no es una vertical del
 * marketplace, es la puerta a los productos creativos. Dos entradas,
 * las dos a páginas reales: Lealtad → `/lealtad` e Invitaciones →
 * `/invitaciones`.
 *
 * Se llamaba «IA» (con `IconWand`) hasta ago 2026, cuando el dueño lo
 * cambió: la sigla no le decía a nadie qué había detrás del chip.
 * «⋯ Ver más» se entiende sin explicación y no promete una
 * funcionalidad de IA que este menú no es.
 *
 * ── ACCESIBILIDAD DE LOS DESPLEGABLES ────────────────────────────
 * Mismo contrato que `MenuCuenta`: `aria-expanded` + `aria-haspopup` +
 * `aria-controls` en el botón, cierre con click/tap afuera vía
 * `pointerdown`, cierre con Escape devolviendo el foco al botón que
 * abrió. UNO SOLO abierto a la vez (el estado es cuál, no cinco
 * booleanos). Sin roles `menu`/`menuitem`: son links de navegación
 * (patrón "disclosure"), no acciones de aplicación.
 *
 * ── POR QUÉ LOS PANELES NO SE RECORTAN EN MÓVIL ──────────────────
 * La fila de chips scrollea en horizontal (`overflow-x-auto`, mismo
 * patrón que `BarraFiltrosDirectorio`). Los paneles NO son hijos de esa
 * fila — son HERMANOS suyos, dentro del mismo contenedor `relative` sin
 * overflow — así que el recorte de la fila nunca los alcanza aunque los
 * botones que los abren vivan adentro de ella. Y como el panel más largo
 * (Restaurantes, 18 rubros) no cabe en una pantalla de teléfono, todos
 * llevan `max-h` + scroll vertical propio: se recorta el panel, nunca la
 * página.
 */

/* ─────────────────────────────────────────────────────────────────
   Estilos compartidos
   ───────────────────────────────────────────────────────────────── */

/**
 * El chip de un grupo: ícono chiquito + nombre + flechita, todo en una
 * línea de 36 px. `whitespace-nowrap` para que «Salud y belleza» no
 * parta en dos y descuadre la altura de la fila.
 *
 * `chipCls` NO lleva color de fondo: eso vive entero en
 * `chipInactivoCls`/`chipActivoCls`, y un chip usa SIEMPRE uno de los
 * dos, nunca los dos a la vez. Antes `chipCls` traía
 * `bg-aventurea-surface` fijo y el activo le SUMABA `bg-aventurea-navy`
 * encima —dos utilidades de fondo en la misma clase—, y Tailwind
 * ordena las reglas por nombre y no por dónde aparecen en el string:
 * "aventurea-navy" queda antes que "aventurea-surface" en la hoja
 * generada, así que el fondo BLANCO ganaba la cascada siempre, con
 * letra blanca encima — el botón activo quedaba invisible (blanco
 * sobre blanco). Mismo criterio abajo, en `burbujaCls`.
 */
const chipCls =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border pl-1.5 pr-2.5 text-[12.5px] font-bold transition-colors";

const chipInactivoCls =
  "border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy";

const chipActivoCls = "border-aventurea-navy bg-aventurea-navy text-white";

const burbujaCls =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&_svg]:h-[14px] [&_svg]:w-[14px]";

const burbujaInactivaCls = "bg-aventurea-sky/10 text-aventurea-orange";

const burbujaActivaCls = "bg-white/15 text-white";

/** Fila de un panel desplegable (los cuatro grupos y el menú de IA). */
const filaPanelCls =
  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-bold text-aventurea-ink hover:bg-aventurea-cream-2";

const burbujaPanelCls =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aventurea-sky/10 text-aventurea-orange [&_svg]:h-[15px] [&_svg]:w-[15px]";

const panelCls =
  "absolute left-0 top-full z-40 mt-1.5 max-h-[min(66vh,420px)] overflow-y-auto overscroll-contain rounded-2xl border border-aventurea-line bg-white p-1.5 shadow-xl";

/**
 * Los directorios que el buscador puede ofrecer como destino: SOLO los
 * que leen `?q=` (ver el comentario grande de arriba). El primero es el
 * que queda en el `action` del HTML servido, o sea el destino cuando el
 * JS todavía no corrió.
 *
 * Los nombres salen de `NOMBRE_VERTICAL` a través de `GRUPOS`, el mismo
 * mapa que titula los chips de al lado y los rieles de más abajo: si el
 * selector dijera «Citas» y el chip «Salud y belleza», serían dos
 * secciones distintas para quien mira.
 */
// "restaurantes" fuera por el momento (ago 2026) — ver la nota en
// grupos-categorias.tsx. `OPCIONES_BUSQUEDA` de abajo ya ignora
// cualquier id que no esté en GRUPOS, así que esto no rompe nada;
// se deja aparte para no repetir el mismo id en dos comentarios.
const DESTINOS_BUSQUEDA = ["eventos", "citas"] as const;

/** Los destinos ya resueltos a `{ href, label }`, en ese orden. */
const OPCIONES_BUSQUEDA: { href: string; label: string }[] =
  DESTINOS_BUSQUEDA.flatMap((id) => {
    const g = GRUPOS.find((x) => x.id === id);
    return g ? [{ href: g.base, label: g.label }] : [];
  });

/** El destino que viaja en el HTML servido (y el que usa el form sin JS). */
const DESTINO_POR_DEFECTO = OPCIONES_BUSQUEDA[0]?.href ?? "/eventos";

/* ─────────────────────────────────────────────────────────────────
   El componente
   ───────────────────────────────────────────────────────────────── */

/**
 * Ya no recibe un `titulo`: el h1 de la portada vive aparte, `sr-only`,
 * directo en `page.tsx` (pedido del dueño, ago 2026: todo el mando de
 * la portada — buscador y categorías incluidos — pasó a compartir una
 * sola línea con el logo y las acciones dentro de `SiteHeader`, y ya
 * no hay una columna propia donde poner un título visible).
 */
export default function NavCategorias() {
  // Cuál está abierto: el id de un grupo, "ia", o nada. Un solo valor y
  // no cinco booleanos, para que sea imposible tener dos abiertos.
  const [abierto, setAbierto] = useState<string | null>(null);

  // A qué directorio manda el buscador. Arranca en el mismo valor que
  // quedó escrito en el `action` del HTML, así que la primera pintada
  // del cliente coincide con la del servidor (nada de hidratación
  // desprolija) y sin JS el form sigue funcionando igual que siempre.
  const [destino, setDestino] = useState(DESTINO_POR_DEFECTO);

  // La fila entera y el panel: todo lo que NO está adentro de estos dos
  // cuenta como "afuera". Un ref por botón sería un mapa que hay que
  // limpiar; la fila los contiene a todos y alcanza igual, porque el
  // único hijo suyo que reacciona al puntero es un botón que ya tiene
  // su propio `onClick` de toggle.
  const filaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Esto sí es por botón: Escape tiene que devolver el foco al que abrió.
  const botonesRef = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!abierto) return;

    function alTocarFuera(e: PointerEvent) {
      const objetivo = e.target as Node;
      if (filaRef.current?.contains(objetivo)) return;
      if (panelRef.current?.contains(objetivo)) return;
      setAbierto(null);
    }

    function alTeclado(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const boton = abierto ? botonesRef.current[abierto] : null;
      setAbierto(null);
      boton?.focus();
    }

    document.addEventListener("pointerdown", alTocarFuera);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("pointerdown", alTocarFuera);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto]);

  const grupoAbierto = GRUPOS.find((g) => g.id === abierto);

  return (
    /* ── TODO EN UNA LÍNEA ────────────────────────────────────────
       Pedido del dueño, tercera pasada (ago 2026): nada de renglón
       propio ni de cápsula centrada — el buscador y las categorías
       comparten la MISMA fila que el logo y las acciones, adentro de
       `SiteHeader` (`segundaFila`, ver ese componente). Acá adentro ya
       no hay grilla de tres columnas ni título: un buscador angosto de
       ancho fijo y, al lado, las categorías en una fila que se encoge
       y scrollea (`min-w-0 flex-1`) en vez de reventar el header. */
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* ── LA CÁPSULA DE BÚSQUEDA, COMPACTA ─────────────────────────
          Sigue siendo la píldora estilo Airbnb (cambio de marca
          confirmado por el dueño, ver CLAUDE.md), pero angosta: ya no
          tiene una fila entera para ella sola. El selector de
          directorio se esconde bajo `lg` — a ese ancho ya no sobra
          lugar para tres controles más el logo y las acciones — y el
          botón de enviar es un círculo de solo ícono, sin el texto
          «Buscar» que sí cabía en la versión ancha. */}
      <Form
        action={destino}
        className="flex h-9 w-[104px] shrink-0 items-center gap-1 rounded-full border border-aventurea-line bg-white pl-2.5 pr-1 shadow-sm transition-shadow focus-within:shadow-md sm:w-[210px] lg:w-[260px]"
      >
        <span aria-hidden className="shrink-0 text-aventurea-ink-soft">
          <IconSearch className="h-[15px] w-[15px]" />
        </span>
        <label htmlFor="busqueda-portada" className="sr-only">
          Qué negocio, lugar o servicio buscás
        </label>
        <input
          id="busqueda-portada"
          name="q"
          type="search"
          autoComplete="off"
          // Neutro a propósito: el destino ya no está clavado en
          // Eventos, así que un placeholder que solo nombre eventos
          // contradiría al selector de al lado.
          placeholder="Buscar…"
          className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-[12.5px] text-aventurea-ink outline-none placeholder:text-aventurea-ink-soft"
        />

        {/* Dónde buscar. Un `<select>` nativo y no un menú propio: es
            accesible de fábrica (teclado, lector de pantalla, la rueda
            nativa del teléfono), no suma un solo desplegable más que
            cerrar, y ocupa lo mínimo. Escondido hasta `lg`: en la
            versión compacta no hay ancho de sobra para mostrarlo
            siempre — sigue mandando al mismo destino por default. */}
        <label htmlFor="destino-portada" className="sr-only">
          En qué directorio buscar
        </label>
        <select
          id="destino-portada"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          className="hidden h-7 shrink-0 cursor-pointer rounded-full border-l border-aventurea-line bg-transparent pl-1.5 pr-0.5 text-[11px] font-bold text-aventurea-navy outline-none lg:block"
        >
          {OPCIONES_BUSQUEDA.map((o) => (
            <option key={o.href} value={o.href}>
              {o.label}
            </option>
          ))}
        </select>

        {/* El círculo de acento al final de la cápsula — el gesto
            visual que hace que se lea «Airbnb» y no «un input con
            botón». Solo ícono, siempre: la versión compacta no tiene
            lugar para el texto «Buscar» que sí llevaba la ancha. */}
        <button
          type="submit"
          aria-label="Buscar"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-white transition-colors hover:bg-aventurea-navy-2"
        >
          <IconSearch className="h-3 w-3" aria-hidden />
        </button>
      </Form>

      {/* ── Las categorías, en lo que quede de la fila ────────────────
          `min-w-0 flex-1`: se lleva el ancho que sobra después del
          buscador, y si ni así entran todas, el `overflow-x-auto` de
          adentro scrollea — el mismo patrón que ya usaba esta fila
          antes de compartir línea con el buscador. */}
      <nav
        aria-label="Categorías de Bookea"
        className="relative min-w-[64px] flex-1"
      >
        <div
          ref={filaRef}
          className="flex max-w-full items-center gap-1 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: "none" }}
        >
          {GRUPOS.map((g) => {
            const activo = abierto === g.id;
            return (
              <button
                key={g.id}
                ref={(el) => {
                  botonesRef.current[g.id] = el;
                }}
                type="button"
                aria-expanded={activo}
                aria-haspopup="true"
                aria-controls={`panel-${g.id}`}
                onClick={() => setAbierto((v) => (v === g.id ? null : g.id))}
                className={`${chipCls} ${activo ? chipActivoCls : chipInactivoCls}`}
              >
                <span
                  className={`${burbujaCls} ${activo ? burbujaActivaCls : burbujaInactivaCls}`}
                >
                  <g.Icono />
                </span>
                {g.label}
                <IconChevronDown
                  className={`h-3 w-3 shrink-0 transition-transform ${
                    activo ? "rotate-180" : ""
                  }`}
                />
              </button>
            );
          })}

          {/* La línea que separa el marketplace de las herramientas. */}
          <div
            aria-hidden
            className="my-1 w-px shrink-0 self-stretch bg-aventurea-line"
          />

          <button
            ref={(el) => {
              botonesRef.current.ia = el;
            }}
            type="button"
            aria-expanded={abierto === "ia"}
            aria-haspopup="true"
            aria-controls="panel-ia"
            aria-label="Ver más servicios de Bookea"
            onClick={() => setAbierto((v) => (v === "ia" ? null : "ia"))}
            className={`${chipCls} ${abierto === "ia" ? chipActivoCls : chipInactivoCls}`}
          >
            {/* Los tres puntos, no el ícono de IA (pedido del dueño,
                ago 2026): «IA» no le decía a nadie qué había detrás;
                «⋯ Ver más» sí se entiende sin explicación. */}
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[15px] font-extrabold leading-none ${
                abierto === "ia"
                  ? "bg-white/15 text-white"
                  : "bg-aventurea-navy text-white"
              }`}
            >
              ⋯
            </span>
            Ver más
            <IconChevronDown
              className={`h-3 w-3 shrink-0 transition-transform ${
                abierto === "ia" ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Relleno para que el degradado de abajo no tape el último
              chip — mismo truco que BarraFiltrosDirectorio. */}
          <div className="w-2 shrink-0" aria-hidden />
        </div>

        {/* Avisa que hay más para el lado cuando la fila no entra.
            SIN `lg:hidden`: la fila de chips mide ~670 px. Antes, con el
            h1 y el buscador en el mismo renglón, le quedaban ~674 px de
            los 1152 del contenedor —o sea que se cortaba en casi toda
            pantalla de escritorio—. Con el h1 en su propia línea (ver
            src/app/page.tsx) le quedan ~748, así que arriba de ~1130 px
            de ancho ya entra entera. Debajo de eso —tablet y teléfono—
            sigue desbordando, y sin esta señal el último chip («IA»)
            queda cortado a cuchillo sin que nada indique que la fila se
            desliza. El degradado es de blanco a transparente sobre una
            franja blanca: cuando no hay nada debajo, no se ve. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
        />

        {grupoAbierto && (
          <div
            id={`panel-${grupoAbierto.id}`}
            ref={panelRef}
            className={`${panelCls} ${
              grupoAbierto.dosColumnas
                ? "w-[min(calc(100vw-2rem),560px)]"
                : "w-[min(calc(100vw-2rem),320px)]"
            }`}
          >
            <Link
              href={grupoAbierto.base}
              onClick={() => setAbierto(null)}
              className="block rounded-xl px-3.5 py-2 text-[13px] font-bold text-aventurea-ink hover:bg-aventurea-cream-2"
            >
              {grupoAbierto.verTodo}
            </Link>
            <div className="my-1 border-t border-aventurea-line" />
            <div
              className={
                grupoAbierto.dosColumnas ? "grid gap-0.5 sm:grid-cols-2" : ""
              }
            >
              {grupoAbierto.rubros.map((r) => (
                <Link
                  key={r.id}
                  href={`${grupoAbierto.base}?categoria=${r.id}`}
                  onClick={() => setAbierto(null)}
                  className={filaPanelCls}
                >
                  <span className={burbujaPanelCls}>{r.icono}</span>
                  <span className="min-w-0">{r.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {abierto === "ia" && (
          <div
            id="panel-ia"
            ref={panelRef}
            className={`${panelCls} w-[min(calc(100vw-2rem),290px)]`}
          >
            <Link
              href="/lealtad"
              onClick={() => setAbierto(null)}
              className={filaPanelCls}
            >
              <span className={burbujaPanelCls}>
                <IconSparkles />
              </span>
              <span className="min-w-0">
                <span className="block">Lealtad</span>
                <span className="block text-[12px] font-semibold text-aventurea-ink-soft">
                  Tarjetas de sellos para tu negocio
                </span>
              </span>
            </Link>
            <Link
              href="/invitaciones"
              onClick={() => setAbierto(null)}
              className={filaPanelCls}
            >
              <span className={burbujaPanelCls}>
                <IconMail />
              </span>
              <span className="min-w-0">
                <span className="block">Invitaciones</span>
                <span className="block text-[12px] font-semibold text-aventurea-ink-soft">
                  Invitaciones digitales para tu evento
                </span>
              </span>
            </Link>
          </div>
        )}
      </nav>
    </div>
  );
}
