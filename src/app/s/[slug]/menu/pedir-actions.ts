"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { addonsDelNegocio } from "@/lib/solutions/addons";
import { TOPES, metodoPagoDe, metodosPagoDe, type MetodoPago } from "@/lib/solutions/tipos";
import { codigoDePedido } from "@/lib/solutions/whatsapp";

/**
 * EL PEDIDO ENTRA POR ACÁ — y solo por acá.
 *
 * El cliente no tiene cuenta, así que la escritura va con la llave de
 * servicio detrás de validaciones que la RLS no puede hacer por él:
 *
 *   · el negocio existe, está publicado y tiene el ADD-ON de pedidos;
 *   · la modalidad que pide está prendida (mesa / To go / exprés);
 *   · cada renglón es un plato de ESE negocio, disponible, no agotado
 *     y CON precio (uno «a consultar» no tiene monto que congelar);
 *   · el total se calcula acá con los precios de la base — nunca con
 *     los que mandó el navegador.
 *
 * Un renglón inválido descarta el pedido entero con un motivo claro,
 * no lo recorta en silencio: el cliente cree que pidió tres cosas y la
 * cocina recibe dos.
 *
 * ── DOS PUERTAS, UNA VALIDACIÓN ─────────────────────────────────────
 * `pedirDesdeLaMesa` (QR de la mesa) y `pedirParaLlevar` (To go /
 * exprés, desde la página) comparten `renglonesDe`: lo que hace válido
 * a un plato no depende de por dónde se pide. Las dos caen en el MISMO
 * lugar: el Modo restaurante del panel, cada una con su etiqueta.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Renglon = { item_id: string; nombre: string; precio: number; cantidad: number };
type Falla = { ok: false; motivo: string };

async function renglonesDe(
  admin: Admin,
  negocioId: string,
  crudos: { itemId: string; cantidad: number }[],
): Promise<{ ok: true; items: Renglon[]; subtotal: number } | Falla> {
  const renglones = (Array.isArray(crudos) ? crudos : [])
    .map((r) => ({ itemId: String(r.itemId ?? ""), cantidad: Math.trunc(Number(r.cantidad)) }))
    .filter((r) => r.itemId && r.cantidad >= 1 && r.cantidad <= TOPES.cantidadPorRenglon)
    .slice(0, TOPES.renglonesPorPedido);
  if (renglones.length === 0) return { ok: false, motivo: "Agregá al menos un plato." };

  const { data: platos } = await admin
    .from("solutions_menu_items")
    .select("id, nombre, precio, disponible, agotado_hoy")
    .eq("negocio_id", negocioId)
    .in(
      "id",
      renglones.map((r) => r.itemId),
    );
  const porId = new Map((platos ?? []).map((p) => [p.id as string, p]));

  const items: Renglon[] = [];
  for (const r of renglones) {
    const p = porId.get(r.itemId);
    if (!p || !p.disponible || p.agotado_hoy || p.precio === null) {
      return { ok: false, motivo: `«${p?.nombre ?? "Un plato"}» ya no está disponible. Revisá tu pedido.` };
    }
    items.push({ item_id: p.id as string, nombre: p.nombre as string, precio: Number(p.precio), cantidad: r.cantidad });
  }
  return { ok: true, items, subtotal: items.reduce((s, it) => s + it.precio * it.cantidad, 0) };
}

/** Inserta cabecera + renglones; si los renglones fallan, borra la cabecera. */
async function guardarPedido(
  admin: Admin,
  cabecera: Record<string, unknown>,
  items: Renglon[],
): Promise<{ ok: true; id: string } | Falla> {
  const { data: pedido, error } = await admin.from("solutions_pedidos").insert(cabecera).select("id").single();
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
  return { ok: true, id: pedido.id as string };
}

// ── 1. DESDE LA MESA ────────────────────────────────────────────────

export async function pedirDesdeLaMesa(entrada: {
  negocioId: string;
  slug: string;
  mesa: number;
  nombre: string;
  nota: string;
  renglones: { itemId: string; cantidad: number }[];
}): Promise<{ ok: true; pedidoId: string; total: number } | Falla> {
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
  const addons = await addonsDelNegocio(admin, negocio.id);
  if (!addons.pedidos || !negocio.acepta_pedidos) {
    return { ok: false, motivo: "Este negocio no recibe pedidos desde la mesa." };
  }

  const mesa = Math.trunc(Number(entrada.mesa));
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > Math.min(Number(negocio.mesas) || 0, TOPES.mesas)) {
    return { ok: false, motivo: "Escaneá el QR de tu mesa para pedir." };
  }

  const r = await renglonesDe(admin, negocio.id, entrada.renglones);
  if (!r.ok) return r;

  // `modalidad` no se manda: su default en la base es 'mesa'.
  const g = await guardarPedido(
    admin,
    {
      negocio_id: negocio.id,
      mesa,
      nombre: String(entrada.nombre ?? "").trim().slice(0, TOPES.pedidoNombre),
      nota: String(entrada.nota ?? "").trim().slice(0, TOPES.pedidoNota),
      total: r.subtotal,
    },
    r.items,
  );
  if (!g.ok) return g;
  return { ok: true, pedidoId: g.id, total: r.subtotal };
}

// ── 2. TO GO / EXPRÉS, DESDE LA PÁGINA (0233) ───────────────────────

/**
 * Pedido del dueño (5 sep 2026): «las To go y Exprés por la web, y que
 * lleguen al Modo restaurante marcadas». Antes este camino abría
 * WhatsApp con el pedido escrito; ahora el pedido ES la web: se guarda,
 * recibe un código corto y aparece en el tablero de la cocina como
 * cualquier comanda de mesa. El teléfono del cliente queda en el
 * pedido para que el local le avise cuando esté listo.
 */
export async function pedirParaLlevar(entrada: {
  negocioId: string;
  slug: string;
  modalidad: "llevar" | "express";
  nombre: string;
  telefono: string;
  cedula: string;
  direccion: string;
  metodoPago: string;
  nota: string;
  renglones: { itemId: string; cantidad: number }[];
}): Promise<
  | { ok: true; pedidoId: string; codigo: string; total: number; costoEnvio: number; metodoPago: MetodoPago }
  | Falla
> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "El servicio no está disponible ahora." };

  const { data: negocio } = await admin
    .from("solutions_negocios")
    .select("id, slug, publicado, pedidos_llevar, pedidos_express, costo_express, metodos_pago")
    .eq("id", entrada.negocioId)
    .maybeSingle();
  if (!negocio || negocio.slug !== entrada.slug || !negocio.publicado) {
    return { ok: false, motivo: "Este menú ya no está disponible." };
  }
  const addons = await addonsDelNegocio(admin, negocio.id);
  if (!addons.pedidos) return { ok: false, motivo: "Este negocio no recibe pedidos por acá." };

  const modalidad = entrada.modalidad === "express" ? "express" : "llevar";
  if (modalidad === "llevar" && !negocio.pedidos_llevar) return { ok: false, motivo: "Este negocio no recibe pedidos To go." };
  if (modalidad === "express" && !negocio.pedidos_express) return { ok: false, motivo: "Este negocio no hace exprés." };

  // ── Los datos del cliente ─────────────────────────────────────────
  const nombre = String(entrada.nombre ?? "").trim().slice(0, TOPES.pedidoNombre);
  if (nombre.length < 2) return { ok: false, motivo: "Decinos tu nombre." };
  const telefono = String(entrada.telefono ?? "").replace(/\D/g, "");
  if (telefono.length < 8 || telefono.length > TOPES.telefono) {
    return { ok: false, motivo: "El teléfono tiene que tener entre 8 y 15 dígitos." };
  }
  const cedula = String(entrada.cedula ?? "").trim().slice(0, TOPES.cedula);
  const direccion = String(entrada.direccion ?? "").trim().slice(0, TOPES.direccionPedido);
  if (modalidad === "express" && direccion.length < 5) {
    return { ok: false, motivo: "Para el exprés necesitamos tu dirección." };
  }
  const metodoPago = metodoPagoDe(entrada.metodoPago);
  const aceptados = metodosPagoDe(negocio.metodos_pago);
  if (!metodoPago || !aceptados.includes(metodoPago)) {
    return { ok: false, motivo: "Elegí cómo vas a pagar." };
  }
  const nota = String(entrada.nota ?? "").trim().slice(0, TOPES.pedidoNota);

  const r = await renglonesDe(admin, negocio.id, entrada.renglones);
  if (!r.ok) return r;

  // El envío se CONGELA en el pedido: si el negocio cambia el costo
  // mañana, el pedido de hoy no cambia.
  const costoEnvio = modalidad === "express" ? Math.max(0, Number(negocio.costo_express) || 0) : 0;
  const total = r.subtotal + costoEnvio;

  const g = await guardarPedido(
    admin,
    {
      negocio_id: negocio.id,
      mesa: null,
      modalidad,
      nombre,
      telefono,
      cedula: cedula || null,
      direccion: modalidad === "express" ? direccion : direccion || null,
      metodo_pago: metodoPago,
      costo_envio: costoEnvio,
      nota,
      total,
    },
    r.items,
  );
  if (!g.ok) return g;

  return { ok: true, pedidoId: g.id, codigo: codigoDePedido(g.id), total, costoEnvio, metodoPago };
}
