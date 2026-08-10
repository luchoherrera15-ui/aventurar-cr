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
 *   1. ¿El asset está LISTO y verificado?  → Cloudflare.
 *   2. ¿Todavía no está migrado?           → la URL de Supabase (legacy).
 *   3. ¿Falló la migración?                → legacy igual, y se registra.
 *   4. ¿No hay nada?                       → null, y quien llama decide
 *                                            qué placeholder pone.
 *
 * El paso 3 es el que más importa: una migración a medias NO puede
 * dejar a nadie sin foto. Mientras `legacy_url` tenga algo y la
 * visibilidad lo permita, la foto se ve — venga de donde venga.
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
  cloudflareConfirmado,
  estaListo,
  estaVivo,
  r2Confirmado,
  type AssetVerificable,
  type MediaAsset,
  type Variante,
} from "./tipos";

// ------------------------------------------------------------
// El resultado
// ------------------------------------------------------------

export type MotivoSinImagen = "borrada" | "sin-origen" | "sin-firmante";

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
   * ── LEER ANTES DE PONER ESTO EN true ─────────────────────────────
   *
   * Los álbumes viven hoy en un bucket PÚBLICO de Supabase (migración
   * 0068), así que su `legacy_url` es una URL que cualquiera puede
   * abrir. Servirla es legítimo SOLO cuando quien mira ya demostró que
   * tiene derecho: es decir, después de que la página validó el
   * QR/share token del álbum.
   *
   * Por eso el default es `false` y el nombre dice lo que hay que haber
   * hecho, no lo que pasa con el bucket. Un default permisivo
   * convertiría cualquier llamada distraída —una ruta nueva, un
   * componente reutilizado, un test— en una fuga de las fotos de un
   * álbum ajeno. Con `false`, esa misma distracción produce una foto
   * que no se ve.
   *
   * NUNCA aplica a `privada`.
   */
  tokenDeAlbumValidado?: boolean;
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
  asset: AssetVerificable & Pick<MediaAsset, "visibilidad" | "legacy_url">,
  variante: Variante,
  opciones: OpcionesResolver = {},
): ResultadoVisual {
  // 0. Borrada es borrada, aunque los archivos sigan existiendo. El
  //    borrado es lógico justamente para poder deshacerlo, pero
  //    mientras esté marcado no se muestra.
  if (!estaVivo(asset)) return { tipo: "sin-imagen", motivo: "borrada" };

  const necesitaFirma = ENTREGA[asset.visibilidad] === "firmada";

  // 1. Cloudflare, solo si el asset está listo Y la copia visual está
  //    CONFIRMADA. `estaListo` comprueba los sellos que el tipo exige,
  //    no que la columna diga "listo": una fila inconsistente cae a
  //    legacy en vez de producir un 404 con cara de foto.
  //
  //    `cloudflareConfirmado` se pide aparte y no es redundante: para un
  //    VIDEO, `estaListo` es true sin Cloudflare (no tiene copia visual),
  //    y sin esta segunda condición se armaría una URL de variante para
  //    un archivo que no tiene ninguna.
  if (estaListo(asset) && cloudflareConfirmado(asset) && asset.cf_image_id && opciones.deliveryUrl) {
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
      // `privada` NUNCA: el legacy de un comprobante es una ruta de
      // bucket privado, no una URL que se pueda poner en un <img>.
      (asset.visibilidad === "compartida" && opciones.tokenDeAlbumValidado === true);

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
 *
 * ── SE MIRA EL SELLO, NO EL ESTADO ───────────────────────────────────
 *
 * La versión anterior aceptaba la clave cuando `estado` era 'listo' o
 * 'parcial_r2'. Funcionaba, pero por un rodeo: deducía del estado algo
 * que ahora se sabe directamente. `r2_verificado_en` ES el hecho —
 * "hicimos HEAD contra R2 y el objeto está ahí"—, así que preguntar por
 * él es más corto y no se desincroniza si mañana aparece un estado
 * nuevo. Un `error` cuyo original ya subió sigue siendo descargable, que
 * es lo correcto: el archivo existe.
 */
export function resolverOriginal(
  asset: Pick<MediaAsset, "deleted_at" | "r2_key" | "r2_verificado_en" | "legacy_url">,
): ResultadoOriginal {
  if (!estaVivo(asset)) return { tipo: "sin-original", motivo: "borrada" };

  if (r2Confirmado(asset) && asset.r2_key) {
    return { tipo: "r2", clave: asset.r2_key };
  }
  // Con la clave reservada pero el objeto sin confirmar, todavía sirve
  // lo de siempre: la foto se baja de Supabase hasta que R2 confirme.
  if (asset.legacy_url) return { tipo: "legacy", url: asset.legacy_url };
  return { tipo: "sin-original", motivo: "sin-origen" };
}

// ------------------------------------------------------------
// Mantenimiento
// ------------------------------------------------------------

/**
 * ¿A este asset le falta pasar por Cloudflare/R2?
 *
 * Se deriva de si está completo y verificado, no de un campo
 * `provider`: un asset puede tener el original arriba y la copia visual
 * no, y eso es exactamente lo que hay que volver a intentar.
 */
export function necesitaMigracion(asset: AssetVerificable): boolean {
  return estaVivo(asset) && !estaListo(asset);
}
