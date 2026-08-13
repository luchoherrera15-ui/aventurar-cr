"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { definicionDe, esPlan } from "@/lib/lealtad/planes";
import { avisarAAdministradores } from "@/lib/correo/administradores";

/** El plan Gratis no lleva depósito: sin método ni comprobante. */
function esGratis(plan: string): boolean {
  return definicionDe(plan)?.precioMensual === 0;
}

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
  /** Si el tipo es «otro»: qué negocio es, en sus palabras. */
  detalleOtro: string;
  plan: string;
  metodoPago: string;
  comprobanteUrl: string;
  telefono: string;
  /** true = «Crear personalizado»: queda en espera, el equipo diseña. */
  personalizado: boolean;
  /** La descripción del diseño soñado (solo personalizado). */
  descripcion: string;
  /** Lo del CREADOR (solo cuando NO es personalizado): */
  paseColor: string;
  /** El logo subido (opcional, "" = sin logo). */
  paseLogoUrl: string;
  regalia: string;
  metaSellos: number;
}): Promise<Resultado> {
  const nombre = datos.nombreNegocio.trim();
  if (!nombre || nombre.length > 80) {
    return { ok: false, motivo: "El nombre del negocio es obligatorio (máximo 80)." };
  }
  const tipo = (TIPOS as readonly string[]).includes(datos.tipo) ? datos.tipo : "otro";
  const detalle = tipo === "otro" ? datos.detalleOtro.trim().slice(0, 80) : "";
  if (tipo === "otro" && !detalle) {
    return { ok: false, motivo: "Contanos qué negocio es." };
  }
  if (!esPlan(datos.plan)) return { ok: false, motivo: "Ese paquete no existe." };

  const descripcion = datos.descripcion.trim().slice(0, 500);
  const regalia = datos.regalia.trim().slice(0, 120);
  if (datos.personalizado) {
    if (descripcion.length < 5) {
      return { ok: false, motivo: "Contanos cómo soñás la tarjeta (unas palabras alcanzan)." };
    }
  } else {
    if (!/^#[0-9a-fA-F]{6}$/.test(datos.paseColor)) {
      return { ok: false, motivo: "Elegí el color de tu tarjeta." };
    }
    if (!regalia) return { ok: false, motivo: "Contanos qué regalía vas a dar." };
    if (!Number.isInteger(datos.metaSellos) || datos.metaSellos < 1 || datos.metaSellos > 100) {
      return { ok: false, motivo: "La meta de sellos tiene que estar entre 1 y 100." };
    }
    // El logo es opcional, pero si viene tiene que ser de NUESTRO
    // storage — no una URL cualquiera que después sirva la tarjeta.
    const bucketPublico = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprobantes/`;
    if (datos.paseLogoUrl && !datos.paseLogoUrl.startsWith(bucketPublico)) {
      return { ok: false, motivo: "El logo no se subió bien — probá de nuevo." };
    }
  }

  const gratis = esGratis(datos.plan);
  if (!gratis) {
    if (datos.metodoPago !== "sinpe" && datos.metodoPago !== "transferencia") {
      return { ok: false, motivo: "Elegí cómo pagaste: SINPE o transferencia." };
    }
    const bucketComprobantes = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprobantes/`;
    if (!datos.comprobanteUrl.startsWith(bucketComprobantes)) {
      return { ok: false, motivo: "Adjuntá la captura del depósito para enviar la solicitud." };
    }
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
    negocio_detalle: detalle || null,
    plan: datos.plan,
    metodo_pago: gratis ? null : datos.metodoPago,
    comprobante_url: gratis ? null : datos.comprobanteUrl,
    telefono: datos.telefono.trim().slice(0, 30) || null,
    personalizado: datos.personalizado,
    // El personalizado viaja como texto libre; el creador, como datos
    // que la aprobación convierte en programa funcionando.
    mensaje: datos.personalizado ? descripcion : null,
    pase_color: datos.personalizado ? null : datos.paseColor,
    pase_logo_url: datos.personalizado ? null : datos.paseLogoUrl || null,
    regalia: datos.personalizado ? null : regalia,
    meta_sellos: datos.personalizado ? null : datos.metaSellos,
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
      subject: `HAY UNA SOLICITUD DEL PASE DE LEALTAD — negocio NUEVO${datos.personalizado ? " (PERSONALIZADO)" : ""}: ${nombre}`,
      html: `
        <h2 style="margin:0 0 12px">Alta de negocio + plan de lealtad</h2>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0"><b>Negocio (a crear)</b></td><td>${escapar(nombre)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Tipo</b></td><td>${escapar(tipo)}${detalle ? ` — ${escapar(detalle)}` : ""}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Paquete</b></td><td>${escapar(planNombre)}${gratis ? " (gratis, sin depósito)" : ""}</td></tr>
          ${
            datos.personalizado
              ? `<tr><td style="padding:4px 12px 4px 0"><b>Diseño</b></td><td><b>PERSONALIZADO, en espera</b> — «${escapar(descripcion)}»</td></tr>`
              : `<tr><td style="padding:4px 12px 4px 0"><b>Tarjeta</b></td><td>color ${escapar(datos.paseColor)} · regalía «${escapar(regalia)}» · ${datos.metaSellos} sellos — al aceptar queda FUNCIONANDO sola</td></tr>`
          }
          <tr><td style="padding:4px 12px 4px 0"><b>Solicitante</b></td><td>${escapar(quien)} · ${escapar(correo)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Teléfono</b></td><td>${escapar(datos.telefono.trim() || "—")}</td></tr>
          ${
            gratis
              ? ""
              : `<tr><td style="padding:4px 12px 4px 0"><b>Pagó por</b></td><td>${escapar(datos.metodoPago)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><b>Comprobante</b></td><td><a href="${escapar(datos.comprobanteUrl)}">ver la captura del depósito</a></td></tr>`
          }
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
