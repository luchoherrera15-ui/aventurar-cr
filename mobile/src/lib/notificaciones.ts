const SITIO_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bookea.lat";

// Si la web no contesta en este rato, se deja ir. Nadie está esperando
// la respuesta: la reserva ya se guardó antes de llamar acá.
const TIMEOUT_MS = 8000;

/**
 * Le pide a la web que mande los correos de una reserva recién hecha:
 * la confirmación al cliente y el aviso al dueño del lugar.
 *
 * La app no puede mandarlos sola — la API key de Resend y la llave de
 * servicio de Supabase son secretos de servidor y no pueden viajar
 * dentro del bundle de una app, que cualquiera puede abrir.
 *
 * Nunca lanza y nunca bloquea. La reserva ya quedó guardada en Supabase
 * antes de llegar acá, así que si esto falla la persona igual ve su
 * pantalla de "reserva recibida" — solo se pierde el correo. Llamarlo
 * dos veces con el mismo id tampoco manda correos repetidos: el
 * servidor los marca una sola vez.
 */
export async function pedirCorreosDeReserva(reservaId: string) {
  await pedir(reservaId, "confirmacion", "el correo de confirmación");
}

/**
 * Le pide a la web que le avise al cliente que su reserva quedó
 * aprobada. Lo usa el panel del proveedor, que confirma escribiendo
 * directo contra Supabase.
 *
 * Igual que el de arriba: no bloquea, no lanza, y llamarlo dos veces no
 * manda correos repetidos.
 */
export async function pedirCorreoDeAprobacion(reservaId: string) {
  await pedir(reservaId, "aprobacion", "el correo de aprobación");
}

async function pedir(reservaId: string, ruta: string, queEs: string) {
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    await fetch(`${SITIO_URL}/api/reservas/${reservaId}/${ruta}`, {
      method: "POST",
      signal: control.signal,
    });
  } catch (e) {
    console.warn(`[reserva] No se pudo pedir ${queEs}:`, e);
  } finally {
    clearTimeout(corte);
  }
}
