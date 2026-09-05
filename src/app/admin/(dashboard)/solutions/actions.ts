"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { ADDONS, esAddon, type AddonId } from "@/lib/solutions/addons";
import { generarSlugSolutions } from "@/lib/solutions/slug";
import { TOPES } from "@/lib/solutions/tipos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  DEJARLE EL NEGOCIO LISTO A UN CLIENTE, DESDE LA ADMINISTRACIÓN
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (5 sep 2026): «que no tenga que ser el cliente el
 * que crea la cuenta: yo pongo su correo, y cuando entre por primera
 * vez ya tiene la cuenta hecha y el paquete listo — igual se le pide
 * nombre y teléfono. Así yo les configuro su tarjeta, su menú, sus
 * enlaces».
 *
 * ── LA CUENTA NACE CON EL CORREO, IGUAL QUE EN LEALTAD ─────────────
 * Es el mismo criterio de /admin/lealtad/nuevo (1 sep 2026): si el
 * correo ya tiene cuenta, se usa; si no, se crea CONFIRMADA y sin
 * contraseña, y la persona entra por un enlace mágico y elige la suya.
 * Ponerle una contraseña acá obligaría a decírsela por WhatsApp, que
 * es la peor forma de repartir una credencial. Nombre y teléfono se
 * los pide el panel en su primer ingreso (completar-perfil.tsx), y
 * hasta que no los deje no ve nada más.
 *
 * ── EL NEGOCIO ES IDÉNTICO AL DEL ALTA PÚBLICA ─────────────────────
 * Misma tabla, mismo slug, mismo linkhub incluido; lo único que cambia
 * es `origen: 'admin'` y `creado_por`, para saber quién lo armó. Los
 * add-ons se dejan prendidos según lo que se haya vendido (hoy sin
 * precio: es prueba).
 */

export type ResultadoAltaSolutions =
  | {
      ok: true;
      negocioId: string;
      slug: string;
      /** true = la cuenta no existía y se creó en el momento. */
      cuentaNueva: boolean;
      /** El enlace de primer ingreso (solo cuenta nueva). */
      enlaceDeEntrada: string | null;
    }
  | { ok: false; motivo: string };

function correoLimpio(valor: string): string | null {
  const c = (valor ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) ? c : null;
}

export async function crearNegocioSolutionsDesdeAdmin(datos: {
  correo: string;
  nombrePersona: string;
  telefono: string;
  nombreNegocio: string;
  addons: Partial<Record<AddonId, boolean>>;
}): Promise<ResultadoAltaSolutions> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };
  const {
    data: { user: quienCrea },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: FALTA_SERVICE_KEY };

  const nombre = (datos.nombreNegocio ?? "").trim().slice(0, TOPES.nombre);
  if (nombre.length < 2) return { ok: false, motivo: "Escribí el nombre del negocio." };
  const correo = correoLimpio(datos.correo);
  if (!correo) return { ok: false, motivo: "Ese correo no se ve bien. Revisalo." };
  const telefono = (datos.telefono ?? "").replace(/\D/g, "");
  if (telefono && (telefono.length < 8 || telefono.length > 15)) {
    return { ok: false, motivo: "El teléfono tiene que tener entre 8 y 15 dígitos, o quedar vacío." };
  }

  // ── La cuenta ───────────────────────────────────────────────────
  const { data: perfil } = await admin.from("perfiles").select("id").eq("email", correo).maybeSingle();
  let ownerId = (perfil?.id as string | undefined) ?? null;
  let cuentaNueva = false;
  if (!ownerId) {
    const { data: creada, error } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: {
        nombre: datos.nombrePersona.trim() || null,
        whatsapp: telefono || null,
      },
    });
    if (error || !creada.user) return { ok: false, motivo: "No se pudo crear la cuenta: " + (error?.message ?? "sin respuesta") };
    ownerId = creada.user.id;
    cuentaNueva = true;
  }

  // ── El negocio, igual que el alta pública ───────────────────────
  const slug = await generarSlugSolutions(admin, nombre);
  const { data: negocio, error: eNegocio } = await admin
    .from("solutions_negocios")
    .insert({ owner_id: ownerId, nombre, slug, origen: "admin", creado_por: quienCrea?.id ?? null })
    .select("id")
    .single();
  if (eNegocio || !negocio) return { ok: false, motivo: "No se pudo crear el negocio: " + (eNegocio?.message ?? "sin respuesta") };

  // ── Los add-ons que se vendieron (hoy sin precio) ───────────────
  // Todas las filas con LAS MISMAS claves: PostgREST rechaza un lote
  // con claves distintas (PGRST102).
  const ahora = new Date().toISOString();
  const filas = ADDONS.map((a) => {
    const activo = a === "linkhub" || datos.addons?.[a] === true;
    return {
      negocio_id: negocio.id as string,
      addon: a,
      activo,
      activado_en: activo ? ahora : null,
      vence_en: null,
      notas: a === "linkhub" ? "incluido" : activo ? "dejado listo por Bookea (prueba)" : null,
    };
  });
  await admin.from("solutions_addons").insert(filas);

  // ── Cómo entra la persona ───────────────────────────────────────
  let enlaceDeEntrada: string | null = null;
  if (cuentaNueva) {
    const { data: enlace } = await admin.auth.admin.generateLink({ type: "magiclink", email: correo });
    enlaceDeEntrada = enlace?.properties?.action_link ?? null;
  }

  revalidatePath("/admin/solutions");
  return { ok: true, negocioId: negocio.id as string, slug, cuentaNueva, enlaceDeEntrada };
}

/** Prender o apagar un add-on de cualquier negocio, desde el admin. */
export async function cambiarAddonDesdeAdmin(
  negocioId: string,
  addon: string,
  activo: boolean,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { ok } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: FALTA_SERVICE_KEY };
  if (!esAddon(addon) || addon === "linkhub") return { ok: false, motivo: "Ese complemento no se toca." };

  const fila: Record<string, unknown> = { negocio_id: negocioId, addon, activo, vence_en: null };
  if (activo) {
    fila.activado_en = new Date().toISOString();
    fila.notas = "prendido desde el admin (prueba)";
  }
  const { error } = await admin.from("solutions_addons").upsert(fila, { onConflict: "negocio_id,addon" });
  if (error) return { ok: false, motivo: "No se pudo cambiar el complemento." };
  revalidatePath("/admin/solutions");
  revalidatePath(`/solutions/panel/${negocioId}`);
  return { ok: true };
}

/** Un enlace mágico nuevo para quien todavía no entró (o perdió el suyo). */
export async function enlaceDeEntradaDesdeAdmin(correo: string): Promise<{ ok: true; enlace: string } | { ok: false; motivo: string }> {
  const { ok } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "No tenés permiso para esto." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: FALTA_SERVICE_KEY };
  const limpio = correoLimpio(correo);
  if (!limpio) return { ok: false, motivo: "Ese correo no se ve bien." };
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: limpio });
  const enlace = data?.properties?.action_link ?? null;
  if (error || !enlace) return { ok: false, motivo: "No se pudo generar el enlace: " + (error?.message ?? "sin respuesta") };
  return { ok: true, enlace };
}
