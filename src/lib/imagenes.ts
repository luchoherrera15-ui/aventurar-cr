/**
 * Miniaturas y compresión de fotos.
 *
 * Las fotos de los proveedores se suben a Supabase Storage tal cual
 * salen del teléfono (3–8 MB). Mostrarlas así en las cards del
 * directorio era lo que más hacía pesar la página: para una tarjeta de
 * ~300px se descargaba la foto original completa.
 */

const MARCA_OBJECT = "/storage/v1/object/public/";
const MARCA_RENDER = "/storage/v1/render/image/public/";

// La transformación de imágenes es un add-on de pago de Supabase. Sin
// el add-on, cada miniatura sería un request fallido ANTES de caer a la
// foto original — peor que nada. Por eso viene apagada por defecto:
// cuando el proyecto tenga el add-on, poner NEXT_PUBLIC_IMG_TRANSFORM=1
// en Vercel y las miniaturas se activan solas en el próximo deploy.
const TRANSFORMACION_ACTIVA = process.env.NEXT_PUBLIC_IMG_TRANSFORM === "1";

/**
 * Devuelve la URL redimensionada (CDN de transformación de Supabase)
 * para una foto del Storage. URLs de otros orígenes salen intactas.
 *
 * Todo <img> que use esta URL debe llevar
 * `onError={caerAlOriginal(urlOriginal)}` para no quedar roto si el
 * add-on se apaga con la variable ya en 1.
 */
export function miniatura(url: string, ancho: number, calidad = 75): string {
  if (!TRANSFORMACION_ACTIVA || !url.includes(MARCA_OBJECT)) return url;
  const separador = url.includes("?") ? "&" : "?";
  return `${url.replace(MARCA_OBJECT, MARCA_RENDER)}${separador}width=${ancho}&quality=${calidad}`;
}

/**
 * Handler de onError que reemplaza la miniatura por la foto original
 * una sola vez (si el original también falla, no reintenta).
 */
export function caerAlOriginal(urlOriginal: string) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.src !== urlOriginal) img.src = urlOriginal;
  };
}

/**
 * Comprime una foto en el navegador antes de subirla: la reescala a un
 * lado máximo y la recodifica en JPEG. Si algo falla, o el resultado no
 * queda más liviano, devuelve el archivo original — nunca bloquea la
 * subida.
 */
export async function comprimirFoto(
  file: File,
  ladoMax = 1600,
  calidad = 0.82,
): Promise<File> {
  // GIFs (animación) y no-imágenes se suben tal cual.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    // createImageBitmap ya aplica la orientación EXIF del teléfono.
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
    // Chica y liviana: no vale la pena recodificar.
    if (escala === 1 && file.size < 400 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", calidad),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}
