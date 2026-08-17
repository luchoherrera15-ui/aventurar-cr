import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { walletV2SyncHabilitado } from "@/lib/wallet/sync/flags";
import { ejecutarCicloDeSincronizacion, LOTE_MAXIMO } from "@/lib/wallet/sync/worker";

/**
 * LA PUERTA DEL WORKER DE SINCRONIZACIÓN DE WALLET V2.
 *
 * Mismo patrón que las otras cinco rutas de cron del repo
 * (`autorizarCron` primero, siempre) — ver
 * `src/app/api/lealtad/pases-en-pausa/route.ts`, que es la que más se
 * parece a esta: mismo disparador (GitHub Actions, no vercel.json,
 * porque Vercel Hobby solo permite crons DIARIOS y este necesita
 * correr cada cinco minutos), mismo `runtime`/`dynamic`/`maxDuration`.
 * Ver `.github/workflows/wallet-sincronizar.yml`.
 *
 * Apagada por defecto (`WALLET_V2_SYNC_ENABLED`, `flags.ts`): con el
 * flag en `false` responde 200 sin tocar la base ni ninguna red — un
 * cron que corre cada 5 minutos y siempre contesta error por una
 * bandera apagada es ruido que nadie mira.
 *
 * El único parámetro que acepta es `?lote=`, un entero que se clampa
 * entre 1 y `LOTE_MAXIMO` — nunca un id de trabajo: no hay forma de
 * pedirle a esta ruta que procese una fila en particular, así que no
 * existe un camino de "id sin validar" que alguien pueda explotar
 * apuntando al pase de otro negocio. El resto de la selección
 * (`FOR UPDATE SKIP LOCKED`) la decide la base, no el request.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  if (!walletV2SyncHabilitado()) {
    return NextResponse.json({ nota: "Wallet V2 sync worker apagado (WALLET_V2_SYNC_ENABLED)." });
  }

  const url = new URL(request.url);
  const loteParam = Number(url.searchParams.get("lote"));
  const loteMax =
    Number.isFinite(loteParam) && loteParam > 0
      ? Math.min(Math.max(1, Math.trunc(loteParam)), LOTE_MAXIMO)
      : LOTE_MAXIMO;

  const resumen = await ejecutarCicloDeSincronizacion({ loteMax });
  return NextResponse.json(resumen);
}
