import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";

/**
 * SUBIR UNA IMAGEN DEL ALTA (modo completo), antes de que el negocio
 * exista.
 *
 * Extraído de `wizard-alta.tsx` para que el configurador fusionado de
 * `/lealtad` pueda subir el mismo logo con el mismo camino en vez de
 * llevar una segunda copia: dos funciones que suben "el logo del alta"
 * se separan el día que alguien le cambie el bucket a una sola.
 *
 * EXIGE SESIÓN — Supabase Storage la necesita para autorizar la subida.
 * Quien llama tiene que comprobar que haya sesión ANTES de invocarla:
 * acá no hay dónde avisar "se cerró tu sesión" con la calma de
 * `SubirImagen`, porque este camino es más angosto (solo logo/banda del
 * alta, bucket `comprobantes`) que el componente general.
 *
 * LAS DOS VAN A `logos-negocio/`, Y NO ES DESPROLIJIDAD: ver el
 * comentario largo que se queda en `wizard-alta.tsx` sobre por qué
 * `bandas-negocio/` no es una carpeta permitida por la política 0148.
 */
export async function subirImagenAlAlta(
  archivo: File,
  destino: "logo" | "banda",
): Promise<string | null> {
  const supabase = createClient();
  // `conservarAlfa` en el logo — un logo NO es una foto: aplastado a
  // JPEG opaco, un logo blanco desaparece sobre el sello blanco.
  const liviano = await comprimirImagen(
    archivo,
    destino === "logo" ? { conservarAlfa: true } : undefined,
  );
  const ext = liviano.name.split(".").pop()?.toLowerCase() || (destino === "logo" ? "png" : "jpg");
  const path = `logos-negocio/${destino === "logo" ? "logo" : "banda"}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("comprobantes").upload(path, liviano);
  if (error) return null;
  const { data } = supabase.storage.from("comprobantes").getPublicUrl(path);
  return data?.publicUrl ?? null;
}
