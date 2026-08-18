import { PRESETS_RUBRO } from "./presets-rubro";

/**
 * EL BANCO DE FOTOS DE FRANJA para el editor de tarjetas de lealtad.
 *
 * ------------------------------------------------------------------
 * QUÉ SON
 * ------------------------------------------------------------------
 * Plantillas de fondo (una franja horizontal ancha, tipo 3:1 o 4:1) que
 * el dueño de un negocio puede elegir para el tope de su tarjeta, igual
 * a como Passtastic ofrece una galería de fotos por rubro. Viven como
 * archivos en `public/lealtad/plantillas/franjas/` y este módulo solo
 * las cataloga — no hay componente de UI acá todavía.
 *
 * ------------------------------------------------------------------
 * SOLO UNSPLASH, Y SOLO LICENCIA GRATUITA
 * ------------------------------------------------------------------
 * Cada foto se descargó y se verificó a mano contra el CDN directo de
 * Unsplash (images.unsplash.com/photo-<id>), descartando cualquier
 * resultado de "plus.unsplash.com" (Unsplash+ es de pago y no cubre
 * uso comercial libre). La Unsplash License permite uso comercial sin
 * pedir permiso y sin atribución obligatoria, por eso `creditoFotografo`
 * es opcional: se guarda el ID de Unsplash por si algún día se quiere
 * atribuir, no porque haga falta.
 *
 * ------------------------------------------------------------------
 * `rubro` REUSA LOS IDS DE `presets-rubro.ts`, NO INVENTA UNA LISTA
 * PARALELA
 * ------------------------------------------------------------------
 * Ojo: NO es el `Rubro` amplio (citas/restaurantes/eventos/hospedajes/
 * otro) — es el `PresetRubro.id` fino que vive DENTRO de cada rubro
 * amplio (barberia, unas, spa, gimnasio, cafeteria, restaurante, tienda…),
 * que es el nivel de detalle que pidió esta tarea. `idsPresetValidos`
 * se arma leyendo `PRESETS_RUBRO` en vez de copiar los strings a mano,
 * así que si ese archivo cambia un id, este módulo truena en vez de
 * quedar desincronizado en silencio.
 *
 * `panaderia`/`reposteria` no tiene id propio ahí (cae dentro de
 * "cafeteria", que ya habla de postres y repostería en sus regalías)
 * — por eso ese id tiene más fotos que los demás: cubre dos categorías
 * visuales del banco (café Y panadería).
 */

const idsPresetValidos = new Set(
  Object.values(PRESETS_RUBRO).flatMap((lista) => lista.map((preset) => preset.id)),
);

export type PlantillaFranja = {
  /** El nombre de archivo sin extensión. */
  id: string;
  /** Ruta pública servible tal cual desde `public/`. */
  src: string;
  /** Un `PresetRubro.id` de presets-rubro.ts (ej. "cafeteria", "barberia"), no el `Rubro` amplio. */
  rubro: string;
  /** "Referencia del fotógrafo — Unsplash", por si algún día hace falta atribuir. */
  creditoFotografo?: string;
};

const franja = (
  archivo: string,
  rubro: string,
  creditoFotografo: string,
): PlantillaFranja => {
  if (!idsPresetValidos.has(rubro)) {
    throw new Error(
      `plantillas-franjas: "${rubro}" no es un id de preset válido en presets-rubro.ts (foto "${archivo}")`,
    );
  }
  return {
    id: archivo,
    src: `/lealtad/plantillas/franjas/${archivo}.jpg`,
    rubro,
    creditoFotografo,
  };
};

export const PLANTILLAS_FRANJA: PlantillaFranja[] = [
  // Café / cafetería
  // "cafe-1" salió del banco: la máquina de espresso mostraba la marca
  // "Victoria Arduino" grabada y, de fondo, el menú de precios y la
  // clave de wifi de esa cafetería puntual — no es una plantilla
  // neutra, es el local real de otro negocio.
  franja("cafe-2", "cafeteria", "Unsplash photo qE1jxYXiwOA"),

  // Panadería / repostería (mismo rubro que café: no tiene id propio)
  franja("panaderia-1", "cafeteria", "Unsplash photo IYjXGUpJH74"),
  franja("panaderia-2", "cafeteria", "Unsplash photo go3DT3PpIw4"),
  franja("panaderia-3", "cafeteria", "Unsplash photo N4gtuEZ5gWc"),

  // Barbería
  franja("barberia-1", "barberia", "Unsplash photo AXurvQTtO3Y"),
  // "barberia-2" salió del banco: identifica un local puntual de EE.UU.
  // (cartel "Cash is King", libro "Barbershops of America", bandera).
  franja("barberia-3", "barberia", "Unsplash photo GvSsskFKbvI"),

  // Salón de belleza / uñas
  // "unas-1" salió del banco: un rótulo de pared nombra un salón real,
  // "Saeedeh Beauty Group", legible en la foto.
  franja("unas-2", "unas", "Unsplash photo gb6gtiTZKB8"),
  // "unas-3" salió del banco: la marca real "KEVIN.MURPHY" aparece
  // rotulada tres veces en la estantería, muy legible.

  // Spa / masajes
  franja("spa-1", "spa", "Unsplash photo VxAwTeiqDao"),
  franja("spa-2", "spa", "Unsplash photo Dq0q442Xjzk"),

  // Restaurante
  franja("restaurante-1", "restaurante", "Unsplash photo e4B5AvA7Jqo"),
  franja("restaurante-2", "restaurante", "Unsplash photo YYZU0Lo1uXE"),
  franja("restaurante-3", "restaurante", "Unsplash photo TivEEYzzhik"),

  // Gimnasio
  franja("gimnasio-1", "gimnasio", "Unsplash photo 1RNQ11ZODJM"),
  franja("gimnasio-2", "gimnasio", "Unsplash photo uYnHRrm63uo"),

  // Tienda / retail
  // "tienda-1" salió del banco: el wordmark real "Gods" queda visible
  // en unas gorras del estante.
  franja("tienda-2", "tienda", "Unsplash photo ojZ4wJNUM5w"),

  // Lavacar (lavado de carros)
  franja("lavacar-1", "lavacar", "Unsplash photo A9NU9_PvJIw"),
  franja("lavacar-2", "lavacar", "Unsplash photo Ce_gQ7Z0eAc"),
  // "lavacar-3" salió del banco: un balde de detailing con una etiqueta
  // de color al fondo, fuera de foco — no se pudo leer ningún texto ni
  // confirmar que fuera una marca real, pero es EXACTAMENTE el patrón
  // de "producto/balde con marca visible" que ya rompió este banco dos
  // veces (Meguiar's, KEVIN.MURPHY). Más vale una foto menos que
  // arriesgar una tercera.
  franja("lavacar-4", "lavacar", "Unsplash photo rbXzG9aAxVA"),

  // Courier (mensajería / paquetería / entregas)
  // Ojo con este rubro en particular: casi toda foto de courier "real"
  // en Unsplash trae el logo de una empresa de paquetería de verdad
  // pegado en la caja, la mochila o la moto del repartidor — se
  // descartaron candidatos con Papa John's, Glovo, Amazon Prime, IKEA
  // y wehkamp.nl bien legibles antes de llegar a estas cuatro (por eso
  // el banco terminó siendo solo cajas/paquetes, sin gente repartiendo).
  franja("courier-1", "courier", "Unsplash photo gthSas4oYC0"),
  franja("courier-2", "courier", "Unsplash photo qO2ztAz5g7A"),
  franja("courier-3", "courier", "Unsplash photo DevJkLB3hWE"),
  franja("courier-4", "courier", "Unsplash photo 03iCZxk8UlM"),
];

/** Las franjas disponibles para un `PresetRubro.id` dado (vacío si no hay ninguna). */
export function franjasDe(rubroPreset: string | null): PlantillaFranja[] {
  if (!rubroPreset) return [];
  return PLANTILLAS_FRANJA.filter((f) => f.rubro === rubroPreset);
}
