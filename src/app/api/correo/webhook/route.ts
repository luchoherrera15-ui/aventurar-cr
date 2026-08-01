import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * El webhook de Resend: cuando un correo rebota (buzón inexistente,
 * lleno) o el destinatario lo marca como spam, Resend avisa acá y el
 * correo entra a `supresiones_correo` (0082) — no se le vuelve a
 * mandar marketing. Insistirle a un buzón que rebota quema la
 * reputación del dominio entero.
 *
 * Configuración (una vez): en resend.com/webhooks crear un endpoint
 * apuntando a https://www.bookea.lat/api/correo/webhook con los
 * eventos `email.bounced` y `email.complained`, y poner el signing
 * secret (whsec_…) en la variable RESEND_WEBHOOK_SECRET de Vercel.
 *
 * La firma es el esquema de Svix (que Resend usa): HMAC-SHA256 en
 * base64 sobre `{svix-id}.{svix-timestamp}.{cuerpo}` con el secreto
 * decodificado de base64. Se verifica a mano para no sumar una
 * dependencia por tres líneas de crypto.
 */

const TOLERANCIA_SEGUNDOS = 5 * 60;

function verificarFirmaSvix(request: Request, cuerpo: string): boolean {
  const secreto = process.env.RESEND_WEBHOOK_SECRET;
  if (!secreto) return false;

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const firmas = request.headers.get("svix-signature");
  if (!id || !timestamp || !firmas) return false;

  // Un aviso demasiado viejo (o del futuro) no se acepta: frena el
  // replay de un aviso capturado.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCIA_SEGUNDOS) {
    return false;
  }

  const llave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", llave)
    .update(`${id}.${timestamp}.${cuerpo}`)
    .digest("base64");
  const esperadaBuf = Buffer.from(esperada);

  // La cabecera trae una o varias firmas "v1,<base64>" separadas por
  // espacio (rotación de secretos): con que una calce, es legítima.
  return firmas.split(" ").some((parte) => {
    const [version, firma] = parte.split(",");
    if (version !== "v1" || !firma) return false;
    const firmaBuf = Buffer.from(firma);
    return firmaBuf.length === esperadaBuf.length && timingSafeEqual(firmaBuf, esperadaBuf);
  });
}

export async function POST(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Falta RESEND_WEBHOOK_SECRET en las variables de entorno." },
      { status: 503 },
    );
  }

  const cuerpo = await request.text();
  if (!verificarFirmaSvix(request, cuerpo)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let evento: {
    type?: string;
    data?: {
      to?: string[] | string;
      bounce?: { message?: string; type?: string; subType?: string };
    };
  };
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  // Solo los rebotes PERMANENTES (buzón inexistente) suprimen. Un
  // 'Transient' es la casilla llena o el servidor caído, y un
  // 'Undetermined' es justamente eso — indeterminado: esa persona
  // puede existir y recibir bien mañana. Suprimirla de por vida por
  // un mal día sería perderla para siempre, así que solo se actúa
  // cuando Resend lo dice explícitamente. (Los tipos vienen de SES:
  // Permanent | Transient | Undetermined; un payload sin `type` se
  // trata como permanente para no quedarnos ciegos ante un buzón
  // muerto de verdad.)
  const tipoRebote = evento.data?.bounce?.type?.toLowerCase();
  const rebotePermanente =
    evento.type === "email.bounced" &&
    (tipoRebote === undefined || tipoRebote === "permanent");

  const motivo = rebotePermanente
    ? "rebote"
    : evento.type === "email.complained"
      ? "queja"
      : null;
  // Los demás eventos (delivered, opened, rebotes transitorios…)
  // todavía no se registran.
  if (!motivo) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno." },
      { status: 500 },
    );
  }

  const destinatarios = Array.isArray(evento.data?.to)
    ? evento.data.to
    : evento.data?.to
      ? [evento.data.to]
      : [];

  let fallidos = 0;
  for (const to of destinatarios) {
    const correo = to.trim().toLowerCase();
    if (!correo.includes("@")) continue;
    // upsert: si ya estaba suprimido, el motivo nuevo no pisa al viejo
    // (el primero que lo suprimió ya es razón suficiente).
    const { error } = await admin
      .from("supresiones_correo")
      .upsert(
        {
          correo,
          motivo,
          detalle: evento.data?.bounce?.message?.slice(0, 400) ?? null,
        },
        { onConflict: "correo", ignoreDuplicates: true },
      );
    if (error) {
      fallidos += 1;
      console.error(`[correo] No se pudo suprimir ${correo} (${motivo}): ${error.message}`);
    }
  }

  // Un 500 hace que Resend reintente el aviso — es lo que queremos si
  // la escritura falló: mejor un reintento que un rebote perdido.
  if (fallidos > 0) {
    return NextResponse.json({ error: "No se pudieron registrar las supresiones." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
