"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { PROVINCIAS, SUBCATEGORIAS } from "@/app/mi-negocio/types";
import {
  esCategoriaValida,
  subcategoriasDe,
  usaSubcategoria,
  type VerticalNegocio,
} from "@/lib/categorias-vertical";
import { generarSlugUnico } from "@/lib/slug";
import { tipoNegocioDeAlta } from "@/lib/business/tipo-en-alta";

export type NuevoRanchoAdminState = { error?: string } | undefined;

export async function crearRanchoComoAdmin(
  _prevState: NuevoRanchoAdminState,
  formData: FormData,
): Promise<NuevoRanchoAdminState> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const modoDueno = String(formData.get("modo_dueno") || "existente");
  let ownerId = String(formData.get("owner_id") || "");

  // Opción A: crear la cuenta del dueño en el momento.
  if (modoDueno === "nuevo") {
    const email = String(formData.get("nuevo_email") || "").trim();
    const password = String(formData.get("nuevo_password") || "");
    const nombreDueno = String(formData.get("nuevo_nombre") || "").trim();

    if (!email || password.length < 6) {
      return {
        error:
          "Para crear la cuenta hacen falta un correo y una contraseña de al menos 6 caracteres.",
      };
    }

    const admin = createAdminClient();
    if (!admin) return { error: FALTA_SERVICE_KEY };

    const { data: creado, error: errCuenta } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombreDueno },
    });

    if (errCuenta || !creado.user) {
      return {
        error: "No se pudo crear la cuenta: " + (errCuenta?.message ?? ""),
      };
    }
    ownerId = creado.user.id;
  }

  if (!ownerId) {
    return { error: "Elegí un dueño para el negocio o creá una cuenta nueva." };
  }

  // La vertical elegida en el Paso 2: cualquier valor raro cae a
  // eventos, igual que en mi-negocio/nuevo/actions.ts.
  const verticalRaw = String(formData.get("vertical") || "");
  const vertical = (
    ["citas", "hospedajes", "restaurantes"].includes(verticalRaw)
      ? verticalRaw
      : "eventos"
  ) as VerticalNegocio;

  const categoria = String(formData.get("categoria") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const provincia = String(formData.get("provincia") || "");
  if (
    !nombre ||
    !esCategoriaValida(vertical, categoria) ||
    !(PROVINCIAS as readonly string[]).includes(provincia)
  ) {
    return { error: "Completá al menos la categoría, el nombre y la provincia." };
  }

  // El segundo nivel, por vertical (mismo criterio que
  // mi-negocio/nuevo/actions.ts): obligatorio en Eventos, OPCIONAL en
  // Citas desde el 28 ago 2026 — lo inválido en Citas cae en null.
  const subcategoria = String(formData.get("subcategoria") || "");
  let subcategoriaFinal: string | null = null;
  if (vertical === "eventos") {
    const validas = SUBCATEGORIAS[categoria as keyof typeof SUBCATEGORIAS] ?? [];
    if (!validas.some((s) => s.id === subcategoria)) {
      return { error: "Elegí qué ofrece exactamente dentro de esa categoría." };
    }
    subcategoriaFinal = subcategoria;
  } else if (usaSubcategoria(vertical)) {
    subcategoriaFinal = subcategoriasDe(vertical, categoria).some((s) => s.id === subcategoria)
      ? subcategoria
      : null;
  }

  // El rubro operativo, validado igual que en el alta del dueño: contra
  // el catálogo y contra la vertical. Ser admin no cambia el CHECK de la
  // base — un valor fuera de la lista tumba el INSERT igual.
  const tipoNegocio = tipoNegocioDeAlta(vertical, String(formData.get("tipo_negocio") || ""));

  const num = (campo: string) => {
    const v = String(formData.get(campo) || "");
    return v ? Number(v) : null;
  };

  const slug = await generarSlugUnico(supabase, nombre);

  const { error } = await supabase.from("ranchos").insert({
    owner_id: ownerId,
    vertical,
    categoria,
    subcategoria: subcategoriaFinal,
    nombre,
    descripcion: String(formData.get("descripcion") || "").trim() || null,
    provincia,
    canton: String(formData.get("canton") || "").trim() || null,
    direccion_exacta: String(formData.get("direccion_exacta") || "").trim() || null,
    capacidad_min: num("capacidad_min"),
    capacidad_max: num("capacidad_max"),
    precio_desde: num("precio_desde"),
    contacto_whatsapp:
      String(formData.get("contacto_whatsapp") || "").trim() || null,
    estado: String(formData.get("estado") || "aprobado"),
    slug,
    // Solo si hay respuesta (mismo criterio que mi-negocio/nuevo).
    ...(tipoNegocio ? { tipo_negocio: tipoNegocio } : {}),
  });

  if (error) return { error: "No se pudo guardar el negocio: " + error.message };

  revalidatePath("/admin/negocios");
  revalidatePath("/");
  redirect("/admin/negocios");
}
