import { createClient } from "@/lib/supabase/server";
import ReservasTable from "./reservas-table";
import type { Reserva } from "./types";

export default async function AdminReservasPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .order("fecha", { ascending: true });

  const reservas = (data ?? []) as Reserva[];

  const now = new Date();
  const pendientes = reservas.filter((r) => r.estado === "pendiente").length;
  const confirmadasEsteMes = reservas.filter((r) => {
    if (r.estado !== "confirmada") return false;
    const [y, m] = r.fecha.split("-").map(Number);
    return y === now.getFullYear() && m - 1 === now.getMonth();
  }).length;
  const depositosPorValidar = reservas.filter(
    (r) => r.estado === "confirmada" && !r.deposito_validado,
  ).length;
  const activas = reservas.filter(
    (r) => r.estado === "confirmada" || r.estado === "pendiente",
  ).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
            Rancho de Eventos
          </p>
          <h1 className="mt-1 text-2xl font-bold text-aventurea-navy">
            Reservas
          </h1>
          <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
            Datos en vivo desde Supabase.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las reservas: {error.message}
        </p>
      )}

      <div className="mb-7 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Solicitudes pendientes" value={pendientes} accent />
        <StatCard label="Confirmadas este mes" value={confirmadasEsteMes} />
        <StatCard
          label="Depósitos por validar"
          value={depositosPorValidar}
          accent
        />
        <StatCard label="Reservas activas" value={activas} green />
      </div>

      <ReservasTable initialReservas={reservas} />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  green,
}: {
  label: string;
  value: number;
  accent?: boolean;
  green?: boolean;
}) {
  const bar = green
    ? "bg-aventurea-green"
    : accent
      ? "bg-aventurea-orange"
      : "bg-aventurea-navy";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-aventurea-line bg-white p-5 shadow-sm">
      <span className={`absolute left-0 top-0 h-full w-[5px] ${bar}`} />
      <div className="text-2xl font-bold leading-none text-aventurea-navy">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-bold text-aventurea-ink-soft">
        {label}
      </div>
    </div>
  );
}
