"use server";

import { GeminiProvider } from "@/lib/ia/gemini-provider";
import type { TurnoIA, UsoIAProveedor } from "@/lib/ia/ai-provider";
import { registrarUsoIA } from "@/lib/ia/registrar-uso";
import { avisarAAdministradores, correosDeAdministradores } from "@/lib/correo/administradores";
import { escaparHtml } from "@/lib/email";

/**
 * EL BOT DE LA LANDING DE LEALTAD — la opción "Chatear con un agente"
 * de la burbuja de contacto (la otra es "Enviar un correo", que sigue
 * yendo por `contacto-actions.ts`, sin tocar).
 *
 * ------------------------------------------------------------------
 * POR QUÉ GEMINI Y NO CLAUDE
 * ------------------------------------------------------------------
 * Pedido puntual del dueño: usar el `GeminiProvider` que ya estaba
 * escrito y probado (`lib/ia/gemini-provider.ts`) pero sin ningún
 * llamador real todavía. El modelo (`MODELO`, más abajo) es
 * deliberadamente el más barato/rápido del catálogo de Gemini: esto
 * es una landing pública, anónima, de bajo valor por conversación —lo
 * mismo que ya elige Haiku para el resto del sitio, ver modelos.ts—,
 * no el lugar para un modelo caro.
 *
 * ------------------------------------------------------------------
 * EL GASTO SÍ SE AUDITA (ago 2026) — pedido del dueño
 * ------------------------------------------------------------------
 * Cada llamada escribe su fila en `uso_ia` con el agente
 * `lealtad_chat`, así que el gasto de este chat aparece en /admin/ia
 * junto al del resto de la plataforma.
 *
 * El comentario que estaba acá antes decía que meterlo al panel exigía
 * "una migración que amplíe el CHECK de la columna `agente`". ESO ERA
 * FALSO: `uso_ia.agente` es `text not null` SIN check constraint, y la
 * 0078 explica por qué a propósito (un agente mal escrito tiene que
 * entrar igual y verse raro en el panel; con check, el insert fallaría
 * y el gasto quedaría INVISIBLE, justo lo que la tabla viene a
 * arreglar). No hizo falta ninguna migración.
 *
 * Lo que sí hizo falta fue separar `AgenteConfigurable` de `AgenteIA`
 * en modelos.ts: este agente gasta y se muestra, pero su modelo NO se
 * elige desde el panel — ver el comentario de esos tipos.
 *
 * ------------------------------------------------------------------
 * EL TOPE ES DE VERDAD ACÁ, NO SOLO EN EL CLIENTE
 * ------------------------------------------------------------------
 * El componente ya corta la conversación a los 10 mensajes del
 * visitante, pero un `fetch` armado a mano contra esta action se
 * salta cualquier límite de React. `TOPE_TURNOS` es la misma cuenta,
 * hecha cumplir del lado del servidor.
 */

// "gemini-2.5-flash-lite" quedó retirado para cuentas nuevas (la API
// devuelve 404 y sugiere este reemplazo directo) — mismo lugar en el
// catálogo (el más barato/rápido de Gemini), solo la generación siguiente.
const MODELO = "gemini-3.5-flash-lite";
const MAX_TOKENS_RESPUESTA = 400;
const TOPE_TURNOS = 24; // 12 idas y vueltas — con margen sobre el tope de 10 que ya frena la UI
const TOPE_CARACTERES_TURNO = 600;

const SYSTEM_PROMPT = `Sos el agente de soporte de Bookea Lealtad (bookea.lat/lealtad), escribiendo en español de Costa Rica, con un tono cercano, claro y profesional — nunca informal de más ni con emojis en cada línea.

QUÉ ES BOOKEA LEALTAD: un programa de fidelización digital. El negocio arma una tarjeta (sellos, puntos, cashback, cupón, descuento, membresía, gift card o evento) y sus clientes la llevan en Apple Wallet o Google Wallet, sin instalar ninguna app. Cada compra/visita suma sola vía un QR, y al llegar a la meta el cliente se lleva la regalía que el negocio definió.

LOS PAQUETES (los únicos precios que existen — nunca inventes otros ni negocies un precio distinto):
- Prueba: gratis, para siempre, sin tarjeta de crédito. Hasta 5 clientes, 1 tarjeta, 1 notificación al mes. Tipos: sellos, puntos, cashback.
- Starter: $12/mes ($115/año pagando anual). Hasta 100 clientes, 2 tarjetas, 25 notificaciones al mes. Suma cupón y descuento.
- Impulso: $42/mes ($400/año). El paquete completo. Clientes y tarjetas SIN TOPE, notificaciones ilimitadas, avisos por cercanía (Geo-Push) en 10 ubicaciones, proyección de crecimiento, los 8 tipos de tarjeta (suma membresía, gift card y evento) y el diseño de la tarjeta lo hace el equipo de Bookea.

CATÁLOGO DE DEMOS: en bookea.lat/demos hay ejemplos armados por rubro (cafeterías, barberías, spas, gimnasios, lavacars, courier, tiendas, panaderías, nail spas, fotografía, restaurantes, salones) — cada uno muestra 2 modos de tarjeta distintos. Si alguien pregunta "cómo se vería en mi negocio", mandalo ahí.

REGLAS ESTRICTAS:
1. Nunca inventes un precio, una fecha de vencimiento de promoción, una política de reembolso o un dato de facturación que no esté acá arriba. Si te preguntan algo así, decí que no tenés esa información a mano y ofrecé pasar a "Enviar un correo" para que el equipo lo confirme.
2. No prometas nada de pagos, cobros ni cambios de plan — eso lo resuelve el equipo o el propio panel del negocio, no vos.
3. Respuestas CORTAS: 2-4 oraciones. Esto es un chat de landing, no un ensayo.
4. Si no sabés algo, o la persona pide hablar con un humano, decilo con naturalidad y sugerí cerrar este chat y usar "Enviar un correo" — no inventes una respuesta para no quedar mal.
5. No tenés acceso a ninguna cuenta, negocio ni dato real de nadie — sos parte de la landing pública, hablás con alguien que probablemente ni siquiera tiene cuenta todavía.`;

export type MensajeChat = { role: "user" | "assistant"; content: string };

type ResultadoChat = { ok: true; texto: string } | { ok: false; motivo: string };

export async function responderAgenteLealtad(historial: MensajeChat[]): Promise<ResultadoChat> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, motivo: "El chat no está disponible ahora mismo — probá «Enviar un correo»." };
  }
  if (historial.length === 0 || historial.length > TOPE_TURNOS) {
    return { ok: false, motivo: "Esta conversación ya llegó a su límite. Probá «Enviar un correo»." };
  }

  // Nunca confiar el texto crudo del cliente: se recorta cada turno,
  // mismo criterio que `contacto-actions.ts` con `TOPE_MENSAJE`.
  const turnos: TurnoIA[] = historial.map((m) => ({
    role: m.role,
    content: m.content.trim().slice(0, TOPE_CARACTERES_TURNO),
  }));

  const provider = new GeminiProvider(apiKey);
  const arranque = Date.now();
  let resultado;
  try {
    resultado = await provider.generar({
      modelo: MODELO,
      maxTokens: MAX_TOKENS_RESPUESTA,
      system: SYSTEM_PROMPT,
      turnos,
      // Ver el comentario de MODELO: sin esto son ~172 segundos de espera.
      sinRazonamiento: true,
    });
  } catch (e) {
    console.error("[agente-actions] falló la llamada a Gemini:", e);
    // Una excepción acá es red caída o DNS: la API nunca contestó, así
    // que no hay tokens que cobrar y no se registra nada.
    return { ok: false, motivo: "No pude conectarme ahora. Probá de nuevo o escribinos por correo." };
  }

  /**
   * SE REGISTRA ANTES DE CONTESTAR, Y EN TODOS LOS CAMINOS MENOS UNO.
   *
   * Los tokens ya se gastaron y Google ya los va a cobrar, así que una
   * respuesta rechazada o cortada cuesta lo mismo que una buena. Si
   * solo se registrara el `success`, el panel mostraría de menos
   * justamente cuando algo anda mal — que es cuando más importa mirarlo.
   *
   * El único que no registra es `provider_error`, y no por criterio
   * sino porque `ResultadoIA` no trae `usage` en ese caso (ver
   * ai-provider.ts): no hay número que anotar.
   *
   * `void` a propósito: el visitante no espera a que se escriba la
   * fila. `registrarUsoIA` ya se traga sus propios errores y nunca
   * lanza, así que esto no puede tumbar una respuesta que ya está lista.
   */
  if (resultado.outcome !== "provider_error") {
    void registrarDelChat(resultado.usage, resultado.outcome, Date.now() - arranque);
  }

  switch (resultado.outcome) {
    case "success":
      return { ok: true, texto: resultado.texto };
    case "refused":
      return { ok: false, motivo: "No puedo ayudarte con eso por acá. Probá «Enviar un correo»." };
    case "max_output":
      return { ok: false, motivo: "Se me cortó la respuesta. Probá preguntar algo más puntual." };
    case "empty_response":
      return { ok: false, motivo: "No logré armar una respuesta. Probá reformular la pregunta." };
    case "provider_error":
      console.error("[agente-actions] provider_error:", resultado.mensaje);
      return { ok: false, motivo: "No pude conectarme ahora. Probá de nuevo o escribinos por correo." };
  }
}

/**
 * La fila de `uso_ia` de una llamada de este chat.
 *
 * Sin `usuarioId` ni `ranchoId` a propósito: quien usa este chat es una
 * visita anónima de la landing, sin cuenta y sin negocio. Poner
 * cualquier cosa ahí sería inventar una atribución.
 */
async function registrarDelChat(
  usage: UsoIAProveedor | null,
  outcome: string,
  tiempoMs: number,
): Promise<void> {
  await registrarUsoIA({
    agente: "lealtad_chat",
    modelo: MODELO,
    tokensInput: usage?.tokensEntrada ?? 0,
    tokensOutput: usage?.tokensSalida ?? 0,
    tokensCacheRead: usage?.tokensCacheLectura ?? 0,
    tiempoMs,
    exito: outcome === "success",
    error: outcome === "success" ? null : outcome,
  });
}

/**
 * EL RESUMEN DEL CHAT, por correo — mismo mecanismo que ya usa
 * `contacto-actions.ts` (`avisarAAdministradores`), no una tabla
 * nueva: la conversación con el bot es tan "sin tenencia" como el
 * formulario de correo, por la misma razón (ver la cabecera de ese
 * archivo). Se manda al cerrar el chat o al llegar al tope de
 * mensajes, para que el equipo pueda revisar qué está contestando el
 * bot y hacer seguimiento si hace falta.
 */
export async function enviarTranscripcionAgente(historial: MensajeChat[]): Promise<void> {
  if (historial.length === 0) return;

  const destinatarios = await correosDeAdministradores();
  if (destinatarios.length === 0) return;

  const cuerpo = historial
    .map((m) => {
      const quien = m.role === "user" ? "Visitante" : "Bot";
      return `<p style="margin:0 0 10px;font-size:14px"><b>${quien}:</b> ${escaparHtml(m.content)}</p>`;
    })
    .join("");

  await avisarAAdministradores({
    subject: `LEALTAD — chat con el agente (${historial.length} mensajes)`,
    html: `
      <h2 style="margin:0 0 12px">Conversación con el agente de la landing</h2>
      ${cuerpo}
      <p style="margin:16px 0 0;font-size:12.5px;color:#777">
        Automático, desde bookea.lat/lealtad — el visitante no dejó contacto
        (sigue siendo anónimo). Es solo para que el equipo revise qué está
        contestando el bot.
      </p>
    `,
  });
}
