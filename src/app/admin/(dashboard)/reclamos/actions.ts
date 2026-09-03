"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo } from "@/lib/email";

/**
 * ════════════════════════════════════════════════════════════════════
 *  RESOLVER UN RECLAMO — y el traspaso, que es lo delicado
 * ════════════════════════════════════════════════════════════════════
 *
 * Aprobar un reclamo le entrega a una persona la ficha de un negocio
 * real: su agenda, sus reservas, sus clientes. Es la acción más
 * peligrosa del panel, y por eso está escrita para fallar RUIDOSAMENTE
 * en vez de hacer algo a medias.
 */

export type ResultadoReclamo = { error: string | null; aviso?: string };

/**
 * Busca la cuenta de Bookea con ese correo.
 *
 * ⚠️ NO CREA LA CUENTA. Crear un usuario con una contraseña inventada
 * para entregarle un negocio real deja una puerta abierta que nadie va
 * a recordar cerrar — el mismo criterio que ya usan los seeds de
 * negocios reales (ver `scripts/seed-glow-nails.mjs`).
 *
 * Si no existe, se le dice al admin que la persona tiene que
 * registrarse primero. Es un paso más y es el correcto: así el acceso
 * lo crea quien lo va a usar, con su propia contraseña.
 */
async function buscarCuenta(correo: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const buscado = correo.trim().toLowerCase();

  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const u = data.users.find((x) => (x.email || "").toLowerCase() === buscado);
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Aprueba el reclamo Y traspasa el negocio.
 *
 * Las dos cosas juntas a propósito: un reclamo «aprobado» cuyo negocio
 * sigue en nuestra cuenta es peor que uno pendiente — parece atendido y
 * la persona sigue sin poder entrar.
 */
export async function aprobarReclamo(id: string): Promise<ResultadoReclamo> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { data: reclamo, error: errLeer } = await supabase
    .from("reclamos_negocio")
    .select("id, rancho_id, correo, nombre, estado, ranchos(nombre, slug)")
    .eq("id", id)
    .maybeSingle();

  if (errLeer) return { error: errLeer.message };
  if (!reclamo) return { error: "Ese reclamo ya no existe." };
  if (reclamo.estado !== "pendiente") {
    return { error: "Ese reclamo ya estaba resuelto." };
  }

  const nuevoDueno = await buscarCuenta(reclamo.correo);
  if (!nuevoDueno) {
    return {
      error:
        `No hay ninguna cuenta de Bookea con ${reclamo.correo}. ` +
        `Pedile que se registre con ESE correo y volvé a aprobar — no se le crea la cuenta desde acá a propósito.`,
    };
  }

  // ⚠️ PRIMERO EL TRASPASO, DESPUÉS EL ESTADO. Si se hiciera al revés y
  // el traspaso fallara, el reclamo quedaría marcado como aprobado y
  // nadie volvería a mirarlo.
  const { error: errTraspaso } = await supabase
    .from("ranchos")
    .update({ owner_id: nuevoDueno })
    .eq("id", reclamo.rancho_id);

  if (errTraspaso) {
    return { error: "No se pudo traspasar el negocio: " + errTraspaso.message };
  }

  const { error: errEstado } = await supabase
    .from("reclamos_negocio")
    .update({
      estado: "aprobado",
      resuelto_en: new Date().toISOString(),
    })
    .eq("id", id);

  if (errEstado) {
    // El negocio YA cambió de dueño. Se dice, en vez de fingir que no
    // pasó nada: el admin tiene que saber que la parte importante se
    // hizo y que lo único pendiente es la marca en la bandeja.
    return {
      error:
        "El negocio se traspasó bien, pero no se pudo marcar el reclamo como aprobado: " +
        errEstado.message,
    };
  }

  const negocio = reclamo.ranchos as unknown as { nombre: string; slug: string | null } | null;
  const nombreNegocio = negocio?.nombre ?? "tu negocio";

  // El aviso a la persona. Si falla, el traspaso ya está hecho — no se
  // deshace nada por un correo.
  let aviso: string | undefined;
  try {
    const r = await enviarCorreo({
      to: reclamo.correo,
      subject: `Ya podés administrar ${nombreNegocio} en Bookea`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
          <h2 style="margin:0 0 8px;font-size:18px">Listo, ${nombreNegocio} es tuyo</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#444">
            Confirmamos que sos el dueño y te pasamos la ficha. Entrá con
            <strong>${reclamo.correo}</strong> y vas a poder cambiar las fotos, los
            servicios, los precios y los horarios.
          </p>
          <p style="margin:0">
            <a href="https://www.bookea.lat/mi-negocio"
               style="display:inline-block;background:#16295e;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700;font-size:14px">
              Ir a mi negocio
            </a>
          </p>
        </div>
      `,
    });
    if (!r.enviado) aviso = "El negocio se traspasó, pero el correo de aviso no salió.";
  } catch {
    aviso = "El negocio se traspasó, pero el correo de aviso no salió.";
  }

  revalidatePath("/admin/reclamos");
  revalidatePath("/admin/negocios");
  return { error: null, aviso };
}

/** Rechaza un reclamo. No toca el negocio. */
export async function rechazarReclamo(id: string, nota: string): Promise<ResultadoReclamo> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase
    .from("reclamos_negocio")
    .update({
      estado: "rechazado",
      resuelto_en: new Date().toISOString(),
      nota_interna: nota.trim().slice(0, 500) || null,
    })
    .eq("id", id)
    .eq("estado", "pendiente");

  if (error) return { error: error.message };

  revalidatePath("/admin/reclamos");
  return { error: null };
}
