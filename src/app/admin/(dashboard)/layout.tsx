import Link from "next/link";
import { logout } from "./actions";

const NAV: [string, string][] = [
  ["/admin", "Inicio"],
  ["/admin/agenda", "Agenda"],
  ["/admin/ranchos", "Salones"],
  ["/admin/eventos", "Reservas"],
  ["/admin/balance", "Balance"],
  ["/admin/usuarios", "Cuentas"],
  ["/admin/eventos/precios", "Precios"],
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-6 py-3.5 lg:px-10">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-aventurea-orange text-[13.5px] font-bold text-white">
              B
            </span>
            <span className="text-[15px] font-bold text-aventurea-ink">
              BOOKEAR CR
            </span>
            <span className="text-zinc-500">/</span>
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
      </header>
      <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">{children}</div>
    </div>
  );
}
