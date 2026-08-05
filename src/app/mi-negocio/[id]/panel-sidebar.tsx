"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconMenu } from "@/components/icons";

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
 * botón "Menú" abre el mismo menú como panel deslizado encima.
 */
export default function PanelSidebar({ tabs, defaultTab }: { tabs: Tab[]; defaultTab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inicial = searchParams.get("tab");
  const [activo, setActivo] = useState(
    inicial && tabs.some((t) => t.id === inicial) ? inicial : defaultTab,
  );
  const [drawerAbierto, setDrawerAbierto] = useState(false);

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
    setDrawerAbierto(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Los ítems `href` (Citas, que navega a una ruta de verdad) se marcan
  // activos por pathname; el resto, por el estado `activo`.
  const esActivo = (t: Tab) => (t.href ? pathname.startsWith(t.href) : activo === t.id);

  const listaItems = (
    <nav className="flex flex-col gap-1">
      {tabs.map((t) => {
        const activa = esActivo(t);
        const cls = `flex items-center gap-2.5 rounded-xl border-l-[3px] px-3.5 py-2.5 text-[13.5px] font-bold transition-colors ${
          activa
            ? "border-aventurea-orange bg-white/10 text-white"
            : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
        }`;
        const contenidoItem = (
          <>
            {t.icon && <span className="shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]">{t.icon}</span>}
            <span className="flex-1 truncate">{t.label}</span>
            {!!t.badge && t.badge > 0 && (
              <span className="shrink-0 rounded-lg bg-aventurea-orange px-1.5 py-0.5 text-[10.5px] font-extrabold leading-none text-white">
                {t.badge}
              </span>
            )}
          </>
        );
        return t.href ? (
          <Link key={t.id} href={t.href} className={cls} onClick={() => setDrawerAbierto(false)}>
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

  const seccionActiva = tabs.find((t) => esActivo(t));

  return (
    <div className="lg:grid lg:grid-cols-[224px_1fr] lg:items-start lg:gap-8">
      {/* Desktop: columna fija */}
      <aside className="sticky top-[88px] hidden shrink-0 rounded-3xl bg-aventurea-navy p-3 lg:block">
        {listaItems}
      </aside>

      {/* Mobile: barra con botón de menú */}
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <p className="text-[15px] font-bold text-aventurea-ink">{seccionActiva?.label}</p>
        <button
          type="button"
          onClick={() => setDrawerAbierto(true)}
          className="flex items-center gap-1.5 rounded-xl border border-aventurea-line bg-aventurea-surface px-3.5 py-2 text-[13px] font-bold text-aventurea-ink shadow-sm"
        >
          <IconMenu className="h-4 w-4" />
          Menú
        </button>
      </div>

      {/* Mobile: el menú como panel deslizado encima */}
      {drawerAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú del panel"
          className="fixed inset-0 z-[100] lg:hidden"
        >
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setDrawerAbierto(false)}
            className="anim-velo-entrar absolute inset-0 cursor-default bg-[rgba(10,18,42,0.45)]"
          />
          <div className="anim-panel-entrar absolute left-0 top-0 h-full w-[78vw] max-w-[300px] overflow-y-auto bg-aventurea-navy p-4 shadow-2xl">
            {listaItems}
          </div>
        </div>
      )}

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
