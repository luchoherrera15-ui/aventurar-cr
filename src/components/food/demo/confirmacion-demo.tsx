"use client";

import Image from "next/image";
import Link from "next/link";
import { fechaLargaCR } from "@/lib/fechas";
import { CRC_DEMO, horaBonita } from "@/lib/food/demo/tipos";
import { useReservasDemo } from "@/lib/food/demo/estado";
import { IconCheck } from "@/components/icons";

/**
 * "¡Reserva confirmada!" — el remate del recorrido de venta. Lee la
 * reserva del localStorage por código; si no está (otro navegador, o
 * la demo se reinició) muestra una salida amable, nunca un error.
 */
export default function ConfirmacionDemo({ codigo }: { codigo: string }) {
  const reservas = useReservasDemo();
  const reserva = reservas.find((r) => r.codigo === codigo) ?? null;

  if (!reserva) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-16 text-center sm:px-6">
        <h1 className="titulo text-[24px] text-aventurea-navy">
          Esta reserva ya no está en esta sesión
        </h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
          Las reservas de la demo viven solo en este navegador. Volvé al
          marketplace y hacé una nueva en segundos.
        </p>
        <Link href="/food/demo" className="btn-naranja presionable mt-7 inline-flex">
          Volver a restaurantes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-12 sm:px-6 sm:py-16">
      <div className="overflow-hidden rounded-4xl border border-aventurea-line bg-white shadow-elevado">
        <div className="relative h-[150px] bg-aventurea-navy sm:h-[180px]">
          <Image
            src={reserva.fotoPrincipal}
            alt={reserva.nombre}
            fill
            sizes="560px"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
          <span className="absolute left-1/2 top-full flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-aventurea-orange text-white shadow-elevado">
            <IconCheck className="h-7 w-7" />
          </span>
        </div>

        <div className="px-6 pb-8 pt-12 text-center sm:px-10">
          <h1 className="titulo text-[26px] text-aventurea-navy sm:text-[30px]">
            ¡Reserva confirmada!
          </h1>
          <p className="mt-1 text-[16px] font-extrabold text-aventurea-ink">{reserva.nombre}</p>
          <p className="text-[13px] text-aventurea-ink-soft">
            {reserva.zona}
            {reserva.titular && <> · A nombre de {reserva.titular}</>}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-center">
            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                Fecha
              </p>
              <p className="mt-0.5 text-[13px] font-extrabold leading-snug text-aventurea-ink">
                {fechaLargaCR(reserva.fecha)}
              </p>
            </div>
            <div className="border-x border-aventurea-line">
              <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                Hora
              </p>
              <p className="mt-0.5 text-[13px] font-extrabold text-aventurea-ink">
                {horaBonita(reserva.hora)}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                Personas
              </p>
              <p className="mt-0.5 text-[13px] font-extrabold text-aventurea-ink">
                {reserva.personas}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-aventurea-orange px-5 py-3.5 text-white">
            <p className="text-[13.5px] font-extrabold">{reserva.descuento}% de descuento</p>
            <p className="text-[17px] font-extrabold">
              {CRC_DEMO.format(reserva.precioFinal)}{" "}
              <span className="text-[12px] font-bold text-white/75 line-through">
                {CRC_DEMO.format(reserva.precioEstimado)}
              </span>
            </p>
          </div>

          <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
            Código de reserva
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-[0.08em] text-aventurea-navy">
            {reserva.codigo}
          </p>

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link href="/food/demo/reservas" className="btn-naranja presionable justify-center">
              Ver reserva
            </Link>
            <Link href="/food/demo" className="btn-contorno presionable justify-center">
              Volver a restaurantes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
