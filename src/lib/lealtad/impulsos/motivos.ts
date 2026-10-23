/**
 * Por qué un mensaje no salió, dicho para el negocio.
 *
 * El motor guarda un CÓDIGO corto en `impulsos_tareas.motivo` y la pantalla lo traduce acá. Un código
 * que no está en la lista se muestra tal cual en vez de esconderse: mejor feo que invisible.
 */

import { MOTIVOS_FOORKIE, type Voz } from "./voz-foorkie";

export const MOTIVOS: Record<string, string> = {
  // ── Se decidió no mandarlo (omitida) ──
  sin_consentimiento: "El cliente no aceptó recibir correos de este negocio (o se dio de baja).",
  sin_correo: "No tenemos el correo de este cliente.",
  sin_pase: "El cliente no tiene la tarjeta guardada en el Wallet.",
  sin_canal_individual:
    "Solo tiene Apple Wallet, y las tarjetas propias de Bookea no admiten mensajes a un solo cliente en iPhone.",
  correo_lo_manda_foorkie: "Es una tarjeta de Foorkie: los correos los manda Foorkie, no se envían desde acá.",
  condiciones_no_cumplidas: "El cliente ya no cumplía las condiciones del impulso.",
  ya_no_aplica: "Lo que disparó el mensaje cambió antes de que saliera (por ejemplo, el cliente volvió o canjeó).",
  variable_faltante: "Faltaba un dato del cliente para armar el mensaje y no había alternativo.",
  espera_minima: "Ya recibió este mismo impulso hace muy poco.",
  tope_diario_cliente: "El cliente ya recibió el máximo de mensajes de impulsos en 24 horas.",
  miembro_inactivo: "El cliente ya no está activo en la tarjeta.",
  tarjeta_inactiva: "La tarjeta no estaba activa en ese momento.",
  fuera_de_vigencia: "La campaña ya había terminado.",
  fuera_de_horario: "Cayó fuera del horario permitido y el impulso no espera a la próxima ventana.",
  vencida: "Pasó demasiado tiempo desde su hora y ya no tenía sentido mandarlo.",
  // ── Se canceló ──
  impulso_pausado: "El impulso se pausó antes de que saliera.",
  impulso_eliminado: "El impulso se eliminó antes de que saliera.",
  impulso_editado: "Se cambió qué dispara el impulso y los mensajes que esperaban ya no correspondían.",
  // ── Falló ──
  error_proveedor: "El proveedor (Resend, Apple o Google) no aceptó el mensaje.",
  proveedor_no_configurado: "El proveedor de este canal no está configurado en el servidor.",
  sin_enlace_de_baja: "No se pudo armar el enlace para darse de baja, y un correo no sale sin él.",
  resultado_incierto:
    "El envío se interrumpió y no se sabe si el mensaje salió. No se reenvía solo para no duplicarlo.",
  error_interno: "Hubo un error inesperado al procesar el mensaje.",
};

/**
 * El texto de un código de motivo. `voz` solo cambia las frases que nombran a Bookea (ver `voz-foorkie.ts`):
 * por defecto sale exactamente lo de siempre.
 */
export function textoDeMotivo(motivo: string | null | undefined, voz: Voz = "bookea"): string {
  if (!motivo) return "";
  if (voz === "foorkie" && Object.hasOwn(MOTIVOS_FOORKIE, motivo)) return MOTIVOS_FOORKIE[motivo];
  return MOTIVOS[motivo] ?? motivo;
}

/** Los motivos por los que reintentar a mano tiene sentido (y los que pueden duplicar un mensaje). */
export function reintentoSeguro(motivo: string | null | undefined): boolean {
  return motivo !== "resultado_incierto";
}
