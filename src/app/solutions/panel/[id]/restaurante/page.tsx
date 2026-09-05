import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { addonsDelNegocio } from "@/lib/solutions/addons";
import { menuDelNegocio, negocioPorId, pedidosDelNegocio } from "@/lib/solutions/datos";
import type { Modalidad } from "@/lib/solutions/tipos";
import TableroRestaurante from "./tablero-restaurante";

export const metadata: Metadata = { title: "Modo restaurante · Bookea Solutions" };

/**
 * /solutions/panel/<id>/restaurante — MODO RESTAURANTE.
 *
 * Ruta propia y no una pestaña del panel, por lo mismo que la hoja de
 * QR: es una pantalla de OPERACIÓN, para dejar abierta en la cocina o
 * en la caja, y no quiere el rail ni el encabezado del panel
 * compitiendo por el ancho. Se llega desde el rail («Modo
 * restaurante») y se vuelve con un link arriba.
 *
 * Solo existe con el add-on de pedidos: sin él, a Inicio, que es donde
 * se agrega. El rol «equipo» entra (es su pantalla), pero solo el que
 * puede editar prende de nuevo los agotados.
 */
export default async function ModoRestaurantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await verificarAccesoSolutions(id);
  if (!acceso.user) redirect("/cuenta?volver=solutions");
  if (!acceso.ok) redirect("/solutions/panel");

  const admin = createAdminClient();
  if (!admin) notFound();
  const negocio = await negocioPorId(admin, id);
  if (!negocio) notFound();

  const addons = await addonsDelNegocio(admin, id);
  if (!addons.pedidos) redirect(`/solutions/panel/${id}?tab=inicio`);

  const [pedidos, menu] = await Promise.all([
    pedidosDelNegocio(admin, id, { limite: 150 }),
    menuDelNegocio(admin, id),
  ]);

  const modalidades: Modalidad[] = [];
  if (negocio.acepta_pedidos) modalidades.push("mesa");
  if (negocio.pedidos_llevar) modalidades.push("llevar");
  if (negocio.pedidos_express) modalidades.push("express");

  return (
    <main className="min-h-svh bg-[#f7f9fc]">
      <TableroRestaurante
        negocioId={id}
        negocioNombre={negocio.nombre}
        pedidos={pedidos}
        items={menu.items}
        modalidades={modalidades}
        puedeEditar={acceso.puedeEditar}
      />
    </main>
  );
}
