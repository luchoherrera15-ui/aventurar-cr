"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { alternarResuelto } from "./actions";

/**
 * "Marcar como resuelto" / "Reabrir" — un botón, dos textos según el
 * estado. El estado es compartido (migración 0054): lo que decidís
 * acá se ve igual del otro lado de la conversación.
 */
export default function BotonResuelto({
  conversacionId,
  resuelta,
  variante = "fila",
}: {
  conversacionId: string;
  resuelta: boolean;
  /** "fila" = chip chico en la lista; "cabecera" = botón en el hilo. */
  variante?: "fila" | "cabecera";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function alternar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await alternarResuelto(conversacionId, !resuelta);
      router.refresh();
    });
  }

  if (variante === "cabecera") {
    return (
      <button
        type="button"
        onClick={alternar}
        disabled={pending}
        className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-50 ${
          resuelta
            ? "border-aventurea-line text-aventurea-ink hover:border-aventurea-navy"
            : "border-aventurea-green/30 bg-aventurea-green/10 text-aventurea-green hover:border-aventurea-green"
        }`}
      >
        {resuelta ? "Reabrir" : "Marcar como resuelto"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pending}
      className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 ${
        resuelta
          ? "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-ink"
          : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-green hover:text-aventurea-green"
      }`}
    >
      {resuelta ? "Reabrir" : "Resuelto"}
    </button>
  );
}
