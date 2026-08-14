"use client";

import { useState, useTransition } from "react";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";
import HiloAyudaDiseno from "@/components/hilo-ayuda-diseno";
import { cerrarAyudaDeDiseno, responderAyudaComoBookea } from "./ayuda-actions";

/**
 * LA BANDEJA DE «AYUDA CON EL DISEÑO» (0149).
 *
 * Va acá y NO en una pantalla nueva: /admin/complementos ya es el lugar
 * donde el equipo mira lo que un negocio está esperando —las solicitudes
 * de paquete, los negocios en revisión—, así que un pedido de diseño en
 * otra ruta sería una pestaña más que hay que acordarse de abrir. Ese es
 * exactamente el modo en que un pedido se pierde.
 *
 * Se pinta arriba de todo, junto a las otras dos bandejas, y desaparece
 * cuando no hay nada pendiente.
 */

export type HiloConNegocio = HiloAyuda & { ranchoId: string; negocio: string };

export default function AyudaPanel({ hilos }: { hilos: HiloConNegocio[] }) {
  const [filas, setFilas] = useState(hilos);
  if (filas.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-aventurea-navy bg-white">
      <p className="border-b border-aventurea-line bg-aventurea-navy px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white">
        Piden ayuda con el diseño de su tarjeta · {filas.length}
      </p>
      {filas.map((h, i) => (
        <Fila
          key={h.id}
          hilo={h}
          primera={i === 0}
          alCambiar={(nuevo) =>
            setFilas((prev) =>
              nuevo === null
                ? prev.filter((x) => x.id !== h.id)
                : prev.map((x) => (x.id === h.id ? { ...x, ...nuevo } : x)),
            )
          }
        />
      ))}
    </div>
  );
}

function Fila({
  hilo,
  primera,
  alCambiar,
}: {
  hilo: HiloConNegocio;
  primera: boolean;
  /** null = ya no va en la bandeja (se cerró). */
  alCambiar: (nuevo: HiloAyuda | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  // Sin respuesta del equipo todavía: es lo que hay que atender hoy.
  const sinContestar = !hilo.mensajes.some((m) => m.deBookea);
  const ultimo = hilo.mensajes[hilo.mensajes.length - 1];

  function responder(texto: string) {
    setError(null);
    iniciar(async () => {
      const res = await responderAyudaComoBookea(hilo.id, texto);
      if (!res.ok) setError(res.motivo);
      else alCambiar(res.hilo);
    });
  }

  function cerrar() {
    if (!confirm(`¿Cerrar el pedido de ${hilo.negocio}? Podrá abrir otro cuando quiera.`)) return;
    setError(null);
    iniciar(async () => {
      const res = await cerrarAyudaDeDiseno(hilo.id);
      if (!res.ok) setError(res.motivo);
      else alCambiar(null);
    });
  }

  return (
    <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-aventurea-ink">
          {hilo.negocio}
        </span>
        {sinContestar && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-amber-800">
            Sin contestar
          </span>
        )}
        {hilo.programaId === null && (
          <span className="rounded-full bg-aventurea-cream-2 px-2.5 py-0.5 text-[10.5px] font-bold uppercase text-aventurea-ink-soft">
            Todavía sin tarjeta
          </span>
        )}
        <span className="text-[11.5px] text-aventurea-ink-soft">{ultimo?.fecha}</span>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="rounded-[10px] bg-aventurea-navy px-3.5 py-2 text-[12.5px] font-bold text-white"
          aria-expanded={abierto}
        >
          {abierto ? "Cerrar el hilo" : sinContestar ? "Leer y contestar" : "Ver el hilo"}
        </button>
        <a
          href={`/admin/lealtad/${hilo.ranchoId}`}
          className="text-[12px] font-bold text-aventurea-ink underline"
        >
          Su programa →
        </a>
        <button
          type="button"
          onClick={cerrar}
          disabled={ocupado}
          className="text-[12px] font-bold text-red-700 underline disabled:opacity-40"
        >
          Marcar resuelto
        </button>
      </div>

      {!abierto && ultimo && (
        <p className="mt-1 truncate text-[12.5px] italic text-aventurea-ink-soft">
          {ultimo.deBookea ? "Vos: " : ""}
          “{ultimo.texto}”
        </p>
      )}

      {abierto && (
        <div className="mt-3">
          <HiloAyudaDiseno
            hilo={hilo}
            comoBookea
            alResponder={responder}
            ocupado={ocupado}
            error={error}
          />
        </div>
      )}

      {!abierto && error && (
        <p className="mt-1 text-[12.5px] font-bold text-red-700">{error}</p>
      )}
    </div>
  );
}
