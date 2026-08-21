import type { CodigoFalloPase } from "@/lib/wallet/identidad";
import type { EstadoVisible } from "@/lib/lealtad/programas";

/**
 * LO QUE LEE ALGUIEN PARADO EN EL LOCAL CUANDO LA COSA NO SALE.
 *
 * ------------------------------------------------------------------
 * DOS COSAS QUE ESTABAN MAL Y ESTE ARCHIVO ARREGLA
 * ------------------------------------------------------------------
 * 1. UN 404 GENÉRICO PARA TODO. Pausada, borrador, programada, vencida,
 *    archivada y un slug inexistente caían todos en el mismo
 *    `notFound()`. El cliente con el teléfono en la mano no tenía cómo
 *    saber si el negocio pausó su tarjeta —y hay que volver el mes que
 *    viene— o si el QR está mal impreso —y hay que avisarle al de la
 *    caja—. Las dos cosas se ven igual: "esta página no existe".
 *
 * 2. EL JSON CRUDO DEL BOTÓN. Ver `api/pases/problema.ts`. Acá vive el
 *    texto de cada código de fallo.
 *
 * ------------------------------------------------------------------
 * CÓMO ESTÁ ESCRITO
 * ------------------------------------------------------------------
 * Cada aviso contesta las dos preguntas que tiene esa persona, en ese
 * orden: ¿QUÉ PASÓ? y ¿QUÉ HAGO? Nunca "error", nunca un código, nunca
 * "intente más tarde" a secas. Y cuando la culpa es nuestra, se dice
 * que es nuestra — la persona no tiene que sentir que hizo algo mal.
 *
 * Las funciones son puras a propósito: se prueban sin base, sin
 * navegador y sin sesión (`problemas.test.ts`).
 */

export type Aviso = {
  titulo: string;
  texto: string;
  /**
   * `espera` = el negocio decidió algo y hay que volver;
   * `nuestro` = falló Bookea;
   * `qr`      = el código escaneado no lleva a ninguna tarjeta.
   */
  tono: "espera" | "nuestro" | "qr";
};

/** Por qué esta tarjeta no está repartiendo pases hoy. */
export function avisoDeTarjetaQueNoEmite(
  estado: EstadoVisible | "sin_tarjeta",
  nombreNegocio: string,
): Aviso {
  const negocio = nombreNegocio.trim() || "Este negocio";

  switch (estado) {
    case "pausado":
      return {
        tono: "espera",
        titulo: "Esta tarjeta está en pausa",
        texto:
          `${negocio} pausó su programa de sellos por ahora. Si ya tenías tu ` +
          `tarjeta, sigue guardada con todos tus sellos — preguntá en el local ` +
          `cuándo vuelve.`,
      };
    case "borrador":
      return {
        tono: "espera",
        titulo: "Todavía no está lista",
        texto:
          `${negocio} está armando su tarjeta de sellos. Volvé a escanear este ` +
          `mismo QR en unos días y te la llevás.`,
      };
    case "programado":
      return {
        tono: "espera",
        titulo: "Todavía no arranca",
        texto:
          `${negocio} ya tiene lista su tarjeta, pero empieza a repartirla más ` +
          `adelante. Preguntá en el local desde cuándo.`,
      };
    case "vencido":
      return {
        tono: "espera",
        titulo: "Esta promoción ya terminó",
        texto:
          `La tarjeta de ${negocio} tenía fecha de cierre y ya pasó. Si te ` +
          `quedaron sellos sin canjear, preguntá en el local.`,
      };
    case "archivado":
      return {
        tono: "espera",
        titulo: `${negocio} ya no tiene esta tarjeta`,
        texto:
          `El negocio archivó su programa de sellos. Preguntá en el local si ` +
          `abrieron uno nuevo.`,
      };
    default:
      return {
        tono: "qr",
        titulo: `${negocio} todavía no tiene tarjeta de sellos`,
        texto:
          `Este QR es de Bookea y el negocio existe, pero su programa todavía ` +
          `no está armado. Avisale a quien te atendió.`,
      };
  }
}

/** El QR no lleva a ningún negocio: mal impreso, viejo, o dado de baja. */
export function avisoDeSlugDesconocido(): Aviso {
  return {
    tono: "qr",
    titulo: "Este código no lleva a ninguna tarjeta",
    texto:
      "Puede estar mal impreso, o el negocio ya no está en Bookea. Mostrale " +
      "esta pantalla a quien te atendió — con eso sabe que hay que cambiar el póster.",
  };
}

/**
 * El negocio SÍ existe, pero la tarjeta que pide el link no.
 *
 * Es distinto de `avisoDeSlugDesconocido` y por eso tiene su propio
 * texto: acá el póster llegó al negocio correcto, así que quien atiende
 * puede resolverlo en el momento —el link de cada tarjeta está en su
 * panel— mientras que un slug de negocio desconocido no lo arregla
 * nadie desde la caja.
 */
export function avisoDeTarjetaDesconocida(nombreNegocio: string): Aviso {
  const negocio = nombreNegocio.trim() || "Este negocio";
  return {
    tono: "qr",
    titulo: "Esta tarjeta ya no está en este link",
    texto:
      `${negocio} está en Bookea, pero la tarjeta que pide este código no ` +
      `existe o le cambiaron el nombre. Mostrale esta pantalla a quien te ` +
      `atendió: el link correcto de cada tarjeta está en su panel.`,
  };
}

/** Por qué el botón del pase no pudo entregar nada. */
export function avisoDeFalloDelPase(
  codigo: CodigoFalloPase,
  nombreNegocio: string,
): Aviso {
  const negocio = nombreNegocio.trim() || "Este negocio";

  switch (codigo) {
    case "lleno":
      return {
        tono: "espera",
        titulo: "El programa está lleno por ahora",
        texto:
          `${negocio} llegó al tope de clientes de su paquete. No es algo que ` +
          `hayas hecho vos: avisale en la caja y, apenas lo amplíen, tu tarjeta entra.`,
      };
    case "pausado":
      return {
        tono: "espera",
        titulo: "Esta tarjeta está en pausa",
        texto:
          `${negocio} pausó su programa mientras tanto, así que hoy no está ` +
          `entregando tarjetas nuevas. Preguntá en el local cuándo vuelve.`,
      };
    case "cancelada":
      return {
        tono: "espera",
        titulo: "Tu tarjeta de este negocio está cancelada",
        texto:
          `${negocio} canceló tu membresía. Preguntá en el local si te la pueden ` +
          `volver a activar — tus sellos no se borraron.`,
      };
    case "sin_credenciales":
      return {
        tono: "nuestro",
        titulo: "No podemos entregarte el pase ahora mismo",
        texto:
          "El problema es de Bookea, no tuyo: nos falta la firma con la que se " +
          "arma la tarjeta digital. Ya lo estamos viendo — probá de nuevo más tarde.",
      };
    // También es el aviso de «tu alta quedó a medias»: nombre en blanco,
    // sin vínculo con el negocio o sin consentimiento guardado. Los dos
    // casos se resuelven exactamente igual —llenando el formulario de
    // abajo— así que decirlos por separado sería obligar a la persona a
    // entender de qué le falta cuál.
    case "sin_identidad":
      return {
        tono: "nuestro",
        titulo: "Contanos quién sos y te la damos",
        texto:
          "Nos falta tu nombre y un WhatsApp o correo para poder dártela. " +
          "Completalo acá abajo: si ya tenías tarjeta, sigue guardada con " +
          "todos tus sellos.",
      };
    case "sin_programa":
      return avisoDeTarjetaQueNoEmite("sin_tarjeta", nombreNegocio);
    case "negocio_desconocido":
      return avisoDeSlugDesconocido();
    default:
      return {
        tono: "nuestro",
        titulo: "Algo falló de nuestro lado",
        texto:
          "No pudimos armar tu tarjeta en este momento. Probá otra vez en un " +
          "ratito — si ya tenías sellos, siguen guardados.",
      };
  }
}
