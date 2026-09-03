import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PanelSidebar, { type Tab } from "@/app/mi-negocio/[id]/panel-sidebar";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import {
  colaboradoresDelNegocio,
  linksDelNegocio,
  menuDelNegocio,
  negocioPorId,
  pedidosDelNegocio,
} from "@/lib/solutions/datos";
import { urlPublicaSolutions } from "@/lib/solutions/tipos";
import SeccionComandas from "./seccion-comandas";
import SeccionPagina from "./seccion-pagina";
import SeccionLinks from "./seccion-links";
import SeccionMenu from "./seccion-menu";
import SeccionEquipo from "./seccion-equipo";

export const metadata: Metadata = { title: "Panel · Bookea Solutions" };

/**
 * /solutions/panel/<id> — EL PANEL DE UN NEGOCIO DE SOLUTIONS.
 *
 * Reusa el `PanelSidebar` de mi-negocio (el rail navy con pestañas por
 * `?tab=`) porque es el chrome de panel de toda Bookea — no un
 * componente de ranchos: recibe `tabs` y nada más. Lo que va ADENTRO
 * de cada pestaña es 100 % de Solutions.
 *
 * El orden del rail sigue lo que se investigó para los CRM del rubro
 * (2 sep 2026): el trabajo del día primero. Para un restaurante eso
 * son las COMANDAS, así que es la pestaña de aterrizaje; la página, los
 * links, la carta, las mesas y el equipo van después, en el orden en
 * que se configuran una vez y se tocan poco.
 *
 * El rol manda: `equipo` (un mesero) ve comandas y puede marcar
 * «agotado hoy»; todo lo demás es de `admin`/dueño y no se le lista.
 */
export default async function PanelSolutionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const busqueda = await searchParams;
  const acceso = await verificarAccesoSolutions(id);
  if (!acceso.user) redirect(`/cuenta?volver=solutions`);
  if (!acceso.ok) redirect("/solutions/panel");

  const admin = createAdminClient();
  if (!admin) notFound();
  const negocio = await negocioPorId(admin, id);
  if (!negocio) notFound();

  const [links, menu, pedidos, equipo] = await Promise.all([
    linksDelNegocio(admin, id),
    menuDelNegocio(admin, id),
    pedidosDelNegocio(admin, id, { limite: 80 }),
    acceso.puedeEditar ? colaboradoresDelNegocio(admin, id) : Promise.resolve([]),
  ]);

  const vivas = pedidos.filter((p) => p.estado === "nuevo" || p.estado === "preparando" || p.estado === "listo").length;
  const urlPublica = urlPublicaSolutions(negocio.slug);
  const recienCreado = busqueda.nuevo === "1";

  const tabs: Tab[] = [
    {
      id: "comandas",
      label: "Comandas",
      icon: <span aria-hidden>🧾</span>,
      badge: vivas,
      content: (
        <SeccionComandas
          negocioId={id}
          pedidos={pedidos}
          aceptaPedidos={negocio.acepta_pedidos}
          mesas={negocio.mesas}
          puedeEditar={acceso.puedeEditar}
          items={menu.items}
        />
      ),
    },
  ];

  if (acceso.puedeEditar) {
    tabs.push(
      {
        id: "pagina",
        label: "Mi página",
        icon: <span aria-hidden>🏷</span>,
        content: <SeccionPagina negocio={negocio} urlPublica={urlPublica} recienCreado={recienCreado} />,
      },
      {
        id: "links",
        label: "Enlaces",
        icon: <span aria-hidden>🔗</span>,
        content: <SeccionLinks negocioId={id} links={links} />,
      },
      {
        id: "menu",
        label: "La carta",
        icon: <span aria-hidden>🍽</span>,
        badge: menu.items.length,
        content: <SeccionMenu negocioId={id} menu={menu} />,
      },
      {
        id: "mesas",
        label: "QR de mesas",
        icon: <span aria-hidden>🪑</span>,
        href: `/solutions/panel/${id}/mesas`,
      },
      {
        id: "equipo",
        label: "Equipo",
        icon: <span aria-hidden>👥</span>,
        badge: equipo.length,
        content: <SeccionEquipo negocioId={id} colaboradores={equipo} esDueno={acceso.esDueno} />,
      },
    );
  }

  const identidad = (
    <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4 text-white">
      <div className="flex items-center gap-3">
        {negocio.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={negocio.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[18px] font-extrabold"
            style={{ background: negocio.color_acento, color: "#10192e" }}
          >
            {negocio.nombre.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold leading-tight">{negocio.nombre}</p>
          <p className="mt-0.5 text-[11.5px] text-aventurea-rail">
            {negocio.publicado ? "● Publicado" : "○ Apagado"} · Solutions
          </p>
        </div>
      </div>
      <a
        href={urlPublica}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block truncate text-[12px] font-bold text-aventurea-rail underline-offset-2 hover:underline"
      >
        {urlPublica.replace(/^https?:\/\//, "")} →
      </a>
    </div>
  );

  const encabezado = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link href="/solutions/panel" className="text-[12px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink">
          ← Mis negocios
        </Link>
        <h1 className="titulo mt-1 text-[clamp(22px,3vw,30px)] text-aventurea-navy">{negocio.nombre}</h1>
      </div>
      <a
        href={urlPublica}
        target="_blank"
        rel="noopener noreferrer"
        className="presionable inline-flex min-h-[40px] items-center rounded-xl border border-aventurea-line bg-white px-4 text-[13px] font-bold text-aventurea-navy"
      >
        Ver como cliente →
      </a>
    </div>
  );

  return (
    <main className="min-h-svh bg-[#f7f9fc]">
      <PanelSidebar tabs={tabs} defaultTab={recienCreado ? "pagina" : "comandas"} identidad={identidad} encabezado={encabezado} />
    </main>
  );
}
