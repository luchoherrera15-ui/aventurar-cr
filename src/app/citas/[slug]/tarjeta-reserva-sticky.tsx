"use client";

import { useState } from "react";
import { IconClock, IconPin, IconStar } from "@/components/icons";
import {
  DIAS_SEMANA_LABEL,
  horaBonita,
  type HorarioSemana,
} from "../tipos";
import { ReservarCitaModal, type ResumenNegocio } from "./reservar/reservar-cita";

type PropsAgenda = {
  ranchoId: string;
  rutaBase: string;
  nombreNegocio: string;
  items: {
    id: string;
    nombre: string;
    precio: number | null;
    duracion_minutos: number | null;
    grupo: string | null;
  }[];
  equipo: { id: string; nombre: string; rol: string | null; foto_url: string | null }[];
  horario: HorarioSemana | null;
  sesionActiva: boolean;
  nombreInicial: string;
  resumen: ResumenNegocio;
};

/**
 * La tarjeta que acompaña el scroll (patrón Fresha/Google Business):
 * la nota grande con sus estrellas, "Reservar ahora", el estado
 * Abierto/Cerrado con la hora de cierre y el horario semanal
 * desplegable, y la dirección con "Cómo llegar". Al scrollear la
 * página, esto se queda a la vista — la reserva nunca se pierde.
 */
export default function TarjetaReservaSticky({
  categoriaLabel,
  direccion,
  comoLlegarHref,
  agenda,
}: {
  categoriaLabel: string;
  direccion: string | null;
  comoLlegarHref: string | null;
  agenda: PropsAgenda;
}) {
  const [abierta, setAbierta] = useState(false);
  const [horarioAbierto, setHorarioAbierto] = useState(false);
  const { resumen, horario } = agenda;

  // Estado de apertura según la hora actual (mercado CR — hora local).
  const ahora = new Date();
  const dow = ahora.getDay();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const hoy = horario?.[String(dow)] ?? null;
  const aMin = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + (mm || 0);
  };

  let estado: { abierto: boolean; texto: string } | null = null;
  if (horario) {
    if (hoy && minutosAhora >= aMin(hoy.abre) && minutosAhora < aMin(hoy.cierra)) {
      const faltan = aMin(hoy.cierra) - minutosAhora;
      estado = {
        abierto: true,
        texto:
          faltan <= 90
            ? `cierra pronto, a las ${horaBonita(hoy.cierra)}`
            : `cierra a las ${horaBonita(hoy.cierra)}`,
      };
    } else {
      // Busca el próximo día abierto (hoy más tarde no cuenta: ya
      // pasó la apertura o todavía no toca — simplificamos a mañana+).
      let texto = "consultá el horario";
      if (hoy && minutosAhora < aMin(hoy.abre)) {
        texto = `abre hoy a las ${horaBonita(hoy.abre)}`;
      } else {
        for (let i = 1; i <= 7; i++) {
          const d = horario[String((dow + i) % 7)];
          if (d) {
            texto = `abre ${i === 1 ? "mañana" : `el ${DIAS_SEMANA_LABEL[(dow + i) % 7].toLowerCase()}`} a las ${horaBonita(d.abre)}`;
            break;
          }
        }
      }
      estado = { abierto: false, texto };
    }
  }

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-3xl border border-aventurea-line bg-white p-6 shadow-[0_14px_44px_-24px_rgba(22,41,94,0.35)]">
        {/* La nota, grande como en la referencia. */}
        {resumen.promedio != null && (resumen.totalResenas ?? 0) > 0 ? (
          <p className="flex items-center gap-2">
            <span className="text-[26px] font-black tracking-tight text-aventurea-ink">
              {resumen.promedio.toFixed(1).replace(".", ",")}
            </span>
            <span className="flex items-center gap-0.5 text-aventurea-orange">
              {Array.from({ length: Math.round(resumen.promedio) }, (_, i) => (
                <IconStar key={i} className="h-4 w-4" />
              ))}
            </span>
            <span className="text-[13.5px] font-bold text-aventurea-navy">
              ({resumen.totalResenas})
            </span>
          </p>
        ) : (
          <p className="text-[13.5px] font-bold text-aventurea-ink-soft">
            Sin reseñas todavía
          </p>
        )}

        <span className="mt-2.5 inline-block rounded-full bg-aventurea-blue-light px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy">
          {categoriaLabel}
        </span>

        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-aventurea-orange text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
        >
          Reservar ahora
        </button>

        {/* Abierto / cerrado + horario desplegable. */}
        {estado && (
          <div className="mt-5 border-t border-[#e8eef8] pt-4">
            <button
              type="button"
              onClick={() => setHorarioAbierto((v) => !v)}
              aria-expanded={horarioAbierto}
              className="flex w-full items-center gap-2 text-left text-[13px] text-aventurea-ink"
            >
              <IconClock className="h-4 w-4 shrink-0 text-aventurea-ink-soft" />
              <span
                className={`font-extrabold ${estado.abierto ? "text-aventurea-green" : "text-red-600"}`}
              >
                {estado.abierto ? "Abierto" : "Cerrado"}
              </span>
              <span className="text-aventurea-ink-soft">— {estado.texto}</span>
              <svg
                viewBox="0 0 24 24"
                className={`ml-auto h-3.5 w-3.5 shrink-0 text-aventurea-ink-soft transition-transform ${horarioAbierto ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {horarioAbierto && horario && (
              <div className="mt-3 flex flex-col gap-1">
                {DIAS_SEMANA_LABEL.map((dia, i) => {
                  const d = horario[String(i)];
                  return (
                    <p
                      key={dia}
                      className={`flex items-center justify-between text-[12.5px] ${i === dow ? "font-extrabold text-aventurea-ink" : "text-aventurea-ink-soft"}`}
                    >
                      <span>{dia}</span>
                      <span>
                        {d ? `${horaBonita(d.abre)} – ${horaBonita(d.cierra)}` : "Cerrado"}
                      </span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dirección + cómo llegar. */}
        {(direccion || resumen.ubicacion) && (
          <div className="mt-4 border-t border-[#e8eef8] pt-4">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-aventurea-ink">
              <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-aventurea-ink-soft" />
              <span>
                {direccion ?? resumen.ubicacion}{" "}
                {comoLlegarHref && (
                  <a
                    href={comoLlegarHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-aventurea-navy hover:underline"
                  >
                    Cómo llegar
                  </a>
                )}
              </span>
            </p>
          </div>
        )}
      </div>

      <ReservarCitaModal
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        ranchoId={agenda.ranchoId}
        rutaBase={agenda.rutaBase}
        nombreNegocio={agenda.nombreNegocio}
        items={agenda.items}
        equipo={agenda.equipo}
        horario={agenda.horario}
        sesionActiva={agenda.sesionActiva}
        nombreInicial={agenda.nombreInicial}
        servicioInicial={null}
        resumen={agenda.resumen}
      />
    </aside>
  );
}
