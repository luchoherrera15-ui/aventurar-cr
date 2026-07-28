import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, plantillaRecordatorioEvento } from "@/lib/email";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";

/**
 * Recordatorios de evento — lo dispara el cron de Vercel una vez al
 * día (ver vercel.json). Busca las reservas confirmadas para MAÑANA
 * (hora de Costa Rica) que todavía no fueron avisadas, le escribe al
 * cliente y al proveedor, y las marca para no repetir.
 *
 * Corre con la service key (el cron no tiene sesión de usuario). Si
 * falta la key o la de Resend, responde explicando qué falta en vez
 * de fallar en silencio.
 */
export async function GET(request: Request) {
  // Vercel manda el header con CRON_SECRET si está configurado.
  const secreto = process.env.CRON_SECRET;
  if (secreto && request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno." },
      { status: 500 },
    );
  }

  const manana = sumarDiasISO(hoyISOCR(), 1);

  const { data, error } = await admin
    .from("reservas")
    .select(
      "id, fecha, nombre, correo, tipo_evento, invitados, rancho_id, ranchos(nombre, owner_id)",
    )
    .eq("estado", "confirmada")
    .eq("fecha", manana)
    .eq("recordatorio_enviado", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Fila = {
    id: string;
    fecha: string;
    nombre: string | null;
    correo: string | null;
    tipo_evento: string | null;
    invitados: number | null;
    rancho_id: string;
    ranchos: { nombre: string; owner_id: string } | null;
  };
  const reservas = (data ?? []) as unknown as Fila[];

  let enviados = 0;
  for (const r of reservas) {
    const nombreRancho = r.ranchos?.nombre ?? "tu evento";

    // Al cliente, al correo que dejó en la reserva.
    if (r.correo) {
      await enviarCorreo({
        to: r.correo,
        subject: `Mañana es tu evento en ${nombreRancho}`,
        html: plantillaRecordatorioEvento({
          nombreDestinatario: r.nombre || r.correo,
          nombreRancho,
          fecha: r.fecha,
          esProveedor: false,
          tipoEvento: r.tipo_evento,
          invitados: r.invitados,
        }),
      });
    }

    // Al proveedor, al correo de su cuenta.
    if (r.ranchos?.owner_id) {
      const { data: perfil } = await admin
        .from("perfiles")
        .select("nombre, email")
        .eq("id", r.ranchos.owner_id)
        .maybeSingle();
      if (perfil?.email) {
        await enviarCorreo({
          to: perfil.email,
          subject: `Mañana tenés un evento en ${nombreRancho}`,
          html: plantillaRecordatorioEvento({
            nombreDestinatario: perfil.nombre || perfil.email,
            nombreRancho,
            fecha: r.fecha,
            esProveedor: true,
            tipoEvento: r.tipo_evento,
            invitados: r.invitados,
          }),
        });
      }
    }

    await admin
      .from("reservas")
      .update({ recordatorio_enviado: true })
      .eq("id", r.id);
    enviados++;
  }

  return NextResponse.json({ fecha: manana, reservas: reservas.length, avisadas: enviados });
}
