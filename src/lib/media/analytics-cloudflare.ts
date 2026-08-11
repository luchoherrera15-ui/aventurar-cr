/**
 * BOOKEA MEDIA — cuánto sirvió Cloudflare de verdad.
 *
 * ⚠️ Server-only: usa un API token.
 *
 * ── LO QUE ESTA API PUEDE Y LO QUE NO ────────────────────────────────
 *
 * Cloudflare cobra Images por imagen ENTREGADA, y ese número no está en
 * nuestra base: lo sabe solo Cloudflare. Acá se le pregunta por su API
 * GraphQL de analítica.
 *
 * Lo que devuelve es un TOTAL DE LA CUENTA. No dice de qué álbum fue
 * cada entrega, y no hay forma de que lo diga: su dataset se agrupa por
 * dimensiones suyas (país, estado HTTP, variante), no por nuestras
 * entidades. Repartir ese total por álbum es una estimación nuestra y se
 * hace en `auditoria.ts`, marcada como tal. Acá solo se trae el dato
 * real.
 *
 * ── FALLA BLANDA, SIEMPRE ────────────────────────────────────────────
 *
 * Esta consulta alimenta UNA pantalla de administración. Si el token
 * falta, si Cloudflare no responde o si algún día le cambian el nombre a
 * un dataset, la pantalla tiene que seguir mostrando todo lo que SÍ
 * sabemos —que es la mayor parte, porque el almacenamiento lo medimos
 * nosotros— y avisar qué renglón no se pudo leer. Nunca romperse.
 *
 * Por eso cada consulta va por separado y su fallo no arrastra a las
 * otras: se devuelve `parcial` con lo que faltó.
 *
 * ⚠️ NOMBRES DE DATASET SIN VERIFICAR CONTRA LA CUENTA REAL. Los de
 *    abajo son los que documenta Cloudflare, pero no se pudieron probar
 *    sin credenciales (este bloque corrió sin red). La primera vez que
 *    se abra la pantalla con el token puesto hay que confirmar que los
 *    tres renglones traen número; si alguno viene en `parcial`, el
 *    nombre del dataset es lo primero que hay que revisar.
 */

import "server-only";

const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
const TIMEOUT_MS = 12_000;

export type ConsumoCloudflare = {
  /** Imágenes servidas por Cloudflare Images en la ventana. */
  imagenesEntregadas: number | null;
  /** Operaciones de lectura sobre R2 (Class B). */
  operacionesLecturaR2: number | null;
  /** Bytes guardados en R2, según Cloudflare y no según nuestra suma. */
  bytesR2: number | null;
  /** Objetos en R2, ídem. */
  objetosR2: number | null;
  desde: string;
  hasta: string;
};

export type ResultadoAnalytics =
  | {
      disponible: true;
      consumo: ConsumoCloudflare;
      /** Qué renglones NO se pudieron leer, para decirlo en pantalla. */
      parcial: string[];
    }
  | { disponible: false; motivo: string };

export type DependenciasAnalytics = {
  fetch?: typeof fetch;
  entorno?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Para fijar la ventana en los tests sin depender del reloj. */
  ahora?: Date;
};

/**
 * El token.
 *
 * Necesita permiso **Analytics:Read** a nivel de cuenta, que NO viene
 * con el token de Images. Se busca uno propio y se cae al de Images por
 * comodidad: si ese no tiene el permiso, Cloudflare responde un error de
 * autorización y la pantalla lo muestra como renglón faltante en vez de
 * romperse.
 */
function token(entorno: NodeJS.ProcessEnv): string | null {
  const t =
    entorno.CLOUDFLARE_ANALYTICS_API_TOKEN?.trim() ||
    entorno.CLOUDFLARE_IMAGES_API_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

/** `YYYY-MM-DD`, que es lo que piden los filtros de fecha del dataset. */
function dia(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Consulta = { nombre: string; query: string };

/**
 * Las tres consultas, separadas a propósito.
 *
 * Juntarlas en un solo documento GraphQL sería una llamada menos, pero
 * un dataset inexistente invalidaría el documento ENTERO y perderíamos
 * también los renglones que sí funcionan. Tres llamadas que fallan
 * independientes valen más que una que falla del todo.
 */
function consultas(cuenta: string, desde: string, hasta: string): Consulta[] {
  const filtro = `filter: { date_geq: "${desde}", date_leq: "${hasta}" }`;
  const enCuenta = (cuerpo: string) => `
    { viewer { accounts(filter: { accountTag: "${cuenta}" }) { ${cuerpo} } } }
  `;
  return [
    {
      nombre: "imágenes entregadas",
      query: enCuenta(`imagesRequestsAdaptiveGroups(limit: 1, ${filtro}) { sum { requests } }`),
    },
    {
      nombre: "operaciones de R2",
      query: enCuenta(`r2OperationsAdaptiveGroups(limit: 100, ${filtro}) {
        sum { requests } dimensions { actionType }
      }`),
    },
    {
      nombre: "almacenamiento de R2",
      query: enCuenta(`r2StorageAdaptiveGroups(limit: 1, ${filtro}) {
        max { payloadSize objectCount }
      }`),
    },
  ];
}

/** Busca recursivamente el primer número bajo una clave dada. */
function buscarNumero(nodo: unknown, clave: string): number | null {
  if (typeof nodo !== "object" || nodo === null) return null;
  if (Array.isArray(nodo)) {
    for (const x of nodo) {
      const r = buscarNumero(x, clave);
      if (r !== null) return r;
    }
    return null;
  }
  const obj = nodo as Record<string, unknown>;
  if (typeof obj[clave] === "number") return obj[clave] as number;
  for (const v of Object.values(obj)) {
    const r = buscarNumero(v, clave);
    if (r !== null) return r;
  }
  return null;
}

/** Suma TODOS los números bajo una clave (para agrupaciones por dimensión). */
function sumarNumeros(nodo: unknown, clave: string): number | null {
  let total: number | null = null;
  const recorrer = (n: unknown) => {
    if (typeof n !== "object" || n === null) return;
    if (Array.isArray(n)) return n.forEach(recorrer);
    const obj = n as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (k === clave && typeof v === "number") total = (total ?? 0) + v;
      else recorrer(v);
    }
  };
  recorrer(nodo);
  return total;
}

/**
 * Trae el consumo real de la cuenta.
 *
 * La ventana por defecto son 30 días, que es el período que factura
 * Cloudflare y el que hace comparables estos números con la factura.
 */
export async function consumoCloudflare(
  deps: DependenciasAnalytics = {},
): Promise<ResultadoAnalytics> {
  const entorno = deps.entorno ?? process.env;
  const cuenta = entorno.CLOUDFLARE_ACCOUNT_ID?.trim();
  const bearer = token(entorno);

  if (!cuenta || !bearer) {
    return {
      disponible: false,
      motivo:
        "Falta CLOUDFLARE_ACCOUNT_ID o un token con permiso Analytics:Read " +
        "(CLOUDFLARE_ANALYTICS_API_TOKEN).",
    };
  }

  const ahora = deps.ahora ?? new Date();
  const hasta = dia(ahora);
  const desde = dia(new Date(ahora.getTime() - 30 * 24 * 3600 * 1000));

  const hacerFetch = deps.fetch ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_MS;

  const consumo: ConsumoCloudflare = {
    imagenesEntregadas: null,
    operacionesLecturaR2: null,
    bytesR2: null,
    objetosR2: null,
    desde,
    hasta,
  };
  const parcial: string[] = [];

  for (const c of consultas(cuenta, desde, hasta)) {
    let datos: unknown;
    try {
      const respuesta = await hacerFetch(GRAPHQL, {
        method: "POST",
        headers: {
          // El token va acá y no aparece en ningún mensaje de error.
          Authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query: c.query }),
        signal: AbortSignal.timeout(timeout),
      });
      datos = await respuesta.json();
    } catch (e) {
      const nombre = e instanceof Error ? e.name : "ErrorDesconocido";
      parcial.push(`${c.nombre} (${nombre === "TimeoutError" ? "sin respuesta" : "fallo de red"})`);
      continue;
    }

    // GraphQL responde 200 con `errors` adentro: un `ok` no alcanza.
    const errores = (datos as { errors?: unknown })?.errors;
    if (Array.isArray(errores) && errores.length > 0) {
      parcial.push(`${c.nombre} (rechazado por Cloudflare)`);
      continue;
    }

    if (c.nombre === "imágenes entregadas") {
      consumo.imagenesEntregadas = buscarNumero(datos, "requests");
      if (consumo.imagenesEntregadas === null) parcial.push(`${c.nombre} (sin dato)`);
    } else if (c.nombre === "operaciones de R2") {
      consumo.operacionesLecturaR2 = sumarNumeros(datos, "requests");
      if (consumo.operacionesLecturaR2 === null) parcial.push(`${c.nombre} (sin dato)`);
    } else {
      consumo.bytesR2 = buscarNumero(datos, "payloadSize");
      consumo.objetosR2 = buscarNumero(datos, "objectCount");
      if (consumo.bytesR2 === null) parcial.push(`${c.nombre} (sin dato)`);
    }
  }

  return { disponible: true, consumo, parcial };
}
