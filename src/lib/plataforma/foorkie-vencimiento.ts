import type { SupabaseClient } from "@supabase/supabase-js";
import { elegirLocalDeFoorkie, localDeFoorkieDeLaTarjeta, marcaDelPase, type FilaLocalDeFoorkie } from "@/lib/plataforma/foorkie-marca";
import { COLUMNA_LEALTAD_POR_FOORKIE } from "@/lib/plataforma/negocio-de-foorkie";
import { textoPorVencerEnElPase } from "@/lib/lealtad/vencimiento-sellos";
import { tipoDe, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { escribirMensajeDelMiembro } from "@/lib/wallet/mensaje-del-miembro";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL VENCIMIENTO EN LAS TARJETAS DE FOORKIE (0253)
 * ════════════════════════════════════════════════════════════════════
 *
 * Dos piezas del barrido de vencimientos (`vencer-sellos.ts`) que solo
 * tienen sentido para las tarjetas de Foorkie:
 *
 *   1. CUÁLES SON. En una tarjeta de Foorkie también pueden vencer el
 *      cashback y los puntos (`saldoTambien`, vencimiento-sellos.ts), y
 *      el aviso previo va por otro lado. Una consulta por corrida, para
 *      todas las tarjetas con la regla encendida. Si la base no contesta,
 *      ninguna es de Foorkie: el cashback no vence y el aviso sale como
 *      siempre —nadie pierde plata por una consulta caída—.
 *
 *   2. EL AVISO 14 DÍAS ANTES, EN EL PASE. Bookea no les escribe correos
 *      a los clientes de las tarjetas de Foorkie
 *      (`losCorreosLosMandaFoorkie`): el aviso llega a la tarjeta del
 *      teléfono como un mensaje del restaurante, por el MISMO camino que
 *      los mensajes automáticos (`foorkie-mensajes.ts`): en Apple, el
 *      renglón «Último mensaje» con `changeMessage` (escrito ANTES del
 *      push, para que el pase que baja ya lo traiga); en Google, un
 *      mensaje con notificación, después del refresco.
 *
 * Uno solo por vencimiento: lo garantiza el reclamo de
 * `avisos_vencimiento_sellos` (unique miembro + fecha de corte), que el
 * barrido hace ANTES de llamar acá. Nada de esto lanza.
 */

type Db = SupabaseClient;

/** Una tarjeta con la regla encendida, como la lee el barrido. */
export type TarjetaConRegla = { id: string; rancho_id: string | null };

/**
 * Las tarjetas de esta lista que son de Foorkie (vinculadas Y con la marca
 * `lealtad_por_foorkie`, con el mismo par negocio + tarjeta que exige
 * `vinculoConFoorkie`). UNA consulta. Ante un error, ninguna.
 */
export async function tarjetasDeFoorkie(db: Pick<Db, "from">, tarjetas: readonly TarjetaConRegla[]): Promise<Set<string>> {
  const ids = [...new Set(tarjetas.map((t) => t.id).filter((id) => typeof id === "string" && id !== ""))];
  if (ids.length === 0) return new Set();
  try {
    const { data, error } = await db
      .from("foorkie_restaurantes")
      .select("bookea_programa_id, bookea_rancho_id, slug, activo, estado_publicacion, created_at")
      .in("bookea_programa_id", ids)
      .eq(COLUMNA_LEALTAD_POR_FOORKIE, true);
    if (error) throw new Error(error.message);
    const porTarjeta = new Map<string, FilaLocalDeFoorkie[]>();
    for (const f of (data ?? []) as (FilaLocalDeFoorkie & { bookea_programa_id?: unknown })[]) {
      const id = typeof f.bookea_programa_id === "string" ? f.bookea_programa_id : null;
      if (!id) continue;
      porTarjeta.set(id, [...(porTarjeta.get(id) ?? []), f]);
    }
    const deFoorkie = new Set<string>();
    for (const t of tarjetas) {
      const filas = porTarjeta.get(t.id);
      if (filas && elegirLocalDeFoorkie(filas, t.rancho_id)) deFoorkie.add(t.id);
    }
    return deFoorkie;
  } catch (e) {
    console.warn("[vencimiento] No se pudo saber qué tarjetas son de Foorkie; ninguna vence su saldo hoy:", e instanceof Error ? e.message : e);
    return new Set();
  }
}

/** Lo que hace falta para avisar (inyectable en las pruebas). */
export type AccionesAvisoEnElPase = {
  escribir: (db: Db, miembroId: string, texto: string) => Promise<boolean>;
  avisarPase: (miembroId: string) => Promise<void>;
  avisarGoogle: (miembroId: string, aviso: { evento: "vence"; texto: string; encabezado: string }) => Promise<{ ok: boolean; motivo?: string }>;
};

const accionesReales: AccionesAvisoEnElPase = {
  escribir: (db, miembroId, texto) => escribirMensajeDelMiembro(db, miembroId, texto),
  avisarPase: async (miembroId) => {
    const { avisarCambioDePase } = await import("@/lib/wallet/servicio");
    await avisarCambioDePase(miembroId);
  },
  avisarGoogle: async (miembroId, aviso) => {
    const { avisarEventoGoogle } = await import("@/lib/wallet/google");
    const r = await avisarEventoGoogle(miembroId, aviso);
    return r.ok ? { ok: true } : { ok: false, motivo: r.motivo };
  },
};

/**
 * «Tus ₡2 350 de cashback vencen el 17 de octubre de 2026…», en la
 * tarjeta del teléfono del cliente. true = salió a algún pase.
 *
 * Solo si la tarjeta es de Foorkie (se vuelve a preguntar acá: esto
 * escribe en el pase) y el cliente tiene algún pase activo.
 */
export async function avisarPorVencerEnElPase(
  db: Db,
  d: { miembroId: string; venceEl: string; saldo: number; tipo?: TipoTarjeta },
  acciones: AccionesAvisoEnElPase = accionesReales,
): Promise<boolean> {
  try {
    const { data: miembro } = await db.from("miembros").select("programa_id").eq("id", d.miembroId).maybeSingle();
    const programaId = (miembro as { programa_id?: unknown } | null)?.programa_id;
    if (typeof programaId !== "string") return false;
    const { data: programa } = await db.from("programa_lealtad").select("rancho_id, modo").eq("id", programaId).maybeSingle();
    const fila = (programa ?? null) as { rancho_id?: unknown; modo?: unknown } | null;
    if (!fila) return false;

    const local = await localDeFoorkieDeLaTarjeta(db, {
      programaId,
      ranchoId: typeof fila.rancho_id === "string" ? fila.rancho_id : null,
    });
    if (!local) return false;

    const { data: pases } = await db
      .from("pases_wallet")
      .select("plataforma")
      .eq("miembro_id", d.miembroId)
      .eq("activo", true);
    const plataformas = new Set(((pases ?? []) as { plataforma?: unknown }[]).map((p) => p.plataforma));
    if (plataformas.size === 0) return false;

    const tipo = d.tipo ?? tipoDe(typeof fila.modo === "string" ? fila.modo : null);
    const texto = textoPorVencerEnElPase({ tipo, saldo: d.saldo, venceEl: d.venceEl });

    // Apple: el renglón con `changeMessage`, ANTES del push.
    if (plataformas.has("apple")) await acciones.escribir(db, d.miembroId, texto);
    // El push de Apple y el refresco de Google (sin evento: no es un movimiento).
    await acciones.avisarPase(d.miembroId);
    // Google: el mensaje con notificación, con el pase ya al día.
    if (plataformas.has("google")) {
      const r = await acciones.avisarGoogle(d.miembroId, { evento: "vence", texto, encabezado: marcaDelPase(local).encabezadoMensaje });
      if (!r.ok) console.warn(`[vencimiento] No salió el aviso al pase de Google de ${d.miembroId}: ${r.motivo ?? "sin motivo"}`);
    }
    return true;
  } catch (e) {
    console.warn("[vencimiento] No salió el aviso en el pase:", e);
    return false;
  }
}
