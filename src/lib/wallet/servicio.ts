import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Piezas compartidas del Web Service de Apple Wallet.
 *
 * Apple llama a cuatro rutas desde el iPhone del cliente, sin sesión de
 * usuario: la única credencial es la cabecera
 * `Authorization: ApplePass <token>`, que tiene que coincidir con el
 * `auth_token` del pase (`pases_wallet`, 0060).
 *
 * Todo esto corre con la llave de servicio porque no hay usuario
 * autenticado del lado nuestro — el que llama es el sistema operativo
 * del teléfono.
 */

/** Lee el token de `Authorization: ApplePass <token>`. */
export function tokenDeCabecera(pedido: Request): string | null {
  const cabecera = pedido.headers.get("authorization") ?? "";
  const m = cabecera.match(/^ApplePass\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Compara en TIEMPO CONSTANTE.
 *
 * Un `===` normal corta en el primer byte distinto, y esa diferencia de
 * microsegundos deja adivinar el token carácter por carácter. Es un
 * ataque real contra secretos comparados en un endpoint público.
 */
function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // `timingSafeEqual` exige mismo largo; si difieren ya es distinto,
  // pero igual se compara contra sí mismo para no delatar el largo.
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export type PaseAutenticado = {
  serialNumber: string;
  miembroId: string;
  ranchoId: string;
};

/**
 * Comprueba que quien llama tenga el token de ESE pase.
 *
 * Devuelve null en cualquier fallo, sin distinguir "no existe" de
 * "token equivocado": responder distinto convierte al endpoint en un
 * oráculo para averiguar qué seriales existen.
 */
export async function autenticarPase(
  pedido: Request,
  serialNumber: string,
): Promise<PaseAutenticado | null> {
  const token = tokenDeCabecera(pedido);
  if (!token) return null;

  const db = createAdminClient();
  if (!db) return null;

  const { data: pase } = await db
    .from("pases_wallet")
    .select("serial_number, auth_token, miembro_id")
    .eq("serial_number", serialNumber)
    .maybeSingle();

  if (!pase || !igualSeguro(token, pase.auth_token as string)) return null;

  const { data: miembro } = await db
    .from("miembros")
    .select("id, programa_id")
    .eq("id", pase.miembro_id)
    .maybeSingle();
  if (!miembro) return null;

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa) return null;

  return {
    serialNumber: pase.serial_number as string,
    miembroId: miembro.id as string,
    ranchoId: programa.rancho_id as string,
  };
}

/**
 * Avisa a los teléfonos de un miembro que su pase cambió, y limpia los
 * registros caducados.
 *
 * Se llama después de mover el saldo. Los fallos NO se propagan: que un
 * push no salga no puede tumbar la operación que lo originó — el sello
 * ya se dio y el pase se actualiza igual la próxima vez que el teléfono
 * pregunte.
 */
export async function avisarCambioDePase(miembroId: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;

  const { data: pases } = await db
    .from("pases_wallet")
    .select("serial_number")
    .eq("miembro_id", miembroId)
    .eq("plataforma", "apple");

  await avisarSeriales((pases ?? []).map((p) => p.serial_number as string));
}

/** Igual que la anterior, pero cuando ya se tiene el serial a mano. */
export async function avisarCambioDePaseporSerial(serialNumber: string): Promise<void> {
  await avisarSeriales([serialNumber]);
}

async function avisarSeriales(seriales: string[]): Promise<void> {
  try {
    const db = createAdminClient();
    if (!db || seriales.length === 0) return;

    const { data: registros } = await db
      .from("registros_dispositivo")
      .select("push_token, device_library_id")
      .in("serial_number", seriales);

    const tokens = [...new Set((registros ?? []).map((r) => r.push_token as string))];
    if (tokens.length === 0) return;

    const { avisarPaseActualizado } = await import("./apns");
    const res = await avisarPaseActualizado(tokens);

    // Un 410 significa que ese teléfono ya no tiene el pase. Dejarlo en
    // la tabla hace que cada cambio futuro intente avisarle en vano.
    if (res.ok && res.caducados.length > 0) {
      await db.from("registros_dispositivo").delete().in("push_token", res.caducados);
    }
  } catch {
    // Silencio a propósito: ver el comentario de arriba.
  }
}
