import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import {
  IconCamera,
  IconChair,
  IconClipboard,
  IconHome,
  IconCloche,
  IconTagLine,
  IconUsers,
} from "@/components/icons";
import { Card } from "@/components/panel/piezas";
import { BOTON_PANEL_PRIMARIO } from "@/components/panel/sistema";
import PanelSidebar, { type Tab } from "@/app/mi-negocio/[id]/panel-sidebar";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { addonsDelNegocio } from "@/lib/solutions/addons";
import { escaneresDeLaCuenta } from "@/lib/solutions/lealtad-puente";
import {
  colaboradoresDelNegocio,
  linksDelNegocio,
  menuDelNegocio,
  negocioPorId,
  pedidosDelNegocio,
} from "@/lib/solutions/datos";
import { urlDelNegocio } from "@/lib/solutions/tipos";
import SeccionInicio from "./seccion-inicio";
import SeccionPagina from "./seccion-pagina";
import SeccionMenu from "./seccion-menu";
import SeccionEquipo from "./seccion-equipo";
import EscanerSolutions from "./escaner-solutions";
import CompletarPerfil from "../completar-perfil";
import { estadoDelPerfil } from "@/lib/solutions/perfil";

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

  // EL PRIMER INGRESO (dueño, 5 sep 2026): sin nombre y teléfono no hay
  // panel. Solo para el dueño: un admin de Bookea que entra a configurar
  // el negocio de un cliente no tiene que llenar los datos del cliente.
  if (acceso.esDueno) {
    const perfil = await estadoDelPerfil(acceso.user);
    if (perfil.falta && !perfil.esAdmin) {
      return <CompletarPerfil correo={acceso.user.email ?? ""} nombreInicial={perfil.nombre} negocio={negocio.nombre} />;
    }
  }

  const [links, menu, pedidos, equipo, addons] = await Promise.all([
    linksDelNegocio(admin, id),
    menuDelNegocio(admin, id),
    pedidosDelNegocio(admin, id, { limite: 80 }),
    acceso.puedeEditar ? colaboradoresDelNegocio(admin, id) : Promise.resolve([]),
    addonsDelNegocio(admin, id),
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
  // El dominio propio, si ya está activo; si no, bookea.lat/s/<slug> (0234).
  const urlPublica = urlDelNegocio(negocio);
  const recienCreado = busqueda.nuevo === "1";

  // El escáner de pases (5 sep 2026): solo para el dueño, que es quien
  // tiene acceso en Lealtad. Un colaborador de Solutions no es equipo
  // del rancho y el servidor le diría que no al escanear.
  const escaneres =
    acceso.esDueno && (addons.lealtad || tieneLealtad) ? await escaneresDeLaCuenta(admin, negocio.owner_id) : [];

  // ── EL RAIL SE ARMA CON LOS ADD-ONS (0233) ─────────────────────────
  // Lo que el negocio no tiene prendido no aparece: ni «Comandas» sin
  // el add-on de pedidos ni «Menú digital» sin el de menú. Se agregan
  // desde Inicio, que es la única pestaña que siempre está.
  const tabs: Tab[] = [
    {
      id: "inicio",
      label: "Inicio",
      descripcion: "Tu tablero y tus add-ons",
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
          addons={addons}
          puedeEditar={acceso.puedeEditar}
          escaneres={escaneres}
        />
      ),
    },
  ];

  /** Una sección que es un add-on apagado: se ve, pero lleva a Inicio. */
  // «Sumalo en Inicio» y no «Agregalo desde Inicio»: al lado de la
  // etiqueta ADD-ON, en la columna de 252 px, la frase larga se cortaba
  // en «Agregalo desde…» y dejaba de decir a dónde.
  const bloqueada = { etiqueta: "Add-on", pie: "Sumalo en Inicio", destino: "inicio" };

  // MODO RESTAURANTE (dueño, 5 sep 2026): las comandas dejan de ser
  // una pestaña y pasan a su pantalla de operación, con las de mesa,
  // To go y exprés. Es un `href`: se abre entera, sin el rail.
  if (addons.pedidos) {
    tabs.push({
      id: "restaurante",
      label: "Modo restaurante",
      descripcion: "Comandas en vivo: mesa, To go y exprés",
      icon: <IconClipboard />,
      badge: vivas,
      href: `/solutions/panel/${id}/restaurante`,
    });
  } else {
    tabs.push({ id: "restaurante", label: "Modo restaurante", icon: <IconClipboard />, bloqueado: bloqueada });
  }

  // EL ESCÁNER DE PASES (dueño, 5 sep 2026): el mismo de Lealtad,
  // montado acá. Solo el dueño (ver `escaneres` arriba).
  if (acceso.esDueno) {
    if (escaneres.length > 0) {
      tabs.push({
        id: "escanear",
        label: "Escanear pases",
        descripcion: "Sumá sellos o puntos al cliente",
        icon: <IconCamera />,
        content: (
          <Card eyebrow="Tu tarjeta de lealtad" titulo="Escanear el pase de un cliente">
            <p className="mb-3 text-[12.5px] leading-snug text-aventurea-ink-soft">
              Apuntá la cámara al QR del pase y se le suma el sello o los puntos. Es el mismo
              escáner de tu panel de Lealtad.
            </p>
            <EscanerSolutions opciones={escaneres} abierto />
          </Card>
        ),
      });
    } else if (addons.lealtad || tieneLealtad) {
      tabs.push({
        id: "escanear",
        label: "Escanear pases",
        descripcion: "Primero armá tu tarjeta",
        icon: <IconCamera />,
        content: (
          <Card eyebrow="Tu tarjeta de lealtad" titulo="Todavía no tenés una tarjeta que escanear">
            <p className="text-[13px] leading-snug text-aventurea-ink-soft">
              El escáner suma sellos o puntos a un pase. Armá tu tarjeta en Bookea Lealtad con esta
              misma cuenta y acá aparece la cámara.
            </p>
            <Link href="/lealtad/crear" className={`mt-3 inline-flex ${BOTON_PANEL_PRIMARIO}`}>
              Armar mi tarjeta →
            </Link>
          </Card>
        ),
      });
    } else {
      tabs.push({ id: "escanear", label: "Escanear pases", icon: <IconCamera />, bloqueado: bloqueada });
    }
  }

  if (acceso.puedeEditar) {
    tabs.push(
      {
        id: "pagina",
        label: "Mi página",
        descripcion: "Diseño, enlaces y contacto",
        icon: <IconTagLine />,
        // «?tab=links» era la pestaña de Enlaces; ahora viven acá.
        alias: ["links"],
        content: (
          <SeccionPagina
            negocio={negocio}
            links={links}
            seccionesMenu={menu.agrupado.map((g) => g.seccion?.nombre ?? "Otros")}
            hayMenu={menu.items.length > 0}
            urlPublica={urlPublica}
            recienCreado={recienCreado}
            addons={addons}
            esDueno={acceso.esDueno}
          />
        ),
      },
    );
    if (addons.menu) {
      tabs.push({
        id: "menu",
        label: "Menú digital",
        descripcion: "Secciones, platos y precios",
        icon: <IconCloche />,
        badge: menu.items.length,
        content: <SeccionMenu negocioId={id} menu={menu} idiomas={negocio.idiomas_menu} />,
      });
    } else {
      tabs.push({ id: "menu", label: "Menú digital", icon: <IconCloche />, bloqueado: bloqueada });
    }
    if (addons.pedidos && negocio.acepta_pedidos) {
      tabs.push({
        id: "mesas",
        label: "QR de mesas",
        descripcion: "La hoja para imprimir",
        icon: <IconChair />,
        href: `/solutions/panel/${id}/mesas`,
      });
    } else if (!addons.pedidos) {
      tabs.push({ id: "mesas", label: "QR de mesas", icon: <IconChair />, bloqueado: bloqueada });
    }
    tabs.push({
      id: "equipo",
      label: "Equipo",
      descripcion: "Quién entra a este panel",
      icon: <IconUsers />,
      badge: equipo.length,
      content: <SeccionEquipo negocioId={id} colaboradores={equipo} esDueno={acceso.esDueno} />,
    });
  }

  /* La cabecera del rail (sep 2026, «cards más grandes»): logo de 56,
     nombre a 16px, el estado como píldora blanca y el enlace público
     como BOTÓN de 44px — antes era un texto chico subrayado que nadie
     encontraba. Es la única acción del rail que abre otra pestaña. */
  const identidad = (
    <div className="p-1.5 text-white">
      <div className="flex items-center gap-3.5">
        {negocio.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={negocio.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[22px] font-extrabold"
            style={{ background: negocio.color_acento, color: "#10192e" }}
          >
            {negocio.nombre.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[16px] font-extrabold leading-tight">{negocio.nombre}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-0.5 text-[11px] font-extrabold text-aventurea-navy">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${negocio.publicado ? "bg-green-600" : "bg-aventurea-ink-soft"}`}
            />
            {negocio.publicado ? "Publicada" : "Apagada"}
          </p>
        </div>
      </div>
      <a
        href={urlPublica}
        target="_blank"
        rel="noopener noreferrer"
        className="presionable mt-3.5 flex min-h-[44px] items-center justify-between gap-2 rounded-xl bg-white px-3.5 text-[13px] font-extrabold text-aventurea-navy"
      >
        <span className="truncate">{urlPublica.replace(/^https?:\/\//, "")}</span>
        <span aria-hidden className="shrink-0">
          →
        </span>
      </a>
    </div>
  );

  /* El pie del rail: un solo atajo, y solo mientras haya algo que
     agregar. Cuando el negocio tiene todo prendido, desaparece. */
  const faltanAddons = !addons.menu || !addons.pedidos || !addons.lealtad;
  const pie =
    acceso.puedeEditar && faltanAddons ? (
      <Link
        href={`/solutions/panel/${id}?tab=inicio`}
        className="presionable flex min-h-[52px] items-center gap-3 rounded-2xl border border-dashed border-white/25 px-3.5 text-[13.5px] font-extrabold text-white hover:bg-aventurea-navy-3"
      >
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aventurea-navy-3 text-[18px] leading-none">
          +
        </span>
        <span>
          Agregar add-ons
          <span className="block text-[11.5px] font-medium text-aventurea-rail">Menú, pedidos, lealtad</span>
        </span>
      </Link>
    ) : undefined;

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
      <PanelSidebar
        tabs={tabs}
        defaultTab={!recienCreado && addons.pedidos && vivas > 0 ? "comandas" : "inicio"}
        identidad={identidad}
        encabezado={encabezado}
        pie={pie}
      />
    </main>
  );
}
