"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extraerCoordenadas } from "@/lib/mapas";
import { camposDeCategoria, type DetallesServicio } from "../campos-servicio";
import {
  AMENIDADES,
  CATEGORIAS,
  FOTOS_MAX,
  PROVINCIAS,
  SUBCATEGORIAS,
  type Categoria,
} from "../types";

export type EditarRanchoState = { error?: string; ok?: boolean } | undefined;

// Las redes se guardan siempre como URL completa, así la página pública
// solo tiene que pintarlas. Si el dueño escribió un usuario ("@turancho")
// lo convertimos al link de la plataforma; cualquier cosa que no sea
// http(s) termina como usuario, nunca como esquema ejecutable.
function normalizarRed(valor: string, base: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return base + v.replace(/^@/, "");
}

function normalizarSitio(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return "https://" + v;
}

export async function actualizarRancho(
  _prevState: EditarRanchoState,
  formData: FormData,
): Promise<EditarRanchoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/mi-rancho/login");

  const categoria = String(formData.get("categoria") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const provincia = String(formData.get("provincia") || "");

  if (
    !nombre ||
    !(CATEGORIAS as readonly string[]).includes(categoria) ||
    !(PROVINCIAS as readonly string[]).includes(provincia)
  ) {
    return { error: "Completá al menos el tipo de servicio, el nombre y la provincia." };
  }

  const subcategoria = String(formData.get("subcategoria") || "");
  const validas = SUBCATEGORIAS[categoria as keyof typeof SUBCATEGORIAS] ?? [];
  if (!validas.some((s) => s.id === subcategoria)) {
    return { error: "Elegí qué ofrecés exactamente dentro de esa categoría." };
  }

  const num = (campo: string) => {
    const v = String(formData.get(campo) || "");
    return v ? Number(v) : null;
  };
  const texto = (campo: string) => String(formData.get(campo) || "").trim() || null;

  // Solo aceptamos fotos que vivan en nuestro bucket público — así nadie
  // puede colar una imagen externa (ni un esquema raro) en el portal.
  let fotos: string[] = [];
  const fotosRaw = String(formData.get("fotos") || "");
  if (fotosRaw) {
    try {
      const parsed: unknown = JSON.parse(fotosRaw);
      if (Array.isArray(parsed)) {
        fotos = parsed
          .filter(
            (u): u is string =>
              typeof u === "string" &&
              u.startsWith("https://") &&
              u.includes("/ranchos-fotos/"),
          )
          .slice(0, FOTOS_MAX);
      }
    } catch {
      return { error: "No se pudo leer la galería de fotos. Probá de nuevo." };
    }
  }

  const amenidades =
    categoria === "lugares"
      ? formData
          .getAll("amenidades")
          .map(String)
          .filter((a) => AMENIDADES.includes(a))
      : [];

  // Los detalles del servicio llegan como JSON, pero solo se guardan los
  // campos que existen para esa categoría y con el tipo que corresponde:
  // así nadie puede meter claves arbitrarias en la columna.
  let detalles: DetallesServicio = {};
  const detallesRaw = String(formData.get("detalles") || "");
  if (detallesRaw) {
    try {
      const parsed: unknown = JSON.parse(detallesRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const entrada = parsed as Record<string, unknown>;
        for (const campo of camposDeCategoria(categoria as Categoria)) {
          const v = entrada[campo.id];
          if (v === undefined || v === null || v === "") continue;

          if (campo.tipo === "booleano") {
            if (v === true) detalles[campo.id] = true;
          } else if (campo.tipo === "multi") {
            const validas = (Array.isArray(v) ? v : [])
              .map(String)
              .filter((o) => campo.opciones?.some((x) => x.id === o));
            if (validas.length > 0) detalles[campo.id] = validas;
          } else if (campo.tipo === "opciones") {
            if (campo.opciones?.some((x) => x.id === v)) {
              detalles[campo.id] = String(v);
            }
          } else if (campo.tipo === "numero") {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 0) detalles[campo.id] = n;
          } else {
            detalles[campo.id] = String(v).trim().slice(0, 1500);
          }
        }
      }
    } catch {
      return { error: "No se pudieron leer los detalles del servicio." };
    }
  }
  // Un lugar no tiene estos campos: usa capacidad y amenidades.
  if (categoria === "lugares") detalles = {};

  // Del link de Google Maps (o de las coordenadas pegadas a mano) salen
  // los botones de "Cómo llegar". Si no se pudo leer, se guarda igual el
  // link y los botones caen en la dirección escrita.
  const mapaUrl = texto("mapa_url");
  const coords = mapaUrl ? await extraerCoordenadas(mapaUrl) : null;

  const fotoUrl = String(formData.get("foto_url") || "");

  const update: Record<string, unknown> = {
    categoria,
    subcategoria,
    nombre,
    descripcion: texto("descripcion"),
    descripcion_larga: texto("descripcion_larga"),
    provincia,
    canton: texto("canton"),
    direccion_exacta: texto("direccion_exacta"),
    capacidad_min: num("capacidad_min"),
    capacidad_max: num("capacidad_max"),
    precio_desde: num("precio_desde"),
    contacto_whatsapp: texto("contacto_whatsapp"),
    instagram: normalizarRed(
      String(formData.get("instagram") || ""),
      "https://instagram.com/",
    ),
    facebook: normalizarRed(
      String(formData.get("facebook") || ""),
      "https://facebook.com/",
    ),
    tiktok: normalizarRed(
      String(formData.get("tiktok") || ""),
      "https://tiktok.com/@",
    ),
    sitio_web: normalizarSitio(String(formData.get("sitio_web") || "")),
    mapa_url: mapaUrl,
    latitud: coords?.lat ?? null,
    longitud: coords?.lng ?? null,
    amenidades,
    detalles,
    fotos,
  };
  if (fotoUrl) update.foto_url = fotoUrl;

  const { error } = await supabase
    .from("ranchos")
    .update(update)
    .eq("owner_id", user.id);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-rancho");
  revalidatePath("/ranchos-eventos");
  return { ok: true };
}
