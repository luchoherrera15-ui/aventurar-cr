/**
 * BOOKEA BUSINESS — la SUGERENCIA del tipo de negocio.
 *
 * `modulos.ts` sabe qué panel corresponde a cada tipo, e `identidad.ts`
 * sabe cómo se ve y cómo habla. Los dos esperan un `tipo_negocio` que
 * hoy nadie llena: el registro nunca lo pregunta, así que los negocios
 * nacen en null y el panel se resuelve por derivación —y la derivación
 * solo alcanza a seis rubros de los dieciocho que existen.
 *
 * Este archivo NO decide nada: adivina para PRESELECCIONAR. La pantalla
 * de registro le muestra los tipos al dueño con uno ya marcado, y él
 * confirma con un clic. Por eso todo acá está calibrado hacia el "no sé":
 *
 *   · Ante la duda, `null`. Que no venga nada marcado cuesta un clic;
 *     que venga marcado MAL cuesta un panel equivocado durante meses,
 *     porque el dueño apura "siguiente" sin leer y nunca entiende por
 *     qué su gimnasio le pide "servicios" en vez de "membresías".
 *   · Si dos rubros compiten en el mismo nombre —"Spa & Barbería"— la
 *     respuesta honesta es ninguno, no el primero de la lista.
 *   · Nunca sugiere `otro`. "Otro" no es una sugerencia, es la ausencia
 *     de una; marcarlo sería mentirle al dueño diciéndole que le
 *     acertamos.
 *
 * Función PURA y sin Supabase: recibe lo que el formulario ya tiene en
 * pantalla (el nombre que el dueño acaba de escribir, y la vertical y
 * categoría que ya eligió) y devuelve un id o null. Se puede llamar en
 * cada tecleo sin costo.
 */

import {
  tipoNegocioEfectivo,
  tiposDeVertical,
  type TipoNegocioId,
} from "./modulos";

/**
 * Todo tipo menos `otro` (ver arriba). Es un `Record` completo a
 * propósito: agregar un tipo a `TIPOS_NEGOCIO` sin darle señales acá NO
 * COMPILA, y así el adivinador no se queda callado en silencio cuando
 * el catálogo crece. Si un tipo nuevo de verdad no tiene palabras
 * propias, se declara con `[]` y queda dicho que fue una decisión.
 */
export type TipoSugerible = Exclude<TipoNegocioId, "otro">;

/**
 * Las palabras del rótulo, no las del diccionario.
 *
 * Están escritas como se ven en una fachada tica —"soda", "cabinas",
 * "barber shop", "estética"— y en la forma NORMALIZADA que produce
 * `normalizarTexto`: minúsculas, sin tildes y sin la ñ ("uñas" viaja
 * acá como "unas"). La prueba verifica que ninguna se escape de esa
 * forma, porque una señal con tilde no matchea nunca y falla en
 * silencio.
 *
 * Reglas que guiaron qué entra y qué no:
 *
 *   · Nada de palabras genéricas que pertenecen a todos los rubros:
 *     "salon" (hay salón de belleza y salón de eventos), "estudio",
 *     "centro", "rancho". Un nombre que solo tiene esas no dice nada.
 *   · Nada de palabras que solo aparecen ADENTRO de otras. El match es
 *     por palabra completa (ver `normalizarTexto`), así que "spa" no
 *     marca "ESPACIO" y "bar" no marca "Barbería" — pero igual conviene
 *     no meter fragmentos que dependan de esa red.
 *   · Una misma palabra no puede estar en dos tipos: sería un empate
 *     permanente, o sea un `null` garantizado. La prueba lo vigila.
 *
 * Las frases de varias palabras ("salon de eventos") se comparan
 * completas y en orden.
 */
export const SENALES_TIPO: Record<TipoSugerible, readonly string[]> = {
  // --- Belleza y bienestar ---
  barberia: ["barberia", "barberias", "barber", "barbers", "barbershop", "barbero", "barberos"],
  salon_belleza: [
    "belleza",
    "estetica",
    "peluqueria",
    "peluqueria unisex",
    "estilista",
    "estilistas",
    "hair",
    "peinados",
  ],
  // "unas" es la normalización de "uñas" y también el artículo
  // ("unas flores"). Se asume el rubro: en un rótulo de citas la
  // palabra suelta es el servicio, no el artículo.
  unas: ["unas", "nail", "nails", "manicure", "manicura", "pedicure", "pedicura", "acrilicas"],
  spa: ["spa", "wellness"],
  masajes: ["masaje", "masajes", "masajista", "masoterapia", "quiromasaje", "massage"],

  // --- Salud y profesionales ---
  // La frontera es la de `modulos.ts`: `consultorio` receta y pide
  // exámenes; `profesional` atiende solo y no prescribe. Por eso la
  // fisioterapia y la nutrición caen del lado de `profesional` aunque
  // el rótulo diga "clínica" — y por eso "Clínica de Fisioterapia"
  // empata consigo misma y devuelve null. Un clic de más es más barato
  // que darle recetas y laboratorio a quien no los usa.
  consultorio: [
    "consultorio",
    "consultorios",
    "clinica",
    "clinicas",
    "medico",
    "medica",
    "dental",
    "dentista",
    "odontologia",
    "odontologico",
    "odontologica",
    "ortodoncia",
    "pediatria",
    "dermatologia",
    "oftalmologia",
    "veterinaria",
    "veterinario",
  ],
  profesional: [
    "psicologia",
    "psicologo",
    "psicologa",
    "nutricion",
    "nutricionista",
    "fisioterapia",
    "fisioterapeuta",
    "terapeuta",
    "abogado",
    "abogados",
    "bufete",
    "notaria",
    "contador",
    "contabilidad",
    "consultoria",
    "asesoria",
    "arquitectura",
  ],

  // --- Fitness y estudios ---
  gimnasio: ["gimnasio", "gimnasios", "gym", "fitness", "musculacion", "pesas"],
  crossfit: ["crossfit", "funcional", "wod"],
  pilates: ["pilates", "reformer"],
  yoga: ["yoga", "vinyasa", "ashtanga"],
  entrenador: ["entrenador", "entrenadora", "trainer", "personal trainer"],
  academia: ["academia", "academy", "escuela", "instituto"],

  // --- Las verticales que ya existían ---
  // Acá las señales del nombre pesan poco: la categoría del
  // marketplace ya contesta casi siempre (ver el final del archivo).
  // Valen para el caso que la categoría no distingue: un salón de
  // fiestas publicado en "otros" se derivaría como proveedor, y no lo
  // es. Ojo: "eventos" a secas NO es señal — está en el nombre de los
  // dos lados del rubro.
  eventos_lugar: [
    "salon de eventos",
    "salon para eventos",
    "centro de eventos",
    "salon de fiestas",
    "quinta",
    "hacienda",
  ],
  eventos_proveedor: [
    "catering",
    "banquetes",
    "reposteria",
    "pasteleria",
    "dj",
    "sonido",
    "iluminacion",
    "animacion",
    "decoracion",
    "decoraciones",
    "fotografia",
    "fotografo",
    "toldos",
  ],
  hospedaje: [
    "hotel",
    "hoteles",
    "hostel",
    "hostal",
    "cabina",
    "cabinas",
    "lodge",
    "posada",
    "apartotel",
    "resort",
  ],
  restaurante: [
    "restaurante",
    "restaurant",
    "soda",
    "marisqueria",
    "pizzeria",
    "cafeteria",
    "cafe",
    "bar",
    "parrilla",
    "steakhouse",
  ],
};

/**
 * Minúsculas, sin tildes, sin ñ y partido en palabras.
 *
 * NFD separa la tilde de su letra y el rango U+0300-U+036F la borra, así
 * que "Estética" y "Estetica" terminan idénticas — que es el 90% de por
 * qué estas funciones fallan. La ñ se descompone igual (n + tilde), o
 * sea que "uñas" queda "unas": está asumido en el catálogo de arriba.
 *
 * Todo lo que no sea letra o dígito pasa a ser separador. Eso convierte
 * "Hotel & Spa", "Nails/Beauty" y "SILENCE BARBER SHOP" en listas de
 * palabras comparables, y es lo que permite comparar por PALABRA
 * COMPLETA en vez de por substring.
 */
export function normalizarTexto(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((palabra) => palabra.length > 0);
}

export type PistasNegocio = {
  /** El nombre tal cual lo escribió el dueño. */
  nombre: string;
  /** La vertical del marketplace, si ya la eligió. Acota los tipos posibles. */
  vertical?: string | null;
  /** La categoría del marketplace, si ya la eligió. Es el plan B. */
  categoria?: string | null;
};

/**
 * El tipo de negocio más probable, o `null` si no hay señal clara.
 *
 * El orden de las fuentes es a propósito: primero el NOMBRE, después la
 * categoría. El nombre lo escribe el dueño con sus palabras y casi
 * siempre nombra el rubro; la categoría la elige de una lista de seis
 * donde la mitad de los rubros no existe, así que la mayoría termina en
 * "otros". Cuando las dos hablan, gana el nombre.
 */
export function adivinarTipoNegocio(pistas: PistasNegocio): TipoNegocioId | null {
  const { nombre, vertical, categoria } = pistas;

  // La vertical acota: en "eventos" ningún tipo de citas aplica, y
  // sugerir uno reventaría igual que en `guardarTipoNegocio`. Cuando no
  // se conoce la vertical (todavía no la eligió, o es una que este
  // deploy no conoce) se consideran todos los tipos, pero se renuncia
  // al plan B — derivar de una vertical desconocida es inventar.
  const ofrecidos = tiposDeVertical(vertical ?? "").map((t) => t.id as TipoNegocioId);
  const verticalConocida = ofrecidos.length > 0;
  const aplica = (tipo: TipoNegocioId): boolean =>
    !verticalConocida || ofrecidos.includes(tipo);

  // 1. El nombre.
  const palabras = normalizarTexto(nombre ?? "");
  if (palabras.length > 0) {
    // Los espacios de los extremos son los que hacen que la comparación
    // sea por palabra completa: " spa " no está adentro de " espacio ".
    const texto = ` ${palabras.join(" ")} `;

    const candidatos: TipoNegocioId[] = [];
    for (const tipo of Object.keys(SENALES_TIPO) as TipoSugerible[]) {
      if (!aplica(tipo)) continue;
      if (SENALES_TIPO[tipo].some((senal) => texto.includes(` ${senal} `))) {
        candidatos.push(tipo);
      }
    }

    // Dos rubros en un mismo rótulo: no se desempata con la categoría ni
    // con un orden de prioridad. "Spa & Barbería" es las dos cosas, y
    // marcarle una al dueño es adivinarle el negocio.
    if (candidatos.length > 1) return null;
    if (candidatos.length === 1) return candidatos[0];
  }

  // 2. La categoría. `tipoNegocioEfectivo` ya tiene esta tabla y es la
  //    misma que usa el panel para los negocios en null, así que se
  //    reusa en vez de copiarla. Solo se acepta su respuesta cuando dice
  //    algo: "otro" es su forma de encogerse de hombros.
  //
  //    Hace falta la categoría de verdad, no solo la vertical: sin ella
  //    `tipoNegocioEfectivo("eventos", null, null)` contesta
  //    "eventos_proveedor" por descarte, y entre un salón y un DJ eso es
  //    una moneda al aire, no una sugerencia.
  if (verticalConocida && categoria) {
    const derivado = tipoNegocioEfectivo(vertical, categoria, null);
    if (derivado !== "otro" && aplica(derivado)) return derivado;
  }

  return null;
}
