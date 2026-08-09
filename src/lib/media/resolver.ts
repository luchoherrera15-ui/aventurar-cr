/**
 * BOOKEA MEDIA — el resolver: la pieza que hace invisible la migración.
 *
 * TODA lectura de una foto pasa por acá. Ese es el punto: mientras
 * exista un solo lugar que decida de dónde sale la imagen, migrar de
 * Supabase a Cloudflare es cambiar una fila en la base, no desplegar
 * código; y volver atrás es cambiarla de nuevo.
 *
 * El orden es siempre el mismo, y no se negocia:
 *
 *   1. ¿El asset está LISTO en Cloudflare?  → Cloudflare.
 *   2. ¿Todavía no está migrado?            → la URL de Supabase (legacy).
 *   3. ¿Falló la migración?                 → legacy igual, y se registra.
 *   4. ¿No hay nada?                        → null, y quien llama decide
 *                                             qué placeholder pone.
 *
 * El paso 3 es el que más importa: una migración a medias NO puede
 * dejar a nadie sin foto. Mientras `legacy_url` tenga algo, la foto se
 * ve — venga de donde venga.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────
 *
 * No firma nada. Firmar necesita la llave de Cloudflare, que es un
 * secreto de servidor, y este módulo es neutral para poder usarse
 * también desde el navegador. Cuando un asset EXIGE firma, el resolver
 * lo dice (`requiere-firma`) y le pasa la ruta ya armada a quien sí
 * puede firmar. Así el navegador nunca ve la llave y tampoco puede
 * saltarse la validación del token del álbum.
 */

import {
  ENTREGA,
  estaListo,
  estaVivo,
  type MediaAsset,
  type Variante,
} from "./tipos";

// ------------------------------------------------------------
// El resultado
// ------------------------------------------------------------

export type MotivoSinImagen =
  | "borrada"
  | "sin-origen"
  | "sin-firmante";

/**
 * Unión discriminada y no un `string | null` a secas: la diferencia
 * entre "esta foto se sirve pública" y "esta foto necesita una firma
 * que vos no podés hacer" es justo la que no conviene perder en el
 * camino. Quien llama tiene que ocuparse de los cuatro casos.
 */
export type ResultadoVisual =
  | { tipo: "cloudflare"; url: string }
  | { tipo: "legacy"; url: string }
  | { tipo: "requiere-firma"; ruta: string; variante: Variante }
  | { tipo: "sin-imagen"; motivo: MotivoSinImagen };

export type OpcionesResolver = {
  /**
   * La base de entrega de Cloudflare Images
   * (`https://imagedelivery.net/{account_hash}`). Sin esto no se puede
   * armar ninguna URL de Cloudflare y todo cae en legacy — que es
   * exactamente lo que tiene que pasar si la variable no está puesta.
   */
  deliveryUrl?: string | null;
  /**
   * Firma una ruta de Cloudflare. Solo existe en el servidor y solo
   * después de haber validado la sesión o el token del álbum.
   */
  firmar?: (ruta: string, variante: Variante) => string;
  /**
   * Hoy los álbumes viven en un bucket PÚBLICO de Supabase (migración
   * 0068) y se comparten por QR. Mientras eso siga así, el fallback
   * legacy de un asset `compartida` es legítimo: es literalmente la URL
   * que la página ya está sirviendo.
   *
   * Cuando el álbum pase a Cloudflare con firma, esto se pone en false
   * y el fallback deja de aplicar. En `privada` NO aplica nunca.
   */
  legacyCompartidaEsPublica?: boolean;
};

// ------------------------------------------------------------
// El resolver
// ------------------------------------------------------------

/** Quita la barra final para poder concatenar sin duplicarla. */
function base(url: string): string {
  return url.replace(/\/+$/, "");
}

/** La ruta de una variante dentro de Cloudflare: `{imageId}/{variante}`. */
export function rutaCloudflare(cfImageId: string, variante: Variante): string {
  return `${cfImageId}/${variante}`;
}

/**
 * De dónde sale esta foto. La única función que hay que entender de
 * todo el módulo.
 */
export function resolverVisual(
  asset: Pick<
    MediaAsset,
    "estado" | "deleted_at" | "visibilidad" | "cf_image_id" | "legacy_url"
  >,
  variante: Variante,
  opciones: OpcionesResolver = {},
): ResultadoVisual {
  // 0. Borrada es borrada, aunque los archivos sigan existiendo. El
  //    borrado es lógico justamente para poder deshacerlo, pero
  //    mientras esté marcado no se muestra.
  if (!estaVivo(asset)) return { tipo: "sin-imagen", motivo: "borrada" };

  const necesitaFirma = ENTREGA[asset.visibilidad] === "firmada";

  // 1. Cloudflare, si el asset está listo de verdad y hay a dónde
  //    apuntar. `estaListo` exige que los DOS destinos se hayan
  //    verificado: un `parcial_cf` tiene imagen en Cloudflare pero no
  //    original en R2, y servirlo sería prometer una descarga que no
  //    existe.
  if (estaListo(asset) && asset.cf_image_id && opciones.deliveryUrl) {
    const ruta = rutaCloudflare(asset.cf_image_id, variante);

    if (!necesitaFirma) {
      return { tipo: "cloudflare", url: `${base(opciones.deliveryUrl)}/${ruta}` };
    }
    if (opciones.firmar) {
      return { tipo: "cloudflare", url: opciones.firmar(ruta, variante) };
    }
    // Exige firma y quien llama no puede firmar: se lo decimos en vez
    // de devolver una URL sin token que igual iba a dar 401.
    return { tipo: "requiere-firma", ruta, variante };
  }

  // 2 y 3. El fallback legacy. Sirve tanto para "todavía no migrada"
  //        como para "la migración falló": en los dos casos la foto se
  //        tiene que ver.
  if (asset.legacy_url) {
    const legacyPermitido =
      asset.visibilidad === "publica" ||
      (asset.visibilidad === "compartida" && opciones.legacyCompartidaEsPublica !== false);

    // En `privada` NUNCA: el legacy de un comprobante es una ruta de
    // bucket privado, no una URL que se pueda poner en un <img>.
    if (legacyPermitido) return { tipo: "legacy", url: asset.legacy_url };
    return { tipo: "sin-imagen", motivo: "sin-firmante" };
  }

  return { tipo: "sin-imagen", motivo: "sin-origen" };
}

/**
 * La versión cómoda, para cuando quien llama solo quiere un `src` y ya
 * decidió que un `null` se dibuja como placeholder.
 */
export function urlVisual(
  asset: Parameters<typeof resolverVisual>[0],
  variante: Variante,
  opciones: OpcionesResolver = {},
): string | null {
  const r = resolverVisual(asset, variante, opciones);
  return r.tipo === "cloudflare" || r.tipo === "legacy" ? r.url : null;
}

// ------------------------------------------------------------
// Descarga del original
// ------------------------------------------------------------

export type ResultadoOriginal =
  | { tipo: "r2"; clave: string }
  | { tipo: "legacy"; url: string }
  | { tipo: "sin-original"; motivo: MotivoSinImagen };

/**
 * De dónde se baja el ORIGINAL (la descarga, no lo que se mira).
 *
 * Devuelve la CLAVE de R2, nunca una URL: firmarla es cosa del servidor
 * y con expiración corta. Que este módulo no pueda producir una URL de
 * descarga es una propiedad, no una carencia.
 */
export function resolverOriginal(
  asset: Pick<MediaAsset, "estado" | "deleted_at" | "r2_key" | "legacy_url">,
): ResultadoOriginal {
  if (!estaVivo(asset)) return { tipo: "sin-original", motivo: "borrada" };

  // Acá alcanza con que el original esté arriba: un `parcial_r2` no
  // tiene copia visual todavía, pero el archivo que se descarga sí
  // existe y está verificado.
  if (asset.r2_key) return { tipo: "r2", clave: asset.r2_key };
  if (asset.legacy_url) return { tipo: "legacy", url: asset.legacy_url };
  return { tipo: "sin-original", motivo: "sin-origen" };
}

// ------------------------------------------------------------
// Preguntas de mantenimiento
// ------------------------------------------------------------

/** ¿A este asset le falta pasar por Cloudflare/R2? */
export function necesitaMigracion(
  asset: Pick<MediaAsset, "provider" | "estado" | "deleted_at">,
): boolean {
  return estaVivo(asset) && !(asset.provider === "cloudflare" && asset.estado === "listo");
}

/**
 * ¿Se puede soltar la referencia a Supabase?
 *
 * Solo cuando el asset está listo Y tiene las dos copias. Aun así, el
 * plan es NO borrar nada de Supabase: esta función dice que el legacy ya
 * no se usa para servir, no que haya que borrarlo.
 */
export function legacyYaNoSeUsa(
  asset: Pick<MediaAsset, "estado" | "deleted_at" | "cf_image_id" | "r2_key">,
): boolean {
  return estaListo(asset) && Boolean(asset.cf_image_id) && Boolean(asset.r2_key);
}

/**
 * Cuántos assets de una lista siguen saliendo de Supabase. Es el número
 * que mide el avance de la migración y el que va a decir cuánto egress
 * queda por recuperar.
 */
export function contarPorOrigen(
  assets: readonly Pick<
    MediaAsset,
    "estado" | "deleted_at" | "visibilidad" | "cf_image_id" | "legacy_url"
  >[],
  variante: Variante,
  opciones: OpcionesResolver = {},
): Record<ResultadoVisual["tipo"], number> {
  const cuenta: Record<ResultadoVisual["tipo"], number> = {
    cloudflare: 0,
    legacy: 0,
    "requiere-firma": 0,
    "sin-imagen": 0,
  };
  for (const a of assets) cuenta[resolverVisual(a, variante, opciones).tipo] += 1;
  return cuenta;
}
