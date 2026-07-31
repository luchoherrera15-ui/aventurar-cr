import { after } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  crearPedidoInvitacion,
  notificarPedidoPagado,
  registrarPagoPedido,
  type DatosPedido,
} from "@/lib/invitaciones/pedido";
import { montoEnColones, precioPaquete, resolverPaquete } from "@/lib/paquetes-invitaciones";

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
 * Un cliente de Supabase que actúa COMO el usuario del app: la RLS lo
 * ve igual que a una sesión del navegador.
 */
function clienteDelToken(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  return createSupabaseClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Saca el token del header, o null si no vino uno usable. */
function tokenDeLaPeticion(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? token : null;
}

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
  const token = tokenDeLaPeticion(req);
  if (!token) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }

  const supabase = clienteDelToken(token);
  if (!supabase) {
    return Response.json({ ok: false, error: "Servidor sin configurar." }, { status: 500 });
  }

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
    sinpe: {
      numero: process.env.SINPE_NUMERO ?? "8689 3939",
      titular: process.env.SINPE_TITULAR ?? "José Pablo Herrera Ovares",
    },
    banco: {
      nombre: process.env.BANCO_NOMBRE ?? "Banco Nacional",
      cuenta: process.env.BANCO_CUENTA_IBAN ?? "",
      titular: process.env.BANCO_TITULAR ?? "José Pablo Herrera Ovares",
    },
  });
}

export async function POST(req: Request) {
  const token = tokenDeLaPeticion(req);
  if (!token) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }

  const supabase = clienteDelToken(token);
  if (!supabase) {
    return Response.json(
      { ok: false, error: "El servidor no está configurado para recibir pedidos." },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }

  let cuerpo: { paquete?: unknown; datos?: DatosPedido };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Pedido mal formado." }, { status: 400 });
  }

  const resultado = await crearPedidoInvitacion({
    supabase,
    clienteId: user.id,
    correoCuenta: user.email ?? null,
    paqueteId: String(cuerpo.paquete ?? ""),
    datos: cuerpo.datos ?? {},
  });

  if (!resultado.ok) {
    return Response.json({ ok: false, error: resultado.error }, { status: 400 });
  }

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
  const token = tokenDeLaPeticion(req);
  if (!token) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }

  const supabase = clienteDelToken(token);
  if (!supabase) {
    return Response.json(
      { ok: false, error: "El servidor no está configurado para recibir pagos." },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }

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
    clienteId: user.id,
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
