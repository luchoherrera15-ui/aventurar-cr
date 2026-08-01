import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import ClientePage from "./cliente-page";

// Los server actions de esta página disparan la generación con IA
// (minutos): sin esto, Vercel corta la función a mitad de camino.
export const maxDuration = 300;

/**
 * La herramienta con la que el equipo genera invitaciones. Vive bajo
 * /cuenta por historia — el panel la abre desde su pestaña de
 * Invitaciones — pero es de admin, no del cliente.
 *
 * Antes alcanzaba con estar logueado: cualquiera que se creara una
 * cuenta entraba acá y quemaba tokens de Opus a costa de la casa. Las
 * rutas que hay detrás (chat, generador, generar-con-ia) ya exigen
 * admin; esto evita además que alguien vea una pantalla que va a
 * responderle 403 en cada botón.
 */
export default async function PaginaCreadorInvitaciones() {
  const { ok } = await requireAdmin();
  if (!ok) redirect("/cuenta");

  return <ClientePage />;
}
