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

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS DOCE DIBUJOS — redibujados de cero (ago 2026)
 * ════════════════════════════════════════════════════════════════════
 *
 * El dueño fue textual: «LOS ICONOS SON SUMAMENTE FEOS». Se
 * rasterizaron los viejos al tamaño REAL al que salen en el pase
 * —dentro de un círculo de ~34 px en la tira— y tenía razón, con
 * creces: la pizza se leía como un TRIÁNGULO DE PELIGRO, la huella de
 * mascota como una calavera, la flor como un brócoli, y la tijera como
 * una equis con dos puntos.
 *
 * ── LA CAUSA DE FONDO, QUE NO ES OBVIA LEYENDO EL ARCHIVO ───────────
 *
 * `svgDelSello` (imagenes.ts) encoge el glifo al 58 % del círculo y
 * COMPENSA engordando el trazo (`1.6 / ESCALA_GLIFO`). O sea que el
 * dibujo llega chico y gordo: cualquier detalle interno se empasta.
 *
 * El criterio nuevo sale de ahí, y es lo que hace que los doce parezcan
 * por fin de la misma familia:
 *
 *   · Caja óptica de 17-19 unidades centrada en (12,12), con 2 unidades
 *     de margen por lado como mínimo. Los viejos se salían —`regalo`
 *     medía 21,8 de ancho y `comida` llegaba a y=23,3— y la máscara
 *     circular les comía las puntas.
 *   · Pocos trazos y ninguno interior. La silueta tiene que hacer todo
 *     el trabajo, porque a 34 px el interior no existe.
 *   · Mismo peso óptico entre los doce: la pesa vieja eran cinco líneas
 *     sueltas al lado de un café de cinco paths amontonados.
 *
 * ── LOS DOS QUE NO SE TOCARON ───────────────────────────────────────
 * `corazon` y `estrella` ya estaban bien: son un polígono cerrado sin
 * detalle interno, que es exactamente lo que este tamaño pide. Solo se
 * recentraron en la caja óptica.
 *
 * ⚠️ CAMBIAR ESTOS DIBUJOS CAMBIA EL ASPECTO DE LAS TARJETAS YA
 * EMITIDAS. Se redibujan en el teléfono del cliente la próxima vez que
 * gana un sello. Fue un cambio PEDIDO, y por eso las huellas de
 * `tiras-emitidas.test.ts` se actualizaron a propósito para los casos
 * con ícono. Si algún día cambian sin que nadie lo pida, esa prueba lo
 * delata.
 *
 * Los helpers `elipse`/`circulo` y las constantes `PETALOS`/`DEDOS` que
 * vivían acá se fueron con los dibujos viejos: los doce nuevos son
 * paths literales, medidos uno por uno.
 */
export const ICONOS_SELLO: Record<IconoSello, DibujoIcono> = {
  cafe: {
    id: "cafe",
    nombre: "Café",
    trazos: [
      "M5 10.6h10.4v6.6a2.8 2.8 0 0 1-2.8 2.8H7.8a2.8 2.8 0 0 1-2.8-2.8z",
      "M15.4 12.2h1a3 3 0 0 1 0 6h-1",
      "M8.4 6.4q-1.2-1.5 0-3",
      "M13.6 6.4q-1.2-1.5 0-3",
    ],
  },
  tijera: {
    id: "tijera",
    nombre: "Barbería",
    trazos: [
      "M6.8 3.9a3.1 3.1 0 1 0 0 6.2a3.1 3.1 0 1 0 0 -6.2",
      "M6.8 13.9a3.1 3.1 0 1 0 0 6.2a3.1 3.1 0 1 0 0 -6.2",
      "M9 9.2 19.4 19.6",
      "M9 14.8 19.4 4.4",
    ],
  },
  unas: {
    id: "unas",
    nombre: "Uñas",
    trazos: [
      "M11.2 4.6a0.8 0.8 0 0 1 1.6 0v3a0.8 0.8 0 0 1-1.6 0z",
      "M9.4 9.4h5.2l2.2 2.2a2.4 2.4 0 0 1 .7 1.7v4.3a2.4 2.4 0 0 1-2.4 2.4H8.9a2.4 2.4 0 0 1-2.4-2.4v-4.3a2.4 2.4 0 0 1 .7-1.7z",
    ],
  },
  comida: {
    id: "comida",
    nombre: "Comida",
    trazos: [
      "M4 17.2h16",
      "M5.1 17.2a6.9 6.9 0 0 1 13.8 0",
      "M12 10.3V6.7",
    ],
  },
  cerveza: {
    id: "cerveza",
    nombre: "Cerveza",
    trazos: [
      "M6 8h9.6v9.6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z",
      "M15.6 10.4h1a2.9 2.9 0 0 1 0 5.8h-1",
      "M5 8a2.3 2.3 0 1 1 3.8 0 2.3 2.3 0 1 1 3.8 0 2.3 2.3 0 1 1 3.8 0",
    ],
  },
  pesa: {
    id: "pesa",
    nombre: "Gimnasio",
    trazos: [
      "M4.8 8.8a0.8 0.8 0 0 1 1.6 0v6.4a0.8 0.8 0 0 1-1.6 0z",
      "M17.6 8.8a0.8 0.8 0 0 1 1.6 0v6.4a0.8 0.8 0 0 1-1.6 0z",
      "M7.4 12h9.2",
    ],
  },
  flor: {
    id: "flor",
    nombre: "Flores",
    trazos: [
      "M10.59 10.06a2.8 2.8 0 1 1 2.82 0a2.8 2.8 0 1 1 .87 2.68a2.8 2.8 0 1 1-2.28 1.66a2.8 2.8 0 1 1-2.28-1.66a2.8 2.8 0 1 1 .87-2.68z",
    ],
  },
  mascota: {
    id: "mascota",
    nombre: "Mascotas",
    trazos: [
      "M5.2 8.5a0.7 0.7 0 1 0 0 1.4a0.7 0.7 0 1 0 0 -1.4",
      "M9.4 4.7a0.7 0.7 0 1 0 0 1.4a0.7 0.7 0 1 0 0 -1.4",
      "M14.6 4.7a0.7 0.7 0 1 0 0 1.4a0.7 0.7 0 1 0 0 -1.4",
      "M18.8 8.5a0.7 0.7 0 1 0 0 1.4a0.7 0.7 0 1 0 0 -1.4",
      "M12 12.4c2.9 0 5 2.1 5 4.3 0 2.2-2.2 2.7-5 2.7s-5-.5-5-2.7c0-2.2 2.1-4.3 5-4.3z",
    ],
  },
  auto: {
    id: "auto",
    nombre: "Autos",
    trazos: [
      "M4.2 14.4v-2.2a1.8 1.8 0 0 1 .3-1l2.5-3.8a2.2 2.2 0 0 1 1.9-1h6.2a2.2 2.2 0 0 1 1.9 1l2.5 3.8a1.8 1.8 0 0 1 .3 1v2.2z",
      "M7.6 14.7a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0 -3",
      "M16.4 14.7a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0 -3",
    ],
  },
  corazon: {
    id: "corazon",
    nombre: "Corazón",
    trazos: [
      "M12 20.1 5 13.1a4.55 4.55 0 0 1 6.36-6.44l.64.64.64-.64a4.55 4.55 0 0 1 6.36 6.44z",
    ],
  },
  estrella: {
    id: "estrella",
    nombre: "Estrella",
    trazos: [
      "M12 3.9 14.32 8.9 19.8 9.57 15.76 13.32 16.82 18.73 12 16.05 7.18 18.73 8.24 13.32 4.2 9.57 9.68 8.9z",
    ],
  },
  regalo: {
    id: "regalo",
    nombre: "Regalo",
    trazos: [
      "M6.2 9.8h11.6a1.8 1.8 0 0 1 1.8 1.8v5.6a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8v-5.6a1.8 1.8 0 0 1 1.8-1.8z",
      "M12 9.8v9.2",
      "M12 9.8c-3.4-.4-4.8-2-4.2-3.4.5-1.2 2.6-1 4.2 3.4z",
      "M12 9.8c3.4-.4 4.8-2 4.2-3.4-.5-1.2-2.6-1-4.2 3.4z",
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
