"use server";

import { revalidatePath } from "next/cache";
import { PREFIJO_CELEBRAR, RUTA } from "@/lib/celebrar/rutas";
import { MONEDAS, PAIS, PAISES, type Moneda, type Pais } from "@/lib/monedas";
import { createClient } from "@/lib/supabase/server";

export type EstadoPerfil = { mensaje?: string; guardado?: boolean; errores?: Partial<Record<"nombre" | "whatsapp" | "pais", string>> } | null;

const WHATSAPP = /^[0-9+][0-9 +-]{6,19}$/;

/**
 * Guarda el perfil. Dos destinos, a propósito:
 *  - el NOMBRE es de la identidad compartida (`perfiles.nombre`), así que
 *    va por la RPC `actualizar_mi_nombre` de Bookea, la misma que usa
 *    /cuenta: cambiarlo acá lo cambia en todos lados;
 *  - WhatsApp, país y moneda son de CELEBRAR (`celebrar_perfiles`), con
 *    RLS de dueño. Upsert: la fila puede no existir todavía.
 */
export async function guardarPerfil(_previo: EstadoPerfil, formData: FormData): Promise<EstadoPerfil> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim().toUpperCase();
  const marketing = formData.get("marketing") === "on";

  const errores: NonNullable<EstadoPerfil>["errores"] = {};
  if (nombre.length < 2) errores.nombre = "Contanos tu nombre.";
  if (nombre.length > 60) errores.nombre = "Máximo 60 caracteres.";
  if (whatsapp && !WHATSAPP.test(whatsapp)) errores.whatsapp = "Dejá un número válido (solo dígitos, puede llevar el código de país).";
  if (!(PAISES as readonly string[]).includes(pais)) errores.pais = "Elegí tu país.";
  if (Object.keys(errores).length) return { errores };

  const moneda: Moneda = PAIS[pais as Pais].moneda;
  if (!(MONEDAS as readonly string[]).includes(moneda)) return { mensaje: "No pudimos determinar la moneda de ese país." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { mensaje: "Tu sesión venció. Entrá de nuevo." };

  const { error: errNombre } = await supabase.rpc("actualizar_mi_nombre", { p_nombre: nombre });
  if (errNombre) return { mensaje: `No se pudo guardar el nombre: ${errNombre.message}` };

  const { error: errPerfil } = await supabase.from("celebrar_perfiles").upsert(
    {
      id: user.id,
      whatsapp: whatsapp || null,
      pais,
      moneda,
      acepta_marketing: marketing,
    },
    { onConflict: "id" },
  );
  if (errPerfil) {
    if (/does not exist|Could not find/i.test(errPerfil.message)) {
      return { mensaje: "El nombre se guardó. El resto necesita la base de CELEBRAR (migración 0242) en este entorno." };
    }
    return { mensaje: `No se pudo guardar el perfil: ${errPerfil.message}` };
  }

  revalidatePath(`${PREFIJO_CELEBRAR}${RUTA.app}`, "layout");
  return { guardado: true };
}
