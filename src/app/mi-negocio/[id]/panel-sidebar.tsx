"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
   * En la barra horizontal se vuelve un separador con su nombre.
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
 * El menú del panel: una BARRA HORIZONTAL navy arriba del contenido, a
 * todo el ancho — el dashboard usa el navegador entero y el contenido
 * gana los ~224px que antes se comía la columna lateral (se nota en el
 * calendario y en las tablas).
 *
 * Mismo mecanismo de fondo de siempre: todas las secciones quedan
 * montadas (solo se ocultan con `hidden`), así un formulario a medio
 * llenar no se pierde al cambiar de sección — y la sección activa vive
 * en `?tab=` para poder compartir el link o volver con el botón atrás.
 *
 * En pantallas angostas la misma barra se desliza en horizontal (con
 * scroll-snap), sin desplegable ni panel aparte: el menú se ve igual en
 * el teléfono que en la compu, que es lo que uno espera de una barra.
 */
export default function PanelSidebar({ tabs, defaultTab }: { tabs: Tab[]; defaultTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const resuelto = resolverTab(paramTab, tabs);
  const [activo, setActivo] = useState(resuelto ?? defaultTab);

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
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Los ítems `href` (Citas, que navega a una ruta de verdad) se marcan
  // activos por pathname; el resto, por el estado `activo`.
  const esActivo = (t: Tab) => (t.href ? pathname.startsWith(t.href) : activo === t.id);

  // Los separadores de bloque (AGENDA · GESTIÓN · FINANZAS) solo
  // aparecen cuando el menú de verdad los necesita: con los cuatro
  // ítems de una barbería agrupar es ruido, con los nueve de un
  // gimnasio es lo único que lo hace leíble.
  const gruposDistintos = new Set(tabs.map((t) => t.grupo).filter(Boolean)).size;
  const conSeparadores = gruposDistintos > 1 && tabs.length > 5;

  // El separador se decide comparando con el ítem ANTERIOR (los tabs
  // vienen agrupados en orden), sin mutar nada durante el render — el
  // compilador de React no permite lo segundo, y con razón.
  const conSeparador = tabs.map(
    (t, i) => conSeparadores && !!t.grupo && i > 0 && t.grupo !== tabs[i - 1]?.grupo,
  );

  return (
    <div>
      {/* La barra: navy, pegajosa arriba, y con scroll horizontal
          cuando el menú no cabe. `-mx-1 px-1` deja respirar el anillo
          de foco del primer y último ítem al recorrerla con teclado. */}
      <nav
        aria-label="Secciones del panel"
        className="sticky top-[76px] z-20 mb-5 flex snap-x items-center gap-1 overflow-x-auto rounded-2xl bg-aventurea-navy p-1.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t, i) => {
          const activa = esActivo(t);
          const cls = `flex shrink-0 snap-start items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold transition-colors ${
            activa
              ? "bg-white text-aventurea-navy shadow-sm"
              : "text-white/65 hover:bg-white/10 hover:text-white"
          }`;
          const contenidoItem = (
            <>
              {t.icon && (
                <span className="shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]">{t.icon}</span>
              )}
              <span className="whitespace-nowrap">{t.label}</span>
              {!!t.badge && t.badge > 0 && (
                <span
                  className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10.5px] font-extrabold leading-none ${
                    activa ? "bg-aventurea-navy text-white" : "bg-aventurea-sky text-white"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </>
          );

          return (
            <Fragment key={t.id}>
              {conSeparador[i] && (
                <span
                  className="shrink-0 self-stretch border-l border-white/15 pl-2.5 pr-1 text-[9.5px] font-bold uppercase leading-[2.6] tracking-[0.14em] text-white/30"
                  aria-hidden
                >
                  {GRUPO_LABEL[t.grupo as GrupoId]}
                </span>
              )}
              {t.href ? (
                <Link href={t.href} className={cls}>
                  {contenidoItem}
                </Link>
              ) : (
                <button type="button" onClick={() => cambiar(t.id)} className={cls}>
                  {contenidoItem}
                </button>
              )}
            </Fragment>
          );
        })}
      </nav>

      {/* Contenido a todo el ancho — mismo truco de `hidden` de
          siempre: nunca se pierde un formulario a medio llenar al
          cambiar de sección. */}
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
