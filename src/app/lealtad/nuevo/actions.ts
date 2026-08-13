"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { esPlan, definicionDe } from "@/lib/lealtad/planes";
import { avisarAAdministradores } from "@/lib/correo/administradores";

/**
 * La solicitud de ALTA (0130): acá el negocio NO se crea — se PIDE.
 *
 * La persona deja el nombre del negocio, el tipo (con «otro»), el
 * paquete que eligió y su depósito con comprobante. Todo eso viaja en
 * UNA fila de solicitudes_lealtad sin rancho: si el admin acepta desde
 * /admin/complementos, ahí recién nace el rancho (ya aprobado para
 * lealtad, con su plan y su complemento); si rechaza, no existe nada
 * que borrar.
 *
 * El INSERT va con la sesión del usuario: la política "Pedir el alta
 * de un negocio nuevo" exige firmar con el propio id, nacer pendiente
 * y traer nombre — y el unique parcial rebota el doble clic.
 */

const TIPOS = ["citas", "eventos", "hospedajes", "restaurantes", "otro"] as const;
export type TipoNegocio = (typeof TIPOS)[number];

type Resultado = { ok: true } | { ok: false; motivo: string };

export async function solicitarAltaConPlan(datos: {
  nombreNegocio: string;
  tipo: string;
  plan: string;
  metodoPago: string;
  comprobanteUrl: string;
  telefono: string;
  mensaje: string;
}): Promise<Resultado> {
  const nombre = datos.nombreNegocio.trim();
  if (!nombre || nombre.length > 80) {
    return { ok: false, motivo: "El nombre del negocio es obligatorio (máximo 80)." };
  }
  const tipo = (TIPOS as readonly string[]).includes(datos.tipo) ? datos.tipo : "otro";
  if (!esPlan(datos.plan)) return { ok: false, motivo: "Ese paquete no existe." };
  if (datos.metodoPago !== "sinpe" && datos.metodoPago !== "transferencia") {
    return { ok: false, motivo: "Elegí cómo pagaste: SINPE o transferencia." };
  }
  const bucketComprobantes = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprobantes/`;
  if (!datos.comprobanteUrl.startsWith(bucketComprobantes)) {
    return { ok: false, motivo: "Adjuntá la captura del depósito para enviar la solicitud." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión para enviar la solicitud." };

  const { error } = await supabase.from("solicitudes_lealtad").insert({
    rancho_id: null,
    solicitante_id: user.id,
    negocio_nombre: nombre,
    negocio_vertical: tipo,
    plan: datos.plan,
    metodo_pago: datos.metodoPago,
    comprobante_url: datos.comprobanteUrl,
    telefono: datos.telefono.trim().slice(0, 30) || null,
    mensaje: datos.mensaje.trim().slice(0, 500) || null,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        motivo: "Ya tenés una solicitud en revisión — te contactamos apenas la veamos.",
      };
    }
    if (/negocio_nombre|negocio_vertical/.test(error.message) && /schema cache|Could not find|does not exist/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0130 en Supabase." };
    }
    if (/metodo_pago|comprobante_url/.test(error.message) && /schema cache|Could not find|does not exist/i.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0128 en Supabase." };
    }
    if (error.code === "23502" && /rancho_id/.test(error.message)) {
      return { ok: false, motivo: "Falta correr la migración 0130 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo enviar: " + error.message };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();
  const quien = ((perfil?.nombre as string | null) ?? "").trim() || "(sin nombre)";
  const correo = user.email ?? "(sin correo)";
  const planNombre = definicionDe(datos.plan)?.nombre ?? datos.plan;

  after(() =>
    avisarAAdministradores({
      subject: `HAY UNA SOLICITUD DEL PASE DE LEALTAD — negocio NUEVO: ${nombre}`,
      html: `
        <h2 style="margin:0 0 12px">Alta de negocio + plan de lealtad</h2>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0"><b>Negocio (a crear)</b></td><td>${escapar(nombre)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Tipo</b></td><td>${escapar(tipo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Paquete</b></td><td>${escapar(planNombre)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Solicitante</b></td><td>${escapar(quien)} · ${escapar(correo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Teléfono</b></td><td>${escapar(datos.telefono.trim() || "—")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Pagó por</b></td><td>${escapar(datos.metodoPago)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Comprobante</b></td><td><a href="${escapar(datos.comprobanteUrl)}">ver la captura del depósito</a></td></tr>
        </table>
        <p style="margin:16px 0 0">
          Aceptar CREA el negocio con su plan; rechazar no crea nada. Se atiende en
          <a href="https://www.bookea.lat/admin/complementos">el panel de complementos</a>.
        </p>
      `,
    }),
  );

  return { ok: true };
}

function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
