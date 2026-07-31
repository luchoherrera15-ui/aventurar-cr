import { createAdminClient } from "@/lib/supabase/admin";
import { leerConfigIA } from "./config-ia";
import {
  calcularCosto,
  TIPO_CAMBIO_POR_DEFECTO,
  type AgenteIA,
  type ModeloIA,
} from "./modelos";

/**
 * Deja constancia de cada llamada a un modelo en la tabla uso_ia.
 *
 * Es la pieza que faltaba: hasta ahora el costo del chat se calculaba
 * y se devolvía al navegador, y el del asistente terminaba en un
 * console.log. Sin esto, el panel de gasto no tiene qué mostrar.
 *
 * Nunca lanza ni bloquea: si el registro falla, el cliente igual
 * recibe su invitación. Un gasto sin registrar es un problema de
 * contabilidad; una generación caída es un problema del cliente.
 */

export interface DatosUso {
  agente: AgenteIA;
  modelo: ModeloIA;
  tokensInput: number;
  tokensOutput: number;
  tokensCacheWrite?: number;
  tokensCacheRead?: number;
  tiempoMs?: number | null;
  exito?: boolean;
  error?: string | null;
  usuarioId?: string | null;
  ranchoId?: string | null;
  /** La invitación, conversación o importación que originó la llamada. */
  referenciaId?: string | null;
}

export interface CostoRegistrado {
  costoUSD: number;
  costoCRC: number;
  tipoCambio: number;
}

/**
 * El `usage` que devuelve la API de Anthropic, tanto por el SDK como
 * por fetch crudo. Todos los campos son opcionales porque una
 * respuesta cortada puede no traerlos.
 */
export interface UsageAnthropic {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

const entero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export async function registrarUsoIA(datos: DatosUso): Promise<CostoRegistrado> {
  const tokensInput = entero(datos.tokensInput);
  const tokensOutput = entero(datos.tokensOutput);

  let tipoCambio: number;
  try {
    tipoCambio = (await leerConfigIA()).tipoCambio;
  } catch {
    tipoCambio = TIPO_CAMBIO_POR_DEFECTO;
  }

  const costoUSD = calcularCosto(datos.modelo, tokensInput, tokensOutput);
  const resultado: CostoRegistrado = {
    costoUSD,
    costoCRC: Math.round(costoUSD * tipoCambio * 100) / 100,
    tipoCambio,
  };

  try {
    const db = createAdminClient();
    if (!db) return resultado;

    const { error } = await db.from("uso_ia").insert({
      agente: datos.agente,
      modelo: datos.modelo,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      tokens_cache_write: entero(datos.tokensCacheWrite),
      tokens_cache_read: entero(datos.tokensCacheRead),
      costo_usd: costoUSD,
      tipo_cambio: tipoCambio,
      tiempo_ms: datos.tiempoMs ?? null,
      exito: datos.exito !== false,
      error: datos.error ?? null,
      usuario_id: datos.usuarioId ?? null,
      rancho_id: datos.ranchoId ?? null,
      referencia_id: datos.referenciaId ?? null,
    });
    if (error) {
      console.error("[uso-ia] No se pudo registrar el consumo:", error.message);
    }
  } catch (e) {
    console.error("[uso-ia] No se pudo registrar el consumo:", e);
  }

  return resultado;
}

/**
 * Atajo para el caso normal: tomar el `usage` de la respuesta y
 * registrarlo. Devuelve el costo para que la ruta pueda mostrárselo
 * al cliente en el mismo JSON.
 */
export async function registrarDesdeUsage(
  usage: UsageAnthropic | null | undefined,
  datos: Omit<DatosUso, "tokensInput" | "tokensOutput" | "tokensCacheWrite" | "tokensCacheRead">,
): Promise<CostoRegistrado> {
  return registrarUsoIA({
    ...datos,
    tokensInput: usage?.input_tokens ?? 0,
    tokensOutput: usage?.output_tokens ?? 0,
    tokensCacheWrite: usage?.cache_creation_input_tokens ?? 0,
    tokensCacheRead: usage?.cache_read_input_tokens ?? 0,
  });
}

/**
 * Registra una llamada que falló DESPUÉS de gastar tokens (una
 * respuesta cortada por max_tokens, por ejemplo). Esos tokens se
 * facturan igual, así que tienen que aparecer en el panel.
 */
export async function registrarFalloIA(
  datos: Omit<DatosUso, "exito">,
): Promise<CostoRegistrado> {
  return registrarUsoIA({ ...datos, exito: false });
}
