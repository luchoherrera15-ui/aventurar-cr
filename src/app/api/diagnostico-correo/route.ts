import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

/**
 * "¿Por qué no llega el correo?" — en vez de adivinar mirando logs de
 * Vercel, esto lo responde de una.
 *
 * Solo funciona con sesión iniciada y el correo de prueba se manda
 * SIEMPRE a la dirección de la propia cuenta, nunca a una que venga en
 * el pedido. Así no sirve para mandarle correos a nadie más, ni siquiera
 * si alguien le pega desde afuera con una sesión válida.
 *
 * Nunca devuelve el valor de una llave: solo si está puesta, y el error
 * exacto que contesta Resend cuando el envío falla — que es el dato que
 * de verdad hace falta ("API key inválida", "dominio no verificado",
 * "solo podés mandarte correos a vos mismo", etc.).
 *
 * Uso: iniciá sesión en el sitio y abrí /api/diagnostico-correo
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      {
        error:
          "Necesitás iniciar sesión en el sitio para usar esto. El correo de prueba se manda a la dirección de tu propia cuenta.",
      },
      { status: 401 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM_EMAIL;

  // Que la variable exista no alcanza: una llave mal pegada "existe"
  // pero falla en silencio, y con ella se caen TODOS los correos de
  // reserva (el reclamo de la bandera pasa por el cliente admin). Acá
  // se prueba con una consulta real.
  const admin = createAdminClient();
  let servicioSupabase: string;
  if (!admin) {
    servicioSupabase =
      "FALTA — sin esto no sale ningún correo de reserva (ni al cliente ni al dueño)";
  } else {
    const { error: errorAdmin } = await admin
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .limit(1);
    servicioSupabase = errorAdmin
      ? `puesta pero NO FUNCIONA — la base la rechaza: "${errorAdmin.message}". Casi seguro se pegó una llave equivocada (tiene que ser la Secret key, sb_secret_...) o quedó con un espacio.`
      : "puesta y funcionando";
  }

  const configuracion = {
    RESEND_API_KEY: apiKey
      ? `puesta (empieza con "${apiKey.slice(0, 3)}", ${apiKey.length} caracteres)`
      : "FALTA — sin esto no se envía ningún correo",
    RESEND_FROM_EMAIL: remitente
      ? remitente
      : 'FALTA — se usa "Bookea <onboarding@resend.dev>", que SOLO entrega a la casilla dueña de la cuenta de Resend',
    SUPABASE_SERVICE_ROLE_KEY: servicioSupabase,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ?? "sin definir (se usa https://bookea.lat)",
  };

  if (!apiKey) {
    return NextResponse.json({
      destinatario: user.email,
      configuracion,
      envio: "no se intentó: falta RESEND_API_KEY",
    });
  }

  // Acá no se usa enviarCorreo() a propósito: esa función se traga los
  // errores para que un correo caído nunca tumbe una reserva, y el error
  // es justo lo que queremos ver.
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: remitente || "Bookea <onboarding@resend.dev>",
    to: user.email,
    subject: "Prueba de correo de Bookea",
    html: "<p>Si estás leyendo esto, el envío de correos de Bookea funciona.</p>",
  });

  return NextResponse.json({
    destinatario: user.email,
    configuracion,
    envio: error
      ? { ok: false, error }
      : { ok: true, id: data?.id, nota: "Resend lo aceptó. Revisá tu bandeja y el spam." },
  });
}
