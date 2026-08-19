"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { COOKIE_SECCION, SECCIONES_ADMIN, type SeccionAdmin } from "./vertical";

/**
 * El conmutador de secciones del admin: fija la sección en una cookie
 * y refresca los datos del servidor — todas las páginas del panel
 * (directorio, agenda, reservas, balance, inicio) leen esa cookie, así
 * que la separación se mantiene al navegar entre pestañas.
 */
function guardarSeccion(seccion: SeccionAdmin) {
  document.cookie = `${COOKIE_SECCION}=${seccion}; path=/; max-age=31536000; samesite=lax`;
}

export default function VerticalSwitcher({
  actual,
  variante = "barra",
}: {
  actual: SeccionAdmin;
  /**
   * «barra» es el de siempre: botones en fila sobre fondo claro.
   * «rail» es el de la barra lateral navy — mismo comportamiento, otro
   * traje. Los botones claros del original desaparecen sobre el navy.
   */
  variante?: "barra" | "rail";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function elegir(seccion: SeccionAdmin) {
    guardarSeccion(seccion);
    startTransition(() => router.refresh());
  }

  if (variante === "rail") {
    return (
      <div
        className={`rounded-xl border border-white/10 bg-white/[0.07] p-2 transition-opacity ${pending ? "opacity-60" : ""}`}
      >
        <p className="mb-1.5 px-1 text-[9.5px] font-bold tracking-[0.14em] text-white/35 uppercase">
          Sección
        </p>
        <div className="flex flex-wrap gap-1">
          {SECCIONES_ADMIN.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={pending}
              onClick={() => elegir(s.key)}
              className={`rounded-lg px-2 py-1 text-[11.5px] font-bold transition-colors ${
                actual === s.key
                  ? "bg-aventurea-navy-3 text-white"
                  : "text-aventurea-rail hover:bg-white/10 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 transition-opacity ${pending ? "opacity-60" : ""}`}
    >
      <span className="mr-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        Sección
      </span>
      {SECCIONES_ADMIN.map((s) => (
        <button
          key={s.key}
          type="button"
          disabled={pending}
          onClick={() => elegir(s.key)}
          className={`rounded-lg px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
            actual === s.key
              ? "bg-aventurea-navy text-white"
              : "border border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
