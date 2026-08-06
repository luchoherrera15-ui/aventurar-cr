"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";

export type NuevoUsuarioState = { error?: string; ok?: string } | undefined;

export async function crearUsuario(
  _prevState: NuevoUsuarioState,
  formData: FormData,
): Promise<NuevoUsuarioState> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const nombre = String(formData.get("nombre") || "").trim();

  if (!email || password.length < 6) {
    return {
      error: "Hace falta un correo y una contraseña de al menos 6 caracteres.",
    };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (error) {
    if (/already/i.test(error.message)) {
      return { error: "Ya existe una cuenta con ese correo." };
    }
    return { error: "No se pudo crear la cuenta: " + error.message };
  }

  revalidatePath("/admin/usuarios");
  return { ok: `Cuenta creada para ${email}.` };
}

/**
 * Cambia el rango de una cuenta. Solo un admin, y con dos frenos que
 * antes no existían:
 *
 *  · nadie se baja a sí mismo — es la forma más fácil de perder el
 *    panel sin querer, y recuperarlo pide entrar a la base a mano;
 *  · no se puede quitar el último admin, aunque sea otro quien lo
 *    intente. Ese freno lo pone también un trigger de la base (0086),
 *    porque una regla de negocio que solo vive en la interfaz se salta
 *    llamando a la acción por su id.
 */
export async function cambiarRol(
  id: string,
  rol: "admin" | "dueno_rancho" | "cliente",
) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === id && rol !== "admin") {
    return {
      error:
        "No podés quitarte a vos mismo el rol de administrador. Pedile a otro admin que lo haga.",
    };
  }

  const { error } = await supabase.from("perfiles").update({ rol }).eq("id", id);
  if (error) {
    // El trigger de la 0086 avisa en español cuando se intenta dejar la
    // plataforma sin ningún administrador.
    return { error: error.message };
  }

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function cambiarEmail(id: string, email: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const limpio = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) {
    return { error: "Ese correo no parece válido." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // email_confirm deja el correo nuevo ya verificado, para que el dueño
  // pueda entrar de una sin tener que abrir un link de confirmación.
  const { error } = await admin.auth.admin.updateUserById(id, {
    email: limpio,
    email_confirm: true,
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: "Ya existe una cuenta con ese correo." };
    }
    return { error: "No se pudo cambiar el correo: " + error.message };
  }

  // El trigger que llena `perfiles` solo corre al crear la cuenta, así que
  // la tabla se actualiza acá o la lista quedaría mostrando el correo viejo.
  const { error: errorPerfil } = await supabase
    .from("perfiles")
    .update({ email: limpio })
    .eq("id", id);

  if (errorPerfil) {
    return {
      error:
        "El correo de acceso se cambió, pero no se pudo actualizar la lista: " +
        errorPerfil.message,
    };
  }

  revalidatePath("/admin/usuarios");
  return { error: null };
}

/**
 * Genera un código de acceso de 6 dígitos para una CUENTA DEMO — el
 * mismo que Supabase mandaría por correo, solo que los buzones
 * *.demo@bookea.lat no existen y el código no llega nunca. Solo un
 * admin puede pedirlo, y SOLO para correos demo: sin ese freno, esta
 * acción serviría para entrar a la cuenta de cualquier usuario.
 *
 * Ojo con el orden: el formulario de login manda su propio código al
 * tocar "Enviarme el código", y cada código nuevo invalida el anterior
 * — por eso hay que generar ESTE después de ese paso, no antes.
 */
export async function generarCodigoDemo(email: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const limpio = email.trim().toLowerCase();
  if (!/^[a-z0-9._+-]+\.demo@bookea\.lat$/.test(limpio)) {
    return { error: "Esto solo funciona con cuentas demo (*.demo@bookea.lat)." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: limpio,
  });
  if (error || !data?.properties?.email_otp) {
    return { error: "No se pudo generar el código: " + (error?.message ?? "sin respuesta") };
  }

  return { codigo: data.properties.email_otp };
}

export async function cambiarPassword(id: string, password: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (password.length < 6) {
    return { error: "La contraseña necesita al menos 6 caracteres." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // email_confirm también, igual que en cambiarEmail: si la cuenta se
  // registró sola y nunca confirmó el correo (link a spam, etc.), Supabase
  // bloquea el login con "Email not confirmed" sin importar que la
  // contraseña sea la correcta. Un reseteo de contraseña desde acá es
  // justamente para destrabar una cuenta, así que de paso la confirma.
  const { error } = await admin.auth.admin.updateUserById(id, {
    password,
    email_confirm: true,
  });
  if (error) {
    return { error: "No se pudo cambiar la contraseña: " + error.message };
  }

  return { error: null };
}
