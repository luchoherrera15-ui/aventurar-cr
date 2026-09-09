"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo } from "@/lib/email";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { hoyISOCR } from "@/lib/fechas";
import { fechaLargaReunion, horaCorta, horarioValido } from "@/lib/lealtad/reuniones";

/**
 * ════════════════════════════════════════════════════════════════════
 *  PROGRAMAR UNA REUNIÓN CON BOOKEA — desde el alta de Lealtad
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (8 sep 2026): «¿Necesitás ayuda para configurar el
 * sistema? → una agenda pequeña donde la persona elija día y hora;
 * la vemos en el admin y nos llega un correo».
 *
 * Escribe con la llave de servicio DESPUÉS de validar todo acá: la
 * tabla (0240) no tiene política de inserción para clientes, así que
 * la única puerta es esta action. Lo que se acepta es exactamente lo
 * que el formulario ofrece (`horarioValido`): mañana en adelante, lunes
 * a sábado, medias horas de 9:00 a 16:30, y un horario que nadie tomó.
 */

export type DatosReunion = {
  nombre: string;
  correo: string;
  telefono: string;
  negocio: string;
  fecha: string;
  hora: string;
  notas: string;
  /** El «panal»: un campo oculto que un humano deja vacío. */
  panal?: string;
};

export type ResultadoReunion = { ok: true; id: string; fechaLarga: string; hora: string } | { ok: false; motivo: string };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Las horas ya tomadas de un día (para pintarlas apagadas). */
export async function horasOcupadasReunion(fecha: string): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return [];
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("reuniones_lealtad").select("hora").eq("fecha", fecha).in("estado", ["pendiente", "confirmada"]);
  return (data ?? []).map((r) => horaCorta(String(r.hora)));
}

export async function programarReunionLealtad(d: DatosReunion): Promise<ResultadoReunion> {
  if (d.panal) return { ok: true, id: "ok", fechaLarga: "", hora: "" }; // un bot: se le dice que sí y no pasa nada

  const nombre = (d.nombre ?? "").trim().slice(0, 80);
  const correo = (d.correo ?? "").trim().toLowerCase().slice(0, 160);
  const telefono = (d.telefono ?? "").replace(/\D/g, "").slice(0, 20);
  const negocio = (d.negocio ?? "").trim().slice(0, 80);
  const notas = (d.notas ?? "").trim().slice(0, 500);
  const fecha = (d.fecha ?? "").trim();
  const hora = (d.hora ?? "").trim();

  if (nombre.length < 2) return { ok: false, motivo: "Decinos tu nombre." };
  if (!CORREO.test(correo)) return { ok: false, motivo: "Ese correo no parece válido." };
  if (telefono && (telefono.length < 8 || telefono.length > 15)) return { ok: false, motivo: "El WhatsApp tiene que tener entre 8 y 15 dígitos." };
  if (!horarioValido(hoyISOCR(), fecha, hora)) return { ok: false, motivo: "Elegí un día y una hora de la agenda." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "Falta la llave de servicio en el servidor." };

  // Si hay sesión, la reunión queda ligada a la cuenta (para el admin).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await admin
    .from("reuniones_lealtad")
    .insert({ nombre, correo, telefono: telefono || null, negocio: negocio || null, fecha, hora, notas: notas || null, user_id: user?.id ?? null })
    .select("id")
    .single();
  if (error) {
    // El índice único: alguien tomó ese horario un segundo antes.
    if (error.code === "23505") return { ok: false, motivo: "Ese horario se acaba de ocupar. Elegí otro." };
    if (error.message.includes("reuniones_lealtad")) return { ok: false, motivo: "Falta aplicar la migración 0240 para agendar reuniones." };
    return { ok: false, motivo: "No se pudo agendar. Probá de nuevo en un momento." };
  }

  const fechaLarga = fechaLargaReunion(fecha);
  const cuando = `${fechaLarga}, ${hora} (hora de Costa Rica)`;
  const sitio = process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat";

  // ── Los correos: a Bookea (todos los admins) y a la persona ──────
  // Fallan en silencio: la reunión ya quedó guardada y se ve en el
  // admin aunque el correo no salga.
  const filaHtml = (k: string, v: string) => `<tr><td style="padding:6px 12px 6px 0;color:#53657f;font-size:13px">${k}</td><td style="padding:6px 0;font-size:14px;font-weight:700;color:#10203a">${v}</td></tr>`;
  const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  await Promise.all([
    avisarAAdministradores({
      subject: `Nueva reunión de Lealtad: ${nombre} · ${fechaLarga} ${hora}`,
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
        <h2 style="margin:0 0 6px;font-size:20px;color:#062653">Alguien pidió ayuda para armar su tarjeta</h2>
        <p style="margin:0 0 14px;color:#53657f;font-size:14px">Desde bookea.lat/lealtad eligió «Necesito ayuda» y programó una reunión.</p>
        <table style="border-collapse:collapse">
          ${filaHtml("Cuándo", escapar(cuando))}
          ${filaHtml("Nombre", escapar(nombre))}
          ${filaHtml("Correo", escapar(correo))}
          ${filaHtml("WhatsApp", telefono ? escapar(telefono) : "—")}
          ${filaHtml("Negocio", negocio ? escapar(negocio) : "—")}
          ${notas ? filaHtml("Notas", escapar(notas)) : ""}
        </table>
        <p style="margin:18px 0 0"><a href="${sitio}/admin/reuniones" style="display:inline-block;background:#062653;color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:12px;font-size:14px">Ver la agenda en el admin →</a></p>
      </div>`,
    }).catch((e) => console.error("[reuniones] aviso a admins falló:", e)),
    enviarCorreo({
      to: correo,
      subject: `Tu reunión con Bookea: ${fechaLarga} a las ${hora}`,
      html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
        <h2 style="margin:0 0 6px;font-size:20px;color:#062653">¡Listo, ${escapar(nombre)}! Quedó programada.</h2>
        <p style="margin:0 0 14px;font-size:15px;color:#10203a">Nos vemos el <b>${escapar(cuando)}</b>. Te contactamos por WhatsApp o correo unos minutos antes para conectarnos.</p>
        <p style="margin:0 0 14px;color:#53657f;font-size:14px">En la reunión armamos juntos tu tarjeta de lealtad: tipo, colores, premio y el QR para tu local. Dura unos 30 minutos.</p>
        <p style="margin:0;color:#53657f;font-size:13px">Si necesitás cambiarla, respondé este correo.</p>
      </div>`,
    }).catch((e) => console.error("[reuniones] correo al cliente falló:", e)),
  ]);

  return { ok: true, id: data.id as string, fechaLarga, hora };
}
