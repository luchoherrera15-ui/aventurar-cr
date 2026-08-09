"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
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
 */
export default function PanelSidebar({ tabs, defaultTab }: { tabs: Tab[]; defaultTab: string }) {
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
  // activos por pathname; el resto, por el estado `activo`.
  const esActivo = (t: Tab) => (t.href ? pathname.startsWith(t.href) : activo === t.id);

  // Los encabezados de bloque (AGENDA, GESTIÓN, FITNESS…) solo aparecen
  // cuando el menú de verdad los necesita: con los cuatro ítems de una
  // barbería agrupar es ruido, con los nueve de un gimnasio es lo único
  // que lo hace leíble.
  const gruposDistintos = new Set(tabs.map((t) => t.grupo).filter(Boolean)).size;
  const conEncabezados = gruposDistintos > 1 && tabs.length > 5;

  function itemsNav(alCerrar: () => void) {
    let grupoPintado: GrupoId | undefined;
    return (
      <nav className="flex flex-col gap-1">
        {tabs.map((t) => {
          const activa = esActivo(t);
          const abreGrupo = conEncabezados && !!t.grupo && t.grupo !== grupoPintado;
          const primerGrupo = abreGrupo && grupoPintado === undefined;
          if (t.grupo) grupoPintado = t.grupo;
          const cls = `flex items-center gap-2.5 rounded-xl border-l-[3px] px-3.5 py-2.5 text-[13.5px] font-bold transition-colors ${
            activa
              ? "border-aventurea-sky bg-white/10 text-white"
              : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
          }`;
          const contenidoItem = (
            <>
              {t.icon && <span className="shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]">{t.icon}</span>}
              {/* text-center explícito: los <button> centran su texto
                  por defecto pero los <Link> no — sin esto, el único
                  ítem con href (Citas) quedaba corrido a la izquierda. */}
              <span className="flex-1 truncate text-center">{t.label}</span>
              {!!t.badge && t.badge > 0 && (
                <span className="shrink-0 rounded-lg bg-aventurea-sky px-1.5 py-0.5 text-[10.5px] font-extrabold leading-none text-white">
                  {t.badge}
                </span>
              )}
            </>
          );
          const item = t.href ? (
            <Link href={t.href} className={cls} onClick={alCerrar}>
              {contenidoItem}
            </Link>
          ) : (
            <button type="button" onClick={() => cambiar(t.id)} className={cls}>
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
    <div className="lg:grid lg:grid-cols-[224px_1fr] lg:items-start lg:gap-8">
      {/* Desktop: columna fija */}
      <aside className="sticky top-[88px] hidden shrink-0 rounded-3xl bg-aventurea-navy p-3 lg:block">
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
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-aventurea-line bg-aventurea-navy px-4 py-3 text-[14px] font-bold text-white shadow-sm"
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
            <div className="absolute left-0 right-0 top-full z-20 mt-1.5 rounded-2xl bg-aventurea-navy p-3 shadow-2xl">
              {itemsNav(() => setSelectorAbierto(false))}
            </div>
          </>
        )}
      </div>

      {/* Contenido — mismo truco de `hidden` de siempre: nunca se
          pierde un formulario a medio llenar al cambiar de sección. */}
      <div className="min-w-0">
        {tabs
          .filter((t) => !t.href)
          .map((t) => (
            <div key={t.id} className={activo === t.id ? "" : "hidden"}>
              {t.content}
            </div>
          ))}
      </div>
    </div>
  );
}
