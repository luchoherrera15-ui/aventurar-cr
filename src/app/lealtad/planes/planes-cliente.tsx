"use client";

import Link from "next/link";
import { useState } from "react";
import FormularioSolicitud, {
  type DatosPago,
  type NegocioElegible,
} from "./formulario-solicitud";

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
  /**
   * Ya formateado con su símbolo por `precioDe()`. String y no número
   * a propósito: el catálogo tiene planes en dólares y planes viejos
   * en colones (0133), y una pantalla que reciba `9.99` no tiene cómo
   * saber cuál es — pintaría «₡9,99».
   * null = a convenir.
   */
  precio: string | null;
  esGratis: boolean;
  /** El precio va en dólares pero el depósito SINPE se hace en colones. */
  enDolares: boolean;
  beneficios: string[];
  destacado: boolean;
};

export default function PlanesCliente({
  planes,
  negocios,
  negocioInicial,
  conSesion,
  pago,
  conTarjeta,
}: {
  planes: TarjetaPlan[];
  negocios: NegocioElegible[];
  negocioInicial: string | null;
  conSesion: boolean;
  pago: DatosPago;
  /**
   * Qué paquetes se pueden pagar con tarjeta y con qué períodos. Lo
   * calcula el servidor leyendo las variables STRIPE_PRICE_… — lista
   * vacía = no hay Stripe y esta pantalla es la de siempre, solo SINPE.
   */
  conTarjeta: { plan: string; periodos: string[] }[];
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const plan = planes.find((p) => p.id === elegido) ?? null;
  const periodosConTarjeta = plan
    ? (conTarjeta.find((c) => c.plan === plan.id)?.periodos ?? [])
    : [];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {planes.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-2xl border p-5"
            style={{
              background: p.destacado ? "rgba(238,116,32,.10)" : "rgba(255,255,255,.045)",
              borderColor: p.destacado ? "rgba(238,116,32,.5)" : "rgba(255,255,255,.12)",
            }}
          >
            {/* «El más popular» y no «el más completo»: el destacado es
                el del medio, y el más completo es el de arriba. */}
            {p.destacado && (
              <span className="mb-2 self-start rounded-full bg-[#ee7420] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                El más popular
              </span>
            )}
            <h2 className="text-[18px] font-extrabold text-white">{p.nombre}</h2>
            <p className="mt-1 text-[26px] font-extrabold leading-none text-white">
              {p.precio === null ? (
                "A convenir"
              ) : p.esGratis ? (
                "Gratis"
              ) : (
                <>
                  {p.precio}
                  <span className="text-[13px] font-bold text-white/50"> /mes</span>
                </>
              )}
            </p>
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
                {elegido === p.id
                  ? "Elegido ↓"
                  : p.esGratis
                    ? "Empezar gratis"
                    : conTarjeta.some((c) => c.plan === p.id)
                      ? "Llevar este plan"
                      : "Solicitar este plan"}
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
            precio={plan.precio}
            esGratis={plan.esGratis}
            enDolares={plan.enDolares}
            negocios={negocios}
            negocioInicial={negocioInicial}
            pago={pago}
            periodosConTarjeta={periodosConTarjeta}
            alCerrar={() => setElegido(null)}
          />
        </div>
      )}
    </div>
  );
}
