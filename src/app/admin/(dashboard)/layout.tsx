import Link from "next/link";
import { logout } from "./actions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-white/15 bg-aventurea-navy/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-5 px-7 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-aventurea-orange text-[13.5px] font-bold text-aventurea-navy">
              A
            </span>
            <span className="text-[15px] font-bold text-white">
              AVENTUREA CR
            </span>
            <span className="text-[#5C7796]">/</span>
            <span className="text-[12.5px] font-light text-[#C6D3E8]">
              Panel Admin
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/admin"
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-[#AFC6E0] hover:bg-white/10 hover:text-white"
            >
              Reservas
            </Link>
            <Link
              href="/admin/precios"
              className="rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-[#AFC6E0] hover:bg-white/10 hover:text-white"
            >
              Precios
            </Link>
            <span className="mx-2 h-[18px] w-px bg-white/15" />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-aventurea-line bg-white px-4 py-1.5 text-[13px] font-bold text-aventurea-navy hover:border-aventurea-orange hover:text-aventurea-orange-dark"
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
