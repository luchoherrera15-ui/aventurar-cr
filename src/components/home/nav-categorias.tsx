"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
 */
const chipCls =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-aventurea-line bg-aventurea-surface pl-1.5 pr-2.5 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy";

const chipActivoCls = "border-aventurea-navy bg-aventurea-navy text-white";

const burbujaCls =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-aventurea-sky/10 text-aventurea-orange [&_svg]:h-[14px] [&_svg]:w-[14px]";

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
const DESTINOS_BUSQUEDA = ["eventos", "citas", "restaurantes"] as const;

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
 * @param titulo El h1 de la portada. Llega como prop y no se escribe
 *   acá para que el encabezado de la página siga viviendo en la
 *   página: quien lea `page.tsx` tiene que poder ver de qué habla el
 *   documento sin abrir un componente de barra.
 */
export default function NavCategorias({ titulo }: { titulo?: ReactNode }) {
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
    /* ── LA BARRA, EN DOS RENGLONES ──────────────────────────────
       Pedido del dueño (ago 2026, revisado ago 2026): el título en la
       esquina izquierda, la CÁPSULA de búsqueda centrada y los chips
       abajo, también centrados. La cápsula es un cambio de marca
       explícito y confirmado — ver el comentario grande de la cápsula
       más abajo.

       El renglón de arriba es una grilla de tres columnas
       —`1fr auto 1fr`— y no un flex con `justify-between`. La
       diferencia importa: con flex, la cápsula queda centrada
       respecto al espacio QUE SOBRA después del título, así que se
       corre a la derecha y el centro es mentira. Con las dos columnas
       laterales del mismo ancho, la cápsula cae en el centro real de
       la franja, mida lo que mida el título. La tercera columna está
       vacía a propósito: es el contrapeso.

       En teléfono la grilla se apaga y los tres bloques se apilan, que
       es la única forma en que una cápsula ancha y ocho chips caben. */
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid min-w-0 items-center gap-2 lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
        {titulo !== undefined ? (
          <div className="min-w-0 lg:justify-self-start">{titulo}</div>
        ) : (
          <span aria-hidden className="hidden lg:block" />
        )}
      {/* ── LA CÁPSULA DE BÚSQUEDA ──────────────────────────────────
          Cambio de marca pedido y confirmado por el dueño (ago 2026):
          antes esto era un rectángulo de esquinas suaves «nunca
          píldora» — esa regla queda retirada A PROPÓSITO para esta
          barra puntual (ver CLAUDE.md, sección Diseño, actualizado el
          mismo día). Un solo óvalo de extremo a extremo (`rounded-full`
          en los CUATRO segmentos: el borde exterior y el botón de la
          derecha), con divisores finos entre buscador y selector, y el
          botón «Buscar» como el círculo de acento al final — el mismo
          lenguaje que Airbnb, que es exactamente lo que se pidió. */}
      <Form
        action={destino}
        className="flex h-12 w-full shrink-0 items-center gap-1 rounded-full border border-aventurea-line bg-white pl-4 pr-1.5 shadow-[0_10px_30px_-14px_rgba(16,47,82,0.28)] transition-shadow focus-within:shadow-[0_14px_34px_-12px_rgba(16,47,82,0.35)] lg:w-[460px]"
      >
        <span aria-hidden className="shrink-0 text-aventurea-ink-soft">
          <IconSearch className="h-[18px] w-[18px]" />
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
          placeholder="Buscá un negocio o lugar…"
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[13.5px] text-aventurea-ink outline-none placeholder:text-aventurea-ink-soft"
        />

        {/* Dónde buscar. Un `<select>` nativo y no un menú propio: es
            accesible de fábrica (teclado, lector de pantalla, la rueda
            nativa del teléfono), no suma un solo desplegable más que
            cerrar, y ocupa lo mínimo. */}
        <span aria-hidden className="hidden h-6 w-px shrink-0 bg-aventurea-line sm:block" />
        <label htmlFor="destino-portada" className="sr-only">
          En qué directorio buscar
        </label>
        <select
          id="destino-portada"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          className="hidden h-8 shrink-0 cursor-pointer rounded-full bg-transparent pl-2.5 pr-1 text-[12.5px] font-bold text-aventurea-navy outline-none sm:block"
        >
          {OPCIONES_BUSQUEDA.map((o) => (
            <option key={o.href} value={o.href}>
              {o.label}
            </option>
          ))}
        </select>

        {/* El círculo de acento al final de la cápsula — el gesto
            visual que hace que se lea «Airbnb» y no «un input con
            botón». `aria-label` porque en pantallas chicas el texto se
            esconde y solo queda el ícono. */}
        <button
          type="submit"
          aria-label="Buscar"
          className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-aventurea-navy text-white transition-colors hover:bg-aventurea-navy-2 sm:w-auto sm:px-4"
        >
          <IconSearch className="h-3.5 w-3.5 sm:hidden" aria-hidden />
          <span className="hidden text-[12.5px] font-bold sm:inline">Buscar</span>
        </button>
      </Form>

        {/* El contrapeso de la columna izquierda. No lleva contenido:
            existe para que la cápsula quede en el centro y no
            corrida. */}
        <span aria-hidden className="hidden lg:block" />
      </div>

      {/* ── Los chips, centrados de VERDAD ──────────────────────────
          Pedido del dueño: que la fila de categorías quede centrada
          bajo la cápsula, no pegada a la izquierda.

          `justify-center` a secas en el contenedor que scrollea es la
          trampa de siempre (barra-filtros-directorio.tsx la sufrió):
          si el contenido desborda, el navegador reparte el desborde a
          los dos lados y el primer chip queda en una posición a la
          que el scroll no llega. Acá el caso común es que los chips
          SÍ entran (son seis, no dieciocho), así que en vez de esa
          trampa se centra el CONTENEDOR: `<nav>` se encoge a lo que
          mide su contenido (`w-fit`) y `mx-auto` lo centra en la franja
          entera. Si en una pantalla angosta el contenido no entra,
          `max-w-full` frena al `<nav>` en el ancho disponible y el
          `overflow-x-auto` de ADENTRO sigue scrolleando sin el bug de
          la centrada — porque ahí adentro ya no hay `justify-center`
          peleando con el desborde. */}
      <nav
        aria-label="Categorías de Bookea"
        className="relative mx-auto w-fit max-w-full"
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
                className={`${chipCls} ${activo ? chipActivoCls : ""}`}
              >
                <span
                  className={`${burbujaCls} ${activo ? burbujaActivaCls : ""}`}
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
            className={`${chipCls} ${abierto === "ia" ? chipActivoCls : ""}`}
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
