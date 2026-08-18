import { ICONOS_SELLO, type IconoSello } from "./iconos-sello";
import { PRESETS_RUBRO } from "./presets-rubro";

/**
 * EL BANCO DE ÍCONOS "imagen del negocio" del editor de tarjetas de
 * lealtad — sucesor de `imagen-stock.ts` (BORRADO en este mismo trabajo).
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO REEMPLAZA A `imagen-stock.ts` Y NO LO EXTIENDE
 * ------------------------------------------------------------------
 * `imagen-stock.ts` tenía CINCO entradas, atadas 1:1 a cinco de los doce
 * `IconoSello` (`cafe`, `tijera`, `unas`, `comida`, `estrella`). El pedido
 * de esta vuelta es un catálogo de 20-30 ampliado con tabs por rubro —o
 * sea, un catálogo PROPIO, ya no un subconjunto del de los sellos. Se
 * mantiene la misma mecánica exacta (ícono sobre un disco del color de
 * fondo, dibujado como `data:` URI, nunca un archivo) porque esa parte
 * seguía siendo la correcta; lo que cambia es de dónde salen los dibujos.
 *
 * ------------------------------------------------------------------
 * DE DÓNDE SALE CADA ÍCONO — CERO DIBUJOS NUEVOS DESDE CERO
 * ------------------------------------------------------------------
 * Los primeros doce son literalmente los de `iconos-sello.ts`
 * (`ICONOS_SELLO`), leídos de ahí y no copiados a mano — si ese archivo
 * cambia un trazo, este catálogo lo hereda solo. Los quince restantes son
 * conversiones de `<path>`/`<circle>`/`<rect>` que YA EXISTEN en
 * `src/components/icons.tsx` (la barra de categorías de Eventos,
 * Restaurantes y Citas), con el mismo `viewBox 24` y el mismo trazo que
 * ya comparten los doce del sello — por eso los `circulo()`/`elipse()` de
 * abajo son una copia CHICA de los mismos helpers de `iconos-sello.ts` (no
 * se importan: ese archivo los tiene privados) y `capsula()` es el
 * equivalente para los dos íconos de `icons.tsx` que usan `<rect rx=…>`
 * en vez de círculos (el nigiri de `IconSushi`, el poste de
 * `IconPosteBarbero`) — ninguno de los dos se ve bien recortado a la
 * mitad, así que hacía falta el tercer helper.
 *
 * `icons.tsx` y `iconos-sello.ts` NO se tocan: este archivo solo LEE de
 * los dos.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ALGUNOS PUNTITOS DECORATIVOS DE `icons.tsx` SE QUEDARON AFUERA
 * ------------------------------------------------------------------
 * `dataUriPlantillaIcono` pinta TODO con `fill="none" stroke={trazoLegible(colorFondo)}`
 * (mismo criterio que `dataUriImagenStock`) porque el ícono vive sobre un
 * disco de color sólido, como un sello. Un `<circle fill="currentColor"
 * stroke="none">` chico —los destellos de `IconDisco`, por ejemplo— se
 * volvería un anillo hueco con esa regla, no un punto: se ve como un
 * defecto, no como brillo. Se omiten esos puntos decorativos y se
 * conserva el resto del dibujo, que sigue siendo reconocible sin ellos.
 *
 * ------------------------------------------------------------------
 * `rubro` REUSA `PresetRubro.id`, IGUAL QUE `plantillas-franjas.ts`
 * ------------------------------------------------------------------
 * Mismo criterio que ese archivo: NO es el `Rubro` amplio, es el id fino
 * de `presets-rubro.ts` (barberia, unas, spa…). `null` es el comodín
 * general (corazón, estrella, regalo, salud) que no encaja en un rubro
 * puntual — la galería los agrupa en su propia pestaña "General".
 */

const idsPresetValidos = new Set(
  Object.values(PRESETS_RUBRO).flatMap((lista) => lista.map((preset) => preset.id)),
);

export type PlantillaIcono = {
  /** Estable: viaja en el estado del editor, nunca al servidor. */
  id: string;
  /** Cómo se llama en la galería. */
  nombre: string;
  /** Los `d` de cada `<path>`, en un viewBox de 24×24 — mismo formato que `DibujoIcono.trazos`. */
  trazos: readonly string[];
  /** Un `PresetRubro.id`, o `null` si es un comodín general. */
  rubro: string | null;
};

// ── LOS TRES HELPERS DE CONVERSIÓN ──────────────────────────────────
// Copia chica y privada de los mismos dos que ya usa `iconos-sello.ts`,
// más uno nuevo para los dos íconos que en `icons.tsx` son un `<rect
// rx=…>` en vez de un círculo. No se exportan: no hacen falta fuera de
// este archivo.

/** Una elipse como `d` de path: dos arcos, sin `<ellipse>`. */
function elipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx} ${cy - ry}a${rx} ${ry} 0 1 0 0 ${ry * 2}a${rx} ${ry} 0 1 0 0 ${-ry * 2}`;
}

/** Un círculo: la elipse con los dos radios iguales. */
function circulo(cx: number, cy: number, r: number): string {
  return elipse(cx, cy, r, r);
}

/**
 * Un rectángulo con los extremos totalmente redondeados, como `d` de
 * path: el equivalente de `<rect rx=…>` cuando el radio ya consume medio
 * lado corto (el nigiri de `IconSushi`, el poste de `IconPosteBarbero` —
 * los dos `<rect>` de `icons.tsx` que hacía falta convertir). Con el lado
 * largo horizontal los extremos redondeados quedan a izquierda y derecha;
 * con el lado largo vertical, arriba y abajo.
 */
function capsula(x: number, y: number, w: number, h: number): string {
  const r = Math.min(w, h) / 2;
  if (w >= h) {
    return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 0 ${h}h${-(w - 2 * r)}a${r} ${r} 0 0 1 0 ${-h}Z`;
  }
  return `M${x} ${y + r}v${h - 2 * r}a${r} ${r} 0 0 0 ${w} 0v${-(h - 2 * r)}a${r} ${r} 0 0 0 ${-w} 0Z`;
}

/** Uno de los doce del sello, reusado tal cual — ni el nombre ni los trazos se copian a mano. */
function deSello(id: IconoSello, rubro: string | null): PlantillaIcono {
  return { id, nombre: ICONOS_SELLO[id].nombre, trazos: ICONOS_SELLO[id].trazos, rubro };
}

/** Uno nuevo, convertido de `icons.tsx`. Revienta temprano si `rubro` no es un id de preset real. */
function icono(id: string, nombre: string, trazos: readonly string[], rubro: string | null): PlantillaIcono {
  if (rubro !== null && !idsPresetValidos.has(rubro)) {
    throw new Error(`plantillas-icono: "${rubro}" no es un id de preset válido en presets-rubro.ts (ícono "${id}")`);
  }
  return { id, nombre, trazos, rubro };
}

export const PLANTILLAS_ICONO: readonly PlantillaIcono[] = [
  // ── Los doce del sello, tal cual (iconos-sello.ts) ────────────────
  deSello("cafe", "cafeteria"),
  deSello("tijera", "barberia"),
  deSello("unas", "unas"),
  deSello("comida", "restaurante"),
  deSello("cerveza", "bar"),
  deSello("pesa", "gimnasio"),
  deSello("flor", "spa"),
  deSello("mascota", "mascotas"),
  deSello("auto", "lavacar"),
  deSello("corazon", null),
  deSello("estrella", null),
  deSello("regalo", null),

  // ── Quince nuevos, convertidos de icons.tsx ───────────────────────

  // Tienda: de IconStore — el toldo con sus tres franjas y la puerta.
  icono(
    "tienda",
    "Tienda",
    [
      "M4 4h16l1.5 4.5a3 3 0 0 1-2.9 3 3 3 0 0 1-3-2.5 3.1 3.1 0 0 1-3.1 2.5 3.1 3.1 0 0 1-3-2.5 3 3 0 0 1-3 2.5 3 3 0 0 1-3-3L4 4Z",
      "M5 12.5V20h14v-7.5M10 20v-4.5h4V20",
    ],
    "tienda",
  ),

  // Rancho: de IconRancho — el techo a dos aguas sobre sus columnas.
  icono(
    "rancho",
    "Rancho",
    ["M2.5 10.5 12 3l9.5 7.5", "M5.5 13.5h13", "M6.5 13.5V20M17.5 13.5V20M12 13.5V20", "M3.5 20.5h17"],
    "eventos",
  ),

  // Catering: de IconCloche — la campana sobre su bandeja.
  icono(
    "catering",
    "Catering",
    ["M4.5 16a7.5 7.5 0 0 1 15 0", "M2.5 16.5h19M12 8.5V7", circulo(12, 5.5, 1.2), "M5.5 20h13"],
    "restaurante",
  ),

  // Fiesta: de IconDisco — la bola espejada y sus franjas de luz. Los
  // dos destellos puntuales del original se omiten (ver comentario de
  // cabecera: se volverían anillos huecos sobre el disco de color).
  icono(
    "fiesta",
    "Fiesta",
    [
      "M12 2.5V5",
      circulo(12, 12.5, 7),
      "M5.5 10.3h13M5.5 14.7h13",
      "M9.6 6c-1.5 4.2-1.5 8.8 0 13M14.4 6c1.5 4.2 1.5 8.8 0 13",
    ],
    "eventos",
  ),

  // Decoración: de IconBalloons — los dos globos amarrados.
  icono(
    "decoracion",
    "Decoración",
    [
      elipse(15.5, 8.5, 3.4, 4),
      "M15.5 12.5c.6 2.6-.7 4.2-.2 6.5",
      elipse(8.3, 7.5, 3.9, 4.6),
      "M8.3 12.1c-.6 3 .9 4.7.3 7.9",
      "M7.5 12.3h1.6",
    ],
    "salon-eventos",
  ),

  // Cocina: de IconGorroChef — el gorro sobre su banda.
  icono(
    "cocina",
    "Cocina",
    [
      "M6.5 14.5c-2.2-.5-3.8-2.3-3.8-4.5 0-2.6 2.2-4.7 4.9-4.7.5 0 1 .07 1.5.2C9.8 3.8 11.3 3 13 3c2.7 0 4.9 2.1 4.9 4.7v.1c1.9.5 3.4 2.2 3.4 4.2 0 1.2-.5 2.3-1.4 3.1",
      "M6.5 14.5h13v4.2a1.8 1.8 0 0 1-1.8 1.8H8.3a1.8 1.8 0 0 1-1.8-1.8v-4.2Z",
      "M6.5 17.5h13",
    ],
    "restaurante",
  ),

  // Comida típica: de IconOlla — la olla humeante.
  icono(
    "comida-tipica",
    "Comida típica",
    [
      "M4.5 10h15v5.5a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4V10Z",
      "M3 10h18M2.5 12.5h2M19.5 12.5h2",
      "M9.5 7.5c0-1.2 1-1.4 1-2.5M14 7.5c0-1.2 1-1.4 1-2.5",
    ],
    "restaurante",
  ),

  // Sushi: de IconSushi — el nigiri (el `<rect rx=3>` original, convertido
  // con `capsula()`) con el alga por encima y el arroz marcado.
  icono(
    "sushi",
    "Sushi",
    [
      capsula(3.5, 12.5, 17, 6),
      "M4.6 12.5c1.5-2.6 4.2-4.2 7.4-4.2s5.9 1.6 7.4 4.2",
      "M9.5 12.8v5.4M14.5 12.8v5.4",
    ],
    "restaurante",
  ),

  // Tacos: de IconTaco — la tortilla doblada con su relleno.
  icono(
    "tacos",
    "Tacos",
    [
      "M2.5 17.5a9.5 9.5 0 0 1 19 0 1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5Z",
      "M6.5 15.2c1.6-1.4 3.4-2.1 5.5-2.1s3.9.7 5.5 2.1",
      "M9 12.4c.8-1.7 2-2.6 3-2.6s2.2.9 3 2.6",
    ],
    "restaurante",
  ),

  // Helados: de IconHelado — el cono con su bocha marcada.
  icono(
    "helados",
    "Helados",
    ["M7 10.5h10L12.9 20a1 1 0 0 1-1.8 0L7 10.5Z", "M6.5 10.5a5.5 5.5 0 0 1 11 0", "M8.4 14.2h7.2"],
    "cafeteria",
  ),

  // Panadería: de IconPan — el pan con sus tres cortes.
  icono(
    "panaderia",
    "Panadería",
    [
      "M4.2 12.4c0-3.3 3.5-5.6 7.8-5.6s7.8 2.3 7.8 5.6c0 .9-.7 1.6-1.6 1.6h-.6v2.6a2.6 2.6 0 0 1-2.6 2.6H9a2.6 2.6 0 0 1-2.6-2.6V14h-.6a1.6 1.6 0 0 1-1.6-1.6Z",
      "M9.4 10.2 8.2 12.1M12.4 10.2l-1.2 1.9M15.4 10.2l-1.2 1.9",
    ],
    "cafeteria",
  ),

  // Jugos: de IconJugo — el vaso alto con su pajilla y la rodaja.
  icono(
    "jugos",
    "Jugos",
    ["M6.5 7h11l-1.1 12.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8L6.5 7Z", "M7 11.5h10", "M13.5 7 16 2.8", circulo(9.2, 4.6, 1.9)],
    "cafeteria",
  ),

  // Spa: de IconLoto — la flor de loto.
  icono(
    "spa-loto",
    "Spa",
    [
      "M12 19.5c-2.6 0-4.8-1.7-5.7-4.2 1.9-1.1 4-1 5.7.4 1.7-1.4 3.8-1.5 5.7-.4-.9 2.5-3.1 4.2-5.7 4.2Z",
      "M12 19.5c-1.9-2-2.4-4.9-1.2-7.4.5-1 1.2-1.9 1.2-1.9s.7.9 1.2 1.9c1.2 2.5.7 5.4-1.2 7.4Z",
      "M6.3 15.3c-1.4-.6-2.4-1.9-2.6-3.4 1.6-.6 3.2-.2 4.3 1M17.7 15.3c1.4-.6 2.4-1.9 2.6-3.4-1.6-.6-3.2-.2-4.3 1",
    ],
    "spa",
  ),

  // Salud: de IconEstetoscopio — el consultorio, sin preset propio.
  icono(
    "salud",
    "Salud",
    ["M6 3v4.5a4 4 0 0 0 8 0V3", "M4.5 3H6M12.5 3H14", "M10 11.5v2.2a4.8 4.8 0 0 0 9.6 0v-1", circulo(19.6, 10.5, 2.1)],
    null,
  ),

  // Barbería: de IconPosteBarbero — el poste rayado (el `<rect rx=4>`
  // original, convertido con `capsula()`).
  icono(
    "barberia-poste",
    "Barbería",
    [capsula(8, 6, 8, 12), "M8.4 10.5 15.6 8M8.4 14.5 15.6 12", "M7 4.5h10M7 19.5h10M12 19.5V22"],
    "barberia",
  ),

  // Lavado de autos: dibujo NUEVO, no viene de icons.tsx (el rubro
  // "lavacar" ya tenía sello "auto" reusado, pero acá hacía falta uno
  // propio y distinto). Una cubeta con agua adentro y espuma arriba —se
  // lee como lavado, no como "otro carro" al lado del ícono "Autos".
  icono(
    "lavado-autos",
    "Lavado de autos",
    [
      "M6.5 9h11l-1.3 9.5a2 2 0 0 1-2 1.7h-4.4a2 2 0 0 1-2-1.7L6.5 9Z",
      "M8.5 9c0-2.8 7-2.8 7 0",
      "M7.7 13h8.6",
      circulo(9, 6, 1.3),
      circulo(12.3, 4.3, 1.6),
      circulo(15.2, 6.2, 1.2),
    ],
    "lavacar",
  ),

  // Paquetería: dibujo NUEVO, no viene de icons.tsx (rubro "courier" es
  // nuevo, sin ícono propio hasta ahora). Una caja cerrada con la V de
  // los solapas y la cinta bajando por el medio, más la etiqueta de
  // envío — se lee como paquete, no como el regalo envuelto de arriba.
  icono(
    "paquete-courier",
    "Paquetería",
    // La versión anterior era un rectángulo con una V desde las dos
    // esquinas superiores a un punto central — el glifo universal de
    // "sobre de carta", no de una caja. Se reemplaza por la caja en
    // perspectiva (hexágono + costura en Y desde el centro) que usan
    // la mayoría de los sistemas de íconos para "paquete/envío": nada
    // que se confunda con un sobre ni con `regalo` (que lleva moño).
    [
      "M12 3 19.5 7 19.5 15 12 19 4.5 15 4.5 7Z",
      "M12 11V19",
      "M12 11 4.5 7",
      "M12 11 19.5 7",
    ],
    "courier",
  ),
];

export function esPlantillaIcono(valor: unknown): valor is string {
  return typeof valor === "string" && PLANTILLAS_ICONO.some((p) => p.id === valor);
}

/**
 * Blanco funciona sobre las 8 paletas oscuras predefinidas, pero
 * `colorFondo` también puede ser un hex libre de "Ver más colores"
 * (`CampoColor`, sin límites) — un fondo claro con trazo blanco fijo es
 * un ícono invisible, no un ícono chico. Blanco solo si el fondo es
 * oscuro de verdad (luminancia WCAG &lt; 0,5); si el hex no se puede leer,
 * blanco — es el mismo defecto de siempre, no un error.
 */
function trazoLegible(colorFondo: string): string {
  const coincide = /^#?([0-9a-f]{6})$/i.exec(colorFondo.trim());
  if (!coincide) return "#ffffff";
  const hex = coincide[1];
  const canal = (i: number) => {
    const c = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminancia = 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
  return luminancia > 0.5 ? "#161616" : "#ffffff";
}

/**
 * El ícono elegido, dibujado como un `data:` URI — mismo contrato exacto
 * que `dataUriImagenStock` de `imagen-stock.ts` (BORRADO): para que la
 * vista previa del pase, que espera una URL en `logoUrl`, lo pueda
 * mostrar igual que mostraría un logo real, sin que exista ningún
 * archivo. Por eso esta elección NUNCA viaja al servidor como `logoUrl`
 * — no hay nada que `esUrlDeNuestroStorage` pueda validar —: es
 * puramente una ayuda visual mientras no hay un logo de verdad subido.
 */
export function dataUriPlantillaIcono(id: string, colorFondo: string): string | null {
  const plantilla = PLANTILLAS_ICONO.find((p) => p.id === id);
  if (!plantilla) return null;
  const trazos = plantilla.trazos.map((d) => `<path d="${d}"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="12" fill="${colorFondo}"/>` +
    `<g fill="none" stroke="${trazoLegible(colorFondo)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" transform="translate(3.2,3.2) scale(0.73)">${trazos}</g>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
