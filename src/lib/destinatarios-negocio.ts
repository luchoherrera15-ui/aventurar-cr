import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type DestinatarioNegocio = {
  id: string;
  email: string;
  nombre: string | null;
};

/**
 * QUIÉNES RECIBEN LOS AVISOS DE UN NEGOCIO (pedido del dueño, 2 sep
 * 2026): el dueño Y los colaboradores seteados (rancho_colaboradores,
 * 0116) — antes los correos de reserva/cita nueva le llegaban SOLO al
 * owner, y el administrador que de verdad atiende el local se enteraba
 * tarde o nunca.
 *
 * Una sola consulta a `perfiles` con todos los ids juntos; sin correo
 * en el perfil no hay destinatario (no se inventa nada). Si la 0116 no
 * está aplicada, la consulta de colaboradores falla en silencio y
 * queda solo el dueño — el comportamiento de siempre.
 */
export async function destinatariosDelNegocio(
  admin: Admin,
  ranchoId: string,
  ownerId: string | null,
): Promise<DestinatarioNegocio[]> {
  const ids = new Set<string>();
  if (ownerId) ids.add(ownerId);

  const { data: colabs } = await admin
    .from("rancho_colaboradores")
    .select("usuario_id")
    .eq("rancho_id", ranchoId);
  for (const c of (colabs ?? []) as { usuario_id: string | null }[]) {
    if (c.usuario_id) ids.add(c.usuario_id);
  }
  if (ids.size === 0) return [];

  const { data: perfiles } = await admin
    .from("perfiles")
    .select("id, nombre, email")
    .in("id", [...ids]);

  return ((perfiles ?? []) as { id: string; nombre: string | null; email: string | null }[])
    .filter((p): p is { id: string; nombre: string | null; email: string } =>
      Boolean(p.email && p.email.trim()),
    )
    .map((p) => ({ id: p.id, email: p.email, nombre: p.nombre }));
}
