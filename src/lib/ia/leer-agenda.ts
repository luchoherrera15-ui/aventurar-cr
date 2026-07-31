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
 */

import Anthropic from "@anthropic-ai/sdk";
import { calcularCostoUSD } from "./token-counter";
import type { FilaAgenda, FilaCruda, VerticalAgenda } from "@/lib/agenda/importar-agenda";
import { normalizarFila } from "@/lib/agenda/importar-agenda";

const MODELO = "claude-opus-5";

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
    "Este negocio alquila su espacio o presta un servicio por evento: cada renglón toma un DÍA completo y suele traer cantidad de invitados, un rango de horas y un monto.",
  citas:
    "Este negocio atiende por cita: cada renglón es una FRANJA HORARIA de un día (hora de inicio y a veces de cierre), normalmente de una sola persona.",
  hospedajes:
    "Este negocio alquila alojamiento: cada renglón es un RANGO DE NOCHES (entrada y salida) con cantidad de huéspedes.",
  restaurantes:
    "Este negocio reserva mesas: cada renglón es una hora de un día con cantidad de comensales.",
};

function systemPrompt(vertical: VerticalAgenda, hoy: string): string {
  return `Transcribís agendas de reservas costarricenses a datos estructurados. La agenda puede venir escrita a mano, en un cuaderno, en un Excel exportado o en mensajes sueltos.

${QUE_OCUPA[vertical]}

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

async function pedirLectura(
  contenido: ContenidoUsuario,
  vertical: VerticalAgenda,
  hoy: string,
): Promise<ResultadoLectura> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const client = new Anthropic({ apiKey });
  const inicio = Date.now();

  // Streaming: una agenda grande genera bastante JSON y, con el
  // pensamiento adaptativo encendido, una llamada sin stream se puede
  // pasar del timeout HTTP del SDK.
  const stream = client.messages.stream({
    model: MODELO,
    max_tokens: MAX_TOKENS,
    system: systemPrompt(vertical, hoy),
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: ESQUEMA_SALIDA },
    },
    messages: [{ role: "user", content: contenido }],
  });

  const mensaje = await stream.finalMessage();
  const tiempoMs = Date.now() - inicio;

  // Los clasificadores pueden declinar: hay que mirar stop_reason
  // ANTES de tocar content, que puede venir vacío.
  if (mensaje.stop_reason === "refusal") {
    throw new Error(
      "El modelo no pudo procesar esa imagen. Probá con otra foto o cargá la agenda a mano.",
    );
  }
  if (mensaje.stop_reason === "max_tokens") {
    throw new Error(
      "La agenda es demasiado larga para una sola corrida. Subila por partes (por ejemplo, un mes a la vez).",
    );
  }

  const bloqueTexto = mensaje.content.find((b) => b.type === "text");
  if (!bloqueTexto || bloqueTexto.type !== "text") {
    throw new Error("El modelo no devolvió datos legibles.");
  }

  let crudo: { resumen?: unknown; filas?: unknown };
  try {
    crudo = JSON.parse(bloqueTexto.text) as { resumen?: unknown; filas?: unknown };
  } catch {
    throw new Error("El modelo devolvió una respuesta que no se pudo interpretar.");
  }

  const filasCrudas = Array.isArray(crudo.filas) ? crudo.filas : [];
  const filas = filasCrudas
    .filter(
      (f): f is Record<string, unknown> =>
        typeof f === "object" && f !== null && typeof (f as { fecha?: unknown }).fecha === "string",
    )
    .map((f) => normalizarFila(f as FilaCruda));

  const tokensInput = mensaje.usage.input_tokens ?? 0;
  const tokensOutput = mensaje.usage.output_tokens ?? 0;

  return {
    filas,
    resumen: typeof crudo.resumen === "string" ? crudo.resumen : null,
    modelo: MODELO,
    tokensInput,
    tokensOutput,
    costoUsd: calcularCostoUSD(tokensInput, tokensOutput, "opus"),
    tiempoMs,
  };
}

/** Interpreta texto pegado (add-on: es IA igual que la foto). */
export async function leerAgendaDeTexto(
  texto: string,
  vertical: VerticalAgenda,
  hoy: string,
): Promise<ResultadoLectura> {
  return pedirLectura(
    [
      {
        type: "text",
        text: `Transcribí esta agenda a filas estructuradas:\n\n<agenda>\n${texto.slice(0, 60000)}\n</agenda>`,
      },
    ],
    vertical,
    hoy,
  );
}

/** Lee fotos de la agenda (el add-on pago propiamente dicho). */
export async function leerAgendaDeFotos(
  imagenes: ImagenAgenda[],
  vertical: VerticalAgenda,
  hoy: string,
  contexto?: string,
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

  return pedirLectura(contenido, vertical, hoy);
}
