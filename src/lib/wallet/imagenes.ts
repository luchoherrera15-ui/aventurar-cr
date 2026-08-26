import sharp, { type OverlayOptions } from "sharp";
import { join } from "node:path";
import { ICONOS_SELLO, type IconoSello } from "@/lib/lealtad/iconos-sello";
import { CONFIG_CLASICA, layoutDeLaTira } from "./layout-tira";

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

/**
 * El velo oscuro que va entre la foto del negocio y los sellos.
 *
 * Sin él, sobre una foto clara los sellos apagados desaparecen y el
 * cliente pierde justo el dato que lo hace volver: cuántos le faltan.
 * Y el negocio sube la foto que quiera —no hay forma de pedirle que sea
 * oscura—, así que el contraste lo tiene que garantizar el pase.
 */
const VELO_SOBRE_LA_BANDA = 0.42;

export type ColoresTarjeta = { fondo: string; sello: string };

/**
 * La foto del negocio a la medida exacta del strip, SIN deformarla: se
 * agranda hasta cubrir y se recorta lo que sobra, centrado.
 *
 * El `rotate()` sin argumentos aplica la orientación EXIF, y va antes
 * del resize porque sharp lo exige así. No es un detalle: una foto
 * tomada con el celular en vertical llega con los píxeles acostados y
 * la orientación en los metadatos — sin esto sale de lado en el pase.
 */
async function recortarACover(imagen: Buffer, ancho: number, alto: number): Promise<Buffer> {
  return sharp(imagen)
    .rotate()
    .resize(ancho, alto, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

/**
 * La banda sola: la foto del negocio ocupando todo el strip.
 *
 * Es lo que se dibuja en los siete tipos que no son sellos, donde no
 * hay círculos que poner encima.
 */
export async function dibujarBanda({
  imagen,
  escala,
}: {
  imagen: Buffer;
  escala: 1 | 2 | 3;
}): Promise<Buffer> {
  return recortarACover(imagen, TIRA_ANCHO * escala, TIRA_ALTO * escala);
}

/**
 * Un sello: la imagen del negocio recortada en círculo. El apagado NO
 * se borra — queda tenue para que el cliente vea cuántos le faltan.
 * Esa diferencia entre "llevás 5" y "te faltan 5" es lo que hace
 * volver, así que no es un detalle estético.
 *
 * `imagen` es el LOGO del negocio o —desde la 0174— el ÍCONO PROPIO que
 * subió. Las dos se dibujan igual y a propósito: este camino es el que
 * ya funciona en teléfonos de verdad (fondo blanco, `trim` del margen
 * sobrante, encaje al 62% del círculo y los dos estados resueltos), y
 * un ícono propio no es más que otra imagen del negocio metida ahí.
 */
async function selloRedondo({
  diametro,
  encendido,
  imagen,
  colores,
}: {
  diametro: number;
  encendido: boolean;
  /** Logo del negocio o ícono propio. Sin él se dibuja un círculo liso. */
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
    //
    // El encaje sube a 0.90 (antes 0.62): el pedido es que el sello SEA
    // el dibujo, no un ícono chico flotando en el círculo. La caja de
    // encaje es cuadrada y la máscara final es un círculo, así que queda
    // un 10% de margen a propósito — un dibujo cuadrado-ish que toque
    // las cuatro esquinas de su propio recorte podría perder una punta
    // contra la máscara, pero un dibujo de un solo sujeto (un vaso, una
    // hoja, un animal) casi nunca llena así su bounding box. Se prefiere
    // ese riesgo bajo a la certeza de un ícono que se sigue viendo chico.
    const contenido = await sharp(imagen)
      .trim()
      .resize(Math.round(diametro * 0.9), Math.round(diametro * 0.9), {
        fit: "inside",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      // El apagado ya NO es transparencia sobre el círculo entero (eso
      // hacía el dibujo más difícil de ver, no más oscuro): acá se
      // desatura y se oscurece el dibujo de verdad, ANTES de componerlo
      // en el círculo. El fondo blanco se queda igual en los dos
      // estados — con el dibujo ocupando ~90% del círculo, oscurecerlo
      // siempre lo hace más visible contra ese blanco, nunca menos.
      .modulate(encendido ? {} : { saturation: 0.25, brightness: 0.45 })
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

  // El respaldo sin logo ni ícono (disco liso en `colores.sello`) sigue
  // el criterio viejo de alfa al 26%: no es parte de este pedido —el
  // dueño se quejó del ícono propio, no de este disco— así que su
  // comportamiento no cambia. Con `imagen`, el estado apagado/encendido
  // ya quedó resuelto arriba con `.modulate()`, y `circulo` se devuelve
  // siempre opaco.
  if (imagen || encendido) return circulo;

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
 * Un color que se puede meter dentro de un SVG sin miedo.
 *
 * Los colores del pase salen de una columna de texto, y acá se
 * concatenan en MARKUP: un valor con una comilla cerraría el atributo y
 * lo que siguiera sería etiquetas. La 0122 ya exige `#RRGGBB` con un
 * CHECK y las dos pantallas lo validan antes de guardar, pero una fila
 * vieja o una base sin ese CHECK no son imposibles — y el costo de
 * comprobarlo acá es una expresión regular.
 */
function hexSeguro(valor: string, respaldo: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(valor) ? valor : respaldo;
}

/**
 * UN SELLO CON ICONO: el círculo con el dibujo adentro.
 *
 * LLENO el que ya se ganó, CONTORNO el que falta. Es la decisión que
 * más se nota del módulo: en una tira de diez, el disco macizo y el aro
 * vacío se distinguen de un vistazo y a un metro de distancia —lo que
 * pasa de verdad cuando alguien mira su teléfono en la fila de la caja—
 * mientras que el mismo círculo a dos opacidades hay que compararlo
 * contra el de al lado para contarlo.
 *
 * Se dibuja como UN solo SVG y se rasteriza de una: los trazos son
 * curvas, y componer curvas con capas de sharp costaría un archivo
 * entero para llegar al mismo pixel.
 *
 * El icono va escalado dentro del círculo con el grosor COMPENSADO
 * (`1.6 / ESCALA_GLIFO`): al escalar un grupo, SVG escala también el
 * trazo, y sin compensar el dibujo saldría con una línea más fina que
 * la del resto del panel — que a 30 píxeles es la diferencia entre un
 * icono y una mancha.
 */
const ESCALA_GLIFO = 0.58;

function svgDelSello({
  diametro,
  encendido,
  icono,
  colores,
}: {
  diametro: number;
  encendido: boolean;
  icono: IconoSello;
  colores: ColoresTarjeta;
}): Buffer {
  const acento = hexSeguro(colores.sello, "#FFFFFF");
  // El glifo del sello LLENO se cala en el color del fondo del pase, que
  // es lo que hay detrás de la tira: se lee como un troquel, no como un
  // segundo color inventado.
  const glifo = encendido ? hexSeguro(colores.fondo, "#000000") : acento;
  const grosorAro = 1.6;
  const radio = encendido ? 11.4 : 12 - grosorAro / 2;
  const trazos = ICONOS_SELLO[icono].trazos.map((d) => `<path d="${d}"/>`).join("");

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${diametro}" height="${diametro}" viewBox="0 0 24 24">` +
      `<circle cx="12" cy="12" r="${radio}" fill="${encendido ? acento : "none"}"` +
      (encendido ? "" : ` stroke="${acento}" stroke-width="${grosorAro}"`) +
      `/>` +
      `<g fill="none" stroke="${glifo}" stroke-width="${(1.6 / ESCALA_GLIFO).toFixed(2)}"` +
      ` stroke-linecap="round" stroke-linejoin="round"` +
      ` transform="translate(12 12) scale(${ESCALA_GLIFO}) translate(-12 -12)">${trazos}</g>` +
      `</svg>`,
  );
}

async function selloConIcono(opciones: {
  diametro: number;
  encendido: boolean;
  icono: IconoSello;
  colores: ColoresTarjeta;
}): Promise<Buffer> {
  return sharp(svgDelSello(opciones)).png().toBuffer();
}

/**
 * La tira completa. Con más de seis sellos se parte en dos filas: diez
 * en una sola quedan tan chicos que no se distingue el logo.
 *
 * `banda` es la foto que el negocio subió (0132). Cuando viene, los
 * sellos se dibujan ENCIMA de ella en vez de sobre el color plano: en
 * Apple el strip es un solo archivo, así que o se combinan las dos
 * cosas o el negocio tiene que elegir entre su foto y su progreso.
 */
export async function dibujarTiraDeSellos({
  total,
  logrados,
  colores,
  imagen,
  banda,
  escala,
  icono = null,
}: {
  total: number;
  logrados: number;
  colores: ColoresTarjeta;
  /**
   * Lo que va DENTRO de cada círculo: el logo del negocio, o el ícono
   * propio que subió (0174). Quién de los dos lo decide `generar.ts`
   * con `imagenDentroDelSello` — acá los dos se dibujan igual.
   */
  imagen: Buffer | null;
  /** Foto de fondo. null = el color del negocio, como antes de la 0132. */
  banda: Buffer | null;
  escala: 1 | 2 | 3;
  /**
   * El icono elegido (0145). Cuando viene, MANDA sobre `imagen`: el
   * sello es el dibujo, no el logo.
   *
   * Por defecto null, y eso es lo que mantiene intacto al negocio que
   * ya tiene su tarjeta emitida: sin icono, esta función dibuja
   * exactamente lo mismo que dibujaba antes de existir el parámetro.
   */
  icono?: IconoSello | null;
}): Promise<Buffer> {
  /**
   * ⚠️ EL CÁLCULO DEL LAYOUT SE MUDÓ A `layout-tira.ts`.
   *
   * Estaba escrito acá a mano —filas, márgenes, diámetro, pasos— y
   * ADEMÁS estaba escrito otra vez, distinto, en `vista-pase.tsx` para
   * la vista previa del navegador. Dos algoritmos para el mismo dibujo:
   * el dueño diseñaba mirando uno y su cliente recibía el otro.
   *
   * Ahora los dos llaman a la misma función pura. Los tests de
   * `layout-tira.test.ts` comparan el resultado contra el algoritmo
   * viejo, píxel por píxel, en 11 metas × 3 escalas: ninguna tarjeta ya
   * emitida cambia de aspecto por este refactor.
   *
   * Los porqués que vivían en este bloque —el margen horizontal fijo en
   * 7 % por el recorte de iOS, los factores 0,88/0,90 del diámetro— se
   * mudaron con él y siguen escritos allá.
   */
  const ancho = TIRA_ANCHO * escala;
  const alto = TIRA_ALTO * escala;
  const layout = layoutDeLaTira(total, CONFIG_CLASICA, ancho, alto);
  const { diametro } = layout;

  const piezas: OverlayOptions[] = [];

  // La foto va primero y el velo en el medio: las dos ocupan el strip
  // entero, así que se posicionan en 0,0 y no por gravedad.
  if (banda) {
    piezas.push({ input: await recortarACover(banda, ancho, alto), left: 0, top: 0 });
    piezas.push({
      input: Buffer.from([0, 0, 0, Math.round(255 * VELO_SOBRE_LA_BANDA)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      left: 0,
      top: 0,
    });
  }

  // Los sellos con icono son DOS dibujos —el lleno y el vacío— y no
  // treinta: se rasterizan una vez y se repiten. Con una tarjeta de 30
  // sellos por tres escalas, hacerlo adentro del bucle son 90 pasadas
  // de sharp para producir dos imágenes distintas.
  const conIcono = icono
    ? {
        lleno: await selloConIcono({ diametro, encendido: true, icono, colores }),
        vacio: await selloConIcono({ diametro, encendido: false, icono, colores }),
      }
    : null;

  /**
   * ⚠️ LO MISMO PARA EL CAMINO DEL LOGO, QUE SE HABÍA QUEDADO AFUERA.
   *
   * `selloRedondo` estaba DENTRO del bucle, una llamada por sello. Pero
   * su resultado depende de `{diametro, encendido, imagen, colores}` y
   * los cuatro son constantes acá — salvo `encendido`. O sea que había
   * exactamente DOS imágenes distintas y se rasterizaban `total` veces.
   *
   * Y es el camino MÁS caro de los dos: con logo, `selloRedondo` hace
   * `trim() + resize() + modulate() + composite() + png()` por llamada,
   * mientras que el de ícono parte de un SVG.
   *
   * Una tarjeta de 10 sellos con logo, por las tres escalas que pide
   * Apple, eran 30 pasadas de sharp para producir dos imágenes. Ahora
   * son 2 por escala, 6 en total.
   *
   * El razonamiento es el mismo que el bloque de arriba, escrito para
   * los íconos y que nunca se copió acá.
   */
  const conLogo = !conIcono
    ? {
        lleno: await selloRedondo({ diametro, encendido: true, imagen, colores }),
        vacio: await selloRedondo({ diametro, encendido: false, imagen, colores }),
      }
    : null;

  for (let i = 0; i < total; i++) {
    const encendido = i < logrados;
    const par = conIcono ?? conLogo!;
    const { x, y } = layout.posiciones[i];
    piezas.push({ input: encendido ? par.lleno : par.vacio, left: x, top: y });
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
/**
 * La INICIAL de un negocio, para el ícono de respaldo.
 *
 * `[...nombre]` y no `nombre[0]`: partir por índice corta a la mitad
 * los emojis y los caracteres fuera del plano básico, y un negocio que
 * se llama "🌿 Pura Matcha" terminaría con medio símbolo roto.
 *
 * Hasta DOS letras: las iniciales de las dos primeras palabras
 * ("Pura Matcha" → "PM"), que es como la gente abrevia un negocio. Con
 * una sola palabra, una sola letra — "PU" de "Pura" no lo abrevia
 * nadie.
 */
export function inicialesDe(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => /\p{L}|\p{N}/u.test(p));
  if (palabras.length === 0) return "B";
  if (palabras.length === 1) return [...palabras[0]][0].toUpperCase();
  return (
    [...palabras[0]][0].toUpperCase() + [...palabras[1]][0].toUpperCase()
  );
}

/**
 * EL ÍCONO DEL PASE DE APPLE.
 *
 * ── QUÉ ES ESTA IMAGEN, QUE NO ES OBVIO ────────────────────────────
 * No es el logo grande de la tarjeta (eso es `logo.png`). Es el
 * cuadradito de 29px que el iPhone pone al lado de CADA AVISO del
 * pase: cuando le acreditan un sello, cuando el negocio manda un
 * anuncio, cuando el pase cambia. Es lo que la persona ve en la
 * pantalla bloqueada.
 *
 * ── POR QUÉ CAMBIÓ ─────────────────────────────────────────────────
 * Acá había una sola línea que siempre devolvía `icono-emisor.png`, el
 * ícono de Bookea. Resultado: al negocio le llegaba su propio anuncio
 * con NUESTRO logo al lado. El dueño lo vio en un teléfono real: «sale
 * el logo de Bookea y luego el anuncio de Pura Matcha».
 *
 * Ahora es del negocio: su logo si lo subió, y si no, sus iniciales
 * sobre el color de su tarjeta. Bookea es la cañería, no la marca del
 * mostrador.
 *
 * Nunca lanza: si el logo del negocio viene roto o sharp no lo puede
 * leer, cae al ícono de siempre. Un pase sin `icon.png` lo RECHAZA el
 * iPhone entero (ver `empaquetar.ts`), así que acá no hay lugar para
 * que una imagen mala deje a alguien sin pase.
 */
/**
 * ════════════════════════════════════════════════════════════════════
 *  EL ÍCONO DE RESPALDO, DIBUJADO UNA VEZ POR TAMAÑO
 * ════════════════════════════════════════════════════════════════════
 *
 * `icono-emisor.png` redimensionado a `lado` es COMPLETAMENTE
 * determinístico: mismo archivo del disco, mismo tamaño, mismo PNG de
 * salida. Y se pide en dos caminos muy transitados — el negocio sin
 * logo, y el `catch` de cuando el logo del negocio no se puede
 * procesar.
 *
 * Cada llamada abría el archivo, lo decodificaba, lo redimensionaba y
 * lo volvía a codificar a PNG con `sharp`. Por pase, y por cada uno de
 * los tres tamaños que pide Apple (1×, 2×, 3×).
 *
 * El caché va por TAMAÑO porque el resultado depende de él. Son tres
 * entradas de unos pocos KB que viven lo que viva el contenedor.
 *
 * ⚠️ Solo cachea el camino SIN negocio o con el logo caído. El ícono
 * con logo propio NO se cachea: depende del logo de cada negocio, y
 * guardarlo por `lado` serviría el logo de un negocio a otro.
 */
const cacheIconoEmisor = new Map<number, Buffer>();

async function iconoDeRespaldo(lado: number): Promise<Buffer> {
  const guardado = cacheIconoEmisor.get(lado);
  if (guardado) return guardado;

  const png = await sharp(join(ASSETS, "icono-emisor.png"))
    .resize(lado, lado)
    .png()
    .toBuffer();
  cacheIconoEmisor.set(lado, png);
  return png;
}

export async function dibujarIcono(
  lado: number,
  negocio?: { nombre: string; logo: Buffer | null; colorFondo?: string | null },
): Promise<Buffer> {
  if (!negocio) {
    return iconoDeRespaldo(lado);
  }

  if (negocio.logo) {
    try {
      // `contain` y no `cover`: un logo recortado deja de ser el logo.
      // El fondo va blanco porque el ícono se ve sobre la superficie
      // del sistema, que en modo claro también es blanca.
      return await sharp(negocio.logo)
        .trim()
        .resize(lado, lado, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .flatten({ background: "#ffffff" })
        .png()
        .toBuffer();
    } catch {
      // Sigue abajo con las iniciales.
    }
  }

  const fondo = /^#[0-9a-fA-F]{6}$/.test(negocio.colorFondo ?? "")
    ? negocio.colorFondo!
    : "#10203a";
  const iniciales = inicialesDe(negocio.nombre);

  try {
    const texto = await sharp({
      text: {
        text: iniciales,
        fontfile: FUENTE,
        // Las iniciales ocupan poco más de la mitad del lado: pegadas
        // al borde se ven apretadas a 29px, que es el tamaño real.
        font: `Montserrat Bold ${Math.round(lado * 0.52)}`,
        rgba: true,
        dpi: 72 * 4,
      },
    })
      .png()
      .toBuffer();

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

    const encajado = await sharp(blanco)
      .resize(Math.round(lado * 0.62), Math.round(lado * 0.62), { fit: "inside" })
      .toBuffer();

    return await sharp({
      create: { width: lado, height: lado, channels: 4, background: fondo },
    })
      .composite([{ input: encajado, gravity: "center" }])
      .png()
      .toBuffer();
  } catch {
    return iconoDeRespaldo(lado);
  }
}
