import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { logout } from "./actions";
import { seccionActiva } from "./vertical-server";
import VerticalSwitcherCondicional from "./vertical-switcher-condicional";
import RailAdmin from "./rail-admin";
import { pendientesDeLaBarra } from "./pendientes";

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
 *
 * ── DE CABECERA A APLICACIÓN ───────────────────────────────────────
 * Antes esto era una cabecera y nada más: la navegación entre las
 * dieciséis secciones vivía en tarjetas dentro de la portada, así que
 * ir de Finanzas a Publicaciones era volver al inicio y buscar con la
 * vista. Ahora la barra lateral está siempre, en todas las pantallas.
 * Es el mismo cambio que ya se le hizo al panel de Lealtad.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ok, supabase } = await requireAdmin();
  if (!ok) redirect("/admin/login");

  // El correo va al pie de la barra. Sale del mismo cliente que ya
  // resolvió el permiso: es una lectura de la sesión, no una consulta.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const seccion = await seccionActiva();
  // Los badges de la barra. Va envuelto en `cache()`, así que la
  // portada vuelve a pedir lo mismo sin repetir las consultas.
  const pendientes = await pendientesDeLaBarra(seccion);

  const cabeceraRail = (
    <>
      <Link
        href="/admin"
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] p-2.5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- el logo
            oficial es un PNG estático: next/image no aporta nada acá. */}
        <img src="/logo-bookea-v4.png" alt="Bookea" className="h-5 w-auto shrink-0 brightness-0 invert" />
        <span className="text-[11.5px] font-semibold text-white/55">Panel Admin</span>
      </Link>
      {/* El conmutador va ARRIBA de la navegación porque le pone
          alcance a todo lo de abajo: los números de cada sección se
          leen dentro de la vertical elegida. Debajo de la lista, ese
          alcance quedaría escondido. */}
      <VerticalSwitcherCondicional actual={seccion} variante="rail" />
    </>
  );

  const marcaMovil = (
    <Link href="/admin" className="flex min-w-0 items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- ver arriba */}
      <img src="/logo-bookea-v4.png" alt="Bookea" className="h-5 w-auto shrink-0" />
      <span className="truncate text-[12px] font-light text-aventurea-ink-soft">
        Panel Admin
      </span>
    </Link>
  );

  const pieRail = (
    <div className="rounded-xl border border-white/10 bg-white/[0.07] p-2.5">
      {user?.email && (
        <p className="mb-1.5 truncate text-[11px] text-white/45">{user.email}</p>
      )}
      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-lg border border-white/15 px-3 py-1.5 text-[12.5px] font-bold text-white/80 transition-colors hover:border-white/40 hover:text-white"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );

  return (
    // El lienzo pasa a `cream-2` (gris muy claro): las tarjetas del
    // tablero son blancas, y blanco sobre blanco no se ve.
    <div className="min-h-svh bg-aventurea-cream-2 lg:grid lg:grid-cols-[252px_minmax(0,1fr)] xl:grid-cols-[276px_minmax(0,1fr)]">
      {/* En teléfono, `RailAdmin` dibuja además la franja de arriba con
          el botón del cajón: el botón y el cajón comparten estado, así
          que tienen que vivir en el mismo componente. */}
      <RailAdmin
        cabecera={cabeceraRail}
        pie={pieRail}
        marcaMovil={marcaMovil}
        pendientes={pendientes}
      />

      {/* Ancho completo hasta 1560px. El panel administrativo usa el
          navegador entero, pero sin techo, en un monitor 4K los
          párrafos quedaban en una sola línea de 2400px. */}
      <div className="mx-auto w-full min-w-0 max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </div>
    </div>
  );
}
