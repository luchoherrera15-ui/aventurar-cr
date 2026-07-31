import { createAdminClient } from "@/lib/supabase/admin";
import { sesionDesdeBearer } from "@/lib/supabase/bearer";

/**
 * El generador de invitaciones con IA, para la app móvil.
 *
 * En el sitio esto son server actions
 * (src/app/cuenta/invitaciones-generador-actions), que leen la sesión
 * de las cookies — algo que el app no tiene. Acá se hace lo mismo
 * autenticando por Bearer.
 *
 * Usa la service key porque la tabla `invitaciones` (migración 0066)
 * solo tiene políticas de SELECT: nadie escribe ahí desde el cliente,
 * ni en la web ni en el app. El dueño se verifica siempre — primero
 * con el token, y después filtrando `cliente_id` en la consulta.
 *
 * POST  → crea el borrador y devuelve su id
 * PATCH → publica la invitación (borrador → activa), con slug opcional
 *
 * La copia de vitrina (el catálogo público de ejemplos) NO se toca
 * desde acá a propósito: esa curación la hace el equipo desde la web.
 */

const SIN_SESION = "Entrá con tu cuenta.";
const SIN_SERVICE_KEY =
  "El servidor no está configurado para crear invitaciones (falta la service key).";

/** "Luis Herrera" → "luis-herrera" — el mismo criterio que la web. */
function normalizarSlug(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  const sesion = await sesionDesdeBearer(req);
  if (!sesion) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ ok: false, error: SIN_SERVICE_KEY }, { status: 500 });
  }

  // El slug definitivo lo elige la persona al publicar; este es solo
  // para que la fila exista mientras se genera.
  const slug = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const { data, error } = await admin
    .from("invitaciones")
    .insert({
      slug,
      cliente_id: sesion.usuarioId,
      titulo: "Nueva invitación",
      fecha_evento: new Date().toISOString().split("T")[0],
      tema: "clasico",
      estado: "borrador",
      estado_generacion: "pendiente",
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    console.error("[generador] No se pudo crear el borrador:", error?.message);
    return Response.json(
      { ok: false, error: "No pudimos empezar tu invitación. Intentá de nuevo." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, invitacionId: data.id, slug: data.slug });
}

export async function PATCH(req: Request) {
  const sesion = await sesionDesdeBearer(req);
  if (!sesion) {
    return Response.json({ ok: false, error: SIN_SESION }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ ok: false, error: SIN_SERVICE_KEY }, { status: 500 });
  }

  let cuerpo: { invitacionId?: unknown; slug?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Petición mal formada." }, { status: 400 });
  }

  const invitacionId = String(cuerpo.invitacionId ?? "");
  if (!invitacionId) {
    return Response.json({ ok: false, error: "Falta la invitación." }, { status: 400 });
  }

  const slugPedido = String(cuerpo.slug ?? "").trim();
  let slugNuevo: string | null = null;
  if (slugPedido) {
    slugNuevo = normalizarSlug(slugPedido);
    if (slugNuevo.length < 3) {
      return Response.json(
        { ok: false, error: "La dirección debe tener al menos 3 letras o números" },
        { status: 400 },
      );
    }
  }

  // Los tres filtros son el candado: tuya, y solo si terminó de generarse.
  const { data, error } = await admin
    .from("invitaciones")
    .update({ estado: "activa", ...(slugNuevo ? { slug: slugNuevo } : {}) })
    .eq("id", invitacionId)
    .eq("cliente_id", sesion.usuarioId)
    .eq("estado_generacion", "completado")
    .select("id, slug, estado")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return Response.json(
        { ok: false, error: "Esa dirección ya está ocupada — probá con otra" },
        { status: 409 },
      );
    }
    return Response.json(
      { ok: false, error: "No se pudo publicar (¿ya terminó la generación?)" },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, slug: data.slug });
}
