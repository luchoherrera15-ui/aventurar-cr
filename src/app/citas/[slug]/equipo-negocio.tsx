"use client";

import { useState } from "react";
import type { HorarioSemana } from "../tipos";
import {
  ReservarCitaModal,
  type DatosAgendaPro,
  type ResumenNegocio,
} from "./reservar/reservar-cita";

type Miembro = { id: string; nombre: string; rol: string | null; foto_url: string | null };

type PropsAgenda = {
  ranchoId: string;
  rutaBase: string;
  nombreNegocio: string;
  items: {
    id: string;
    nombre: string;
    precio: number | null;
    duracion_minutos: number | null;
    buffer_min: number | null;
    grupo: string | null;
  }[];
  equipo: Miembro[];
  horario: HorarioSemana | null;
  agendaPro: DatosAgendaPro;
  sesionActiva: boolean;
  nombreInicial: string;
  resumen: ResumenNegocio;
};

/**
 * El equipo del negocio, ahora vivo: la foto hace zoom al pasar el
 * mouse y tocarla abre el perfil de la persona — foto grande, rol,
 * cuántas citas ha atendido en Bookea y el botón "Reservar con X",
 * que abre la agenda con esa persona ya elegida.
 */
export default function EquipoNegocio({
  equipo,
  citasPorMiembro,
  agenda,
}: {
  equipo: Miembro[];
  /** Citas atendidas (pasadas y confirmadas) por miembro_id. */
  citasPorMiembro: Record<string, number>;
  agenda: PropsAgenda;
}) {
  const [perfil, setPerfil] = useState<Miembro | null>(null);
  const [agendaAbierta, setAgendaAbierta] = useState(false);
  const [miembroElegido, setMiembroElegido] = useState<string | null>(null);

  function reservarCon(m: Miembro) {
    setPerfil(null);
    setMiembroElegido(m.id);
    setAgendaAbierta(true);
  }

  return (
    <div className="mt-9">
      <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">
        El equipo
      </h2>
      <div className="mt-3 flex flex-wrap gap-5">
        {equipo.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setPerfil(m)}
            className="group flex w-[104px] flex-col items-center text-center"
          >
            <span className="h-20 w-20 overflow-hidden rounded-full border-2 border-white shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
              {m.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
                <img
                  src={m.foto_url}
                  alt={m.nombre}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-aventurea-navy text-[26px] font-extrabold text-white">
                  {m.nombre.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <p className="mt-2 text-[13px] font-bold leading-tight text-aventurea-ink group-hover:text-aventurea-navy">
              {m.nombre}
            </p>
            {m.rol && <p className="text-[11.5px] text-aventurea-ink-soft">{m.rol}</p>}
          </button>
        ))}
      </div>

      {/* ---------- El perfil de la persona ---------- */}
      {perfil && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Perfil de ${perfil.nombre}`}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Cerrar perfil"
            onClick={() => setPerfil(null)}
            className="absolute inset-0 cursor-default bg-[rgba(10,18,42,0.5)] backdrop-blur-[2px]"
          />
          <div className="relative w-full max-w-[380px] rounded-2xl bg-white p-7 text-center shadow-[0_40px_100px_-32px_rgba(6,12,32,0.6)]">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setPerfil(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink hover:border-aventurea-navy"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <span className="mx-auto block h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-lg">
              {perfil.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
                <img src={perfil.foto_url} alt={perfil.nombre} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-aventurea-navy text-[38px] font-extrabold text-white">
                  {perfil.nombre.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <h3 className="titulo mt-4 text-[20px] text-aventurea-ink">{perfil.nombre}</h3>
            {perfil.rol && (
              <p className="mt-0.5 text-[13px] font-semibold text-aventurea-ink-soft">
                {perfil.rol}
              </p>
            )}

            <p className="mx-auto mt-4 w-fit rounded-xl bg-aventurea-blue-light px-4 py-1.5 text-[12.5px] font-bold text-aventurea-navy">
              {citasPorMiembro[perfil.id] ?? 0} cita
              {(citasPorMiembro[perfil.id] ?? 0) === 1 ? "" : "s"} atendida
              {(citasPorMiembro[perfil.id] ?? 0) === 1 ? "" : "s"} en Bookea
            </p>

            <button
              type="button"
              onClick={() => reservarCon(perfil)}
              className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-aventurea-orange text-[14px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Reservar con {perfil.nombre.split(" ")[0]}
            </button>
          </div>
        </div>
      )}

      <ReservarCitaModal
        abierta={agendaAbierta}
        onCerrar={() => setAgendaAbierta(false)}
        ranchoId={agenda.ranchoId}
        rutaBase={agenda.rutaBase}
        nombreNegocio={agenda.nombreNegocio}
        items={agenda.items}
        equipo={agenda.equipo}
        horario={agenda.horario}
        {...agenda.agendaPro}
        sesionActiva={agenda.sesionActiva}
        nombreInicial={agenda.nombreInicial}
        servicioInicial={null}
        miembroInicial={miembroElegido}
        resumen={agenda.resumen}
      />
    </div>
  );
}
