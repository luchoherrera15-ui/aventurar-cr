/**
 * EL CICLO DE VIDA DEL TOKEN — puro, probado.
 *
 * Meta: el token largo dura 60 días; se puede refrescar (otros 60)
 * si tiene al menos 24 horas y todavía no venció. Un token vencido no
 * se refresca: hay que volver a pasar por la pantalla de permisos.
 *
 * Por eso tres estados y una regla:
 *   vigente     falta más de DIAS_AVISO para que venza;
 *   por_vencer  falta DIAS_AVISO o menos — el panel lo muestra y el
 *               servidor intenta refrescarlo;
 *   vencido     ya pasó — «Instagram necesita reconectar esta cuenta».
 */

export type EstadoToken = "vigente" | "por_vencer" | "vencido";

export const DIAS_AVISO = 10;
export const HORAS_MINIMAS_PARA_REFRESCAR = 24;

const DIA_MS = 24 * 60 * 60 * 1000;

function ms(v: string | Date | number): number {
  return v instanceof Date ? v.getTime() : typeof v === "number" ? v : new Date(v).getTime();
}

export function estadoDelToken(venceEn: string | Date | number, ahora: number = Date.now()): EstadoToken {
  const vence = ms(venceEn);
  if (!Number.isFinite(vence) || vence <= ahora) return "vencido";
  if (vence - ahora <= DIAS_AVISO * DIA_MS) return "por_vencer";
  return "vigente";
}

/**
 * ¿Toca refrescarlo AHORA? Sí cuando está por vencer, todavía no venció,
 * y hace ≥24 h del último refresco (o de la conexión, si nunca se
 * refrescó) — la condición que pone Meta.
 */
export function debeRefrescar(
  { venceEn, refrescadoEn, conectadaEn }: { venceEn: string | Date | number; refrescadoEn: string | Date | number | null; conectadaEn: string | Date | number },
  ahora: number = Date.now(),
): boolean {
  const estado = estadoDelToken(venceEn, ahora);
  if (estado !== "por_vencer") return false;
  const ultimo = refrescadoEn ? ms(refrescadoEn) : ms(conectadaEn);
  if (!Number.isFinite(ultimo)) return true;
  return ahora - ultimo >= HORAS_MINIMAS_PARA_REFRESCAR * 60 * 60 * 1000;
}

/** La fecha de vencimiento a partir del `expires_in` (segundos) de Meta. */
export function venceEnDesde(expiresInSegundos: number, ahora: number = Date.now()): string {
  const seg = Number.isFinite(expiresInSegundos) && expiresInSegundos > 0 ? expiresInSegundos : 60 * DIA_MS / 1000;
  return new Date(ahora + seg * 1000).toISOString();
}
