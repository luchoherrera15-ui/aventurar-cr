"use client";

import Link from "next/link";
import { Fragment, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@/components/icons";
import { RAIL_GRUPO, RAIL_ITEM } from "@/components/panel/sistema";
import { GRUPO_LABEL, type GrupoId } from "@/lib/business/modulos";

/** Con `href` el ítem es un link a otra pantalla (sin contenido acá). */
export type Tab = {
  id: string;
  label: string;
  content?: ReactNode;
  href?: string;
  /** Contador chiquito al lado del label (ej. reservas por aprobar). */
  badge?: number;
  icon?: ReactNode;
  /**
   * El tipo de negocio declara este módulo pero todavía no hay pantalla.
   * Se pinta apagado, con la marca «Pronto», y NO es clickeable — ni
   * botón ni enlace: un <span>. Que no exista el elemento interactivo es
   * lo que garantiza que no pueda llevar a un 404 ni recibir el teclado.
   *
   * Se muestra igual (en vez de esconderlo) porque es lo que hace que el
   * panel se vea del rubro: un consultorio con sus cinco secciones
   * clínicas apagadas se reconoce como consultorio; sin ellas es una
   * barbería de otro color.
   */
  proximamente?: boolean;
  /**
   * El bloque del menú al que pertenece (Agenda, Gestión, Fitness…).
   * Solo se pinta el encabezado cuando el menú es largo — ver abajo.
   */
  grupo?: GrupoId;
  /**
   * Nombres viejos de `?tab=` que ahora aterrizan acá. Existen porque
   * hay links guardados y correos ya enviados que apuntan a pestañas
   * que se fusionaron (ej. `?tab=agenda` → Inicio, `?tab=precios` →
   * Configuración): sin esto caerían en la pestaña por defecto sin
   * avisar.
   */
  alias?: string[];
};

/** El id de pestaña real detrás de un `?tab=` (propio o heredado). */
function resolverTab(param: string | null, tabs: Tab[]): string | null {
  if (!param) return null;
  const directo = tabs.find((t) => t.id === param && !t.href);
  if (directo) return directo.id;
  return tabs.find((t) => !t.href && t.alias?.includes(param))?.id ?? null;
}

/**
 * El panel de dueño como dashboard con menú lateral. Mismo mecanismo de
 * fondo que la versión de pestañas horizontales que reemplaza: todas
 * las secciones quedan montadas (solo se ocultan con `hidden`), así un
 * formulario a medio llenar no se pierde al cambiar de sección — y la
 * sección activa vive en `?tab=` para poder compartir el link o volver
 * con el botón atrás del navegador.
 *
 * Desktop: columna navy fija a la izquierda. Mobile (<1024px): un
 * botón con la sección activa despliega el mismo menú justo debajo,
 * como el selector de categorías del chat flotante (no un panel de
 * pantalla completa).
 *
 * `identidad` y `encabezado` migran este panel al mismo lenguaje visual
 * que /cuenta (sidebar navy con degradé, identidad+nav en una sola
 * tarjeta): `identidad` va DENTRO de la columna navy, arriba del menú
 * — antes vivía como su propia tarjeta blanca separada, en
 * `[id]/page.tsx`. Los avisos de estado (pendiente/rechazado) y la fila
 * de datos (capacidad, precio, WhatsApp) no la acompañaron: en una
 * columna de 224px ese texto se apretaría feo, así que quedan en
 * `encabezado`, arriba del contenido de la pestaña — donde ya hay
 * ancho de sobra.
 */
export default function PanelSidebar({
  tabs,
  defaultTab,
  identidad,
  encabezado,
  acento,
}: {
  tabs: Tab[];
  defaultTab: string;
  identidad?: ReactNode;
  encabezado?: ReactNode;
  /**
   * El acento del tipo de negocio como variables CSS, tal como las
   * devuelve `variablesAcento(identidad)`. Entra UNA vez en el
   * contenedor y el ítem activo lo lee con `var(--acento-solido)`; así
   * no hay un solo hexadecimal suelto acá adentro y un spa se pinta
   * aguamarina sin que este componente sepa qué es un spa.
   *
   * Se usan `solido`/`sobreSolido` y no `tinta` a propósito: la columna
   * es navy oscuro y la tinta está calibrada para leerse sobre blanco.
   * El relleno sólido con letra blanca es justo el papel que declara
   * `Acento.solido` ("pastilla del tipo activo"), y su contraste ya está
   * medido en identidad.ts.
   */
  acento?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const resuelto = resolverTab(paramTab, tabs);
  const [activo, setActivo] = useState(resuelto ?? defaultTab);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  // El menú del teléfono: el botón que lo abre y el id del panel que
  // despliega. El ref existe para DEVOLVER EL FOCO — sin él, al cerrar
  // con Escape o al elegir una sección, el foco del teclado se quedaba
  // en un elemento que acababa de desaparecer del árbol y el navegador
  // lo mandaba al principio del documento: quien navega con teclado
  // tenía que recorrer el header entero de nuevo para volver al menú.
  const botonMenuRef = useRef<HTMLButtonElement>(null);
  const idMenuMovil = useId();

  /** Cierra el menú del teléfono y devuelve el foco al botón que lo abrió. */
  function cerrarMenuMovil() {
    setSelectorAbierto(false);
    botonMenuRef.current?.focus();
  }

  // Los accesos rápidos del encabezado (ej. "Editar perfil y fotos")
  // navegan con `?tab=` sin pasar por el menú de acá — cuando el
  // parámetro cambia desde afuera, la sección activa lo sigue. Se
  // ajusta durante el render (patrón oficial de React para derivar
  // estado de una prop que cambió), no en un efecto.
  const [previo, setPrevio] = useState(paramTab);
  if (paramTab !== previo) {
    setPrevio(paramTab);
    if (resuelto && resuelto !== activo) setActivo(resuelto);
  }

  function cambiar(id: string) {
    setActivo(id);
    // Solo se devuelve el foco si el menú del teléfono estaba abierto:
    // en escritorio el botón está oculto (`lg:hidden`) y mandarle el
    // foco sería mandarlo a la nada.
    if (selectorAbierto) cerrarMenuMovil();
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Los ítems `href` (Citas, que navega a una ruta de verdad) se marcan
  // activos por pathname; el resto, por el estado `activo`. Los atajos a
  // una sección de Configuración llevan `?query` en el href y por eso
  // nunca matchean: el activo en ese caso es la pestaña a la que caen.
  const esActivo = (t: Tab) =>
    !t.proximamente && (t.href ? !t.href.includes("?") && pathname.startsWith(t.href) : activo === t.id);

  // Los encabezados de bloque (AGENDA, GESTIÓN, CLÍNICO, FITNESS…) solo
  // aparecen cuando el menú de verdad los necesita: con cuatro ítems
  // agrupar es ruido, con los doce de un consultorio es lo único que lo
  // hace leíble.
  const gruposDistintos = new Set(tabs.map((t) => t.grupo).filter(Boolean)).size;
  const conEncabezados = gruposDistintos > 1 && tabs.length > 4;

  function itemsNav(alCerrar: () => void) {
    let grupoPintado: GrupoId | undefined;
    return (
      <nav className="flex flex-col gap-1">
        {tabs.map((t) => {
          const activa = esActivo(t);
          const abreGrupo = conEncabezados && !!t.grupo && t.grupo !== grupoPintado;
          const primerGrupo = abreGrupo && grupoPintado === undefined;
          if (t.grupo) grupoPintado = t.grupo;
          // La piel del ítem sale del sistema del panel
          // (`components/panel/sistema.ts`), que es donde está medido su
          // contraste; acá solo se decide QUÉ estado tiene cada uno.
          //
          // SE FUERON LOS ALFAS. El reposo era `text-white/60` y el
          // hover `bg-white/5`: como la columna es un DEGRADÉ, el mismo
          // estado terminaba viéndose de dos colores según a qué altura
          // del menú cayera el ítem, y su contraste no se podía medir
          // una vez y darlo por bueno. Ahora los dos son sólidos —
          // `--color-aventurea-rail` (4,93:1 arriba, 6,33:1 abajo) y
          // `navy-3` con letra blanca (8,31:1).
          const base = RAIL_ITEM;
          const cls = t.proximamente
            ? `${base} cursor-default text-aventurea-rail`
            : `${base} ${
                activa
                  ? "text-white"
                  : "text-aventurea-rail hover:bg-aventurea-navy-3 hover:text-white"
              }`;
          // El acento pinta el ítem activo. Sin `acento` (o si alguien
          // reusa este componente sin pasarlo) cae al navy elevado, que
          // también es sólido: nunca queda un ítem sin fondo.
          //
          // La maqueta marca el activo con `rgba(255,255,255,.12)` +
          // una barrita `inset 3px 0 var(--accent)`. Acá el relleno
          // ENTERO es el acento, y no es un descuido: (a) ese blanco al
          // 12% es un alfa marcando estado, justo lo que la auditoría
          // dejó afuera; (b) con el relleno sólido, una barrita del
          // mismo color sería invisible, y con un relleno navy la
          // barrita desaparecería para los acentos azul y navy, que
          // caen encima del propio fondo del rail. Un relleno sólido
          // del rubro se ve de lejos, se mide una vez (≥5,18:1 en los
          // ocho acentos, `identidad.test.ts`) y no depende del degradé.
          //
          // El `border-l-[3px] border-transparent` de `RAIL_ITEM` se
          // queda igual: reserva los 3px para que el texto no se corra
          // al pasar de reposo a activo.
          const estilo: CSSProperties | undefined = activa
            ? {
                background: "var(--acento-solido, #2f4a94)",
                color: "var(--acento-sobre, white)",
              }
            : undefined;
          const contenidoItem = (
            <>
              {t.icon && <span className="shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]">{t.icon}</span>}
              {/* text-center explícito: los <button> centran su texto
                  por defecto pero los <Link> no — sin esto, el único
                  ítem con href (Citas) quedaba corrido a la izquierda. */}
              <span className="flex-1 truncate text-center">{t.label}</span>
              {t.proximamente && (
                <span className="shrink-0 rounded-lg border border-aventurea-navy-3 px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none tracking-wide text-aventurea-rail">
                  Pronto
                </span>
              )}
              {/* Blanco sólido con letra navy (13,88:1) y no el celeste
                  con letra blanca de antes: ese par daba 4,42:1 —bajo AA
                  para 10,5px— y encima el celeste sobre la columna navy
                  casi no se despegaba del fondo. El contador es lo único
                  que tiene que saltar del menú. */}
              {!!t.badge && t.badge > 0 && (
                <span className="shrink-0 rounded-lg bg-white px-1.5 py-0.5 text-[10.5px] font-extrabold leading-none text-aventurea-navy">
                  {t.badge}
                </span>
              )}
            </>
          );
          const item = t.proximamente ? (
            // Ni <button> ni <Link>: un módulo sin pantalla no puede
            // tener nada que clickear. `title` explica el porqué al pasar
            // el mouse, sin ocupar lugar en la columna.
            <span className={cls} title={`${t.label} viene en camino — todavía no se puede abrir.`}>
              {contenidoItem}
            </span>
          ) : t.href ? (
            <Link href={t.href} className={cls} style={estilo} onClick={alCerrar}>
              {contenidoItem}
            </Link>
          ) : (
            <button type="button" onClick={() => cambiar(t.id)} className={cls} style={estilo}>
              {contenidoItem}
            </button>
          );
          return (
            <Fragment key={t.id}>
              {abreGrupo && (
                <p className={`${RAIL_GRUPO} ${primerGrupo ? "" : "mt-3"}`}>
                  {GRUPO_LABEL[t.grupo as GrupoId]}
                </p>
              )}
              {item}
            </Fragment>
          );
        })}
      </nav>
    );
  }

  const seccionActiva = tabs.find((t) => esActivo(t));

  return (
    /* ======== SHELL DE APLICACIÓN, NO CONTENEDOR CENTRADO ========
     *
     * El menú va PEGADO AL BORDE IZQUIERDO de la ventana y el contenido
     * ocupa lo que queda. Antes esto era una grilla adentro de un
     * `max-w-[1900px] mx-auto`, así que en un monitor de 2560 el menú
     * "flotaba" a 330px del borde con aire muerto a los dos lados; ahora
     * el aire sobrante queda del lado del contenido, que es donde se
     * puede centrar sin que se note.
     *
     * 252px de columna (276 desde xl, donde sobra ancho) y sin gap: el
     * aire entre el menú y el contenido ahora lo pone el padding del
     * contenido, no un hueco de la grilla — con un gap, la columna navy
     * dejaba una franja crema a su derecha que la volvía a hacer ver
     * como una tarjeta flotante en vez de un borde de la aplicación.
     * El ancho sale de los labels: "Bloqueos y ausencias" con su ícono
     * es el ítem más largo del menú.
     *
     * Debajo de lg no hay grilla ni columna: el menú colapsa al selector
     * del teléfono y todo ocupa el ancho completo.
     *
     * El `onKeyDown` está acá arriba y no en el botón a propósito: con
     * el menú abierto el foco está adentro de la lista desplegada, así
     * que Escape tiene que escucharse en el ancestro común de las dos
     * piezas o no llega. React propaga el evento por el árbol de
     * componentes, así que alcanza con este único manejador.
     */
    <div
      className="lg:grid lg:grid-cols-[252px_1fr] lg:items-start xl:grid-cols-[276px_1fr]"
      style={acento as CSSProperties | undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && selectorAbierto) {
          e.stopPropagation();
          cerrarMenuMovil();
        }
      }}
    >
      {/* LA COLUMNA NAVY, de borde a header y hasta abajo de la pantalla.
          `top-16` = los 64px fijos del header, así que el offset no es
          una adivinanza; `h-[calc(100svh-4rem)]` + `overflow-y-auto` le
          dan scroll propio, que es lo que necesita el menú de doce ítems
          de un consultorio en una laptop de 768px de alto.
          Debajo de lg esto es un bloque normal con el padding de la
          página: no hay rail que pintar. */}
      <div className="px-4 pt-6 sm:px-6 lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:overflow-y-auto lg:bg-aventurea-rail-fondo lg:px-4 lg:pb-6 lg:pt-5">
        {identidad && (
          /* En el teléfono la identidad es su propia tarjeta navy; en el
             rail ya ESTÁ sobre navy, así que ahí se queda sin tarjeta
             (una tarjeta navy sobre una columna navy es un rectángulo
             invisible) y la separa del menú una línea sólida de la misma
             familia — `navy-3`, no un blanco con alfa. */
          <div className="mb-3 rounded-3xl bg-aventurea-rail-fondo p-4 text-white shadow-lg lg:mb-4 lg:rounded-none lg:border-b lg:border-aventurea-navy-3 lg:bg-none lg:p-0 lg:pb-4 lg:shadow-none">
            {identidad}
          </div>
        )}

        {/* Desktop: el menú, ya sin tarjeta propia — la columna entera es
            la tarjeta. */}
        <aside className="hidden lg:block">{itemsNav(() => {})}</aside>

        {/* EL MENÚ EN EL TELÉFONO: botón con la sección activa que
            despliega la lista justo debajo — mismo patrón que el
            selector de categorías del chat, no un panel de pantalla
            completa. Se abre tocando el botón (o con Enter/Espacio,
            porque es un <button> de verdad) y se cierra de tres
            maneras: eligiendo una sección, tocando fuera, o con Escape.
            En las tres el foco vuelve al botón.

            `aria-controls` + `aria-expanded` son lo que hace que un
            lector de pantalla anuncie "contraído/expandido" en vez de
            leer un botón mudo. */}
        <div className="relative mb-4 lg:hidden">
          <button
            ref={botonMenuRef}
            type="button"
            onClick={() => setSelectorAbierto((v) => !v)}
            aria-expanded={selectorAbierto}
            aria-controls={idMenuMovil}
            aria-haspopup="true"
            className="flex w-full items-center justify-between gap-2 rounded-2xl bg-aventurea-rail-fondo px-4 py-3 text-[14px] font-bold text-white shadow-sm"
          >
            <span className="flex items-center gap-2 truncate">
              {seccionActiva?.icon && (
                <span className="shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]">{seccionActiva.icon}</span>
              )}
              <span className="truncate">{seccionActiva?.label}</span>
            </span>
            <IconChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${selectorAbierto ? "rotate-180" : ""}`}
            />
          </button>

          {selectorAbierto && (
            <>
              {/* La capa de "tocar fuera para cerrar". `tabIndex={-1}` +
                  `aria-hidden`: es un atajo del mouse, no un control —
                  si quedara en el orden de tabulación, quien navega con
                  teclado se toparía con un botón invisible entre el
                  menú y el contenido. Con teclado el equivalente es
                  Escape, que lo maneja el contenedor de arriba. */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={cerrarMenuMovil}
                className="fixed inset-0 z-10 cursor-default"
              />
              {/* Alto tope + scroll propio: en el teléfono el menú
                  completo de un tipo con muchos módulos se pasaba de
                  pantalla y los últimos ítems quedaban inalcanzables. */}
              <div
                id={idMenuMovil}
                className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-[65svh] overflow-y-auto rounded-2xl bg-aventurea-navy p-3 shadow-2xl"
              >
                {/* Acá NO se devuelve el foco, y no es un olvido:
                    `alCerrar` solo lo usan los ítems con `href`, que
                    navegan a OTRA pantalla — devolverle el foco a un
                    botón que está por desmontarse no sirve de nada. Los
                    ítems que cambian de pestaña sin navegar pasan por
                    `cambiar()`, que sí llama a `cerrarMenuMovil()`. */}
                {itemsNav(() => setSelectorAbierto(false))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contenido — mismo truco de `hidden` de siempre: nunca se
          pierde un formulario a medio llenar al cambiar de sección. */}
      <div className="min-w-0 px-4 pb-12 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8 2xl:px-10">
        {/* ======== EL TOPE DE LEGIBILIDAD: 1560px ========
         *
         * Que el menú vaya al borde no autoriza a que una fila de datos
         * mida 2200px. El número no es un gusto:
         *
         *  · Es EXACTAMENTE el ancho de trabajo que el panel ya tenía.
         *    Con el contenedor centrado de 1900px, en un monitor de 1920
         *    al contenido le quedaban 1900 − 80 (padding) − 292 (menú +
         *    gap) = 1528px. Acá son 1560. O sea: nada se angostó ni se
         *    ensanchó de golpe; lo que cambió es DÓNDE está el aire
         *    sobrante — antes se repartía a los dos lados y el menú
         *    quedaba flotando, ahora el menú toma el borde y el resto se
         *    centra a la derecha.
         *  · Es lo que necesitan las piezas más anchas del tablero: la
         *    fila de cuatro tarjetas de números queda a ~380px cada una
         *    (el ancho a partir del cual «₡12.500.000» deja de
         *    truncarse) y la grilla de "Tus herramientas" cierra sus
         *    cuatro columnas sin estirarse.
         *  · De ahí para arriba empieza el problema de verdad: en una
         *    fila de tabla el rótulo de la izquierda y el monto de la
         *    derecha se separan tanto que hay que volver a buscar el
         *    renglón. La prosa ya trae su propio tope (`max-w-[70ch]`,
         *    `max-w-[60ch]`), pero las tablas y las grillas no.
         *
         * `mx-auto`: pasado ese ancho el contenido se centra en lo que
         * sobra, con el menú siempre clavado al borde. */}
        <div className="mx-auto w-full max-w-[1560px]">
          {encabezado}
          {/* Los `href` navegan a otra pantalla y los `proximamente` no
              tienen contenido: ninguno de los dos monta nada acá. */}
          {tabs
            .filter((t) => !t.href && !t.proximamente)
            .map((t) => (
              <div key={t.id} className={activo === t.id ? "" : "hidden"}>
                {t.content}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
