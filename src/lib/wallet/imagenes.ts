import sharp, { type OverlayOptions } from "sharp";
import { join } from "node:path";

/**
 * Las imágenes de la tarjeta de lealtad.
 *
 * La tira de sellos es el truco central del módulo: Apple tiene un
 * layout FIJO —logo, campos en filas, código de barras— y no permite
 * poner elementos donde uno quiera. Los "10 círculos que se encienden"
 * no son un componente: son una imagen que se redibuja cada vez que
 * cambia el saldo.
 */

/**
 * Los assets del pase viven TODOS en `assets-wallet/`, en la raíz del
 * proyecto, y no en `public/` ni en la app móvil.
 *
 * No es un capricho de orden: Vercel arma el bundle de cada función
 * siguiendo los `import`, y un archivo que se lee con `readFile` en
 * tiempo de ejecución no aparece en ese rastreo. Por eso
 * `next.config.ts` declara esta carpeta en `outputFileTracingIncludes`
 * — y tenerlos juntos hace que esa declaración sea una sola línea en
 * vez de una por archivo regado.
 *
 * Si alguno de estos archivos falta en producción, el síntoma es un
 * 500 al generar el pase, no un error de build.
 */
const ASSETS = join(process.cwd(), "assets-wallet");
const FUENTE = join(ASSETS, "Montserrat-var.ttf");

/** Medidas de Apple para el strip de un storeCard, en puntos. */
const TIRA_ANCHO = 375;
const TIRA_ALTO = 123;

export type ColoresTarjeta = { fondo: string; sello: string };

/**
 * Un sello: la imagen del negocio recortada en círculo. El apagado NO
 * se borra — queda tenue para que el cliente vea cuántos le faltan.
 * Esa diferencia entre "llevás 5" y "te faltan 5" es lo que hace
 * volver, así que no es un detalle estético.
 */
async function selloRedondo({
  diametro,
  encendido,
  imagen,
  colores,
}: {
  diametro: number;
  encendido: boolean;
  /** Logo del negocio. Sin él se dibuja un círculo liso. */
  imagen: Buffer | null;
  colores: ColoresTarjeta;
}): Promise<Buffer> {
  const mascara = Buffer.from(
    `<svg width="${diametro}" height="${diametro}">
       <circle cx="${diametro / 2}" cy="${diametro / 2}" r="${diametro / 2}" fill="#fff"/>
     </svg>`,
  );

  const capas: OverlayOptions[] = [];

  if (imagen) {
    // `trim` quita el margen vacío: los logos suelen venir en lienzos
    // muy grandes con la marca chiquita en el centro.
    const contenido = await sharp(imagen)
      .trim()
      .resize(Math.round(diametro * 0.62), Math.round(diametro * 0.62), {
        fit: "inside",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();
    capas.push({ input: contenido, gravity: "center" });
  }

  capas.push({ input: mascara, blend: "dest-in" });

  const circulo = await sharp({
    create: {
      width: diametro,
      height: diametro,
      channels: 4,
      background: imagen ? "#FFFFFF" : colores.sello,
    },
  })
    .composite(capas)
    .png()
    .toBuffer();

  if (encendido) return circulo;

  return sharp(circulo)
    .composite([
      {
        input: Buffer.from([255, 255, 255, Math.round(255 * 0.26)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
}

/**
 * La tira completa. Con más de seis sellos se parte en dos filas: diez
 * en una sola quedan tan chicos que no se distingue el logo.
 */
export async function dibujarTiraDeSellos({
  total,
  logrados,
  colores,
  imagen,
  escala,
}: {
  total: number;
  logrados: number;
  colores: ColoresTarjeta;
  imagen: Buffer | null;
  escala: 1 | 2 | 3;
}): Promise<Buffer> {
  const ancho = TIRA_ANCHO * escala;
  const alto = TIRA_ALTO * escala;
  const filas = total > 6 ? 2 : 1;
  const porFila = Math.ceil(total / filas);

  // Margen de seguridad: iOS recorta la tira según el ancho del
  // teléfono, y lo que toca el filo es lo primero que se pierde en una
  // pantalla angosta.
  const margenX = ancho * 0.07;
  const margenY = alto * 0.1;
  const utilX = ancho - margenX * 2;
  const utilY = alto - margenY * 2;

  const diametro = Math.max(
    8,
    Math.round(Math.min((utilX / porFila) * 0.82, (utilY / filas) * 0.86)),
  );
  const pasoX = utilX / porFila;
  const pasoY = utilY / filas;

  const piezas: OverlayOptions[] = [];
  for (let i = 0; i < total; i++) {
    const fila = Math.floor(i / porFila);
    const col = i % porFila;
    piezas.push({
      input: await selloRedondo({ diametro, encendido: i < logrados, imagen, colores }),
      left: Math.round(margenX + pasoX * col + (pasoX - diametro) / 2),
      top: Math.round(margenY + pasoY * fila + (pasoY - diametro) / 2),
    });
  }

  return sharp({ create: { width: ancho, height: alto, channels: 4, background: colores.fondo } })
    .composite(piezas)
    .png()
    .toBuffer();
}

/**
 * El logo de arriba a la izquierda: el nombre del negocio en
 * Montserrat Light, blanco. Si el negocio subió su logo se usa ese.
 */
export async function dibujarLogo({
  nombre,
  imagen,
  ancho,
  alto,
}: {
  nombre: string;
  imagen: Buffer | null;
  ancho: number;
  alto: number;
}): Promise<Buffer> {
  if (imagen) {
    return sharp(imagen)
      .trim()
      .resize(ancho, alto, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  const texto = await sharp({
    text: {
      text: nombre,
      fontfile: FUENTE,
      font: `Montserrat Light ${Math.round(alto * 0.62)}`,
      rgba: true,
      dpi: 72 * 4,
    },
  })
    .png()
    .toBuffer();

  // Se pinta blanco: el fondo de la tarjeta es oscuro.
  const blanco = await sharp(texto)
    .composite([
      {
        input: Buffer.from([255, 255, 255, 255]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "in",
      },
    ])
    .toBuffer();

  const encajado = await sharp(blanco).resize(ancho, alto, { fit: "inside" }).toBuffer();

  return sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: encajado, gravity: "west" }])
    .png()
    .toBuffer();
}

/**
 * El icono del pase. Es de BOOKEA, no del negocio: identifica al
 * emisor y se ve en notificaciones y pantalla bloqueada, no en la
 * tarjeta. Sin él el iPhone descarta el pase en silencio.
 */
export async function dibujarIcono(lado: number): Promise<Buffer> {
  return sharp(join(ASSETS, "icono-emisor.png")).resize(lado, lado).png().toBuffer();
}
