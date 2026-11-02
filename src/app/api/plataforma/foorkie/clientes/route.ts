import { responder } from "@/lib/plataforma/foorkie-api";
import { abrirElPanel, clientesDeLaTarjeta, leerPedidoClientes } from "@/lib/plataforma/foorkie-panel";
import { pasesDeLaLista, SIN_PASE } from "@/lib/plataforma/foorkie-pases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una búsqueda (o un orden) resuelve quién es cada cliente de la tarjeta antes de filtrar.
export const maxDuration = 60;

/**
 * POST /api/plataforma/foorkie/clientes — los clientes de la tarjeta de
 * un local, para el panel de Foorkie. Ver `src/lib/plataforma/foorkie-panel.ts`.
 * Solo lee, y vale para cualquier tarjeta vinculada a un local de Foorkie.
 *
 *   { rancho_id, programa_id, buscar?: texto (≤ 80), limite?: 1..100 (50),
 *     antes?: ISO,
 *     orden?: "nuevos" | "saldo" | "canjes" | "visitas" | "actividad" | "antiguos" | "nombre",
 *     desde?: 0..20000 (solo con `orden`),
 *     resumen?: boolean }
 *   firmado en `x-foorkie-firma`.
 *
 *   `buscar` sin «@» busca en el nombre (sin tildes, en cualquier parte);
 *   con «@» busca el correo desde el principio («ana@», «ana@gmail.com»).
 *
 *   200 { ok: true, clientes: [{ miembro_id, nombre, correo, telefono,
 *         saldo, acumulado, visitas, canjes, ultimo_canje, desde,
 *         ultima_actividad, estado, posicion?, pase }], total,
 *         siguiente: ISO | null, siguiente_desde: number | null,
 *         resumen?: { clientes, activos_30, canjearon, canjes, acumulado } }
 *
 *       Sin `orden`: del alta más nueva a la más vieja; la página
 *       siguiente se pide con `antes: siguiente`, tal cual.
 *       Con `orden`: la lista entera ordenada (los empates, por el alta más
 *       nueva); la página siguiente se pide con `desde: siguiente_desde`
 *       (`antes` no va), y cada cliente trae su `posicion` en la lista
 *       ENTERA (1 = el primero), también cuando se busca.
 *       `total` cuenta todos los que coinciden. `estado`: "activa" |
 *       "pausada" (las dadas de baja no salen).
 *       `acumulado` = lo ganado en toda la historia (sin lo revertido);
 *       `visitas` = cuántas veces sumó; `canjes` = cuántas canjeó (sin los
 *       revertidos). Sellos, colones de cashback o puntos, según la tarjeta.
 *       `pase` (2 nov 2026): si tiene la tarjeta en el teléfono,
 *       `{ apple: "instalado" | "no_instalado" | null, google: "pedido" | null }`
 *       (ver `pasesDeLaLista` en `src/lib/plataforma/foorkie-pases.ts`);
 *       `null` si no se pudo leer (la lista sale igual).
 *       `resumen` (con `resumen: true`) es de TODA la tarjeta, aunque se
 *       busque: clientes, los que sumaron o canjearon en 30 días, los que
 *       canjearon alguna vez, los canjes y lo entregado en total.
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
  const pases = await pasesDeLaLista(
    panel.db,
    pagina.clientes.map((c) => c.miembro_id),
  );
  return responder({
    ok: true,
    clientes: pagina.clientes.map((c) => ({ ...c, pase: pases ? (pases.get(c.miembro_id) ?? SIN_PASE) : null })),
    total: pagina.total,
    siguiente: pagina.siguiente,
    siguiente_desde: pagina.siguienteDesde,
    ...(pagina.resumen ? { resumen: pagina.resumen } : {}),
  });
}
