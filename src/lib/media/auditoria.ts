/**
 * BOOKEA MEDIA — de dónde sale la plata, por álbum y por invitación.
 *
 * Junta tres cosas de calidad muy distinta, y el punto de este módulo es
 * que esa diferencia NO se pierda por el camino:
 *
 *   1. LO QUE MEDIMOS EXACTO. Bytes guardados e imágenes almacenadas,
 *      por entidad. Sale de nuestra base. Es un dato.
 *
 *   2. LO QUE MIDE CLOUDFLARE. Cuántas imágenes entregó en el mes. Es un
 *      dato real, pero DE LA CUENTA ENTERA: su analítica no se agrupa
 *      por nuestros álbumes y nunca va a hacerlo.
 *
 *   3. EL REPARTO DE (2) ENTRE LAS ENTIDADES. Eso es una ESTIMACIÓN
 *      nuestra. No es medición y no se muestra como tal.
 *
 * Cada fila sale de acá diciendo en qué se apoya. Una pantalla de costos
 * que mezcla los tres niveles sin distinguirlos es peor que no tenerla:
 * lleva a decidir con una precisión que no existe.
 *
 * Módulo puro: sin red, sin base, sin secretos.
 */

import { costoCloudflare, costoSupabase, type Costo, type Precios } from "./precios";

// ------------------------------------------------------------
// Lo que entra
// ------------------------------------------------------------

/** Una fila de `media_uso_detalle` (migración 0115). */
export type FilaUso = {
  entityType: string;
  entityId: string;
  nombre: string;
  archivos: number;
  bytes: number;
  imagenesCf: number;
  /**
   * Visitas de los últimos 30 días, o `null` si esa entidad NO tiene
   * contador.
   *
   * `null` y `0` significan cosas opuestas —"no lo estamos midiendo" y
   * "no lo vio nadie"— y confundirlos haría que un álbum sin contador se
   * viera como un álbum que nadie abrió. Hoy solo los ranchos tienen
   * `visitas_pagina` (0107).
   */
  visitas30d: number | null;
};

/** Una fila de `almacenamiento_por_album` (lo que hoy pesa en Supabase). */
export type FilaAlbumLegacy = {
  albumId: string;
  titulo: string;
  slug: string;
  archivos: number;
  bytes: number;
  migradas: number;
};

// ------------------------------------------------------------
// Lo que sale
// ------------------------------------------------------------

/**
 * En qué se apoya el número de entregas de una fila.
 *
 *   trafico-medido  se ajustó con las visitas REALES de esa entidad;
 *   proporcional    se repartió por imágenes guardadas, sin tráfico;
 *   sin-datos       Cloudflare no dio el total: no hay nada que repartir.
 */
export type BaseDelReparto = "trafico-medido" | "proporcional" | "sin-datos";

export type FilaAuditada = FilaUso & {
  entregasEstimadas: number | null;
  baseDelReparto: BaseDelReparto;
  costo: Costo;
};

/**
 * Reparte el total REAL de entregas de Cloudflare entre las entidades.
 *
 * ── CÓMO, Y POR QUÉ ASÍ ──────────────────────────────────────────────
 *
 * El peso base de cada fila son sus IMÁGENES GUARDADAS. Es la única
 * magnitud que existe para todas por igual, así que es la que hace
 * comparables un álbum y un negocio.
 *
 * Encima, las filas que SÍ tienen visitas medidas llevan un factor
 * relativo: sus visitas divididas por el promedio de visitas de las
 * filas medidas. Ese factor es ADIMENSIONAL y está centrado en 1, que es
 * lo que permite mezclar filas medidas con filas sin medir sin cambiar
 * de escala: un negocio con el doble de tráfico que el promedio pesa el
 * doble que otro del mismo tamaño, y una fila sin contador pesa como si
 * tuviera tráfico promedio.
 *
 * La tentación era usar `visitas × imágenes` para las medidas e
 * `imágenes` para el resto. Eso está mal y no es un detalle: son dos
 * unidades distintas sumadas en la misma normalización, así que el
 * reparto cambiaría solo con que alguien empiece a contar visitas de
 * álbumes. Un número que se mueve por cómo medimos y no por lo que pasa
 * no sirve para decidir nada.
 *
 * Sin ningún dato de tráfico, esto degrada a un reparto proporcional
 * puro — que es exactamente lo que hay que hacer cuando no se sabe más.
 */
export function repartirEntregas(
  filas: FilaUso[],
  entregasTotales: number | null,
): Map<string, { entregas: number | null; base: BaseDelReparto }> {
  const salida = new Map<string, { entregas: number | null; base: BaseDelReparto }>();

  if (entregasTotales === null || entregasTotales <= 0 || filas.length === 0) {
    for (const f of filas) salida.set(f.entityId, { entregas: null, base: "sin-datos" });
    return salida;
  }

  const medidas = filas.filter((f) => f.visitas30d !== null && f.imagenesCf > 0);
  const promedioVisitas =
    medidas.length > 0
      ? medidas.reduce((s, f) => s + (f.visitas30d ?? 0), 0) / medidas.length
      : 0;

  const peso = (f: FilaUso): number => {
    const base = f.imagenesCf;
    if (base <= 0) return 0;
    // Sin promedio útil, nadie lleva ajuste: reparto proporcional puro.
    if (f.visitas30d === null || promedioVisitas <= 0) return base;
    return base * ((f.visitas30d ?? 0) / promedioVisitas);
  };

  const pesos = filas.map(peso);
  const total = pesos.reduce((s, p) => s + p, 0);

  filas.forEach((f, i) => {
    if (total <= 0 || pesos[i] <= 0) {
      salida.set(f.entityId, { entregas: 0, base: "proporcional" });
      return;
    }
    salida.set(f.entityId, {
      entregas: Math.round((pesos[i] / total) * entregasTotales),
      base:
        f.visitas30d !== null && promedioVisitas > 0 ? "trafico-medido" : "proporcional",
    });
  });

  return salida;
}

/** Cada fila con su reparto y su costo mensual en Cloudflare. */
export function auditar(
  filas: FilaUso[],
  entregasTotales: number | null,
  p: Precios,
): FilaAuditada[] {
  const reparto = repartirEntregas(filas, entregasTotales);
  return filas
    .map((f) => {
      const r = reparto.get(f.entityId) ?? { entregas: null, base: "sin-datos" as const };
      return {
        ...f,
        entregasEstimadas: r.entregas,
        baseDelReparto: r.base,
        costo: costoCloudflare(
          { bytes: f.bytes, imagenes: f.imagenesCf, entregas: r.entregas ?? 0 },
          p,
        ),
      };
    })
    .sort((a, b) => b.costo.totalUSD - a.costo.totalUSD);
}

// ------------------------------------------------------------
// La comparación que justifica la migración
// ------------------------------------------------------------

export type Comparacion = {
  supabase: Costo;
  cloudflare: Costo;
  ahorroUSD: number;
  ahorroCRC: number;
  ahorroPorcentaje: number;
  /** El renglón que explica casi todo el ahorro. */
  ahorroPorEgresoUSD: number;
};

/**
 * Qué costaría al mes lo mismo en un lado y en el otro.
 *
 * `bytesServidosSupabase` es lo que hoy baja la gente. Es el número que
 * duele: en Supabase se cobra por giga servido y en R2 vale CERO, así
 * que casi todo el ahorro sale de ahí y no del almacenamiento —que
 * cuesta parecido en los dos lados—.
 */
export function comparar(
  uso: {
    bytes: number;
    bytesServidosSupabase: number;
    imagenes: number;
    entregas: number;
  },
  p: Precios,
): Comparacion {
  const supabase = costoSupabase(
    { bytes: uso.bytes, bytesServidos: uso.bytesServidosSupabase },
    p,
  );
  const cloudflare = costoCloudflare(
    { bytes: uso.bytes, imagenes: uso.imagenes, entregas: uso.entregas },
    p,
  );
  const ahorroUSD = supabase.totalUSD - cloudflare.totalUSD;
  return {
    supabase,
    cloudflare,
    ahorroUSD,
    ahorroCRC: ahorroUSD * p.tipoCambio,
    ahorroPorcentaje: supabase.totalUSD > 0 ? (ahorroUSD / supabase.totalUSD) * 100 : 0,
    ahorroPorEgresoUSD: supabase.entregaUSD - cloudflare.entregaUSD,
  };
}

// ------------------------------------------------------------
// Progreso de la migración
// ------------------------------------------------------------

export type Progreso = {
  archivosLegacy: number;
  archivosMigrados: number;
  bytesLegacy: number;
  porcentaje: number;
  /** Álbumes que todavía no tienen ni una foto en R2. */
  albumesSinTocar: number;
  /** Álbumes a medio migrar: son los que hay que mirar primero. */
  albumesAMedias: number;
};

export function progresoAlbumes(albumes: FilaAlbumLegacy[]): Progreso {
  let archivosLegacy = 0;
  let archivosMigrados = 0;
  let bytesLegacy = 0;
  let sinTocar = 0;
  let aMedias = 0;

  for (const a of albumes) {
    archivosLegacy += a.archivos;
    archivosMigrados += Math.min(a.migradas, a.archivos);
    bytesLegacy += a.bytes;
    if (a.migradas === 0) sinTocar += 1;
    else if (a.migradas < a.archivos) aMedias += 1;
  }

  return {
    archivosLegacy,
    archivosMigrados,
    bytesLegacy,
    porcentaje: archivosLegacy > 0 ? (archivosMigrados / archivosLegacy) * 100 : 0,
    albumesSinTocar: sinTocar,
    albumesAMedias: aMedias,
  };
}
