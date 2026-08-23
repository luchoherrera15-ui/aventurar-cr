"use client";

import { EVENTO_MOSTRAR_CONFIGURADOR } from "./revelar-configurador";

/**
 * EL BOTÓN «¡Creá tu pase de lealtad!».
 *
 * En vez de llevar a la pantalla dedicada `/lealtad/crear`, dispara el
 * evento que revela el configurador embebido en esta misma landing
 * (`RevelarConfigurador`, envolviendo a `ConfiguradorLealtad` en
 * page.tsx) — arranca oculto y recién se monta y hace scroll hacia sí
 * mismo cuando algún botón de esta familia lo pide. Por eso es un
 * client component con `onClick` y no un `<Link>` de servidor, y por
 * eso solo tiene sentido en ESTA página.
 *
 * `variante`: "primario" es el navy sólido del hero; "oscuro" es el
 * mismo botón sobre la franja navy del cierre (ahí el azul de acción
 * desaparece — usa el par claro, igual que el resto de la landing).
 */
export default function BotonCrearPase({
  variante = "primario",
  grande = false,
  children,
}: {
  variante?: "primario" | "oscuro";
  /** El del hero (0163: pedido del dueño, "hazlo más grande"). */
  grande?: boolean;
  children: React.ReactNode;
}) {
  const estilo =
    variante === "primario"
      ? {
          background: "#0a1226",
          color: "#ffffff",
          boxShadow: "0 6px 16px -10px rgba(10,18,38,.45)",
        }
      : {
          background: "var(--accion-claro)",
          color: "var(--accion-claro-tinta)",
        };

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_MOSTRAR_CONFIGURADOR))}
      className={`presionable inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 ${
        grande ? "px-8 py-4.5 text-[17px] sm:text-[18px]" : "px-6 py-3.5 text-[14px]"
      }`}
      style={estilo}
    >
      {children}
    </button>
  );
}
