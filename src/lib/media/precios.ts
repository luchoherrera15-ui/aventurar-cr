/**
 * BOOKEA MEDIA — qué cuesta guardar y servir un archivo.
 *
 * ── ESTO SON PRECIOS DE LISTA, NO TU FACTURA ─────────────────────────
 *
 * Los números de abajo son los precios públicos de Cloudflare y Supabase
 * al 2026-08. NO son una lectura de tu cuenta: no hay forma de que este
 * archivo sepa qué plan tenés, qué descuento negociaste ni qué cuota
 * incluida te queda. Sirven para estimar de dónde sale la plata y para
 * comparar Supabase contra Cloudflare — que es la decisión que hay que
 * tomar.
 *
 * Por eso TODOS son ajustables por variable de entorno, y la pantalla
 * MUESTRA el precio que usó para cada cuenta. Si tu factura dice otra
 * cosa, se corrige la variable y los números se acomodan solos, sin
 * tocar código.
 *
 * ── LA LÍNEA QUE IMPORTA ─────────────────────────────────────────────
 *
 * R2 no cobra egress. Cero. Ese es el renglón que hoy paga Supabase por
 * cada foto que baja la app móvil, y es la razón entera de la
 * migración. Está declarado explícito abajo, con su cero, para que se
 * vea en la comparación en vez de quedar como una ausencia.
 *
 * Módulo puro: sin red, sin base, sin secretos.
 */

/** Cuándo se copiaron estos precios de las páginas públicas. */
export const PRECIOS_AL = "2026-08";

const GB = 1024 ** 3;

export type Precios = {
  /** USD por GB-mes guardado en R2. */
  r2AlmacenamientoGbMes: number;
  /** USD por millón de operaciones de escritura/listado (Class A). */
  r2ClaseAMillon: number;
  /** USD por millón de operaciones de lectura (Class B). */
  r2ClaseBMillon: number;
  /**
   * USD por GB servido desde R2 a internet.
   *
   * Es CERO y no es un olvido: R2 no cobra salida. Está acá para que la
   * comparación contra Supabase lo muestre en vez de omitirlo.
   */
  r2EgressGb: number;
  /** USD por cada 100 000 imágenes guardadas en Cloudflare Images, al mes. */
  imagenesGuardadas100k: number;
  /** USD por cada 100 000 imágenes entregadas por Cloudflare Images. */
  imagenesEntregadas100k: number;
  /** USD por GB-mes guardado en Supabase Storage. */
  supabaseAlmacenamientoGbMes: number;
  /** USD por GB servido desde Supabase. El renglón que hay que matar. */
  supabaseEgressGb: number;
  /** Colones por dólar, para mostrar en las dos monedas. */
  tipoCambio: number;
};

/**
 * Los precios de lista. Cada uno con la variable que lo pisa.
 *
 * Se separan del `Precios` resuelto a propósito: la pantalla necesita
 * poder decir "usé 0,015 porque nadie configuró PRECIO_R2_GB_MES", y
 * para eso hace falta saber cuál es el default.
 */
export const PRECIOS_LISTA: Omit<Precios, "tipoCambio"> = {
  r2AlmacenamientoGbMes: 0.015,
  r2ClaseAMillon: 4.5,
  r2ClaseBMillon: 0.36,
  r2EgressGb: 0,
  imagenesGuardadas100k: 5,
  imagenesEntregadas100k: 1,
  supabaseAlmacenamientoGbMes: 0.021,
  supabaseEgressGb: 0.09,
};

/** El tipo de cambio por defecto, el mismo que ya usa el panel de IA. */
export const TIPO_CAMBIO_POR_DEFECTO = 520;

type ClavePrecio = keyof typeof PRECIOS_LISTA;

/** Qué variable de entorno pisa cada precio. */
export const VARIABLE_DE_PRECIO: Record<ClavePrecio, string> = {
  r2AlmacenamientoGbMes: "PRECIO_R2_GB_MES",
  r2ClaseAMillon: "PRECIO_R2_CLASE_A_MILLON",
  r2ClaseBMillon: "PRECIO_R2_CLASE_B_MILLON",
  r2EgressGb: "PRECIO_R2_EGRESS_GB",
  imagenesGuardadas100k: "PRECIO_CF_IMAGENES_GUARDADAS_100K",
  imagenesEntregadas100k: "PRECIO_CF_IMAGENES_ENTREGADAS_100K",
  supabaseAlmacenamientoGbMes: "PRECIO_SUPABASE_GB_MES",
  supabaseEgressGb: "PRECIO_SUPABASE_EGRESS_GB",
};

/**
 * Un número del entorno, o el de lista.
 *
 * Se acepta el CERO explícito (por eso no alcanza con `||`): un precio
 * de cero es un valor legítimo —R2 egress lo es— y descartarlo por
 * falsy sería reemplazarlo en silencio por el de lista.
 *
 * Un valor negativo o no numérico se IGNORA en vez de propagarse: un
 * typo en una variable de Vercel no debería producir una factura
 * negativa en la pantalla.
 */
function numeroDe(entorno: NodeJS.ProcessEnv, variable: string, porDefecto: number): number {
  const crudo = entorno[variable];
  if (crudo === undefined || crudo.trim() === "") return porDefecto;
  const v = Number(crudo);
  return Number.isFinite(v) && v >= 0 ? v : porDefecto;
}

export function precios(entorno: NodeJS.ProcessEnv = process.env): Precios {
  const salida = {} as Precios;
  for (const clave of Object.keys(PRECIOS_LISTA) as ClavePrecio[]) {
    salida[clave] = numeroDe(entorno, VARIABLE_DE_PRECIO[clave], PRECIOS_LISTA[clave]);
  }
  salida.tipoCambio = numeroDe(entorno, "TIPO_CAMBIO_USD", TIPO_CAMBIO_POR_DEFECTO);
  // Un tipo de cambio de cero convertiría toda la factura en ₡0.
  if (salida.tipoCambio <= 0) salida.tipoCambio = TIPO_CAMBIO_POR_DEFECTO;
  return salida;
}

/** Qué precios están pisados por el entorno, para poder mostrarlo. */
export function preciosAjustados(entorno: NodeJS.ProcessEnv = process.env): ClavePrecio[] {
  return (Object.keys(PRECIOS_LISTA) as ClavePrecio[]).filter((c) => {
    const crudo = entorno[VARIABLE_DE_PRECIO[c]];
    if (crudo === undefined || crudo.trim() === "") return false;
    const v = Number(crudo);
    return Number.isFinite(v) && v >= 0 && v !== PRECIOS_LISTA[c];
  });
}

// ------------------------------------------------------------
// El cálculo
// ------------------------------------------------------------

/**
 * Lo que cuesta un conjunto de archivos por mes, renglón por renglón.
 *
 * Cada campo se guarda por separado —no un total y listo— porque la
 * pregunta que hay que responder no es "cuánto pago" sino "de dónde
 * sale". Un álbum caro por almacenamiento y uno caro por entrega piden
 * decisiones distintas.
 */
export type Costo = {
  almacenamientoUSD: number;
  entregaUSD: number;
  operacionesUSD: number;
  totalUSD: number;
  totalCRC: number;
};

const cero = (): Costo => ({
  almacenamientoUSD: 0,
  entregaUSD: 0,
  operacionesUSD: 0,
  totalUSD: 0,
  totalCRC: 0,
});

function cerrar(c: Omit<Costo, "totalUSD" | "totalCRC">, tipoCambio: number): Costo {
  const totalUSD = c.almacenamientoUSD + c.entregaUSD + c.operacionesUSD;
  return { ...c, totalUSD, totalCRC: totalUSD * tipoCambio };
}

/**
 * Lo que cuesta AL MES tener esto en Cloudflare.
 *
 * `entregas` son entregas de Cloudflare Images. `bytesServidos` no
 * aparece porque no se cobra: R2 no tiene egress y ese es todo el
 * punto.
 */
export function costoCloudflare(
  uso: { bytes: number; imagenes: number; entregas: number; operacionesLectura?: number },
  p: Precios,
): Costo {
  if (uso.bytes <= 0 && uso.imagenes <= 0 && uso.entregas <= 0) return cero();
  return cerrar(
    {
      almacenamientoUSD:
        (uso.bytes / GB) * p.r2AlmacenamientoGbMes +
        (uso.imagenes / 100_000) * p.imagenesGuardadas100k,
      entregaUSD: (uso.entregas / 100_000) * p.imagenesEntregadas100k,
      operacionesUSD: ((uso.operacionesLectura ?? 0) / 1_000_000) * p.r2ClaseBMillon,
    },
    p.tipoCambio,
  );
}

/**
 * Lo mismo en Supabase, que es contra lo que hay que compararlo.
 *
 * Acá SÍ pesa el egress, y por eso el número no se parece al de arriba.
 * `bytesServidos` es lo que bajó la gente en el mes.
 */
export function costoSupabase(
  uso: { bytes: number; bytesServidos: number },
  p: Precios,
): Costo {
  if (uso.bytes <= 0 && uso.bytesServidos <= 0) return cero();
  return cerrar(
    {
      almacenamientoUSD: (uso.bytes / GB) * p.supabaseAlmacenamientoGbMes,
      entregaUSD: (uso.bytesServidos / GB) * p.supabaseEgressGb,
      operacionesUSD: 0,
    },
    p.tipoCambio,
  );
}

/**
 * Cuánto se ahorra migrando esto, y de dónde sale el ahorro.
 *
 * Se devuelve el desglose y no solo el total: casi siempre el
 * almacenamiento cuesta PARECIDO en los dos lados y la diferencia entera
 * está en la entrega. Mostrar un único número escondería eso.
 */
export function ahorro(actual: Costo, nuevo: Costo, p: Precios) {
  const usd = actual.totalUSD - nuevo.totalUSD;
  return {
    usd,
    crc: usd * p.tipoCambio,
    porEntregaUSD: actual.entregaUSD - nuevo.entregaUSD,
    porAlmacenamientoUSD: actual.almacenamientoUSD - nuevo.almacenamientoUSD,
    porcentaje: actual.totalUSD > 0 ? (usd / actual.totalUSD) * 100 : 0,
  };
}

// ------------------------------------------------------------
// Presentación
//
// El formato vive en `src/lib/dinero.ts`, compartido con el panel de
// IA. Se reexporta acá para que quien importe `precios` tenga todo a
// mano sin acordarse de dos módulos — pero la implementación es UNA.
// ------------------------------------------------------------

export { formatearAmbas, formatearBytes, formatearCRC, formatearUSD } from "@/lib/dinero";
