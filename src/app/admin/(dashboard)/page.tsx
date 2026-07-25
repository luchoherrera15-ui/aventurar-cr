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
        <StatCard
          label="Solicitudes pendientes"
          value={pendientes}
          color="orange"
          icon={<IconClock />}
        />
        <StatCard
          label="Confirmadas este mes"
          value={confirmadasEsteMes}
          color="navy"
          icon={<IconCheck />}
        />
        <StatCard
          label="Depósitos por validar"
          value={depositosPorValidar}
          color="ink"
          icon={<IconBanknote />}
        />
        <StatCard
          label="Reservas activas"
          value={activas}
          color="green"
          icon={<IconTrendingUp />}
        />
      </div>

      <ReservasTable initialReservas={reservas} />
    </div>
  );
}

const COLOR_BG: Record<string, string> = {
  orange: "bg-aventurea-orange",
  navy: "bg-aventurea-navy",
  green: "bg-aventurea-green",
  ink: "bg-aventurea-ink",
};

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "orange" | "navy" | "green" | "ink";
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 shadow-sm ${COLOR_BG[color]}`}
    >
      <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 text-white/15">
        {icon}
      </div>
      <div className="relative text-2xl font-bold leading-none text-white">
        {value}
      </div>
      <div className="relative mt-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70">
        {label}
      </div>
    </div>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-full w-full">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconBanknote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-full w-full">
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <circle cx="12" cy="12.5" r="3" />
      <path strokeLinecap="round" d="M6 9h.01M18 16h.01" />
    </svg>
  );
}
function IconTrendingUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h6v6" />
    </svg>
  );
}
