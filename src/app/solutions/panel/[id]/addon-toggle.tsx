"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO } from "@/components/panel/sistema";
import type { AddonId } from "@/lib/solutions/addons";
import { activarAddonSolutions } from "./actions";

/**
 * EL BOTÓN DE UN ADD-ON — agregar o apagar (0233).
 *
 * Hoy activar es gratis («todo es prueba», dueño, 4 sep 2026). El día
 * que se cobre, este botón lleva a pagar en vez de activar directo; la
 * fila y la puerta del servidor no cambian.
 *
 * `externoHref`: los add-ons que se arman en otro producto de Bookea
 * (la tarjeta, en Lealtad). Al agregarlos se marca la fila y se lleva
 * a la persona a armarlo allá, con la misma cuenta.
 */
export default function AddonToggle({
  negocioId,
  addon,
  activo,
  incluido,
  externoHref,
  puedeEditar,
}: {
  negocioId: string;
  addon: AddonId;
  activo: boolean;
  incluido: boolean;
  externoHref?: string;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [ocupado, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (incluido) return <PildoraEstado estado="exito">Incluido</PildoraEstado>;
  if (!puedeEditar) return <PildoraEstado estado={activo ? "exito" : "neutro"}>{activo ? "Activo" : "No activo"}</PildoraEstado>;

  const cambiar = (nuevo: boolean) => {
    setError(null);
    arrancar(async () => {
      const r = await activarAddonSolutions(negocioId, addon, nuevo);
      if (!r.ok) {
        setError(r.motivo);
        return;
      }
      if (nuevo && externoHref) router.push(externoHref);
      else router.refresh();
    });
  };

  return (
    <span className="flex flex-col items-end gap-1">
      {activo ? (
        <span className="flex items-center gap-2">
          <PildoraEstado estado="exito">Activo</PildoraEstado>
          {externoHref ? (
            <a href={externoHref} className={BOTON_PANEL}>
              Abrir →
            </a>
          ) : (
            <button type="button" disabled={ocupado} onClick={() => cambiar(false)} className={BOTON_PANEL}>
              Apagar
            </button>
          )}
        </span>
      ) : (
        <button type="button" disabled={ocupado} onClick={() => cambiar(true)} className={BOTON_PANEL_PRIMARIO}>
          {ocupado ? "Un momento…" : "Agregar"}
        </button>
      )}
      {error && <span className="text-[11.5px] font-bold text-red-700">{error}</span>}
    </span>
  );
}
