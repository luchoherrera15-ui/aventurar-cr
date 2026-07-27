export function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function fmtFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
  });
}

export function esFechaHoy(iso: string) {
  return iso === fechaISO(new Date());
}

export const DIAS_DISPONIBILIDAD = 60;

/**
 * Próxima fecha libre de un lugar dentro de los próximos 60 días, o
 * `null` si está confirmado todos esos días (agotado). Es el dato
 * real que tenemos hoy (un evento = un día completo), sin inventar
 * bloques de horas.
 */
export function proximaFechaLibre(
  ranchoId: string,
  ocupadosPorFecha: Map<string, Set<string>>,
  dias: number = DIAS_DISPONIBILIDAD,
): string | null {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() + i);
    const iso = fechaISO(d);
    if (!ocupadosPorFecha.get(iso)?.has(ranchoId)) return iso;
  }
  return null;
}
