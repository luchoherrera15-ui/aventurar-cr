"use client";

import Link from "next/link";
import { useState } from "react";
import FormularioSolicitud, { type NegocioElegible } from "./formulario-solicitud";

/**
 * Las tarjetas de los tres paquetes. Elegir una abre el paso de
 * solicitud justo debajo — el "proceso de compra" no navega a ningún
 * lado: pasa acá mismo.
 *
 * Sin precios a la vista A PROPÓSITO: el precio lo confirma Bookea al
 * contactar (y no está definido en el producto todavía — inventarlo
 * acá sería peor que no mostrarlo).
 */

export type TarjetaPlan = {
  id: string;
  nombre: string;
  limite: number | null;
  beneficios: string[];
  destacado: boolean;
};

export default function PlanesCliente({
  planes,
  negocios,
  negocioInicial,
  conSesion,
}: {
  planes: TarjetaPlan[];
  negocios: NegocioElegible[];
  negocioInicial: string | null;
  conSesion: boolean;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const plan = planes.find((p) => p.id === elegido) ?? null;

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {planes.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-2xl border p-5"
            style={{
              background: p.destacado ? "rgba(238,116,32,.10)" : "rgba(255,255,255,.045)",
              borderColor: p.destacado ? "rgba(238,116,32,.5)" : "rgba(255,255,255,.12)",
            }}
          >
            {p.destacado && (
              <span className="mb-2 self-start rounded-full bg-[#ee7420] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                El más completo
              </span>
            )}
            <h2 className="text-[18px] font-extrabold text-white">{p.nombre}</h2>
            <p className="mt-0.5 text-[12.5px] text-white/55">
              Hasta {p.limite === null ? "miembros ilimitados" : `${p.limite.toLocaleString("es-CR")} miembros`}
            </p>

            <ul className="mt-3 flex-1 space-y-1.5">
              {p.beneficios.map((b) => (
                <li key={b} className="flex gap-2 text-[12.5px] leading-snug text-white/75">
                  <span className="text-[#ee7420]" aria-hidden>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            {conSesion ? (
              <button
                type="button"
                onClick={() => setElegido(p.id)}
                className={`mt-4 rounded-xl px-4 py-3 text-[13.5px] font-extrabold transition-colors ${
                  elegido === p.id
                    ? "bg-white text-[#0a1226]"
                    : "bg-[#ee7420] text-white hover:brightness-110"
                }`}
              >
                {elegido === p.id ? "Elegido ↓" : "Solicitar este plan"}
              </button>
            ) : (
              <Link
                href="/lealtad/login"
                className="mt-4 rounded-xl bg-[#ee7420] px-4 py-3 text-center text-[13.5px] font-extrabold text-white"
              >
                Entrá para solicitarlo
              </Link>
            )}
          </div>
        ))}
      </div>

      {plan && conSesion && (
        <div className="mt-5">
          <FormularioSolicitud
            key={plan.id}
            plan={plan.id}
            planNombre={plan.nombre}
            negocios={negocios}
            negocioInicial={negocioInicial}
            alCerrar={() => setElegido(null)}
          />
        </div>
      )}
    </div>
  );
}
