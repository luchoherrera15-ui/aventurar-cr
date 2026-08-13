"use server";

import { after } from "next/server";
import { definicionDe, esPlan } from "@/lib/lealtad/planes";
import { createClient } from "@/lib/supabase/server";
import { avisarAAdministradores } from "@/lib/correo/administradores";

/**
 * Dejar la solicitud de un paquete de lealtad (0126).
 *
 * El INSERT va con la sesión del usuario: la política "Pedir el plan
 * del propio negocio" exige que gestione el rancho y que firme con su
 * propio id — este archivo no decide permisos, los hereda.
 *
 * El aviso a Bookea sale en `after()` — después de responder, sin
 * frenar al que pide — y la FILA es la fuente de verdad: si el correo
 * se pierde, la solicitud sigue en /admin/complementos.
 */

type Resultado = { ok: true } | { ok: false; motivo: string };

export async function solicitarPlanLealtad(
  ranchoId: string,
  plan: string,
  telefono: string,
  mensaje: string,
  metodoPago: string,
  comprobanteUrl: string,
): Promise<Resultado> {
  if (!esPlan(plan)) return { ok: false, motivo: "Ese paquete no existe." };

  // El plan Gratis no lleva depósito; los demás sí, y el link tiene
  // que ser del NUESTRO bucket de comprobantes, no una URL cualquiera
  // que después abra un admin confiado desde el correo.
  const gratis = definicionDe(plan)?.precioMensual === 0;
  if (!gratis) {
    if (metodoPago !== "sinpe" && metodoPago !== "transferencia") {
      return { ok: false, motivo: "Elegí cómo pagaste: SINPE o transferencia." };
    }
    const bucketComprobantes = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprobantes/`;
    if (!comprobanteUrl.startsWith(bucketComprobantes)) {
      return { ok: false, motivo: "Adjuntá la captura del depósito para enviar la solicitud." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión para solicitar el plan." };

  // Un negocio en revisión (0129) no solicita nada: primero lo aprueba
  // un administrador. `select *` tolera bases sin la migración.
  const { data: ranchoRevision } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", ranchoId)
    .maybeSingle();
  if (
    ranchoRevision &&
    "lealtad_aprobado_en" in ranchoRevision &&
    ranchoRevision.lealtad_aprobado_en === null
  ) {
    return {
      ok: false,
      motivo: "Tu negocio está en revisión por Bookea — te avisamos al aprobarlo y ahí podés solicitar el plan.",
    };
  }

  const tel = telefono.trim().slice(0, 30);
  const msj = mensaje.trim().slice(0, 500);

  // Freno al spam: el unique parcial de la 0126 ya limita a UNA
  // pendiente por negocio, pero crear negocios es gratis — sin este
  // tope, un solo usuario puede inundar el correo de los admins.
  const { count } = await supabase
    .from("solicitudes_lealtad")
    .select("*", { count: "exact", head: true })
    .eq("solicitante_id", user.id)
    .eq("estado", "pendiente");
  if ((count ?? 0) >= 3) {
    return {
      ok: false,
      motivo: "Ya tenés 3 solicitudes en revisión — esperá a que atendamos esas primero.",
    };
  }

  const { error } = await supabase.from("solicitudes_lealtad").insert({
    rancho_id: ranchoId,
    solicitante_id: user.id,
    plan,
    telefono: tel || null,
    mensaje: msj || null,
    metodo_pago: gratis ? null : metodoPago,
    comprobante_url: gratis ? null : comprobanteUrl,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, motivo: "Ya hay una solicitud pendiente para este negocio — te contactamos pronto." };
    }
    if (error.code === "42501") {
      return { ok: false, motivo: "No administrás ese negocio." };
    }
    if (/metodo_pago|comprobante_url/.test(error.message) && /schema cache|Could not find|does not exist/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0128 en Supabase." };
    }
    if (/solicitudes_lealtad/.test(error.message) && /does not exist|schema cache|Could not find/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0126 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo enviar: " + error.message };
  }

  // Los datos del correo se juntan ANTES del after: acá todavía hay
  // sesión y cookies; adentro del after ya no hay request.
  const [{ data: rancho }, { data: perfil }] = await Promise.all([
    supabase.from("ranchos").select("nombre").eq("id", ranchoId).maybeSingle(),
    supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
  ]);

  const nombreNegocio = (rancho?.nombre as string | undefined) ?? "(negocio)";
  const nombrePersona = ((perfil?.nombre as string | undefined) ?? "").trim() || "(sin nombre)";
  const correo = user.email ?? "(sin correo)";

  after(() =>
    avisarAAdministradores({
      subject: `HAY UNA SOLICITUD DEL PASE DE LEALTAD — ${nombreNegocio}`,
      html: `
        <h2 style="margin:0 0 12px">Solicitud del programa de lealtad</h2>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0"><b>Negocio</b></td><td>${escapar(nombreNegocio)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Paquete pedido</b></td><td>${escapar(plan)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Solicitante</b></td><td>${escapar(nombrePersona)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Correo</b></td><td>${escapar(correo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Teléfono</b></td><td>${escapar(tel || "—")}</td></tr>
          ${
            gratis
              ? `<tr><td style="padding:4px 12px 4px 0"><b>Pago</b></td><td>plan gratis — sin depósito</td></tr>`
              : `<tr><td style="padding:4px 12px 4px 0"><b>Pagó por</b></td><td>${escapar(metodoPago)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Comprobante</b></td><td><a href="${escapar(comprobanteUrl)}">ver la captura del depósito</a></td></tr>`
          }
          <tr><td style="padding:4px 12px 4px 0"><b>Mensaje</b></td><td>${escapar(msj || "—")}</td></tr>
        </table>
        <p style="margin:16px 0 0">
          Se activa desde
          <a href="https://www.bookea.lat/admin/complementos">el panel de complementos</a>.
        </p>
      `,
    }),
  );

  return { ok: true };
}

/** Lo mínimo para que un nombre con <> no rompa (ni inyecte) el HTML. */
function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
