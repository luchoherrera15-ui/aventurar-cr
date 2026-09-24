/**
 * ══════════════════════════════════════════════════════════════════
 *  EL PEDIDO A LA IA, ARMADO DESDE UN FORMULARIO
 * ══════════════════════════════════════════════════════════════════
 *
 * La persona no escribe un prompt: llena datos (quién celebra, cuántos
 * años, estilo, colores, tono, qué secciones) y de ahí sale el pedido
 * que ve —y puede retocar— antes de generar. Puro: corre igual en el
 * navegador (para la previa del pedido) y en el servidor (para volver a
 * armarlo si hace falta).
 */

export const ESTILOS_IA = [
  ["elegante", "Elegante"],
  ["romantico", "Romántico"],
  ["minimalista", "Minimalista"],
  ["divertido", "Divertido"],
  ["tropical", "Tropical"],
  ["rustico", "Rústico"],
  ["lujoso", "Lujoso"],
  ["infantil", "Infantil"],
  ["moderno", "Moderno"],
  ["vintage", "Vintage"],
] as const;

export const TONOS_TEXTO_IA = [
  ["calido", "Cálido y cercano"],
  ["elegante", "Elegante"],
  ["divertido", "Divertido"],
  ["formal", "Formal"],
] as const;

export const SECCIONES_IA = [
  ["countdown", "Cuenta regresiva"],
  ["historia", "Nuestra historia"],
  ["itinerario", "Programa del día"],
  ["dress_code", "Código de vestimenta"],
  ["galeria", "Galería de fotos"],
  ["regalos", "Regalos"],
  ["faq", "Preguntas frecuentes"],
] as const;

export type EstiloIA = (typeof ESTILOS_IA)[number][0];
export type TonoTextoIA = (typeof TONOS_TEXTO_IA)[number][0];
export type SeccionIA = (typeof SECCIONES_IA)[number][0];

export type DatosIA = {
  /** Quién celebra: «Sofía & Andrés», «Mateo», «Grupo Aurora». */
  quien: string;
  /** Años que cumple, si aplica («7», «15», «25 años de casados»). */
  edad: string;
  /** El tipo de celebración en palabras (viene de la celebración). */
  tipo: string;
  fecha: string;
  hora: string;
  lugar: string;
  estilos: EstiloIA[];
  colores: string;
  tono: TonoTextoIA;
  secciones: SeccionIA[];
  /** Algo más: la historia, un detalle, lo que quieran contar. */
  extra: string;
};

export const DATOS_IA_VACIOS: DatosIA = {
  quien: "",
  edad: "",
  tipo: "",
  fecha: "",
  hora: "",
  lugar: "",
  estilos: [],
  colores: "",
  tono: "calido",
  secciones: ["countdown", "itinerario", "dress_code", "galeria", "regalos"],
  extra: "",
};

const nombreDe = <T extends readonly (readonly [string, string])[]>(lista: T, id: string) => lista.find(([k]) => k === id)?.[1] ?? id;

/**
 * El pedido en prosa, tal como se lo mandamos al bot. Se muestra antes
 * de generar para que la persona lo lea y lo ajuste.
 */
export function armarPedidoIA(d: DatosIA): string {
  const partes: string[] = [];
  const quien = d.quien.trim();
  const tipo = d.tipo.trim().toLowerCase();

  let primera = tipo ? `Una invitación de ${tipo}` : "Una invitación";
  if (quien) primera += ` para ${quien}`;
  if (d.edad.trim()) primera += ` (${/año|aniversario|casad/i.test(d.edad) ? d.edad.trim() : `cumple ${d.edad.trim()} años`})`;
  primera += ".";
  partes.push(primera);

  const cuando = [d.fecha.trim(), d.hora.trim()].filter(Boolean).join(" a las ");
  if (cuando || d.lugar.trim()) {
    partes.push(`Es ${cuando ? `el ${cuando}` : ""}${cuando && d.lugar.trim() ? " en " : d.lugar.trim() ? "en " : ""}${d.lugar.trim()}.`.replace(/\s+\./, "."));
  }

  if (d.estilos.length) {
    const nombres = d.estilos.map((e) => nombreDe(ESTILOS_IA, e).toLowerCase());
    partes.push(`Estilo ${nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`}.`);
  }
  if (d.colores.trim()) partes.push(`Colores: ${d.colores.trim()}.`);
  partes.push(`Textos con tono ${nombreDe(TONOS_TEXTO_IA, d.tono).toLowerCase()}.`);
  if (d.secciones.length) {
    partes.push(`Secciones: portada, fecha y lugar, ${d.secciones.map((s) => nombreDe(SECCIONES_IA, s).toLowerCase()).join(", ")}, confirmación y mensaje final.`);
  }
  if (d.extra.trim()) partes.push(d.extra.trim());

  return partes.join(" ");
}

/** Saneo de lo que llega del navegador. */
export function normalizarDatosIA(v: unknown): DatosIA {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const texto = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : "");
  const lista = <T extends string>(k: string, permitidos: readonly (readonly [T, string])[]): T[] =>
    Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x): x is T => typeof x === "string" && permitidos.some(([id]) => id === x)).slice(0, 10) : [];
  const tono = texto("tono", 20);
  return {
    quien: texto("quien", 120),
    edad: texto("edad", 40),
    tipo: texto("tipo", 60),
    fecha: texto("fecha", 60),
    hora: texto("hora", 20),
    lugar: texto("lugar", 160),
    estilos: lista<EstiloIA>("estilos", ESTILOS_IA),
    colores: texto("colores", 160),
    tono: TONOS_TEXTO_IA.some(([id]) => id === tono) ? (tono as TonoTextoIA) : "calido",
    secciones: lista<SeccionIA>("secciones", SECCIONES_IA),
    extra: texto("extra", 800),
  };
}
