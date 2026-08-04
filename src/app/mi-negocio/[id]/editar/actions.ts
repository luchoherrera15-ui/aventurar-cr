"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import { extraerCoordenadas } from "@/lib/mapas";
import { camposDeCategoria, COBERTURA, type Campo, type DetallesServicio } from "../../campos-servicio";
import { AMENIDADES, FOTOS_MAX, PROVINCIAS, SUBCATEGORIAS, type Categoria } from "../../types";
import { esCategoriaValida, usaSubcategoria } from "@/lib/categorias-vertical";
import { camposDeCategoriaCita } from "@/app/citas/campos-servicio";
import { COMODIDADES_CITA } from "@/app/citas/comodidades";
import type { CategoriaCita } from "@/app/citas/tipos";

/** Mismo criterio de sanitización que ya usaba el bloque de Eventos:
 *  booleanos solo true/omit, multi solo valores dentro de las opciones,
 *  números >= 0, texto recortado a 1500 chars. Compartido entre Eventos
 *  y Citas para no duplicar la lógica de validación. */
function sanitizarDetalles(
  entrada: Record<string, unknown>,
  campos: Campo[],
): DetallesServicio {
  const detalles: DetallesServicio = {};
  for (const campo of campos) {
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
  return detalles;
}

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
  // Una cuenta puede tener varios ranchos: sin este id, un update por
  // owner_id tocaría todas sus publicaciones a la vez.
  const ranchoId = String(formData.get("rancho_id") || "");
  if (!ranchoId) return { error: "Falta identificar qué publicación editás." };

  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  if (!ok) return { error: "No encontramos tu publicación." };

  // El vertical real sale de la base, nunca del formulario: así nadie
  // puede manipular el <select> del cliente para guardar una categoría
  // de otro vertical (ej. una de Citas en un negocio de Eventos).
  const { data: ranchoVertical } = await supabase
    .from("ranchos")
    .select("vertical")
    .eq("id", ranchoId)
    .maybeSingle();
  const vertical = (ranchoVertical?.vertical as string | undefined) ?? "eventos";

  const categoria = String(formData.get("categoria") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const provincia = String(formData.get("provincia") || "");

  if (
    !nombre ||
    !esCategoriaValida(vertical, categoria) ||
    !(PROVINCIAS as readonly string[]).includes(provincia)
  ) {
    return { error: "Completá al menos el tipo de servicio, el nombre y la provincia." };
  }

  // Eventos usa un segundo nivel (subcategoria); las demás verticales son
  // de un solo nivel y no lo tienen — la columna exige null o un valor
  // válido de la lista de Eventos (ranchos_subcategoria_check), así que
  // cualquier otra cosa rompería el guardado.
  let subcategoria: string | null = null;
  if (usaSubcategoria(vertical)) {
    subcategoria = String(formData.get("subcategoria") || "");
    const validas = SUBCATEGORIAS[categoria as keyof typeof SUBCATEGORIAS] ?? [];
    if (!validas.some((s) => s.id === subcategoria)) {
      return { error: "Elegí qué ofrecés exactamente dentro de esa categoría." };
    }
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

  // Las amenidades de Eventos son solo de Lugares; las de Citas ("Comodidades
  // del local") son su propio set, separado, guardado en la misma columna.
  const amenidades =
    vertical === "eventos" && categoria === "lugares"
      ? formData
          .getAll("amenidades")
          .map(String)
          .filter((a) => AMENIDADES.includes(a))
      : vertical === "citas"
        ? formData
            .getAll("amenidades")
            .map(String)
            .filter((a) => COMODIDADES_CITA.some((c) => c.id === a))
        : [];

  // Los detalles del servicio llegan como JSON, pero solo se guardan los
  // campos que existen para esa categoría y con el tipo que corresponde:
  // así nadie puede meter claves arbitrarias en la columna. Eventos usa
  // camposDeCategoria (mi-negocio/campos-servicio.ts); Citas usa
  // camposDeCategoriaCita (citas/campos-servicio.ts). Para cualquier otro
  // vertical NO se procesa este formData.get acá, y `detalles` queda
  // afuera del `update` más abajo, así el update parcial no pisa lo que
  // ya hubiera guardado ahí.
  let detalles: DetallesServicio = {};
  const procesaDetalles = vertical === "eventos" || vertical === "citas";
  if (procesaDetalles) {
    const detallesRaw = String(formData.get("detalles") || "");
    if (detallesRaw) {
      try {
        const parsed: unknown = JSON.parse(detallesRaw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const entrada = parsed as Record<string, unknown>;
          if (vertical === "eventos") {
            detalles = sanitizarDetalles(entrada, camposDeCategoria(categoria as Categoria));
          } else {
            // "belleza" puede mostrar además el grupo COBERTURA (zonas,
            // costo de traslado) cuando el dueño marca servicio a
            // domicilio — se valida siempre para que esos campos no se
            // pierdan al guardar, aunque el booleano esté en false.
            const campos = camposDeCategoriaCita(categoria as CategoriaCita);
            const camposCita =
              categoria === "belleza" ? [...campos, ...COBERTURA.campos] : campos;
            detalles = sanitizarDetalles(entrada, camposCita);
          }
        }
      } catch {
        return { error: "No se pudieron leer los detalles del servicio." };
      }
    }
    // Un lugar no tiene estos campos: usa capacidad y amenidades.
    if (vertical === "eventos" && categoria === "lugares") detalles = {};
  }

  // Del link de Google Maps (o de las coordenadas pegadas a mano) salen
  // los botones de "Cómo llegar". Si no se pudo leer, se guarda igual el
  // link y los botones caen en la dirección escrita.
  const mapaUrl = texto("mapa_url");
  const coords = mapaUrl ? await extraerCoordenadas(mapaUrl) : null;

  const fotoUrl = String(formData.get("foto_url") || "");

  // La foto grande de la presentación tiene que ser una de las suyas:
  // si la que venía se borró de la galería, se limpia y la plataforma
  // vuelve a escoger sola.
  const fotoPresentacionRaw = String(formData.get("foto_presentacion") || "");
  const fotoPresentacion =
    fotoPresentacionRaw &&
    (fotos.includes(fotoPresentacionRaw) || fotoPresentacionRaw === fotoUrl)
      ? fotoPresentacionRaw
      : null;

  const update: Record<string, unknown> = {
    foto_presentacion: fotoPresentacion,
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
    fotos,
  };
  // Solo Eventos guarda `detalles` desde este formulario por ahora: para
  // otro vertical se deja fuera del update parcial, así no se pisa lo
  // que ya hubiera (ver comentario donde se arma `detalles` más arriba).
  if (procesaDetalles) update.detalles = detalles;
  if (fotoUrl) update.foto_url = fotoUrl;

  const { error } = await supabase
    .from("ranchos")
    .update(update)
    .eq("id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath("/mi-negocio", "layout");
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${ranchoId}`);
  return { ok: true };
}
