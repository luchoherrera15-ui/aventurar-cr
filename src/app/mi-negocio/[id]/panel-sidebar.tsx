"use client";

import Link from "next/link";
import { Fragment, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@/components/icons";
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
    setSelectorAbierto(false);
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
          const base =
            "flex items-center gap-2.5 rounded-xl border-l-[3px] px-3.5 py-2.5 text-[13.5px] font-bold transition-colors";
          const cls = t.proximamente
            ? `${base} cursor-default border-transparent text-white/30`
            : `${base} border-transparent ${
                activa ? "text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`;
          // El acento pinta el ítem activo. Sin `acento` (o si alguien
          // reusa este componente sin pasarlo) cae al blanco tenue de
          // siempre, así que nunca queda un ítem sin fondo.
          const estilo: CSSProperties | undefined = activa
            ? {
                background: "var(--acento-solido, rgba(255,255,255,.10))",
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
                <span className="shrink-0 rounded-lg border border-white/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none tracking-wide text-white/35">
                  Pronto
                </span>
              )}
              {!!t.badge && t.badge > 0 && (
                <span className="shrink-0 rounded-lg bg-aventurea-sky px-1.5 py-0.5 text-[10.5px] font-extrabold leading-none text-white">
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
                <p
                  className={`px-3.5 pb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35 ${primerGrupo ? "" : "mt-3"}`}
                >
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
    // 236px y no 224: el menú pasó de cuatro ítems a los de todo el tipo
    // de negocio, y "Paquetes y bonos" o "Formularios" con su marca
    // «Pronto» al lado no entraban sin truncarse a la mitad.
    <div
      className="lg:grid lg:grid-cols-[236px_1fr] lg:items-start lg:gap-8"
      style={acento as CSSProperties | undefined}
    >
      {/* top-20 (80px): el header del panel mide 64px fijos, así que el
          offset deja de ser una adivinanza. Envuelve identidad+nav para
          que las dos suban pegadas al hacer scroll, como un solo bloque. */}
      <div className="lg:sticky lg:top-20">
        {identidad && (
          <div className="mb-3 rounded-3xl bg-gradient-to-br from-aventurea-navy-2 to-aventurea-navy p-4 text-white shadow-lg">
            {identidad}
          </div>
        )}

        {/* Desktop: columna fija. `max-h`/`overflow-y-auto`: el menú de
            un consultorio son doce ítems y en una laptop de 768px de
            alto los últimos quedaban abajo del pliegue, sin scroll
            propio porque la columna es sticky. */}
        <aside className="hidden shrink-0 rounded-3xl bg-gradient-to-br from-aventurea-navy-2 to-aventurea-navy p-3 lg:block lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto">
          {itemsNav(() => {})}
        </aside>

        {/* Mobile: botón con la sección activa que despliega el menú
            justo debajo — mismo patrón que el selector de categorías
            del chat, no un panel de pantalla completa. */}
        <div className="relative mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSelectorAbierto((v) => !v)}
            aria-expanded={selectorAbierto}
            className="flex w-full items-center justify-between gap-2 rounded-2xl bg-gradient-to-br from-aventurea-navy-2 to-aventurea-navy px-4 py-3 text-[14px] font-bold text-white shadow-sm"
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
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setSelectorAbierto(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              {/* Alto tope + scroll propio: en el teléfono el menú
                  completo de un tipo con muchos módulos se pasaba de
                  pantalla y los últimos ítems quedaban inalcanzables. */}
              <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-[65svh] overflow-y-auto rounded-2xl bg-aventurea-navy p-3 shadow-2xl">
                {itemsNav(() => setSelectorAbierto(false))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contenido — mismo truco de `hidden` de siempre: nunca se
          pierde un formulario a medio llenar al cambiar de sección. */}
      <div className="min-w-0">
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
  );
}
