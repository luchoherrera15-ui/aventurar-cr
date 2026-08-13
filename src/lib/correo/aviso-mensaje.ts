import { PREFIJO_ASISTENTE } from "@/lib/asistente-prefijo";

/**
 * ============================================================
 * ¿CORRESPONDE MANDAR UN CORREO POR ESTE MENSAJE DEL CHAT?
 * ============================================================
 *
 * Desde que los proveedores de servicios de eventos (DJs, animación,
 * decoración, alimentación…) dejaron de recibir RESERVAS y pasaron a
 * recibir CONSULTAS por el chat, el aviso por correo que disparaba
 * `notificarReservaCompletada` dejó de salir: al proveedor solo le
 * quedaba el push. Sin la app instalada —o con el push apagado— la
 * consulta se queda esperando en un chat que nadie abre, y eso es un
 * cliente perdido en silencio.
 *
 * Este módulo es PURO (sin Supabase, sin Resend, sin React) porque acá
 * vive el CRITERIO, que es lo que no se puede romper. El envío en sí
 * lo hace `notificarMensajeNuevo` (src/lib/notificaciones-mensaje.ts).
 *
 * LA REGLA, y por qué:
 *
 *  1. Nunca a quien escribió — el aviso es para la OTRA parte.
 *  2. Nunca por un mensaje del asistente de IA: contesta al instante y
 *     en nombre del negocio, así que un correo por cada respuesta suya
 *     sería un robot escribiéndole al cliente cada vez que pestañea.
 *  3. Solo el PRIMER mensaje de un hilo, o el primero después de mucho
 *     silencio. Un correo por cada mensaje de una conversación viva no
 *     es "más avisos": es lo que hace que el proveedor mande TODOS
 *     nuestros correos a spam, y ahí se pierden también los que sí
 *     importan. El push ya cubre el ida y vuelta rápido; el correo es
 *     la red para cuando nadie está mirando.
 *  4. Nunca a un correo suprimido (rebote duro o queja de spam, 0082):
 *     insistirle a ese buzón quema la reputación del dominio entero.
 *
 * A propósito NO se consulta `consentimientos` (el opt-out de
 * marketing): esto es transaccional —el negocio recibiendo el trabajo
 * que vino a buscar a Bookea—, igual que el aviso de una reserva
 * nueva, que tampoco lo consulta. Las supresiones sí aplican porque no
 * son una preferencia sino un buzón que no recibe.
 */

/**
 * Cuánto silencio tiene que haber en el hilo para que un mensaje nuevo
 * vuelva a merecer correo.
 *
 * Ocho horas es una jornada: el proveedor que ya recibió el aviso de la
 * mañana no recibe otro por el mismo hilo en todo el día, pero el
 * cliente que insiste al día siguiente sí lo despierta de nuevo —
 * porque a esa altura el primer correo ya cayó al fondo de la bandeja.
 */
export const VENTANA_SILENCIO_MINUTOS = 8 * 60;

/** Tope del asunto: más largo que esto, ningún cliente de correo lo muestra. */
const LARGO_ASUNTO = 120;

/** Tope del resumen que se le pega al asunto. */
const LARGO_RESUMEN = 62;

export type MotivoSinCorreo =
  | "mismo-autor"
  | "mensaje-automatico"
  | "conversacion-viva"
  | "sin-correo"
  | "correo-suprimido";

export type DecisionCorreo =
  | { avisar: true }
  | { avisar: false; motivo: MotivoSinCorreo };

/** Lo que define el RITMO: quién escribió, qué, y cuándo fue lo anterior. */
export type DatosRitmo = {
  autorId: string;
  /** El otro participante del hilo — a quien iría el correo. */
  receptorId: string;
  texto: string;
  /** ISO del mensaje nuevo. */
  creadoEn: string;
  /** ISO del mensaje inmediatamente anterior del hilo; null = es el primero. */
  previoCreadoEn: string | null;
};

const SI: DecisionCorreo = { avisar: true };
const no = (motivo: MotivoSinCorreo): DecisionCorreo => ({ avisar: false, motivo });

/**
 * Minutos entre dos marcas ISO. Si alguna no se puede leer devuelve
 * Infinity a propósito: ante una fecha ilegible se prefiere avisar
 * (perder una consulta cuesta plata) — mandar de más no es un riesgo
 * acá porque la idempotencia no depende de este número, sino de la
 * bandera `push_enviado` que se reclama una sola vez por mensaje.
 */
function minutosEntre(desde: string, hasta: string): number {
  const a = Date.parse(desde);
  const b = Date.parse(hasta);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return (b - a) / 60000;
}

/**
 * El criterio de ritmo: ¿este mensaje es de los que merecen correo?
 * No mira todavía si el destinatario TIENE correo — eso cuesta
 * consultas a la base, y esta parte se resuelve con lo que ya se leyó.
 */
export function esMomentoDeAvisar(d: DatosRitmo): DecisionCorreo {
  // Defensivo: un hilo donde el autor es el receptor no existe hoy
  // (cliente y proveedor son cuentas distintas), pero si algún día un
  // dueño se escribe a sí mismo, no se le manda un correo por eso.
  if (d.autorId === d.receptorId) return no("mismo-autor");

  // El asistente de IA escribe en nombre del negocio: sus respuestas no
  // son "el negocio contestó", son un robot puntual.
  if (d.texto.startsWith(PREFIJO_ASISTENTE)) return no("mensaje-automatico");

  // Primer mensaje del hilo: la consulta nueva, el caso que importa.
  if (d.previoCreadoEn === null) return SI;

  const silencio = minutosEntre(d.previoCreadoEn, d.creadoEn);
  return silencio >= VENTANA_SILENCIO_MINUTOS ? SI : no("conversacion-viva");
}

/**
 * Un asunto es una CABECERA del correo: un salto de línea ahí adentro
 * la parte en dos y deja meter cabeceras inventadas. Todo lo que entra
 * al asunto es texto de otra persona (el mensaje del cliente, el nombre
 * que el dueño le puso a su negocio), así que se aplana acá — un solo
 * lugar, en vez de confiar en que cada llamador se acuerde.
 */
function unaLinea(texto: string): string {
  return texto
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mismo criterio de validez que el CHECK de la 0082. */
function correoUsable(correo: string | null): boolean {
  if (!correo) return false;
  const limpio = correo.trim().toLowerCase();
  return limpio.indexOf("@") > 0 && !/\s/.test(limpio);
}

/**
 * La decisión completa: el ritmo más el estado del destinatario.
 * `correoSuprimido` sale de `supresiones_correo` (rebotes y quejas).
 */
export function decidirCorreoMensaje(
  d: DatosRitmo & { correoReceptor: string | null; correoSuprimido: boolean },
): DecisionCorreo {
  const ritmo = esMomentoDeAvisar(d);
  if (!ritmo.avisar) return ritmo;
  if (!correoUsable(d.correoReceptor)) return no("sin-correo");
  if (d.correoSuprimido) return no("correo-suprimido");
  return SI;
}

/**
 * El pedazo del asunto que hace que el correo sirva EN LA BANDEJA, sin
 * abrirlo: la fecha y la hora que la persona eligió en la agenda.
 *
 * El primer mensaje de una consulta de eventos siempre abre igual
 * (`armarPrimerMensaje`, src/app/eventos/agenda-consulta.ts):
 *
 *   "Hola, quiero consultar disponibilidad para el sábado 21 de marzo
 *    de 2026 de 3:00 p. m. a 5:00 p. m."
 *
 * De ahí sale "sábado 21 de marzo, 3:00 p. m.". El año se cae porque
 * en un asunto no aporta y sí ocupa. Si el mensaje no tiene esa forma
 * (alguien escribió a mano, o el texto cambió), se cae a la primera
 * línea recortada — nunca a un asunto vacío.
 */
export function resumenParaAsunto(texto: string): string | null {
  const consulta =
    /consultar disponibilidad para el\s+(.+?)\s+de\s+(\d{1,2}:\d{2}\s*[ap]\.\s*m\.)/i.exec(
      texto,
    );
  if (consulta) {
    const fecha = unaLinea(consulta[1]).replace(/\s+de\s+\d{4}$/i, "").trim();
    return `${fecha}, ${unaLinea(consulta[2])}`;
  }

  const primeraLinea = texto
    .split("\n")
    .map((l) => unaLinea(l))
    .find((l) => l.length > 0);
  if (!primeraLinea) return null;
  return primeraLinea.length > LARGO_RESUMEN
    ? `${primeraLinea.slice(0, LARGO_RESUMEN - 1).trimEnd()}…`
    : primeraLinea;
}

/**
 * El asunto. "Tenés un mensaje" no le sirve a nadie: el proveedor tiene
 * que poder decidir si abre sin abrir, así que el asunto lleva el
 * negocio y —cuando se puede— la fecha y la hora que le están pidiendo.
 */
export function asuntoMensajeNuevo({
  nombreNegocio,
  texto,
  paraProveedor,
  esPrimerMensaje,
}: {
  nombreNegocio: string;
  texto: string;
  /** true = le llega al dueño del negocio; false = al cliente. */
  paraProveedor: boolean;
  esPrimerMensaje: boolean;
}): string {
  const resumen = resumenParaAsunto(texto);
  const negocio = unaLinea(nombreNegocio);

  let base: string;
  if (paraProveedor) {
    base = esPrimerMensaje
      ? `Consulta nueva para ${negocio}`
      : `Mensaje nuevo para ${negocio}`;
  } else {
    base = `${negocio} te escribió por el chat`;
  }

  // Al cliente no se le repite el resumen: él escribió la consulta, ya
  // sabe qué pidió. Al proveedor sí — es el dato que le hace abrirlo.
  const completo = paraProveedor && resumen ? `${base} — ${resumen}` : base;
  return completo.length > LARGO_ASUNTO
    ? `${completo.slice(0, LARGO_ASUNTO - 1).trimEnd()}…`
    : completo;
}
