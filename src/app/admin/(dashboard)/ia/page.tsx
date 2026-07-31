import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { gastoDelMesUSD, leerConfigIA } from "@/lib/ia/config-ia";
import { AGENTES, type AgenteIA } from "@/lib/ia/modelos";
import ConocimientoPanel, {
  type FilaConocimiento,
  type NegocioIA,
} from "./conocimiento-panel";
import GastoPanel, {
  type FilaUso,
  type ResumenAgente,
  type ResumenDia,
} from "./gasto-panel";
import IaTabs from "./ia-tabs";
import { esTabIA } from "./pestanas";
import ModelosPanel, { type ConsumoAgente } from "./modelos-panel";

/** Cuántos días mira la proyección de "cuánto cambiaría si cambio el modelo". */
const DIAS_CONSUMO = 30;

/**
 * Techo de filas del DETALLE (la tabla "últimas llamadas"). No se usa
 * para ningún total: los totales salen de las funciones de agregación
 * de la 0078, que suman en Postgres. Antes este mismo techo alimentaba
 * el "Costo total" y el panel mentía apenas el periodo lo superaba.
 */
const MAX_DETALLE = 500;

/**
 * Techo del camino de respaldo (sin las funciones de agregación). Trae
 * más filas porque de ahí salen los totales, y aun así queda truncado:
 * por eso el panel lo dice en pantalla.
 */
const MAX_RESPALDO = 5000;

type FilaUsoDb = {
  id: string;
  agente: string;
  modelo: string;
  tokens_input: number | null;
  tokens_output: number | null;
  costo_usd: number | string | null;
  costo_crc: number | string | null;
  tipo_cambio: number | string | null;
  exito: boolean | null;
  error: string | null;
  created_at: string;
};

const COLUMNAS_USO =
  "id, agente, modelo, tokens_input, tokens_output, costo_usd, costo_crc, tipo_cambio, exito, error, created_at";

/** Una fila de gasto_ia_resumen: ya viene agrupada por agente y modelo. */
type FilaResumenDb = {
  agente: string | null;
  modelo: string | null;
  llamadas: number | string | null;
  tokens_input: number | string | null;
  tokens_output: number | string | null;
  costo_usd: number | string | null;
  costo_crc: number | string | null;
  fallidas: number | string | null;
};

/** Una fila de gasto_ia_por_dia, con el día ya cortado en hora tica. */
type FilaPorDiaDb = {
  dia: string;
  llamadas: number | string | null;
  tokens_input: number | string | null;
  tokens_output: number | string | null;
  costo_usd: number | string | null;
  costo_crc: number | string | null;
};

type FilaRanchoDb = {
  id: string;
  nombre: string;
  vertical?: string | null;
  asistente_activo?: boolean | null;
  asistente_instrucciones?: string | null;
};

type FilaConocimientoDb = {
  id: string;
  rancho_id: string;
  pregunta: string;
  respuesta: string;
  activo: boolean | null;
  orden: number | null;
};

type ClienteAdmin = NonNullable<ReturnType<typeof createAdminClient>>;

function unSolo(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function esFecha(valor: string | undefined): valor is string {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

/**
 * Postgres serializa numeric como texto y bigint como número: todo lo
 * que venga de las funciones de agregación pasa por acá antes de sumar.
 */
function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Hoy en Costa Rica. El servidor corre en UTC y el país está seis horas
 * atrás sin horario de verano, así que a las 6 p.m. de acá el servidor
 * ya cambió de día — sin este ajuste "este mes" arrancaría torcido.
 */
function hoyCR(): string {
  return new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Medianoche de Costa Rica de ese día, en el instante UTC que le toca. */
function inicioDelDiaCR(fecha: string): string {
  return `${fecha}T06:00:00.000Z`;
}

/** El día tico al que pertenece un created_at, para el camino de respaldo. */
function diaCR(iso: string): string {
  return new Date(new Date(iso).getTime() - 6 * 3_600_000).toISOString().slice(0, 10);
}

function mapearFilas(data: unknown, tipoCambioActual: number): FilaUso[] {
  return ((data ?? []) as FilaUsoDb[]).map((f) => {
    const costoUSD = num(f.costo_usd);
    // costo_crc viene congelado en la fila; si por lo que sea faltara,
    // se usa el tipo de cambio que quedó guardado en esa misma llamada
    // antes de caer al configurado hoy.
    const tipoCambioFila = num(f.tipo_cambio) || tipoCambioActual;
    return {
      id: f.id,
      agente: f.agente,
      modelo: f.modelo,
      tokensInput: num(f.tokens_input),
      tokensOutput: num(f.tokens_output),
      costoUSD,
      costoCRC: f.costo_crc == null ? costoUSD * tipoCambioFila : num(f.costo_crc),
      exito: f.exito !== false,
      error: f.error,
      creado: f.created_at,
    };
  });
}

/** Las filas de gasto_ia_resumen, colapsadas a un renglón por agente. */
function agruparPorAgente(filas: FilaResumenDb[]): ResumenAgente[] {
  const acc = new Map<string, ResumenAgente>();
  for (const f of filas) {
    const agente = f.agente ?? "desconocido";
    const prev =
      acc.get(agente) ??
      {
        agente,
        llamadas: 0,
        tokensInput: 0,
        tokensOutput: 0,
        costoUSD: 0,
        costoCRC: 0,
        fallidas: 0,
        modelos: [] as { modelo: string; llamadas: number }[],
      };
    const llamadas = num(f.llamadas);
    prev.llamadas += llamadas;
    prev.tokensInput += num(f.tokens_input);
    prev.tokensOutput += num(f.tokens_output);
    prev.costoUSD += num(f.costo_usd);
    prev.costoCRC += num(f.costo_crc);
    prev.fallidas += num(f.fallidas);
    if (f.modelo) prev.modelos.push({ modelo: f.modelo, llamadas });
    acc.set(agente, prev);
  }
  for (const r of acc.values()) r.modelos.sort((a, b) => b.llamadas - a.llamadas);
  return [...acc.values()].sort((a, b) => b.costoUSD - a.costoUSD);
}

/** Mismo resumen, pero armado a mano cuando la agregación no existe. */
function resumenDesdeFilas(filas: FilaUso[]): ResumenAgente[] {
  const acc = new Map<string, ResumenAgente & { porModelo: Map<string, number> }>();
  for (const f of filas) {
    const prev =
      acc.get(f.agente) ??
      {
        agente: f.agente,
        llamadas: 0,
        tokensInput: 0,
        tokensOutput: 0,
        costoUSD: 0,
        costoCRC: 0,
        fallidas: 0,
        modelos: [] as { modelo: string; llamadas: number }[],
        porModelo: new Map<string, number>(),
      };
    prev.llamadas += 1;
    prev.tokensInput += f.tokensInput;
    prev.tokensOutput += f.tokensOutput;
    prev.costoUSD += f.costoUSD;
    prev.costoCRC += f.costoCRC;
    if (!f.exito) prev.fallidas += 1;
    prev.porModelo.set(f.modelo, (prev.porModelo.get(f.modelo) ?? 0) + 1);
    acc.set(f.agente, prev);
  }
  return [...acc.values()]
    .map((r) => ({
      agente: r.agente,
      llamadas: r.llamadas,
      tokensInput: r.tokensInput,
      tokensOutput: r.tokensOutput,
      costoUSD: r.costoUSD,
      costoCRC: r.costoCRC,
      fallidas: r.fallidas,
      modelos: [...r.porModelo.entries()]
        .map(([modelo, llamadas]) => ({ modelo, llamadas }))
        .sort((a, b) => b.llamadas - a.llamadas),
    }))
    .sort((a, b) => b.costoUSD - a.costoUSD);
}

function porDiaDesdeFilas(filas: FilaUso[]): ResumenDia[] {
  const acc = new Map<string, ResumenDia>();
  for (const f of filas) {
    const dia = diaCR(f.creado);
    const prev =
      acc.get(dia) ??
      { dia, llamadas: 0, tokensInput: 0, tokensOutput: 0, costoUSD: 0, costoCRC: 0 };
    prev.llamadas += 1;
    prev.tokensInput += f.tokensInput;
    prev.tokensOutput += f.tokensOutput;
    prev.costoUSD += f.costoUSD;
    prev.costoCRC += f.costoCRC;
    acc.set(dia, prev);
  }
  return [...acc.values()].sort((a, b) => (a.dia < b.dia ? 1 : -1));
}

/** Lectura acotada de uso_ia: solo para el detalle y para el respaldo. */
async function leerFilas(
  db: ClienteAdmin,
  desdeISO: string,
  hastaISO: string,
  tope: number,
) {
  return db
    .from("uso_ia")
    .select(COLUMNAS_USO)
    .gte("created_at", desdeISO)
    .lt("created_at", hastaISO)
    .order("created_at", { ascending: false })
    .limit(tope);
}

/**
 * Panel de IA: lo que gastan los modelos, con cuál trabaja cada agente
 * y qué sabe el asistente de cada negocio.
 *
 * Se lee con la llave de servicio (uso_ia solo la ve el admin por RLS,
 * pero el mismo patrón del panel de invitaciones evita depender de que
 * la sesión del navegador tenga rol admin en cada consulta).
 */
export default async function AdminIaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[];
    desde?: string | string[];
    hasta?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const tab = unSolo(params.tab);
  const hoy = hoyCR();
  // El instante con el que se resuelven los precios de lanzamiento. Se
  // fija acá, en el servidor, y baja al panel como texto ISO: si el
  // componente de cliente llamara a new Date() por su cuenta, el día que
  // vence una promo (Sonnet 5, 31/08/2026) el servidor y el navegador
  // podrían quedar de lados distintos del vencimiento y React marcaría
  // mismatch de hidratación.
  const fechaPrecios = new Date().toISOString();
  const desdeParam = unSolo(params.desde);
  const hastaParam = unSolo(params.hasta);
  // Por defecto, el mes corriente EN HORA DE COSTA RICA: es exactamente
  // el mismo mes que suma gastoDelMesUSD() y contra el que se compara el
  // tope. Si uno se calculara en UTC y el otro en hora tica, la tarjeta
  // del encabezado y la tabla se contradirían las primeras seis horas
  // del día 1 de cada mes.
  const primeroDelMesCR = `${hoy.slice(0, 7)}-01`;
  const desde = esFecha(desdeParam) ? desdeParam : primeroDelMesCR;
  const hasta = esFecha(hastaParam) ? hastaParam : hoy;

  const admin = createAdminClient();

  if (!admin) {
    return (
      <div>
        <Encabezado />
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{FALTA_SERVICE_KEY}</p>
      </div>
    );
  }

  const rangoDesdeISO = inicioDelDiaCR(desde);
  const rangoHastaISO = inicioDelDiaCR(sumarDias(hasta, 1));
  const consumoDesdeISO = inicioDelDiaCR(sumarDias(hoy, -(DIAS_CONSUMO - 1)));
  const consumoHastaISO = inicioDelDiaCR(sumarDias(hoy, 1));
  const mesDesdeISO = inicioDelDiaCR(primeroDelMesCR);
  const mesHastaISO = inicioDelDiaCR(sumarDias(hoy, 1));
  const rangoEsElMesCorriente = desde === primeroDelMesCR && hasta === hoy;

  const [
    config,
    gastoMesUSD,
    resumenRes,
    porDiaRes,
    detalleRes,
    consumoRes,
    ranchosRes,
    conocimientoRes,
  ] = await Promise.all([
    leerConfigIA(),
    gastoDelMesUSD(),
    // Los totales se suman en Postgres: traer filas y contarlas volvía
    // "N llamadas" y "Costo total" un número inventado apenas el periodo
    // pasaba del techo de filas.
    admin.rpc("gasto_ia_resumen", { p_desde: rangoDesdeISO, p_hasta: rangoHastaISO }),
    admin.rpc("gasto_ia_por_dia", { p_desde: rangoDesdeISO, p_hasta: rangoHastaISO }),
    leerFilas(admin, rangoDesdeISO, rangoHastaISO, MAX_DETALLE),
    admin.rpc("gasto_ia_resumen", { p_desde: consumoDesdeISO, p_hasta: consumoHastaISO }),
    // Las dos columnas del asistente llegan con la 0078: si todavía no
    // corrió, más abajo se reintenta sin ellas y el panel lo dice.
    admin
      .from("ranchos")
      .select("id, nombre, vertical, asistente_activo, asistente_instrucciones")
      .order("nombre"),
    admin
      .from("conocimiento_negocio")
      .select("id, rancho_id, pregunta, respuesta, activo, orden")
      .order("orden"),
  ]);

  let ranchosData = (ranchosRes.data ?? []) as FilaRanchoDb[];
  const faltaColumnaAsistente = !!ranchosRes.error;
  if (faltaColumnaAsistente) {
    const alterno = await admin.from("ranchos").select("id, nombre, vertical").order("nombre");
    ranchosData = (alterno.data ?? []) as FilaRanchoDb[];
  }

  const faltaBitacora = !!detalleRes.error;
  const totalesAgregados = !resumenRes.error && !porDiaRes.error;
  // Solo hay algo que truncar si la bitácora existe pero las funciones
  // de agregación no: ahí sí los totales salen de filas acotadas.
  const totalesTruncados = !totalesAgregados && !faltaBitacora;

  const filas = mapearFilas(detalleRes.data, config.tipoCambio);

  let resumenAgentes: ResumenAgente[];
  let porDia: ResumenDia[];
  if (totalesAgregados) {
    resumenAgentes = agruparPorAgente((resumenRes.data ?? []) as FilaResumenDb[]);
    porDia = ((porDiaRes.data ?? []) as FilaPorDiaDb[])
      .map((d) => ({
        dia: String(d.dia).slice(0, 10),
        llamadas: num(d.llamadas),
        tokensInput: num(d.tokens_input),
        tokensOutput: num(d.tokens_output),
        costoUSD: num(d.costo_usd),
        costoCRC: num(d.costo_crc),
      }))
      .sort((a, b) => (a.dia < b.dia ? 1 : -1));
  } else {
    const respaldo = faltaBitacora
      ? []
      : mapearFilas(
          (await leerFilas(admin, rangoDesdeISO, rangoHastaISO, MAX_RESPALDO)).data,
          config.tipoCambio,
        );
    resumenAgentes = resumenDesdeFilas(respaldo);
    porDia = porDiaDesdeFilas(respaldo);
  }

  // El total del mes en colones sale de lo asentado (costo_crc congela
  // el tipo de cambio de cada llamada). Solo si no se puede agregar se
  // cae a multiplicar por el tipo de cambio de hoy, y se avisa.
  let gastoMesCRC = gastoMesUSD * config.tipoCambio;
  let mesCRCAproximado = true;
  if (rangoEsElMesCorriente && totalesAgregados) {
    gastoMesCRC = resumenAgentes.reduce((t, a) => t + a.costoCRC, 0);
    mesCRCAproximado = false;
  } else if (!faltaBitacora) {
    const mesRes = await admin.rpc("gasto_ia_resumen", {
      p_desde: mesDesdeISO,
      p_hasta: mesHastaISO,
    });
    if (!mesRes.error) {
      gastoMesCRC = ((mesRes.data ?? []) as FilaResumenDb[]).reduce(
        (t, f) => t + num(f.costo_crc),
        0,
      );
      mesCRCAproximado = false;
    }
  }

  // El consumo de los últimos 30 días, agregado por agente: es lo que
  // hace comparable un modelo contra otro con plata real. El costo que
  // se muestra como historia es el asentado, no uno recalculado.
  const consumoAgregado = !consumoRes.error;
  const filasConsumo = consumoAgregado
    ? agruparPorAgente((consumoRes.data ?? []) as FilaResumenDb[])
    : resumenDesdeFilas(
        faltaBitacora
          ? []
          : mapearFilas(
              (await leerFilas(admin, consumoDesdeISO, consumoHastaISO, MAX_RESPALDO)).data,
              config.tipoCambio,
            ),
      );

  const consumo = Object.fromEntries(
    AGENTES.map((a) => [
      a.id,
      {
        llamadas: 0,
        tokensInput: 0,
        tokensOutput: 0,
        costoUSD: 0,
        costoCRC: 0,
        modelos: [] as { modelo: string; llamadas: number }[],
      },
    ]),
  ) as Record<AgenteIA, ConsumoAgente>;
  for (const r of filasConsumo) {
    const acumulado = consumo[r.agente as AgenteIA];
    if (!acumulado) continue;
    acumulado.llamadas = r.llamadas;
    acumulado.tokensInput = r.tokensInput;
    acumulado.tokensOutput = r.tokensOutput;
    acumulado.costoUSD = r.costoUSD;
    acumulado.costoCRC = r.costoCRC;
    acumulado.modelos = r.modelos;
  }

  const negocios: NegocioIA[] = ranchosData.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    vertical: r.vertical ?? null,
    asistenteActivo: r.asistente_activo ?? null,
    instrucciones: r.asistente_instrucciones ?? "",
  }));

  const conocimiento: FilaConocimiento[] = (
    (conocimientoRes.data ?? []) as FilaConocimientoDb[]
  ).map((c) => ({
    id: c.id,
    ranchoId: c.rancho_id,
    pregunta: c.pregunta,
    respuesta: c.respuesta,
    activo: c.activo !== false,
    orden: Number(c.orden ?? 0),
  }));

  const faltaMigracion = faltaColumnaAsistente || !!conocimientoRes.error;

  return (
    <div>
      <Encabezado />

      {faltaBitacora && (
        <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no existe la bitácora de uso: corré la migración{" "}
          <strong>0078_panel_ia.sql</strong> en Supabase y el gasto empieza a
          registrarse solo. Mientras tanto, los modelos siguen trabajando con la
          configuración por defecto.
        </p>
      )}

      <IaTabs
        inicial={esTabIA(tab) ? tab : "gasto"}
        gasto={
          <GastoPanel
            resumenAgentes={resumenAgentes}
            porDia={porDia}
            filas={filas}
            maxDetalle={MAX_DETALLE}
            desde={desde}
            hasta={hasta}
            tipoCambio={config.tipoCambio}
            gastoMesUSD={gastoMesUSD}
            gastoMesCRC={gastoMesCRC}
            mesCRCAproximado={mesCRCAproximado}
            topeMensualUSD={config.topeMensualUSD}
            totalesTruncados={totalesTruncados}
            maxRespaldo={MAX_RESPALDO}
          />
        }
        modelos={
          <ModelosPanel
            config={config}
            consumo={consumo}
            diasConsumo={DIAS_CONSUMO}
            consumoAproximado={!consumoAgregado && !faltaBitacora}
            maxRespaldo={MAX_RESPALDO}
            fechaISO={fechaPrecios}
          />
        }
        conocimiento={
          <ConocimientoPanel
            negocios={negocios}
            filas={conocimiento}
            faltaMigracion={faltaMigracion}
          />
        }
      />
    </div>
  );
}

function Encabezado() {
  return (
    <div className="mb-6">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">Inteligencia artificial</h1>
      <p className="mt-1 max-w-[74ch] text-[13.5px] text-aventurea-ink-soft">
        Cuánto cuesta la IA, con qué modelo trabaja cada parte del producto y
        qué sabe el asistente de cada negocio. Es transversal a todas las
        secciones: lo que se configure acá aplica a la plataforma entera.
      </p>
    </div>
  );
}
