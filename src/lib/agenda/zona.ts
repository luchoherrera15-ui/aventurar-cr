import { instanteEnZona } from "./disponibilidad";

/**
 * La inversa de `instanteEnZona`: de "esta fecha y hora DE PARED en la
 * zona del negocio" al instante UTC real. La necesitan los bloqueos de
 * agenda: el dueño piensa "cierro el viernes de 1 a 3", pero
 * `bloqueos_agenda.inicio/fin` son timestamptz.
 *
 * Sin librerías: se propone el instante como si la pared fuera UTC y
 * se corrige con lo que `instanteEnZona` devuelva. Dos pasadas
 * alcanzan incluso si la primera cae al otro lado de un cambio de
 * hora (Costa Rica no tiene, pero la zona del negocio es configurable).
 */
export function utcDesdeZona(fecha: string, hora: string, zona: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const deseado = Date.UTC(y, m - 1, d, hh, mm);

  let instante = deseado;
  for (let i = 0; i < 2; i++) {
    const pared = instanteEnZona(new Date(instante).toISOString(), zona);
    const [py, pm, pd] = pared.fecha.split("-").map(Number);
    const obtenido = Date.UTC(py, pm - 1, pd, 0, pared.minutos);
    if (obtenido === deseado) break;
    instante += deseado - obtenido;
  }
  return new Date(instante);
}
