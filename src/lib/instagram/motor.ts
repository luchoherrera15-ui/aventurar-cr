import { primeraCoincidencia } from "./coincidencia";
import { armarMensajePrivado } from "./mensaje";
import { estadoDelToken } from "./tokens";
import type { CodigoErrorMeta, Disparador, ErrorMeta, EstadoCuentaIg, ModoCoincidencia, ResultadoEvento } from "./tipos";
import type { ComentarioWebhook } from "./webhook";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MOTOR — de un comentario a una respuesta, con idempotencia
 * ════════════════════════════════════════════════════════════════════
 *
 *   comentario → cuenta → automatizaciones del medio → palabra clave
 *   → registrar (UNA vez por comentario y automatización) → ¿token
 *   vigente? → ¿bajo el límite? → DM privado → respuesta pública
 *   (opcional) → resultado en la bitácora.
 *
 * ── PURO, CON DEPENDENCIAS INYECTADAS ───────────────────────────────
 * No toca la base ni la red: recibe `DepsMotor` con las ocho cosas que
 * necesita hacer y las llama. `repo.ts` da la versión real (Supabase +
 * Graph); motor.test.ts le da fingidas y comprueba cada camino, incluidos
 * los que en producción cuestan un DM de verdad.
 *
 * ── LA IDEMPOTENCIA, EN DOS CAPAS ───────────────────────────────────
 * 1. La base: un índice único (automatización, comentario). `registrar`
 *    hace el INSERT y devuelve «duplicado» si la fila ya existía —
 *    cuando Meta reenvía el mismo aviso (lo hace, hasta 36 horas), el
 *    segundo paso por acá NO manda nada.
 * 2. Meta: «una sola respuesta privada por comentario». Si un reintento
 *    llegara a colarse, Meta lo rechaza y queda como `dm_rechazado`.
 *
 * ── REINTENTOS ──────────────────────────────────────────────────────
 * Un fallo TRANSITORIO (rate limit, caída) deja la fila en `error` y el
 * webhook responde no-200 para que Meta reenvíe; a la vuelta,
 * `registrar` devuelve «reintento» (misma fila, intentos + 1) y se
 * vuelve a intentar, hasta MAX_INTENTOS. Un fallo permanente (token,
 * permisos, DM rechazado) queda en `error` y no se reintenta.
 *
 * ── UNA SOLA AUTOMATIZACIÓN RESPONDE ────────────────────────────────
 * Si dos automatizaciones del mismo medio coinciden, responde la
 * primera (por orden de creación) y la otra queda `omitido`: Meta no
 * permite dos DM al mismo comentario, y dos respuestas públicas se
 * verían como spam.
 */

export type CuentaMotor = {
  id: string;
  negocioId: string;
  igUserId: string;
  activa: boolean;
  estado: EstadoCuentaIg;
  tokenVenceEn: string;
  /** Ya descifrado. null = no se pudo (clave ausente o blob corrupto). */
  token: string | null;
};

export type AutomatizacionMotor = {
  id: string;
  activa: boolean;
  mediaId: string;
  disparador: Disparador;
  modo: ModoCoincidencia;
  palabras: string[];
  mensajePrivado: string;
  enlace: string | null;
  respuestaPublica: boolean;
  mensajePublico: string | null;
};

export type RegistroEvento = {
  negocioId: string;
  cuentaId: string;
  automatizacionId: string | null;
  comentario: ComentarioWebhook;
  palabra: string | null;
  resultado: ResultadoEvento;
};

export type CambiosEvento = Partial<{
  resultado: ResultadoEvento;
  dm_enviado: boolean;
  dm_mensaje_id: string | null;
  publica_enviada: boolean;
  publica_comentario_id: string | null;
  error_codigo: CodigoErrorMeta | null;
  error_mensaje: string | null;
  procesado_en: string;
}>;

export type EnvioPrivado = { ok: true; mensajeId: string } | { ok: false; error: ErrorMeta };
export type EnvioPublico = { ok: true; id: string } | { ok: false; error: ErrorMeta };

export type DepsMotor = {
  buscarCuenta(igUserId: string): Promise<CuentaMotor | null>;
  /** Solo las ACTIVAS de ese medio, en orden de creación. */
  automatizaciones(cuentaId: string, mediaId: string | null): Promise<AutomatizacionMotor[]>;
  registrar(r: RegistroEvento): Promise<{ estado: "nuevo" | "duplicado" | "reintento"; eventoId: string | null; intentos: number }>;
  enviosUltimaHora(cuentaId: string): Promise<number>;
  enviarPrivada(cuenta: CuentaMotor, comentarioId: string, texto: string): Promise<EnvioPrivado>;
  responderPublico(cuenta: CuentaMotor, comentarioId: string, texto: string): Promise<EnvioPublico>;
  marcar(eventoId: string, cambios: CambiosEvento): Promise<void>;
  marcarCuenta(cuentaId: string, estado: EstadoCuentaIg, nota: string): Promise<void>;
  ahora?: () => number;
};

export type ResultadoMotor = {
  accion: "ignorado" | "sin_coincidencia" | "duplicado" | "enviado" | "error" | "limite";
  motivo?: string;
  /** true = conviene que Meta reenvíe (el webhook responde no-200). */
  transitorio?: boolean;
  eventoId?: string | null;
  automatizacionId?: string | null;
};

/**
 * Meta permite 750 respuestas privadas por hora por cuenta. Se frena
 * antes, con margen, para que un comentario legítimo no se pierda por
 * un pico: lo que pasa del límite queda como `limite` en la bitácora,
 * visible en el panel, y no se manda.
 */
export const LIMITE_ENVIOS_HORA = 600;
export const MAX_INTENTOS = 3;

function ahoraISO(deps: DepsMotor): string {
  return new Date(deps.ahora ? deps.ahora() : Date.now()).toISOString();
}

export async function procesarComentario(c: ComentarioWebhook, deps: DepsMotor): Promise<ResultadoMotor> {
  const cuenta = await deps.buscarCuenta(c.cuentaIgId);
  if (!cuenta) return { accion: "ignorado", motivo: "cuenta_desconocida" };
  if (!cuenta.activa || cuenta.estado === "desconectada") return { accion: "ignorado", motivo: "cuenta_inactiva" };
  // El negocio contestando en su propio post no es un cliente.
  if (c.deId && c.deId === cuenta.igUserId) return { accion: "ignorado", motivo: "comentario_propio" };

  const todas = await deps.automatizaciones(cuenta.id, c.mediaId);
  const activas = todas.filter((a) => a.activa && a.mediaId === c.mediaId);

  // La primera que coincide responde; las demás quedan anotadas.
  let elegida: { auto: AutomatizacionMotor; palabra: string | null } | null = null;
  for (const a of activas) {
    if (a.disparador === "cualquier_comentario") {
      elegida = { auto: a, palabra: null };
      break;
    }
    const palabra = primeraCoincidencia(c.texto, a.palabras, a.modo);
    if (palabra !== null) {
      elegida = { auto: a, palabra };
      break;
    }
  }

  if (!elegida) {
    await deps.registrar({ negocioId: cuenta.negocioId, cuentaId: cuenta.id, automatizacionId: null, comentario: c, palabra: null, resultado: "sin_coincidencia" });
    return { accion: "sin_coincidencia" };
  }

  for (const a of activas) {
    if (a.id !== elegida.auto.id) {
      await deps.registrar({ negocioId: cuenta.negocioId, cuentaId: cuenta.id, automatizacionId: a.id, comentario: c, palabra: null, resultado: "omitido" });
    }
  }

  const registro = await deps.registrar({
    negocioId: cuenta.negocioId,
    cuentaId: cuenta.id,
    automatizacionId: elegida.auto.id,
    comentario: c,
    palabra: elegida.palabra,
    resultado: "pendiente",
  });
  if (registro.estado === "duplicado") return { accion: "duplicado", eventoId: registro.eventoId, automatizacionId: elegida.auto.id };
  if (registro.estado === "reintento" && registro.intentos > MAX_INTENTOS) {
    return { accion: "duplicado", motivo: "intentos_agotados", eventoId: registro.eventoId, automatizacionId: elegida.auto.id };
  }
  const eventoId = registro.eventoId;
  const falla = async (error: ErrorMeta): Promise<ResultadoMotor> => {
    if (eventoId) {
      await deps.marcar(eventoId, { resultado: "error", error_codigo: error.codigo, error_mensaje: error.mensaje, procesado_en: ahoraISO(deps) });
    }
    if (error.codigo === "token_vencido" || error.codigo === "permisos") {
      await deps.marcarCuenta(cuenta.id, "reconectar", error.mensaje);
    }
    return { accion: "error", motivo: error.codigo, transitorio: error.transitorio, eventoId, automatizacionId: elegida.auto.id };
  };

  // El token, antes de gastar una llamada.
  if (!cuenta.token) {
    return falla({ codigo: "token_vencido", mensaje: "No se pudo leer el token de la cuenta.", transitorio: false });
  }
  if (estadoDelToken(cuenta.tokenVenceEn, deps.ahora ? deps.ahora() : Date.now()) === "vencido") {
    return falla({ codigo: "token_vencido", mensaje: "El token de Instagram venció.", transitorio: false });
  }

  // El freno local, antes del de Meta.
  if ((await deps.enviosUltimaHora(cuenta.id)) >= LIMITE_ENVIOS_HORA) {
    if (eventoId) {
      await deps.marcar(eventoId, { resultado: "limite", error_codigo: "rate_limit", error_mensaje: "Se alcanzó el límite de envíos por hora de esta cuenta.", procesado_en: ahoraISO(deps) });
    }
    return { accion: "limite", eventoId, automatizacionId: elegida.auto.id };
  }

  const texto = armarMensajePrivado(elegida.auto.mensajePrivado, elegida.auto.enlace);
  const dm = await deps.enviarPrivada(cuenta, c.comentarioId, texto);
  if (!dm.ok) return falla(dm.error);

  const cambios: CambiosEvento = { resultado: "enviado", dm_enviado: true, dm_mensaje_id: dm.mensajeId, procesado_en: ahoraISO(deps) };

  // La respuesta pública es un extra: si falla, el DM ya salió y el
  // evento sigue siendo un éxito — el error queda anotado, no manda.
  if (elegida.auto.respuestaPublica && elegida.auto.mensajePublico) {
    const pub = await deps.responderPublico(cuenta, c.comentarioId, elegida.auto.mensajePublico);
    if (pub.ok) {
      cambios.publica_enviada = true;
      cambios.publica_comentario_id = pub.id;
    } else {
      cambios.error_codigo = pub.error.codigo;
      cambios.error_mensaje = `Respuesta pública: ${pub.error.mensaje}`;
    }
  }

  if (eventoId) await deps.marcar(eventoId, cambios);
  return { accion: "enviado", eventoId, automatizacionId: elegida.auto.id };
}
