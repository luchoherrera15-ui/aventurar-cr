import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IconWarning } from "@/components/icons";
import { perteneceASeccion, SECCION_LABEL } from "./vertical";
import { seccionActiva } from "./vertical-server";

export default async function AdminHubPage() {
  const supabase = await createClient();
  const seccion = await seccionActiva();

  const [ranchosRes, perfilesRes] = await Promise.all([
    supabase.from("ranchos").select("id, estado, vertical"),
    supabase.from("perfiles").select("id"),
  ]);

  const ranchos = (ranchosRes.data ?? []).filter((r) =>
    perteneceASeccion(r.vertical, seccion),
  );

  const ranchosPendientes = ranchos.filter((r) => r.estado === "pendiente").length;
  const ranchosPublicados = ranchos.filter((r) => r.estado === "aprobado").length;
  const cuentas = (perfilesRes.data ?? []).length;

  return (
    <div className="relative isolate">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Panel Admin{seccion !== "todas" ? ` · ${SECCION_LABEL[seccion]}` : ""}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        ¿Qué querés gestionar?
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Control completo de la plataforma: publicaciones, cuentas,
        invitaciones y finanzas.
      </p>

      {ranchosPendientes > 0 && (
        <Link
          href="/admin/ranchos"
          className="mt-5 flex items-center gap-3 rounded-xl border border-aventurea-orange/30 bg-aventurea-orange/10 p-4 text-[13.5px] font-bold text-aventurea-orange hover:bg-aventurea-orange/15"
        >
          <IconWarning className="h-4 w-4 shrink-0" />
          Tenés {ranchosPendientes} publicación
          {ranchosPendientes === 1 ? "" : "es"} esperando tu aprobación →
        </Link>
      )}

      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
        <HubCard
          href="/admin/ranchos"
          title="Publicaciones"
          descripcion="Aprobá o rechazá los negocios que se registran, editá los que ya están publicados o dá de alta uno vos mismo."
          stat={`${ranchosPublicados} publicada${ranchosPublicados === 1 ? "" : "s"}`}
          alerta={ranchosPendientes > 0 ? `${ranchosPendientes} por revisar` : null}
          icon={<IconNegocio />}
        />
        <HubCard
          href="/admin/usuarios"
          title="Cuentas y accesos"
          descripcion="Creá cuentas nuevas, cambiá el correo o la contraseña de cualquier dueño, y decidí quién tiene permisos de administrador."
          stat={`${cuentas} cuenta${cuentas === 1 ? "" : "s"} registrada${cuentas === 1 ? "" : "s"}`}
          alerta={null}
          icon={<IconUsers />}
        />
        <HubCard
          href="/admin/invitaciones"
          title="Invitaciones digitales"
          descripcion="El producto propio de Bookea: creá la invitación, asignásela a un cliente y seguí en vivo las confirmaciones de sus invitados."
          stat="Diseñadas y vendidas por Bookea"
          alerta={null}
          icon={<IconSobre />}
        />
        <HubCard
          href="/admin/finanzas"
          title="Finanzas"
          descripcion="Toda la plata en una sola pantalla: las comisiones y los gastos de los alquileres, y lo que entra por invitaciones digitales — cada cosa en su pestaña."
          stat="Alquileres · Promoción · Invitaciones"
          alerta={null}
          icon={<IconChart />}
        />
      </div>
    </div>
  );
}

function HubCard({
  href,
  title,
  descripcion,
  stat,
  alerta,
  icon,
}: {
  href: string;
  title: string;
  descripcion: string;
  stat: string;
  alerta: string | null;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-aventurea-line bg-aventurea-surface p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-aventurea-navy/40 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Navy, no naranja: el admin es sobrio; el naranja queda solo
            para las alertas de pendientes. */}
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aventurea-navy/10 text-aventurea-navy [&_svg]:h-[22px] [&_svg]:w-[22px]">
          {icon}
        </span>
        {alerta && (
          <span className="rounded-lg bg-aventurea-orange px-2.5 py-1 text-[11px] font-bold text-white">
            {alerta}
          </span>
        )}
      </div>

      <h2 className="mt-4 text-[17px] font-bold text-aventurea-ink">{title}</h2>
      <p className="mb-5 mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
        {descripcion}
      </p>

      {/* mt-auto deja el pie alineado entre cards aunque el texto varíe. */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-aventurea-line pt-4">
        <span className="text-[12px] font-bold text-aventurea-ink-soft">
          {stat}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-aventurea-navy">
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

function IconSobre() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7.5 9 6 9-6" />
    </svg>
  );
}

function IconNegocio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10v9a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5 4.6 4.7a1 1 0 0 1 .95-.7h12.9a1 1 0 0 1 .95.7L21 9.5a2.6 2.6 0 0 1-5.2.6 2.6 2.6 0 0 1-5.2 0 2.6 2.6 0 0 1-5.2 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.8 20v-4.6h4.4V20" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="9" cy="8" r="3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 5.2a3.5 3.5 0 0 1 0 5.6M17.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  );
}
