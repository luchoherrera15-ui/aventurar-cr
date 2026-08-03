"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Con `href` la pestaña es un link a otra pantalla (sin contenido acá). */
export type Tab = {
  id: string;
  label: string;
  content?: ReactNode;
  href?: string;
  /** Contador chiquito al lado del label (ej. reservas por aprobar). */
  badge?: number;
};

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

  // Los accesos rápidos del encabezado navegan con `?tab=` sin pasar por
  // los botones de acá — cuando el parámetro cambia desde afuera, la
  // pestaña activa lo sigue. Se ajusta durante el render (patrón oficial
  // de React para derivar estado de una prop que cambió), no en un efecto.
  const [previo, setPrevio] = useState(inicial);
  if (inicial !== previo) {
    setPrevio(inicial);
    if (inicial && inicial !== activo && tabs.some((t) => t.id === inicial && !t.href)) {
      setActivo(inicial);
    }
  }

  function cambiar(id: string) {
    setActivo(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Píldoras en vez de subrayado: son la única navegación del panel
  // (los accesos rápidos duplicados se fueron) y se ven como botones
  // de verdad — la activa en navy, el resto en blanco con borde.
  const pillBase =
    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-4 py-2 text-[13px] font-bold transition-colors";
  const pillInactiva =
    "border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy";

  const badgeDe = (t: Tab, activa: boolean) =>
    t.badge && t.badge > 0 ? (
      <span
        className={`rounded-lg px-1.5 py-0.5 text-[10.5px] font-extrabold leading-none ${
          activa ? "bg-white/25 text-white" : "bg-aventurea-orange text-white"
        }`}
      >
        {t.badge}
      </span>
    ) : null;

  return (
    <div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1 sm:mx-0 sm:px-0">
        {tabs.map((t) =>
          t.href ? (
            <Link key={t.id} href={t.href} className={`${pillBase} ${pillInactiva}`}>
              {t.label}
              {badgeDe(t, false)}
            </Link>
          ) : (
            <button
              key={t.id}
              type="button"
              onClick={() => cambiar(t.id)}
              className={`${pillBase} ${
                activo === t.id
                  ? "border-aventurea-navy bg-aventurea-navy text-white shadow-sm"
                  : pillInactiva
              }`}
            >
              {t.label}
              {badgeDe(t, activo === t.id)}
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
