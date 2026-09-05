import "server-only";

import { ClaudeProvider } from "@/lib/ia/claude-provider";
import { IDIOMA, traduccionesDe, type IdiomaExtra, type Traducciones } from "./idiomas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  TRADUCIR EL MENÚ CON IA — de una vez, a todos los idiomas prendidos
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (5 sep 2026): «que el menú se pueda ver en cinco
 * idiomas al mismo tiempo». Treinta platos por cinco idiomas a mano es
 * lo que hace que nadie termine de traducir su menú; con esto es un
 * botón, y después se corrige lo que haga falta plato por plato.
 *
 * Va por `ClaudeProvider`, el mismo proveedor que el resto del sitio
 * (ver src/lib/ia): una sola llamada con TODO el menú, en JSON, y se
 * pide JSON de vuelta. Lo que no se pueda leer se descarta; nunca se
 * escribe media traducción rota. El resultado pasa por
 * `traduccionesDe`, el mismo parser que la base, así que lo que entra
 * por acá respeta los mismos topes que lo que se teclea a mano.
 *
 * Sin ANTHROPIC_API_KEY no falla feo: devuelve un motivo en español y
 * el negocio sigue pudiendo traducir a mano.
 */

export type PiezaATraducir = { id: string; nombre: string; descripcion?: string };

const MODELO = "claude-haiku-4-5";

function extraerJson(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) throw new Error("sin JSON");
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

export async function traducirPiezas(
  piezas: PiezaATraducir[],
  idiomas: IdiomaExtra[],
): Promise<{ ok: true; por: Record<string, Traducciones> } | { ok: false; motivo: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, motivo: "La traducción con IA no está configurada en este entorno. Podés traducir a mano." };
  if (piezas.length === 0 || idiomas.length === 0) return { ok: true, por: {} };

  const nombres = idiomas.map((i) => `${i} (${IDIOMA[i].propio})`).join(", ");
  const system = [
    "Sos un traductor gastronómico profesional para restaurantes de Costa Rica.",
    "Traducís del español nombres y descripciones de platos de un menú. Tono corto y apetitoso, fiel al original: no inventás ingredientes ni agregás adjetivos.",
    "Los nombres propios y platos típicos (Casado, Gallo pinto, Tiramisú, Chifrijo) se conservan tal cual, y si hace falta se aclara entre paréntesis en la descripción.",
    "Respondé ÚNICAMENTE con JSON válido, sin texto antes ni después, con esta forma exacta:",
    '{"<id>": {"<idioma>": {"nombre": "...", "descripcion": "..."}, ...}, ...}',
    "Si una pieza no tiene descripción, omití la clave descripcion en esa pieza.",
  ].join("\n");

  const entrada = JSON.stringify({
    idiomas,
    piezas: piezas.map((p) => ({ id: p.id, nombre: p.nombre, ...(p.descripcion ? { descripcion: p.descripcion } : {}) })),
  });

  const provider = new ClaudeProvider(apiKey);
  const r = await provider.generar({
    modelo: MODELO,
    // ~120 tokens por pieza e idioma, con piso y techo.
    maxTokens: Math.min(16000, Math.max(1500, piezas.length * idiomas.length * 120)),
    system,
    turnos: [{ role: "user", content: `Traducí a: ${nombres}.\n${entrada}` }],
    sinRazonamiento: true,
  });

  if (r.outcome === "provider_error") return { ok: false, motivo: "La IA no respondió: " + r.mensaje };
  if (r.outcome === "max_output") return { ok: false, motivo: "El menú es muy largo para traducirlo de una vez. Probá con menos idiomas prendidos." };
  if (r.outcome !== "success") return { ok: false, motivo: "La IA no devolvió una traducción. Probá de nuevo." };

  let crudo: unknown;
  try {
    crudo = extraerJson(r.texto);
  } catch {
    return { ok: false, motivo: "La IA devolvió algo que no se pudo leer. Probá de nuevo." };
  }
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) {
    return { ok: false, motivo: "La IA devolvió algo que no se pudo leer. Probá de nuevo." };
  }

  const ids = new Set(piezas.map((p) => p.id));
  const por: Record<string, Traducciones> = {};
  for (const [id, val] of Object.entries(crudo as Record<string, unknown>)) {
    if (!ids.has(id)) continue;
    const t = traduccionesDe(val);
    // Solo los idiomas pedidos: si la IA agregó otros, no se guardan.
    const filtradas: Traducciones = {};
    for (const i of idiomas) if (t[i]) filtradas[i] = t[i];
    if (Object.keys(filtradas).length > 0) por[id] = filtradas;
  }
  return { ok: true, por };
}
