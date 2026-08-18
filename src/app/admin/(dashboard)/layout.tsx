import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { logout } from "./actions";
import { seccionActiva } from "./vertical-server";
import VerticalSwitcherCondicional from "./vertical-switcher-condicional";

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
        {/* Sin max-width: el panel administrativo usa el navegador
            entero — pantallas anchas = más tabla a la vista. */}
        <div className="mx-auto flex w-full max-w-[2200px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-6 py-3.5 lg:px-10">
          <Link href="/admin" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- el
                logo oficial es un PNG estático: next/image no aporta
                nada acá. */}
            <img src="/logo-bookea-v4.png" alt="Bookear" className="h-6 w-auto shrink-0" />
            <span className="text-zinc-300">/</span>
            <span className="text-[12.5px] font-light text-aventurea-ink-soft">
              Panel Admin
            </span>
          </Link>
          {/* La navegación entre secciones vive en las cards de /admin;
              el logo trae de vuelta al inicio desde cualquier página. */}
          <form action={logout}>
            <button
              type="submit"
              className="rounded-xl border border-aventurea-line bg-white px-4 py-1.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
        <div className="border-t border-aventurea-line/60">
          <div className="mx-auto w-full max-w-[2200px] px-6 py-2 lg:px-10">
            <VerticalSwitcherCondicional actual={seccion} />
          </div>
        </div>
      </header>
      {/* Ancho completo hasta 2200px: sin techo, en un monitor 4K las
          tablas se estiraban con 300px de aire entre columnas y los
          párrafos quedaban en una sola línea de 2400px. */}
      <div className="mx-auto w-full max-w-[2200px] px-6 py-8 lg:px-10">{children}</div>
    </div>
  );
}
