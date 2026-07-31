/**
 * Cuánto viven las invitaciones — espejo de `src/lib/invitaciones-retencion.ts`
 * de la web (la app es otro proyecto y no puede importar de allá; si
 * cambia la política, se cambia en los dos).
 *
 * Una invitación se finaliza sola el día después del evento: se deduce
 * de `fecha_evento`, no hay estado que mantener al día. El link
 * público sigue vivo hasta que se borra, a los 6 meses del evento.
 *
 * "Hoy" se saca del reloj del teléfono, no de una zona fija: el
 * usuario está en Costa Rica y lo que espera es que la invitación baje
 * a finalizadas cuando para ÉL ya pasó el día.
 */

export const MESES_RETENCION_INVITACION = 6;

/** "YYYY-MM-DD" de hoy según el teléfono. */
export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Suma meses a una fecha ISO recortando al último día del mes destino
 * (31 de agosto + 6 meses = 28 de febrero, no el 3 de marzo).
 */
export function sumarMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const destino = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

/** El día del evento todavía cuenta como próxima: la fiesta está pasando. */
export function invitacionFinalizada(fechaEvento: string, hoy: string): boolean {
  return fechaEvento < hoy;
}

/** El día en que esta invitación se borra para siempre (ISO). */
export function fechaBorradoInvitacion(fechaEvento: string): string {
  return sumarMesesISO(fechaEvento, MESES_RETENCION_INVITACION);
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2027-01-31" → "31 de enero de 2027". */
export function fechaBorradoBonita(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
