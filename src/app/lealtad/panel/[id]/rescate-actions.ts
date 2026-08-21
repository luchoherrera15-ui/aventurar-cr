"use server";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL RESCATE — escribirle SOLO a los que dejaron de venir
 * ═══════════════════════════════════════════════════════════════════
 *
 * La pieza que convierte "tu panel te muestra quiénes desaparecieron"
 * en "el mensaje les llegó". Es la promesa de la landing («El cliente
 * que dejó de venir no se pierde solo») hecha acción.
 *
 * ── POR QUÉ NO USA `enviarMensajePromocional` ──────────────────────
 * Aquel guarda el mensaje EN EL PROGRAMA (`mensaje_promocional`) y
 * todos los pases de Apple lo re-renderizan: es un megáfono, le llega
 * también al cliente que vino ayer. Un rescate es lo contrario — un
 * mensaje para un SEGMENTO. Los dos canales que sí saben apuntar a
 * una persona:
 *
 *   · CORREO (Resend, la misma vía de los correos de hitos): le llega
 *     a cada miembro con correo conocido, resuelto por
 *     `correoDelMiembro` con la cadena de identidad de la 0138/0200.
 *   · GOOGLE WALLET: `enviarMensajeGoogle(miembroId, …)` es nativo
 *     por miembro.
 *
 * El pase de APPLE no tiene mensaje por miembro (el campo es del
 * programa), así que un cliente con iPhone y sin correo NO es
 * alcanzable individualmente. Eso no se esconde: el resultado dice
 * cuántos quedaron sin canal, con nombre y apellido del límite.
 *
 * ── EL CUPO ────────────────────────────────────────────────────────
 * Una campaña de rescate consume UNA notificación del cupo mensual
 * del paquete — igual que un anuncio general. Se cobra por campaña y
 * no por persona porque el cupo existe para limitar cuántas veces al
 * mes el negocio interrumpe a su gente, no a cuántas personas.
 */

import { verificarAccesoLealtad } from "@/lib/auth";
import { enlacesBaja } from "@/lib/correo/baja";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo } from "@/lib/email";
import { correoDelMiembro } from "@/lib/correo/sello-acreditado";
import { enviarMensajeGoogle } from "@/lib/wallet/google";
import {
  liberarCupoNotificacion,
  reservarCupoNotificacion,
} from "@/lib/lealtad/cupo-notificaciones";
import { esRescatable } from "@/lib/lealtad/ciclo-cliente";
import { cargarClientesAuditados } from "./clientes-datos";

/** Mismo patrón que `marketing-actions.ts`: solo el dueño o un admin
 *  de la plataforma pueden mandar un rescate. Un colaborador con
 *  acceso al mostrador NO decide a quién se le escribe. */
async function accesoDeNegocio(ranchoId: string) {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) return { ok: false as const, motivo: "Iniciá sesión de nuevo." };
  if (!acceso.esDueno && !acceso.esAdmin) {
    return { ok: false as const, motivo: "Esto lo maneja el dueño del negocio." };
  }
  return { ok: true as const, motivo: "" };
}

const TOPE_MENSAJE = 178;
/** Techo de destinatarios por campaña: un rescate es un segmento, no
 *  el padrón entero. Si alguien intenta mandarle a 500, eso es un
 *  anuncio general y tiene su propia pantalla (y su propio costo). */
const TOPE_DESTINATARIOS = 100;

export type ResultadoRescate =
  | {
      ok: true;
      correos: number;
      google: number;
      /** Miembros a los que NO les llegó por ningún canal directo. */
      sinCanal: number;
    }
  | { ok: false; motivo: string };

export async function enviarRescate(
  ranchoId: string,
  programaId: string,
  miembroIds: string[],
  mensaje: string,
): Promise<ResultadoRescate> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // El programa tiene que ser de ESTE negocio — `programaId` llega del
  // navegador y `programa_lealtad` es legible por anon: sin esto, un
  // dueño podía mandarle "volvé" a los clientes de otro.
  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const limpio = mensaje.trim().slice(0, TOPE_MENSAJE);
  if (limpio.length < 3) {
    return { ok: false, motivo: "Escribí el mensaje que les querés mandar." };
  }

  const idsPedidos = [...new Set(miembroIds)].slice(0, TOPE_DESTINATARIOS);
  if (idsPedidos.length === 0) {
    return { ok: false, motivo: "Elegí al menos un cliente." };
  }

  // ── Los destinatarios, RE-VERIFICADOS en el servidor ─────────────
  // La lista llega del navegador; acá se vuelve a clasificar a cada
  // uno y solo pasan los que de verdad están en un tramo rescatable
  // (en riesgo o dormidos) Y pertenecen a este programa. Sin esto, el
  // formulario podía colar activos (spam) o ids ajenos.
  const datos = await cargarClientesAuditados(programaId, null);
  if (!datos) return { ok: false, motivo: "No se pudieron cargar los clientes." };

  const rescatables = new Map(
    datos.clientes.filter((c) => esRescatable(c.tramo)).map((c) => [c.miembroId, c]),
  );
  const destinatarios = idsPedidos
    .map((id) => rescatables.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  if (destinatarios.length === 0) {
    return {
      ok: false,
      motivo:
        "Ninguno de los elegidos está en un tramo rescatable — puede que ya hayan vuelto. Recargá la lista.",
    };
  }

  // ── El cupo: una campaña = una notificación del mes ──────────────
  const { data: rancho } = await db
    .from("ranchos")
    .select("plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  const plan = (rancho?.plan_lealtad as string | null) ?? null;
  const reserva = await reservarCupoNotificacion(db, ranchoId, programaId, plan);
  if (!reserva.reservado) {
    const limite = reserva.limite ?? 0;
    return {
      ok: false,
      motivo: `Ya usaste ${limite === 1 ? "tu notificación" : `tus ${limite} notificaciones`} de este mes. El rescate cuenta como una campaña — el cupo vuelve a abrirse el 1.º del próximo mes.`,
    };
  }

  // ── El nombre del negocio, para el asunto del correo ─────────────
  const { data: negocio } = await db
    .from("ranchos")
    .select("nombre")
    .eq("id", ranchoId)
    .maybeSingle();
  const negocioNombre = ((negocio?.nombre as string | null) ?? "Tu negocio").trim();

  let correos = 0;
  let google = 0;
  let sinCanal = 0;

  for (const cliente of destinatarios) {
    let llego = false;

    const correo = await correoDelMiembro(db, cliente.miembroId);
    if (correo) {
      const saludo = cliente.sinNombre ? "¡Hola!" : `¡Hola, ${cliente.nombre.split(" ")[0]}!`;
      const saldoLinea =
        cliente.saldo > 0
          ? `<p style="margin:14px 0 0;color:#374151;font-size:15px;line-height:1.6">Tus <strong>${cliente.saldo} sello${cliente.saldo === 1 ? "" : "s"}</strong> siguen guardados${cliente.faltan !== null && cliente.faltan > 0 ? ` — te falta${cliente.faltan === 1 ? "" : "n"} ${cliente.faltan} para tu recompensa` : ""}.</p>`
          : "";
      // Enlace de baja: es un correo de MARKETING (rescate, no
      // transaccional) y el destinatario tiene que poder cortarlo con
      // un clic — RFC 8058, misma vía que las campañas de citas.
      const baja = enlacesBaja(correo, ranchoId);
      const pieBaja = baja
        ? `<p style="margin:10px 0 0;color:#9ca3af;font-size:11px"><a href="${baja.pagina}" style="color:#9ca3af">Dejar de recibir estos avisos</a></p>`
        : "";
      const envio = await enviarCorreo({
        to: correo,
        subject: `${negocioNombre} — te extrañamos`,
        html: `
          <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px 22px">
            <p style="margin:0;color:#111827;font-size:16px;font-weight:700">${saludo}</p>
            <p style="margin:14px 0 0;color:#374151;font-size:15px;line-height:1.6">${limpio}</p>
            ${saldoLinea}
            <p style="margin:22px 0 0;color:#6b7280;font-size:12.5px">${negocioNombre}, con Bookea Lealtad. Tu tarjeta sigue en tu Wallet — mostrala en tu próxima visita.</p>
            ${pieBaja}
          </div>`,
        bajaOneClickUrl: baja?.oneClick,
      });
      if (envio.enviado) {
        correos += 1;
        llego = true;
      }
    }

    if (cliente.conPase) {
      const envioGoogle = await enviarMensajeGoogle(cliente.miembroId, limpio);
      if (envioGoogle.ok) {
        google += 1;
        llego = true;
      }
    }

    if (!llego) sinCanal += 1;
  }

  if (correos === 0 && google === 0) {
    // No salió NADA: se devuelve el cupo. Cobrarle la campaña del mes
    // a un envío que no llegó a nadie sería cobrar por el intento.
    await liberarCupoNotificacion(db, reserva.id);
    return {
      ok: false,
      motivo:
        "No se pudo entregar a nadie: los elegidos no tienen correo conocido ni pase de Google. A los de pase de Apple sin correo no hay forma de escribirles individualmente.",
    };
  }

  return { ok: true, correos, google, sinCanal };
}

/**
 * Guardar el RITMO del negocio (cada cuánto vuelve un cliente sano).
 * Es la perilla de la que cuelgan los tramos; vive en el jsonb
 * `configuracion` del programa para no pedir migración.
 */
export async function guardarRitmo(
  ranchoId: string,
  programaId: string,
  ritmo: string,
): Promise<{ ok: boolean; motivo?: string }> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  if (!["diario", "semanal", "quincenal", "mensual"].includes(ritmo)) {
    return { ok: false, motivo: "Ese ritmo no existe." };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id, configuracion")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const configuracion = {
    ...((programa.configuracion as Record<string, unknown> | null) ?? {}),
    ritmo_clientes: ritmo,
  };
  const { error } = await db
    .from("programa_lealtad")
    .update({ configuracion })
    .eq("id", programaId);
  if (error) return { ok: false, motivo: "No se pudo guardar. Intentá de nuevo." };
  return { ok: true };
}

/**
 * La línea de tiempo de UN cliente, para la ficha de auditoría. Server
 * action y no consulta del componente porque la ficha se abre desde el
 * cliente (dialog) sin recargar la página.
 */
export async function auditarCliente(
  ranchoId: string,
  programaId: string,
  miembroId: string,
): Promise<
  | { ok: true; eventos: Awaited<ReturnType<typeof import("./clientes-datos").lineaDeTiempo>> }
  | { ok: false; motivo: string }
> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const { lineaDeTiempo } = await import("./clientes-datos");
  const eventos = await lineaDeTiempo(programaId, miembroId);
  if (eventos === null) return { ok: false, motivo: "Ese cliente no es de esta tarjeta." };
  return { ok: true, eventos };
}
