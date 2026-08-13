/**
 * A dónde le pagan a BOOKEA (no a un negocio): SINPE Móvil y cuenta
 * bancaria. Los usan la compra de invitaciones y la solicitud del plan
 * de lealtad.
 *
 * Mismas variables de entorno (y mismos defaults) que ya usaba
 * /invitaciones/pago: son datos públicos —el cliente tiene que verlos
 * para pagar— y se cambian sin tocar código.
 */
export function datosDePagoBookea() {
  return {
    sinpe: {
      numero: process.env.SINPE_NUMERO ?? "8710 3739",
      titular: process.env.SINPE_TITULAR ?? "Luis Herrera Ovares",
    },
    banco: {
      nombre: process.env.BANCO_NOMBRE ?? "Banco Nacional",
      // Pendiente: se llena con BANCO_CUENTA_IBAN sin tocar código.
      cuenta: process.env.BANCO_CUENTA_IBAN ?? "",
      // La cuenta del banco es de José Pablo; el SINPE, de Luis. Son
      // titulares DISTINTOS a propósito — no unificar sin preguntar.
      titular: process.env.BANCO_TITULAR ?? "José Pablo Herrera Ovares",
    },
  };
}
