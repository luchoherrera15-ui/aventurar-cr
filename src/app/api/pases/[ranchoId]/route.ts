import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarPaseDeLealtad } from "@/lib/wallet/generar";
import {
  afiliacionDeQuienPide,
  idDeCuentaDeBookea,
  identidadDeQuienPide,
  NOMBRE_COOKIE_PERSONA,
} from "@/lib/lealtad/personas";
import { pantallaDeProblema, UUID_REGEX } from "../problema";

/**
 * "Dame mi tarjeta de lealtad de este negocio" — devuelve un .pkpass
 * firmado, listo para agregar a Apple Wallet.
 *
 * La identidad se resuelve ACÁ y NUNCA llega por parámetro: si llegara,
 * cualquiera podría bajarse la tarjeta de otro y ver su saldo. Sale de
 * dos lugares, los dos del navegador y ninguno adivinable:
 *
 *   · la cookie httpOnly de `sesiones_persona` (0138), que es lo que
 *     tiene quien se afilió escaneando el póster sin abrir cuenta;
 *   · la sesión de Supabase, para quien además tiene cuenta.
 *
 * El generador corre después con la llave de servicio, porque
 * `pases_wallet` no tiene política de escritura para clientes (0060) —
 * pero solo se lo invoca con la identidad ya verificada.
 */

// Firmar y dibujar tres tiras de sellos no cabe en el runtime de edge.
export const runtime = "nodejs";
// El pase depende del saldo del cliente: nunca se cachea.
export const dynamic = "force-dynamic";

export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ ranchoId: string }> },
) {
  const { ranchoId } = await params;
  if (!UUID_REGEX.test(ranchoId)) {
    return pantallaDeProblema(pedido, ranchoId, "negocio_desconocido");
  }

  const db = createAdminClient();
  if (!db) return pantallaDeProblema(pedido, ranchoId, "sin_conexion");

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

  // ══ LA PUERTA QUE DE VERDAD CIERRA ═══════════════════════════════
  //
  // Esta ruta AFILIA: `generarPaseDeLealtad` inserta en `miembros` si
  // quien pide todavía no es miembro (`generar.ts:227`, «pedir la
  // tarjeta ES afiliarse»). O sea que todo lo que haga el formulario de
  // `/tarjeta/[slug]` —campos obligatorios, casilla de consentimiento,
  // validación de servidor en la action— se salta entero con un GET a
  // esta URL, que es pública y cuyo único parámetro es el id del
  // negocio. Así entraron los tres miembros de producción que quedaron
  // sin nombre, sin vínculo y sin consentimiento.
  //
  // Se comprueba ANTES de llamar al generador, no adentro: adentro está
  // `src/lib/wallet`, que también sirve al refresco del pase que la
  // persona YA tiene en el teléfono. Frenar ahí le apagaría la tarjeta
  // a quien se afilió antes de esta regla, y este proyecto ya decidió
  // que a nadie se le quitan los sellos que ganó.
  //
  // No es un 403: se lo devuelve a SU pantalla, la del QR, donde está
  // el formulario con lo que ya se sabe precargado. `sin_identidad` es
  // exactamente el aviso que corresponde («contanos quién sos y te la
  // damos»), y es un código cerrado que ya existe.
  const afiliacion = await afiliacionDeQuienPide(db, identidad, {
    ranchoId,
    cuentaId: null,
  });
  if (afiliacion.falta !== null) {
    console.warn(`[pases] ${ranchoId} → alta incompleta: falta ${afiliacion.falta}`);
    return pantallaDeProblema(pedido, ranchoId, "sin_identidad");
  }

  const resultado = await generarPaseDeLealtad({
    ranchoId,
    ...identidad,
    ahora: new Date(),
  });

  if (!resultado.ok) {
    // NUNCA un JSON crudo: el botón es un `<a href>` y el navegador
    // NAVEGA, así que un `NextResponse.json(..., {status:409})` le
    // pintaba al cliente, en pantalla blanca y en jerga de máquina,
    // «{"error":"El programa de este negocio está lleno por ahora"}».
    console.warn(`[pases] ${ranchoId} → ${resultado.codigo}: ${resultado.motivo}`);
    return pantallaDeProblema(pedido, ranchoId, resultado.codigo);
  }

  return new NextResponse(new Uint8Array(resultado.pkpass), {
    headers: {
      // Este tipo MIME es lo que hace que iOS ofrezca "Agregar a
      // Wallet" en vez de descargar un archivo que nadie sabe abrir.
      "content-type": "application/vnd.apple.pkpass",
      "content-disposition": `attachment; filename="tarjeta-${resultado.serialNumber}.pkpass"`,
      "cache-control": "no-store",
    },
  });
}
