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
    .select("serial_number, plataforma")
    .eq("miembro_id", miembroId);

  const filas = pases ?? [];

  await avisarSeriales(
    filas.filter((p) => p.plataforma === "apple").map((p) => p.serial_number as string),
  );

  // Google no tiene push propio: el PATCH del objeto ES la
  // actualización, y los teléfonos se enteran solos. Nunca lanza.
  if (filas.some((p) => p.plataforma === "google")) {
    try {
      const { refrescarPaseGoogleDeMiembro } = await import("./google");
      await refrescarPaseGoogleDeMiembro(miembroId);
    } catch (e) {
      console.warn("[wallet] No se pudo refrescar el pase de Google:", e);
    }
  }
}

/** Igual que la anterior, pero cuando ya se tiene el serial a mano. */
export async function avisarCambioDePaseporSerial(serialNumber: string): Promise<void> {
  await avisarSeriales([serialNumber]);
}

/** Lo que pasó al avisarle a UNA plataforma — para mostrarlo en pantalla, no en un log. */
export type DiagnosticoPlataforma =
  | { hay: false }
  | { hay: true; dispositivos: number; enviados: number; caducados: number; motivo?: string };

export type DiagnosticoAviso = {
  apple: DiagnosticoPlataforma;
  google: DiagnosticoPlataforma;
};

/**
 * LA MISMA LLAMADA QUE `avisarCambioDePase`, PERO SIN TRAGARSE EL
 * RESULTADO.
 *
 * `avisarCambioDePase` (arriba) es para el camino automático: un aviso
 * que falla ahí no puede tumbar el sello que ya se dio, así que solo
 * queda en el log del servidor — nadie lo está mirando en el momento.
 *
 * Esta es para el botón "Probar el aviso" del panel (Marketing): acá SÍ
 * hay alguien mirando la pantalla en tiempo real, así que el resultado
 * de Apple y de Google se devuelve tal cual — enviado, cuántos
 * dispositivos, cuántos cadeucados, o el motivo exacto del rechazo — en
 * vez de perderse en un `console.warn`.
 *
 * Usa el MISMO camino que el automático (`avisarPaseActualizado`,
 * `refrescarPaseGoogleDeMiembro`): no es una prueba de mentira, es el
 * código real de producción, disparado a mano.
 */
export async function probarAvisoDePase(miembroId: string): Promise<DiagnosticoAviso> {
  const db = createAdminClient();
  if (!db) {
    return {
      apple: { hay: false },
      google: { hay: false },
    };
  }

  const { data: pases } = await db
    .from("pases_wallet")
    .select("serial_number, plataforma")
    .eq("miembro_id", miembroId)
    .eq("activo", true);
  const filas = pases ?? [];

  const seriales = filas
    .filter((p) => p.plataforma === "apple")
    .map((p) => p.serial_number as string);

  let apple: DiagnosticoPlataforma = { hay: false };
  if (seriales.length > 0) {
    const { data: registros } = await db
      .from("registros_dispositivo")
      .select("push_token")
      .in("serial_number", seriales);
    const tokens = [...new Set((registros ?? []).map((r) => r.push_token as string))];

    if (tokens.length === 0) {
      apple = { hay: true, dispositivos: 0, enviados: 0, caducados: 0, motivo: "Este pase no tiene ningún teléfono registrado para avisos." };
    } else {
      const { avisarPaseActualizado } = await import("./apns");
      const res = await avisarPaseActualizado(tokens);
      apple = res.ok
        ? { hay: true, dispositivos: tokens.length, enviados: res.enviados, caducados: res.caducados.length }
        : { hay: true, dispositivos: tokens.length, enviados: 0, caducados: 0, motivo: res.motivo };

      if (res.ok && res.caducados.length > 0) {
        await db.from("registros_dispositivo").delete().in("push_token", res.caducados);
      }
    }
  }

  let google: DiagnosticoPlataforma = { hay: false };
  if (filas.some((p) => p.plataforma === "google")) {
    try {
      const { refrescarPaseGoogleDeMiembro } = await import("./google");
      const res = await refrescarPaseGoogleDeMiembro(miembroId);
      google = res.ok
        ? { hay: true, dispositivos: 1, enviados: 1, caducados: 0 }
        : { hay: true, dispositivos: 1, enviados: 0, caducados: 0, motivo: res.motivo };
    } catch (e) {
      google = {
        hay: true,
        dispositivos: 1,
        enviados: 0,
        caducados: 0,
        motivo: e instanceof Error ? e.message : "No se pudo refrescar el pase de Google.",
      };
    }
  }

  return { apple, google };
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
    if (!res.ok) {
      console.warn(`[wallet] No se pudo avisar a APNs: ${res.motivo}`);
    }

    // Un 410 significa que ese teléfono ya no tiene el pase. Dejarlo en
    // la tabla hace que cada cambio futuro intente avisarle en vano.
    if (res.ok && res.caducados.length > 0) {
      await db.from("registros_dispositivo").delete().in("push_token", res.caducados);
    }
  } catch (e) {
    // El fallo no se propaga (el sello ya se dio) pero SÍ se registra:
    // "no llegó nada" sin logs es un misterio; con logs es un ticket.
    console.warn("[wallet] Falló el aviso de cambio de pase:", e);
  }
}
