import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import {
  normalizarModelo,
  TIPO_CAMBIO_POR_DEFECTO,
  tipoCambioDeEntorno,
  type AgenteIA,
  type ModeloIA,
} from "./modelos";

/**
 * La configuración de IA que el admin edita en /admin/ia: qué modelo
 * usa cada agente, el tope de gasto y el tipo de cambio.
 *
 * Vive en la fila única de configuracion_plataforma. Si la base no
 * responde o la migración 0078 todavía no corrió, se usan estos
 * valores por defecto y el producto sigue funcionando igual — nunca
 * se cae una generación por no poder leer la configuración.
 */

export interface ConfigIA {
  activa: boolean;
  modelos: Record<AgenteIA, ModeloIA>;
  topeMensualUSD: number;
  tipoCambio: number;
}

const POR_DEFECTO: ConfigIA = {
  activa: true,
  modelos: {
    invitacion_chat: "claude-haiku-4-5",
    invitacion_brief: "claude-opus-5",
    invitacion_generar: "claude-opus-5",
    invitacion_imprimir: "claude-opus-5",
    invitacion_refinar: "claude-haiku-4-5",
    agenda_leer: "claude-opus-5",
    asistente_negocio: "claude-haiku-4-5",
  },
  topeMensualUSD: 0,
  tipoCambio: TIPO_CAMBIO_POR_DEFECTO,
};

const COLUMNAS = [
  "ia_activa",
  "ia_modelo_chat",
  "ia_modelo_brief",
  "ia_modelo_generar",
  "ia_modelo_imprimir",
  "ia_modelo_refinar",
  "ia_modelo_agenda",
  "ia_modelo_asistente",
  "ia_tope_mensual_usd",
  "ia_tipo_cambio",
].join(", ");

// Un mensaje de chat no debería pagar un viaje a la base solo para
// saber qué modelo usar. Se cachea un minuto: alcanza para una
// conversación entera y un cambio en el panel se nota enseguida.
const TTL_MS = 60_000;
let cache: { valor: ConfigIA; expira: number } | null = null;

/** Tira el caché: lo llama el panel después de guardar. */
export function olvidarConfigIA(): void {
  cache = null;
}

export async function leerConfigIA(): Promise<ConfigIA> {
  if (cache && cache.expira > Date.now()) return cache.valor;

  const porDefecto: ConfigIA = {
    ...POR_DEFECTO,
    modelos: { ...POR_DEFECTO.modelos },
    tipoCambio: tipoCambioDeEntorno(),
  };

  const db = createAdminClient();
  if (!db) return porDefecto;

  const { data, error } = await db
    .from("configuracion_plataforma")
    .select(COLUMNAS)
    .eq("id", true)
    .maybeSingle();

  // Sin migración 0078 las columnas no existen y PostgREST devuelve
  // error en vez de lanzar. Se sigue con los valores por defecto.
  if (error || !data) {
    // A propósito NO se cachea el respaldo: si la lectura falló por algo
    // pasajero, cachearlo un minuto dejaría al interruptor general y a
    // los modelos elegidos sin efecto durante ese rato.
    if (error) console.error("[config-ia] No se pudo leer la configuración:", error.message);
    return porDefecto;
  }

  const fila = data as unknown as Record<string, unknown>;
  const numero = (v: unknown, alterno: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : alterno;
  };

  const valor: ConfigIA = {
    activa: fila.ia_activa !== false,
    modelos: {
      invitacion_chat: normalizarModelo(fila.ia_modelo_chat, porDefecto.modelos.invitacion_chat),
      invitacion_brief: normalizarModelo(fila.ia_modelo_brief, porDefecto.modelos.invitacion_brief),
      invitacion_generar: normalizarModelo(
        fila.ia_modelo_generar,
        porDefecto.modelos.invitacion_generar,
      ),
      invitacion_imprimir: normalizarModelo(
        fila.ia_modelo_imprimir,
        porDefecto.modelos.invitacion_imprimir,
      ),
      invitacion_refinar: normalizarModelo(
        fila.ia_modelo_refinar,
        porDefecto.modelos.invitacion_refinar,
      ),
      agenda_leer: normalizarModelo(fila.ia_modelo_agenda, porDefecto.modelos.agenda_leer),
      asistente_negocio: normalizarModelo(
        fila.ia_modelo_asistente,
        porDefecto.modelos.asistente_negocio,
      ),
    },
    topeMensualUSD: numero(fila.ia_tope_mensual_usd, 0),
    tipoCambio: numero(fila.ia_tipo_cambio, porDefecto.tipoCambio) || porDefecto.tipoCambio,
  };

  cache = { valor, expira: Date.now() + TTL_MS };
  return valor;
}

/** El modelo configurado para un agente, sin tener que leer todo. */
export async function modeloDe(agente: AgenteIA): Promise<ModeloIA> {
  const config = await leerConfigIA();
  return config.modelos[agente];
}

/**
 * El instante en que arrancó el mes corriente, contado en Costa Rica.
 * El país no tiene horario de verano, así que la medianoche del día 1
 * son siempre las 06:00 UTC. Sin esto, el servidor (que corre en UTC)
 * cambiaba de mes seis horas antes que el país y el tope se reiniciaba
 * de madrugada del último día.
 */
export function inicioDelMesCR(): string {
  return `${hoyISOCR().slice(0, 7)}-01T06:00:00.000Z`;
}

/** El instante en que arranca el mes siguiente, también contado en CR. */
export function finDelMesCR(): string {
  const [anio, mes] = hoyISOCR().split("-").map(Number);
  const siguiente =
    mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, "0")}`;
  return `${siguiente}-01T06:00:00.000Z`;
}

/**
 * Lo gastado en el mes corriente, en las dos monedas.
 *
 * Los colones NO se recalculan: salen de costo_crc, que cada fila
 * congeló con el tipo de cambio del momento. Si se recalcularan con el
 * cambio de hoy, corregir el tipo de cambio movería el total de un mes
 * ya cerrado sin que se hubiera gastado un colón más.
 */
export async function gastoDelMesIA(): Promise<{ usd: number; crc: number }> {
  const db = createAdminClient();
  if (!db) return { usd: 0, crc: 0 };

  const { data, error } = await db.rpc("gasto_ia_resumen", {
    p_desde: inicioDelMesCR(),
    p_hasta: finDelMesCR(),
  });
  if (error || !data) {
    if (error) console.error("[config-ia] No se pudo resumir el gasto del mes:", error.message);
    return { usd: 0, crc: 0 };
  }

  const filas = data as { costo_usd: number | string; costo_crc: number | string }[];
  return filas.reduce(
    (total, fila) => ({
      usd: total.usd + Number(fila.costo_usd ?? 0),
      crc: total.crc + Number(fila.costo_crc ?? 0),
    }),
    { usd: 0, crc: 0 },
  );
}

/**
 * Lo gastado en dólares en el mes corriente. Lo usa el freno del tope
 * y el encabezado del panel.
 *
 * La suma la hace Postgres: traerse las filas del mes para sumarlas
 * acá se congelaba apenas PostgREST recortaba la respuesta, y el tope
 * dejaba de frenar justo cuando había volumen. Si la función todavía
 * no existe (migración 0078 sin aplicar) se devuelve 0 y no se frena
 * nada: quedarse sin IA por no poder leer el medidor sería peor que
 * pasarse del tope, pero queda el error en el log.
 */
export async function gastoDelMesUSD(): Promise<number> {
  const db = createAdminClient();
  if (!db) return 0;

  const { data, error } = await db.rpc("gasto_ia_usd", { p_desde: inicioDelMesCR() });
  if (error) {
    console.error("[config-ia] No se pudo sumar el gasto del mes:", error.message);
    return 0;
  }
  const total = Number(data ?? 0);
  return Number.isFinite(total) ? total : 0;
}

/**
 * La puerta que se abre antes de gastar tokens. Devuelve por qué no se
 * puede, en palabras que el cliente puede leer, o null si todo bien.
 *
 * Se consulta el tope solo si hay uno configurado: sin tope no tiene
 * sentido sumar el mes entero en cada mensaje del chat.
 */
export async function motivoParaNoGastar(): Promise<string | null> {
  const config = await leerConfigIA();
  if (!config.activa) {
    return "El asistente de IA está desactivado por el momento.";
  }
  if (config.topeMensualUSD > 0) {
    const gastado = await gastoDelMesUSD();
    if (gastado >= config.topeMensualUSD) {
      return "Alcanzamos el límite de uso de IA de este mes. Escribinos y lo habilitamos.";
    }
  }
  return null;
}
