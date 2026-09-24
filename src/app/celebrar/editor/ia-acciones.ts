"use server";

import { revalidatePath } from "next/cache";
import { celebracionPorId, saldoCreditos } from "@/lib/celebrar/datos";
import { traducirErrorDeBase } from "@/lib/celebrar/errores-base";
import {
  DECORACIONES,
  ESQUINAS,
  HEROES,
  ORNAMENTOS,
  PARTICULAS,
  RITMOS,
  TEMAS,
  TEXTURAS,
  TIPOS_SECCION,
  TRANSICIONES,
  normalizarDocumento,
  rellenarConCelebracion,
  type Documento,
} from "@/lib/celebrar/invitacion/esquema";
import { FUENTES } from "@/lib/celebrar/invitacion/fuentes";
import { tipoCelebracion } from "@/lib/celebrar/marca";
import { PALETAS } from "@/lib/celebrar/plantillas/paletas";
import { PREFIJO_CELEBRAR, RUTA } from "@/lib/celebrar/rutas";
import type { AIProvider } from "@/lib/ia/ai-provider";
import { ClaudeProvider } from "@/lib/ia/claude-provider";
import { motivoParaNoGastar } from "@/lib/ia/config-ia";
import { GeminiProvider } from "@/lib/ia/gemini-provider";
import { BOTS_IA, BOT_POR_DEFECTO, esBotIA, type BotIA } from "@/lib/celebrar/ia-modelos";
import { armarPedidoIA, normalizarDatosIA, type DatosIA } from "@/lib/celebrar/ia-prompt";
import { registrarDesdeUsage, registrarFalloIA } from "@/lib/ia/registrar-uso";
import { createClient } from "@/lib/supabase/server";


/**
 * ══════════════════════════════════════════════════════════════════
 *  CREAR LA INVITACIÓN DESDE CERO, CON IA
 * ══════════════════════════════════════════════════════════════════
 *
 * El segundo camino del brief: en vez de elegir una plantilla, la
 * persona describe lo que quiere y el modelo produce el DOCUMENTO
 * (estilo + secciones + textos). No produce HTML: produce el mismo JSON
 * que el editor entiende, así que lo generado se puede seguir editando
 * en vivo como cualquier plantilla — y pasa por `normalizarDocumento`,
 * que descarta cualquier cosa fuera del esquema.
 *
 * Reutiliza la tubería de IA del sitio: `ClaudeProvider`, el modelo
 * configurado para generar invitaciones (`configuracion_plataforma`),
 * el tope mensual (`motivoParaNoGastar`) y el registro de costo en
 * `uso_ia` con el agente `celebrar_generar`.
 *
 * Créditos: cada bot tiene un precio fijo (lib/celebrar/ia-modelos.ts) que
 * se cobra con `celebrar_consumir_creditos` después de guardar la
 * invitación. El costo real por corrida queda en `uso_ia` para el equipo.
 */

const MAX_PROMPT = 1200;

function systemPrompt(tipoNombre: string, celebracion: string): string {
  const fuentes = FUENTES.map((f) => `${f.id} (${f.caracter})`).join(", ");
  const paletas = Object.values(PALETAS)
    .flat()
    .slice(0, 12)
    .map((p) => `${p.fondo}/${p.tinta}/${p.acento} escena ${p.escena}/${p.tintaEscena}`)
    .join(" · ");
  return `Sos el diseñador de invitaciones digitales de CELEBRAR (Costa Rica, voseo). Producís UN objeto JSON —y nada más, sin explicaciones ni markdown— que describe una invitación para: ${tipoNombre} «${celebracion}».

FORMATO EXACTO:
{
  "estilo": {
    "paleta": { "fondo": "#rrggbb", "tinta": "#rrggbb", "acento": "#rrggbb", "suave": "#rrggbb", "superficie": "#rrggbb", "escena": "#rrggbb", "tintaEscena": "#rrggbb" },
    "fuenteTitulo": <uno de: ${fuentes}>,
    "fuenteTexto": <uno de los ids anteriores, preferí sans para texto>,
    "heroe": <uno de: ${HEROES.join(", ")}>,
    "decoracion": <uno de: ${DECORACIONES.join(", ")}>  (motivo de línea fina detrás de las escenas),
    "decoracionEscala": "fina" | "media" | "grande",
    "decoracionIntensidad": "sutil" | "media" | "fuerte",
    "decoracionDisposicion": "todo" | "bordes" | "portada",
    "esquinas": <uno de: ${ESQUINAS.join(", ")}>  (ilustración en las esquinas de la portada),
    "ornamento": <uno de: ${ORNAMENTOS.join(", ")}>  (el adorno bajo los títulos),
    "textura": <uno de: ${TEXTURAS.join(", ")}>,
    "ritmo": <uno de: ${RITMOS.join(", ")}>  (alternar = las escenas van fondo/escena/fondo, como una carta por capítulos),
    "transicion": <uno de: ${TRANSICIONES.join(", ")}>  (el borde entre escenas),
    "particulas": <uno de: ${PARTICULAS.join(", ")}>,
    "tema": <uno de: ${TEMAS.join(", ")}>  (solo si la fiesta ES de ese tema: escenario en la portada y un personaje que cruza cada sección; si no, "ninguno"),
    "marco": false,
    "bordes": "rectos" | "suaves" | "redondos",
    "animaciones": true
  },
  "secciones": [ { "tipo": <uno de: ${TIPOS_SECCION.join(", ")}>, "visible": true, "datos": { ... } } ]
}

DATOS POR TIPO DE SECCIÓN (todos los textos en español de Costa Rica, cálidos y breves):
- hero: { "saludo", "titulo", "subtitulo", "mostrarFecha": true }  (titulo = el nombre de la celebración, tal cual)
- countdown: { "titulo", "texto" }
- detalles: { "titulo", "texto" }
- ubicacion: { "titulo", "lugares": [ { "titulo", "lugar": "", "direccion": "", "hora": "", "mapsUrl": "" } ] }  (dejá lugar/direccion vacíos: los llena la persona)
- historia: { "titulo", "texto" }  (2 a 4 frases, en primera persona del plural si es pareja)
- galeria: { "titulo", "fotos": [] }
- dress_code: { "titulo", "texto", "grupos": [ { "titulo": "Caballeros", "texto" }, { "titulo": "Damas", "texto" } ], "colores": [] }
- itinerario: { "titulo", "items": [ { "hora": "4:00 p. m.", "titulo", "detalle" } ] }  (el programa del día; horas plausibles pero sin inventar la hora del evento)
- rsvp: { "titulo", "texto", "boton" }
- regalos: { "titulo", "texto", "items": [], "sinpe": "" }
- mensaje: { "titulo", "texto", "firma" }
- faq: { "titulo", "items": [ { "pregunta", "respuesta" } ] }

REGLAS:
- Exactamente UNA sección hero, y va primera. Entre 5 y 9 secciones en total.
- La paleta tiene que leerse: tinta sobre fondo con contraste alto, y tintaEscena sobre escena igual. La escena es el SEGUNDO color (un capítulo en vino sobre marfil, una noche en marino): elegí uno profundo si el fondo es claro. Ejemplos que funcionan: ${paletas}.
- Dirección de arte coherente: una boda elegante pide serif + diamante + seda + pétalos; una fiesta infantil pide letra redonda + estrella + confeti; un evento corporativo pide sans + línea + liso + sin partículas.
- Nada de HTML, emojis ni marcas registradas. Nada de datos inventados de fecha, lugar o nombres de personas: usá solo lo que la persona te diga.
- Respondé SOLO con el JSON.`;
}

function extraerJson(texto: string): unknown | null {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

/**
 * Lo que la persona ve al terminar: qué bot, cuántos créditos se usaron
 * y cuántos quedan. El costo real (tokens, ₡) queda en `uso_ia` para el
 * equipo; al cliente no se le muestra (decisión del dueño, 21 sep).
 */
export type ResumenGeneracion = {
  bot: BotIA;
  nombreBot: string;
  creditos: number;
  saldo: number;
  tiempoMs: number;
};

export type ResultadoGeneracion = { ok: true; resumen: ResumenGeneracion } | { ok: false; mensaje: string; faltan?: number };

/**
 * GENERAR CON UN BOT. `pedido.prompt` es el texto que la persona leyó (y
 * quizá retocó); `pedido.datos` son los campos del formulario, que se
 * usan para volver a armar el pedido si el texto llegó vacío y para
 * darle al modelo los datos duros (edad, lugar) sin que los invente.
 * Cobra el precio fijo del bot en créditos DESPUÉS de generar bien; si
 * el saldo no alcanza, no gasta nada y avisa cuánto falta.
 */
export async function generarConIA(
  celebracionId: string,
  pedido: { prompt?: string; datos?: unknown },
  botPedido?: string,
): Promise<ResultadoGeneracion> {
  const datos: DatosIA = normalizarDatosIA(pedido?.datos);
  const prompt = ((pedido?.prompt ?? "").trim() || armarPedidoIA(datos)).slice(0, MAX_PROMPT);
  if (prompt.length < 10) return { ok: false, mensaje: "Contanos un poco más: quién celebra, el estilo que imaginás, los colores." };

  const c = await celebracionPorId(celebracionId);
  if (!c) return { ok: false, mensaje: "No encontramos esa celebración en tu cuenta." };

  const bloqueo = await motivoParaNoGastar();
  if (bloqueo) return { ok: false, mensaje: bloqueo };

  const bot: BotIA = esBotIA(botPedido) ? botPedido : BOT_POR_DEFECTO;
  const ficha = BOTS_IA[bot];
  const modelo = ficha.modelo;

  // Primero el saldo: si no alcanza, ni se llama al modelo.
  const saldo = await saldoCreditos();
  if (saldo < ficha.creditos) {
    return { ok: false, mensaje: `${ficha.nombre} cuesta ${ficha.creditos} créditos y tenés ${saldo}.`, faltan: ficha.creditos - saldo };
  }

  const esGemini = modelo.startsWith("gemini");
  const apiKey = (esGemini ? process.env.GOOGLE_GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY)?.trim();
  if (!apiKey) return { ok: false, mensaje: `${ficha.nombre} no está disponible en este entorno. Probá con otro bot.` };

  const proveedor: AIProvider = esGemini ? new GeminiProvider(apiKey) : new ClaudeProvider(apiKey);
  const tipoNombre = tipoCelebracion(c.tipo)?.nombre ?? c.tipo;
  const inicio = Date.now();

  // Los datos duros van aparte del pedido: el modelo los usa tal cual y
  // no los inventa (regla del system prompt).
  const duros = [
    datos.quien && `Quién celebra: ${datos.quien}`,
    datos.edad && `Edad o hito: ${datos.edad}`,
    c.fecha && `Fecha: ${c.fecha}${c.hora ? ` ${c.hora.slice(0, 5)}` : ""}`,
    c.lugar_nombre && `Lugar: ${c.lugar_nombre}${c.direccion ? `, ${c.direccion}` : ""}`,
  ].filter(Boolean);

  const resultado = await proveedor.generar({
    modelo,
    maxTokens: 4000,
    system: systemPrompt(tipoNombre, c.nombre),
    turnos: [{ role: "user", content: `Lo que quiero: ${prompt}${duros.length ? `\n\nDatos exactos (usalos tal cual):\n- ${duros.join("\n- ")}` : ""}` }],
    sinRazonamiento: true,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (resultado.outcome !== "success") {
    const detalle = resultado.outcome === "provider_error" ? resultado.mensaje : resultado.outcome;
    await registrarFalloIA({
      agente: "celebrar_generar",
      modelo,
      tokensInput: 0,
      tokensOutput: 0,
      error: detalle,
      usuarioId: user?.id ?? null,
      referenciaId: c.id,
      tiempoMs: Date.now() - inicio,
    });
    return { ok: false, mensaje: "La IA no pudo generar la invitación esta vez. Probá de nuevo o elegí una plantilla." };
  }

  // El costo real queda registrado para el equipo (uso_ia); no se muestra.
  await registrarDesdeUsage(
    resultado.usage
      ? {
          input_tokens: resultado.usage.tokensEntrada,
          output_tokens: resultado.usage.tokensSalida,
          cache_creation_input_tokens: resultado.usage.tokensCacheEscritura ?? 0,
          cache_read_input_tokens: resultado.usage.tokensCacheLectura ?? 0,
        }
      : null,
    { agente: "celebrar_generar", modelo, usuarioId: user?.id ?? null, referenciaId: c.id, tiempoMs: Date.now() - inicio },
  );

  const crudo = extraerJson(resultado.texto);
  if (!crudo) return { ok: false, mensaje: "La IA respondió algo que no pudimos leer. Probá de nuevo con otra descripción." };

  const doc: Documento = rellenarConCelebracion(
    { ...normalizarDocumento(crudo), plantilla: null },
    { tipo: c.tipo, nombre: c.nombre, fecha: c.fecha, hora: c.hora, lugarNombre: c.lugar_nombre, direccion: c.direccion, mapsUrl: c.maps_url },
  );

  const { error } = await supabase.from("celebrar_invitaciones").upsert(
    { celebracion_id: c.id, tipo: "invitacion", contenido: doc, plantilla_slug: null, version: 1 },
    { onConflict: "celebracion_id,tipo" },
  );
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };

  // El cobro, ya con la invitación guardada: precio fijo del bot.
  const { data: restante, error: errCobro } = await supabase.rpc("celebrar_consumir_creditos", {
    p_celebracion: c.id,
    p_concepto: `Invitación con IA · ${ficha.nombre}`,
    p_cantidad: ficha.creditos,
    p_referencia: null,
  });
  if (errCobro) {
    // El saldo se revisó antes; si aun así falló (dos pedidos a la vez),
    // la invitación ya está guardada: se avisa y queda para el equipo.
    console.error("[celebrar] generarConIA: no se pudo cobrar", errCobro.message);
  }

  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.editor}`, "layout");
  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
  return {
    ok: true,
    resumen: { bot, nombreBot: ficha.nombre, creditos: ficha.creditos, saldo: typeof restante === "number" ? restante : saldo - ficha.creditos, tiempoMs: Date.now() - inicio },
  };
}
