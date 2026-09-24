import type { Metadata } from "next";
import { esPro } from "@/lib/solutions/planes";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { addonsDelNegocio } from "@/lib/solutions/addons";
import { escaneresDeLaCuenta } from "@/lib/solutions/lealtad-puente";
import { colaboradoresDelNegocio, linksDelNegocio, menuDelNegocio, negocioPorId, pedidosDelNegocio } from "@/lib/solutions/datos";
import { urlDelNegocio } from "@/lib/solutions/tipos";
import { esDeComida, vocabDe } from "@/lib/solutions/rubros";
import { configMeta } from "@/lib/instagram/config";
import { cuentaDelNegocio } from "@/lib/instagram/cuentas";
import { automatizacionesDelNegocio } from "@/lib/instagram/datos";
import { cargarLealtad } from "@/app/lealtad/panel/[id]/datos-lealtad";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { definicionDe } from "@/lib/lealtad/planes";
import { estadoDelPerfil } from "@/lib/solutions/perfil";
import CompletarPerfil from "../completar-perfil";
import SeccionInicio, { type ResumenInstagram, type ResumenLealtad } from "./seccion-inicio";
import SeccionPagina from "./seccion-pagina";
import SeccionMenu from "./seccion-menu";
import SeccionEquipo from "./seccion-equipo";
import PanelLinksy, { type PestanaLinksy } from "./panel-linksy";
import { itemsNavLinksy } from "./nav-linksy";

export const metadata: Metadata = { title: "Panel · Bookea" };

/**
 * /solutions/panel/<id> — EL PANEL DE UN NEGOCIO DE LINKSY.
 *
 * Rediseñado el 7 sep 2026 con la línea de la landing (pedido del
 * dueño: «figuras grandes, textos grandes, que al entrar vea sus
 * add-ons, su plan y cuánto paga»). El chrome es `PanelLinksy` (barra
 * arriba, secciones a la izquierda); la lista de secciones sale de
 * `itemsNavLinksy`, la MISMA que usan las páginas propias (Ventas,
 * Lealtad, Instagram) para que el menú sea uno solo.
 *
 * El rol manda: `equipo` (un mesero) ve pedidos y puede marcar
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
  const vocab = vocabDe(negocio.rubro);
  const comida = esDeComida(negocio.rubro);
  // Las comandas de HOY en hora de Costa Rica (`hoyISOCR`, no una resta
  // de 6 horas: esa falla justo a medianoche, cuando se cierra la caja).
  const hoyCR = hoyISOCR();
  const comandasHoy = pedidos.filter((p) => p.creado_en.slice(0, 10) === hoyCR).length;

  // ¿Este dueño ya tiene tarjeta en Bookea Lealtad? Decide si el tablero
  // ofrece sumarla o la da por puesta. Tolerante: si algo falla, se ofrece.
  let tieneLealtad = false;
  {
    const { data: susRanchos } = await admin.from("ranchos").select("id").eq("owner_id", negocio.owner_id).limit(20);
    const ids = (susRanchos ?? []).map((r) => r.id as string);
    if (ids.length > 0) {
      const { count } = await admin.from("programa_lealtad").select("id", { count: "exact", head: true }).in("rancho_id", ids);
      tieneLealtad = (count ?? 0) > 0;
    }
  }
  const urlPublica = urlDelNegocio(negocio);
  const recienCreado = busqueda.nuevo === "1";

  // Las tarjetas de Lealtad de la cuenta: solo el dueño tiene acceso allá.
  const escaneres = acceso.esDueno && (addons.lealtad || tieneLealtad) ? await escaneresDeLaCuenta(admin, negocio.owner_id) : [];

  // ── LOS RESÚMENES DE INICIO: Instagram y Lealtad en una línea ─────
  const cfgMeta = configMeta();
  const [cuentaIg, autosIg] = acceso.puedeEditar && cfgMeta ? await Promise.all([cuentaDelNegocio(admin, id), automatizacionesDelNegocio(admin, id)]) : [null, []];
  const instagram: ResumenInstagram = {
    configurado: !!cfgMeta,
    conectado: !!cuentaIg && cuentaIg.activa && cuentaIg.estado !== "desconectada",
    usuario: cuentaIg?.username ?? null,
    automatizaciones: autosIg.filter((a) => a.activa).length,
  };

  let lealtad: ResumenLealtad = { tarjetas: escaneres.length, clientes: null, listos: null, plan: null, precioMes: null };
  if (escaneres.length > 0) {
    // La tarjeta principal del primer negocio de Lealtad: el mismo criterio
    // que la pestaña Lealtad. `cargarLealtad` está en cache() por request.
    const op = escaneres[0];
    const [datos, ctx] = await Promise.all([
      cargarLealtad(op.programaId, op.recompensa?.costo ?? null),
      contextoDeCuenta(admin, { cuenta_id: op.cuentaId }, { planRancho: op.planRancho }),
    ]);
    const def = definicionDe(ctx.plan);
    lealtad = {
      tarjetas: escaneres.length,
      clientes: datos?.resumen.miembros ?? null,
      listos: datos?.resumen.listosParaCanjear ?? null,
      plan: def?.nombre ?? ctx.plan,
      precioMes: def?.precioMensual ?? null,
    };
  }

  // ── EL MENÚ Y LAS PESTAÑAS ────────────────────────────────────────
  const nav = itemsNavLinksy({
    id,
    vocab,
    addons,
    comida,
    aceptaPedidos: negocio.acepta_pedidos,
    esDueno: acceso.esDueno,
    puedeEditar: acceso.puedeEditar,
    tieneLealtad,
    escaneres: escaneres.length,
    vivas,
    totalMenu: menu.items.length,
    equipo: equipo.length,
    plan: negocio.plan,
  });

  const contenido: Record<string, Partial<PestanaLinksy>> = {
    inicio: {
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
          esDueno={acceso.esDueno}
          instagram={instagram}
          lealtad={lealtad}
        />
      ),
    },
    // Enlaces, Diseño y Ajustes: tres pestañas, un solo editor (ver
    // `contenidoDe` en panel-linksy.tsx). «?tab=pagina» era la vieja.
    enlaces: { alias: ["links"], titulo: "Enlaces", bajada: "Tus botones, íconos de red, títulos y textos, en el orden que quieras.", contenidoDe: "diseno" },
    ajustes: { titulo: "Ajustes", bajada: "Tu dirección, tu contacto, la publicación y cómo vendés.", contenidoDe: "diseno" },
    diseno: {
      alias: ["pagina"],
      titulo: "Diseño",
      bajada: "Tema, encabezado y efectos. Lo que tocás se ve al lado, en tu página de verdad.",
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
    menu: addons.menu
      ? {
          titulo: vocab.catalogoLargo,
          bajada: vocab.cargarDetalle,
          content: <SeccionMenu negocioId={id} menu={menu} idiomas={negocio.idiomas_menu} moneda={negocio.moneda} rubro={negocio.rubro} ajustesMenu={negocio.diseno.menuAjustes} slug={negocio.slug} pro={esPro(negocio.plan)} hrefPro={`/solutions/panel/${id}/plan`} />,
        }
      : {},
    equipo: {
      titulo: "Equipo",
      bajada: "Quién entra a este panel y qué puede hacer.",
      content: <SeccionEquipo negocioId={id} colaboradores={equipo} esDueno={acceso.esDueno} />,
    },
  };
  const tabs: PestanaLinksy[] = nav.map((n) => ({ ...n, ...(contenido[n.id] ?? {}) }));

  return (
    /* `linksy` trae la paleta; `linksy-panel` remapea el sistema navy
       heredado (ver globals.css). Las seis caras se declaran acá para
       que la VISTA PREVIA del editor cambie de tipografía sin recargar. */
    <main className={`linksy linksy-panel min-h-svh bg-[var(--linksy-fondo-panel)] text-[var(--linksy-tinta)] ${CLASES_FUENTES}`}>
      <PanelLinksy
        tabs={tabs}
        defaultTab="inicio"
        negocio={{ id, nombre: negocio.nombre, logoUrl: negocio.logo_url, colorAcento: negocio.color_acento, publicado: negocio.publicado, urlPublica }}
      />
    </main>
  );
}
