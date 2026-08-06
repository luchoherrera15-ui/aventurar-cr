"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconChevronDown } from "@/components/icons";

/** Con `href` el ítem es un link a otra pantalla (sin contenido acá). */
export type Tab = {
  id: string;
  label: string;
  content?: ReactNode;
  href?: string;
  /** Contador chiquito al lado del label (ej. reservas por aprobar). */
  badge?: number;
  icon?: ReactNode;
};

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
  const inicial = searchParams.get("tab");
  const [activo, setActivo] = useState(
    inicial && tabs.some((t) => t.id === inicial) ? inicial : defaultTab,
  );
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  // Los accesos rápidos del encabezado (ej. "Editar perfil y fotos")
  // navegan con `?tab=` sin pasar por el menú de acá — cuando el
  // parámetro cambia desde afuera, la sección activa lo sigue. Se
  // ajusta durante el render (patrón oficial de React para derivar
  // estado de una prop que cambió), no en un efecto.
  const [previo, setPrevio] = useState(inicial);
  if (inicial !== previo) {
    setPrevio(inicial);
    if (inicial && inicial !== activo && tabs.some((t) => t.id === inicial && !t.href)) {
      setActivo(inicial);
    }
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

  function itemsNav(alCerrar: () => void) {
    return (
      <nav className="flex flex-col gap-1">
        {tabs.map((t) => {
          const activa = esActivo(t);
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
          return t.href ? (
            <Link key={t.id} href={t.href} className={cls} onClick={alCerrar}>
              {contenidoItem}
            </Link>
          ) : (
            <button key={t.id} type="button" onClick={() => cambiar(t.id)} className={cls}>
              {contenidoItem}
            </button>
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
