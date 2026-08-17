"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconCelebrate,
  IconChevronDown,
  IconChevronLeft,
  IconPin,
  IconSearch,
  IconSparkles,
} from "@/components/icons";
import { CATEGORIA_ICONO } from "@/app/mi-negocio/types";
import { CATEGORIA_CITA_ICONO } from "@/app/citas/iconos";
import {
  PAISES_BUSCADOR,
  PESTANAS,
  RUBROS,
  SUGERENCIAS,
  TEXTOS,
  paisDelBuscador,
  urlBusqueda,
  type PestanaBuscador,
} from "./buscador-home-datos";
import { etiquetaRegion, regionesDe } from "@/lib/paises";
import { cookieDePais } from "@/lib/pais-preferido";

/**
 * EL BUSCADOR DE LA PORTADA — comportamiento de Airbnb, estética de
 * Bookea.
 *
 * ── LOS DOS ESTADOS ────────────────────────────────────────────────
 * COMPACTO: las pestañas arriba y una sola barra con "¿Qué necesitás?"
 * y "¿Dónde?". EXPANDIDO: la misma barra crece hacia abajo con un
 * panel de rubros y búsquedas populares. En móvil el compacto es un
 * solo botón y el expandido es una hoja a pantalla completa.
 *
 * La expansión NO anima `height`: usa la utilidad `desplegable`
 * (grid-template-rows 0fr → 1fr), que el navegador sí interpola y que
 * no obliga a medir el contenido ni a inventar un `max-height`.
 *
 * ── POR QUÉ FUNCIONA SIN JAVASCRIPT ────────────────────────────────
 * Esta es la portada: Google la lee sin ejecutar nada, y hay gente que
 * navega con el JS a medio cargar. Así que:
 *
 *  · La barra es un `<form method="get" action="/citas">` de verdad.
 *    Sin JS se escribe, se manda y se llega a `/citas?q=…&provincia=…`.
 *    Con JS se intercepta el submit solo para armar una URL limpia (sin
 *    `?q=&provincia=` vacíos) y navegar del lado del cliente.
 *  · Las PESTAÑAS son `<a href="/citas">` y `<a href="/eventos">`. Con
 *    JS cambian de pestaña sin recargar; sin JS llevan al directorio de
 *    esa vertical, que trae su propio buscador. Nunca son un botón
 *    muerto.
 *  · Los CHIPS del panel son `<Link>` a URLs reales — no un `listbox`
 *    con `aria-activedescendant`. Menos JavaScript, menos que romper, y
 *    son rastreables: el home estrena los enlaces a `/eventos?categoria=`
 *    (hoy nadie en el repo enlaza ahí).
 *  · El panel, sin JS, se abre con `:focus-within` puro (la clase
 *    `group-focus-within:` que se monta SOLO mientras no hay JS): así
 *    los chips nunca quedan enfocables dentro de una caja de altura 0.
 *    Al hidratar, la clase se va y el estado toma el control — si no,
 *    `Escape` cerraría el panel y el foco lo volvería a abrir.
 *  · En móvil, el botón compacto es un `<a>` al directorio. Sin JS
 *    lleva ahí; con JS abre la hoja.
 *
 * ── LO QUE ESTE COMPONENTE NO HACE ─────────────────────────────────
 * No filtra. No interpreta fechas. No consulta la base. Solo COMPONE la
 * URL (ver `buscador-home-datos.ts`) y deja que el directorio, que ya
 * sabe hacerlo, haga su trabajo.
 *
 * No hay campo "¿Cuándo?": no existe una consulta de disponibilidad
 * transversal en Citas, y un control que no filtra nada es un control
 * que miente.
 *
 * ── DÓNDE VIVE EL PAÍS ─────────────────────────────────────────────
 * ACÁ, dentro del buscador, y NO en un menú de banderitas del header.
 * Bookea dejó de ser solo de Costa Rica, y la referencia de producto es
 * Fresha: la ubicación es parte de la pregunta que la persona vino a
 * hacer ("¿qué necesito y dónde?"), no una preferencia global escondida
 * en una esquina de la barra de navegación.
 *
 * Son dos `<select>` encadenados —país y luego su región— porque la
 * segunda lista DEPENDE de la primera: las 7 provincias de Costa Rica,
 * las 13 de Panamá, los 32 estados de México. Y la etiqueta del segundo
 * campo cambia con el país: decir "Provincia" en México sería escribir
 * mal el nombre de su propia división.
 *
 * ── EL PAÍS VIENE DETECTADO, PERO EL SELECTOR SE QUEDA ─────────────
 * El valor inicial ya no es Costa Rica a secas: llega en `paisInicial`
 * desde el servidor, que lo saca de la cabecera `x-vercel-ip-country`
 * de Vercel (reglas completas en @/lib/pais-preferido). Sigue siendo
 * la cabecera y NO `navigator.geolocation`: un permiso del navegador
 * apenas alguien entra a la portada espanta gente, y para saber el
 * país es una precisión que sobra.
 *
 * El `<select>` NO se esconde por estar detectado, y no es timidez:
 * (a) la IP se equivoca seguido en Centroamérica —mucho tráfico sale
 * ruteado por Miami, y con VPN siempre—; (b) hay quien busca en otro
 * país a propósito; (c) Google rastrea desde Estados Unidos, y un
 * sitio que cambia por IP sin dejar navegar a cada país deja siete
 * mercados sin indexar. Por eso mismo, cambiarlo a mano DEJA CONSTANCIA
 * (la cookie de `cambiarPais`): la corrección de la persona le gana a
 * la detección, también en la próxima visita.
 *
 * Sigue sin haber aviso de "¿estás en Panamá?": mientras no haya
 * negocios cargados en otro país, ese cartel llevaría a un directorio
 * vacío. Detectar el país del selector es otra cosa — no interrumpe a
 * nadie y no promete nada.
 */

/**
 * El ícono de cada rubro, por vertical. Se cablean los dos sets
 * directamente en vez de pasar por `categoriaIcono()` de
 * categorias-vertical.ts: ese helper arrastraría también las
 * taxonomías de Hospedajes y Restaurantes al bundle del cliente, y el
 * buscador solo ofrece estas dos verticales.
 */
const ICONOS: Record<PestanaBuscador, Record<string, React.ReactNode>> = {
  citas: CATEGORIA_CITA_ICONO,
  eventos: CATEGORIA_ICONO,
};

/** No hay nada a qué suscribirse: el valor no cambia después de hidratar. */
const SIN_SUSCRIPCION = () => () => {};

const ICONO_PESTANA: Record<PestanaBuscador, React.ReactNode> = {
  citas: <IconSparkles className="h-3.5 w-3.5" />,
  eventos: <IconCelebrate className="h-3.5 w-3.5" />,
};

/**
 * LA HOJA DE BÚSQUEDA MÓVIL, FUERA DEL HERO.
 *
 * La hoja es `fixed inset-0 z-[60]`, y aun así quedaba TAPADA por las
 * secciones de abajo en un teléfono. El motivo no es el z-index: el
 * hero de la portada lleva la clase `organico`, que trae
 * `isolation: isolate` (globals.css) y con eso crea un CONTEXTO DE
 * APILADO propio. Dentro de ese contexto el 60 es un número interno —
 * no compite con el resto de la página—, así que cualquier sección
 * posterior con `position: relative` se pinta encima de una hoja que
 * se supone a pantalla completa.
 *
 * Se resuelve sacándola del árbol del DOM con un portal a `body`, que
 * es donde un diálogo modal tiene que vivir. El árbol de React no
 * cambia: los eventos siguen burbujeando por los mismos manejadores y
 * el `<form>` sigue siendo el mismo, así que no hay campos duplicados
 * ni un segundo envío.
 *
 * Cerrada no porta nada: se devuelve tal cual, y como el envoltorio es
 * `display: contents`, en escritorio el buscador se maqueta como si
 * este componente no existiera.
 *
 * `document` siempre existe cuando `activo` es true: la hoja solo se
 * enciende con un toque, y eso solo pasa en el cliente. En el servidor
 * `activo` es false y esto no toca `document`.
 */
function HojaPortal({ activo, children }: { activo: boolean; children: React.ReactNode }) {
  if (!activo) return <>{children}</>;
  return createPortal(children, document.body);
}

export default function BuscadorHome({
  pestanaInicial = "citas",
  paisInicial,
  tono = "oscuro",
  id = "buscador-home",
  className = "",
}: {
  /**
   * Con qué vertical abre. La portada puede leer `?buscar=eventos` en
   * el servidor y pasarlo acá — a propósito NO se usa
   * `useSearchParams()` adentro: en un componente cliente sin
   * `<Suspense>` obliga a renderizar la ruta entera del lado del
   * cliente, y esta es la página que Google mide para calificar la
   * velocidad del sitio.
   */
  pestanaInicial?: PestanaBuscador;
  /**
   * Con qué país abre. La portada lo resuelve en el servidor
   * (`paisDelVisitante`): lo que la persona eligió antes, o lo que dice
   * su IP, o Costa Rica. Está como prop y no leído acá adentro por dos
   * razones: la cabecera de geolocalización solo existe en el servidor,
   * y `useSearchParams()` en un cliente sin `<Suspense>` obliga a
   * renderizar la portada entera del lado del cliente.
   *
   * Sin la prop abre en Costa Rica, que es el país por defecto de toda
   * la plataforma, y cualquier valor raro cae ahí también
   * (`paisDelBuscador`): el `<select>` nunca aparece sin nada marcado.
   */
  paisInicial?: string;
  /**
   * Sobre qué fondo se pinta. "oscuro" es el hero navy (pestañas
   * translúcidas en blanco); "claro" sirve si algún día el buscador se
   * repite sobre fondo crema.
   */
  tono?: "oscuro" | "claro";
  /** El id del contenedor, para que `#buscador-home` sea un ancla real. */
  id?: string;
  className?: string;
}) {
  const router = useRouter();
  const idBase = useId();
  const idQue = `${idBase}-que`;
  const idPais = `${idBase}-pais`;
  const idDonde = `${idBase}-donde`;
  const idPanel = `${idBase}-panel`;
  const idCampos = `${idBase}-campos`;

  const [pestana, setPestana] = useState<PestanaBuscador>(pestanaInicial);
  const [q, setQ] = useState("");
  const [pais, setPais] = useState(() => paisDelBuscador(paisInicial));
  const [provincia, setProvincia] = useState("");
  /** El panel de sugerencias (escritorio). */
  const [abierto, setAbierto] = useState(false);
  /** La hoja a pantalla completa (móvil). */
  const [hoja, setHoja] = useState(false);
  /**
   * ¿Ya hidrató? Marca la diferencia entre "HTML servido" y "app viva",
   * y es lo que permite que el mismo marcado sirva con y sin JS.
   *
   * Con `useSyncExternalStore` y no con `useState` + `useEffect`: el
   * efecto que llama a setState en su cuerpo dispara un render en
   * cascada (y el lint del repo lo prohíbe). Acá el servidor devuelve
   * `false`, el cliente `true`, y React hace el segundo render solo.
   */
  const conJs = useSyncExternalStore(
    SIN_SUSCRIPCION,
    () => true,
    () => false,
  );

  const refShell = useRef<HTMLElement | null>(null);
  const refHoja = useRef<HTMLDivElement | null>(null);
  const refBotonMovil = useRef<HTMLAnchorElement | null>(null);
  const refQue = useRef<HTMLInputElement | null>(null);
  const refsTabs = useRef<(HTMLAnchorElement | null)[]>([]);
  /** Quién abrió el panel: ahí vuelve el foco al cerrarlo con Escape. */
  const refDisparador = useRef<HTMLElement | null>(null);
  /**
   * Bandera para el instante en que Escape devuelve el foco al campo de
   * texto. Sin ella, ese `focus()` dispara el `onFocus` que ABRE el
   * panel y Escape queda sin efecto: se cierra y se vuelve a abrir en el
   * mismo cuadro. Como `focus()` despacha el evento de forma síncrona,
   * alcanza con levantarla y bajarla alrededor de la llamada.
   */
  const refSaltarFoco = useRef(false);

  const textos = TEXTOS[pestana];
  /** Las regiones del país elegido, y cómo las llama ese país. */
  const regiones = regionesDe(pais);
  const etiquetaDonde = etiquetaRegion(pais);
  /**
   * Los tres parámetros de ubicación y texto que TODOS los enlaces del
   * panel comparten. Están juntos para que agregar uno no obligue a
   * acordarse de los seis lugares donde se arma una URL — que es
   * exactamente como se pierde un filtro al tocar un chip.
   */
  const comunes = { q, pais, provincia };
  /** En la hoja el fondo es blanco, así que las pestañas van en claro. */
  const sobreOscuro = tono === "oscuro" && !hoja;
  /** Dentro de la hoja el panel no se pliega: es el contenido de la hoja. */
  const panelAbierto = hoja || abierto;

  const abrirPanel = useCallback((disparador: HTMLElement | null) => {
    if (refSaltarFoco.current) return;
    refDisparador.current = disparador;
    setAbierto(true);
  }, []);

  const cerrarPanel = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    if (!devolverFoco) return;
    refSaltarFoco.current = true;
    refDisparador.current?.focus();
    refSaltarFoco.current = false;
  }, []);

  const cerrarHoja = useCallback(() => {
    setHoja(false);
    setAbierto(false);
    refBotonMovil.current?.focus();
  }, []);

  function cambiarPestana(destino: PestanaBuscador) {
    setPestana(destino);
  }

  /**
   * Cambiar de país SUELTA la región elegida.
   *
   * No es un detalle de prolijidad: "Cartago" no existe en Panamá, y
   * dejarla puesta mandaría a `/citas?pais=pa&provincia=Cartago`. Como
   * `urlBusqueda` valida la región contra el país, el parámetro ni
   * siquiera se emitiría — o sea que el `<select>` mostraría "Cartago"
   * mientras el buscador busca en todo Panamá. Un control que dice una
   * cosa y hace otra es peor que uno que no está.
   *
   * Y QUEDA ANOTADO. La cookie `bookea_pais` es lo que hace que la
   * elección le gane a la detección por IP en la siguiente visita: sin
   * ella, quien está en Costa Rica con una VPN de Estados Unidos —o
   * quien vive en Panamá pero su proveedor sale por Miami— tendría que
   * corregir el país en cada entrada al sitio.
   *
   * Se escribe desde el navegador y no con un server action a
   * propósito: es una preferencia de comodidad, no vale una ida al
   * servidor por mover un desplegable. Sin JavaScript no se guarda —el
   * `<form method="get">` igual manda `?pais=` al directorio, y la
   * próxima visita vuelve a detectar—, que es una degradación honesta.
   */
  function cambiarPais(destino: string) {
    const elegido = paisDelBuscador(destino);
    setPais(elegido);
    setProvincia("");
    document.cookie = cookieDePais(
      elegido,
      window.location.protocol === "https:",
    );
  }

  /**
   * Clic fuera del buscador: se cierra. El `focusout` lo resuelve el
   * `onBlur` del contenedor (en React burbujea), así que acá solo hace
   * falta el puntero — alguien puede tocar fuera sin mover el foco.
   */
  useEffect(() => {
    if (!abierto || hoja) return;
    const alTocarFuera = (e: PointerEvent) => {
      if (refShell.current && !refShell.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("pointerdown", alTocarFuera);
    return () => document.removeEventListener("pointerdown", alTocarFuera);
  }, [abierto, hoja]);

  /**
   * La hoja móvil SÍ es un diálogo modal: bloquea el scroll de atrás,
   * cierra con Escape y atrapa el foco. Sin la trampa, el siguiente Tab
   * se va a la página de abajo —que sigue ahí— y la persona escribe en
   * un formulario que no ve.
   */
  useEffect(() => {
    if (!hoja) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarHoja();
        return;
      }
      if (e.key !== "Tab") return;
      const nodo = refHoja.current;
      if (!nodo) return;
      const enfocables = Array.from(
        nodo.querySelectorAll<HTMLElement>("a[href], button, input, select, [tabindex]"),
      ).filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.hasAttribute("disabled") &&
          // Un ancestro `inert` (la vertical que no está activa) no es
          // enfocable aunque el selector lo encuentre.
          !el.closest("[inert]"),
      );
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", alTeclado);
    // El campo de texto es lo que la persona vino a usar: abrir la hoja
    // y tener que tocarlo aparte sería un toque de más en el gesto más
    // repetido de la portada.
    refQue.current?.focus();
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", alTeclado);
    };
  }, [hoja, cerrarHoja]);

  /**
   * Flechas ← → entre pestañas, Home/End a los extremos: el patrón APG
   * de `tablist`. Combinado con el tabindex rotatorio de abajo, las dos
   * pestañas ocupan UNA sola parada de tabulación, no dos.
   */
  function alTeclearPestanas(e: React.KeyboardEvent<HTMLDivElement>) {
    const actual = PESTANAS.indexOf(pestana);
    let destino = -1;
    if (e.key === "ArrowRight") destino = (actual + 1) % PESTANAS.length;
    else if (e.key === "ArrowLeft") destino = (actual - 1 + PESTANAS.length) % PESTANAS.length;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = PESTANAS.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    cambiarPestana(PESTANAS[destino]);
    refsTabs.current[destino]?.focus();
  }

  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAbierto(false);
    setHoja(false);
    router.push(urlBusqueda(pestana, comunes));
  }

  const claseEtiqueta =
    "mb-1 block text-[10px] font-extrabold uppercase tracking-[0.04em] text-aventurea-navy";
  const claseZona = "flex flex-col justify-center px-4 py-3 sm:px-5";
  const claseFoco =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aventurea-navy";

  return (
    <section
      id={id}
      ref={refShell}
      aria-label="Buscador de Bookea"
      className={`relative ${className}`}
      onKeyDown={(e) => {
        // Escape cierra el panel y devuelve el foco a quien lo abrió.
        // (La hoja móvil tiene el suyo a nivel de documento: ahí el foco
        // puede estar en cualquier parte de la pantalla completa.)
        if (e.key === "Escape" && abierto && !hoja) {
          e.stopPropagation();
          cerrarPanel(true);
        }
      }}
      onBlur={(e) => {
        // El foco se fue del buscador entero (no a otro campo de
        // adentro): se cierra. `relatedTarget` null = el foco se fue a
        // la ventana o a la barra del navegador; ahí no se toca nada.
        if (hoja || !e.relatedTarget) return;
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setAbierto(false);
      }}
    >
      {/* El envoltorio es `display: contents` mientras la hoja está
          cerrada: no existe como caja, así que en escritorio el
          buscador se maqueta como si este div no estuviera. Al abrir la
          hoja se vuelve el diálogo a pantalla completa y se lleva
          adentro las pestañas y el MISMO formulario — sin duplicar los
          campos, que es como se terminan enviando dos veces. */}
      <HojaPortal activo={hoja}>
      <div
        ref={refHoja}
        role={hoja ? "dialog" : undefined}
        aria-modal={hoja ? true : undefined}
        aria-label={hoja ? "Buscar en Bookea" : undefined}
        className={
          hoja
            ? "fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-aventurea-surface"
            : "contents"
        }
      >
        {hoja && (
          <div className="flex items-center gap-2 border-b border-aventurea-line px-3 py-2.5">
            <button
              type="button"
              onClick={cerrarHoja}
              aria-label="Cerrar el buscador"
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-aventurea-ink hover:bg-aventurea-cream-2 ${claseFoco}`}
            >
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-[13.5px] font-bold text-aventurea-ink">
              Buscar en Bookea
            </span>
          </div>
        )}

        <div
          role="tablist"
          aria-label="Tipo de búsqueda"
          onKeyDown={alTeclearPestanas}
          className={`flex gap-2 ${hoja ? "px-4 pt-3" : "mb-2.5 justify-center sm:justify-start"}`}
        >
          {PESTANAS.map((p, i) => {
            const activa = p === pestana;
            return (
              <a
                key={p}
                ref={(el) => {
                  refsTabs.current[i] = el;
                }}
                id={`${idBase}-tab-${p}`}
                href={TEXTOS[p].ruta}
                role="tab"
                aria-selected={activa}
                aria-controls={idCampos}
                /* El tabindex rotatorio solo se aplica DESPUÉS de
                   hidratar. Puesto desde el servidor dejaría la pestaña
                   inactiva fuera del tabulador para quien navega sin JS
                   — y ahí no hay flechas que la rescaten, porque las
                   flechas también son JavaScript. */
                tabIndex={conJs ? (activa ? 0 : -1) : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  cambiarPestana(p);
                }}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2.5 text-[12.5px] font-bold transition-colors sm:flex-none sm:min-w-[170px] ${claseFoco} ${
                  activa
                    ? "border-transparent bg-aventurea-surface text-aventurea-navy shadow-plano"
                    : sobreOscuro
                      ? "border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white"
                      : "border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink hover:border-aventurea-navy"
                }`}
              >
                <span className={activa ? "text-aventurea-orange" : ""}>
                  {ICONO_PESTANA[p]}
                </span>
                {TEXTOS[p].label}
              </a>
            );
          })}
        </div>

        {/* EL FORMULARIO DE VERDAD. `method="get"` + `action` al
            directorio de la pestaña activa: sin JavaScript esto ya
            busca. `group` es para el respaldo de `:focus-within` del
            panel. */}
        <form
          id={idCampos}
          role="tabpanel"
          aria-labelledby={`${idBase}-tab-${pestana}`}
          method="get"
          action={textos.ruta}
          onSubmit={alEnviar}
          /* Cuatro columnas desde `sm`: qué · país · región · buscar.
             Antes eran tres (qué · provincia · buscar). El país es una
             columna angosta a propósito —el nombre más largo del
             catálogo es "Costa Rica"— para no robarle ancho al campo de
             texto, que es el que la gente usa en cada búsqueda. */
          className={`group ${
            hoja
              ? "flex flex-1 flex-col px-4 pt-3"
              : "hidden rounded-4xl border border-aventurea-line bg-aventurea-surface p-2 shadow-flotante sm:grid sm:grid-cols-[1.5fr_0.85fr_1fr_auto] sm:items-stretch sm:p-2.5"
          }`}
        >
          {/* ── ¿QUÉ NECESITÁS? ──────────────────────────────────── */}
          <div className={`${claseZona} relative`}>
            <label htmlFor={idQue} className={claseEtiqueta}>
              {textos.etiquetaQue}
            </label>
            <div className="flex items-center gap-2">
              <IconSearch className="h-4 w-4 shrink-0 text-aventurea-ink-soft" />
              <input
                id={idQue}
                ref={refQue}
                type="search"
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={(e) => abrirPanel(e.currentTarget)}
                placeholder={textos.placeholderQue}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-aventurea-ink outline-none placeholder:text-zinc-500"
              />
              {/* El disparador explícito del panel: un botón de verdad,
                  con su `aria-expanded`, para quien navega con teclado o
                  lector de pantalla y no va a descubrir el panel solo
                  por enfocar el campo. */}
              <button
                type="button"
                aria-expanded={panelAbierto}
                aria-controls={idPanel}
                aria-label="Ver rubros y búsquedas populares"
                onClick={(e) =>
                  panelAbierto ? cerrarPanel(false) : abrirPanel(e.currentTarget)
                }
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-navy ${claseFoco}`}
              >
                <IconChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 ${
                    panelAbierto ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ── ¿EN QUÉ PAÍS? ────────────────────────────────────────
              El país es lo primero de la ubicación porque MANDA sobre
              lo que ofrece el campo de al lado. `<select>` nativo, como
              el de la región: funciona sin JavaScript (el form GET lo
              manda igual) y en el teléfono abre el selector del
              sistema.

              La bandera va DENTRO del texto de cada opción y no como
              ícono aparte: un `<option>` no admite marcado, y de paso
              el nombre siempre está escrito — una banderita sola es
              adivinanza. */}
          <div
            className={`${claseZona} border-t border-aventurea-line sm:border-l sm:border-t-0`}
          >
            <label htmlFor={idPais} className={claseEtiqueta}>
              País
            </label>
            <div className="flex items-center gap-2">
              <select
                id={idPais}
                name="pais"
                value={pais}
                onChange={(e) => cambiarPais(e.target.value)}
                className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-[13.5px] text-aventurea-ink outline-none"
              >
                {PAISES_BUSCADOR.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.bandera} {p.nombre}
                  </option>
                ))}
              </select>
              <IconChevronDown
                className="pointer-events-none h-3.5 w-3.5 shrink-0 text-aventurea-ink-soft"
                aria-hidden
              />
            </div>
          </div>

          {/* ── ¿DÓNDE? ──────────────────────────────────────────────
              La región de primer nivel DEL PAÍS ELEGIDO, con el nombre
              que ese país le da: Provincia en Costa Rica y Panamá,
              Estado en México, Departamento en Colombia.

              Los valores son EXACTAMENTE los que el directorio acepta
              (compara con tilde y mayúscula contra la columna
              `provincia`; cualquier otra cosa la ignora en silencio),
              porque salen del mismo catálogo contra el que
              `urlBusqueda` valida. */}
          <div
            className={`${claseZona} border-t border-aventurea-line sm:border-l sm:border-t-0`}
          >
            <label htmlFor={idDonde} className={claseEtiqueta}>
              {etiquetaDonde}
            </label>
            <div className="flex items-center gap-2">
              <IconPin className="h-4 w-4 shrink-0 text-aventurea-ink-soft" />
              <select
                id={idDonde}
                name="provincia"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-[13.5px] text-aventurea-ink outline-none"
              >
                <option value="">Todo el país</option>
                {regiones.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <IconChevronDown
                className="pointer-events-none h-3.5 w-3.5 shrink-0 text-aventurea-ink-soft"
                aria-hidden
              />
            </div>
          </div>

          {/* ── EL PANEL ─────────────────────────────────────────────
              Fila 2 del shell en escritorio, para que el botón Buscar
              siga a la derecha de los campos y el panel caiga debajo de
              los cuatro (eran tres antes de que el país fuera su propia
              columna). */}
          <div
            data-abierto={panelAbierto}
            className={`desplegable sm:col-span-4 sm:row-start-2 ${
              conJs ? "" : "group-focus-within:[grid-template-rows:1fr]"
            }`}
          >
            <div id={idPanel} inert={conJs && !panelAbierto}>
              {/* Las dos verticales se apilan en la MISMA celda de un
                  grid 1×1 (`pasos`): el panel mide siempre lo mismo y no
                  pega un salto al cambiar de pestaña. Las dos quedan en
                  el HTML —bien para el rastreo— pero la inactiva va
                  `inert`, así que no es enfocable ni la ve un lector de
                  pantalla. */}
              <div className="pasos px-1 pt-3 sm:px-4">
                {PESTANAS.map((p) => {
                  const activa = p === pestana;
                  return (
                    <div
                      key={p}
                      className="paso"
                      data-estado={activa ? "activo" : "saliendo"}
                      inert={!activa}
                    >
                      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-bookea-naranja-fuerte">
                        {TEXTOS[p].tituloRubros}
                      </p>

                      <div className="relative">
                        <div className="flex gap-2.5 overflow-x-auto py-1">
                          {RUBROS[p].map((rubro) => (
                            <Link
                              key={rubro.id}
                              href={urlBusqueda(p, { ...comunes, categoria: rubro.id })}
                              className={`flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-aventurea-line bg-aventurea-surface pl-1.5 pr-4 transition-colors hover:border-aventurea-navy ${claseFoco}`}
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-aventurea-sky/10 text-aventurea-orange [&_svg]:h-[18px] [&_svg]:w-[18px]">
                                {ICONOS[p][rubro.id]}
                              </span>
                              <span className="text-[13px] font-bold text-aventurea-ink">
                                {rubro.label}
                              </span>
                            </Link>
                          ))}
                          {/* Relleno: sin esto el degradado tapa el
                              último chip en vez de anunciar que hay más. */}
                          <div className="w-2 shrink-0" aria-hidden />
                        </div>
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-aventurea-surface to-transparent lg:hidden"
                        />
                      </div>

                      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-aventurea-ink-soft">
                        <span className="font-bold">Popular:</span>
                        {SUGERENCIAS[p].map((s) => (
                          <Link
                            key={s.label}
                            href={urlBusqueda(p, { ...s.parametros, ...comunes })}
                            className={`font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange ${claseFoco}`}
                          >
                            {s.label}
                          </Link>
                        ))}
                      </p>

                      <p className="mt-2 pb-1">
                        <Link
                          href={urlBusqueda(p, comunes)}
                          className={`text-[12px] font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange ${claseFoco}`}
                        >
                          {TEXTOS[p].verTodo} →
                        </Link>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── BUSCAR ───────────────────────────────────────────────
              En la hoja se pega abajo con el respiro de la barra del
              sistema: en iPhone una barra fija sin
              `env(safe-area-inset-bottom)` se tapa a sí misma. */}
          <div
            className={`flex items-center sm:col-start-4 sm:row-start-1 sm:px-2 ${
              hoja
                ? "sticky bottom-0 -mx-4 mt-auto border-t border-aventurea-line bg-aventurea-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
                : "px-2 pb-1 pt-2 sm:pb-0 sm:pt-0"
            }`}
          >
            <button
              type="submit"
              className={`btn-naranja presionable h-12 w-full sm:w-auto ${claseFoco}`}
            >
              <IconSearch className="h-4 w-4" />
              Buscar
            </button>
          </div>
        </form>
      </div>
      </HojaPortal>

      {/* ── EL COMPACTO DE MÓVIL ────────────────────────────────────
          El shell de tres columnas no cabe en 390 px, así que abajo de
          `sm` la barra es este único botón y los campos viven en la
          hoja. Es un `<a>` al directorio a propósito: sin JavaScript
          lleva a `/citas` (o `/eventos`), que trae su propio buscador,
          en vez de ser un botón que no hace nada. */}
      <a
        ref={refBotonMovil}
        href={textos.ruta}
        aria-haspopup="dialog"
        aria-expanded={hoja}
        onClick={(e) => {
          e.preventDefault();
          setHoja(true);
        }}
        className={`h-14 items-center gap-2.5 rounded-2xl border border-aventurea-line bg-aventurea-surface px-4 shadow-flotante sm:hidden ${claseFoco} ${
          hoja ? "hidden" : "flex"
        }`}
      >
        <IconSearch className="h-4 w-4 shrink-0 text-bookea-naranja-fuerte" />
        <span className="truncate text-[13.5px] font-bold text-aventurea-ink">
          {q || textos.etiquetaQue}
        </span>
        <IconChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-aventurea-ink-soft" />
      </a>
    </section>
  );
}
