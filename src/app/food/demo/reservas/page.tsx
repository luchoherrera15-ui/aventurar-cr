"use client";

import Image from "next/image";
import Link from "next/link";
import { fechaLargaCR } from "@/lib/fechas";
import { CRC_DEMO, horaBonita } from "@/lib/food/demo/tipos";
import { cancelarReserva, useReservasDemo } from "@/lib/food/demo/estado";

/**
 * "Mis reservas" de la DEMO — las reservas hechas en esta sesión de
 * venta (localStorage). Cancelar una libera su mesa al instante: el
 * estado de la demo cambia de verdad, que es lo que hace creíble el
 * recorrido.
 */
export default function ReservasDemoPage() {
  const reservas = useReservasDemo();

  return (
    <div className="mx-auto max-w-[860px] px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="titulo text-[26px] uppercase tracking-tight text-aventurea-navy sm:text-[30px]">
        Mis reservas
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Las reservas que hiciste durante esta sesión de demostración.
      </p>

      {reservas.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-aventurea-line bg-white p-10 text-center shadow-plano">
          <p className="text-[15px] font-extrabold text-aventurea-ink">
            Todavía no tenés reservas
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
            Elegí un restaurante, seleccioná un horario con descuento y
            confirmá — tu reserva va a aparecer acá.
          </p>
          <Link href="/food/demo" className="btn-naranja presionable mt-6 inline-flex">
            Explorar restaurantes
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {reservas.map((r) => (
            <div
              key={r.codigo}
              className="flex flex-col gap-4 rounded-3xl border border-aventurea-line bg-white p-4 shadow-plano sm:flex-row sm:items-center"
            >
              <Link
                href={`/food/demo/restaurante/${r.slug}`}
                className="relative block h-[120px] w-full shrink-0 overflow-hidden rounded-2xl bg-aventurea-blue-light sm:h-[96px] sm:w-[140px]"
              >
                <Image
                  src={r.fotoPrincipal}
                  alt={r.nombre}
                  fill
                  sizes="(max-width: 640px) 90vw, 140px"
                  className="object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="titulo text-[16.5px] text-aventurea-ink">{r.nombre}</p>
                  <span className="rounded-md bg-aventurea-orange-light px-2 py-0.5 text-[11px] font-extrabold text-aventurea-orange-dark">
                    −{r.descuento}%
                  </span>
                </div>
                <p className="mt-1 text-[13px] font-bold text-aventurea-ink-soft">
                  {fechaLargaCR(r.fecha)} · {horaBonita(r.hora)} · {r.personas}{" "}
                  {r.personas === 1 ? "persona" : "personas"}
                </p>
                <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                  Código{" "}
                  <span className="font-extrabold tracking-wide text-aventurea-navy">
                    {r.codigo}
                  </span>{" "}
                  · {CRC_DEMO.format(r.precioFinal)}{" "}
                  <span className="line-through">{CRC_DEMO.format(r.precioEstimado)}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/food/demo/reserva/${r.codigo}`}
                  className="btn-contorno presionable text-[13px]"
                >
                  Ver
                </Link>
                <button
                  type="button"
                  onClick={() => cancelarReserva(r.codigo)}
                  className="presionable rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:border-red-300 hover:text-red-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
