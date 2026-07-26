import Link from "next/link";
import { logout } from "./actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-aventurea-orange text-[13.5px] font-bold text-zinc-950">
              A
            </span>
            <span className="text-[15px] font-bold text-aventurea-ink">
              AVENTUREA CR
            </span>
            <span className="text-zinc-600">/</span>
            <span className="text-[12.5px] font-light text-aventurea-ink-soft">
              Panel Admin
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/admin"
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
            >
              Inicio
            </Link>
            <Link
              href="/admin/eventos"
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
            >
              Reservas
            </Link>
            <Link
              href="/admin/eventos/precios"
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
            >
              Precios
            </Link>
            <span className="mx-2 h-[18px] w-px bg-aventurea-line" />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-aventurea-line bg-white px-4 py-1.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
              >
                Cerrar sesión
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[1180px] px-7 py-8">{children}</div>
    </div>
  );
}
