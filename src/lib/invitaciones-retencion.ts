/**
 * Cuánto viven las invitaciones y los álbumes.
 *
 * Una invitación se FINALIZA sola el día después del evento: no hay
 * columna que mantener al día — se deduce de `fecha_evento`, así que
 * si el equipo mueve la fecha, la carpeta se acomoda sola y nunca
 * queda un estado mintiendo. El link público (/i/{slug}) sigue vivo
 * mientras la fila exista: los invitados vuelven a él después de la
 * fiesta (por las fotos, por el recuerdo), y apagarlo el lunes
 * siguiente sería romperles algo que todavía usan.
 *
 * A los 6 meses del evento la invitación se borra de verdad, con sus
 * confirmaciones (la cascada de 0066). Los álbumes NO se finalizan:
 * siguen como card activa y se borran a los 5 años de creados, con
 * sus fotos del storage.
 *
 * Lo usan la lista del cliente (web y app) para agrupar y mostrar la
 * fecha de borrado, y el cron diario (/api/recordatorios) para hacer
 * la limpieza. Misma fuente para los dos: lo que la tarjeta promete
 * es lo que el cron cumple.
 */

export const MESES_RETENCION_INVITACION = 6;
export const ANOS_RETENCION_ALBUM = 5;

/**
 * Suma meses a una fecha ISO recortando al último día del mes destino:
 * 31 de agosto + 6 meses = 28 de febrero, no el 3 de marzo. Sin pasar
 * por zonas horarias (todo en UTC sobre una fecha pelada).
 */
export function sumarMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const primeroDelDestino = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(
      primeroDelDestino.getUTCFullYear(),
      primeroDelDestino.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  primeroDelDestino.setUTCDate(Math.min(d, ultimoDia));
  return primeroDelDestino.toISOString().slice(0, 10);
}

/**
 * ¿El evento ya pasó? El día del evento NO cuenta: mientras la fiesta
 * está pasando, la invitación sigue arriba con las próximas.
 */
export function invitacionFinalizada(fechaEvento: string, hoy: string): boolean {
  return fechaEvento < hoy;
}

/** El día en que esta invitación se borra para siempre (ISO). */
export function fechaBorradoInvitacion(fechaEvento: string): string {
  return sumarMesesISO(fechaEvento, MESES_RETENCION_INVITACION);
}

/**
 * La fecha de evento más vieja que todavía se conserva: el cron borra
 * todo lo anterior a este día.
 */
export function limiteRetencionInvitaciones(hoy: string): string {
  return sumarMesesISO(hoy, -MESES_RETENCION_INVITACION);
}

/** "2027-01-31" → "31 de enero de 2027". */
export function fechaBorradoBonita(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
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
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
