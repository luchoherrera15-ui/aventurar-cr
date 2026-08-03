import { escaparHtml, layoutBento } from "@/lib/email";

/**
 * Las plantillas de la Fase 2 de Citas: el recordatorio del mismo día
 * ("tu cita es en unas horas") y el aviso de la lista de espera ("se
 * liberó un espacio"). Mismo armazón bento y las mismas reglas de
 * siempre: tablas + estilos inline y TODO dato de formulario escapado.
 */

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

/** "Tu cita es hoy a las 2:30 p. m." — sale unas 2-4 horas antes. */
export function plantillaRecordatorioHoy({
  nombreDestinatario,
  nombreNegocio,
  hora,
  servicio,
  esProveedor,
}: {
  nombreDestinatario: string;
  nombreNegocio: string;
  hora: string;
  servicio: string | null;
  esProveedor: boolean;
}) {
  return layoutBento({
    kicker: escaparHtml(nombreNegocio),
    titulo: esProveedor
      ? `Hoy a las ${escaparHtml(hora)} tenés una cita`
      : `Tu cita es hoy a las ${escaparHtml(hora)}`,
    introHtml: `Hola ${escaparHtml(nombreDestinatario)}. ${
      esProveedor
        ? `${servicio ? escaparHtml(servicio) + " — " : ""}revisá tu agenda para tener todo listo.`
        : `${servicio ? escaparHtml(servicio) + " en " + escaparHtml(nombreNegocio) + ". " : ""}Si no podés llegar, avisá por el chat — así el espacio le sirve a alguien más.`
    }`,
    cta: esProveedor
      ? undefined
      : { href: `${SITIO_URL}/cuenta/reservas`, label: "Ver mi cita" },
    pie: esProveedor
      ? "Recibiste este correo porque tenés un negocio publicado en Bookea."
      : "Recibiste este correo porque tenés una cita reservada en Bookea.",
  });
}

/** "Se liberó un espacio" — para los apuntados en la lista de espera. */
export function plantillaEspacioLiberado({
  nombreDestinatario,
  nombreNegocio,
  fechaLarga,
  urlReservar,
}: {
  nombreDestinatario: string;
  nombreNegocio: string;
  fechaLarga: string;
  urlReservar: string;
}) {
  return layoutBento({
    kicker: escaparHtml(nombreNegocio),
    titulo: "¡Se liberó un espacio!",
    introHtml: `Hola ${escaparHtml(nombreDestinatario)}. Estabas en la lista de espera de ${escaparHtml(nombreNegocio)} para el ${escaparHtml(fechaLarga)} — y se acaba de liberar un espacio.`,
    naranjaHtml:
      "El espacio queda para quien reserve primero: si todavía te sirve, entrá ya y elegí tu hora.",
    cta: { href: urlReservar, label: "Reservar mi espacio" },
    pie: "Recibiste este correo porque te apuntaste a la lista de espera de este negocio en Bookea.",
  });
}
