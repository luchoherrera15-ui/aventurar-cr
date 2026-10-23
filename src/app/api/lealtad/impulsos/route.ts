import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { crearCanalesReales } from "@/lib/lealtad/impulsos/canales";
import { correrImpulsos } from "@/lib/lealtad/impulsos/motor";
import { crearRepoSupabase } from "@/lib/lealtad/impulsos/repositorio";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * LA PUERTA DE LOS IMPULSOS AUTOMÁTICOS (0254).
 *
 * El trabajo de verdad vive en `src/lib/lealtad/impulsos/motor.ts`; acá solo se verifica el secreto, se
 * cablea el motor con Supabase y con los canales reales, y se devuelve el resumen.
 *
 * EL DISPARADOR ES GITHUB ACTIONS (`.github/workflows/impulsos-lealtad.yml`, cada 5 minutos), no
 * `vercel.json`: en el plan Hobby Vercel solo acepta crons diarios y RECHAZA EL DEPLOY ENTERO si
 * `vercel.json` trae uno más frecuente. Ver el mismo comentario en `/api/lealtad/campanas`.
 *
 * Qué esperar de la puntualidad: GitHub puede retrasar una corrida programada varios minutos, o saltarse
 * una. Un mensaje «5 minutos después» sale, en la práctica, entre 5 y ~15 minutos después. Una corrida
 * perdida no pierde nada: las tareas esperan en la base y las toma la siguiente.
 *
 * Correrlo de más no molesta: todo es idempotente (una tarea es única por impulso + hecho, y se toma con
 * `FOR UPDATE SKIP LOCKED`).
 *
 * Responde 200 aunque no haya hecho nada (falta la migración, no hay llave de servicio): el motivo viaja
 * en `nota`. Un cron que devuelve error cada 5 minutos por una variable que falta se vuelve ruido.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Habla con Apple, Google y Resend, de a unos pocos clientes a la vez. El motor deja de tomar tareas nuevas a
// los 45 segundos para terminar a tiempo; lo que quede lo toma la corrida siguiente.
export const maxDuration = 60;

/** Postgres: relación inexistente / PostgREST: no está en el caché del esquema. La migración 0254 no se corrió. */
function faltaLaMigracion(errores: string[]): boolean {
  return errores.some((e) => /42P01|PGRST205|impulsos_(eventos|tareas|lealtad)/.test(e) && /does not exist|schema cache|no existe|Could not find/i.test(e));
}

export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, nota: "Falta SUPABASE_SERVICE_ROLE_KEY: no se procesó nada." });
  }

  const resumen = await correrImpulsos(crearRepoSupabase(db), crearCanalesReales(db));
  const nota = faltaLaMigracion(resumen.errores) ? "Falta correr la migración 0254 en Supabase." : undefined;
  return NextResponse.json({ ok: resumen.errores.length === 0, ...(nota ? { nota } : {}), ...resumen });
}
