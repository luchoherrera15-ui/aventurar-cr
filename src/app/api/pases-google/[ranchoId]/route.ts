import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarPaseGoogle } from "@/lib/wallet/google";
import {
  afiliacionDeQuienPide,
  idDeCuentaDeBookea,
  identidadDeQuienPide,
  NOMBRE_COOKIE_PERSONA,
} from "@/lib/lealtad/personas";
import { pantallaDeProblema, UUID_REGEX } from "../../pases/problema";

/**
 * "Guardame la tarjeta en Google Wallet" — resuelve la identidad con la
 * cookie de la persona (0138) o con la sesión, nunca por parámetro
 * —igual que el .pkpass de Apple— y redirige al link de guardado que
 * firma nuestra cuenta de servicio. El teléfono abre Google Wallet con
 * la tarjeta lista para agregar.
 *
 * Y cuando NO se puede: la misma pantalla que Apple. Acá también se
 * respondía un JSON crudo con status 409 sobre fondo blanco.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ ranchoId: string }> },
) {
  const { ranchoId } = await params;
  if (!UUID_REGEX.test(ranchoId)) {
    return pantallaDeProblema(pedido, ranchoId, "negocio_desconocido");
  }

  // CUÁL tarjeta del negocio, si el botón lo dijo. Mismo criterio que
  // Apple: sin el parámetro, esta ruta se comporta como siempre.
  const pedidoPrograma = new URL(pedido.url).searchParams.get("programa");
  const programaId = pedidoPrograma && UUID_REGEX.test(pedidoPrograma) ? pedidoPrograma : null;

  const db = createAdminClient();
  if (!db) return pantallaDeProblema(pedido, ranchoId, "sin_conexion", programaId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const jar = await cookies();
  const identidad = await identidadDeQuienPide(db, {
    token: jar.get(NOMBRE_COOKIE_PERSONA)?.value ?? null,
    // `idDeCuentaDeBookea` y no `user?.id`: la sesión ANÓNIMA del chat
    // flotante también es un `auth.users`, y tomarla por cuenta afiliaba
    // a la persona sin preguntarle nada. Ver `personas.ts`.
    clienteId: idDeCuentaDeBookea(user),
  });

  // LA MISMA PUERTA QUE APPLE, y por la misma razón: `generarPaseGoogle`
  // también inserta en `miembros` (`google.ts:558`, el bloque es espejo
  // literal del de Apple). Un GET a esta URL afiliaba a alguien de quien
  // no se sabía el nombre, sin vínculo con el negocio y sin
  // consentimiento. La explicación larga está en `api/pases/[ranchoId]`.
  const afiliacion = await afiliacionDeQuienPide(db, identidad, {
    ranchoId,
    cuentaId: null,
  });
  if (afiliacion.falta !== null) {
    console.warn(`[pases-google] ${ranchoId} → alta incompleta: falta ${afiliacion.falta}`);
    return pantallaDeProblema(pedido, ranchoId, "sin_identidad", programaId);
  }

  const resultado = await generarPaseGoogle({ ranchoId, programaId, ...identidad });
  if (!resultado.ok) {
    console.warn(`[pases-google] ${ranchoId} → ${resultado.codigo}: ${resultado.motivo}`);
    return pantallaDeProblema(pedido, ranchoId, resultado.codigo, programaId);
  }

  return NextResponse.redirect(resultado.url, 302);
}
