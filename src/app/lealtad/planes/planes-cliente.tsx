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

/**
 * Esta pantalla entera vive sobre navy profundo (`planes/page.tsx`), y
 * eso decide el par de color: el azul de acción de fondo claro da
 * 1,44:1 acá y desaparecería. Todos los botones usan el par OSCURO
 * —relleno claro, letra navy—, y el naranja queda solo en las dos
 * piezas que marcan lo que se gana: la insignia del plan destacado y
 * la palomita de cada beneficio.
 */
const BOTON_ACCION =
  "bg-[color:var(--accion-claro)] text-[color:var(--accion-claro-tinta)] hover:bg-[color:var(--accion-claro-hover)]";

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
              background: p.destacado ? "rgba(157,180,255,.14)" : "rgba(255,255,255,.045)",
              borderColor: p.destacado ? "rgba(157,180,255,.45)" : "rgba(255,255,255,.12)",
            }}
          >
            {/* «El más popular» y no «el más completo»: el destacado es
                el del medio, y el más completo es el de arriba. */}
            {p.destacado && (
              <span
                className="mb-2 self-start rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: "var(--orange)", color: "#0a1226" }}
              >
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
                  <span style={{ color: "var(--orange)" }} aria-hidden>
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
                  elegido === p.id ? "bg-white text-[#0a1226]" : BOTON_ACCION
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
                href="/cuenta?volver=lealtad"
                className={`mt-4 rounded-xl px-4 py-3 text-center text-[13.5px] font-extrabold ${BOTON_ACCION}`}
              >
                Entrá para solicitarlo
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* ── NEGOCIO NUEVO: el wizard de la primera tarjeta ──────────
          Quien todavía no tiene nada en Bookea puede armar la tarjeta
          COMPLETA (tipo, beneficio, colores, vista previa) en
          /lealtad/nuevo con el paquete ya elegido. El formulario de
          abajo sigue intacto: con tarjeta se paga primero y el wizard
          espera del otro lado del cobro; con SINPE la solicitud es la
          de siempre. */}
      {plan && conSesion && negocios.length === 0 && (
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/[.06] p-4">
          <p className="text-[13.5px] font-extrabold text-white">
            ¿Negocio nuevo? Armá tu tarjeta de una vez
          </p>
          <p className="mt-1 max-w-[520px] text-[12.5px] leading-snug text-white/65">
            Elegís el tipo de tarjeta, el beneficio y tus colores en cinco pasos, viendo la
            tarjeta mientras la armás{plan.esGratis ? " — sin pagar nada" : ""}.
          </p>
          <Link
            href={`/lealtad/nuevo?plan=${plan.id}`}
            className={`mt-3 inline-block rounded-xl px-4 py-2.5 text-[13px] font-extrabold ${BOTON_ACCION}`}
          >
            Armar mi tarjeta con {plan.nombre} →
          </Link>
        </div>
      )}

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
