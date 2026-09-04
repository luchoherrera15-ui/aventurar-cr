import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import {
  IconChair,
  IconClipboard,
  IconHome,
  IconCloche,
  IconEnlace,
  IconTagLine,
  IconUsers,
} from "@/components/icons";
import PanelSidebar, { type Tab } from "@/app/mi-negocio/[id]/panel-sidebar";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
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
import SeccionInicio from "./seccion-inicio";
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

  // Las comandas de HOY, en hora de Costa Rica — el tablero las muestra
  // como el único número «de hoy» que existe de verdad.
  //
  // `hoyISOCR` del repo y no un cálculo a mano: restarle 6 horas al UTC
  // acierta casi siempre y falla en el borde de la medianoche, que es
  // justo cuando el número importa (cerrando la caja del día).
  const hoyCR = hoyISOCR();
  const comandasHoy = pedidos.filter((p) => p.creado_en.slice(0, 10) === hoyCR).length;

  // ¿Este dueño ya tiene tarjeta en Bookea Lealtad? Es lo que decide si
  // el tablero ofrece sumarla o la da por puesta. Consulta chica y
  // tolerante: si algo falla, se asume que no y se ofrece.
  let tieneLealtad = false;
  {
    const { data: susRanchos } = await admin
      .from("ranchos")
      .select("id")
      .eq("owner_id", negocio.owner_id)
      .limit(20);
    const ids = (susRanchos ?? []).map((r) => r.id as string);
    if (ids.length > 0) {
      const { count } = await admin
        .from("programa_lealtad")
        .select("id", { count: "exact", head: true })
        .in("rancho_id", ids);
      tieneLealtad = (count ?? 0) > 0;
    }
  }
  const urlPublica = urlPublicaSolutions(negocio.slug);
  const recienCreado = busqueda.nuevo === "1";

  const tabs: Tab[] = [
    {
      id: "inicio",
      label: "Inicio",
      icon: <IconHome />,
      content: (
        <SeccionInicio
          negocio={negocio}
          urlPublica={urlPublica}
          totalLinks={links.filter((l) => l.visible).length}
          totalPlatos={menu.items.length}
          totalSecciones={menu.secciones.length}
          comandasHoy={comandasHoy}
          tieneLealtad={tieneLealtad}
        />
      ),
    },
    {
      id: "comandas",
      label: "Comandas",
      icon: <IconClipboard />,
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
        icon: <IconTagLine />,
        content: (
          <SeccionPagina
            negocio={negocio}
            links={links.filter((l) => l.visible)}
            seccionesMenu={menu.agrupado.map((g) => g.seccion?.nombre ?? "Otros")}
            hayMenu={menu.items.length > 0}
            urlPublica={urlPublica}
            recienCreado={recienCreado}
          />
        ),
      },
      {
        id: "links",
        label: "Enlaces",
        icon: <IconEnlace />,
        content: <SeccionLinks negocioId={id} links={links} />,
      },
      {
        id: "menu",
        label: "La carta",
        icon: <IconCloche />,
        badge: menu.items.length,
        content: <SeccionMenu negocioId={id} menu={menu} />,
      },
      {
        id: "mesas",
        label: "QR de mesas",
        icon: <IconChair />,
        href: `/solutions/panel/${id}/mesas`,
      },
      {
        id: "equipo",
        label: "Equipo",
        icon: <IconUsers />,
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
    /* Las seis caras se declaran acá arriba para que la VISTA PREVIA
       pueda cambiar de tipografía sin recargar: `next/font` resuelve en
       el build, así que la variable tiene que existir antes de que el
       negocio elija cuál usar. */
    <main className={`min-h-svh bg-[#f7f9fc] ${CLASES_FUENTES}`}>
      <PanelSidebar tabs={tabs} defaultTab={recienCreado ? "pagina" : vivas > 0 ? "comandas" : "inicio"} identidad={identidad} encabezado={encabezado} />
    </main>
  );
}
