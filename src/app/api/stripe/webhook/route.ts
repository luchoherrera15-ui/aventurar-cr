import { after } from "next/server";
import { NextResponse } from "next/server";
import { verificarEventoStripe } from "@/lib/pagos/stripe";
import { puertaSupabase } from "@/lib/pagos/puerta-supabase";
import { procesarEventoStripe, type Puerta } from "@/lib/pagos/suscripciones";

/**
 * EL WEBHOOK DE STRIPE — la única puerta por la que se activa un plan.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO SE ACTIVA NADA EN LA PÁGINA DE ÉXITO
 * ------------------------------------------------------------------
 * Checkout devuelve al navegador a una `success_url`. Esa URL se
 * escribe a mano en la barra de direcciones: si el plan se activara
 * ahí, cualquiera se regalaría el paquete de $89 tecleando una
 * dirección. La página de éxito solo DICE «gracias»; quien activa es
 * este endpoint, y solo con un evento firmado por Stripe.
 *
 * ------------------------------------------------------------------
 * EL CUERPO SE LEE CRUDO, Y ESO NO ES OPCIONAL
 * ------------------------------------------------------------------
 * `await request.text()`, nunca `request.json()`. La firma se calcula
 * sobre los bytes exactos que Stripe mandó: parsear y volver a
 * serializar produce un JSON equivalente pero distinto byte a byte, y
 * entonces NINGUNA firma valida jamás. El síntoma —todos los eventos
 * dan 400— no apunta para nada al parseo, y es el error clásico de
 * este archivo.
 *
 * ------------------------------------------------------------------
 * QUÉ SE HACE ACÁ Y QUÉ SE HACE EN after()
 * ------------------------------------------------------------------
 * Stripe espera una respuesta rápida y reintenta si tarda. Pero las
 * escrituras de plata NO se pueden mandar a `after()`: si el trabajo
 * corre después de haber contestado 200, una falla de base queda sin
 * reintento posible —Stripe ya se dio por satisfecho— y el cobro
 * entrado se pierde sin activar.
 *
 * Así que se parte por costo: el registro del evento y las escrituras
 * (tres consultas cortas) van EN LÍNEA, para poder devolver 500 y que
 * Stripe reintente; y los CORREOS de aviso —lo único lento, una
 * llamada a Resend por cada destinatario— van a `after()`, donde
 * perder uno no cambia el estado de nada.
 */

// La firma se verifica con `node:crypto`: este endpoint es de Node, no
// de Edge. Y nunca se cachea: cada evento es distinto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. El cuerpo CRUDO, antes que nada.
  const cuerpo = await request.text();
  const firma = request.headers.get("stripe-signature");

  // 2. La firma. Sin firma válida: 400 y NADA más — ni un log del
  //    contenido, ni una fila, ni un correo. Un endpoint público que
  //    escribe algo antes de verificar es un endpoint que cualquiera
  //    usa para llenar la base.
  const evento = verificarEventoStripe(cuerpo, firma);
  if (!evento) {
    // Se registra que se rechazó (no QUÉ se rechazó): si el secreto
    // quedara mal configurado, todos los cobros dejarían de activarse
    // en silencio y esta línea es la única pista.
    console.error(
      "[stripe] Evento rechazado por firma inválida. Revisar STRIPE_WEBHOOK_SECRET " +
        "contra el signing secret del endpoint en dashboard.stripe.com/webhooks.",
    );
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  // 3. Con qué escribir. 503 (y no 200) a propósito: sin llaves no se
  //    procesó nada, y Stripe tiene que volver a intentarlo cuando el
  //    servidor esté configurado.
  const base = puertaSupabase();
  if (!base) {
    console.error(
      "[stripe] Evento verificado pero sin poder procesarlo: falta " +
        "SUPABASE_SERVICE_ROLE_KEY o STRIPE_SECRET_KEY.",
    );
    return NextResponse.json({ error: "El servidor no está configurado." }, { status: 503 });
  }

  // Los avisos por correo se van a `after()`: el motor los pide y sigue
  // sin esperarlos.
  const puerta: Puerta = {
    ...base,
    avisar: async (a) => {
      after(() => base.avisar(a));
    },
  };

  try {
    const resultado = await procesarEventoStripe(
      {
        id: evento.id,
        type: evento.type,
        data: { object: evento.data.object as unknown as Record<string, unknown> },
      },
      puerta,
    );
    console.log(`[stripe] ${evento.type} (${evento.id}) → ${resultado.tipo}`);
    return NextResponse.json({ ok: true, resultado: resultado.tipo });
  } catch (e) {
    // 500 = «volvé a mandarlo». El evento quedó anotado con
    // `procesado_en` en null, así que el reintento SÍ vuelve a entrar
    // en vez de rebotar contra la llave de idempotencia.
    console.error(`[stripe] Falló el procesamiento de ${evento.id} (${evento.type}):`, e);
    return NextResponse.json(
      { error: "No se pudo procesar el evento; reintentar." },
      { status: 500 },
    );
  }
}
