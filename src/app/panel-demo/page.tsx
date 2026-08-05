import Link from "next/link";

type IconName = "calendar" | "wallet" | "clock" | "chart" | "users" | "arrow";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.8 };

  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...shared} aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path strokeLinecap="round" d="M7.5 3.5v3M16.5 3.5v3M3.5 10h17M8 14h3M8 17h6" />
      </svg>
    );
  }
  if (name === "wallet") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...shared} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v2.5H5.5A2.5 2.5 0 0 0 3 12v5a2 2 0 0 0 2 2h15v-3.5h-4a2 2 0 0 1 0-4h4V9.5H5.5" />
        <circle cx="16" cy="13.5" r=".7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...shared} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3.2 2" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...shared} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5V5M4 19.5h16M8 16v-4M12 16V8M16 16V5" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...shared} aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 19c.5-3.1 2.4-4.8 5.5-4.8s5 1.7 5.5 4.8M16.5 5.5a2.6 2.6 0 0 1 0 5M18.2 14.4c1.4.7 2.2 2.1 2.3 4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path d="M4 10h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "orange" | "neutral";
  icon: IconName;
}) {
  const tones = {
    blue: "border-sky-400/70 text-sky-300 bg-sky-400/10",
    orange: "border-orange-400/80 text-orange-300 bg-orange-400/10",
    neutral: "border-slate-500/80 text-white bg-white/[0.035]",
  };
  const iconTones = {
    blue: "bg-sky-400/15 text-sky-300",
    orange: "bg-orange-400/15 text-orange-300",
    neutral: "bg-white/10 text-white/75",
  };

  return (
    <article className={`group relative overflow-hidden rounded-2xl border-t-[3px] p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.075] ${tones[tone]}`}>
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-current opacity-[0.055] blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/50">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconTones[tone]}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="relative mt-4 text-[25px] font-extrabold leading-none tracking-tight">{value}</p>
      <p className="relative mt-2 text-[11.5px] font-medium text-white/45">{detail}</p>
    </article>
  );
}

function ActionCard({
  count,
  title,
  text,
  icon,
}: {
  count: number;
  title: string;
  text: string;
  icon: IconName;
}) {
  return (
    <button type="button" className="group flex min-h-[122px] w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-orange-400/40 hover:bg-white/[0.09]">
      <span className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#ff7a1a] text-[15px] font-extrabold text-white shadow-lg shadow-orange-950/30">
        {count}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold leading-snug text-white">{title}</span>
          <Icon name={icon} className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-orange-300" />
        </span>
        <span className="mt-2 flex items-center gap-1 text-[11px] font-bold text-orange-300">
          {text} <Icon name="arrow" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </button>
  );
}

export default function PanelDemoPage() {
  return (
    <main className="min-h-screen bg-[#f3f6fb] px-4 py-8 text-slate-950 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[1160px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-[13px] font-bold text-slate-500 transition hover:text-[#132653]">
            ← Volver a Bookea
          </Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold tracking-wide text-slate-500 shadow-sm">
            CONCEPTO VISUAL · PANEL DE NEGOCIO
          </span>
        </div>

        <section className="relative overflow-hidden rounded-[28px] bg-[#071126] p-5 shadow-[0_25px_80px_-30px_rgba(8,21,50,.55)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-44 left-1/3 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:32px_32px]" />

          <div className="relative">
            <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-[74px] w-[74px] shrink-0 rounded-2xl border border-white/15 bg-[url('/fondos/portada-eventos.jpg')] bg-cover bg-center shadow-xl shadow-black/20" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[25px]">Rancho las Torres</h1>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,.8)]" /> Publicado
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                    <span className="mr-2 font-extrabold tracking-wide text-orange-300">LUGARES</span>
                    Alajuela, Calle Monge, 200 mts oeste del puente
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85">
                    <span className="text-white/45">Tu página</span> /rancholastorres <Icon name="arrow" className="h-3.5 w-3.5" />
                  </p>
                </div>
              </div>
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff7819] px-5 py-3 text-[13px] font-extrabold text-white shadow-lg shadow-orange-950/30 transition hover:bg-[#e8660d]">
                Editar perfil y fotos
              </button>
            </header>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-white/45">
              <span>Capacidad <strong className="font-bold text-white">10–180</strong></span>
              <span>Precio desde <strong className="font-bold text-white">₡80 000</strong></span>
              <span>WhatsApp <strong className="font-bold text-white">8710 3739</strong></span>
              <span className="ml-auto inline-flex items-center gap-1.5 font-bold text-sky-300"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> Actualizado ahora</span>
            </div>

            <section className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">Necesita tu atención</h2>
                <span className="text-[11px] font-bold text-orange-300">2 acciones pendientes</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ActionCard count={1} title="Reserva esperando tu aprobación" text="Atender ahora" icon="calendar" />
                <ActionCard count={1} title="Depósito sin validar" text="Revisar comprobante" icon="wallet" />
              </div>
            </section>

            <section className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">Pulso del negocio</h2>
                  <p className="mt-1 text-[13px] font-semibold text-white">Así se mueve Rancho las Torres este mes</p>
                </div>
                <button type="button" className="hidden rounded-xl border border-white/15 bg-white/[0.045] px-3 py-2 text-[11px] font-bold text-white/70 transition hover:bg-white/10 sm:block">Ver reporte completo</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Reservas este mes" value="7" detail="Recién arrancando este mes" tone="blue" icon="calendar" />
                <Metric label="Ingresos este mes" value="₡280 000" detail="Igual que el mes pasado" tone="orange" icon="wallet" />
                <Metric label="Próxima reserva" value="8 ago" detail="Wendy Ríos Jiménez · 80 personas" icon="clock" />
                <Metric label="Ocupación · 30 días" value="17%" detail="5 fechas ya confirmadas" tone="blue" icon="chart" />
                <Metric label="Por cobrar · 30 días" value="₡480 000" detail="Saldos de 3 eventos próximos" tone="orange" icon="wallet" />
                <Metric label="Reservas totales" value="13" detail="Desde que publicaste tu negocio" icon="users" />
              </div>
            </section>
          </div>
        </section>

        <p className="mx-auto mt-5 max-w-2xl text-center text-[12px] leading-relaxed text-slate-500">
          Propuesta: un panel con mayor contraste, métricas más escaneables y acciones visibles primero. Los botones y cifras son datos de demostración.
        </p>
      </div>
    </main>
  );
}
