import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";

/**
 * Auto-crédito contable del saldo pendiente el día del evento — lo
 * dispara el cron de Vercel una vez al día (ver vercel.json). No es un
 * cobro real (no hay pasarela ni tarjeta guardada): solo evita que el
 * proveedor tenga que entrar a marcar "ya me pagaron" a mano cada vez
 * que el evento se realiza como estaba agendado. Si un evento se
 * cancela ese mismo día, el proveedor puede revertirlo desde su panel
 * de Finanzas (revertirPagoFinal).
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
  const ahoraIso = new Date().toISOString();

  const { data, error } = await admin
    .from("reservas")
    .update({ evento_pagado: true, saldo_pagado_en: ahoraIso })
    .eq("estado", "confirmada")
    .eq("fecha", hoy)
    .eq("evento_pagado", false)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /**
   * De paso, la basura: las reservas "temporales" (los apartados de 15
   * minutos mientras alguien llena el formulario) que ya vencieron.
   *
   * Esto ANTES corría dentro del render de la página pública de cada
   * lugar (rancho-portal.tsx), o sea una ESCRITURA a la base por cada
   * visita de cada persona anónima: un viaje entero (~55 ms medidos)
   * sumado al TTFB de la página más lenta del sitio, y algo que hace
   * imposible cachearla. Sacarlo de ahí no cambia nada de lo que se ve:
   * la vista `disponibilidad_rancho` (migración 0072) ya filtra sola
   * las temporales vencidas con `expira_en > now()`. La fila igual hay
   * que borrarla para que la tabla no crezca sin control, y ese es
   * trabajo de un cron — este.
   */
  const { data: limpias } = await admin
    .from("reservas")
    .delete()
    .eq("estado", "temporal")
    .lt("expira_en", ahoraIso)
    .select("id");

  return NextResponse.json({
    fecha: hoy,
    acreditadas: data?.length ?? 0,
    temporalesVencidasBorradas: limpias?.length ?? 0,
  });
}
