"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Una card de paquete con el álbum como extra marcable.
 *
 * Es cliente solo por el checkbox: al marcarlo cambia el precio que se
 * muestra y el link se lleva `?album=1` para que el formulario del
 * pedido llegue con la casilla ya puesta.
 *
 * OJO CON EL PRECIO: lo de acá es para MOSTRAR. Lo que se cobra lo
 * calcula la base al crear el pedido, a partir de un booleano (0091).
 * Si el total viajara en la URL, se reabriría el agujero que cerró la
 * 0087 — cualquiera editaría el número antes de mandar el formulario.
 */
export default function CardPaquete({
  id,
  nombre,
  badge,
  destacado,
  lema,
  incluye,
  precioUSD,
  precioEtiqueta,
  colonesPaquete,
  colonesConAlbum,
  album,
}: {
  id: string;
  nombre: string;
  badge: string;
  destacado?: boolean;
  lema: string;
  incluye: readonly string[];
  precioUSD: number;
  precioEtiqueta: string;
  /** Ya formateado ("₡20 800"): el tipo de cambio vive en el servidor. */
  colonesPaquete: string;
  colonesConAlbum: string;
  album: { nombre: string; precioUSD: number; detalle: string };
}) {
  const [conAlbum, setConAlbum] = useState(false);

  const NAVY = "#16295e";
  const total = precioUSD + (conAlbum ? album.precioUSD : 0);
  const colones = conAlbum ? colonesConAlbum : colonesPaquete;

  return (
    <div
      className={`flex flex-col rounded-3xl border p-7 transition-colors ${
        destacado || conAlbum ? "border-[#ee7420]" : "border-white/12"
      }`}
      style={{ background: destacado ? NAVY : "rgba(255,255,255,.04)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[20px] font-bold">{nombre}</h3>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            destacado ? "bg-[#ee7420] text-white" : "bg-white/10 text-white/70"
          }`}
        >
          {badge}
        </span>
      </div>

      <p className="mt-5 flex items-baseline gap-2">
        <span className="titulo text-[44px] leading-none tabular-nums">
          ${total}
        </span>
        <span className="text-[13px] text-white/45">≈ {colones}</span>
      </p>
      {conAlbum && (
        <p className="mt-1.5 text-[12.5px] text-white/45">
          {precioEtiqueta} del paquete + ${album.precioUSD} del álbum
        </p>
      )}
      <p className="mt-3 text-[14px] leading-relaxed text-white/55">{lema}</p>

      <ul className="mt-6 space-y-2.5">
        {incluye.map((linea) => (
          <li key={linea} className="flex gap-2.5 text-[14px] leading-snug">
            <svg
              viewBox="0 0 20 20"
              className="mt-[3px] h-4 w-4 shrink-0 text-[#ee7420]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-white/80">{linea}</span>
          </li>
        ))}
      </ul>

      {/* El extra. `mt-auto` lo pega abajo para que las tres cards
          tengan el checkbox y el botón a la misma altura aunque una
          liste más cosas que otra. */}
      <label
        className={`mt-auto flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
          conAlbum
            ? "border-[#ee7420] bg-[#ee7420]/10"
            : "border-white/15 hover:border-white/35"
        }`}
      >
        <input
          type="checkbox"
          checked={conAlbum}
          onChange={(e) => setConAlbum(e.target.checked)}
          className="mt-0.5 h-[17px] w-[17px] shrink-0 accent-[#ee7420]"
        />
        <span className="min-w-0">
          <span className="block text-[13px] font-bold leading-snug">
            Agregar {album.nombre}
            <span className="text-[#ee7420]"> +${album.precioUSD}</span>
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-white/50">
            {album.detalle}
          </span>
        </span>
      </label>

      <Link
        href={`/invitaciones/pedido/${id}${conAlbum ? "?album=1" : ""}`}
        className={`mt-4 rounded-full px-6 py-3 text-center text-[14px] font-bold transition-transform hover:scale-[1.02] ${
          destacado ? "bg-[#ee7420] text-white" : "border border-white/25 text-white"
        }`}
      >
        Pedir la {nombre}
      </Link>
    </div>
  );
}
