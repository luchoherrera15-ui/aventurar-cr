import Link from "next/link";

export default function AdminHubPage() {
  return (
    <div className="relative isolate">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Panel Admin
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-orange-dark">
        ¿Qué querés gestionar?
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Elegí una línea de negocio para ver sus reservas y configuración.
      </p>

      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <HubCard
          href="/admin/paquetes"
          title="Paquete Turístico"
          subtitle="Casa Puntaleona y Chalet Alajuela"
          icon={<IconSuitcase />}
        />
        <HubCard
          href="/admin/eventos"
          title="Alquiler de Salón de Eventos"
          subtitle="Rancho de eventos en Alajuela"
          icon={<IconTent />}
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
        <h2 className="text-xl font-bold text-aventurea-ink">{title}</h2>
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
