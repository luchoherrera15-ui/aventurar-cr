"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generarSlugUnico } from "@/lib/slug";
import { CATEGORIAS, PROVINCIAS, SUBCATEGORIAS } from "../types";
import { CATEGORIAS_CITAS } from "@/app/citas/tipos";

export type NuevoRanchoState = { error?: string } | undefined;

export async function crearRancho(
  _prevState: NuevoRanchoState,
  formData: FormData,
): Promise<NuevoRanchoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  // La vertical del negocio: eventos (default) o citas. Cualquier otra
  // cosa que llegue en el form cae a eventos.
  const vertical = formData.get("vertical") === "citas" ? "citas" : "eventos";
  const categoria = String(formData.get("categoria") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const provincia = String(formData.get("provincia") || "");
  const canton = String(formData.get("canton") || "").trim();
  const direccionExacta = String(formData.get("direccion_exacta") || "").trim();
  const capacidadMinRaw = String(formData.get("capacidad_min") || "");
  const capacidadMaxRaw = String(formData.get("capacidad_max") || "");
  const precioDesdeRaw = String(formData.get("precio_desde") || "");
  const contacto = String(formData.get("contacto_whatsapp") || "").trim();
  const subcategoria = String(formData.get("subcategoria") || "");

  // Verificación de identidad: obligatoria para poder ofrecer servicios
  // en el sitio (medida de seguridad contra empresas fantasma).
  const redSocialUrl = String(formData.get("red_social_url") || "").trim();
  const cedulaFrenteUrl = String(formData.get("cedula_frente_url") || "").trim();
  const cedulaDorsoUrl = String(formData.get("cedula_dorso_url") || "").trim();

  // Cada vertical tiene su propia lista de categorías.
  const categoriasValidas: readonly string[] =
    vertical === "citas" ? CATEGORIAS_CITAS : CATEGORIAS;
  if (
    !nombre ||
    !categoriasValidas.includes(categoria) ||
    !(PROVINCIAS as readonly string[]).includes(provincia)
  ) {
    return { error: "Completá al menos el tipo de servicio, el nombre y la provincia." };
  }

  if (!redSocialUrl || !cedulaFrenteUrl || !cedulaDorsoUrl) {
    return {
      error:
        "Por seguridad, necesitamos un link de tus redes y tu cédula por ambos lados para verificar tu negocio.",
    };
  }

  // Las subcategorías existen solo en eventos; en citas la categoría
  // ya es el rubro y la columna queda en null.
  if (vertical === "eventos") {
    const validas = SUBCATEGORIAS[categoria as keyof typeof SUBCATEGORIAS] ?? [];
    if (!validas.some((s) => s.id === subcategoria)) {
      return { error: "Elegí qué ofrecés exactamente dentro de esa categoría." };
    }
  }

  const slug = await generarSlugUnico(supabase, nombre);

  const { data, error } = await supabase
    .from("ranchos")
    .insert({
      owner_id: user.id,
      vertical,
      categoria,
      subcategoria: vertical === "citas" ? null : subcategoria,
      nombre,
      descripcion: descripcion || null,
      provincia,
      canton: canton || null,
      direccion_exacta: direccionExacta || null,
      capacidad_min: capacidadMinRaw ? parseInt(capacidadMinRaw) : null,
      capacidad_max: capacidadMaxRaw ? parseInt(capacidadMaxRaw) : null,
      precio_desde: precioDesdeRaw ? parseFloat(precioDesdeRaw) : null,
      contacto_whatsapp: contacto || null,
      estado: "pendiente",
      slug,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "No se pudo guardar tu rancho: " + error.message };
  }

  const { error: verifError } = await supabase.from("verificacion_proveedores").insert({
    rancho_id: data.id,
    red_social_url: redSocialUrl,
    cedula_frente_url: cedulaFrenteUrl,
    cedula_dorso_url: cedulaDorsoUrl,
  });
  if (verifError) {
    // El rancho ya se creó; que falte la verificación no puede perder
    // esa información — pero sin ella no queda pendiente de revisión
    // normal, así que se deja igual y el error queda visible arriba.
    return {
      error:
        "Tu negocio se guardó, pero no se pudo registrar la verificación: " +
        verifError.message +
        ". Escribinos a hola@bookea.lat para completarla.",
    };
  }

  // Quien entró como cliente (registro opcional desde el móvil) y publica
  // su primer negocio pasa a dueño de rancho — nunca al revés, y nunca
  // toca una cuenta que ya sea admin.
  await supabase
    .from("perfiles")
    .update({ rol: "dueno_rancho" })
    .eq("id", user.id)
    .eq("rol", "cliente");

  redirect(`/mi-rancho/${data.id}`);
}
