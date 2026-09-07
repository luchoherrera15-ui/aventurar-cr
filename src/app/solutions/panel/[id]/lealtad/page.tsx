import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { negocioPorId } from "@/lib/solutions/datos";
import { addonsDelNegocio } from "@/lib/solutions/addons";
import { escaneresDeLaCuenta } from "@/lib/solutions/lealtad-puente";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { Card, CardVacia, Metrica } from "@/components/panel/piezas";
import {
  BAJADA_PANTALLA,
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  GRILLA_METRICAS,
  LIENZO_PANEL,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { definicionDe, PLANES, PLANES_OFRECIDOS, puede } from "@/lib/lealtad/planes";
import { textosDelTipo } from "@/lib/lealtad/mostrador";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { cargarLealtad } from "@/app/lealtad/panel/[id]/datos-lealtad";
import { cargarClientesAuditados } from "@/app/lealtad/panel/[id]/clientes-datos";
import { cargarEstadisticas } from "@/app/lealtad/panel/[id]/estadisticas-datos";
import EstadisticasLealtad from "@/app/lealtad/panel/[id]/estadisticas-lealtad";
import ListosRecompensa from "@/app/lealtad/panel/[id]/listos-recompensa";
import ImpactoComercial from "@/app/lealtad/panel/[id]/impacto-comercial";
import TabsContenido from "@/app/lealtad/panel/[id]/tabs-contenido";
import EscanerSolutions from "../escaner-solutions";

export const metadata: Metadata = { title: "Lealtad · Linksy" };

/**
 * /solutions/panel/[id]/lealtad — LOS PASES DE LEALTAD, EN SU PROPIA PANTALLA.
 *
 * Pedido del dueño (7 sep 2026): «quitá el escáner de Inicio; los pases
 * de lealtad tienen que ser un botón a la izquierda dedicado a eso, y
 * que ahí también se puedan ver estadísticas y demás».
 *
 * ── QUÉ HAY ACÁ Y DE DÓNDE SALE ─────────────────────────────────────
 * Nada de esto es nuevo: es el panel de Lealtad, montado adentro del de
 * Linksy para que la caja no cambie de producto.
 *   · El escáner: `EscanerSolutions` (el `EscanerPanel` de Lealtad).
 *   · Las cifras: `cargarLealtad` (el ledger, UNA lectura por visita).
 *   · «Listos para su recompensa»: el cuadro del tablero de Lealtad,
 *     con la MISMA acción de entregar (`canjearRecompensa`).
 *   · Estadísticas: el programa de estadísticas de Lealtad entero
 *     (`estadisticas-lealtad.tsx`), con sus filtros, tablas y CSV.
 *   · Ventas: `ImpactoComercial`.
 * Lo que no cabe acá (diseñar la tarjeta, el equipo, las campañas) va
 * por «Abrir el panel completo», que es el de Lealtad de siempre.
 *
 * ── SOLO EL DUEÑO ───────────────────────────────────────────────────
 * Igual que la pestaña: el escáner y el ledger son del rancho de
 * Lealtad, y quien tiene acceso ahí es el dueño de la cuenta. Un
 * colaborador de Linksy no es equipo del rancho.
 *
 * ── VARIAS TARJETAS ─────────────────────────────────────────────────
 * Una cuenta puede tener más de un negocio con tarjeta; `?tarjeta=`
 * (el id del rancho) elige cuál se mira, validado contra la lista real.
 * El escáner que se monta es SOLO el de la tarjeta elegida, para que la
 * pantalla entera hable de una sola tarjeta a la vez.
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

  const [addons, escaneres] = await Promise.all([addonsDelNegocio(admin, id), escaneresDeLaCuenta(admin, negocio.owner_id)]);
  const volver = `/solutions/panel/${id}`;

  // ── SIN TARJETA TODAVÍA ─────────────────────────────────────────
  if (escaneres.length === 0) {
    return (
      <Lienzo volver={volver} titulo="Lealtad" bajada="Tu tarjeta de sellos o puntos en el teléfono de tus clientes.">
        <Card eyebrow="Tu tarjeta de lealtad" titulo={addons.lealtad ? "Todavía no tenés una tarjeta" : "Sumá el add-on de Lealtad"}>
          <p className={BAJADA_PANTALLA}>
            {addons.lealtad
              ? "Armá tu tarjeta en Bookea Lealtad con esta misma cuenta y acá aparecen el escáner, las estadísticas y los clientes listos para su recompensa."
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
      </Lienzo>
    );
  }

  // ── LA TARJETA QUE SE MIRA ──────────────────────────────────────
  const pedida = typeof busqueda.tarjeta === "string" ? busqueda.tarjeta : null;
  const op = escaneres.find((e) => e.ranchoId === pedida) ?? escaneres[0];
  const tipo = tipoDe(op.modo);
  const textos = textosDelTipo(tipo);
  const metaCosto = op.recompensa?.costo ?? null;

  const [datos, clientes, estadisticas, contexto] = await Promise.all([
    cargarLealtad(op.programaId, metaCosto),
    cargarClientesAuditados(op.programaId, metaCosto),
    cargarEstadisticas(op.programaId, op.ranchoId, op.modo),
    contextoDeCuenta(admin, { cuenta_id: op.cuentaId }, { planRancho: op.planRancho }),
  ]);
  const resumen = datos?.resumen ?? null;
  const plan = contexto.plan;
  const listos = (datos?.fichas ?? [])
    .filter((f) => f.puedeCanjear)
    .map((f) => ({ miembroId: f.miembroId, nombre: f.nombre, contacto: f.contacto, saldo: f.saldo }));
  const enRiesgo = (clientes?.totales.enRiesgo ?? 0) + (clientes?.totales.dormidos ?? 0);

  const pestanas = [
    {
      id: "listos",
      etiqueta: listos.length > 0 ? `Listos para su recompensa (${listos.length})` : "Listos para su recompensa",
      contenido: op.recompensa ? (
        <ListosRecompensa
          ranchoId={op.ranchoId}
          listos={listos}
          meta={op.recompensa.costo}
          recompensa={{ id: op.recompensa.id, nombre: op.recompensa.nombre }}
          unidad={textos.unidad}
          verbo={textos.verboCanje}
          puedeCanjear
        />
      ) : (
        <CardVacia
          accion={
            <Link href={`/lealtad/panel/${op.ranchoId}#configuracion`} className={BOTON_PANEL}>
              Definir la recompensa →
            </Link>
          }
        >
          Esta tarjeta todavía no tiene una recompensa activa, así que nadie puede «completarla».
        </CardVacia>
      ),
    },
    {
      id: "estadisticas",
      etiqueta: "Estadísticas",
      contenido: estadisticas ? (
        <EstadisticasLealtad
          datos={estadisticas}
          listosParaCanjear={clientes?.clientes.filter((c) => c.puedeCanjear).length ?? listos.length}
          enRiesgo={enRiesgo}
          tieneProyeccion={puede(plan, "proyeccion_metricas")}
          abreProyeccion={PLANES_OFRECIDOS.map((pid) => PLANES[pid]).find((x) => x.capacidades.includes("proyeccion_metricas"))?.nombre ?? null}
          limiteClientes={definicionDe(plan)?.limites.clientesActivos ?? null}
        />
      ) : (
        <CardVacia>Cuando la tarjeta tenga movimientos, acá se ven las estadísticas.</CardVacia>
      ),
    },
    {
      id: "ventas",
      etiqueta: "Ventas",
      contenido: <ImpactoComercial ranchoId={op.ranchoId} programaId={op.programaId} />,
    },
  ];

  return (
    <Lienzo
      volver={volver}
      titulo={`Lealtad · ${op.tarjeta}`}
      bajada={`La tarjeta de ${op.negocio}: sumá ${textos.unidad} con la cámara, entregá premios y mirá cómo va.`}
      accion={
        <Link href={`/lealtad/panel/${op.ranchoId}`} className={BOTON_PANEL}>
          Abrir el panel completo de Lealtad →
        </Link>
      }
    >
      {/* Varias tarjetas: un selector de píldoras, como en Lealtad. */}
      {escaneres.length > 1 && (
        <nav aria-label="Qué tarjeta mirar" className="mb-4 flex flex-wrap gap-1.5">
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

      <div className={GRILLA_METRICAS}>
        <Metrica rotulo="Clientes" valor={String(resumen?.miembros ?? 0)} detalle={`${resumen?.conPase ?? 0} con el pase en el teléfono`} />
        <Metrica rotulo={`${capitalizar(textos.unidad)} · 30 días`} valor={String(resumen?.sellosRecientes ?? 0)} detalle="entregados en el último mes" />
        <Metrica rotulo="Listos para su recompensa" valor={String(listos.length)} detalle={op.recompensa ? op.recompensa.nombre : "sin recompensa activa"} />
        <Metrica rotulo="Canjes" valor={String(resumen?.canjes ?? 0)} detalle={enRiesgo > 0 ? `${enRiesgo} clientes sin venir hace tiempo` : "premios entregados"} />
      </div>

      <div className="mt-4">
        <Card eyebrow="En el mostrador" titulo="Escanear el pase de un cliente">
          <p className={`mb-3 ${BAJADA_PANTALLA}`}>
            Apuntá la cámara al QR del pase y se le suma {op.pideMonto ? "según el monto de la compra" : `el ${textos.unidad.replace(/s$/, "")} de la visita`}. Si ya completó la
            tarjeta, acá mismo le entregás el premio.
          </p>
          <EscanerSolutions key={op.ranchoId} opciones={[op]} />
        </Card>
      </div>

      <div className="mt-4">
        <TabsContenido etiquetaGrupo="Qué ver de la tarjeta" pestanas={pestanas} />
      </div>
    </Lienzo>
  );
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** El marco de la pantalla: mismo lienzo y cabecera que Instagram y las mesas. */
function Lienzo({
  volver,
  titulo,
  bajada,
  accion,
  children,
}: {
  volver: string;
  titulo: string;
  bajada: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className={`min-h-svh ${LIENZO_PANEL} ${CLASES_FUENTES}`}>
      <div className="mx-auto w-[min(1080px,94vw)] py-6 sm:py-8">
        <Link href={volver} className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink">
          ← Volver al panel
        </Link>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={`mt-1 ${TITULO_PANTALLA}`}>{titulo}</h1>
            <p className={`mt-1 ${BAJADA_PANTALLA}`}>{bajada}</p>
          </div>
          {accion}
        </div>
        {children}
      </div>
    </main>
  );
}
