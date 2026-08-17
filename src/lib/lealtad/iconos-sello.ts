import { tipoDe } from "./tipos-tarjeta";

/**
 * LOS ICONOS DEL SELLO — doce, y ni uno más.
 *
 * ------------------------------------------------------------------
 * QUÉ PROBLEMA RESUELVEN
 * ------------------------------------------------------------------
 * Hasta hoy cada sello dibujaba el LOGO del negocio dentro de un
 * círculo (`selloRedondo` en src/lib/wallet/imagenes.ts). Eso funciona
 * cuando el logo es un símbolo compacto y falla en los dos casos más
 * comunes de un negocio de barrio: el que no tiene logo bueno —una foto
 * del rótulo, el nombre escrito— y el que tiene un logo BLANCO, que
 * sobre el círculo blanco del sello sencillamente desaparece.
 *
 * Un icono elegido de una lista corta no tiene ninguno de esos
 * problemas: es un dibujo pensado para verse a 30 píxeles.
 *
 * ------------------------------------------------------------------
 * POR QUÉ VIVE EN `lib/` Y NO EN `iconos.tsx`
 * ------------------------------------------------------------------
 * Porque el icono lo dibujan DOS motores muy distintos:
 *
 *   · React, en el creador y en la vista previa del pase;
 *   · sharp, en el servidor, para meterlo dentro de `strip.png` — que
 *     es la única forma de que el sello llegue al teléfono, porque el
 *     layout de Apple no deja poner elementos donde uno quiera.
 *
 * Por eso cada icono es una lista de atributos `d` de `<path>` y no
 * JSX: el string sirve igual dentro de un `<path d={...}/>` de React
 * que concatenado en el SVG que se le pasa a sharp. Si esto fuera JSX,
 * el servidor tendría que tener su propia copia de los trazos — y dos
 * copias de un dibujo se separan igual que dos copias de un color.
 *
 * Todos comparten el viewBox 24 y el trazo de `iconos.tsx` (1,8 de
 * grosor, puntas redondeadas), así que se ven de la misma familia que
 * el resto del panel. Sin librería de iconos: son doce dibujos, no un
 * paquete entero en el bundle.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTOS DOCE
 * ------------------------------------------------------------------
 * Salen de lo que de verdad usa una tarjeta de sellos en Costa Rica:
 * cafeterías, barberías, salones de uñas, sodas y pizzerías, bares,
 * gimnasios, floristerías, veterinarias y lavacars. `estrella`,
 * `corazon` y `regalo` son los comodines para el que no se ve en
 * ninguno de los otros nueve.
 *
 * La lista es CORTA a propósito. Cincuenta iconos son una pantalla de
 * elección que nadie termina; doce se miran de un vistazo y se elige.
 */

export const ICONOS_SELLO_ID = [
  "cafe",
  "tijera",
  "unas",
  "comida",
  "cerveza",
  "pesa",
  "flor",
  "mascota",
  "auto",
  "corazon",
  "estrella",
  "regalo",
] as const;

export type IconoSello = (typeof ICONOS_SELLO_ID)[number];

export type DibujoIcono = {
  id: IconoSello;
  /** Cómo se llama en el creador. */
  nombre: string;
  /** Los `d` de cada `<path>`, en un viewBox de 24×24. */
  trazos: readonly string[];
};

/** Una elipse como `d` de path: dos arcos, sin `<ellipse>`. */
function elipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx} ${cy - ry}a${rx} ${ry} 0 1 0 0 ${ry * 2}a${rx} ${ry} 0 1 0 0 ${-ry * 2}`;
}

/** Un círculo: la elipse con los dos radios iguales. */
function circulo(cx: number, cy: number, r: number): string {
  return elipse(cx, cy, r, r);
}

/** Los cinco pétalos de la flor, alrededor del centro. */
const PETALOS = [
  [12, 6.2],
  [16.1, 9.2],
  [14.5, 14],
  [9.5, 14],
  [7.9, 9.2],
].map(([cx, cy]) => circulo(cx, cy, 2.4));

/**
 * Las cuatro almohadillas de los dedos de la huella.
 *
 * Elípticas y BIEN separadas: pegadas y redondas, las cuatro se leían
 * como una cara —dos ojos y dos orejas— en vez de como una pata.
 */
const DEDOS = [
  [6.5, 10.8],
  [9.9, 7.3],
  [14.1, 7.3],
  [17.5, 10.8],
].map(([cx, cy]) => elipse(cx, cy, 1.7, 2.1));

export const ICONOS_SELLO: Record<IconoSello, DibujoIcono> = {
  cafe: {
    id: "cafe",
    nombre: "Café",
    trazos: [
      "M5 8.6h11v5.2a5.2 5.2 0 0 1-5.2 5.2h-.6A5.2 5.2 0 0 1 5 13.8z",
      "M16 10.2h1.5a2.4 2.4 0 0 1 0 4.8H16",
      "M3.5 21.4h14",
      "M8.6 5.6c0-1 1-1.4 1-2.6",
      "M12.2 5.6c0-1 1-1.4 1-2.6",
    ],
  },
  tijera: {
    id: "tijera",
    nombre: "Barbería",
    trazos: [circulo(6, 6, 3), circulo(6, 18, 3), "M20 4 8.12 15.88", "M14.47 14.48 20 20", "M8.12 8.12 12 12"],
  },
  unas: {
    id: "unas",
    nombre: "Uñas",
    // Un frasco de esmalte: cuerpo ANCHO y tapa angosta. Con el cuerpo
    // flaco de la primera versión, a 30 píxeles se leía como una pila.
    trazos: [
      "M11 2.6h2a2 2 0 0 1 2 2v2.2H9V4.6a2 2 0 0 1 2-2z",
      "M10.6 6.8h2.8v2.6h-2.8z",
      "M9.4 9.4h5.2a2.6 2.6 0 0 1 2.6 2.6v6.8a2.6 2.6 0 0 1-2.6 2.6H9.4a2.6 2.6 0 0 1-2.6-2.6V12a2.6 2.6 0 0 1 2.6-2.6z",
    ],
  },
  comida: {
    id: "comida",
    nombre: "Comida",
    // Porción de pizza: la corteza abajo y dos pepperonis grandes. Los
    // dos detalles son los que la separan de un triángulo de peligro.
    trazos: [
      "M12 2.6 20 20.4a1 1 0 0 1-1.3 1.4 20 20 0 0 0-13.4 0A1 1 0 0 1 4 20.4z",
      "M7.4 16.4q4.6 1.5 9.2 0",
      circulo(10.4, 10.2, 1.35),
      circulo(13.5, 14, 1.35),
    ],
  },
  cerveza: {
    id: "cerveza",
    nombre: "Cerveza",
    trazos: [
      "M5.5 8.5h9v10.9a1.6 1.6 0 0 1-1.6 1.6H7.1a1.6 1.6 0 0 1-1.6-1.6z",
      "M14.5 10.6h2.6a2.6 2.6 0 0 1 0 5.2h-2.6",
      "M5.5 8.5a2.1 2.1 0 0 1 1.3-3.7 2.6 2.6 0 0 1 4.5-1.4 2.3 2.3 0 0 1 3.2 5.1",
      "M8.5 12.2v5.6",
      "M11.5 12.2v5.6",
    ],
  },
  pesa: {
    id: "pesa",
    nombre: "Gimnasio",
    trazos: ["M4.2 9.6v4.8", "M6.8 7.6v8.8", "M17.2 7.6v8.8", "M19.8 9.6v4.8", "M6.8 12h10.4"],
  },
  flor: {
    id: "flor",
    nombre: "Flores",
    trazos: [...PETALOS, circulo(12, 10.4, 1.7), "M12 16.6V21.4"],
  },
  mascota: {
    id: "mascota",
    nombre: "Mascotas",
    trazos: [
      ...DEDOS,
      "M12 13.4c3.1 0 5.1 2.1 5.1 4.4 0 2.1-1.8 3.4-3.6 3.4-.6 0-1.1-.2-1.5-.2s-.9.2-1.5.2c-1.8 0-3.6-1.3-3.6-3.4 0-2.3 2-4.4 5.1-4.4z",
    ],
  },
  auto: {
    id: "auto",
    nombre: "Autos",
    trazos: [
      "M2.8 15.8v-2.8a1.6 1.6 0 0 1 .2-.8l2-3.8a2 2 0 0 1 1.8-1.1h10.4a2 2 0 0 1 1.8 1.1l2 3.8a1.6 1.6 0 0 1 .2.8v2.8z",
      "M4.6 12.2h14.8",
      circulo(7.6, 16.6, 1.9),
      circulo(16.4, 16.6, 1.9),
    ],
  },
  corazon: {
    id: "corazon",
    nombre: "Corazón",
    trazos: [
      "M12 20.8 4.4 13.2a4.9 4.9 0 0 1 6.9-7l.7.7.7-.7a4.9 4.9 0 0 1 6.9 7z",
    ],
  },
  estrella: {
    id: "estrella",
    nombre: "Estrella",
    // El mismo trazo que ya usaba `estrella` en iconos.tsx: no se
    // redibuja, se comparte (ese archivo lee de acá).
    trazos: ["M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.1 6.6 20l1-6.1L3.2 9.6l6.1-.9z"],
  },
  regalo: {
    id: "regalo",
    nombre: "Regalo",
    // Idem `regalo` de iconos.tsx, con el `<rect>` de la tapa escrito
    // como path para que sirva igual del lado de sharp.
    trazos: [
      "M3.7 8h16.6a1.2 1.2 0 0 1 1.2 1.2v2.1a1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2V9.2A1.2 1.2 0 0 1 3.7 8z",
      "M4.5 12.5V21h15v-8.5",
      "M12 8v13",
      "M12 8S9.8 3 7.8 4.3 8.9 8 12 8Z",
      "M12 8s2.2-5 4.2-3.7S15.1 8 12 8Z",
    ],
  },
};

export const ICONOS_SELLO_LISTA: readonly DibujoIcono[] = ICONOS_SELLO_ID.map(
  (id) => ICONOS_SELLO[id],
);

/** ¿Es uno de los doce? Lo que decide qué puede llegar a la base. */
export function esIconoSello(valor: unknown): valor is IconoSello {
  return typeof valor === "string" && (ICONOS_SELLO_ID as readonly string[]).includes(valor);
}

// ── EL ICONO PROPIO DEL NEGOCIO (0174) ─────────────────────────────
//
// Los doce cubren a la mayoría, y no alcanzan: la veterinaria con su
// perro dibujado, la marca que ya tiene su símbolo hecho y el rubro que
// no está en la lista (una lavandería, una óptica) quedaban eligiendo
// entre «una estrella» y «mi logo». Por eso hay una opción más: el
// negocio sube SU dibujo.
//
// Se guarda en DOS columnas y no en una:
//
//   · `pase_sello_icono` dice QUÉ se eligió — uno de los doce, o el
//     centinela 'propio', o null (el logo, como siempre);
//   · `pase_sello_icono_url` guarda el ARCHIVO subido.
//
// Separarlas es lo que hace que el archivo sobreviva a un cambio de
// idea: el dueño sube su ícono, prueba «Café» un rato y vuelve a lo
// suyo sin tener que subirlo de nuevo. Con un solo campo, elegir otra
// cosa lo borraría.

/** El valor que guarda la columna cuando el sello es el ícono subido. */
export const SELLO_PROPIO = "propio" as const;

/** Lo que puede haber en `pase_sello_icono`: uno de los doce, o el propio. */
export type SelloElegido = IconoSello | typeof SELLO_PROPIO;

export function esSelloElegido(valor: unknown): valor is SelloElegido {
  return valor === SELLO_PROPIO || esIconoSello(valor);
}

/**
 * Hasta dónde se acepta una URL de ícono propio AL LEERLA.
 *
 * Que sea de NUESTRO storage lo comprueban las server actions al
 * GUARDAR (`esUrlDeNuestroStorage`), que es donde se puede rechazar con
 * un mensaje en español. Acá el filtro es el de la lectura: https, sin
 * caracteres que puedan cerrar un atributo, y de un largo razonable —
 * porque esta cadena termina en un `fetch` del generador del pase y en
 * el `src` de una vista previa.
 */
const MAX_URL_ICONO = 500;

export function urlDeIconoPropio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpia = valor.trim();
  if (!limpia || limpia.length > MAX_URL_ICONO) return null;
  return /^https:\/\/[^\s"'<>]+$/i.test(limpia) ? limpia : null;
}

/**
 * QUÉ SE DIBUJA ADENTRO DE CADA SELLO, resuelto en un solo lugar.
 *
 * Las tres puertas —el creador, el editor y el lector de la fila— y los
 * dos motores que dibujan —React en la vista previa, sharp en el pase—
 * preguntan acá. Con la regla escrita dos veces, alcanza con que una
 * copia se quede vieja para que la pantalla prometa un sello y el
 * teléfono muestre otro.
 */
export type DibujoDelSello =
  /** El logo del negocio adentro del círculo: el comportamiento de siempre. */
  | { clase: "logo" }
  /** Uno de los doce dibujos del catálogo. */
  | { clase: "icono"; icono: IconoSello }
  /** El archivo que subió el negocio (0174). */
  | { clase: "propio"; url: string };

export function selloDelPase({
  tipo,
  icono,
  url,
}: {
  tipo: unknown;
  icono: unknown;
  url: unknown;
}): DibujoDelSello {
  // Las mismas dos reglas de `iconoDelSello`: solo las tarjetas de
  // sellos tienen círculos que llenar, y un valor fuera de catálogo se
  // descarta en vez de dibujarse vacío en el teléfono de un cliente.
  if (tipoDe(typeof tipo === "string" ? tipo : null) !== "sellos") return { clase: "logo" };

  if (icono === SELLO_PROPIO) {
    const limpia = urlDeIconoPropio(url);
    // 'propio' sin archivo no es un sello: es el de siempre. La base lo
    // impide con un CHECK (0174), pero una fila a medio migrar o una
    // petición armada a mano no son imposibles.
    return limpia ? { clase: "propio", url: limpia } : { clase: "logo" };
  }

  return esIconoSello(icono) ? { clase: "icono", icono } : { clase: "logo" };
}

/**
 * Las DOS columnas, ya coherentes entre sí, para guardar.
 *
 * Es el filtro del lado de la escritura, y tiene una diferencia
 * deliberada con la lectura: el archivo subido se CONSERVA aunque el
 * dueño esté eligiendo uno de los doce. Es su ícono, no un valor
 * temporal — borrarlo por probar «Café» un minuto lo obligaría a
 * subirlo otra vez.
 *
 * En un tipo que no es sellos se limpian las dos: no hay círculos donde
 * dibujar nada, y arrastrar el dato dejaría basura invisible que algún
 * día alguien pinta (la misma decisión que tomó la 0145).
 */
export function selloParaGuardar({
  tipo,
  icono,
  url,
}: {
  tipo: unknown;
  icono: unknown;
  url: unknown;
}): { icono: SelloElegido | null; url: string | null } {
  if (tipoDe(typeof tipo === "string" ? tipo : null) !== "sellos") {
    return { icono: null, url: null };
  }

  const limpia = urlDeIconoPropio(url);
  if (icono === SELLO_PROPIO) {
    return limpia ? { icono: SELLO_PROPIO, url: limpia } : { icono: null, url: null };
  }
  return { icono: esIconoSello(icono) ? icono : null, url: limpia };
}

/**
 * El icono que de verdad lleva un programa, con las dos reglas juntas.
 *
 * Se usa en las tres puertas —el creador, el editor y el lector de la
 * fila (`tarjetaDesdeFila`)— para que ninguna pueda tener su propia
 * versión de la regla:
 *
 *   · un valor que no está en la lista se descarta (una fila vieja, una
 *     petición armada a mano, un icono que se borró del catálogo);
 *   · un tipo que no es sellos NO lleva icono, aunque la columna traiga
 *     uno. Una gift card no tiene círculos que llenar, y arrastrar el
 *     dato dejaría basura invisible que algún día alguien dibuja.
 *
 * Sin nada válido devuelve null, y null es el comportamiento de
 * siempre: el sello con el logo del negocio.
 */
export function iconoDelSello({ tipo, icono }: { tipo: unknown; icono: unknown }): IconoSello | null {
  if (tipoDe(typeof tipo === "string" ? tipo : null) !== "sellos") return null;
  return esIconoSello(icono) ? icono : null;
}

/**
 * ¿QUÉ IMAGEN va DENTRO de cada sello, si es que va alguna?
 *
 *   · "propio" — el archivo que subió el negocio (0174);
 *   · "logo"   — su logo, que es lo que hicieron todas las tarjetas
 *                emitidas antes de la 0145;
 *   · null     — ninguna: o el sello es uno de los doce dibujos (que se
 *                pinta con trazos, no con un archivo) o es el círculo
 *                liso del color del negocio.
 *
 * Importa más de lo que parece, porque de acá sale la escalera de
 * degradación de la tira (`escalonesDeLaTira`): su último escalón
 * existe para sobrevivir a una imagen que sharp no puede procesar —el
 * caso real es un logo blanco sobre blanco, y un ícono propio corre
 * exactamente el mismo riesgo—. Cuando NO hay imagen adentro del sello
 * ese escalón sería un reintento idéntico al anterior, y no se ofrece.
 */
export function imagenDentroDelSello({
  sello,
  hayLogo,
}: {
  sello: DibujoDelSello;
  hayLogo: boolean;
}): "logo" | "propio" | null {
  if (sello.clase === "propio") return "propio";
  if (sello.clase === "icono") return null;
  return hayLogo ? "logo" : null;
}
