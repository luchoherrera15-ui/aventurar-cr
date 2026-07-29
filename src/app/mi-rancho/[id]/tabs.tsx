"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Con `href` la pestaña es un link a otra pantalla (sin contenido acá). */
export type Tab = { id: string; label: string; content?: ReactNode; href?: string };

/**
 * Todas las pestañas quedan montadas (solo se ocultan con `hidden`), no
 * se desmontan al cambiar: así un formulario a medio llenar no se
 * pierde si el dueño va a ver otra pestaña y vuelve. El tab activo
 * vive en `?tab=` para que se pueda compartir el link o volver con el
 * botón atrás del navegador.
 */
export default function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inicial = searchParams.get("tab");
  const [activo, setActivo] = useState(
    inicial && tabs.some((t) => t.id === inicial) ? inicial : defaultTab,
  );

  function cambiar(id: string) {
    setActivo(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <div className="-mx-5 flex gap-1 overflow-x-auto border-b border-aventurea-line px-5 sm:mx-0 sm:px-0">
        {tabs.map((t) =>
          t.href ? (
            <Link
              key={t.id}
              href={t.href}
              className="shrink-0 whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-[13.5px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-ink"
            >
              {t.label}
            </Link>
          ) : (
            <button
              key={t.id}
              type="button"
              onClick={() => cambiar(t.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-[13.5px] font-bold transition-colors ${
                activo === t.id
                  ? "border-aventurea-navy text-aventurea-navy"
                  : "border-transparent text-aventurea-ink-soft hover:text-aventurea-ink"
              }`}
            >
              {t.label}
            </button>
          ),
        )}
      </div>

      <div className="pt-6">
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
