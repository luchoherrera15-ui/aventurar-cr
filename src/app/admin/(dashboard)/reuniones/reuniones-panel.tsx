"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL } from "@/components/panel/sistema";
import { fechaLargaReunion } from "@/lib/lealtad/reuniones";
import { cambiarEstadoReunion } from "./actions";
import type { EstadoReunion, ReunionFila } from "@/lib/lealtad/reuniones";

/**
 * LA AGENDA DE REUNIONES — las próximas por día, y las pasadas abajo.
 *
 * Una lista agrupada por fecha y no un calendario mensual: son pocas
 * reuniones por semana y lo que Bookea necesita es «a quién llamo hoy y
 * mañana», no una cuadrícula con celdas vacías. Cada fila tiene el
 * contacto a un toque (mailto, wa.me) y el estado, que se cambia ahí.
 */

const ESTADO_UI: Record<EstadoReunion, { texto: string; tono: "aviso" | "info" | "exito" | "neutro" }> = {
  pendiente: { texto: "Pendiente", tono: "aviso" },
  confirmada: { texto: "Confirmada", tono: "info" },
  hecha: { texto: "Hecha", tono: "exito" },
  cancelada: { texto: "Cancelada", tono: "neutro" },
};

function Fila({ r }: { r: ReunionFila }) {
  const router = useRouter();
  const [ocupado, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cambiar = (estado: EstadoReunion) => {
    setError(null);
    arrancar(async () => {
      const res = await cambiarEstadoReunion(r.id, estado);
      if (!res.ok) setError(res.motivo);
      else router.refresh();
    });
  };
  const wa = r.telefono ? `https://wa.me/${r.telefono.replace(/\D/g, "")}` : null;
  return (
    <li className={`flex flex-wrap items-start gap-3 rounded-2xl border border-aventurea-line bg-white p-4 ${r.estado === "cancelada" ? "opacity-60" : ""}`}>
      <div className="w-[64px] shrink-0 text-center">
        <p className="titulo text-[22px] leading-none text-aventurea-navy">{r.hora}</p>
        <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">30 min</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-extrabold text-aventurea-ink">{r.nombre}</p>
          {r.negocio && <span className="text-[13px] text-aventurea-ink-soft">· {r.negocio}</span>}
          <PildoraEstado estado={ESTADO_UI[r.estado].tono}>{ESTADO_UI[r.estado].texto}</PildoraEstado>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-aventurea-ink-soft">
          <a href={`mailto:${r.correo}`} className="font-bold text-aventurea-navy underline underline-offset-2">
            {r.correo}
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="font-bold text-aventurea-navy underline underline-offset-2">
              WhatsApp {r.telefono}
            </a>
          )}
        </p>
        {r.notas && <p className="mt-1.5 rounded-xl bg-aventurea-cream-2 px-3 py-2 text-[13px] text-aventurea-ink">«{r.notas}»</p>}
        {error && <p className="mt-1.5 text-[12.5px] font-bold text-red-700">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {r.estado === "pendiente" && (
          <button type="button" disabled={ocupado} onClick={() => cambiar("confirmada")} className={BOTON_PANEL}>
            Confirmar
          </button>
        )}
        {(r.estado === "pendiente" || r.estado === "confirmada") && (
          <>
            <button type="button" disabled={ocupado} onClick={() => cambiar("hecha")} className={BOTON_PANEL}>
              Hecha
            </button>
            <button type="button" disabled={ocupado} onClick={() => cambiar("cancelada")} className={BOTON_PANEL}>
              Cancelar
            </button>
          </>
        )}
        {(r.estado === "hecha" || r.estado === "cancelada") && (
          <button type="button" disabled={ocupado} onClick={() => cambiar("pendiente")} className={BOTON_PANEL}>
            Reabrir
          </button>
        )}
      </div>
    </li>
  );
}

function PorDia({ filas }: { filas: ReunionFila[] }) {
  const dias = new Map<string, ReunionFila[]>();
  for (const f of filas) dias.set(f.fecha, [...(dias.get(f.fecha) ?? []), f]);
  return (
    <div className="flex flex-col gap-5">
      {[...dias.entries()].map(([fecha, lista]) => (
        <section key={fecha}>
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
            {fechaLargaReunion(fecha)} · {lista.length}
          </h3>
          <ul className="flex flex-col gap-2">
            {lista.map((r) => (
              <Fila key={r.id} r={r} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function ReunionesPanel({ proximas, pasadas }: { proximas: ReunionFila[]; pasadas: ReunionFila[] }) {
  const pendientes = proximas.filter((r) => r.estado === "pendiente").length;
  return (
    <div className="flex flex-col gap-4">
      <Card eyebrow="Lealtad" titulo="Reuniones de ayuda" accion={<PildoraEstado estado={pendientes > 0 ? "aviso" : "neutro"}>{pendientes} por confirmar</PildoraEstado>}>
        <p className="text-[13px] leading-snug text-aventurea-ink-soft">
          Quien eligió «Necesito ayuda» en bookea.lat/lealtad y programó día y hora. Confirmá, marcá como hecha o cancelá; el correo de aviso ya les llegó al agendar.
        </p>
        {proximas.length === 0 ? <CardVacia>No hay reuniones próximas.</CardVacia> : <div className="mt-4"><PorDia filas={proximas} /></div>}
      </Card>
      {pasadas.length > 0 && (
        <Card eyebrow="Historial" titulo="Pasadas">
          <PorDia filas={pasadas} />
        </Card>
      )}
    </div>
  );
}
