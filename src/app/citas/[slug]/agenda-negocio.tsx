"use client";

import { useState } from "react";
import { IconClock } from "@/components/icons";
import { fmtColones } from "@/lib/finanzas";
import { etiquetaMinutos, type HorarioSemana } from "../tipos";
import {
  ReservarCitaModal,
  type DatosAgendaPro,
  type ResumenNegocio,
} from "./reservar/reservar-cita";

type ServicioFila = {
  id: string;
  nombre: string;
  precio: number | null;
  duracion_minutos: number | null;
  buffer_min: number | null;
  grupo: string | null;
  descripcion: string | null;
};

type Miembro = { id: string; nombre: string; rol: string | null; foto_url: string | null };

/**
 * La sección de servicios del negocio de citas. La agenda no ocupa la
 * página: cada "Reservar" (o el botón "Consultar fechas") la despliega
 * en grande sobre la misma página — el modal de ReservarCitaModal, con
 * la tira de fechas, las horas y el resumen al lado.
 */
export default function AgendaNegocio({
  ranchoId,
  rutaBase,
  nombreNegocio,
  resumen,
  items,
  equipo,
  horario,
  agendaPro,
  sesionActiva,
  nombreInicial,
}: {
  ranchoId: string;
  rutaBase: string;
  nombreNegocio: string;
  resumen: ResumenNegocio;
  items: ServicioFila[];
  equipo: Miembro[];
  horario: HorarioSemana | null;
  agendaPro: DatosAgendaPro;
  sesionActiva: boolean;
  nombreInicial: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [servicioElegido, setServicioElegido] = useState<string | null>(null);

  function abrir(servicioId: string | null) {
    setServicioElegido(servicioId);
    setAbierta(true);
  }

  // Agrupar servicios por sección del catálogo.
  const grupos = new Map<string, ServicioFila[]>();
  items.forEach((i) => {
    const g = i.grupo?.trim() || "Servicios";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(i);
  });

  return (
    <div id="servicios" className="mt-8 scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">
          Servicios
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => abrir(null)}
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
          >
            Consultar fechas
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-aventurea-line bg-white p-6 text-[13.5px] text-aventurea-ink-soft">
          Este negocio todavía no publicó sus servicios — consultale por el chat.
        </p>
      ) : (
        [...grupos.entries()].map(([grupo, lista]) => (
          <div key={grupo} className="mt-4">
            {grupos.size > 1 && (
              <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-aventurea-navy">
                {grupo}
              </h3>
            )}
            <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
              {lista.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${i > 0 ? "border-t border-[#eef3fb]" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-aventurea-ink">{s.nombre}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-aventurea-ink-soft">
                      <IconClock className="h-3.5 w-3.5 text-aventurea-navy" />
                      {etiquetaMinutos(s.duracion_minutos ?? 30)}
                      {s.descripcion ? ` · ${s.descripcion}` : ""}
                    </p>
                  </div>
                  <p className="text-[14.5px] font-extrabold text-aventurea-ink">
                    {s.precio !== null ? fmtColones(s.precio) : "Consultar"}
                  </p>
                  <button
                    type="button"
                    onClick={() => abrir(s.id)}
                    className="rounded-xl border border-aventurea-navy px-4 py-2 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
                  >
                    Reservar
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <ReservarCitaModal
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        ranchoId={ranchoId}
        rutaBase={rutaBase}
        nombreNegocio={nombreNegocio}
        items={items}
        equipo={equipo}
        horario={horario}
        {...agendaPro}
        sesionActiva={sesionActiva}
        nombreInicial={nombreInicial}
        servicioInicial={servicioElegido}
        resumen={resumen}
      />
    </div>
  );
}
