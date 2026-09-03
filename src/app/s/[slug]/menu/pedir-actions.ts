"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { TOPES } from "@/lib/solutions/tipos";

/**
 * LA COMANDA ENTRA POR ACÁ — y solo por acá.
 *
 * El cliente de la mesa no tiene cuenta, así que la escritura va con
 * la llave de servicio detrás de validaciones que la RLS no puede
 * hacer por él:
 *
 *   · el negocio existe, está publicado y ACEPTA pedidos;
 *   · la mesa está dentro de las que el negocio declaró;
 *   · cada renglón es un plato de ESE negocio, disponible, no agotado
 *     y CON precio (uno «a consultar» no tiene monto que congelar);
 *   · el total se calcula acá con los precios de la base — nunca con
 *     los que mandó el navegador.
 *
 * Un renglón inválido descarta la comanda entera con un motivo claro,
 * no la recorta en silencio: el cliente cree que pidió tres cosas y la
 * cocina recibe dos.
 */
export async function pedirDesdeLaMesa(entrada: {
  negocioId: string;
  slug: string;
  mesa: number;
  nombre: string;
  nota: string;
  renglones: { itemId: string; cantidad: number }[];
}): Promise<{ ok: true; pedidoId: string; total: number } | { ok: false; motivo: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "El servicio no está disponible ahora." };

  const { data: negocio } = await admin
    .from("solutions_negocios")
    .select("id, slug, publicado, acepta_pedidos, mesas")
    .eq("id", entrada.negocioId)
    .maybeSingle();
  if (!negocio || negocio.slug !== entrada.slug || !negocio.publicado) {
    return { ok: false, motivo: "Este menú ya no está disponible." };
  }
  if (!negocio.acepta_pedidos) return { ok: false, motivo: "Este negocio no recibe pedidos desde la mesa." };

  const mesa = Math.trunc(Number(entrada.mesa));
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > Math.min(Number(negocio.mesas) || 0, TOPES.mesas)) {
    return { ok: false, motivo: "Escaneá el QR de tu mesa para pedir." };
  }

  const renglones = (Array.isArray(entrada.renglones) ? entrada.renglones : [])
    .map((r) => ({ itemId: String(r.itemId ?? ""), cantidad: Math.trunc(Number(r.cantidad)) }))
    .filter((r) => r.itemId && r.cantidad >= 1 && r.cantidad <= TOPES.cantidadPorRenglon)
    .slice(0, TOPES.renglonesPorPedido);
  if (renglones.length === 0) return { ok: false, motivo: "Agregá al menos un plato." };

  const { data: platos } = await admin
    .from("solutions_menu_items")
    .select("id, nombre, precio, disponible, agotado_hoy")
    .eq("negocio_id", negocio.id)
    .in(
      "id",
      renglones.map((r) => r.itemId),
    );
  const porId = new Map((platos ?? []).map((p) => [p.id as string, p]));

  const items: { item_id: string; nombre: string; precio: number; cantidad: number }[] = [];
  for (const r of renglones) {
    const p = porId.get(r.itemId);
    if (!p || !p.disponible || p.agotado_hoy || p.precio === null) {
      return { ok: false, motivo: `«${p?.nombre ?? "Un plato"}» ya no está disponible. Revisá tu pedido.` };
    }
    items.push({ item_id: p.id as string, nombre: p.nombre as string, precio: Number(p.precio), cantidad: r.cantidad });
  }
  const total = items.reduce((s, it) => s + it.precio * it.cantidad, 0);

  const { data: pedido, error } = await admin
    .from("solutions_pedidos")
    .insert({
      negocio_id: negocio.id,
      mesa,
      nombre: String(entrada.nombre ?? "").trim().slice(0, TOPES.pedidoNombre),
      nota: String(entrada.nota ?? "").trim().slice(0, TOPES.pedidoNota),
      total,
    })
    .select("id")
    .single();
  if (error || !pedido) return { ok: false, motivo: "No se pudo enviar el pedido. Probá de nuevo." };

  const { error: eItems } = await admin
    .from("solutions_pedido_items")
    .insert(items.map((it) => ({ ...it, pedido_id: pedido.id })));
  if (eItems) {
    // Sin renglones la comanda no sirve: se borra para no dejar una
    // cabecera huérfana que la cocina vea vacía.
    await admin.from("solutions_pedidos").delete().eq("id", pedido.id);
    return { ok: false, motivo: "No se pudo enviar el pedido. Probá de nuevo." };
  }

  return { ok: true, pedidoId: pedido.id as string, total };
}
