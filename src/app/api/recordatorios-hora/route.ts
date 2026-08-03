import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo } from "@/lib/email";
import { enviarPush } from "@/lib/push";
import { plantillaRecordatorioHoy } from "@/lib/correo/citas-fase2";
import { hoyISOCR, TZ_CR } from "@/lib/fechas";
import { instanteEnZona } from "@/lib/agenda/disponibilidad";
import { horaBonita, minutosAHora } from "@/app/citas/tipos";

/**
 * El recordatorio del MISMO día (pensado para correr cada hora): "tu
 * cita es hoy a las 2:30". Complementa al T-1 de /api/recordatorios
 * (que sale a las 8 am del día antes) — este agarra la ventana de 2 a
 * 3 horas antes de la cita, cuando el aviso todavía sirve para
 * reacomodar el día.
 *
 * SIN DISPARADOR por ahora: un cron de "0 * * * *" en vercel.json
 * rompía TODOS los deploys — Vercel Hobby solo permite crons diarios,
 * y rechaza el deploy entero (sin ni siquiera dejar rastro en la
 * lista de deployments) si vercel.json trae uno más frecuente. Hasta
 * que se conecte un disparador externo (ej. GitHub Actions cada hora,
 * con el mismo CRON_SECRET) o se suba a Vercel Pro, esta ruta existe
 * pero nadie la llama.
 *
 * Idempotencia: la bandera reservas.recordatorio_hora_enviado (0095)
 * se reclama DENTRO del mismo update que selecciona (patrón 0047) —
 * dos corridas simultáneas no duplican correos.
 *
 * Igual que el resto de los crons, trabaja en hora de Costa Rica
 * (decisión D-1): las citas guardan hora de pared local y CR no tiene
 * horario de verano.
 */
export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno." },
      { status: 500 },
    );
  }

  const hoy = hoyISOCR();
  const ahora = instanteEnZona(new Date().toISOString(), TZ_CR);
  // La ventana se ancla a la HORA EN PUNTO, no al minuto en que corrió
  // el cron: si Vercel dispara a las 11:04, la ventana sigue siendo
  // [13:00, 14:00) — así el drift del cron nunca abre huecos ni
  // traslapa con la corrida siguiente.
  const horaBase = Math.floor(ahora.minutos / 60);
  const desdeMin = (horaBase + 2) * 60;
  const hastaMin = desdeMin + 60;
  // Pasada la medianoche no hay nada que avisar hoy.
  if (desdeMin >= 24 * 60) {
    return NextResponse.json({ fecha: hoy, avisadas: 0 });
  }
  const desde = minutosAHora(desdeMin);
  const hasta = minutosAHora(Math.min(hastaMin, 24 * 60 - 1));

  type Fila = {
    id: string;
    nombre: string | null;
    correo: string | null;
    hora_inicio: string;
    tipo_evento: string | null;
    cliente_id: string | null;
    rancho_id: string;
    ranchos: { nombre: string; owner_id: string; vertical: string } | null;
  };

  // Dos fases A PROPÓSITO. En PostgREST, un filtro sobre un recurso
  // embebido dentro de un UPDATE filtra solo la representación que
  // vuelve — NUNCA las filas mutadas. Un update directo con
  // .eq("ranchos.vertical","citas") marcaría también los eventos con
  // hora (0067) de las demás verticales. Primero se LEEN las citas de
  // la ventana (ahí el filtro embebido con !inner sí es semántica
  // documentada)...
  const { data: candidatas, error } = await admin
    .from("reservas")
    .select(
      "id, nombre, correo, hora_inicio, tipo_evento, cliente_id, rancho_id, ranchos!inner(nombre, owner_id, vertical)",
    )
    .eq("estado", "confirmada")
    .eq("fecha", hoy)
    .eq("recordatorio_hora_enviado", false)
    .not("hora_inicio", "is", null)
    .gte("hora_inicio", desde)
    .lt("hora_inicio", hasta)
    .eq("ranchos.vertical", "citas");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const filas = (candidatas ?? []) as unknown as Fila[];
  if (filas.length === 0) {
    return NextResponse.json({ fecha: hoy, ventana: `${desde}–${hasta}`, avisadas: 0 });
  }

  // ...y el reclamo va en un update SOLO por ids con filtros de la
  // propia tabla (patrón claim-inside-update de 0047): dos corridas
  // simultáneas se reparten las filas sin duplicar correos.
  const { data: reclamadas, error: errorReclamo } = await admin
    .from("reservas")
    .update({ recordatorio_hora_enviado: true })
    .in("id", filas.map((f) => f.id))
    .eq("recordatorio_hora_enviado", false)
    .select("id");
  if (errorReclamo) {
    return NextResponse.json({ error: errorReclamo.message }, { status: 500 });
  }
  const ganadas = new Set((reclamadas ?? []).map((r) => r.id as string));

  let avisadas = 0;
  for (const r of filas.filter((f) => ganadas.has(f.id))) {
    const nombreNegocio = r.ranchos?.nombre ?? "tu cita";
    const hora = horaBonita(String(r.hora_inicio).slice(0, 5));

    if (r.correo) {
      await enviarCorreo({
        to: r.correo,
        subject: `Hoy a las ${hora}: tu cita en ${nombreNegocio}`,
        html: plantillaRecordatorioHoy({
          nombreDestinatario: r.nombre || r.correo,
          nombreNegocio,
          hora,
          servicio: r.tipo_evento,
          esProveedor: false,
        }),
      });
    }
    await enviarPush({
      usuarios: [r.cliente_id],
      titulo: `Hoy a las ${hora}: ${nombreNegocio}`,
      cuerpo: `${r.tipo_evento ?? "Tu cita"} es en unas horas. Si no podés llegar, avisá por el chat.`,
      data: { url: "/?tab=reservas" },
    });
    avisadas++;
  }

  return NextResponse.json({ fecha: hoy, ventana: `${desde}–${hasta}`, avisadas });
}
