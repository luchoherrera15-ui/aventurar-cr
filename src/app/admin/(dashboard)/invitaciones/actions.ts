"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";

export type DatosInvitacion = {
  slug: string;
  titulo: string;
  anfitriones: string | null;
  mensaje: string | null;
  fechaEvento: string;
  hora: string | null;
  lugarNombre: string | null;
  direccion: string | null;
  mapsUrl: string | null;
  portadaUrl: string | null;
  htmlPersonalizado: string | null;
  tema: string;
  estado: "borrador" | "activa";
  /** Correo del cliente dueño (se busca en perfiles); vacío = sin asignar. */
  clienteCorreo: string | null;
};

/** "La boda de Sofía & Andrés" → "la-boda-de-sofia-andres". */
function normalizarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Arma la fila para la base a partir del formulario. Resuelve el
 * cliente por correo contra perfiles — si el correo no corresponde a
 * ninguna cuenta devuelve error en vez de guardar a medias.
 */
async function prepararFila(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  datos: DatosInvitacion,
) {
  const titulo = datos.titulo.trim();
  if (!titulo) return { error: "La invitación necesita un título.", fila: null };
  if (!datos.fechaEvento) return { error: "Falta la fecha del evento.", fila: null };

  const slug = normalizarSlug(datos.slug.trim() || titulo);
  if (!slug) return { error: "Ese slug no sirve — probá con letras y números.", fila: null };

  let clienteId: string | null = null;
  const correo = datos.clienteCorreo?.trim().toLowerCase() || null;
  if (correo) {
    const { data: perfil } = await admin
      .from("perfiles")
      .select("id")
      .ilike("email", correo)
      .maybeSingle();
    if (!perfil) {
      return {
        error: `No hay ninguna cuenta con el correo ${correo}. Crearla primero en Cuentas.`,
        fila: null,
      };
    }
    clienteId = perfil.id as string;
  }

  return {
    error: null,
    fila: {
      slug,
      titulo,
      cliente_id: clienteId,
      anfitriones: datos.anfitriones?.trim() || null,
      mensaje: datos.mensaje?.trim() || null,
      fecha_evento: datos.fechaEvento,
      hora: datos.hora?.trim() || null,
      lugar_nombre: datos.lugarNombre?.trim() || null,
      direccion: datos.direccion?.trim() || null,
      maps_url: datos.mapsUrl?.trim() || null,
      portada_url: datos.portadaUrl?.trim() || null,
      html_personalizado: datos.htmlPersonalizado?.trim() || null,
      tema: datos.tema.trim() || "clasico",
      estado: datos.estado,
    },
  };
}

function refrescar(slug: string) {
  revalidatePath("/admin/invitaciones");
  revalidatePath(`/i/${slug}`);
  revalidatePath("/cuenta");
}

/** Crea (id null) o actualiza una invitación. Solo el equipo admin. */
export async function guardarInvitacion(id: string | null, datos: DatosInvitacion) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { error: errorFila, fila } = await prepararFila(admin, datos);
  if (errorFila || !fila) return { error: errorFila };

  const { error } = id
    ? await admin.from("invitaciones").update(fila).eq("id", id)
    : await admin.from("invitaciones").insert(fila);

  if (error) {
    if (error.code === "23505") {
      return { error: `El slug "${fila.slug}" ya está en uso — elegí otro.` };
    }
    return { error: error.message };
  }

  refrescar(fila.slug);
  return { error: null };
}

/** Archiva (o reactiva) una invitación: el link deja de ser público. */
export async function archivarInvitacion(id: string, archivar: boolean) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data, error } = await admin
    .from("invitaciones")
    .update({ estado: archivar ? "archivada" : "activa" })
    .eq("id", id)
    .select("slug")
    .single();

  if (error) return { error: error.message };

  refrescar(data.slug as string);
  return { error: null };
}
