import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirElPanel, clientesDeLaTarjeta, leerPedidoClientes } from "@/lib/plataforma/foorkie-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una búsqueda resuelve quién es cada cliente de la tarjeta antes de filtrar.
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/clientes — los clientes de la tarjeta de
 * un local, para el panel de Foorkie. Ver `src/lib/plataforma/foorkie-panel.ts`.
 *
 *   { rancho_id, programa_id, buscar?: texto (≤ 80), limite?: 1..100 (50), antes?: ISO }
 *   firmado en `x-foorkie-firma`.
 *
 *   `buscar` sin «@» busca en el nombre (sin tildes, en cualquier parte);
 *   con «@» busca el correo desde el principio («ana@», «ana@gmail.com»).
 *
 *   200 { ok: true, clientes: [{ miembro_id, nombre, correo, telefono,
 *         saldo, desde, ultima_actividad, estado }], total, siguiente: ISO | null }
 *       Del alta más nueva a la más vieja. Para la página siguiente se
 *       manda `antes: siguiente`, tal cual. `total` cuenta todos los que
 *       coinciden. `estado`: "activa" | "pausada" (las dadas de baja no salen).
 *   400 datos · 401 firma · 403 no_vinculado · 500 error_base · 503 no_configurado
 *
 * Solo los miembros de ESTA tarjeta. De cada uno, el nombre de pila (o
 * «Cliente»), el correo y el teléfono enmascarados: nunca un contacto completo.
 */
export async function POST(request: Request) {
  const panel = await abrirElPanel(request, leerPedidoClientes);
  if (!panel.ok) return panel.respuesta;

  const pagina = await clientesDeLaTarjeta(panel.db, panel.pedido);
  if (!pagina) {
    return responder({ ok: false, codigo: "error_base", motivo: "No pudimos leer los clientes. Probá de nuevo." }, 500);
  }
  return responder({ ok: true, clientes: pagina.clientes, total: pagina.total, siguiente: pagina.siguiente });
}
