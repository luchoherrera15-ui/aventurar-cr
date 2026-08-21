import { createAdminClient } from "@/lib/supabase/admin";
import { formatearCRC } from "@/lib/dinero";
import { Card, CardVacia } from "@/components/panel/piezas";
import { GAP_METRICAS } from "@/components/panel/sistema";
import {
  faltaLaTablaDeTransacciones,
  resumenImpacto,
  type FilaDeCompra,
  type ResumenImpacto,
} from "@/lib/lealtad/transacciones";
import { topProductosVendidos, type ProductoVendido } from "@/lib/lealtad/productos";
import Kpi from "./kpi";

/**
 * IMPACTO COMERCIAL (0197): lo que el programa le deja al negocio en
 * plata, no en sellos.
 *
 * Todo sale de `lealtad_transacciones` — el evento comercial que el
 * mostrador registra al acreditar — y de `canjes` (0060), que ya
 * existía. Nada se estima y nada se rellena:
 *
 *   · sin la migración 0197, la sección lo dice con un aviso neutro y
 *     no muestra números que no existen;
 *   · con la tabla vacía, muestra CEROS — que es la verdad de un
 *     programa que todavía no registra compras;
 *   · el crecimiento % solo aparece cuando HAY dos períodos con
 *     ventas (resumenImpacto lo devuelve null si no; doctrina del
 *     Kpi: «nunca con un +0 % de relleno»).
 *
 * El cálculo es puro (resumenImpacto, transacciones.ts) y está
 * probado sin base; acá vive solo el ir a buscar las filas.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

type Impacto =
  | { estado: "ok"; resumen: ResumenImpacto; canjes: number; top: ProductoVendido[] }
  | { estado: "sin-tabla" }
  | { estado: "error" };

async function cargarImpacto(
  db: Admin,
  filtro: { ranchoId: string; programaId: string | null },
): Promise<Impacto> {
  // Las últimas 5.000 compras alcanzan de sobra para un mostrador de
  // barrio; el día que un negocio las pase, esta consulta se vuelve un
  // agregado en SQL — no un límite más alto.
  let consulta = db
    .from("lealtad_transacciones")
    // `producto` entra desde la 0198: es lo que alimenta «Lo que más
    // venden». Se lee la columna de TEXTO y no `producto_id` a
    // propósito — así el ranking incluye también las ventas anteriores
    // al catálogo y las de un producto ya retirado del menú, que son
    // plata que el negocio hizo igual.
    .select("miembro_id, monto, producto, sellos_otorgados, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  consulta = filtro.programaId
    ? consulta.eq("programa_id", filtro.programaId)
    : consulta.eq("rancho_id", filtro.ranchoId);

  const { data, error } = await consulta;
  if (error) {
    if (faltaLaTablaDeTransacciones(error)) return { estado: "sin-tabla" };
    console.warn("[lealtad] No se pudo leer el impacto comercial:", error.message);
    return { estado: "error" };
  }

  const filas: FilaDeCompra[] = (data ?? []).map((f) => ({
    miembroId: f.miembro_id as string,
    monto: f.monto === null ? null : Number(f.monto),
    sellosOtorgados: (f.sellos_otorgados as number) ?? 0,
    createdAt: f.created_at as string,
  }));

  // Las filas llegan de la más nueva a la más vieja (el `order` de
  // arriba), y `topProductosVendidos` se apoya en ese orden para
  // quedarse con el nombre MÁS RECIENTE de cada producto.
  const top = topProductosVendidos(
    (data ?? []).map((f) => ({
      producto: (f.producto as string | null) ?? null,
      monto: f.monto === null ? null : Number(f.monto),
    })),
  );

  return {
    estado: "ok",
    resumen: resumenImpacto(filas, Date.now()),
    canjes: await contarCanjes(db, filtro),
    top,
  };
}

/**
 * Las recompensas canjeadas: el dato YA existente de `canjes` (0060),
 * sin contar los anulados. Se llega por los miembros del programa (o
 * de todos los programas del negocio) porque `canjes` no conoce el
 * rancho — mismo camino que el resto del panel.
 */
async function contarCanjes(
  db: Admin,
  filtro: { ranchoId: string; programaId: string | null },
): Promise<number> {
  let programas: string[];
  if (filtro.programaId) {
    programas = [filtro.programaId];
  } else {
    const { data } = await db
      .from("programa_lealtad")
      .select("id")
      .eq("rancho_id", filtro.ranchoId);
    programas = (data ?? []).map((p) => p.id as string);
  }
  if (programas.length === 0) return 0;

  const { data: miembros } = await db
    .from("miembros")
    .select("id")
    .in("programa_id", programas);
  const ids = (miembros ?? []).map((m) => m.id as string);
  if (ids.length === 0) return 0;

  const { count } = await db
    .from("canjes")
    .select("id", { count: "exact", head: true })
    .in("miembro_id", ids)
    .neq("estado", "anulado");
  return count ?? 0;
}

const AVISO_SIN_TABLA =
  "El registro de compras todavía no está activo en la base (migración 0197). " +
  "Cuando el equipo de Bookea lo active, acá se ven las ventas que pasan por tu tarjeta.";

/** ₡ ya formateado, o «—» cuando el dato no existe (nunca un 0 falso). */
function colonesODato(valor: number | null): string {
  return valor === null ? "—" : formatearCRC(Math.round(valor));
}

/**
 * La sección «Impacto comercial» del panel (pestaña Métricas): las
 * cifras de TODO el negocio, en el mismo lenguaje de Kpi que el resto.
 */
export default async function ImpactoComercial({
  ranchoId,
  programaId = null,
}: {
  ranchoId: string;
  /** null = todo el negocio; con id, acotado a esa tarjeta. */
  programaId?: string | null;
}) {
  const db = createAdminClient();
  if (!db) return null;

  const impacto = await cargarImpacto(db, { ranchoId, programaId });
  if (impacto.estado === "sin-tabla") return <CardVacia>{AVISO_SIN_TABLA}</CardVacia>;
  if (impacto.estado === "error") {
    return <CardVacia>No se pudo leer el impacto comercial. Recargá la página.</CardVacia>;
  }

  const { resumen, canjes, top } = impacto;
  return (
    <div className={`flex flex-col ${GAP_METRICAS}`}>
      <div className={`grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`}>
      <Kpi
        titulo="Ventas con Bookea"
        valor={colonesODato(resumen.comprasConMonto > 0 ? resumen.ventas : null)}
        detalle={
          resumen.comprasConMonto > 0
            ? `${resumen.comprasConMonto.toLocaleString("es-CR")} compra${
                resumen.comprasConMonto === 1 ? "" : "s"
              } con monto`
            : "todavía sin montos registrados"
        }
        icono="moneda"
        tendencia={
          resumen.crecimientoVentasPct === null
            ? null
            : `${resumen.crecimientoVentasPct >= 0 ? "+" : ""}${resumen.crecimientoVentasPct}% vs 30 días previos`
        }
      />
      <Kpi
        titulo="Compras registradas"
        valor={resumen.compras.toLocaleString("es-CR")}
        detalle="cada escaneo del mostrador"
        icono="escanear"
      />
      <Kpi
        titulo="Ticket promedio"
        valor={colonesODato(resumen.ticketPromedio)}
        detalle={
          resumen.ticketPromedio === null ? "aparece al registrar montos" : "por compra con monto"
        }
        icono="metricas"
      />
      <Kpi
        titulo="Clientes recurrentes"
        valor={resumen.recurrentes.toLocaleString("es-CR")}
        detalle={`con 2+ compras · ${canjes.toLocaleString("es-CR")} recompensa${
          canjes === 1 ? "" : "s"
        } canjeada${canjes === 1 ? "" : "s"}`}
        icono="repetir"
      />
      </div>

      {/* «Lo que más venden» SOLO si hay ventas con producto. Sin
          catálogo cargado y sin nadie tecleando el concepto, este
          bloque no existe — un top vacío o con un renglón «(sin
          producto)» sería ruido que no dice nada. */}
      <LoQueMasVenden top={top} />
    </div>
  );
}

/**
 * EL TOP 5 DE PRODUCTOS, por plata vendida.
 *
 * Datos reales de `lealtad_transacciones` y nada más: el nombre que
 * quedó guardado en cada venta, cuántas ventas lo nombraron y cuánto
 * sumaron. No aparece cuando ninguna venta trae producto — que es la
 * verdad de un negocio que todavía no cargó su catálogo.
 *
 * NO dice «unidades»: el monto de una venta es editable, así que una
 * venta puede llevar dos cafés y el sistema no sabe cuántos fueron.
 * Poner «unidades» sería inventar precisión que no existe.
 */
function LoQueMasVenden({ top }: { top: ProductoVendido[] }) {
  if (top.length === 0) return null;

  return (
    <Card eyebrow="Tu menú, ordenado por plata" titulo="Lo que más venden" nivel="h3">
      <ul className="flex flex-col">
        {top.map((p, i) => (
          <li
            key={p.nombre}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-aventurea-line py-2.5 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span className="flex min-w-0 items-baseline gap-2.5">
              <span
                aria-hidden
                className="text-[11px] font-extrabold tabular-nums text-aventurea-ink-soft"
              >
                {i + 1}
              </span>
              <span className="min-w-0 truncate text-[13.5px] font-extrabold text-aventurea-ink">
                {p.nombre}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-3">
              <span className="text-[12px] text-aventurea-ink-soft">
                {p.ventas.toLocaleString("es-CR")} venta{p.ventas === 1 ? "" : "s"}
              </span>
              <span className="text-[13.5px] font-extrabold tabular-nums text-aventurea-ink">
                {formatearCRC(p.total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-snug text-aventurea-ink-soft">
        Se cuenta cada venta registrada, no cada unidad: el monto es editable en la caja, así que
        una venta puede llevar más de uno.
      </p>
    </Card>
  );
}

/**
 * La mini-sección «Impacto del programa» para la PANTALLA DE LA
 * TARJETA (/lealtad/panel/[id]/editar/[programaId]): mismas cifras,
 * acotadas al programa, más los sellos emitidos. Va en el lenguaje
 * claro de esa pantalla (bookea-*), no en el navy del panel.
 */
export async function ImpactoDelPrograma({
  ranchoId,
  programaId,
}: {
  ranchoId: string;
  programaId: string;
}) {
  const db = createAdminClient();
  if (!db) return null;

  const impacto = await cargarImpacto(db, { ranchoId, programaId });
  if (impacto.estado === "error") return null;

  const cuerpo =
    impacto.estado === "sin-tabla" ? (
      <p className="text-[12.5px] leading-relaxed text-bookea-gris">{AVISO_SIN_TABLA}</p>
    ) : (
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <Cifra
          rotulo="Ventas con Bookea"
          valor={colonesODato(
            impacto.resumen.comprasConMonto > 0 ? impacto.resumen.ventas : null,
          )}
        />
        <Cifra
          rotulo="Compras registradas"
          valor={impacto.resumen.compras.toLocaleString("es-CR")}
        />
        <Cifra rotulo="Ticket promedio" valor={colonesODato(impacto.resumen.ticketPromedio)} />
        <Cifra
          rotulo="Clientes recurrentes"
          valor={impacto.resumen.recurrentes.toLocaleString("es-CR")}
        />
        <Cifra
          rotulo="Recompensas canjeadas"
          valor={impacto.canjes.toLocaleString("es-CR")}
        />
        <Cifra
          rotulo="Sellos emitidos"
          valor={impacto.resumen.sellosEmitidos.toLocaleString("es-CR")}
        />
      </dl>
    );

  return (
    <section className="mt-7 rounded-2xl border border-bookea-linea bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-bookea-gris">
        Impacto del programa
      </p>
      <h2 className="mt-1 text-[16px] font-bold tracking-[-0.01em] text-bookea-tinta">
        Lo que esta tarjeta mueve en el mostrador
      </h2>
      <div className="mt-4">{cuerpo}</div>
    </section>
  );
}

function Cifra({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-bold uppercase tracking-wide text-bookea-gris">
        {rotulo}
      </dt>
      <dd className="mt-1 text-[18px] font-bold tabular-nums tracking-[-0.01em] text-bookea-tinta">
        {valor}
      </dd>
    </div>
  );
}
