import { createAdminClient } from "@/lib/supabase/admin";
import { vinculoConFoorkie } from "@/lib/plataforma/foorkie";
import {
  disenoDeFila,
  estaPausada,
  leerPedidoFirmado,
  metaDelPrograma,
  responder,
  sitioDeBookea,
  UUID,
} from "@/lib/plataforma/foorkie-api";
import { camposSegunModo, tarjetaDesdeFila } from "@/lib/wallet/tarjeta";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/programa — la tarjeta de un local de
 * Foorkie tal como es en Bookea: tipo, beneficio, diseño, meta, si está
 * en pausa y cuántos clientes la tienen. Lo usan la ficha del local
 * (app y web) y el panel del restaurante. Ver `foorkie-api.ts`.
 *
 *   { rancho_id, programa_id }  firmado en `x-foorkie-firma`
 *
 *   200 { ok: true, programa: {...} }
 *   403 no_vinculado · 404 sin_programa · 401 firma · 400 datos · 503
 */
export async function POST(request: Request) {
  const pedido = await leerPedidoFirmado(request, 2000);
  if (!pedido.ok) return pedido.respuesta;
  const ranchoId = typeof pedido.datos.rancho_id === "string" ? pedido.datos.rancho_id : "";
  const programaId = typeof pedido.datos.programa_id === "string" ? pedido.datos.programa_id : "";
  if (!UUID.test(ranchoId) || !UUID.test(programaId)) return responder({ ok: false, codigo: "datos" }, 400);

  const db = createAdminClient();
  if (!db) return responder({ ok: false, codigo: "no_configurado" }, 503);

  const vinculo = await vinculoConFoorkie(db, ranchoId, programaId);
  if (!vinculo) return responder({ ok: false, codigo: "no_vinculado" }, 403);

  const [{ data: fila }, { data: rancho }, meta, { count: miembros }] = await Promise.all([
    db.from("programa_lealtad").select("*").eq("id", programaId).maybeSingle(),
    db.from("ranchos").select("nombre, slug").eq("id", ranchoId).maybeSingle(),
    metaDelPrograma(db, programaId),
    db.from("miembros").select("id", { count: "exact", head: true }).eq("programa_id", programaId).eq("estado", "activa"),
  ]);
  if (!fila) return responder({ ok: false, codigo: "sin_programa" }, 404);

  const negocio = String(rancho?.nombre ?? "");
  const { config, beneficio } = tarjetaDesdeFila(fila as Record<string, unknown>);
  const pausada = estaPausada(fila as Record<string, unknown>);
  const base = sitioDeBookea(request);
  return responder({
    ok: true,
    programa: {
      id: programaId,
      rancho_id: ranchoId,
      negocio,
      nombre: typeof fila.nombre === "string" ? fila.nombre : negocio,
      modo: tipoDe(config.modo),
      estado: typeof fila.estado === "string" ? fila.estado : null,
      pausada,
      beneficio,
      meta,
      diseno: disenoDeFila(fila as Record<string, unknown>),
      // Lo que diría la tarjeta de alguien que recién se une (saldo 0).
      textos: camposSegunModo({ negocioNombre: negocio, saldo: 0, meta, config, beneficio, pausado: pausada }),
      miembros: miembros ?? 0,
      // La página de Bookea donde alguien se une (formulario + consentimiento).
      unirse: rancho?.slug ? `${base}/tarjeta/${rancho.slug}/${programaId}` : null,
    },
  });
}
