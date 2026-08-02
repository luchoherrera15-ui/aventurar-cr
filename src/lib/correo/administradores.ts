import { enviarCorreo } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A quién le avisa Bookea cuando entra algo que alguien tiene que
 * atender (hoy: los pedidos de invitación).
 *
 * Antes esto era UNA variable de entorno, `BOOKEA_CORREO_PEDIDOS`. El
 * problema no es que sea poco elegante: es que si nadie la configuró en
 * Vercel, el aviso no sale y **no se nota** — el pedido queda esperando
 * en una pestaña que hay que acordarse de abrir. Por eso la lista de
 * verdad son los administradores de la plataforma (`perfiles.rol =
 * 'admin'`), que siempre existen porque son los que entran al panel.
 *
 * La variable de entorno sigue valiendo y se suma a la lista: sirve para
 * mandar una copia a un correo compartido del equipo que no es una
 * cuenta de Bookea. Acepta varios separados por coma.
 *
 * Se lee con la llave de servicio porque `perfiles` está bajo RLS y este
 * código corre sin sesión de nadie (sale de un `after()`, después de
 * responderle al cliente).
 */
export async function correosDeAdministradores(): Promise<string[]> {
  const extra = (process.env.BOOKEA_CORREO_PEDIDOS ?? "")
    .split(/[,;\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.includes("@"));

  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      "[correo] Sin SUPABASE_SERVICE_ROLE_KEY no se puede leer la lista de administradores.",
    );
    return [...new Set(extra)];
  }

  const { data, error } = await admin
    .from("perfiles")
    .select("email")
    .eq("rol", "admin");

  if (error) {
    console.error("[correo] No se pudo leer la lista de administradores:", error.message);
  }

  const deLaBase = (data ?? [])
    .map((p) => String(p.email ?? "").trim().toLowerCase())
    .filter((c) => c.includes("@"));

  // Set: si el correo del dueño está además en la variable de entorno,
  // no le llegan dos copias del mismo aviso.
  return [...new Set([...deLaBase, ...extra])];
}

/**
 * Manda un aviso interno a todos los administradores. Nunca lanza: un
 * correo que no sale no puede tumbar la operación que ya se guardó.
 *
 * Devuelve cuántos salieron para poder dejarlo en el log — si un día el
 * equipo dice "no me llegó nada", el número dice si el problema fue la
 * lista (0 destinatarios) o Resend.
 */
export async function avisarAAdministradores({
  subject,
  html,
}: {
  subject: string;
  html: string;
}): Promise<{ destinatarios: number; enviados: number }> {
  let destinos: string[] = [];
  try {
    destinos = await correosDeAdministradores();
  } catch (e) {
    console.error("[correo] No se pudo armar la lista de administradores:", e);
    return { destinatarios: 0, enviados: 0 };
  }

  if (destinos.length === 0) {
    console.warn(`[correo] Nadie a quien avisar "${subject}": no hay administradores.`);
    return { destinatarios: 0, enviados: 0 };
  }

  const resultados = await Promise.allSettled(
    destinos.map((to) => enviarCorreo({ to, subject, html })),
  );

  const enviados = resultados.filter(
    (r) => r.status === "fulfilled" && r.value.enviado,
  ).length;

  if (enviados < destinos.length) {
    console.error(
      `[correo] "${subject}": salieron ${enviados} de ${destinos.length} avisos a administradores.`,
    );
  }

  return { destinatarios: destinos.length, enviados };
}
