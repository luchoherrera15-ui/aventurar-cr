import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, puede, PLANES, PLANES_OFRECIDOS } from "@/lib/lealtad/planes";
import { Card, CardVacia, GrillaTablero } from "@/components/panel/piezas";
import {
  CUERPO,
  DETALLE,
  GAP_TABLERO,
  MARCA_ACENTO,
} from "@/components/panel/sistema";
import { cargarClientesAuditados } from "./clientes-datos";
import { RITMOS, TRAMOS, esRescatable } from "@/lib/lealtad/ciclo-cliente";
import MetricasConDetalle, {
  ClientesQueNoVuelven,
  type FilaDetalle,
  type MetricaAbrible,
} from "./metricas-detalle";

/**
 * La pestaña Métricas: ¿el programa está creciendo o no?
 *
 * Todo se DERIVA del ledger y de las fechas de alta — acá no hay
 * contadores guardados (doctrina del módulo: el saldo es la suma, el
 * stock se cuenta, y las métricas se calculan). Corre con la llave de
 * servicio porque las tablas no le dan lectura al negocio (0060).
 *
 * Las ventanas se comparan completas: los últimos 30 días contra los 30
 * anteriores. Comparar "lo que va del mes" contra un mes entero hace
 * ver caídas donde solo hay calendario.
 *
 * El cálculo vive FUERA del componente: el compilador de React no
 * acepta Date.now() en el cuerpo de un componente (y tiene razón — en
 * una función suelta la impureza es explícita).
 */

const DIA_MS = 24 * 60 * 60 * 1000;

type Datos = {
  semanas: { etiqueta: string; nuevos: number }[];
  maxSemana: number;
  nuevos30: number;
  nuevosPrev: number;
  activos30: number;
  sellos30: number;
  sellosPrev: number;
  canjes30: number;
  canjesPrev: number;
  totalMiembros: number;
  limite: number | null;
  ritmoSemanal: number;
  proyeccion30: number;
  emitidas: number;
  registradas: number;
  /**
   * QUIÉNES hay detrás de cada cifra, con EXACTAMENTE la misma ventana
   * de 30 días que la cifra.
   *
   * ⚠️ ESTO NO SE PUEDE DERIVAR DEL PADRÓN DE CLIENTES. Se intentó (30
   * ago 2026) y salió mal: el padrón trae totales de por vida y un
   * tramo calculado con los umbrales del RITMO del negocio (7, 21, 35 o
   * 60 días, nunca 30). El panel se contradecía solo: «Clientes nuevos
   * · 0 · últimos 30 días» y, al abrirlo, treinta personas afiliadas
   * hacía meses. Los ids salen de acá, del mismo ledger del que salen
   * las cifras; los NOMBRES los pone después el padrón.
   */
  idsNuevos30: string[];
  idsActivos30: string[];
  /** miembro_id → sellos ganados en los últimos 30 días, de mayor a menor. */
  sellosPorMiembro30: [string, number][];
  /** miembro_id → canjes hechos en los últimos 30 días. */
  canjesPorMiembro30: [string, number][];
};

async function calcularMetricas(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  programaId: string,
  plan: string | null,
): Promise<Datos> {
  const ahora = Date.now();
  const hace60 = new Date(ahora - 60 * DIA_MS).toISOString();

  const { data: miembros } = await db
    .from("miembros")
    .select("id, created_at")
    .eq("programa_id", programaId);

  const ids = (miembros ?? []).map((m) => m.id as string);

  const [{ data: tx }, { data: pases }] = await Promise.all([
    ids.length
      ? db
          .from("transacciones_puntos")
          .select("miembro_id, tipo, created_at")
          .in("miembro_id", ids)
          .gte("created_at", hace60)
      : Promise.resolve({ data: [] as { miembro_id: string; tipo: string; created_at: string }[] }),
    ids.length
      ? db.from("pases_wallet").select("serial_number").in("miembro_id", ids)
      : Promise.resolve({ data: [] as { serial_number: string }[] }),
  ]);

  const seriales = (pases ?? []).map((p) => p.serial_number as string);
  const { data: registros } = seriales.length
    ? await db
        .from("registros_dispositivo")
        .select("serial_number")
        .in("serial_number", seriales)
    : { data: [] };

  // ── Nuevos miembros por semana (últimas 8) ──────────────────────────
  const semanas: { etiqueta: string; nuevos: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const fin = ahora - i * 7 * DIA_MS;
    const inicio = fin - 7 * DIA_MS;
    const nuevos = (miembros ?? []).filter((m) => {
      const t = new Date(m.created_at as string).getTime();
      return t >= inicio && t < fin;
    }).length;
    const d = new Date(inicio);
    semanas.push({
      etiqueta: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      nuevos,
    });
  }

  // ── Ventanas de 30 días, completas ──────────────────────────────────
  const corte30 = ahora - 30 * DIA_MS;
  const enVentana = (fecha: string, reciente: boolean) => {
    const t = new Date(fecha).getTime();
    return reciente ? t >= corte30 : t < corte30;
  };

  const filas = (tx ?? []) as { miembro_id: string; tipo: string; created_at: string }[];
  const sellos30 = filas.filter((t) => t.tipo === "ganado" && enVentana(t.created_at, true)).length;
  const sellosPrev = filas.filter((t) => t.tipo === "ganado" && enVentana(t.created_at, false)).length;
  const canjes30 = filas.filter((t) => t.tipo === "canjeado" && enVentana(t.created_at, true)).length;
  const canjesPrev = filas.filter((t) => t.tipo === "canjeado" && enVentana(t.created_at, false)).length;

  const activos30 = new Set(
    filas.filter((t) => enVentana(t.created_at, true)).map((t) => t.miembro_id),
  ).size;

  const nuevos30 = (miembros ?? []).filter(
    (m) => new Date(m.created_at as string).getTime() >= corte30,
  ).length;
  const nuevosPrev = (miembros ?? []).filter((m) => {
    const t = new Date(m.created_at as string).getTime();
    return t >= ahora - 60 * DIA_MS && t < corte30;
  }).length;

  // Los MISMOS filtros de arriba, pero guardando a quién le tocó cada
  // evento: así la lista no puede divergir de su cifra, porque salen de
  // la misma pasada por los mismos datos.
  const idsActivos30 = [
    ...new Set(filas.filter((t) => enVentana(t.created_at, true)).map((t) => t.miembro_id)),
  ];
  const idsNuevos30 = (miembros ?? [])
    .filter((m) => new Date(m.created_at as string).getTime() >= corte30)
    .map((m) => m.id as string);

  const contarPor = (tipo: string): [string, number][] => {
    const mapa = new Map<string, number>();
    for (const t of filas) {
      if (t.tipo !== tipo || !enVentana(t.created_at, true)) continue;
      mapa.set(t.miembro_id, (mapa.get(t.miembro_id) ?? 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  };
  const sellosPorMiembro30 = contarPor("ganado");
  const canjesPorMiembro30 = contarPor("canjeado");

  const totalMiembros = (miembros ?? []).length;
  const limite = definicionDe(plan)?.limites.clientesActivos ?? null;

  // A este ritmo (promedio de las últimas 4 semanas), en un mes hay:
  const ritmoSemanal = semanas.slice(-4).reduce((s, x) => s + x.nuevos, 0) / 4;
  const proyeccion30 = Math.round(totalMiembros + ritmoSemanal * 4.33);

  return {
    semanas,
    maxSemana: Math.max(1, ...semanas.map((s) => s.nuevos)),
    nuevos30,
    nuevosPrev,
    activos30,
    sellos30,
    sellosPrev,
    canjes30,
    canjesPrev,
    totalMiembros,
    limite,
    ritmoSemanal,
    proyeccion30,
    emitidas: seriales.length,
    registradas: new Set((registros ?? []).map((r) => r.serial_number as string)).size,
    idsNuevos30,
    idsActivos30,
    sellosPorMiembro30,
    canjesPorMiembro30,
  };
}

export default async function MetricasLealtad({
  programaId,
  plan,
  meta,
}: {
  programaId: string | null;
  plan: string | null;
  /** El costo en puntos de la recompensa. Lo necesita
   *  `cargarClientesAuditados` para saber a quién le alcanza para
   *  canjear; null cuando el programa todavía no tiene meta. */
  meta?: number | null;
}) {
  const db = createAdminClient();
  if (!db || !programaId) {
    return <CardVacia>Cuando el programa esté activo, acá se ve el crecimiento.</CardVacia>;
  }

  const d = await calcularMetricas(db, programaId, plan);

  // El padrón con el tramo de cada cliente. `cargarClientesAuditados`
  // está envuelto en `cache()`, así que si la pantalla de Clientes ya
  // lo pidió en este mismo render no hay una segunda ida a la base.
  // Es la MISMA fuente que usa Clientes: dos criterios distintos de
  // «no está volviendo» se contradirían en pantalla.
  const padron = await cargarClientesAuditados(programaId, meta ?? null);
  const detalle = padron ? listasDeDetalle(padron, d) : null;

  // La proyección de crecimiento (ritmoSemanal/proyeccion30) es capacidad
  // de paquete, no un dato gratis: Prueba y Starter se quedan con las
  // cuatro cifras básicas de arriba, sin la card de "A este ritmo". `abre`
  // es el paquete más barato que SÍ la trae, para nombrarlo en el aviso —
  // mismo tono que `selector-tipo.tsx` ("Necesitás el paquete X para...").
  const tieneProyeccion = puede(plan, "proyeccion_metricas");
  const abre = PLANES_OFRECIDOS.map((id) => PLANES[id]).find((p) =>
    p.capacidades.includes("proyeccion_metricas"),
  );

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {/* Las cuatro cifras, ahora abribles (30 ago 2026). Ver la
          cabecera de `metricas-detalle.tsx`: el número sin los
          nombres no se puede accionar. */}
      <MetricasConDetalle
        metricas={[
          {
            clave: "nuevos",
            titulo: "Clientes nuevos",
            valor: String(d.nuevos30),
            detalle: "últimos 30 días",
            icono: "afiliar",
            tendencia: delta(d.nuevos30, d.nuevosPrev),
            filas: detalle?.nuevos ?? [],
            vacio: "Nadie se afilió en los últimos 30 días.",
          },
          {
            clave: "activos",
            titulo: "Clientes activos",
            valor: String(d.activos30),
            detalle: "movieron su tarjeta en 30 días",
            icono: "clientes",
            filas: detalle?.activos ?? [],
            vacio: "Nadie movió su tarjeta en los últimos 30 días.",
          },
          {
            clave: "sellos",
            titulo: "Sellos y puntos dados",
            valor: String(d.sellos30),
            detalle: "últimos 30 días",
            icono: "sumar",
            tendencia: delta(d.sellos30, d.sellosPrev),
            filas: detalle?.masSellos ?? [],
            vacio: "No se dieron sellos en los últimos 30 días.",
          },
          {
            clave: "canjes",
            titulo: "Canjes",
            valor: String(d.canjes30),
            detalle: "últimos 30 días",
            icono: "regalo",
            tendencia: delta(d.canjes30, d.canjesPrev),
            filas: detalle?.canjearon ?? [],
            vacio: "Nadie canjeó en los últimos 30 días.",
          },
        ]}
      />

      {/* ── ¿QUIÉNES NO ESTÁN VOLVIENDO? (30 ago 2026) ───────────
          Pedido del dueño: que Métricas deje de ser un tablero y
          sirva para actuar. La clasificación sale del RITMO del
          negocio, no de un corte fijo de 7 días — ver
          `metricas-detalle.tsx`. */}
      {detalle && (
        <Card
          eyebrow="Para actuar hoy"
          titulo="¿Quiénes no están volviendo?"
          accion={
            <span className={DETALLE}>
              {detalle.noVuelven.length}
              {detalle.noVuelven.length === 1 ? " cliente" : " clientes"}
            </span>
          }
        >
          <ClientesQueNoVuelven
            filas={detalle.noVuelven}
            ritmoEtiqueta={detalle.ritmoEtiqueta}
            diasEnRiesgo={detalle.diasEnRiesgo}
            totalEnRiesgo={detalle.totalEnRiesgo}
            totalDormidos={detalle.totalDormidos}
            hayClientes={detalle.hayClientes}
          />
        </Card>
      )}

      {/* LA GRÁFICA (`.chart` de la maqueta). Las barras pasan del navy
          —que sobre el navy del panel se lee gris— al color de acción, y
          toman el remate de la maqueta (redondeado arriba, casi recto
          abajo). El total va a la derecha del encabezado, que es donde
          la maqueta lo pone: el dato que resume la gráfica no debería
          obligar a sumar ocho barras con la vista. */}
      <Card
        eyebrow="Crecimiento"
        titulo="Clientes nuevos por semana"
        accion={
          <span className={DETALLE}>
            {d.semanas.reduce((s, x) => s + x.nuevos, 0)} en 8 semanas
          </span>
        }
      >
        <div className="flex items-end gap-2" style={{ height: 110 }}>
          {d.semanas.map((s) => (
            <div key={s.etiqueta} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10.5px] font-bold tabular-nums text-aventurea-ink">
                {s.nuevos || ""}
              </span>
              <div
                className="w-full rounded-t-md"
                style={{
                  backgroundColor: MARCA_ACENTO.backgroundColor,
                  height: `${Math.max(4, (s.nuevos / d.maxSemana) * 80)}px`,
                  borderRadius: "5px 5px 2px 2px",
                  // La semana sin afiliados no se borra: se deja su
                  // hueco. Un mes con tres semanas en cero es un dato.
                  opacity: s.nuevos ? 1 : 0.28,
                }}
              />
              <span className="truncate text-[9.5px] text-aventurea-ink-soft">{s.etiqueta}</span>
            </div>
          ))}
        </div>
      </Card>

      <GrillaTablero>
        {tieneProyeccion ? (
          <Card eyebrow="A este ritmo" titulo="Proyección" nivel="h3">
            <p className={CUERPO}>
              {d.ritmoSemanal > 0 ? (
                <>
                  Al ritmo de las últimas 4 semanas (~{Math.round(d.ritmoSemanal * 10) / 10} por
                  semana), en un mes andarías por <strong>{d.proyeccion30} miembros</strong>
                  {d.limite !== null && d.proyeccion30 >= d.limite && (
                    <> — pasarías el tope de tu plan ({d.limite}): hora de mejorar el paquete</>
                  )}
                  .
                </>
              ) : (
                <>Sin afiliaciones en el último mes. El QR en el mostrador es lo que más afilia.</>
              )}
            </p>
          </Card>
        ) : (
          <Card eyebrow="A este ritmo" titulo="Proyección" nivel="h3">
            <p className={CUERPO}>
              La proyección de crecimiento se desbloquea con el paquete {abre?.nombre ?? "Impulso"}{" "}
              — con tu paquete actual tenés las cuatro métricas de arriba: altas, activos, sellos y
              canjes.
            </p>
          </Card>
        )}
        <Card
          eyebrow="Wallet"
          titulo="Tarjetas en el teléfono"
          nivel="h3"
          accion={
            d.limite !== null ? (
              <span className={DETALLE}>
                {d.totalMiembros} de {d.limite} del plan
              </span>
            ) : undefined
          }
        >
          <p className={CUERPO}>
            {d.emitidas} emitida{d.emitidas === 1 ? "" : "s"}; {d.registradas} con actualización
            automática en el teléfono.
          </p>
        </Card>
      </GrillaTablero>
    </div>
  );
}

/**
 * DE LOS DATOS A LAS LISTAS QUE SE MUESTRAN.
 *
 * ⚠️ CADA LISTA USA LA VENTANA DE SU PROPIA CIFRA, Y ESO NO ES UN
 * DETALLE: es la única razón por la que la lista sirve. La primera
 * versión (30 ago 2026) armaba las cuatro listas del padrón completo
 * —totales de por vida y tramos calculados con los umbrales del RITMO
 * del negocio, que son 7, 21, 35 o 60 días, nunca 30— y el panel se
 * contradecía solo en pantalla: «Clientes nuevos · 0 · últimos 30
 * días» y, al abrirlo, treinta personas afiliadas hacía meses. Una
 * lista que no coincide con su número es peor que no tener lista.
 *
 * Por eso los IDS salen de `calcularMetricas` (el mismo ledger, los
 * mismos filtros que las cifras) y el PADRÓN solo pone los nombres.
 *
 * La única lista que NO usa 30 días es «no están volviendo», y también
 * a propósito: esa no explica una cifra de arriba, responde «¿a quién
 * le escribo hoy?», y para eso el corte correcto es el ritmo del
 * negocio — una semana sin venir es normal en una barbería y una
 * alarma en una cafetería.
 */
function listasDeDetalle(
  padron: NonNullable<Awaited<ReturnType<typeof cargarClientesAuditados>>>,
  d: Datos,
) {
  const porId = new Map(padron.clientes.map((c) => [c.miembroId, c]));
  const nombreDe = (id: string) => porId.get(id)?.nombre ?? "Cliente";

  const diasTexto = (dd: number | null) =>
    dd === null ? "todavía no vino" : dd === 0 ? "vino hoy" : dd === 1 ? "hace 1 día" : `hace ${dd} días`;

  // ── Las cuatro que explican una cifra ───────────────────────────
  const nuevos: FilaDetalle[] = d.idsNuevos30
    .map((id) => porId.get(id))
    .filter((c) => c !== undefined)
    .sort((a, b) => (a.desde < b.desde ? 1 : -1))
    .map((c) => ({
      id: c.miembroId,
      nombre: c.nombre,
      apoyo: `Se afilió el ${c.desde.slice(8, 10)}/${c.desde.slice(5, 7)}`,
    }));

  const activos: FilaDetalle[] = d.idsActivos30
    .map((id) => porId.get(id))
    .filter((c) => c !== undefined)
    .sort((a, b) => (a.diasSinVenir ?? 999) - (b.diasSinVenir ?? 999))
    .map((c) => ({
      id: c.miembroId,
      nombre: c.nombre,
      apoyo: `Última visita ${diasTexto(c.diasSinVenir)}`,
    }));

  // Estas dos cuentan EVENTOS, no personas, así que la lista dice
  // cuántos le tocaron a cada quien EN LA VENTANA — no su total
  // histórico, que sería otro número bajo el mismo rótulo.
  const masSellos: FilaDetalle[] = d.sellosPorMiembro30.map(([id, n]) => ({
    id,
    nombre: nombreDe(id),
    apoyo: `${n} sello${n === 1 ? "" : "s"} en 30 días`,
    cifra: String(n),
  }));

  const canjearon: FilaDetalle[] = d.canjesPorMiembro30.map(([id, n]) => ({
    id,
    nombre: nombreDe(id),
    apoyo: `${n} canje${n === 1 ? "" : "s"} en 30 días`,
  }));

  // ── La que responde «¿a quién le escribo?» ──────────────────────
  const noVuelven: FilaDetalle[] = padron.clientes
    .filter((c) => esRescatable(c.tramo))
    .sort((a, b) => (b.diasSinVenir ?? 0) - (a.diasSinVenir ?? 0))
    .map((c) => ({
      id: c.miembroId,
      nombre: c.nombre,
      apoyo: `Última visita ${diasTexto(c.diasSinVenir)} · ${c.visitas} visita${c.visitas === 1 ? "" : "s"}`,
      cifra: TRAMOS[c.tramo].etiqueta,
    }));

  return {
    noVuelven,
    nuevos,
    activos,
    masSellos,
    canjearon,
    ritmoEtiqueta: RITMOS[padron.ritmo].etiqueta,
    /** Los días sin venir a partir de los cuales este negocio considera
     *  que alguien se está enfriando. Se dice en pantalla para que el
     *  dueño sepa contra qué se lo está midiendo. */
    diasEnRiesgo: RITMOS[padron.ritmo].enRiesgo,
    totalEnRiesgo: padron.totales.enRiesgo,
    totalDormidos: padron.totales.dormidos,
    /** Si el padrón está vacío, «nadie se está enfriando» sería una
     *  afirmación falsa: no hay a quién enfriarse. */
    hayClientes: padron.clientes.length > 0,
  };
}
function delta(actual: number, anterior: number): string | null {
  if (anterior === 0) return actual > 0 ? "nuevo" : null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return "igual que antes";
  return pct > 0 ? `+${pct}% vs 30 días previos` : `${pct}% vs 30 días previos`;
}
