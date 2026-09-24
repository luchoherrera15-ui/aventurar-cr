"use server";

import { revalidatePath } from "next/cache";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { celebracionPorId } from "@/lib/celebrar/datos";
import { traducirErrorDeBase } from "@/lib/celebrar/errores-base";
import { PREFIJO_CELEBRAR, RUTA, rutaEditor } from "@/lib/celebrar/rutas";
import { origenDeLaPeticion, prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";
import { paquetePublico } from "@/lib/celebrar/creditos";
import { conPrefijo, urlPublicaCelebrar } from "@/lib/celebrar/dominios";
import { abrirCheckoutDeCreditos, sePuedenComprarCreditos } from "@/lib/celebrar/pagos/checkout-creditos";
import { costoDePublicar } from "@/lib/celebrar/publicacion";
import { createClient } from "@/lib/supabase/server";

/** `pagarEn`: la invitación a medida se paga al pedirla; el navegador va a Stripe. */
export type ResultadoAyuda = { ok: true; pagarEn?: string } | { ok: false; mensaje: string };

const ALCANCES = new Set(["ajustes", "rediseno", "a_medida"]);

/**
 * «¿NO ESTÁS CONTENTO CON TU DISEÑO?» — el pedido al equipo.
 *
 * Guarda el pedido (tabla 0249) y avisa a los administradores por
 * correo con el link al editor de esa celebración, para que alguien del
 * equipo entre, mire y responda. Desde el admin (/app/admin/diseno) se
 * marca en proceso o atendido.
 */
export async function pedirAyudaDeDiseno(celebracionId: string | null, datos: { mensaje: string; contacto: string; alcance: string }): Promise<ResultadoAyuda> {
  const sesion = await sesionCelebrar();
  if (!sesion) return { ok: false, mensaje: "Hay que iniciar sesión." };
  const mensaje = datos.mensaje.trim().slice(0, 2000);
  if (mensaje.length < 5) return { ok: false, mensaje: "Contanos un poco qué te gustaría mejorar." };
  const contacto = datos.contacto.trim().slice(0, 120) || null;
  const alcance = ALCANCES.has(datos.alcance) ? datos.alcance : "ajustes";
  const c = celebracionId ? await celebracionPorId(celebracionId) : null;
  // La a medida (₡10 500, decisión del dueño del 24 sep 2026) se paga al
  // pedirla y queda atada a UNA celebración: sin ella no hay qué publicar.
  if (alcance === "a_medida" && !c) return { ok: false, mensaje: "Pedí la invitación a medida desde la celebración para la que es." };

  const supabase = await createClient();
  const { error } = await supabase.from("celebrar_ayuda_diseno").insert({
    owner_id: sesion.id,
    celebracion_id: c?.id ?? null,
    mensaje,
    contacto,
    alcance,
  });
  if (error) return { ok: false, mensaje: traducirErrorDeBase(error.message, error.code).mensaje ?? error.message };

  // El aviso al equipo: nunca lanza (si Resend no está, el pedido igual queda en la bandeja).
  const editor = c ? urlPublicaCelebrar(rutaEditor(c.id)) : null;
  try {
    await avisarAAdministradores({
      subject: `CELEBRAR · pedido de ayuda de diseño${c ? ` · ${c.nombre}` : ""}`,
      html: [
        `<p><strong>${escapar(sesion.nombre ?? sesion.email ?? "Alguien")}</strong> (${escapar(sesion.email ?? "sin correo")}) pide ayuda con su diseño.</p>`,
        c ? `<p>Celebración: <strong>${escapar(c.nombre)}</strong> · ${editor ? `<a href="${editor}">abrir el editor</a>` : ""}</p>` : "",
        `<p>Alcance: ${alcance === "a_medida" ? "que el equipo la haga a medida (₡10 500, pago con tarjeta en curso: confirmalo en la bandeja antes de empezar)" : alcance === "rediseno" ? "un rediseño completo" : "ajustes al diseño actual"}</p>`,
        `<p style="white-space:pre-line">${escapar(mensaje)}</p>`,
        contacto ? `<p>Contacto: ${escapar(contacto)}</p>` : "",
        `<p><a href="${urlPublicaCelebrar(RUTA.appAdminDiseno)}">Ver la bandeja de pedidos</a></p>`,
      ].join(""),
    });
  } catch (e) {
    console.error("[celebrar] aviso de ayuda de diseño:", e);
  }

  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");

  // A medida: al pago. Si ya estaba pagada como a medida, no se cobra de nuevo.
  if (alcance === "a_medida" && c) {
    const { costo } = await costoDePublicar(supabase, c);
    if (costo === 0) return { ok: true };
    const paquete = paquetePublico("medida");
    const [prefijo, origen] = await Promise.all([prefijoDeLaPeticion(), origenDeLaPeticion()]);
    if (!paquete || !sePuedenComprarCreditos()) return { ok: true };
    const r = await abrirCheckoutDeCreditos({
      ownerId: sesion.id,
      correo: sesion.email,
      paquete,
      volverA: `${origen}${conPrefijo(RUTA.appPago, prefijo)}?c=${c.id}&accion=medida`,
    });
    if (!r.ok) return { ok: false, mensaje: `Guardamos tu pedido, pero no se pudo abrir el pago: ${r.motivo}` };
    return { ok: true, pagarEn: r.url };
  }
  return { ok: true };
}

function escapar(t: string): string {
  return t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}
