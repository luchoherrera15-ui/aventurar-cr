"use server";

import { celebracionPorId } from "@/lib/celebrar/datos";
import { NOMBRE_SECCION, type TipoSeccion } from "@/lib/celebrar/invitacion/esquema";
import { TONOS, type TonoIA } from "@/lib/celebrar/ia-tonos";
import { tipoCelebracion } from "@/lib/celebrar/marca";
import { fechaLargaCR } from "@/lib/fechas";
import { motivoParaNoGastar } from "@/lib/ia/config-ia";
import { GeminiProvider } from "@/lib/ia/gemini-provider";
import { registrarUsoIA } from "@/lib/ia/registrar-uso";
import { createClient } from "@/lib/supabase/server";

/**
 * ══════════════════════════════════════════════════════════════════
 *  TEXTOS CON IA — el «diamantito» al lado de cada campo del editor
 * ══════════════════════════════════════════════════════════════════
 *
 * La persona toca el ícono de IA de un campo (el saludo, la frase de la
 * portada, el texto de la historia, la nota de vestimenta…) y recibe
 * TRES opciones escritas para su celebración, con el tono que eligió.
 * Toca una y queda en el campo; sigue editándola a mano si quiere.
 *
 * Va con **Google Gemini** (Flash Lite, sin razonamiento: barato y en
 * uno o dos segundos), no con Claude: son textos cortos y muchos, y el
 * dueño lo pidió así. Cada llamada queda en `uso_ia` con el agente
 * `celebrar_textos` — es lo que después se cobra en créditos (Fase 4);
 * por ahora no descuenta nada.
 */

/**
 * Primero el Lite 3.5; si contesta 503 «high demand» o no responde en
 * TIMEOUT_MS, se prueba el alias «latest» una vez. Cada intento que
 * llegó a la API queda registrado con su modelo.
 */
const MODELOS_EN_ORDEN = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"] as const;
type ModeloTextos = (typeof MODELOS_EN_ORDEN)[number];
const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 500;
/**
 * Enfriamiento pedido por el dueño (21 sep): generadas 3 opciones para un
 * campo, para pedir otras 3 hay que esperar 5 minutos. Se guarda en la
 * base (celebrar_ia_usos), no en memoria: no se salta recargando.
 */
const ENFRIAMIENTO_MS = 5 * 60 * 1000;
const MAX_INDICACION = 300;
const MAX_ACTUAL = 600;

const GUIA_TONO: Record<TonoIA, string> = {
  calido: "cálido y cercano, como una carta a alguien querido",
  elegante: "elegante y sereno, de papelería fina; frases con aire",
  divertido: "alegre y con chispa, sin chistes forzados ni emojis",
  formal: "formal y sobrio, de tarjeta impresa tradicional",
  breve: "muy breve: una línea, máximo doce palabras",
};

/** Qué es cada campo, para que el modelo sepa qué está escribiendo. */
const QUE_ES: Record<string, string> = {
  saludo: "el rótulo corto sobre los nombres en la portada (p. ej. «Nos casamos», «Mis quince años»); de 2 a 5 palabras",
  subtitulo: "la frase de la portada, debajo de los nombres; una oración",
  titulo: "el título de la sección; de 1 a 4 palabras",
  texto: "el texto de la sección; de una a tres oraciones",
  firma: "la firma del cierre, como firman los anfitriones; muy corta",
  boton: "el texto del botón de confirmar; de 2 a 4 palabras",
  pregunta: "una pregunta frecuente de los invitados; corta",
  respuesta: "la respuesta a esa pregunta; una o dos oraciones",
  detalle: "un detalle corto de un momento del programa; una línea",
};

export type PedidoTexto = {
  celebracionId: string;
  seccion: TipoSeccion;
  campo: string;
  /** Lo que hay escrito ahora (para mejorarlo) — puede ir vacío. */
  actual: string;
  tono: TonoIA;
  /** Algo que la persona quiere que diga (opcional). */
  indicacion: string;
};

export type ResultadoTextos =
  | { ok: true; opciones: string[]; disponibleEn: number }
  | { ok: false; mensaje: string; esperarMs?: number };

function extraerOpciones(texto: string): string[] {
  const inicio = texto.indexOf("[");
  const fin = texto.lastIndexOf("]");
  if (inicio >= 0 && fin > inicio) {
    try {
      const v = JSON.parse(texto.slice(inicio, fin + 1));
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
    } catch {
      /* cae al respaldo de líneas */
    }
  }
  // Respaldo: una opción por línea, sin viñetas ni numeración.
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["«]|["»]$/g, "").trim())
    .filter((l) => l.length > 0 && l.length <= 400)
    .slice(0, 3);
}

export async function sugerirTextos(pedido: PedidoTexto): Promise<ResultadoTextos> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return { ok: false, mensaje: "La IA de textos no está configurada en este entorno (falta GOOGLE_GEMINI_API_KEY)." };
  if (!TONOS.includes(pedido.tono)) return { ok: false, mensaje: "Tono inválido." };
  if (!(pedido.seccion in NOMBRE_SECCION)) return { ok: false, mensaje: "Sección inválida." };

  // Solo la dueña (RLS decide) y solo si el tope mensual de IA lo permite.
  const c = await celebracionPorId(pedido.celebracionId);
  if (!c) return { ok: false, mensaje: "No encontramos esa celebración en tu cuenta." };
  const bloqueo = await motivoParaNoGastar();
  if (bloqueo) return { ok: false, mensaje: bloqueo };

  // ¿Ya se generó este campo hace menos de 5 minutos?
  const supabase = await createClient();
  const clave = `${pedido.seccion}:${pedido.campo}`.slice(0, 80);
  const { data: uso } = await supabase
    .from("celebrar_ia_usos")
    .select("ultimo")
    .eq("celebracion_id", c.id)
    .eq("clave", clave)
    .maybeSingle();
  if (uso?.ultimo) {
    const transcurrido = Date.now() - new Date(uso.ultimo).getTime();
    if (transcurrido < ENFRIAMIENTO_MS) {
      const faltan = ENFRIAMIENTO_MS - transcurrido;
      return { ok: false, mensaje: `Ya generaste opciones para este campo. Podés pedir otras 3 en ${Math.ceil(faltan / 60000)} min.`, esperarMs: faltan };
    }
  }

  const tipo = tipoCelebracion(c.tipo);
  const queEs = QUE_ES[pedido.campo] ?? "un texto corto de la sección";
  const actual = pedido.actual.trim().slice(0, MAX_ACTUAL);
  const indicacion = pedido.indicacion.trim().slice(0, MAX_INDICACION);

  const system = `Sos el redactor de invitaciones digitales de CELEBRAR (Costa Rica). Escribís en español de Costa Rica, con voseo («vos», «confirmá», «acompañanos»), sin emojis, sin comillas, sin marcas registradas y sin inventar datos que no te den (nombres, fechas, lugares).
Devolvés SOLO un arreglo JSON de exactamente 3 strings, cada uno una opción distinta para el mismo campo, sin explicaciones ni markdown.`;

  const contexto = [
    `Celebración: ${tipo?.nombre ?? c.tipo} — «${c.nombre}».`,
    c.fecha ? `Fecha: ${fechaLargaCR(c.fecha)}${c.hora ? `, ${c.hora.slice(0, 5)}` : ""}.` : "Sin fecha confirmada.",
    c.lugar_nombre ? `Lugar: ${c.lugar_nombre}.` : "",
    `Sección: «${NOMBRE_SECCION[pedido.seccion]}». Campo: ${queEs}.`,
    `Tono: ${GUIA_TONO[pedido.tono]}.`,
    actual ? `Texto actual (mejorarlo o proponer alternativas del mismo espíritu): «${actual}».` : "El campo está vacío: proponé desde cero.",
    indicacion ? `Lo que la persona quiere que diga: «${indicacion}».` : "",
    "Respondé con el arreglo JSON de 3 opciones.",
  ]
    .filter(Boolean)
    .join("\n");

  const provider = new GeminiProvider(apiKey);
  let resultado: Awaited<ReturnType<GeminiProvider["generar"]>> | null = null;
  let MODELO: ModeloTextos = MODELOS_EN_ORDEN[0];
  let arranque = Date.now();
  for (const modelo of MODELOS_EN_ORDEN) {
    MODELO = modelo;
    arranque = Date.now();
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
      resultado = await provider.generar({
        modelo,
        maxTokens: MAX_TOKENS,
        system,
        turnos: [{ role: "user", content: contexto }],
        sinRazonamiento: true,
        abortSignal: control.signal,
      });
    } catch (e) {
      // Timeout (abort) o red: se prueba el siguiente modelo.
      console.error(`[celebrar/ia-textos] ${modelo} no respondió:`, e instanceof Error ? e.message : e);
      resultado = null;
      continue;
    } finally {
      clearTimeout(reloj);
    }
    // 503 «high demand» → al siguiente; cualquier otra cosa se queda.
    if (resultado.outcome === "provider_error" && /503|UNAVAILABLE|high demand/i.test(resultado.mensaje)) {
      console.error(`[celebrar/ia-textos] ${modelo} saturado, probando el respaldo`);
      continue;
    }
    break;
  }
  if (!resultado) return { ok: false, mensaje: "La IA está tardando demasiado ahora mismo. Probá de nuevo en un momento." };

  if (resultado.outcome !== "provider_error") {
    // Se registra en todos los caminos con `usage`: los tokens ya se gastaron.
    void registrarUsoIA({
      agente: "celebrar_textos",
      modelo: MODELO,
      tokensInput: resultado.usage?.tokensEntrada ?? 0,
      tokensOutput: resultado.usage?.tokensSalida ?? 0,
      tokensCacheRead: resultado.usage?.tokensCacheLectura ?? 0,
      tiempoMs: Date.now() - arranque,
      exito: resultado.outcome === "success",
      error: resultado.outcome === "success" ? null : resultado.outcome,
      usuarioId: c.owner_id,
      referenciaId: c.id,
    });
  }

  switch (resultado.outcome) {
    case "success": {
      const opciones = extraerOpciones(resultado.texto).slice(0, 3);
      if (opciones.length === 0) return { ok: false, mensaje: "La IA no devolvió opciones legibles. Probá otra vez." };
      // Arranca el enfriamiento (RLS: solo la dueña escribe en su celebración).
      const ahora = new Date();
      await supabase
        .from("celebrar_ia_usos")
        .upsert({ celebracion_id: c.id, clave, ultimo: ahora.toISOString() }, { onConflict: "celebracion_id,clave" });
      return { ok: true, opciones, disponibleEn: ahora.getTime() + ENFRIAMIENTO_MS };
    }
    case "refused":
      return { ok: false, mensaje: "La IA no quiso escribir eso. Probá con otra indicación." };
    case "max_output":
      return { ok: false, mensaje: "Se cortó la respuesta. Probá de nuevo." };
    case "empty_response":
      return { ok: false, mensaje: "La IA no devolvió nada. Probá de nuevo." };
    case "provider_error":
      console.error("[celebrar/ia-textos] provider_error:", resultado.mensaje);
      return { ok: false, mensaje: "La IA no respondió. Probá de nuevo en un momento." };
  }
}
