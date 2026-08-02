import Anthropic from "@anthropic-ai/sdk";
import { MODELOS, type ModeloIA } from "./modelos";
import type { UsageAnthropic } from "./registrar-uso";

/**
 * La invitación para papel: UNA hoja, hermana del diseño digital.
 *
 * El primer intento imprimía el mismo HTML de la invitación con reglas
 * de @media print. No funciona y no es cuestión de afinar el CSS: un
 * diseño que se recorre por secciones a pantalla completa ocupa cinco
 * hojas mal cortadas. El papel pide otra composición.
 *
 * Así que se genera una pieza nueva, con el diseño digital como
 * REFERENCIA: mismo fondo, misma paleta, misma tipografía, los mismos
 * motivos — se reconoce que son la misma invitación — pero compuesta
 * para leerse de un vistazo en una sola hoja.
 */

export const SYSTEM_IMPRESION = `Sos un diseñador gráfico especializado en papelería de eventos.
Recibís el HTML de una invitación digital y componés su versión IMPRESA.

NO es la misma página reformateada: es una pieza nueva, hermana de la
digital. Tiene que reconocerse de inmediato que son la misma invitación.

LO QUE SE HEREDA (esto es lo que las hace hermanas):
- El fondo: si la digital tiene un degradado, una textura o un color de
  base, la impresa lleva el mismo tratamiento.
- La paleta completa, con los mismos acentos.
- Las tipografías y su jerarquía.
- Los motivos y ornamentos del diseño (marcos, líneas, viñetas, íconos,
  las formas que le dan carácter). Reinterpretados para papel, no
  copiados posición por posición.
- El tono: si la digital es sobria, la impresa es sobria.

LO QUE CAMBIA (esto es lo que la hace impresa):
- UNA SOLA HOJA. Es la regla que manda sobre todas las demás.
- Composición cerrada, de un vistazo, como una tarjeta de invitación de
  verdad: no hay desplazamiento, no hay secciones que se suceden.
- Toda la información del evento junta y jerarquizada: ocasión, nombres,
  fecha, hora, lugar y dirección.
- Sin animaciones, sin cuenta regresiva, sin confirmar asistencia, sin
  videos, sin mapas embebidos, sin botones. En papel nada de eso existe.

REGLAS TÉCNICAS:
1. Respondé SOLO con el HTML, sin explicaciones ni markdown.
2. Un único <style> embebido. Sin <script>. Sin recursos externos.
3. La hoja: componé sobre un contenedor de 170mm de ancho por 250mm de
   alto como MÁXIMO. Ese es el área segura que entra tanto en Carta
   como en A4 con márgenes. Usá milímetros y puntos, no vh ni vw.
4. Nada puede desbordar ese alto: si el contenido no cabe, achicá
   cuerpos y espaciados hasta que quepa. Es preferible una tipografía
   más chica antes que una segunda hoja.
5. Fondo claro. Si la invitación digital es sobre fondo oscuro,
   trasladá su identidad a papel: el color oscuro pasa a acentos,
   marcos o filetes, y el texto va oscuro sobre claro. Un fondo negro a
   sangre se come el tóner y sale sucio.
6. Si el diseño digital usa fotos del cliente (<img> con URL), podés
   usar UNA como elemento gráfico si aporta; nunca inventes imágenes.
7. Envolvé todo en <div class="hoja-impresa"> … </div>.
8. La esquina INFERIOR DERECHA de la hoja está reservada: la pantalla
   pega ahí un código QR de 22 mm. Dejá libre un cuadrado de 30 × 30 mm
   en esa esquina — sin texto, sin ornamentos y sin nada que importe.
   No dibujes vos el QR ni dejes un recuadro marcándolo: solo dejá el
   espacio, con el fondo que corresponda.

El HTML se inserta dentro de una página, así que no incluyas <html>,
<head> ni <body>.`;

export interface ResultadoImpresion {
  html: string;
  usage: UsageAnthropic;
  tiempoMs: number;
}

export class ErrorImpresionIA extends Error {
  readonly usage: UsageAnthropic | null;
  readonly tiempoMs: number;

  constructor(mensaje: string, usage: UsageAnthropic | null, tiempoMs: number) {
    super(mensaje);
    this.name = "ErrorImpresionIA";
    this.usage = usage;
    this.tiempoMs = tiempoMs;
  }
}

/** El usage del SDK trae nulls; se normalizan a 0. */
function aUsage(u: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): UsageAnthropic {
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
  };
}

/**
 * Compone la versión impresa a partir del diseño digital.
 *
 * `datosEvento` es texto libre con lo que se sabe del evento (título,
 * fecha, lugar): el HTML digital suele traerlo, pero si el diseño lo
 * puso dentro de una imagen o lo abrevió, esto lo respalda.
 */
export async function generarInvitacionImpresa({
  htmlDigital,
  datosEvento,
  modelo,
}: {
  htmlDigital: string;
  datosEvento: string;
  modelo: ModeloIA;
}): Promise<ResultadoImpresion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const info = MODELOS[modelo];
  // El razonamiento sale del mismo tope que el texto en los modelos que
  // razonan por defecto, y esta pieza es densa en CSS.
  const maxTokens = Math.min(info.razonaPorDefecto ? 24000 : 12000, info.salidaMaxima);

  const inicio = Date.now();
  const client = new Anthropic({ apiKey });

  // Streaming obligatorio, igual que en generador-invitaciones.ts y en
  // leer-agenda.ts. El SDK estima cuánto puede tardar una llamada SIN
  // stream a partir de max_tokens (3600 s × max_tokens ÷ 128.000) y si le
  // da más de 10 minutos ni siquiera la manda: contesta al instante con
  // "Streaming is required for operations that may take longer than 10
  // minutes". El corte cae en ~21.300 tokens, así que los 24.000 de los
  // modelos que razonan reventaban SIEMPRE — nunca salió una hoja con
  // Opus. No es un problema de tiempo: la petición no llegaba a salir.
  //
  // Subirle el timeout al cliente no sirve: calla al SDK pero la ruta
  // muere igual en el maxDuration de Vercel. Con stream la conexión no
  // queda muda esperando, que es lo que de verdad rompía.
  const stream = client.messages.stream({
    model: modelo,
    max_tokens: maxTokens,
    system: SYSTEM_IMPRESION,
    messages: [
      {
        role: "user",
        content: `Componé la versión impresa de esta invitación, en UNA hoja.

DATOS DEL EVENTO:
${datosEvento}

HTML DE LA INVITACIÓN DIGITAL (tu referencia de identidad visual):
${htmlDigital}`,
      },
    ],
  });
  // El mensaje ya armado: mismo objeto que devolvía create(), así que
  // stop_reason, content y usage se leen igual que antes.
  const response = await stream.finalMessage();

  const tiempoMs = Date.now() - inicio;
  const usage = aUsage(response.usage);

  if (response.stop_reason === "max_tokens") {
    throw new ErrorImpresionIA(
      "La versión impresa quedó incompleta. Probá de nuevo.",
      usage,
      tiempoMs,
    );
  }
  if (response.stop_reason === "refusal") {
    throw new ErrorImpresionIA(
      "El modelo no pudo componer esta invitación para papel.",
      usage,
      tiempoMs,
    );
  }

  // El bloque de texto y no content[0]: con razonamiento activo el
  // primero es el bloque de pensamiento.
  const bloque = response.content.find(
    (b): b is Extract<typeof b, { type: "text" }> => b.type === "text",
  );
  const html = (bloque?.text ?? "").trim();
  if (!html.includes("<")) {
    throw new ErrorImpresionIA("El modelo no devolvió HTML.", usage, tiempoMs);
  }

  return { html, usage, tiempoMs };
}
