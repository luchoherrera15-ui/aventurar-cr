"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarSlugUnico } from "@/lib/slug";
import { CATEGORIAS, PROVINCIAS, SUBCATEGORIAS } from "../types";
import { CATEGORIAS_CITAS } from "@/app/citas/tipos";
import { CATEGORIAS_HOSPEDAJES } from "@/app/booking/tipos";
import { paisPorCodigo, zonaDePais } from "@/lib/zonas";

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

  // La vertical del negocio: cada una tiene su propio registro.
  // Cualquier valor raro que llegue en el form cae a eventos.
  const verticalRaw = String(formData.get("vertical") || "");
  const vertical =
    verticalRaw === "citas" || verticalRaw === "hospedajes" ? verticalRaw : "eventos";
  const categoria = String(formData.get("categoria") || "");
  // Arrancamos solo con Costa Rica, pero el país viaja desde el alta y
  // la zona horaria del negocio se deriva de él (lib/zonas.ts) — así
  // abrir otro país no toca este código.
  const paisRaw = String(formData.get("pais") || "CR");
  const pais = paisPorCodigo(paisRaw) ? paisRaw : "CR";
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
  // en el sitio (medida de seguridad contra empresas fantasma). La URL
  // se normaliza: la gente escribe "www.minegocio.com" sin https://.
  const redSocialRaw = String(formData.get("red_social_url") || "").trim();
  const redSocialUrl =
    redSocialRaw && !/^https?:\/\//i.test(redSocialRaw)
      ? `https://${redSocialRaw}`
      : redSocialRaw;
  const cedulaFrenteUrl = String(formData.get("cedula_frente_url") || "").trim();
  const cedulaDorsoUrl = String(formData.get("cedula_dorso_url") || "").trim();

  // Cada vertical tiene su propia lista de categorías.
  const categoriasValidas: readonly string[] =
    vertical === "citas"
      ? CATEGORIAS_CITAS
      : vertical === "hospedajes"
        ? CATEGORIAS_HOSPEDAJES
        : CATEGORIAS;
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
      subcategoria: vertical === "eventos" ? subcategoria : null,
      pais,
      zona_horaria: zonaDePais(pais),
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

  // La verificación se escribe con el cliente admin (server-only): la
  // tabla es sensible y quedó sin GRANT para authenticated en algunos
  // entornos — el dueño acaba de crear el rancho acá mismo, así que
  // escribirla desde el servidor es seguro. Sin service key (entorno
  // local a medias) se intenta con la sesión del dueño, que con la
  // migración 0063 también puede.
  const adminDb = createAdminClient() ?? supabase;
  const { error: verifError } = await adminDb.from("verificacion_proveedores").insert({
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
