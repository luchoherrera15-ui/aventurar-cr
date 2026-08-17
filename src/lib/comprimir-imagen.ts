/**
 * Redimensiona una imagen en el navegador (canvas) a un lado máximo y
 * la reencoda como JPEG —o como PNG, si se pide conservar el alfa y la
 * imagen lo usa— para que una foto de celular de varios MB quede en
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
 * Las fotos de VITRINA: la galería del negocio, su foto principal y el
 * catálogo. Las que un cliente mira para decidir si reserva, y contra
 * las que compara con Airbnb.
 *
 * Van más grandes y con menos compresión que el resto A PROPÓSITO, y
 * esto NO le cuesta un byte al visitante: nadie descarga jamás el
 * archivo del bucket. next/image lo reencoda a AVIF al ancho exacto de
 * cada pantalla, así que lo que se sube es el NEGATIVO, no la copia
 * que se entrega. Subir un JPEG ya machacado al 0.82 y volver a
 * comprimirlo a AVIF es perder dos veces sobre la misma foto: los
 * artefactos de la primera pasada se encodean como si fueran detalle.
 *
 * 2560 px y no 1920 porque el ancho máximo que sirve el sitio es 1920
 * (ver `deviceSizes` en next.config.ts): con un original de 2560 esa
 * variante se genera REDUCIENDO, que es donde un encoder se luce, en
 * vez de copiar píxel a píxel un archivo que ya venía con pérdida.
 *
 * Lo único que se paga es almacenamiento —unos 900 KB por foto contra
 * 400— y hay 100 GB en el plan con 120 MB usados. Los comprobantes de
 * pago y los avatares del equipo se quedan en el ajuste normal: son
 * documentos y miniaturas, no vitrina.
 */
export const FOTO_DE_VITRINA = { ladoMax: 2560, calidad: 0.9 } as const;

/**
 * Por debajo de esto y ya dentro del lado máximo, no se toca: volver a
 * encodear una foto que ya está liviana solo le saca calidad y quema
 * CPU del teléfono. 300 KB a 1920 px de lado es una foto sana.
 */
const YA_LIVIANA_BYTES = 300 * 1024;

/**
 * ¿Queda algún píxel translúcido?
 *
 * Se pregunta sobre el canvas YA dibujado, no sobre el archivo: es la
 * única forma de saberlo sin decodificar el PNG a mano. Si el navegador
 * no deja leerlo, se responde que sí — para un logo, el lado seguro es
 * conservar el alfa.
 */
function tieneTransparencia(ctx: CanvasRenderingContext2D, ancho: number, alto: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, ancho, alto);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Carga un archivo como <img> ya decodificado. Lanza si no se puede. */
async function cargarImagen(archivo: File): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen."));
      el.src = url;
    });
    return { img, url };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/**
 * LO QUE HAY QUE SABER DE UNA IMAGEN ANTES DE METERLA EN UN CÍRCULO.
 *
 * Se usa para el ícono propio del sello (0174), donde las dos cosas que
 * arruinan el resultado se pueden ver ANTES de guardar:
 *
 *   · `fondoOpaco` — las cuatro esquinas son opacas, o sea que la
 *     imagen es un CUADRADO. Metido en un círculo de color, se lee como
 *     un sticker pegado encima y no como un sello;
 *   · `colorPromedio` — el color medio de lo que se ve (ignorando lo
 *     transparente). Con él se mide el contraste contra el fondo del
 *     sello: un ícono blanco sobre el círculo blanco desaparece, que es
 *     exactamente el bug que hizo falta arreglar con los doce dibujos.
 *
 * Devuelve null si el navegador no puede procesar la imagen. Un aviso
 * que no se puede calcular no se inventa: se calla.
 */
export type AnalisisImagen = { fondoOpaco: boolean; colorPromedio: string | null };

export async function analizarImagen(archivo: File): Promise<AnalisisImagen | null> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/svg+xml") return null;

  let cargada: { img: HTMLImageElement; url: string };
  try {
    cargada = await cargarImagen(archivo);
  } catch {
    return null;
  }

  try {
    // 64 px alcanza y sobra: acá no se mira detalle, se mide color y
    // transparencia. Leer 4 MB de píxeles para eso congelaría el hilo.
    const lado = 64;
    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(cargada.img, 0, 0, lado, lado);

    const { data } = ctx.getImageData(0, 0, lado, lado);

    let r = 0;
    let g = 0;
    let b = 0;
    let visibles = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Lo casi transparente no cuenta: es el aire alrededor del dibujo,
      // y promediarlo tiraría el color hacia el negro del canvas vacío.
      if (data[i + 3] < 16) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      visibles++;
    }

    const alfaEn = (x: number, y: number) => data[(y * lado + x) * 4 + 3];
    // Un margen de 2 px: casi ningún archivo tiene el color pegado al
    // filo exacto, y pedir la esquina justa daría falsos negativos.
    const fondoOpaco =
      alfaEn(2, 2) > 200 &&
      alfaEn(lado - 3, 2) > 200 &&
      alfaEn(2, lado - 3) > 200 &&
      alfaEn(lado - 3, lado - 3) > 200;

    const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    return {
      fondoOpaco,
      colorPromedio:
        visibles > 0 ? `#${hex(r / visibles)}${hex(g / visibles)}${hex(b / visibles)}` : null,
    };
  } catch {
    // `getImageData` puede fallar (canvas contaminado, memoria): sin
    // análisis no hay aviso, y sin aviso la subida sigue igual.
    return null;
  } finally {
    URL.revokeObjectURL(cargada.url);
  }
}

export async function comprimirImagen(
  archivo: File,
  opts: {
    ladoMax?: number;
    calidad?: number;
    /**
     * UN LOGO ES UNA MARCA, NO UNA FOTO.
     *
     * Con esto en true, una imagen con transparencia se guarda PNG con
     * su alfa intacto en vez de JPEG aplastado contra un fondo blanco.
     *
     * No es una preferencia estética: el pase de Wallet tiene fondo
     * navy, así que la mitad de las marcas suben su logo BLANCO sobre
     * transparente. Aplastado contra blanco queda blanco sobre blanco, y
     * `sharp(...).trim()` —que el generador usa para quitarle el margen
     * al logo— responde «Image is entirely blank» y revienta. El cliente
     * terminaba con un pase sin logo y, hasta que se arregló la escalera
     * de degradación, sin la tira de sellos entera.
     *
     * Se queda en false para las fotos y las bandas, donde el JPEG sí
     * corresponde: una foto no tiene alfa y en PNG pesaría de más.
     */
    conservarAlfa?: boolean;
  } = {},
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

    const conservarAlfa = opts.conservarAlfa === true;

    // El JPEG no tiene canal alfa: lo transparente de un PNG salía
    // NEGRO al encodear (el canvas nace con píxeles transparentes y
    // toBlob los aplasta a 0,0,0). Pintar el fondo blanco antes de
    // dibujar es lo que espera cualquiera que sube una foto o un flyer
    // con fondo recortado.
    //
    // Con `conservarAlfa` NO se pinta: la transparencia se decide
    // mirando el resultado. Si la imagen igual es opaca —una foto—, el
    // canvas queda idéntico al de siempre y sale JPEG como siempre.
    if (!conservarAlfa) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, ancho, alto);
    }
    ctx.drawImage(img, 0, 0, ancho, alto);

    const alfa = conservarAlfa && tieneTransparencia(ctx, ancho, alto);
    const tipo = alfa ? "image/png" : "image/jpeg";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, tipo, calidad),
    );
    if (!blob) return archivo;

    // Red de seguridad: un PNG chico de pocos colores puede salir MÁS
    // pesado como JPEG (y un PNG re-encodeado, más pesado que el que
    // vino). Si pasó eso y encima no hubo que achicar la imagen, gana el
    // original — que además conserva su alfa, si lo tenía.
    if (escala === 1 && blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^./]+$/, "") + (alfa ? ".png" : ".jpg");
    return new File([blob], nombre, { type: tipo });
  } catch {
    return archivo;
  } finally {
    URL.revokeObjectURL(url);
  }
}
