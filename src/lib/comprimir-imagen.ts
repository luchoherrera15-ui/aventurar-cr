/**
 * Redimensiona una imagen en el navegador (canvas) a un lado máximo y
 * la reencoda como JPEG — una foto de celular de varios MB queda en
 * unos cientos de KB antes de tocar la red. Mismo criterio en toda la
 * plataforma (álbum digital, galería de negocio, equipo, catálogo,
 * invitaciones, comprobantes de pago): nace acá, en el álbum digital
 * (primero en tener esto), y de ahí se generalizó al resto.
 *
 * Nunca bloquea una subida: si el navegador no puede procesar la
 * imagen (formato raro, canvas sin contexto 2D, lo que sea), se
 * devuelve el archivo original tal cual en vez de fallar.
 */

const LADO_MAX = 1920;
const CALIDAD = 0.82;

export async function comprimirImagen(
  archivo: File,
  opts: { ladoMax?: number; calidad?: number } = {},
): Promise<File> {
  // No es una imagen rasterizable (SVG incluido: es vectorial, canvas
  // lo destruiría) — se sube tal cual.
  if (!archivo.type.startsWith("image/") || archivo.type === "image/svg+xml") {
    return archivo;
  }

  const ladoMax = opts.ladoMax ?? LADO_MAX;
  const calidad = opts.calidad ?? CALIDAD;
  const url = URL.createObjectURL(archivo);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen."));
      el.src = url;
    });

    const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
    const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
    const alto = Math.max(1, Math.round(img.naturalHeight * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(img, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", calidad),
    );
    if (!blob) return archivo;

    const nombre = archivo.name.replace(/\.[^./]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return archivo;
  } finally {
    URL.revokeObjectURL(url);
  }
}
