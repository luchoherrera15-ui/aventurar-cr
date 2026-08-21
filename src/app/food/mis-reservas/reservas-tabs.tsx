"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fechaCorta, horaCorta, type FoodReservationEstado } from "@/lib/food/tipos";

export type FilaReserva = {
  id: string;
  codigoConfirmacion: string;
  partySize: number;
  estado: FoodReservationEstado;
  negocioNombre: string;
  fecha: string | null;
  hora: string | null;
  /** La franja ya pasó (fecha+hora antes de ahora, hora de Costa Rica). */
  pasada: boolean;
};

const ESTADO_LABEL: Record<FoodReservationEstado, string> = {
  confirmada: "Confirmada",
  check_in: "Ya fuiste",
  no_show: "No te presentaste",
  cancelada: "Cancelada",
};

const ESTADO_TONO: Record<FoodReservationEstado, string> = {
  confirmada: "bg-aventurea-orange-light text-aventurea-orange-dark",
  check_in: "bg-aventurea-cream-2 text-aventurea-ink-soft",
  no_show: "bg-red-50 text-red-700",
  cancelada: "bg-aventurea-cream-2 text-aventurea-ink-soft",
};

type Tab = "proximas" | "pasadas" | "canceladas";

/**
 * Las tres pestañas que pidió el dueño (Próximas / Pasadas /
 * Canceladas), sobre los MISMOS datos que ya trae el servidor — la
 * política RLS y la consulta de mis-reservas/page.tsx no cambiaron,
 * esto es solo cómo se agrupan en pantalla.
 *
 * "Próximas" = confirmada o check_in, y la franja todavía no pasó.
 * "Pasadas" = cualquier estado (confirmada, check_in, no_show) cuya
 * franja ya pasó — una reserva confirmada de ayer es "pasada" aunque
 * nadie la haya marcado como no_show. "Canceladas" es su propio grupo
 * porque el estado ya lo dice explícito, sin importar la fecha.
 */
export default function ReservasTabsFood({ reservas }: { reservas: FilaReserva[] }) {
  const [tab, setTab] = useState<Tab>("proximas");

  const grupos = useMemo(() => {
    const proximas = reservas.filter(
      (r) => (r.estado === "confirmada" || r.estado === "check_in") && !r.pasada,
    );
    const canceladas = reservas.filter((r) => r.estado === "cancelada");
    const pasadas = reservas.filter((r) => r.estado !== "cancelada" && (r.pasada || r.estado === "no_show"));
    return { proximas, pasadas, canceladas };
  }, [reservas]);

  const TABS: { id: Tab; label: string; n: number }[] = [
    { id: "proximas", label: "Próximas", n: grupos.proximas.length },
    { id: "pasadas", label: "Pasadas", n: grupos.pasadas.length },
    { id: "canceladas", label: "Canceladas", n: grupos.canceladas.length },
  ];

  const visibles = grupos[tab];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filtrar mis reservas"
        className="inline-flex w-fit gap-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${
              tab === t.id
                ? "bg-white text-aventurea-navy shadow-sm"
                : "text-aventurea-ink-soft hover:text-aventurea-navy"
            }`}
          >
            {t.label} <span className="opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-10 text-center">
          <p className="text-[13.5px] text-aventurea-ink-soft">
            {tab === "proximas"
              ? "No tenés reservas próximas."
              : tab === "pasadas"
                ? "Todavía no tenés reservas pasadas."
                : "No cancelaste ninguna reserva."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {visibles.map((r) => (
            <li key={r.id}>
              <Link
                href={`/food/reserva/${r.id}`}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-aventurea-line bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold text-aventurea-ink">{r.negocioNombre}</p>
                  {r.fecha && r.hora && (
                    <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                      {fechaCorta(r.fecha)} · {horaCorta(r.hora)} · {r.partySize}{" "}
                      {r.partySize === 1 ? "persona" : "personas"}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${ESTADO_TONO[r.estado]}`}
                >
                  {ESTADO_LABEL[r.estado] ?? r.estado}
                </span>
                <span className="shrink-0 font-mono text-[13px] font-bold text-aventurea-navy">
                  {r.codigoConfirmacion}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
