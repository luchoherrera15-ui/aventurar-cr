import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { configMeta } from "@/lib/instagram/config";
import { cuentasPorRefrescar, refrescarSiToca } from "@/lib/instagram/cuentas";

/**
 * GET /api/instagram/refrescar-tokens — EL CRON DE LOS TOKENS.
 *
 * Meta: el token largo dura 60 días y se refresca si tiene ≥24 h y no
 * venció. Esto recorre las cuentas activas que vencen dentro de 10 días
 * y las refresca. Protegido con CRON_SECRET como los demás crons.
 *
 * Para activarlo en Vercel hay que agregar a vercel.json:
 *   { "path": "/api/instagram/refrescar-tokens", "schedule": "0 9 * * *" }
 * (se deja documentado y no se toca vercel.json desde acá: es una
 * decisión del dueño). Mientras tanto, el panel también refresca al
 * abrirse si toca — ver instagram/page.tsx.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const bloqueo = autorizarCron(request);
  if (bloqueo) return bloqueo;
  const cfg = configMeta();
  if (!cfg) return NextResponse.json({ ok: false, motivo: "Instagram sin configurar" }, { status: 503 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, motivo: "Sin llave de servicio" }, { status: 500 });

  const ids = await cuentasPorRefrescar(admin);
  const conteo: Record<string, number> = {};
  for (const id of ids) {
    const r = await refrescarSiToca(admin, cfg, id);
    conteo[r] = (conteo[r] ?? 0) + 1;
  }
  return NextResponse.json({ ok: true, revisadas: ids.length, ...conteo });
}
