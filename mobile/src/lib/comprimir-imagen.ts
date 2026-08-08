import { Image } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/**
 * Redimensiona una foto local antes de subirla: lado mayor a 1920px y
 * reencodada como JPEG al 0.82 — una foto de celular de varios MB
 * queda en unos cientos de KB antes de tocar la red. Es el mismo
 * criterio que la web (src/lib/comprimir-imagen.ts), para que una foto
 * subida desde la app pese lo mismo que una subida desde el sitio.
 *
 * Nunca bloquea una subida: si algo falla (formato raro, archivo que
 * ya no está, lo que sea), se devuelve el uri original tal cual.
 */

const LADO_MAX = 1920;
const CALIDAD = 0.82;

/**
 * Las fotos de VITRINA: galería del negocio, foto principal y
 * catálogo — las que un cliente mira para decidir si reserva. Espejo
 * exacto de `FOTO_DE_VITRINA` en src/lib/comprimir-imagen.ts de la
 * web, para que una foto subida desde el teléfono se vea igual que una
 * subida desde el sitio.
 *
 * No le cuesta un byte al visitante: nadie descarga el archivo del
 * bucket, next/image lo reencoda a AVIF al ancho de cada pantalla. Lo
 * que se sube es el negativo, no la copia que se entrega.
 *
 * OJO al subirlas desde la app: `launchImageLibraryAsync` tiene su
 * propio `quality`, y con 0.8 machaca la foto ANTES de que este
 * módulo la toque — tres compresiones encima de la misma imagen. En
 * las pantallas de vitrina va en 1 y la compresión la hace acá, una
 * sola vez.
 */
export const FOTO_DE_VITRINA = { ladoMax: 2560, calidad: 0.9 } as const;

/** Lee las dimensiones de la imagen sin decodificarla entera. */
function medir(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Devuelve el uri de una copia comprimida (en el caché de la app),
 * lista para leerse en base64 y subirse. Si el picker ya trae las
 * dimensiones del asset, pasarlas ahorra una lectura del archivo.
 */
export async function comprimirImagen(
  uri: string,
  dimensiones?: { width: number; height: number },
  opts: { ladoMax?: number; calidad?: number } = {},
): Promise<string> {
  const ladoMax = opts.ladoMax ?? LADO_MAX;
  const calidad = opts.calidad ?? CALIDAD;
  try {
    const { width, height } = dimensiones ?? (await medir(uri));
    // Solo se achica, nunca se agranda; si ya cabe, igual se reencoda
    // a JPEG 0.82 (mismo comportamiento que el canvas de la web).
    const acciones =
      Math.max(width, height) > ladoMax
        ? [width >= height ? { resize: { width: ladoMax } } : { resize: { height: ladoMax } }]
        : [];
    const resultado = await manipulateAsync(uri, acciones, {
      compress: calidad,
      format: SaveFormat.JPEG,
    });
    return resultado.uri;
  } catch {
    return uri;
  }
}
