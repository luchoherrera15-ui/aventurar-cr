"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GUARDAR LA FICHA DEL CLIENTE — notas y etiquetas (0228).
 *
 * La única puerta de escritura de `fichas_cliente`: la RLS de la tabla
 * solo concede SELECT, así que todo write pasa por acá, con el mismo
 * control de acceso que el resto del panel (dueño o admin).
 *
 * La `clave` llega del navegador pero no es un riesgo de cruce: la
 * fila siempre se escribe bajo EL rancho verificado — lo peor que
 * logra una clave inventada es una ficha huérfana en el propio
 * negocio, que no se muestra en ningún lado porque ningún cliente
 * derivado la reclama.
 */

type Resultado = { ok: true } | { ok: false; motivo: string };

const TOPE_NOTAS = 2000;
const TOPE_ETIQUETAS = 12;
const TOPE_ETIQUETA = 24;

export async function guardarFichaCliente(datos: {
  ranchoId: string;
  clave: string;
  notas: string;
  etiquetas: string[];
}): Promise<Resultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión de nuevo." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: rancho } = await admin
    .from("ranchos")
    .select("owner_id")
    .eq("id", datos.ranchoId)
    .maybeSingle();
  if (!rancho) return { ok: false, motivo: "Ese negocio no existe." };

  if (rancho.owner_id !== user.id) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();
    if (perfil?.rol !== "admin") return { ok: false, motivo: "Esto lo maneja el dueño." };
  }

  const clave = datos.clave.trim();
  if (!/^(id|cuenta|correo|tel|nombre):.+/.test(clave) || clave.length > 200) {
    return { ok: false, motivo: "Esa ficha no existe." };
  }

  // Las etiquetas se limpian con criterio, no se rechazan: quitar
  // duplicados y vacíos es trabajo del sistema, no del que teclea.
  const etiquetas = [
    ...new Set(
      datos.etiquetas
        .map((e) => e.trim().toLowerCase().slice(0, TOPE_ETIQUETA))
        .filter((e) => e.length > 0),
    ),
  ].slice(0, TOPE_ETIQUETAS);

  const { error } = await admin.from("fichas_cliente").upsert(
    {
      rancho_id: datos.ranchoId,
      clave,
      notas: datos.notas.slice(0, TOPE_NOTAS),
      etiquetas,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "rancho_id,clave" },
  );
  if (error) {
    if (error.message.includes("fichas_cliente")) {
      return { ok: false, motivo: "Falta correr la migración 0228 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo guardar: " + error.message };
  }

  revalidatePath(`/mi-negocio/${datos.ranchoId}/clientes`);
  return { ok: true };
}
