import { paletaDePixeles, type PropuestaColores } from "./colores-imagen";

/**
 * LOS COLORES DE UNA IMAGEN, EN EL NAVEGADOR.
 *
 * La pareja de `colores-imagen.ts` para el cliente: dibuja la imagen
 * en un canvas chico (64 px de lado mayor) y le pasa los píxeles al
 * módulo neutral. Chico a propósito: el color de una foto no cambia
 * entre 64 y 4 000 px, y leer 4 000² píxeles congelaría la pestaña.
 *
 * ── DOS ENTRADAS ───────────────────────────────────────────────────
 * `coloresDeArchivo` trabaja con el archivo recién elegido, ANTES de
 * subirlo: es instantáneo y no depende de la red. `coloresDeUrl` es
 * para una imagen ya guardada; solo funciona si el servidor que la
 * sirve permite CORS (Cloudflare Images sí). Si no, devuelve null y
 * quien llama cae a la acción del servidor (`coloresDeImagenSolutions`).
 */

const LADO = 64;

async function decodificar(fuente: Blob | string): Promise<{ ancho: number; alto: number; dibujar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void } | null> {
  if (typeof window === "undefined") return null;
  if (fuente instanceof Blob && "createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(fuente);
      return { ancho: bmp.width, alto: bmp.height, dibujar: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h) };
    } catch {
      /* cae al <img> */
    }
  }
  return new Promise((resolver) => {
    const img = new Image();
    if (typeof fuente === "string") img.crossOrigin = "anonymous";
    const url = typeof fuente === "string" ? fuente : URL.createObjectURL(fuente);
    img.onload = () => {
      if (typeof fuente !== "string") URL.revokeObjectURL(url);
      resolver({ ancho: img.naturalWidth, alto: img.naturalHeight, dibujar: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h) });
    };
    img.onerror = () => {
      if (typeof fuente !== "string") URL.revokeObjectURL(url);
      resolver(null);
    };
    img.src = url;
  });
}

async function coloresDe(fuente: Blob | string): Promise<PropuestaColores | null> {
  const imagen = await decodificar(fuente);
  if (!imagen || imagen.ancho === 0 || imagen.alto === 0) return null;
  const escala = Math.min(1, LADO / Math.max(imagen.ancho, imagen.alto));
  const w = Math.max(1, Math.round(imagen.ancho * escala));
  const h = Math.max(1, Math.round(imagen.alto * escala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    imagen.dibujar(ctx, w, h);
    // Con una imagen de otro origen sin CORS, `getImageData` lanza
    // SecurityError: el canvas quedó «manchado». Es el caso null.
    return paletaDePixeles(ctx.getImageData(0, 0, w, h).data);
  } catch {
    return null;
  }
}

/** Los colores del archivo que se acaba de elegir (antes de subirlo). */
export function coloresDeArchivo(archivo: Blob): Promise<PropuestaColores | null> {
  return coloresDe(archivo);
}

/** Los colores de una imagen ya guardada. null si el origen no permite leerla. */
export function coloresDeUrl(url: string): Promise<PropuestaColores | null> {
  return coloresDe(url);
}
