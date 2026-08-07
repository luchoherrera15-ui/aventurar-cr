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

/**
 * Por debajo de esto y ya dentro del lado máximo, no se toca: volver a
 * encodear una foto que ya está liviana solo le saca calidad y quema
 * CPU del teléfono. 300 KB a 1920 px de lado es una foto sana.
 */
const YA_LIVIANA_BYTES = 300 * 1024;

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

    // Ya está dentro del lado máximo y ya pesa poco: se sube tal cual.
    // Reencodearla no la haría más chica, solo peor.
    if (escala === 1 && archivo.size <= YA_LIVIANA_BYTES) return archivo;

    const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
    const alto = Math.max(1, Math.round(img.naturalHeight * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    // El JPEG no tiene canal alfa: lo transparente de un PNG salía
    // NEGRO al encodear (el canvas nace con píxeles transparentes y
    // toBlob los aplasta a 0,0,0). Pintar el fondo blanco antes de
    // dibujar es lo que espera cualquiera que sube un logo o un flyer
    // con fondo recortado.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", calidad),
    );
    if (!blob) return archivo;

    // Red de seguridad: un PNG chico de pocos colores puede salir MÁS
    // pesado como JPEG. Si pasó eso y encima no hubo que achicar la
    // imagen, gana el original.
    if (escala === 1 && blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^./]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return archivo;
  } finally {
    URL.revokeObjectURL(url);
  }
}
