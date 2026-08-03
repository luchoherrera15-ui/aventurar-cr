"use client";

import Link from "next/link";
import { useState } from "react";
import TarjetaExpandible from "@/components/tarjeta-expandible";
import ResenaForm from "./resena-form";
import { CATEGORIA_LABEL, normalizarCategoria } from "../mi-negocio/types";

/**
 * Las reservas de la cuenta dentro de una TarjetaExpandible: el
 * encabezado lleva el título y las píldoras Activas/Historial (el mismo
 * patrón de la bandeja de mensajes) y el cuerpo enseña un adelanto de
 * dos reservas de la pestaña activa; el resto queda plegado. La página
 * (server) separa los datos y los manda planos; acá solo se pintan.
 */

export type ReservaCliente = {
  id: string;
  fecha: string;
  estado: string;
  monto_total: number | null;
  horario_bloque: string | null;
  rancho_id: string | null;
  ranchos: { nombre: string; foto_url: string | null; categoria: string; slug: string | null } | null;
};

export type ResenaPropia = {
  reserva_id: string;
  calificacion: number;
  comentario: string | null;
};

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En revisión",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  // Estados de citas (0061): el negocio marca la asistencia.
  cumplida: "Cumplida",
  no_asistio: "No asististe",
  cancelada: "Cancelada",
};
const ESTADO_CLASE: Record<string, string> = {
  pendiente: "bg-aventurea-orange/10 text-aventurea-ink",
  confirmada: "bg-aventurea-green/10 text-aventurea-green",
  rechazada: "bg-red-100 text-red-700",
  cumplida: "bg-aventurea-green/10 text-aventurea-green",
  no_asistio: "bg-red-100 text-red-700",
  cancelada: "bg-aventurea-cream-2 text-aventurea-ink-soft",
};

export default function ReservasTabs({
  activas,
  historial,
  resenas,
  hoy,
}: {
  activas: ReservaCliente[];
  historial: ReservaCliente[];
  /** Reseñas propias por reserva_id (objeto plano, serializable). */
  resenas: Record<string, ResenaPropia>;
  /** Hoy en ISO (zona CR): la reseña se habilita desde el día después. */
  hoy: string;
}) {
  const [tab, setTab] = useState<"activas" | "historial">("activas");
  const visibles = tab === "activas" ? activas : historial;

  return (
    <TarjetaExpandible
      className="mt-6"
      titulo="Tus reservas"
      conteo={activas.length + historial.length}
      genero="f"
      adelanto={2}
      claseCuerpo="p-3.5"
      claseContenido="flex flex-col gap-2.5"
      claseResto="pt-2.5"
      extra={
        <div className="flex gap-2">
          <PestanaTab
            label="Activas"
            cantidad={activas.length}
            activo={tab === "activas"}
            onClick={() => setTab("activas")}
          />
          <PestanaTab
            label="Historial"
            cantidad={historial.length}
            activo={tab === "historial"}
            onClick={() => setTab("historial")}
          />
        </div>
      }
    >
      {visibles.length === 0 ? (
        <p className="px-1.5 py-1 text-[13px] text-aventurea-ink-soft">
          {tab === "activas"
            ? "Todavía no tenés reservas en curso."
            : "Todavía no tenés reservas pasadas."}
        </p>
      ) : (
        visibles.map((r) =>
          tab === "activas" ? (
            <TarjetaReserva key={r.id} reserva={r} />
          ) : (
            <TarjetaReserva
              key={r.id}
              reserva={r}
              atenuada
              resena={resenas[r.id] ?? null}
              permitirResena={r.fecha < hoy || r.estado === "cumplida"}
            />
          ),
        )
      )}
    </TarjetaExpandible>
  );
}

function PestanaTab({
  label,
  cantidad,
  activo,
  onClick,
}: {
  label: string;
  cantidad: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-ink"
      }`}
    >
      {label}
      <span className={`ml-1.5 ${activo ? "text-white/70" : "text-zinc-400"}`}>{cantidad}</span>
    </button>
  );
}

function TarjetaReserva({
  reserva,
  atenuada,
  resena,
  permitirResena,
}: {
  reserva: ReservaCliente;
  atenuada?: boolean;
  resena?: ResenaPropia | null;
  permitirResena?: boolean;
}) {
  const href = reserva.ranchos?.slug ? `/${reserva.ranchos.slug}` : null;
  // La reseña se habilita desde el día después del evento, o de una
  // vez si la cita quedó cumplida (la política de la base exige lo
  // mismo — esto evita el botón muerto).
  const puedeResenar =
    !!permitirResena &&
    (reserva.estado === "confirmada" || reserva.estado === "cumplida") &&
    !!reserva.rancho_id;

  return (
    <div
      className={`rounded-xl border border-aventurea-line bg-aventurea-surface p-2.5 ${atenuada ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center bg-aventurea-cream-2"
          style={
            reserva.ranchos?.foto_url ? { backgroundImage: `url(${reserva.ranchos.foto_url})` } : undefined
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-wide text-aventurea-navy">
            {reserva.ranchos ? CATEGORIA_LABEL[normalizarCategoria(reserva.ranchos.categoria)] : ""}
          </p>
          <p className="truncate text-[14px] font-bold text-aventurea-ink">
            {reserva.ranchos?.nombre ?? "Proveedor"}
          </p>
          <p className="text-[12.5px] text-aventurea-ink-soft">
            {reserva.fecha}
            {reserva.horario_bloque ? ` · ${reserva.horario_bloque}` : ""}
          </p>
          {reserva.monto_total !== null && (
            <p className="text-[12.5px] font-bold text-aventurea-ink">{fmtColones(reserva.monto_total)}</p>
          )}
        </div>
        <span
          className={`shrink-0 self-start rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${ESTADO_CLASE[reserva.estado] ?? "bg-zinc-100 text-zinc-600"}`}
        >
          {ESTADO_LABEL[reserva.estado] ?? reserva.estado}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-aventurea-line pt-2">
        {href && (
          <Link href={href} className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy">
            Ver proveedor
          </Link>
        )}
        <Link
          href={`/mensajes/${reserva.id}`}
          className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
        >
          Mensajes
        </Link>
        {puedeResenar && (
          <ResenaForm
            reservaId={reserva.id}
            ranchoId={reserva.rancho_id!}
            nombreRancho={reserva.ranchos?.nombre ?? "el proveedor"}
            resenaExistente={resena ?? null}
          />
        )}
      </div>
    </div>
  );
}
