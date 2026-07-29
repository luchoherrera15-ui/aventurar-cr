import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enviarCorreo,
  plantillaFindeLibre,
  plantillaPedirResena,
  plantillaRecordatorioEvento,
} from "@/lib/email";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";

/**
 * Los avisos diarios — lo dispara el cron de Vercel una vez al día
 * (ver vercel.json). Tres trabajos, cada uno con su bandera de
 * una-sola-vez:
 *
 *  1. Recordatorio T-1: reservas confirmadas para MAÑANA (hora de
 *     Costa Rica) → correo al cliente y al proveedor
 *     (recordatorio_enviado).
 *  2. Pedir reseña: eventos confirmados de AYER → "¿cómo te fue?
 *     calificá tu experiencia" al cliente (resena_solicitada).
 *  3. Finde libre: si un Lugar tiene libre un viernes/sábado/domingo
 *     que está a 2-3 días, se le avisa al dueño para que pueda poner
 *     un descuento y pelear esa fecha (avisos_finde_libre).
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

  // ---------- 2. Pedir reseña: los eventos de ayer ----------
  const ayer = sumarDiasISO(hoyISOCR(), -1);
  // El reclamo va DENTRO del update (una sola vez por reserva, aunque
  // el cron corra dos veces) — mismo patrón que los correos de reserva.
  const { data: paraResena } = await admin
    .from("reservas")
    .update({ resena_solicitada: true })
    .eq("estado", "confirmada")
    .eq("fecha", ayer)
    .eq("resena_solicitada", false)
    .not("correo", "is", null)
    .select("id, nombre, correo, ranchos(nombre)");

  let resenasPedidas = 0;
  for (const r of (paraResena ?? []) as unknown as {
    id: string;
    nombre: string | null;
    correo: string;
    ranchos: { nombre: string } | null;
  }[]) {
    const nombreRancho = r.ranchos?.nombre ?? "tu proveedor";
    await enviarCorreo({
      to: r.correo,
      subject: `¿Cómo te fue con ${nombreRancho}? Dejá tu reseña`,
      html: plantillaPedirResena({
        nombreCliente: r.nombre || r.correo,
        nombreRancho,
      }),
    });
    resenasPedidas++;
  }

  // ---------- 3. Finde libre: viernes/sábado/domingo a 2-3 días ----------
  // Solo Lugares: son los que se reservan por fecha exclusiva y a los
  // que un finde vacío les duele. Se avisa una única vez por
  // (rancho, fecha) — avisos_finde_libre lleva el registro.
  const hoy = hoyISOCR();
  const candidatas = [sumarDiasISO(hoy, 2), sumarDiasISO(hoy, 3)].filter((f) => {
    const dow = new Date(f + "T00:00:00").getDay();
    return dow === 5 || dow === 6 || dow === 0; // vie, sáb, dom
  });

  let findesAvisados = 0;
  if (candidatas.length > 0) {
    const { data: lugares } = await admin
      .from("ranchos")
      .select("id, nombre, owner_id")
      .eq("categoria", "lugares")
      .eq("estado", "aprobado");

    const { data: ocupadas } = await admin
      .from("reservas")
      .select("rancho_id, fecha")
      .in("fecha", candidatas)
      .in("estado", ["pendiente", "confirmada"]);
    const ocupadaSet = new Set(
      (ocupadas ?? []).map((o) => `${o.rancho_id}:${o.fecha}`),
    );

    for (const lugar of (lugares ?? []) as {
      id: string;
      nombre: string;
      owner_id: string;
    }[]) {
      for (const fechaLibre of candidatas) {
        if (ocupadaSet.has(`${lugar.id}:${fechaLibre}`)) continue;

        // El insert es el reclamo: si ya se avisó de esta fecha, el
        // unique lo rechaza y no se repite el correo.
        const { error: yaAvisado } = await admin
          .from("avisos_finde_libre")
          .insert({ rancho_id: lugar.id, fecha: fechaLibre });
        if (yaAvisado) continue;

        const { data: perfil } = await admin
          .from("perfiles")
          .select("nombre, email")
          .eq("id", lugar.owner_id)
          .maybeSingle();
        if (!perfil?.email) continue;

        await enviarCorreo({
          to: perfil.email,
          subject: `${lugar.nombre}: este finde tenés una fecha libre`,
          html: plantillaFindeLibre({
            nombreProveedor: perfil.nombre || perfil.email,
            nombreRancho: lugar.nombre,
            fecha: fechaLibre,
          }),
        });
        findesAvisados++;
      }
    }
  }

  return NextResponse.json({
    fecha: manana,
    reservas: reservas.length,
    avisadas: enviados,
    resenasPedidas,
    findesAvisados,
  });
}
