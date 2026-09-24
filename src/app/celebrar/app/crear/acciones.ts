"use server";

import { redirect } from "next/navigation";
import { elegirPlantilla } from "@/app/celebrar/editor/acciones";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA, rutaEditor } from "@/lib/celebrar/rutas";
import { prefijoDeLaPeticion } from "@/lib/celebrar/sesion";
import { traducirErrorDeBase } from "@/lib/celebrar/errores-base";
import { validarCelebracion, type Errores } from "@/lib/celebrar/validar-celebracion";
import { createClient } from "@/lib/supabase/server";

export type EstadoCrear = {
  errores?: Errores;
  mensaje?: string;
} | null;

/**
 * Crea la celebración de la persona con sesión. Valida en el servidor
 * (la misma función pura que el asistente usa en el navegador) y llama
 * a la RPC `celebrar_crear_celebracion`, que vuelve a validar lo suyo:
 * slug libre y no reservado, dueño = auth.uid(), tipos. La RPC corre con
 * el token de la persona; nada de service_role.
 *
 * Los mensajes de `raise exception` de la base están escritos para la
 * persona, así que se muestran tal cual.
 */
export async function crearCelebracion(_previo: EstadoCrear, formData: FormData): Promise<EstadoCrear> {
  const entrada = Object.fromEntries(formData.entries());
  const v = validarCelebracion(entrada);
  if (!v.ok) return { errores: v.errores };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_crear_celebracion", {
    p_tipo: v.datos.tipo,
    p_nombre: v.datos.nombre,
    p_slug: v.datos.slug,
    p_fecha: v.datos.fecha || null,
    p_hora: v.datos.hora || null,
    p_lugar_nombre: v.datos.lugarNombre || null,
    p_direccion: v.datos.direccion || null,
    p_maps_url: v.datos.mapsUrl || null,
  });

  if (error) return traducirErrorDeBase(error.message, error.code);

  const creada = data as { id?: string } | null;
  if (!creada?.id) return { mensaje: "La celebración se creó pero no pudimos abrirla. Buscala en «Mis celebraciones»." };

  const prefijo = await prefijoDeLaPeticion();

  // Si vino desde el catálogo con una plantilla elegida, se aplica de una
  // y se abre el editor; si algo falla, la ficha igual queda creada.
  const plantilla = typeof entrada.plantilla === "string" ? entrada.plantilla.trim() : "";
  if (/^[a-z0-9-]{1,80}$/.test(plantilla)) {
    const r = await elegirPlantilla(creada.id, plantilla);
    if (r.ok) redirect(conPrefijo(rutaEditor(creada.id), prefijo));
  }
  redirect(conPrefijo(`${RUTA.appCelebraciones}/${creada.id}?nueva=1`, prefijo));
}
