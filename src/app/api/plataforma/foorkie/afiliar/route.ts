import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vinculoConFoorkie } from "@/lib/plataforma/foorkie";
import { leerPedidoFirmado, responder, sitioDeBookea } from "@/lib/plataforma/foorkie-api";
import { afiliarDesdeFoorkie, leerPedidoAfiliar, miembroParaLaBienvenida } from "@/lib/plataforma/foorkie-afiliar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/afiliar — el cliente se une a la tarjeta
 * de lealtad de un local desde Foorkie (su página o su app). Es el MISMO
 * alta del póster (`altaPorQr`): ver `src/lib/plataforma/foorkie-afiliar.ts`.
 *
 *   { rancho_id, programa_id, nombre (2..80), correo, whatsapp?: solo
 *     dígitos, con o sin 506, acepta_promos: boolean,
 *     consentimiento: { texto ≤ 2000, version ≤ 40 },
 *     origen: "foorkie_web" | "foorkie_app", ip?, user_agent? }
 *   firmado en `x-foorkie-firma`.
 *
 *   200 { ok: true, ya_era_miembro, tarjeta }   la tarjeta, igual que cada
 *       elemento de `tarjetas` (con los links al Wallet, 30 minutos).
 *   200 { ok: false, codigo, motivo[, campo | canal] }, con `motivo` en español:
 *       datos (+ campo: nombre | correo | whatsapp) · programa_no_opera ·
 *       cupo_agotado · requiere_prueba (+ canal) · dada_de_baja ·
 *       rechazado · reintentar
 *   400 datos (el pedido no tiene la forma del contrato) · 401 firma ·
 *   403 no_vinculado · 413 muy_grande · 503 no_configurado · 500 error
 *
 * El correo de bienvenida sale como en el póster, con la misma guardia
 * (`losCorreosLosMandaFoorkie`): una tarjeta marcada
 * `lealtad_por_foorkie` no lo recibe de Bookea (se lo manda Foorkie);
 * una vinculada sin la marca —Pura Matcha— lo recibe como siempre.
 */
export async function POST(request: Request) {
  const firmado = await leerPedidoFirmado(request, 8000);
  if (!firmado.ok) return firmado.respuesta;

  const leido = leerPedidoAfiliar(firmado.datos);
  if (!leido.ok) return responder({ ok: false, codigo: "datos", motivo: leido.motivo }, 400);
  const pedido = leido.valor;

  const db = createAdminClient();
  if (!db) {
    return responder({ ok: false, codigo: "no_configurado", motivo: "Bookea no tiene conexión con la base en este momento." }, 503);
  }

  const vinculo = await vinculoConFoorkie(db, pedido.ranchoId, pedido.programaId);
  if (!vinculo) {
    return responder({ ok: false, codigo: "no_vinculado", motivo: "Esa tarjeta no está vinculada a un local de Foorkie." }, 403);
  }

  try {
    const r = await afiliarDesdeFoorkie(db, pedido, { base: sitioDeBookea(request), secreto: firmado.secreto });

    // La bienvenida, SOLO en un alta nueva y después de responder, como el
    // póster (`tarjeta/[slug]/actions.ts`). `after`: una promesa suelta
    // muere apenas Vercel congela la función al responder.
    const nuevo = miembroParaLaBienvenida(r);
    if (nuevo) {
      after(async () => {
        try {
          const { avisarBienvenidaAlPlan } = await import("@/lib/correo/bienvenida-al-plan");
          await avisarBienvenidaAlPlan(nuevo);
        } catch (e) {
          console.warn("[foorkie/afiliar] No salió la bienvenida al plan:", e);
        }
      });
    }

    return responder(r);
  } catch (e) {
    // El alta es idempotente: si algo se cortó a mitad de camino, repetir
    // el pedido no duplica a la persona ni su tarjeta.
    console.warn("[foorkie/afiliar] El alta no terminó:", e instanceof Error ? e.message : e);
    return responder(
      { ok: false, codigo: "error", motivo: "No pudimos completar la afiliación ahora mismo. Probá de nuevo en un momento." },
      500,
    );
  }
}
