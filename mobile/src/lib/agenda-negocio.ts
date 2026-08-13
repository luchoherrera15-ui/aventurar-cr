/**
 * ============================================================
 * ¿CÓMO trabaja su agenda este negocio?
 * ============================================================
 *
 * Durante mucho tiempo el app escribió este corte a mano, pantalla por
 * pantalla, como `vertical === "citas"`. Eso dejaba a TODO el resto de
 * los proveedores de eventos (DJs, animadores, pintacaritas,
 * decoración, alimentación, organización) con la agenda de un salón:
 * un día entero, un depósito y un comprobante. Pero un DJ hace una
 * fiesta infantil a las 3 p. m. y una boda a las 9 p. m. el mismo
 * sábado — su agenda se mide en HORAS, igual que la de una barbería.
 *
 * La regla de producto, en tres líneas:
 *
 *  · `categoria === "lugares"` (ranchos, salones) → agenda por DÍA,
 *    depósito y SINPE. Es el único flujo que cobra dinero real hoy y
 *    NO se toca.
 *  · vertical `citas` → agenda por horas y la hora se RESERVA de
 *    verdad (RPC `crear_cita`).
 *  · el resto de eventos → agenda por horas, pero tocar un espacio
 *    libre ABRE EL CHAT con fecha + hora + servicio. No se reserva ni
 *    se aparta nada: cero holds, cero depósito, cero comprobante. El
 *    proveedor marca ocupado a mano.
 *
 * GEMELO A MANO del helper equivalente de la web (proyecto Next
 * aparte: no se puede importar, se replica). Si allá cambia el corte,
 * cambialo acá también.
 *
 * Ojo con `vertical`: en la base es anulable y una fila vieja lo trae
 * en `null`. En todo el app un `null` se lee como "eventos" (ver
 * `pantallas/explorar.tsx`), así que se normaliza acá, en el borde, y
 * nunca en la comparación.
 */

/** Lo mínimo que hay que saber de un negocio para clasificar su agenda. */
export type NegocioAgenda = {
  vertical?: string | null;
  categoria?: string | null;
};

/** La vertical efectiva: `null`/vacío = eventos, que es como nació la base. */
export function verticalDe(negocio: NegocioAgenda): string {
  const v = (negocio.vertical ?? "").trim();
  return v === "" ? "eventos" : v;
}

/**
 * Un LUGAR: rancho, salón, quinta. Se alquila por día entero, pide
 * depósito y cobra por SINPE. Su flujo es el único que mueve plata hoy
 * y queda exactamente como estaba.
 */
export function esLugarPorDia(negocio: NegocioAgenda): boolean {
  return negocio.categoria === "lugares";
}

/** La vertical de Citas (barberías, uñas, spa): la hora se reserva. */
export function esCitas(negocio: NegocioAgenda): boolean {
  return verticalDe(negocio) === "citas";
}

/**
 * Un proveedor de eventos que NO es un lugar: DJ, animador,
 * pintacaritas, decoración, alimentación, organización, otros. Trabaja
 * por horas y por servicios — pero su hora no se reserva: se consulta
 * por chat.
 */
export function esProveedorDeEventos(negocio: NegocioAgenda): boolean {
  return verticalDe(negocio) === "eventos" && !esLugarPorDia(negocio);
}

/**
 * ¿Su agenda se mide en FRANJAS DE HORAS dentro del día? Citas y
 * proveedores de eventos, sí; lugares, restaurantes y hospedajes, no
 * (cada uno tiene su propio calendario).
 *
 * Es la pregunta que hacen las pantallas del panel: si mostrar
 * duración por servicio, equipo, horario semanal y bloqueos.
 */
export function agendaPorHoras(negocio: NegocioAgenda): boolean {
  return esCitas(negocio) || esProveedorDeEventos(negocio);
}

/**
 * ¿Tocar un espacio libre ABRE EL CHAT en vez de reservar? Solo los
 * proveedores de eventos. Es la diferencia de producto entre las dos
 * agendas por horas, y por eso tiene nombre propio en vez de dejar que
 * cada pantalla vuelva a preguntar por la vertical.
 */
export function tocarHoraAbreChat(negocio: NegocioAgenda): boolean {
  return esProveedorDeEventos(negocio);
}

/**
 * Cuánto dura un servicio, en MINUTOS — que es la unidad del motor de
 * disponibilidad.
 *
 * Las dos verticales lo guardan distinto en la misma tabla
 * (`rancho_items`) y así se quedan: Citas mide en minutos
 * (`duracion_minutos`, 0055) porque un corte son 45; Eventos mide en
 * horas (`duracion_horas`) porque un DJ toca 4. Acá se juntan las dos
 * en una sola cifra, con los minutos mandando cuando están puestos.
 *
 * `null` = el proveedor no declaró duración. Quien llama decide el
 * default: la agenda de eventos usa DURACION_EVENTO_DEFAULT.
 */
export function minutosDeServicio(item: {
  duracion_minutos?: number | null;
  duracion_horas?: number | null;
}): number | null {
  const minutos = Number(item.duracion_minutos);
  if (Number.isFinite(minutos) && minutos > 0) return Math.round(minutos);
  const horas = Number(item.duracion_horas);
  if (Number.isFinite(horas) && horas > 0) return Math.round(horas * 60);
  return null;
}

/**
 * Con cuánto se dibuja la agenda de un proveedor de eventos que no
 * declaró duración: dos horas. Es el bloque típico de una fiesta
 * infantil y deja la grilla legible; el proveedor la ajusta poniéndole
 * horas a su servicio en el catálogo.
 */
export const DURACION_EVENTO_DEFAULT = 120;

/**
 * Cada cuánto se ofrece un espacio en la agenda de un proveedor de
 * eventos: en punto. Nadie contrata un DJ para las 3 y media, y con
 * media hora la grilla de un día de 8 a 22 son 28 botones.
 */
export const INTERVALO_EVENTO = 60;

/**
 * Sin horario configurado, un proveedor de eventos "abre" de 8 a 22
 * todos los días.
 *
 * Es a propósito más ancho que el 8–18 de Citas: un DJ o un animador
 * trabaja de noche y los fines de semana. Y acá ofrecer de más no
 * cuesta nada — tocar una hora NO reserva, solo abre el chat con la
 * consulta, y el proveedor contesta que no puede. El que quiera
 * afinarlo lo hace en Configuración → Equipo, horario y bloqueos.
 */
export const HORARIO_EVENTOS_DEFAULT: Record<string, { abre: string; cierra: string }> =
  Object.fromEntries(
    Array.from({ length: 7 }, (_, d) => [String(d), { abre: "08:00", cierra: "22:00" }]),
  );

const DIAS_LARGO = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const MESES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "2026-03-21" → "sábado 21 de marzo". Escrito a mano y no con Intl
 * porque en Hermes el soporte de locales llegó tarde y en un teléfono
 * viejo `toLocaleDateString("es-CR")` devuelve inglés; además "setiembre"
 * es la forma que se usa en Costa Rica, y ninguna librería la da.
 *
 * La fecha se parte a mano en vez de pasarla por `new Date(iso)`: eso
 * la interpretaría como medianoche UTC y en Costa Rica (UTC-6) el
 * mensaje saldría con el día anterior.
 */
export function fechaLarga(fechaIso: string): string {
  const [y, m, d] = fechaIso.split("-").map(Number);
  if (!y || !m || !d) return fechaIso;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS_LARGO[dow]} ${d} de ${MESES_LARGO[m - 1]}`;
}

/**
 * El primer mensaje del chat cuando alguien toca un espacio libre de un
 * proveedor de eventos.
 *
 * Es la pieza central de la regla de producto, así que se arma acá,
 * pura y probada, en vez de a mano en cada pantalla: tiene que decir la
 * fecha, la hora y el servicio, y tiene que dejar clarísimo que NO hay
 * nada reservado ni apartado. Espeja el resumen que
 * src/app/eventos/cotizacion-actions.ts arma en la web.
 */
export function mensajePrimeraConsulta(datos: {
  /** "sábado 12 de julio" — ya formateado por la pantalla. */
  fechaLarga: string;
  /** "3:00 p. m." */
  hora: string;
  /** "7:00 p. m." — el final estimado según la duración del servicio. */
  horaFin?: string | null;
  servicio?: string | null;
  /** Ya formateado en colones. */
  precio?: string | null;
  /** Lo que el cliente escribió, si la pantalla se lo pidió. */
  notas?: string | null;
}): string {
  const cuando = datos.horaFin
    ? `${datos.hora} a ${datos.horaFin}`
    : `${datos.hora}`;

  const partes = [
    `Hola, quiero consultar disponibilidad para el ${datos.fechaLarga} de ${cuando}.`,
  ];
  if (datos.servicio?.trim()) {
    partes.push(
      `Servicio: ${datos.servicio.trim()}` +
        (datos.precio?.trim() ? ` — ${datos.precio.trim()}` : "") +
        ".",
    );
  }
  if (datos.notas?.trim()) partes.push(datos.notas.trim());
  partes.push(
    "Todavía no hay nada reservado: te escribo para confirmar si tenés esa hora libre.",
  );

  // El tope de `mensajes.texto` que ya respetaba el resto del app.
  return partes.join("\n").slice(0, 2000);
}
