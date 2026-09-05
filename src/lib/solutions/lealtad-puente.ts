import { createAdminClient } from "@/lib/supabase/admin";
import { minutoISOCR } from "@/lib/fechas";
import { registraCompraElTipo } from "@/lib/lealtad/mostrador";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { productosParaVender } from "@/lib/lealtad/productos-db";
import type { ProductoDeVenta } from "@/lib/lealtad/productos";
import { elegirDeFilasCrudas } from "@/lib/wallet/programa-principal";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PUENTE A LEALTAD — lo que el escáner necesita, y nada más
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (5 sep 2026): «en el dashboard también poné un
 * escaneador de códigos para asignar puntos en los pases de lealtad,
 * cuando el usuario lo tenga adquirido».
 *
 * ── POR QUÉ ESTE ARCHIVO SÍ MIRA `ranchos` ──────────────────────────
 * Solutions no depende de ranchos (dueño, 3 sep 2026) — y no depende:
 * sus tablas son suyas. Pero el add-on de LEALTAD es el producto
 * Lealtad, que vive sobre `ranchos` y `programa_lealtad`, y acreditar
 * un sello es acreditarlo AHÍ. Este puente es la única puerta entre
 * los dos mundos y va en un solo sentido: lee de Lealtad lo que el
 * escáner necesita para montarse. No escribe nada, y no mezcla tablas.
 *
 * ── LA MISMA TARJETA QUE ELIGE EL PANEL DE LEALTAD ──────────────────
 * Un negocio puede tener varias tarjetas; `elegirDeFilasCrudas` es la
 * misma regla que usan el panel de Lealtad, el link público y el pase
 * para decidir cuál es la principal. Usar otra acá haría que el
 * escáner de Solutions acredite en una tarjeta distinta de la que el
 * cliente tiene en el teléfono.
 *
 * Los props que devuelve son EXACTAMENTE los de `EscanerPanel`
 * (src/app/lealtad/panel/[id]/escaner-panel.tsx), calculados con el
 * mismo criterio que su propio panel (`registraCompraElTipo`, la
 * regalía activa como meta, el catálogo de venta).
 */

export type EscanerLealtad = {
  ranchoId: string;
  /** El negocio de Lealtad (puede llamarse distinto que el de Solutions). */
  negocio: string;
  tarjeta: string;
  pideMonto: boolean;
  recompensa: { id: string; nombre: string; costo: number } | null;
  productos: ProductoDeVenta[];
};

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Un escáner por negocio de Lealtad de la cuenta que tenga tarjeta. */
export async function escaneresDeLaCuenta(admin: Admin, ownerId: string): Promise<EscanerLealtad[]> {
  const { data: ranchos } = await admin
    .from("ranchos")
    .select("id, nombre")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(20);
  if (!ranchos?.length) return [];

  const { data: programas } = await admin
    .from("programa_lealtad")
    .select("*")
    .in(
      "rancho_id",
      ranchos.map((r) => r.id as string),
    );
  const ahoraCR = minutoISOCR();

  const salida: EscanerLealtad[] = [];
  for (const r of ranchos) {
    const filas = ((programas ?? []) as Record<string, unknown>[]).filter((p) => p.rancho_id === r.id);
    if (filas.length === 0) continue;
    const p = elegirDeFilasCrudas(filas, ahoraCR);
    if (!p) continue;

    const [{ data: recompensas }, productos] = await Promise.all([
      admin
        .from("recompensas")
        .select("id, nombre, costo_puntos, activo")
        .eq("programa_id", p.id as string)
        .order("costo_puntos", { ascending: true }),
      productosParaVender(admin, r.id as string),
    ]);
    const meta = (recompensas ?? []).find((x) => x.activo === true) ?? null;

    salida.push({
      ranchoId: r.id as string,
      negocio: (r.nombre as string) ?? "Mi negocio",
      tarjeta: (p.nombre as string) ?? "Tarjeta",
      pideMonto: registraCompraElTipo(tipoDe(p.modo as string | null)),
      recompensa: meta
        ? { id: meta.id as string, nombre: meta.nombre as string, costo: Number(meta.costo_puntos) || 0 }
        : null,
      productos,
    });
  }
  return salida;
}
