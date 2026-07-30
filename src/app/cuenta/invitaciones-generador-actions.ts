"use server";

import { headers } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Server actions para el panel creador de invitaciones.
 * Llamadas desde componentes React del lado del cliente.
 *
 * La tabla `invitaciones` solo permite SELECT vía RLS (0066: "solo el
 * service role escribe"), así que acá se verifica la sesión con el
 * cliente de cookies y se escribe con el service role, siempre
 * amarrado al cliente_id del usuario autenticado.
 */

/** Cliente service-role (solo servidor; jamás llega al navegador). */
function adminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** El usuario autenticado del request, o null. */
async function usuarioActual() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Origen (protocolo + host) del request actual, para llamar a nuestras
 * propias rutas API tanto en localhost como en producción (Vercel).
 */
async function origenApp(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Obtiene los detalles de una invitación del usuario autenticado.
 */
export async function obtenerInvitacion(invitacionId: string) {
  const user = await usuarioActual();
  if (!user) {
    return { error: "No autenticado" };
  }

  const { data, error } = await adminSupabase()
    .from("invitaciones")
    .select("*")
    .eq("id", invitacionId)
    .eq("cliente_id", user.id)
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data };
}

/**
 * Crea una invitación borrador vacía para el panel creador.
 * El cliente_id se toma de la sesión.
 */
export async function crearInvitacionBorrador() {
  const user = await usuarioActual();
  if (!user) {
    return { error: "No autenticado" };
  }

  // Generar slug único
  const slug = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const { data, error } = await adminSupabase()
    .from("invitaciones")
    .insert({
      slug,
      cliente_id: user.id,
      titulo: "Nueva invitación",
      fecha_evento: new Date().toISOString().split("T")[0],
      tema: "clasico",
      estado: "borrador",
      estado_generacion: "pendiente",
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data };
}

/**
 * Calcula el costo estimado de generar una invitación.
 * No gasta tokens, solo los cuenta (endpoint count_tokens).
 */
export async function estimarCostoPreview(
  prompt: string,
  modelo: "opus" | "fable" = "opus"
) {
  try {
    const res = await fetch(
      `${await origenApp()}/api/invitaciones/preview-token-count`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, modelo }),
      }
    );

    if (!res.ok) {
      const error = (await res.json()) as Record<string, unknown>;
      return { error: (error.error as string) || "Error al estimar costo" };
    }

    const data = await res.json();
    return data;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Error desconocido";
    return { error: errorMsg };
  }
}

/**
 * Genera la invitación con IA.
 * Requiere token autenticado en el header.
 */
export async function generarConIA(
  invitacionId: string,
  prompt: string,
  modelo: "opus" | "fable",
  config_ia?: Record<string, unknown>,
  imagenes_urls?: string[],
  videos_urls?: string[]
) {
  const supabase = await createServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "No autenticado" };
  }

  try {
    const res = await fetch(
      `${await origenApp()}/api/invitaciones/generar-con-ia`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          invitacion_id: invitacionId,
          prompt,
          modelo,
          config_ia,
          imagenes_urls,
          videos_urls,
        }),
      }
    );

    if (!res.ok) {
      const error = (await res.json()) as Record<string, unknown>;
      return { error: (error.error as string) || "Error al generar" };
    }

    const data = await res.json();
    return data;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Error desconocido";
    return { error: errorMsg };
  }
}

/**
 * Publica una invitación generada: pasa de "borrador" a "activa" para
 * que /i/{slug} la muestre al público. Solo el dueño, y solo si la
 * generación terminó bien.
 */
export async function publicarInvitacion(invitacionId: string) {
  const user = await usuarioActual();
  if (!user) {
    return { error: "No autenticado" };
  }

  const { data, error } = await adminSupabase()
    .from("invitaciones")
    .update({ estado: "activa" })
    .eq("id", invitacionId)
    .eq("cliente_id", user.id)
    .eq("estado_generacion", "completado")
    .select("id, slug, estado")
    .single();

  if (error) {
    return { error: "No se pudo publicar (¿ya terminó la generación?)" };
  }

  return { data };
}

/**
 * Actualiza campos de una invitación del usuario autenticado.
 */
export async function actualizarInvitacion(
  invitacionId: string,
  updates: Record<string, unknown>
) {
  const user = await usuarioActual();
  if (!user) {
    return { error: "No autenticado" };
  }

  const { data, error } = await adminSupabase()
    .from("invitaciones")
    .update(updates)
    .eq("id", invitacionId)
    .eq("cliente_id", user.id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { data };
}

/**
 * Lista todas las invitaciones del usuario autenticado.
 */
export async function listarInvitacionesDeUsuario() {
  const user = await usuarioActual();
  if (!user) {
    return { error: "No autenticado" };
  }

  const { data, error } = await adminSupabase()
    .from("invitaciones")
    .select(
      "id, slug, titulo, fecha_evento, estado, estado_generacion, costo_usd, modelo_usado, costo_tokens_input, costo_tokens_output, created_at"
    )
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  return { data };
}
