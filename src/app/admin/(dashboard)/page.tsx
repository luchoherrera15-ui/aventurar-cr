import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { gastoDelMesIA } from "@/lib/ia/config-ia";
import { formatearCRC, formatearUSD } from "@/lib/ia/modelos";
import TableroPendientes from "./pendientes";
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

  // Lo que llevamos gastado en IA este mes, sumado en la base y con el
  // mes contado en hora de Costa Rica — el mismo que muestra /admin/ia.
  // Los colones vienen congelados de cada llamada, así que corregir el
  // tipo de cambio no mueve un total ya cerrado. Si la migración 0078
  // todavía no corrió, la suma vuelve en cero y la tarjeta muestra su
  // texto genérico en vez de un ₡0 que parecería un dato.
  const gastoIA = await gastoDelMesIA();
  const statIA =
    gastoIA.usd > 0
      ? `${formatearUSD(gastoIA.usd)} · ${formatearCRC(gastoIA.crc)} este mes`
      : "Gasto · Modelos · Conocimiento";

  return (
    <div className="relative isolate">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Panel Admin{seccion !== "todas" ? ` · ${SECCION_LABEL[seccion]}` : ""}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        ¿Qué querés gestionar?
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Todas las secciones del panel en un solo lugar: elegí una para entrar.
      </p>

      {/* El aviso suelto de "tenés N publicaciones por aprobar" lo
          reemplaza el tablero: contaba una sola cosa de las seis que
          pueden estar esperando. */}
      <TableroPendientes seccion={seccion} />

      {/* Las 11 secciones que antes vivían en el menú del header, como
          cards compactas: icono y título en una línea para que quepan
          hasta cuatro por fila. */}
      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <HubCard
          href="/admin/ranchos"
          title="Publicaciones"
          descripcion="Aprobá o rechazá los negocios que se registran, editá los publicados o dá de alta uno vos mismo."
          stat={`${ranchosPublicados} publicada${ranchosPublicados === 1 ? "" : "s"}`}
          alerta={ranchosPendientes > 0 ? `${ranchosPendientes} por revisar` : null}
          icon={<IconNegocio />}
        />
        <HubCard
          href="/admin/eventos"
          title="Reservas"
          descripcion="Todas las reservas de la plataforma: estado, fechas y detalle de cada una."
          stat={null}
          alerta={null}
          icon={<IconReserva />}
        />
        <HubCard
          href="/admin/agenda"
          title="Agenda"
          descripcion="Los próximos eventos confirmados de todos los negocios, ordenados por fecha."
          stat={null}
          alerta={null}
          icon={<IconCalendario />}
        />
        <HubCard
          href="/admin/finanzas"
          title="Finanzas"
          descripcion="Las comisiones y gastos de los alquileres, y lo que entra por invitaciones digitales."
          stat="Alquileres · Promoción · Invitaciones"
          alerta={null}
          icon={<IconChart />}
        />
        <HubCard
          href="/admin/invitaciones"
          title="Invitaciones digitales"
          descripcion="Creá la invitación, asignásela a un cliente y seguí en vivo las confirmaciones."
          stat="Producto propio de Bookea"
          alerta={null}
          icon={<IconSobre />}
        />
        <HubCard
          href="/admin/usuarios"
          title="Cuentas y accesos"
          descripcion="Cuentas nuevas, correos y contraseñas de los dueños, y permisos de administrador."
          stat={`${cuentas} cuenta${cuentas === 1 ? "" : "s"} registrada${cuentas === 1 ? "" : "s"}`}
          alerta={null}
          icon={<IconUsers />}
        />
        <HubCard
          href="/admin/complementos"
          title="Complementos"
          descripcion="Los módulos y add-ons que cada negocio tiene activos en su panel."
          stat={null}
          alerta={null}
          icon={<IconComplemento />}
        />
        <HubCard
          href="/admin/campanas"
          title="Campañas"
          descripcion="Campañas de correo para dueños y clientes de la plataforma."
          stat={null}
          alerta={null}
          icon={<IconCampana />}
        />
        <HubCard
          href="/admin/eventos/precios"
          title="Precios"
          descripcion="Los precios y servicios que se muestran en las publicaciones de eventos."
          stat={null}
          alerta={null}
          icon={<IconEtiqueta />}
        />
        <HubCard
          href="/admin/almacenamiento"
          title="Almacenamiento"
          descripcion="Quién está pesando más en storage y cuánto cuesta guardarlo y servirlo."
          stat={null}
          alerta={null}
          icon={<IconAlmacen />}
        />
        <HubCard
          href="/admin/ia"
          title="Inteligencia artificial"
          descripcion="Cuánto gastan los asistentes, con qué modelo trabaja cada uno y qué sabe el chat."
          stat={statIA}
          alerta={null}
          icon={<IconIA />}
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
  stat: string | null;
  alerta: string | null;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-aventurea-line bg-aventurea-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-aventurea-navy/40 hover:shadow-md"
    >
      <div className="flex items-center gap-2.5">
        {/* Navy, no naranja: el admin es sobrio; el naranja queda solo
            para las alertas de pendientes. */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aventurea-navy/10 text-aventurea-navy [&_svg]:h-[18px] [&_svg]:w-[18px]">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-aventurea-ink">
          {title}
        </h2>
        {alerta && (
          <span className="shrink-0 rounded-md bg-aventurea-sky px-2 py-0.5 text-[10.5px] font-bold text-white">
            {alerta}
          </span>
        )}
      </div>

      <p className="mb-3 mt-2.5 line-clamp-2 text-[12px] leading-snug text-aventurea-ink-soft">
        {descripcion}
      </p>

      {/* mt-auto deja el pie alineado entre cards aunque el texto varíe. */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-aventurea-line pt-2.5">
        <span className="min-w-0 truncate text-[11px] font-bold text-aventurea-ink-soft">
          {stat ?? "Entrar"}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-3.5 w-3.5 shrink-0 text-aventurea-navy transition-transform duration-200 group-hover:translate-x-1"
        >
          <path
            d="M4 10h12m0 0-5-5m5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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

function IconIA() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path
        strokeLinecap="round"
        d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"
      />
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

function IconReserva() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z"
      />
      <path strokeLinecap="round" d="M15 5v2.5M15 10.5v3M15 16.5V19" />
    </svg>
  );
}

function IconCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconComplemento() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path strokeLinecap="round" d="M17.5 14v7M14 17.5h7" />
    </svg>
  );
}

function IconCampana() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 2 15 22l-4-9-9-4 20-7Z"
      />
    </svg>
  );
}

function IconEtiqueta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h7.6a2 2 0 0 1 1.4.6l8.4 8.4a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0L3.6 12A2 2 0 0 1 3 10.6V3Z"
      />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </svg>
  );
}

function IconAlmacen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5V18.5c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}
