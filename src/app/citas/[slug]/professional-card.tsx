"use client";

import Image from "next/image";
import { IconStar } from "@/components/icons";
import type { ProfesionalPerfil } from "./perfil-tipos";

type Props = {
  profesional: ProfesionalPerfil;
  /** La página decide qué hacer — esta tarjeta nunca abre su propia reserva. */
  onReservar: (servicioId: string | null, miembroId: string | null) => void;
};

/**
 * La tarjeta grande de un profesional (estilo Fresha): foto, rol, la
 * nota real de sus propias reseñas y sus servicios principales — todo
 * lo que hace falta para elegir con quién atenderse antes de reservar.
 * Reemplaza al círculo chiquito de EquipoNegocio.
 */
export default function ProfessionalCard({ profesional, onReservar }: Props) {
  const { nombre, rol, foto_url, promedio, totalResenas, serviciosPrincipales, citasAtendidas } =
    profesional;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_14px_44px_-24px_rgba(22,41,94,0.35)]">
      <div className="relative aspect-[4/3] w-full bg-aventurea-blue-light">
        {foto_url ? (
          <Image
            src={foto_url}
            alt={nombre}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-aventurea-navy text-[42px] font-extrabold text-white">
            {nombre.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[15px] font-extrabold leading-tight text-aventurea-ink">{nombre}</p>
        {rol && <p className="text-[12.5px] font-semibold text-aventurea-ink-soft">{rol}</p>}

        {promedio != null && totalResenas > 0 ? (
          <p className="mt-1.5 flex items-center gap-1 text-[12.5px] font-bold text-aventurea-ink">
            <IconStar className="h-3.5 w-3.5 text-aventurea-orange" />
            {promedio.toFixed(1).replace(".", ",")}
            <span className="font-semibold text-aventurea-ink-soft">({totalResenas})</span>
          </p>
        ) : (
          <p className="mt-1.5 text-[12.5px] font-semibold text-aventurea-ink-soft">
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
  );
}
