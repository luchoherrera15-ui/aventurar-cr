"use client";

import { useRouter } from "next/navigation";
import { IconChevronLeft } from "@/components/icons";

/**
 * VOLVER — un paso atrás de verdad, no un salto al inicio.
 *
 * Acá había un `<Link href="/">` que decía «Volver al inicio». El texto
 * era honesto pero el comportamiento estaba mal para lo que la gente
 * espera de una flecha: quien entró a `/mi-negocio` desde su panel, o
 * desde un correo, o desde la ficha de su propio negocio, tocaba
 * «volver» y aterrizaba en la portada del marketplace — lejísimos de
 * donde estaba.
 *
 * ── EL RESPALDO NO ES OPCIONAL ──────────────────────────────────────
 *
 * `router.back()` no hace NADA cuando no hay historial: alguien que
 * abrió el link en una pestaña nueva, o que llegó pegando la URL, se
 * queda tocando un botón muerto sin ninguna señal de que pasó algo.
 *
 * Por eso se mira `window.history.length` antes. Es una aproximación
 * —el navegador no dice de dónde viene cada entrada— pero distingue el
 * caso que importa: una pestaña recién abierta tiene una sola entrada.
 * Ahí se navega a `destino` en vez de no hacer nada.
 */
export default function BotonVolver({
  destino = "/",
  etiqueta = "Volver",
  className = "",
}: {
  /** A dónde ir cuando no hay historial que deshacer. */
  destino?: string;
  etiqueta?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(destino);
      }}
      className={`presionable inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:text-aventurea-orange ${className}`}
    >
      <IconChevronLeft className="h-4 w-4 shrink-0" />
      {etiqueta}
    </button>
  );
}
