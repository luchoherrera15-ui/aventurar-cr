import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarCategoria } from "@/app/mi-rancho/types";

/**
 * El asistente de IA del chat: cuando un cliente le escribe a un
 * negocio con el asistente activo, Claude responde al instante en
 * nombre del negocio usando SOLO sus datos reales (servicios, precios,
 * horarios, condiciones). El dueño puede meterse al hilo cuando
 * quiera — el asistente solo contesta mensajes del cliente.
 *
 * Barato a propósito: modelo Haiku (el más económico), máximo ~350
 * tokens de salida, y el contexto del negocio se arma compacto.
 *
 * Quién lo tiene activo: TODOS los negocios de la categoría "lugares"
 * (los ranchos/salones de eventos), más cualquier slug extra listado
 * en ASISTENTE_IA_SLUGS (para pilotear otras categorías negocio por
 * negocio). Sin ANTHROPIC_API_KEY no hace nada.
 */

const MODELO = "claude-haiku-4-5-20251001";
const MAX_MENSAJES_CONTEXTO = 12;

type FilaMensaje = { autor_id: string; texto: string; created_at: string };

function slugsActivos(): string[] {
  return (process.env.ASISTENTE_IA_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Arma la ficha del negocio que el modelo puede citar — nada más. */
function fichaDelNegocio(
  rancho: Record<string, unknown>,
  items: { nombre: string; precio: number | null; duracion_minutos: number | null }[],
): string {
  const partes: string[] = [];
  partes.push(`Nombre: ${rancho.nombre}`);
  if (rancho.descripcion) partes.push(`Descripción: ${rancho.descripcion}`);
  const ubicacion = [rancho.direccion_exacta, rancho.canton, rancho.provincia]
    .filter(Boolean)
    .join(", ");
  if (ubicacion) partes.push(`Ubicación: ${ubicacion}`);
  if (rancho.capacidad_min || rancho.capacidad_max) {
    partes.push(`Capacidad: ${rancho.capacidad_min ?? "?"} a ${rancho.capacidad_max ?? "?"} personas`);
  }
  if (typeof rancho.precio_desde === "number") {
    partes.push(`Precio desde: ₡${Number(rancho.precio_desde).toLocaleString("es-CR")}`);
  }
  if (typeof rancho.deposito_reserva === "number") {
    partes.push(
      `Depósito para reservar: ₡${Number(rancho.deposito_reserva).toLocaleString("es-CR")}`,
    );
  }
  const terminos = rancho.terminos;
  if (Array.isArray(terminos) && terminos.length > 0) {
    partes.push(`Condiciones: ${terminos.join(" · ")}`);
  }
  if (items.length > 0) {
    partes.push(
      "Catálogo: " +
        items
          .map((i) => {
            const precio =
              i.precio !== null ? `₡${Number(i.precio).toLocaleString("es-CR")}` : "a consultar";
            const dur = i.duracion_minutos ? ` (${i.duracion_minutos} min)` : "";
            return `${i.nombre}${dur}: ${precio}`;
          })
          .join(" · "),
    );
  }
  return partes.join("\n");
}

/** Historial → mensajes del API, fusionando turnos seguidos del mismo lado. */
function armarTurnos(historial: FilaMensaje[], clienteId: string) {
  const turnos: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of historial) {
    const role = m.autor_id === clienteId ? "user" : "assistant";
    const anterior = turnos[turnos.length - 1];
    if (anterior && anterior.role === role) {
      anterior.content += "\n" + m.texto;
    } else {
      turnos.push({ role, content: m.texto });
    }
  }
  // El API exige empezar con un turno del usuario.
  while (turnos.length > 0 && turnos[0].role !== "user") turnos.shift();
  return turnos;
}

/**
 * Responde (si corresponde) al mensaje recién enviado. Nunca lanza:
 * cualquier problema se registra y el chat sigue como si el asistente
 * no existiera.
 */
export async function responderConAsistente(mensajeId: string): Promise<void> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return;

    const db = createAdminClient();
    if (!db) return;

    const { data: mensaje } = await db
      .from("mensajes")
      .select("id, conversacion_id, autor_id")
      .eq("id", mensajeId)
      .maybeSingle();
    if (!mensaje) return;

    const { data: conversacion } = await db
      .from("conversaciones")
      .select("id, cliente_id, rancho_id, ranchos(nombre, slug, owner_id, categoria)")
      .eq("id", mensaje.conversacion_id)
      .maybeSingle();
    const rancho = (
      conversacion as {
        ranchos?: {
          nombre: string;
          slug: string | null;
          owner_id: string;
          categoria: string | null;
        } | null;
      } | null
    )?.ranchos;
    if (!conversacion || !rancho) return;

    // Activo para TODA la categoría "lugares" y para los slugs extra
    // del piloto; y solo con mensajes DEL CLIENTE — lo que escriba el
    // dueño (o el propio asistente) no dispara nada.
    const esLugar = normalizarCategoria(rancho.categoria) === "lugares";
    const enPiloto = !!rancho.slug && slugsActivos().includes(rancho.slug);
    if (!esLugar && !enPiloto) return;
    if (mensaje.autor_id !== conversacion.cliente_id) return;

    const [{ data: ranchoFull }, { data: itemsData }, { data: historialData }] =
      await Promise.all([
        db.from("ranchos").select("*").eq("id", conversacion.rancho_id).maybeSingle(),
        db
          .from("rancho_items")
          .select("nombre, precio, duracion_minutos")
          .eq("rancho_id", conversacion.rancho_id)
          .eq("activo", true)
          .order("orden", { ascending: true })
          .limit(20),
        db
          .from("mensajes")
          .select("autor_id, texto, created_at")
          .eq("conversacion_id", conversacion.id)
          .order("created_at", { ascending: false })
          .limit(MAX_MENSAJES_CONTEXTO),
      ]);
    if (!ranchoFull) return;

    const historial = ((historialData ?? []) as FilaMensaje[]).reverse();
    // Si ya hubo respuesta después del último mensaje del cliente, nada.
    if (historial.length === 0 || historial[historial.length - 1].autor_id !== conversacion.cliente_id) {
      return;
    }

    const system = [
      `Sos el asistente virtual de "${rancho.nombre}", un negocio en Bookea (bookea.lat), un marketplace de reservas de Costa Rica.`,
      "Respondés a clientes interesados, en español de Costa Rica (voseo), con calidez y en 1 a 4 oraciones — esto es un chat, no un correo.",
      "REGLAS ESTRICTAS:",
      "- Usá ÚNICAMENTE los datos de la ficha del negocio de abajo. Jamás inventés precios, horarios, disponibilidad ni servicios.",
      "- Si te preguntan por disponibilidad de fechas u horas exactas, explicá que pueden verla y reservar al instante con el botón Reservar de la página, y que el equipo confirma cualquier duda puntual.",
      "- Si no sabés algo, decilo con naturalidad y avisá que el equipo del negocio responde por este mismo chat.",
      "- Nunca prometás descuentos, excepciones ni condiciones que no estén en la ficha.",
      "- No pidás datos personales ni de pago: la reserva y el pago pasan por la plataforma.",
      "- Presentate como asistente virtual solo si te lo preguntan.",
      "",
      "FICHA DEL NEGOCIO:",
      fichaDelNegocio(ranchoFull as Record<string, unknown>, itemsData ?? []),
    ].join("\n");

    const turnos = armarTurnos(historial, conversacion.cliente_id);
    if (turnos.length === 0) return;

    const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 350,
        system,
        messages: turnos,
      }),
    });
    if (!respuesta.ok) {
      console.error(`[asistente-ia] API ${respuesta.status}: ${await respuesta.text()}`);
      return;
    }

    const cuerpo = (await respuesta.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };
    const texto = (cuerpo.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    if (!texto) return;

    // Se registra el consumo para poder medir el costo real del piloto.
    if (cuerpo.usage) {
      console.log(
        `[asistente-ia] ${rancho.slug ?? rancho.nombre}: ${cuerpo.usage.input_tokens} tokens de entrada, ${cuerpo.usage.output_tokens} de salida.`,
      );
    }

    // La respuesta entra al hilo como el negocio (el dueño), con el
    // prefijo del asistente para que quede claro quién habló.
    await db.from("mensajes").insert({
      conversacion_id: conversacion.id,
      autor_id: rancho.owner_id,
      texto: `🤖 ${texto}`,
    });
  } catch (e) {
    console.error("[asistente-ia] Falló la respuesta automática:", e);
  }
}
