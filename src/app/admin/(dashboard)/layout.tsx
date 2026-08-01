import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { logout } from "./actions";
import { seccionActiva } from "./vertical-server";
import VerticalSwitcher from "./vertical-switcher";

const NAV: [string, string][] = [
  ["/admin", "Inicio"],
  ["/admin/agenda", "Agenda"],
  ["/admin/ranchos", "Negocios"],
  ["/admin/eventos", "Reservas"],
  ["/admin/finanzas", "Finanzas"],
  ["/admin/ia", "IA"],
  ["/admin/almacenamiento", "Almacenamiento"],
  ["/admin/invitaciones", "Invitaciones"],
  ["/admin/usuarios", "Cuentas"],
  ["/admin/campanas", "Campañas"],
  ["/admin/eventos/precios", "Precios"],
];

/**
 * La segunda puerta del panel, y la que de verdad importa.
 *
 * La primera es proxy.ts, que corta toda ruta /admin de quien no tenga
 * rol admin. Pero el middleware es UNA capa: si le cambian el matcher,
 * si aparece una ruta con otro patrón, o si algún día Next trae un
 * bypass, se cae solita — y todas las páginas de acá adentro leen con
 * la llave de servicio, que se salta RLS por completo. Sin esta
 * verificación, esa caída expone la plataforma entera.
 *
 * Ojo con lo que esto NO cubre: las server actions se pueden invocar
 * por su id desde cualquier ruta, así que no pasan por acá. Cada acción
 * verifica por su cuenta con requireAdmin() — ver ./eventos/actions.ts.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ok } = await requireAdmin();
  if (!ok) redirect("/admin/login");

  const seccion = await seccionActiva();
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-6 py-3.5 lg:px-10">
          <Link href="/admin" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- el
                logo oficial es un PNG estático: next/image no aporta
                nada acá. */}
            <img src="/logo-bookea.png" alt="Bookear" className="h-6 w-auto shrink-0" />
            <span className="text-zinc-300">/</span>
            <span className="text-[12.5px] font-light text-aventurea-ink-soft">
              Panel Admin
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
              >
                {label}
              </Link>
            ))}
            <span className="mx-2 h-[18px] w-px bg-aventurea-line" />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-xl border border-aventurea-line bg-white px-4 py-1.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
              >
                Cerrar sesión
              </button>
            </form>
          </nav>
        </div>
        <div className="border-t border-aventurea-line/60">
          <div className="mx-auto max-w-[1600px] px-6 py-2 lg:px-10">
            <VerticalSwitcher actual={seccion} />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">{children}</div>
    </div>
  );
}
