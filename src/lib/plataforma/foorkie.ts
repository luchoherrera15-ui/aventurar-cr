import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarCorreo } from "@/lib/lealtad/personas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PUERTA DE FOORKIE — Foorkie manda, Bookea es el motor del Wallet
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (30 sep 2026): Foorkie (pedidos en línea de
 * restaurantes, misma base de Supabase) controla la lealtad de sus
 * locales y cada pedido entregado suma solo — sellos, puntos o cashback
 * según la tarjeta, sin escanear. El pase de Apple/Google Wallet se
 * actualiza porque la acreditación pasa por `acreditarPorMiembroCore`,
 * el mismo camino que el escáner: los certificados viven acá, no allá.
 *
 * ── QUIÉN PUEDE LLAMAR ──────────────────────────────────────────────
 * Solo el SERVIDOR de Foorkie: cada pedido llega firmado con HMAC-SHA256
 * (`FOORKIE_PLATAFORMA_SECRETO`, el mismo valor en los dos proyectos de
 * Vercel) sobre `<t>.<cuerpo>`, con el reloj adentro para que no se
 * pueda repetir fuera de la ventana.
 *
 * ── SOBRE QUÉ NEGOCIOS ───────────────────────────────────────────────
 * Solo los que Foorkie vinculó: `foorkie_restaurantes.bookea_rancho_id`
 * + `bookea_programa_id` (lo escribe Foorkie). Una firma filtrada no
 * alcanza para tocar un negocio de Bookea que no esté en Foorkie.
 */

/** Fuera de esta ventana la firma no vale (repeticiones). */
const VENTANA_MS = 5 * 60_000;

/** `x-foorkie-firma: t=<ms>,v1=<hex>` — ¿es de Foorkie y reciente? */
export function firmaValida(cuerpo: string, cabecera: string | null, secreto: string, ahora: number = Date.now()): boolean {
  if (!cabecera || !secreto) return false;
  const partes = new Map(
    cabecera.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
    }),
  );
  const t = Number(partes.get("t"));
  const v1 = partes.get("v1") ?? "";
  if (!Number.isFinite(t) || Math.abs(ahora - t) > VENTANA_MS) return false;
  if (!/^[0-9a-f]{64}$/.test(v1)) return false;
  const esperada = createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex");
  return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(esperada, "hex"));
}

/**
 * ¿Este negocio y esta tarjeta están vinculados a un local de Foorkie?
 * Devuelve el dueño del negocio (a su nombre queda el movimiento en el
 * ledger, como cuando él mismo acredita desde el panel).
 */
export async function vinculoConFoorkie(
  db: SupabaseClient,
  ranchoId: string,
  programaId: string,
): Promise<{ ownerId: string } | null> {
  const [{ data: local }, { data: rancho }, { data: programa }] = await Promise.all([
    db
      .from("foorkie_restaurantes")
      .select("id")
      .eq("bookea_rancho_id", ranchoId)
      .eq("bookea_programa_id", programaId)
      .limit(1)
      .maybeSingle(),
    db.from("ranchos").select("owner_id").eq("id", ranchoId).maybeSingle(),
    db.from("programa_lealtad").select("rancho_id").eq("id", programaId).maybeSingle(),
  ]);
  if (!local || !rancho?.owner_id || programa?.rancho_id !== ranchoId) return null;
  return { ownerId: rancho.owner_id as string };
}

/**
 * El miembro de ESTA tarjeta con ese correo, o null.
 *
 * Primero la persona global (`personas.correo`, única); si no, la
 * identidad local de este negocio (`personas_negocio.correo_declarado`,
 * 0200: quien se afilió en el mostrador sin cuenta). Nunca crea nada:
 * inscribir es otra puerta, con su consentimiento.
 */
export async function miembroPorCorreo(
  db: SupabaseClient,
  ranchoId: string,
  programaId: string,
  correoCrudo: string,
): Promise<string | null> {
  const correo = normalizarCorreo(correoCrudo);
  if (!correo) return null;

  const personas = new Set<string>();
  const { data: global } = await db.from("personas").select("id").eq("correo", correo).maybeSingle();
  if (typeof global?.id === "string") personas.add(global.id);
  const { data: locales } = await db
    .from("personas_negocio")
    .select("persona_id")
    .eq("rancho_id", ranchoId)
    .eq("correo_declarado", correo)
    .limit(5);
  for (const l of locales ?? []) if (typeof l.persona_id === "string") personas.add(l.persona_id);
  if (personas.size === 0) return null;

  const { data: miembro } = await db
    .from("miembros")
    .select("id")
    .eq("programa_id", programaId)
    .in("persona_id", [...personas])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return typeof miembro?.id === "string" ? miembro.id : null;
}
