"use client";

import Image from "next/image";
import { useState } from "react";
import { IconStar } from "@/components/icons";
import type { ProfesionalPerfil } from "./perfil-tipos";

type Props = {
  profesional: ProfesionalPerfil;
  /** La página decide qué hacer — esta tarjeta nunca abre su propia reserva. */
  onReservar: (servicioId: string | null, miembroId: string | null) => void;
};

/**
 * El profesional como BURBUJA (rediseño del dueño, 2 sep 2026, sobre la
 * captura): solo la foto en círculo con el nombre debajo, y una card
 * chiquita «+ Ver más» que EXPANDE el resto — reseñas, servicios,
 * citas atendidas y el botón de disponibilidad. Antes era la tarjeta
 * grande estilo Fresha con la foto 4:3; media pantalla para un equipo
 * de una persona.
 *
 * La expansión usa `desplegable` de globals.css (grid-rows 0fr→1fr,
 * `--duracion-card` + `--ease-bookea`): nada de animar height, y con
 * `prefers-reduced-motion` se abre sin viaje, como todo el sistema.
 */
export default function ProfessionalCard({ profesional, onReservar }: Props) {
  const { nombre, rol, foto_url, promedio, totalResenas, serviciosPrincipales, citasAtendidas } =
    profesional;
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="flex w-full flex-col items-center">
      {/* ── La burbuja ─────────────────────────────────────────────── */}
      <span className="relative block h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-aventurea-blue-light shadow-[0_14px_44px_-24px_rgba(22,41,94,0.55)]">
        {foto_url ? (
          <Image src={foto_url} alt={nombre} fill sizes="112px" className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-aventurea-navy text-[36px] font-extrabold text-white">
            {nombre.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      <p className="mt-2.5 text-center text-[15px] font-extrabold leading-tight text-aventurea-ink">
        {nombre}
      </p>
      {rol && (
        <p className="text-center text-[12.5px] font-semibold text-aventurea-ink-soft">{rol}</p>
      )}

      {/* ── La card «+ Ver más» ────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="presionable mt-2.5 rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2 text-[12.5px] font-bold text-aventurea-navy transition-colors hover:border-aventurea-sky"
      >
        {abierto ? "− Ver menos" : "+ Ver más"}
      </button>

      {/* ── Lo que se expande: la info completa ────────────────────── */}
      <div className="desplegable w-full" data-abierto={abierto}>
        <div>
          <div className="mt-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 text-left shadow-[0_14px_44px_-24px_rgba(22,41,94,0.35)]">
            {promedio != null && totalResenas > 0 ? (
              <p className="flex items-center gap-1 text-[12.5px] font-bold text-aventurea-ink">
                <IconStar className="h-3.5 w-3.5 text-aventurea-orange" />
                {promedio.toFixed(1).replace(".", ",")}
                <span className="font-semibold text-aventurea-ink-soft">
                  ({totalResenas} reseña{totalResenas === 1 ? "" : "s"})
                </span>
              </p>
            ) : (
              <p className="text-[12.5px] font-semibold text-aventurea-ink-soft">
                Sin reseñas todavía
              </p>
            )}

            {serviciosPrincipales.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {serviciosPrincipales.map((servicio) => (
                  <span
                    key={servicio}
                    className="rounded-lg bg-aventurea-blue-light px-2.5 py-1 text-[11px] font-bold text-aventurea-navy"
                  >
                    {servicio}
                  </span>
                ))}
              </div>
            )}

            {citasAtendidas > 0 && (
              <p className="mt-2.5 text-[11.5px] font-semibold text-aventurea-ink-soft">
                {citasAtendidas} cita{citasAtendidas === 1 ? "" : "s"} atendida
                {citasAtendidas === 1 ? "" : "s"} en Bookea
              </p>
            )}

            <button
              type="button"
              onClick={() => onReservar(null, profesional.id)}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-aventurea-sky text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark"
            >
              Ver disponibilidad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
