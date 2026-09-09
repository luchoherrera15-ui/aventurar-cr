import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { negocioPorId } from "@/lib/solutions/datos";
import { addonsDelNegocio } from "@/lib/solutions/addons";
import { escaneresDeLaCuenta } from "@/lib/solutions/lealtad-puente";
import { Card } from "@/components/panel/piezas";
import { BAJADA_PANTALLA, BOTON_PANEL_PRIMARIO } from "@/components/panel/sistema";
import { armarPanelLealtad } from "@/app/lealtad/panel/[id]/armado";
import MarcoLinksy from "../marco-linksy";
import { navDelPanel } from "../nav-datos";
import SeccionesLealtad from "./secciones-lealtad";

export const metadata: Metadata = { title: "Lealtad · Linksy" };

/**
 * /solutions/panel/[id]/lealtad — TODO LEALTAD, DENTRO DEL PANEL DE LINKSY.
 *
 * Pedido del dueño (7 sep 2026): «todas las funciones de Lealtad,
 * absolutamente todo, en este menú». Antes esta pantalla era un resumen
 * (escáner, cifras, listos, estadísticas) con un botón «Abrir el panel
 * completo». Ahora monta el panel de Lealtad ENTERO —mostrador,
 * dashboard, tarjetas, mi página, clientes, estadísticas, marketing,
 * configuración, póster y plan— con el marco de Linksy en vez del rail
 * navy. Es el MISMO armado (`armarPanelLealtad`) que usa
 * /lealtad/panel/[id]: mismos datos, mismos permisos, mismas secciones.
 *
 * Solo el dueño: el programa de Lealtad es del rancho, y quien tiene
 * acceso allá es el dueño de la cuenta. Con varios negocios de Lealtad,
 * `?tarjeta=<ranchoId>` elige cuál se administra.
 */
export default async function LealtadSolutionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const busqueda = await searchParams;
  const acceso = await verificarAccesoSolutions(id);
  if (!acceso.user) redirect("/cuenta?volver=solutions");
  if (!acceso.ok) redirect("/solutions/panel");
  if (!acceso.esDueno) redirect(`/solutions/panel/${id}`);

  const admin = createAdminClient();
  if (!admin) notFound();
  const negocio = await negocioPorId(admin, id);
  if (!negocio) notFound();

  const [addons, escaneres, marco] = await Promise.all([addonsDelNegocio(admin, id), escaneresDeLaCuenta(admin, negocio.owner_id), navDelPanel(admin, negocio, acceso)]);
  const volver = `/solutions/panel/${id}`;

  // ── SIN TARJETA TODAVÍA ─────────────────────────────────────────
  if (escaneres.length === 0) {
    return (
      <MarcoLinksy negocio={marco.barra} items={marco.items} activo="lealtad" titulo="Lealtad" bajada="Tu tarjeta de sellos o puntos en el teléfono de tus clientes.">
        <Card eyebrow="Tu tarjeta de lealtad" titulo={addons.lealtad ? "Todavía no tenés una tarjeta" : "Sumá el add-on de Lealtad"}>
          <p className={BAJADA_PANTALLA}>
            {addons.lealtad
              ? "Armá tu tarjeta en Bookea Lealtad con esta misma cuenta y acá aparece tu programa completo: mostrador, clientes, marketing y plan."
              : "El add-on de Lealtad se prende desde Inicio. Es gratis mientras dure la prueba, y con él armás tu tarjeta en un par de minutos."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {addons.lealtad ? (
              <Link href="/lealtad/crear" className={BOTON_PANEL_PRIMARIO}>
                Armar mi tarjeta →
              </Link>
            ) : (
              <Link href={`${volver}?tab=inicio`} className={BOTON_PANEL_PRIMARIO}>
                Ir a Inicio →
              </Link>
            )}
          </div>
        </Card>
      </MarcoLinksy>
    );
  }

  // ── EL NEGOCIO DE LEALTAD QUE SE ADMINISTRA ─────────────────────
  const pedida = typeof busqueda.tarjeta === "string" ? busqueda.tarjeta : null;
  const op = escaneres.find((e) => e.ranchoId === pedida) ?? escaneres[0];

  // Sin «Mi página» de Lealtad: Linksy ya tiene la suya (dueño, 7 sep 2026).
  const r = await armarPanelLealtad({ params: Promise.resolve({ id: op.ranchoId }), searchParams: Promise.resolve({}), ocultar: ["mi-pagina"] });
  if (r.tipo === "redirect") redirect(r.destino);
  // En revisión o sin el complemento: la antesala de Lealtad, tal cual.
  if (r.tipo === "pantalla") return r.nodo;

  return (
    <MarcoLinksy
      negocio={marco.barra}
      items={marco.items}
      activo="lealtad"
      titulo={`Lealtad · ${op.negocio}`}
      bajada={`${r.negocio.plan ?? "Tu programa de lealtad"} · mostrador, tarjetas, clientes, marketing, configuración y plan, todo acá.`}
    >
      {/* Varias tarjetas en la cuenta: un selector de píldoras. */}
      {escaneres.length > 1 && (
        <nav aria-label="Qué negocio de Lealtad administrar" className="mb-4 flex flex-wrap gap-1.5">
          {escaneres.map((e) => {
            const activa = e.ranchoId === op.ranchoId;
            return (
              <Link
                key={e.ranchoId}
                href={`${volver}/lealtad?tarjeta=${e.ranchoId}`}
                aria-current={activa ? "page" : undefined}
                className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 text-[12.5px] font-bold ${activa ? "border-aventurea-navy bg-aventurea-navy text-white" : "border-aventurea-line bg-white text-aventurea-navy"}`}
              >
                {e.negocio} · {e.tarjeta}
              </Link>
            );
          })}
        </nav>
      )}
      {r.envolver(<SeccionesLealtad grupos={r.grupos} contenidos={r.contenidos} />)}
    </MarcoLinksy>
  );
}
