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

export default function VerticalSwitcher({ actual }: { actual: SeccionAdmin }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function elegir(seccion: SeccionAdmin) {
    guardarSeccion(seccion);
    startTransition(() => router.refresh());
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
