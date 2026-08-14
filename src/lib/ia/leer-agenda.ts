/**
 * Lee una agenda con Claude y devuelve filas listas para revisar.
 *
 * Dos entradas:
 *   - texto: lo que el dueño pegó del cuaderno, de un WhatsApp, de Excel.
 *   - fotos: imágenes de las páginas de la agenda (el add-on pago).
 *
 * El modelo NO guarda nada: propone filas y marca lo que no pudo leer.
 * Siempre pasa por la pantalla de revisión antes de tocar la base —
 * una agenda de papel tiene tachones, apodos y montos a medias, y
 * adivinar eso en silencio sería peor que dejarlo en blanco.
 *
 * Se usa salida estructurada (output_config.format) para que el
 * modelo devuelva JSON validado por el esquema y no haya que parsear
 * texto suelto ni reintentar por comas mal puestas.
 *
 * Qué modelo lee lo decide el panel de IA (agente "agenda_leer"), así que
 * acá nada se puede dar por sentado: hay modelos que no aceptan esfuerzo ni
 * pensamiento y mandárselos devuelve un 400.
 */

import Anthropic from "@anthropic-ai/sdk";
import { modeloDe } from "./config-ia";
import { calcularCosto, MODELOS, type ModeloIA } from "./modelos";
import { registrarDesdeUsage, registrarFalloIA } from "./registrar-uso";
import type { FilaAgenda, FilaCruda, VerticalAgenda } from "@/lib/agenda/importar-agenda";
import { normalizarFila, ocupaFranjaHoraria } from "@/lib/agenda/importar-agenda";

/** Con qué se lee si el panel todavía no configuró nada o la base no responde. */
const MODELO_POR_DEFECTO: ModeloIA = "claude-opus-5";

/** Tope de imágenes por corrida — cada foto de agenda es cara en tokens. */
export const MAX_FOTOS = 8;
/** Alto de salida: una agenda de un año puede ser larga. */
const MAX_TOKENS = 32000;

export type ImagenAgenda = {
  /** "image/jpeg" | "image/png" | "image/webp" | "image/gif" */
  mediaType: string;
  /** base64 sin el prefijo data:. */
  datos: string;
};

/**
 * Para quién se lee la agenda. Van los DOS ejes y no solo la vertical:
 * dentro de Eventos, un LUGAR se alquila por fecha y un PROVEEDOR se
 * contrata por horas, y al modelo hay que decírselo o transcribe la
 * agenda de un DJ como si fuera la de un rancho.
 */
export type NegocioAgenda = {
  vertical: VerticalAgenda;
  categoria: string | null;
};

/**
 * A quién se le atribuye el gasto. La lectura funciona igual sin esto, pero
 * el panel de IA no podría decir qué negocio consumió los tokens.
 */
export type OpcionesLectura = {
  ranchoId?: string | null;
  usuarioId?: string | null;
};

export type ResultadoLectura = {
  filas: FilaAgenda[];
  /** Lo que el modelo quiere decirle al dueño sobre la lectura completa. */
  resumen: string | null;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  costoUsd: number;
  tiempoMs: number;
};

// ------------------------------------------------------------------
// Esquema de salida
// ------------------------------------------------------------------

const ESQUEMA_SALIDA = {
  type: "object",
  properties: {
    resumen: {
      type: "string",
      description:
        "Una o dos frases sobre qué se leyó y qué quedó dudoso en general. En español de Costa Rica.",
    },
    filas: {
      type: "array",
      description: "Una entrada por cada reserva encontrada, en orden de fecha.",
      items: {
        type: "object",
        properties: {
          fecha: {
            type: "string",
            description: "Fecha de la reserva en formato AAAA-MM-DD.",
          },
          fechaFin: {
            type: ["string", "null"],
            description:
              "Solo para hospedajes: día de salida en AAAA-MM-DD. null si no aplica o no se anotó.",
          },
          nombre: {
            type: "string",
            description:
              "Nombre de quien reserva, tal como está escrito. Si está ilegible, escribí tu mejor lectura y avisá en 'avisos'.",
          },
          personas: {
            type: ["integer", "null"],
            description: "Cantidad de personas/invitados/huéspedes. null si no se anotó.",
          },
          horaInicio: {
            type: ["string", "null"],
            description: "Hora de inicio en formato 24h HH:MM. null si no se anotó.",
          },
          horaFin: {
            type: ["string", "null"],
            description:
              "Hora de cierre en formato 24h HH:MM. Puede cruzar medianoche (ej. 00:00). null si no se anotó.",
          },
          montoTotal: {
            type: ["number", "null"],
            description:
              "Lo que vale la reserva, en colones, solo el número. null si no se anotó.",
          },
          adelanto: {
            type: ["number", "null"],
            description:
              "Adelanto/abono/prima ya recibido, en colones. Si la agenda anota total y saldo, el adelanto es la resta. null si no se puede saber.",
          },
          tipoEvento: {
            type: ["string", "null"],
            description: "Tipo de evento o servicio (boda, cumpleaños, corte, etc.). null si no se anotó.",
          },
          telefono: { type: ["string", "null"], description: "Teléfono si aparece. null si no." },
          correo: { type: ["string", "null"], description: "Correo si aparece. null si no." },
          notas: {
            type: ["string", "null"],
            description:
              "Cualquier anotación del margen que valga conservar (ej. 'seguro', 'cancelaron', 'falta confirmar').",
          },
          avisos: {
            type: "array",
            items: { type: "string" },
            description:
              "Qué quedó dudoso EN ESTA fila: letra ilegible, monto a medias, tachón, ambigüedad. Vacío si se leyó limpio.",
          },
        },
        required: [
          "fecha",
          "fechaFin",
          "nombre",
          "personas",
          "horaInicio",
          "horaFin",
          "montoTotal",
          "adelanto",
          "tipoEvento",
          "telefono",
          "correo",
          "notas",
          "avisos",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["resumen", "filas"],
  additionalProperties: false,
} as const;

// ------------------------------------------------------------------
// Prompt
// ------------------------------------------------------------------

const QUE_OCUPA: Record<VerticalAgenda, string> = {
  eventos:
    "Este negocio alquila su ESPACIO para eventos: cada renglón toma un DÍA completo y suele traer cantidad de invitados, un rango de horas y un monto.",
  citas:
    "Este negocio atiende por cita: cada renglón es una FRANJA HORARIA de un día (hora de inicio y a veces de cierre), normalmente de una sola persona.",
  hospedajes:
    "Este negocio alquila alojamiento: cada renglón es un RANGO DE NOCHES (entrada y salida) con cantidad de huéspedes.",
  restaurantes:
    "Este negocio reserva mesas: cada renglón es una hora de un día con cantidad de comensales.",
};

/**
 * Un PROVEEDOR de eventos (DJ, animación, catering, decoración) no
 * trabaja por día: hace una fiesta infantil a las 3 p. m. y una boda a
 * las 9 p. m. el mismo sábado. La hora no es un adorno de la fila — sin
 * ella la reserva no entra en `disponibilidad_citas` y el importador la
 * rechaza (ver `ocupaFranjaHoraria`), así que acá se le pide al modelo
 * que la busque de verdad en vez de rendirse con un null.
 */
const QUE_OCUPA_PROVEEDOR =
  "Este negocio presta un SERVICIO POR HORAS en eventos (música, animación, comida, decoración): cada renglón es una FRANJA HORARIA de un día, y el mismo día puede tener varios servicios seguidos. LA HORA DE INICIO ES EL DATO MÁS IMPORTANTE de cada renglón: buscala en la columna de horas, en el texto del renglón ('a las 3', '3pm', '15h', 'de 3 a 7') o en la nota del margen antes de darla por perdida.";

function systemPrompt(vertical: VerticalAgenda, categoria: string | null, hoy: string): string {
  const queOcupa =
    vertical === "eventos" && ocupaFranjaHoraria(vertical, categoria)
      ? QUE_OCUPA_PROVEEDOR
      : QUE_OCUPA[vertical];

  return `Transcribís agendas de reservas costarricenses a datos estructurados. La agenda puede venir escrita a mano, en un cuaderno, en un Excel exportado o en mensajes sueltos.

${queOcupa}

Reglas de lectura:

1. Transcribí TODO renglón que sea una reserva. No filtres por importancia ni por qué tan completo esté: una fila con solo un nombre y una fecha vale, con sus avisos.
2. Nunca inventes datos. Si el monto, las personas o la hora no están anotados, poné null. Un null honesto es mejor que un número inventado.
3. Cuando la letra sea dudosa, escribí tu mejor lectura en el campo y explicá la duda en "avisos" de esa fila. No dejes el campo vacío por inseguridad.
4. Montos en colones, solo el número: "₡180.000" → 180000, "180 mil" → 180000, "180k" → 180000.
5. Si la agenda anota un total y un saldo pendiente, el adelanto es (total − saldo). Si solo anota un abono, ese es el adelanto y el total queda null.
6. Fechas siempre AAAA-MM-DD. Hoy es ${hoy}. Si el año no está escrito, deducilo del contexto de la agenda (el encabezado del mes, el orden de las páginas) y avisá que lo dedujiste. Si la agenda dice el día de la semana y no calza con la fecha, dejá la fecha y avisá.
7. Horas en 24h HH:MM. "3pm a 12" → horaInicio "15:00", horaFin "00:00". "8 a 5" en una agenda de eventos de día → "08:00" a "17:00".
8. Anotaciones del margen ("seguro", "cancelaron", "tentativo", "en lápiz", una flecha a otra nota) van en "notas" y, si cambian el estado de la reserva, también en "avisos".
9. Si una página trae varias columnas o dos meses, leelas todas.
10. Los tachones y lo reescrito encima: usá el valor final y avisá que hubo corrección.

Trabajás para la persona dueña del negocio, que va a revisar cada fila antes de guardarla. Tu trabajo es cobertura y honestidad sobre lo dudoso, no pulcritud.`;
}

// ------------------------------------------------------------------
// Llamada
// ------------------------------------------------------------------

type ContenidoUsuario = Anthropic.Messages.ContentBlockParam[];

/**
 * Qué modelo lee la agenda. Lo manda el panel de IA; si la configuración no
 * se puede leer se sigue con Opus, que es lo que el add-on venía usando —
 * una lectura cara es mejor que un add-on pago caído.
 */
async function modeloDeAgenda(): Promise<ModeloIA> {
  try {
    return await modeloDe("agenda_leer");
  } catch {
    return MODELO_POR_DEFECTO;
  }
}

/**
 * El `usage` que se puede rescatar de un stream, ya sea del mensaje completo o
 * del borrador a medias. Todos los campos son opcionales porque una respuesta
 * cortada puede no traerlos.
 */
type UsoDeStream =
  | {
      input_tokens?: number | null;
      output_tokens?: number | null;
      cache_creation_input_tokens?: number | null;
      cache_read_input_tokens?: number | null;
    }
  | undefined;

/** Tokens siempre enteros y no negativos: uso_ia no admite basura. */
const entero = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;

/** Texto del error para la bitácora, sin romperse con lo que no sea Error. */
function motivoDelError(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  return typeof e === "string" && e.trim() ? e : "La lectura se cortó sin explicación.";
}

async function pedirLectura(
  contenido: ContenidoUsuario,
  negocio: NegocioAgenda,
  hoy: string,
  opciones: OpcionesLectura = {},
): Promise<ResultadoLectura> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const modelo = await modeloDeAgenda();
  const info = MODELOS[modelo];

  const client = new Anthropic({ apiKey });
  const inicio = Date.now();

  // La salida estructurada la aceptan todos los modelos; el esfuerzo NO.
  // Mandarle output_config.effort a Haiku 4.5 devuelve un 400 y el add-on
  // se cae entero, así que se pregunta antes en vez de darlo por hecho.
  const salida: Anthropic.Messages.OutputConfig = {
    format: { type: "json_schema", schema: ESQUEMA_SALIDA },
  };
  if (info.soportaEsfuerzo) salida.effort = "high";

  const parametros: Anthropic.Messages.MessageStreamParams = {
    model: modelo,
    // Nunca pedir más de lo que el modelo puede responder de una vez.
    max_tokens: Math.min(MAX_TOKENS, info.salidaMaxima),
    system: systemPrompt(negocio.vertical, negocio.categoria, hoy),
    output_config: salida,
    messages: [{ role: "user", content: contenido }],
  };
  // Mismo cuidado con el pensamiento: los modelos que no razonan lo rechazan.
  if (info.razonaPorDefecto) parametros.thinking = { type: "adaptive" };

  // Streaming: una agenda grande genera bastante JSON y, con el
  // pensamiento adaptativo encendido, una llamada sin stream se puede
  // pasar del timeout HTTP del SDK.
  const stream = client.messages.stream(parametros);

  // Anthropic factura los tokens que alcanzó a generar aunque el stream se
  // corte a la mitad. Este add-on es PAGO: un gasto que no llega a uso_ia es
  // plata que el panel nunca ve. Por eso ningún camino de salida de esta
  // función puede irse sin dejar su fila.
  let registrado = false;
  // El consumo definitivo, apenas el mensaje cierra. El SDK borra su borrador
  // interno cuando el stream termina bien, así que si algo revienta DESPUÉS
  // (parseo, normalización de filas) esta copia es la única que queda.
  let usoConocido: UsoDeStream;

  /**
   * Deja constancia del gasto de una llamada que no terminó bien.
   * Nunca lanza (registrarFalloIA se traga sus propios errores), así que
   * puede llamarse desde el catch sin tapar el error original.
   */
  const registrarFallo = async (uso: UsoDeStream, motivo: string, tiempoMs: number) => {
    registrado = true;
    await registrarFalloIA({
      agente: "agenda_leer",
      modelo,
      tokensInput: entero(uso?.input_tokens),
      tokensOutput: entero(uso?.output_tokens),
      tokensCacheWrite: entero(uso?.cache_creation_input_tokens),
      tokensCacheRead: entero(uso?.cache_read_input_tokens),
      tiempoMs,
      error: motivo.slice(0, 500),
      ranchoId: opciones.ranchoId ?? null,
      usuarioId: opciones.usuarioId ?? null,
    });
  };

  try {
    const mensaje = await stream.finalMessage();
    const tiempoMs = Date.now() - inicio;
    const usage = mensaje.usage;
    usoConocido = usage;

    /**
     * Corta la lectura dejando constancia del gasto: cuando el modelo declina
     * o se pasa de largo los tokens ya se facturaron, así que tienen que
     * aparecer en el panel aunque el dueño no reciba ninguna fila.
     */
    const abortar = async (motivo: string): Promise<never> => {
      await registrarFallo(usage, motivo, tiempoMs);
      throw new Error(motivo);
    };

    // Los clasificadores pueden declinar: hay que mirar stop_reason
    // ANTES de tocar content, que puede venir vacío.
    if (mensaje.stop_reason === "refusal") {
      return abortar(
        "El modelo no pudo procesar esa imagen. Probá con otra foto o cargá la agenda a mano.",
      );
    }
    if (mensaje.stop_reason === "max_tokens") {
      return abortar(
        "La agenda es demasiado larga para una sola corrida. Subila por partes (por ejemplo, un mes a la vez).",
      );
    }

    const bloqueTexto = mensaje.content.find((b) => b.type === "text");
    if (!bloqueTexto || bloqueTexto.type !== "text") {
      return abortar("El modelo no devolvió datos legibles.");
    }

    let crudo: { resumen?: unknown; filas?: unknown };
    try {
      crudo = JSON.parse(bloqueTexto.text) as { resumen?: unknown; filas?: unknown };
    } catch {
      return abortar("El modelo devolvió una respuesta que no se pudo interpretar.");
    }

    const filasCrudas = Array.isArray(crudo.filas) ? crudo.filas : [];
    const filas = filasCrudas
      .filter(
        (f): f is Record<string, unknown> =>
          typeof f === "object" &&
          f !== null &&
          typeof (f as { fecha?: unknown }).fecha === "string",
      )
      .map((f) => normalizarFila(f as FilaCruda));

    const tokensInput = entero(usage.input_tokens);
    const tokensOutput = entero(usage.output_tokens);

    // El add-on se cobra por importaciones_agenda (lo escribe la ruta), pero el
    // panel de IA mira una sola tabla: acá queda la copia de este gasto.
    // Se marca ANTES de esperar el insert: si el registro fallara, ya lo reporta
    // por dentro registrarUsoIA y no queremos que el catch escriba una segunda
    // fila diciendo que la lectura falló, porque no falló.
    registrado = true;
    await registrarDesdeUsage(
      {
        input_tokens: tokensInput,
        output_tokens: tokensOutput,
        cache_creation_input_tokens: entero(usage.cache_creation_input_tokens),
        cache_read_input_tokens: entero(usage.cache_read_input_tokens),
      },
      {
        agente: "agenda_leer",
        modelo,
        tiempoMs,
        ranchoId: opciones.ranchoId ?? null,
        usuarioId: opciones.usuarioId ?? null,
      },
    );

    return {
      filas,
      resumen: typeof crudo.resumen === "string" ? crudo.resumen : null,
      modelo,
      tokensInput,
      tokensOutput,
      // Con el modelo real: si el panel cambia a Sonnet, el costo no puede
      // seguir contándose a precio de Opus.
      costoUsd: calcularCosto(modelo, tokensInput, tokensOutput),
      tiempoMs,
    };
  } catch (e) {
    // Acá cae lo que no pasa por abortar(): se cortó la conexión, timeout del
    // SDK, 429/500 de Anthropic, o el proceso murió a media generación. Los
    // tokens que el modelo alcanzó a producir ya están facturados.
    if (!registrado) {
      // Si el mensaje llegó a cerrar, `usoConocido` trae la cuenta exacta. Si se
      // cortó antes, se rescata el borrador que el SDK va armando con los
      // eventos recibidos hasta el corte.
      //
      // OJO con ese número: `input_tokens` y el caché son exactos (llegan en el
      // primer evento), pero `output_tokens` recién se actualiza en el evento
      // de cierre de la generación. Si el corte fue antes de ese evento, la
      // salida queda contada de menos —a veces en 0— aunque Anthropic sí la
      // haya cobrado. Se registra igual a propósito: una fila corta con el
      // error escrito deja ver que hubo una llamada que gastó, y eso vale
      // infinitamente más que no dejar ninguna fila.
      const uso = usoConocido ?? stream.currentMessage?.usage;
      await registrarFallo(uso, motivoDelError(e), Date.now() - inicio);
    }
    // El error sigue viaje tal cual: la ruta necesita el mensaje para
    // `importaciones_agenda` y para contestarle al dueño.
    throw e;
  }
}


/** Interpreta texto pegado (add-on: es IA igual que la foto). */
export async function leerAgendaDeTexto(
  texto: string,
  negocio: NegocioAgenda,
  hoy: string,
  opciones: OpcionesLectura = {},
): Promise<ResultadoLectura> {
  return pedirLectura(
    [
      {
        type: "text",
        text: `Transcribí esta agenda a filas estructuradas:\n\n<agenda>\n${texto.slice(0, 60000)}\n</agenda>`,
      },
    ],
    negocio,
    hoy,
    opciones,
  );
}

/** Lee fotos de la agenda (el add-on pago propiamente dicho). */
export async function leerAgendaDeFotos(
  imagenes: ImagenAgenda[],
  negocio: NegocioAgenda,
  hoy: string,
  contexto?: string,
  opciones: OpcionesLectura = {},
): Promise<ResultadoLectura> {
  if (imagenes.length === 0) throw new Error("No llegó ninguna foto.");

  const contenido: ContenidoUsuario = [];
  imagenes.slice(0, MAX_FOTOS).forEach((img, i) => {
    contenido.push({
      type: "text",
      text: `Página ${i + 1} de ${Math.min(imagenes.length, MAX_FOTOS)}:`,
    });
    contenido.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: img.datos,
      },
    });
  });

  contenido.push({
    type: "text",
    text: contexto?.trim()
      ? `Transcribí estas páginas de la agenda a filas estructuradas.\n\nContexto que da el dueño del negocio: ${contexto.trim().slice(0, 2000)}`
      : "Transcribí estas páginas de la agenda a filas estructuradas.",
  });

  return pedirLectura(contenido, negocio, hoy, opciones);
}
