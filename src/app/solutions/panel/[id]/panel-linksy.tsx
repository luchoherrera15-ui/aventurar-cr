"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarraLinksy, NavLinksy, type ItemNavLinksy, type NegocioEnBarra } from "./nav-linksy";
import { LP_BAJADA, LP_TITULO } from "./sistema-linksy";

/**
 * EL SHELL DEL PANEL DE LINKSY — barra arriba, secciones a la izquierda,
 * contenido grande a la derecha.
 *
 * Reemplaza al `PanelSidebar` navy de mi-negocio para este producto
 * (7 sep 2026): mismo contrato de pestañas por `?tab=`, otra piel. Las
 * secciones que son páginas propias (Ventas, Lealtad, Instagram) son
 * enlaces; las demás cambian el contenido acá mismo sin recargar.
 *
 * Cada pestaña puede traer su propio encabezado grande (`titulo` +
 * `bajada`); Inicio no lo usa porque su primera tile ES el encabezado.
 */

export type PestanaLinksy = ItemNavLinksy & {
  content?: ReactNode;
  titulo?: string;
  bajada?: string;
  /** Nombres viejos de `?tab=` que aterrizan acá. */
  alias?: string[];
  /**
   * Muestra el contenido de OTRA pestaña (8 sep 2026): Enlaces, Diseño y
   * Ajustes son tres entradas del menú pero un solo editor, que lee
   * `?tab=` para saber qué parte enseñar. Al ser el mismo elemento en la
   * misma posición, React no lo desmonta al cambiar de pestaña y lo
   * editado sigue vivo.
   */
  contenidoDe?: string;
};

function resolver(param: string | null, tabs: PestanaLinksy[]): string | null {
  if (!param) return null;
  const directo = tabs.find((t) => t.pestana && !t.bloqueado && t.id === param);
  if (directo) return directo.id;
  return tabs.find((t) => t.pestana && !t.bloqueado && t.alias?.includes(param))?.id ?? null;
}

export default function PanelLinksy({ tabs, defaultTab, negocio }: { tabs: PestanaLinksy[]; defaultTab: string; negocio: NegocioEnBarra }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const resuelto = resolver(paramTab, tabs);
  const [activo, setActivo] = useState(resuelto ?? defaultTab);

  // Si la URL cambia por afuera (un enlace a ?tab=…), la pestaña sigue.
  const [previo, setPrevio] = useState(paramTab);
  if (paramTab !== previo) {
    setPrevio(paramTab);
    if (resuelto && resuelto !== activo) setActivo(resuelto);
  }

  const cambiar = (id: string) => {
    setActivo(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const actual = tabs.find((t) => t.id === activo) ?? tabs[0];
  const fuente = actual?.contenidoDe ? (tabs.find((t) => t.id === actual.contenidoDe) ?? actual) : actual;

  return (
    <div className="min-h-svh">
      <BarraLinksy negocio={negocio} />
      <div className="mx-auto grid w-[min(1440px,100%)] gap-5 px-3 py-5 sm:px-5 lg:grid-cols-[292px_minmax(0,1fr)] lg:gap-7 lg:py-7">
        <aside className="min-w-0 lg:sticky lg:top-[92px] lg:self-start">
          <NavLinksy items={tabs} activo={activo} alElegir={cambiar} />
        </aside>
        <section className="min-w-0" aria-live="polite">
          {actual?.titulo && (
            <div className="mb-5 px-1">
              <h1 className={LP_TITULO}>{actual.titulo}</h1>
              {actual.bajada && <p className={`mt-2 ${LP_BAJADA}`}>{actual.bajada}</p>}
            </div>
          )}
          {fuente?.content}
        </section>
      </div>
    </div>
  );
}
