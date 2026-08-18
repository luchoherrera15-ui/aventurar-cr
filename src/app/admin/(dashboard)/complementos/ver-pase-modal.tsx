"use client";

import { useEffect, useState } from "react";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import { verPaseDeNegocio } from "./ver-pase-actions";

/**
 * EL MODAL DE "VER PASE", desde admin.
 *
 * Mismo overlay que ya usa `ranchos-table.tsx` para la verificación de
 * identidad — no un modal nuevo — para que un patrón visual conocido no
 * empiece a convivir con uno distinto en la misma sección de admin.
 *
 * `max-w-sm`: acá adentro va un teléfono, no una tabla.
 */
export default function VerPaseModal({
  ranchoId,
  nombre,
  onCerrar,
}: {
  ranchoId: string;
  nombre: string;
  onCerrar: () => void;
}) {
  const [estado, setEstado] = useState<
    | { tipo: "cargando" }
    | { tipo: "error"; motivo: string }
    | { tipo: "listo"; datos: DatosVista; totalProgramas: number }
  >({ tipo: "cargando" });

  useEffect(() => {
    // Sin `setEstado({ tipo: "cargando" })` acá: el estado inicial ya
    // es "cargando", y el padre desmonta este modal al cerrarlo (no lo
    // reusa con otro `ranchoId`), así que no hace falta resetear nada
    // al entrar al efecto — solo lanzar el pedido.
    let vivo = true;
    verPaseDeNegocio(ranchoId).then((res) => {
      if (!vivo) return;
      if (res.ok) setEstado({ tipo: "listo", datos: res.datos, totalProgramas: res.totalProgramas });
      else setEstado({ tipo: "error", motivo: res.motivo });
    });
    return () => {
      vivo = false;
    };
  }, [ranchoId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCerrar}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-aventurea-navy p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/55">
              Vista del pase
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-white">{nombre}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          {estado.tipo === "cargando" && (
            <p className="text-center text-[12.5px] text-white/60">
              Cargando el pase de {nombre}…
            </p>
          )}

          {estado.tipo === "error" && (
            <p role="alert" className="rounded-xl bg-white/10 px-3 py-2.5 text-[12.5px] text-white/85">
              {estado.motivo}
            </p>
          )}

          {estado.tipo === "listo" && (
            <>
              <VistaPase datos={estado.datos} marco="telefono" superficie="oscura" />
              {estado.totalProgramas > 1 ? (
                <p className="mt-3 text-center text-[11.5px] text-white/50">
                  Este negocio tiene {estado.totalProgramas} tarjetas — se muestra la principal.
                </p>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="presionable mt-5 w-full rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-bold text-white"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
