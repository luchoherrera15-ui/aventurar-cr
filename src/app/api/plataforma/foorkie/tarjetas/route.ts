import { createAdminClient } from "@/lib/supabase/admin";
import {
  armarTarjeta,
  leerPedidoFirmado,
  linksDelMiembro,
  metaDelPrograma,
  personasPorCorreo,
  responder,
  saldoDelMiembro,
  sitioDeBookea,
  type TarjetaParaFoorkie,
} from "@/lib/plataforma/foorkie-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/plataforma/foorkie/tarjetas — las tarjetas de lealtad de una
 * persona en los locales de Foorkie («Mi cuenta → Lealtad» de Foorkie,
 * web y app). Ver `src/lib/plataforma/foorkie-api.ts`.
 *
 *   { correo }  firmado en `x-foorkie-firma`
 *
 *   200 { ok: true, tarjetas: TarjetaParaFoorkie[] }   (vacío si no tiene ninguna)
 *   401 firma · 400 datos · 503 sin configurar
 *
 * Solo tarjetas ACTIVAS de programas vinculados a un local de Foorkie:
 * las de otros negocios de Bookea no se cuentan afuera. Foorkie manda el
 * correo de quien tiene la sesión allá (nunca uno que escribió alguien).
 */
export async function POST(request: Request) {
  const pedido = await leerPedidoFirmado(request, 2000);
  if (!pedido.ok) return pedido.respuesta;
  const correo = typeof pedido.datos.correo === "string" ? pedido.datos.correo.trim() : "";
  if (!correo || correo.length > 254) return responder({ ok: false, codigo: "datos" }, 400);

  const db = createAdminClient();
  if (!db) return responder({ ok: false, codigo: "no_configurado" }, 503);

  const personas = await personasPorCorreo(db, correo);
  if (personas.length === 0) return responder({ ok: true, tarjetas: [] });

  const { data: miembros } = await db
    .from("miembros")
    .select("id, programa_id, estado, created_at")
    .in("persona_id", personas)
    .eq("estado", "activa")
    .order("created_at", { ascending: true })
    .limit(50);
  const lista = (miembros ?? []) as { id: string; programa_id: string }[];
  if (lista.length === 0) return responder({ ok: true, tarjetas: [] });

  // Solo los programas que un local de Foorkie tiene vinculados.
  const programaIds = [...new Set(lista.map((m) => m.programa_id))];
  const [{ data: vinculados }, { data: filas }] = await Promise.all([
    db.from("foorkie_restaurantes").select("bookea_programa_id").in("bookea_programa_id", programaIds),
    db.from("programa_lealtad").select("*").in("id", programaIds),
  ]);
  const deFoorkie = new Set((vinculados ?? []).map((v) => String(v.bookea_programa_id)));
  const programas = new Map(((filas ?? []) as Record<string, unknown>[]).map((f) => [String(f.id), f]));

  const ranchoIds = [...new Set([...programas.values()].map((f) => String(f.rancho_id)))];
  const { data: ranchos } = ranchoIds.length
    ? await db.from("ranchos").select("id, nombre").in("id", ranchoIds)
    : { data: [] as { id: string; nombre: string }[] };
  const nombres = new Map((ranchos ?? []).map((r) => [String(r.id), String(r.nombre ?? "")]));

  const base = sitioDeBookea(request);
  const ahora = Date.now();
  const vistos = new Set<string>();
  const tarjetas: TarjetaParaFoorkie[] = [];
  for (const m of lista) {
    if (!deFoorkie.has(m.programa_id) || vistos.has(m.programa_id)) continue;
    const fila = programas.get(m.programa_id);
    if (!fila) continue;
    vistos.add(m.programa_id);
    const [saldo, meta] = await Promise.all([saldoDelMiembro(db, m.id), metaDelPrograma(db, m.programa_id)]);
    if (saldo === null) continue;
    tarjetas.push(
      armarTarjeta({
        miembroId: m.id,
        fila,
        negocio: nombres.get(String(fila.rancho_id)) ?? "",
        saldo,
        meta,
        links: linksDelMiembro(base, m.id, pedido.secreto, ahora),
      }),
    );
  }

  return responder({ ok: true, tarjetas });
}
