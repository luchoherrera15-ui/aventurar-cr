import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHubPage() {
  const supabase = await createClient();

  const [ranchosRes, reservasRes, perfilesRes] = await Promise.all([
    supabase.from("ranchos").select("estado"),
    supabase.from("reservas").select("estado").neq("estado", "temporal"),
    supabase.from("perfiles").select("id"),
  ]);

  const ranchos = ranchosRes.data ?? [];
  const reservas = reservasRes.data ?? [];

  const ranchosPendientes = ranchos.filter((r) => r.estado === "pendiente").length;
  const ranchosPublicados = ranchos.filter((r) => r.estado === "aprobado").length;
  const reservasPendientes = reservas.filter((r) => r.estado === "pendiente").length;
  const cuentas = (perfilesRes.data ?? []).length;

  return (
    <div className="relative isolate">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Panel Admin
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-orange-dark">
        ¿Qué querés gestionar?
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Control completo de la plataforma: salones, reservas, cuentas y
        finanzas.
      </p>

      {ranchosPendientes > 0 && (
        <Link
          href="/admin/ranchos"
          className="mt-5 flex items-center gap-3 rounded-xl border border-aventurea-orange/30 bg-aventurea-orange/10 p-4 text-[13.5px] font-bold text-aventurea-orange hover:bg-aventurea-orange/15"
        >
          ⚠ Tenés {ranchosPendientes} salón
          {ranchosPendientes === 1 ? "" : "es"} esperando tu aprobación →
        </Link>
      )}

      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <HubCard
          href="/admin/ranchos"
          title="Salones y ranchos"
          subtitle={`${ranchosPublicados} publicados · ${ranchosPendientes} pendientes`}
          icon={<IconTent />}
        />
        <HubCard
          href="/admin/eventos"
          title="Reservas"
          subtitle={`${reservasPendientes} en aprobación`}
          icon={<IconCalendar />}
        />
        <HubCard
          href="/admin/balance"
          title="Balance y finanzas"
          subtitle="Comisiones por salón y gastos fijos"
          icon={<IconChart />}
        />
        <HubCard
          href="/admin/usuarios"
          title="Cuentas y accesos"
          subtitle={`${cuentas} cuenta${cuentas === 1 ? "" : "s"} registrada${cuentas === 1 ? "" : "s"}`}
          icon={<IconUsers />}
        />
        <HubCard
          href="/admin/eventos/precios"
          title="Precios del rancho propio"
          subtitle="Tarifas, servicios y depósito"
          icon={<IconTag />}
        />
        <HubCard
          href="/admin/paquetes"
          title="Paquete Turístico"
          subtitle="Casa Puntaleona y Chalet Alajuela"
          icon={<IconSuitcase />}
        />
      </div>
    </div>
  );
}

function HubCard({
  href,
  title,
  subtitle,
  icon,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-aventurea-line bg-white p-7 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-aventurea-orange opacity-10 blur-3xl transition-opacity duration-300 group-hover:opacity-20"
      />
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 text-aventurea-ink/10 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <div className="relative">
        <h2 className="text-lg font-bold text-aventurea-ink">{title}</h2>
        <p className="mt-1.5 text-[13px] text-aventurea-ink-soft">{subtitle}</p>
        <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-bold text-aventurea-orange">
          Entrar
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
          >
            <path
              d="M4 10h12m0 0-5-5m5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function IconSuitcase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path strokeLinecap="round" d="M3 12h18" />
    </svg>
  );
}

function IconTent() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 3 20h18L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12 5 20M16.5 12 19 20" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
      <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
      <circle cx="9" cy="8" r="3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 5.2a3.5 3.5 0 0 1 0 5.6M17.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12V4h8l9 9-8 8-9-9Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}
