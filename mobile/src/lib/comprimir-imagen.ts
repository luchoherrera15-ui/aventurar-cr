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
): Promise<string> {
  try {
    const { width, height } = dimensiones ?? (await medir(uri));
    // Solo se achica, nunca se agranda; si ya cabe, igual se reencoda
    // a JPEG 0.82 (mismo comportamiento que el canvas de la web).
    const acciones =
      Math.max(width, height) > LADO_MAX
        ? [width >= height ? { resize: { width: LADO_MAX } } : { resize: { height: LADO_MAX } }]
        : [];
    const resultado = await manipulateAsync(uri, acciones, {
      compress: CALIDAD,
      format: SaveFormat.JPEG,
    });
    return resultado.uri;
  } catch {
    return uri;
  }
}
