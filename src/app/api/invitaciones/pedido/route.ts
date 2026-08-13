import { after } from "next/server";
import { sesionDesdeBearer } from "@/lib/supabase/bearer";
import {
  crearPedidoInvitacion,
  notificarPedidoNuevo,
  notificarPedidoPagado,
  registrarPagoPedido,
  type DatosPedido,
} from "@/lib/invitaciones/pedido";
import { montoEnColones, precioPaquete, resolverPaquete } from "@/lib/paquetes-invitaciones";
import { datosDePagoBookea } from "@/lib/pagos-bookea";

/**
 * POST /api/invitaciones/pedido
 *
 * La puerta de la app móvil al pedido de invitaciones. El app NO
 * inserta en `pedidos_invitacion` directo, aunque la RLS se lo
 * permitiría: el precio tiene que salir del servidor. Con un insert
 * desde el teléfono, el monto lo decidiría el cliente y nada impediría
 * un paquete Plus por ₡100.
 *
 * Autentica con el token de la sesión de Supabase que ya trae el app
 * (`Authorization: Bearer <access_token>`), y el insert va con ESE
 * token — no con la service key. Así la RLS sigue en pie: el endpoint
 * blinda el precio, la base blinda de quién es el pedido.
 *
 * Body: { paquete: string, datos: {...los campos de la fiesta} }
 * Response: { ok: true, pedidoId } | { ok: false, error }
 */

const SIN_SESION = "Entrá con tu cuenta para hacer el pedido.";

/**
 * GET /api/invitaciones/pedido?id=<uuid>
 *
 * El pedido y CÓMO pagarlo, para la pantalla de pago del app. Los
 * datos de SINPE y del banco viven en variables de entorno del
 * servidor (igual que en /invitaciones/pago de la web): mandarlos
 * desde acá evita duplicarlos en el app, donde cambiar una cuenta
 * obligaría a publicar una versión nueva en las tiendas.
 */
export async function GET(req: Request) {
  const sesion = await sesionDesdeBearer(req);
  if (!sesion) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }
  const { supabase } = sesion;

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) {
    return Response.json({ ok: false, error: "Falta el pedido." }, { status: 400 });
  }

  // La RLS ya limita esto a los pedidos de quien pregunta.
  const { data: pedido } = await supabase
    .from("pedidos_invitacion")
    .select("id, paquete, nombre_evento, fecha_evento, estado, contacto_correo")
    .eq("id", id)
    .maybeSingle();

  if (!pedido) {
    return Response.json({ ok: false, error: "Ese pedido no existe." }, { status: 404 });
  }

  const paquete = resolverPaquete(String(pedido.paquete));
  if (!paquete) {
    return Response.json({ ok: false, error: "Ese paquete no existe." }, { status: 404 });
  }

  const colones = montoEnColones(paquete);

  return Response.json({
    ok: true,
    pedido,
    paquete: {
      nombre: paquete.nombre,
      etiqueta: paquete.etiqueta,
      precioUSD: paquete.precioUSD,
      tienePanel: paquete.tienePanel,
    },
    monto: precioPaquete(colones),
    // Fuente única (lib/pagos-bookea): acá vivía el TERCER duplicado
    // de estos datos, con el SINPE viejo adentro.
    ...datosDePagoBookea(),
  });
}

export async function POST(req: Request) {
  const sesion = await sesionDesdeBearer(req);
  if (!sesion) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }
  const { supabase, usuarioId, correo } = sesion;

  let cuerpo: { paquete?: unknown; datos?: DatosPedido };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Pedido mal formado." }, { status: 400 });
  }

  const resultado = await crearPedidoInvitacion({
    supabase,
    clienteId: usuarioId,
    correoCuenta: correo,
    paqueteId: String(cuerpo.paquete ?? ""),
    datos: cuerpo.datos ?? {},
  });

  if (!resultado.ok) {
    return Response.json({ ok: false, error: resultado.error }, { status: 400 });
  }

  // Igual que en la web: el teléfono no espera a Resend para pasar a la
  // pantalla de pago, pero el equipo se entera del pedido igual.
  const pedido = resultado.pedido;
  after(() => notificarPedidoNuevo(pedido));

  return Response.json({ ok: true, pedidoId: resultado.pedidoId });
}

/**
 * PATCH /api/invitaciones/pedido
 *
 * El pago del pedido desde el app: método, comprobante y referencia.
 * Va acá y no en una ruta aparte porque es el mismo recurso en otro
 * momento de su vida — y comparte el mismo blindaje de sesión.
 *
 * Body: { pedidoId, metodo, comprobanteUrl, referencia? }
 */
export async function PATCH(req: Request) {
  const sesion = await sesionDesdeBearer(req);
  if (!sesion) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }
  const { supabase, usuarioId } = sesion;

  let cuerpo: {
    pedidoId?: unknown;
    metodo?: unknown;
    comprobanteUrl?: unknown;
    referencia?: unknown;
  };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Pago mal formado." }, { status: 400 });
  }

  const resultado = await registrarPagoPedido({
    supabase,
    pedidoId: String(cuerpo.pedidoId ?? ""),
    clienteId: usuarioId,
    metodo: String(cuerpo.metodo ?? "").trim(),
    comprobanteUrl: String(cuerpo.comprobanteUrl ?? "").trim(),
    referencia: String(cuerpo.referencia ?? "").trim() || null,
  });

  if (!resultado.ok) {
    return Response.json({ ok: false, error: resultado.error }, { status: 400 });
  }

  // Igual que en la web: el teléfono ve su pantalla de "listo" sin
  // esperar a que Resend conteste.
  const pedido = resultado.pedido!;
  after(() => notificarPedidoPagado(pedido));

  return Response.json({ ok: true });
}
