import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import { sumarDiasISO, hoyISOCR } from "@/lib/fechas";
import { EncabezadoPagina } from "@/components/food/panel";
import type { FoodPedidoEstado } from "@/lib/food/tipos";
import PedidosCliente, { type FilaPedidoPanel } from "./pedidos-cliente";

export const metadata: Metadata = { title: "Pedidos · FOOD.BOOKEA", robots: { index: false } };

function esEstadoPedido(v: string): v is FoodPedidoEstado {
  return v === "pendiente" || v === "confirmado" || v === "listo" || v === "entregado" || v === "cancelado";
}

/**
 * PEDIDOS ("To Go", 0207) — la contraparte de Reservas para los
 * pedidos para llevar: sin franja ni calendario (acá no hay cupo que
 * mirar), solo la cola real de food_pedidos de los últimos 90 días,
 * con sus platos. Deliberadamente más simple que Reservas (sin vista
 * de calendario ni utilería de demo): es la primera versión del
 * producto, se expande cuando el volumen lo pida.
 */
export default async function PedidosFoodPage() {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  const hoy = hoyISOCR();
  const { data: pedidos, error } = await supabase
    .from("food_pedidos")
    .select("id, codigo_confirmacion, estado, hora_retiro, notas, total, created_at")
    .eq("business_id", negocio.id)
    .gte("created_at", sumarDiasISO(hoy, -90))
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) console.error("[food/negocio pedidos] no se pudo cargar:", error.message);

  const ids = (pedidos ?? []).map((p) => p.id);
  const { data: items, error: errItems } = ids.length
    ? await supabase
        .from("food_pedido_items")
        .select("pedido_id, nombre, cantidad")
        .in("pedido_id", ids)
    : { data: [] as { pedido_id: string; nombre: string; cantidad: number }[], error: null };
  if (errItems) console.error("[food/negocio pedidos] no se pudieron cargar los platos:", errItems.message);

  const itemsPorPedido = new Map<string, string[]>();
  for (const it of items ?? []) {
    const lista = itemsPorPedido.get(it.pedido_id) ?? [];
    lista.push(`${it.cantidad}× ${it.nombre}`);
    itemsPorPedido.set(it.pedido_id, lista);
  }

  const filas: FilaPedidoPanel[] = (pedidos ?? []).map((p) => ({
    id: p.id,
    codigo: p.codigo_confirmacion,
    estado: esEstadoPedido(p.estado) ? p.estado : "pendiente",
    horaRetiro: p.hora_retiro,
    notas: p.notas,
    total: p.total,
    createdAt: p.created_at,
    resumenPlatos: (itemsPorPedido.get(p.id) ?? []).join(" · "),
  }));

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Pedidos"
        descripcion="Los pedidos para llevar de tu restaurante — se pagan al retirar, Bookea no cobra comisión."
      />
      <PedidosCliente negocioId={negocio.id} pedidos={filas} />
    </div>
  );
}
