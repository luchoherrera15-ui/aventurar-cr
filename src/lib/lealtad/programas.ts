import { estadoDelPrograma, type EstadoPrograma } from "./reglas";

/**
 * EN QUÉ ESTADO ESTÁ UNA TARJETA, para verla y para filtrarla.
 *
 * ------------------------------------------------------------------
 * SEIS ESTADOS VISIBLES, CUATRO GUARDADOS
 * ------------------------------------------------------------------
 * La base guarda cuatro (`borrador`, `activo`, `pausado`,
 * `archivado`). La pantalla muestra seis: los cuatro más
 * `programado` y `vencido`.
 *
 * Esos dos NO son estados guardados y no deben serlo: se DERIVAN de
 * las fechas de vigencia. Guardarlos obligaría a un proceso que
 * recorra la base cada medianoche cambiando filas — y el día que ese
 * proceso no corra, una promoción vencida seguiría figurando activa y
 * el mostrador la canjearía.
 *
 * Derivándolos, una tarjeta vence sola en el instante exacto, sin que
 * nada tenga que despertarse.
 *
 * ------------------------------------------------------------------
 * EL ORDEN DE LAS PREGUNTAS IMPORTA
 * ------------------------------------------------------------------
 * Primero manda lo que una persona DECIDIÓ (archivar, pausar, dejar
 * en borrador) y después lo que dictan las fechas. Una tarjeta
 * archivada no es "vencida" aunque su fecha haya pasado: alguien la
 * archivó, y esa decisión no la puede pisar el calendario.
 */

export const ESTADOS_VISIBLES = [
  "borrador",
  "programado",
  "activo",
  "pausado",
  "vencido",
  "archivado",
] as const;

export type EstadoVisible = (typeof ESTADOS_VISIBLES)[number];

/** Lo mínimo que hace falta saber de un programa para ubicarlo. */
export type FilaPrograma = {
  estado?: string | null;
  activo: boolean;
  /** ISO (fecha o fecha-hora). null = vale desde siempre. */
  vigente_desde?: string | null;
  /** ISO. null = no vence. */
  vigente_hasta?: string | null;
};

/**
 * Compara un límite de vigencia contra el momento actual.
 *
 * Los límites se guardan como `date` (2026-09-01) o como timestamp. Se
 * comparan como TEXTO ISO y no como `Date` a propósito: construir un
 * `Date` desde "2026-09-01" lo interpreta como medianoche UTC, que en
 * Costa Rica (UTC-6) es las 6 p. m. del día ANTERIOR — y una promoción
 * que arranca el 1 se habría activado el 31 a las 6 de la tarde.
 *
 * Comparando el texto contra el "ahora" ya expresado en hora de Costa
 * Rica, el día es el día.
 */
function comparaISO(limite: string, ahoraCR: string): number {
  // Se recorta al largo del límite: si el límite es solo fecha
  // ("2026-09-01"), se compara solo la fecha del ahora.
  const a = ahoraCR.slice(0, limite.length);
  return a < limite ? -1 : a > limite ? 1 : 0;
}

/**
 * El estado que ve el negocio.
 *
 * `ahoraCR` es el momento actual EN HORA DE COSTA RICA, en ISO
 * ("2026-08-13T14:30"). Se recibe en vez de calcularse acá para que la
 * función sea pura y testeable: una que lee el reloj no se puede
 * probar contra un vencimiento futuro.
 */
export function estadoVisible(fila: FilaPrograma, ahoraCR: string): EstadoVisible {
  const guardado: EstadoPrograma = estadoDelPrograma({
    estado: fila.estado ?? null,
    activo: fila.activo,
  });

  // Lo que alguien DECIDIÓ manda sobre el calendario.
  if (guardado === "archivado") return "archivado";
  if (guardado === "pausado") return "pausado";
  if (guardado === "borrador") return "borrador";

  // Solo una tarjeta activa puede estar esperando su fecha o pasada.
  if (fila.vigente_hasta && comparaISO(fila.vigente_hasta, ahoraCR) > 0) return "vencido";
  if (fila.vigente_desde && comparaISO(fila.vigente_desde, ahoraCR) < 0) return "programado";

  return "activo";
}

/**
 * ¿Esta tarjeta puede EMITIR pases y ACEPTAR canjes ahora mismo?
 *
 * Es la pregunta que hace el servidor antes de dejar pasar cualquier
 * cosa, y la respuesta es una sola: solo `activo`. Ni programada, ni
 * vencida, ni pausada.
 *
 * Una captura del QR o un pase desactualizado en el teléfono NO pueden
 * saltarse esto: el pase es un dibujo, la autorización se decide acá.
 */
export function operaAhora(fila: FilaPrograma, ahoraCR: string): boolean {
  return estadoVisible(fila, ahoraCR) === "activo";
}

/** Cómo se le cuenta cada estado al negocio. */
export const ETIQUETA_ESTADO: Record<EstadoVisible, string> = {
  borrador: "Borrador",
  programado: "Programada",
  activo: "Activa",
  pausado: "Pausada",
  vencido: "Vencida",
  archivado: "Archivada",
};

/**
 * El color del chip. `verde` queda fuera como color principal por
 * marca, así que «activa» usa el azul de Bookea y el naranja se
 * reserva para lo que pide atención.
 */
export const TONO_ESTADO: Record<EstadoVisible, "azul" | "naranja" | "gris"> = {
  borrador: "gris",
  programado: "azul",
  activo: "azul",
  pausado: "naranja",
  vencido: "naranja",
  archivado: "gris",
};

export type FiltroPrograma = "todos" | EstadoVisible;

export const FILTROS: { id: FiltroPrograma; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todas" },
  { id: "borrador", etiqueta: "Borradores" },
  { id: "activo", etiqueta: "Activas" },
  { id: "programado", etiqueta: "Programadas" },
  { id: "pausado", etiqueta: "Pausadas" },
  { id: "vencido", etiqueta: "Vencidas" },
  { id: "archivado", etiqueta: "Archivadas" },
];

/**
 * Cuántas hay en cada filtro. Se cuenta TODO de una pasada en vez de
 * filtrar seis veces la misma lista.
 */
export function conteoPorFiltro<T extends FilaPrograma>(
  filas: readonly T[],
  ahoraCR: string,
): Record<FiltroPrograma, number> {
  const conteo = Object.fromEntries(
    FILTROS.map((f) => [f.id, 0]),
  ) as Record<FiltroPrograma, number>;

  for (const fila of filas) {
    conteo.todos++;
    conteo[estadoVisible(fila, ahoraCR)]++;
  }
  return conteo;
}

export function filtrar<T extends FilaPrograma>(
  filas: readonly T[],
  filtro: FiltroPrograma,
  ahoraCR: string,
): T[] {
  if (filtro === "todos") return [...filas];
  return filas.filter((f) => estadoVisible(f, ahoraCR) === filtro);
}
