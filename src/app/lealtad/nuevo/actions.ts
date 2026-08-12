"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generarSlugUnico } from "@/lib/slug";

/**
 * El alta "solo lealtad": un negocio que existe para su programa de
 * sellos, SIN publicarse en ningún directorio.
 *
 * No es una vertical nueva — eso se auditó y hay una docena de caminos
 * que degradan en silencio un vertical desconocido a eventos. Es un
 * rancho normal que se queda en estado 'pendiente': la RLS de la 0008
 * ya lo hace invisible al público, y NADA del módulo de lealtad exige
 * estado 'aprobado'. Si el día de mañana quiere publicarse en el
 * marketplace, es el mismo negocio — se aprueba y listo, sin migrar
 * nada.
 *
 * El insert va con la SESIÓN DEL USUARIO, no con la llave de servicio:
 * la política de INSERT de ranchos exige owner_id = auth.uid() y
 * estado = 'pendiente' — la base garantiza que nadie nace aprobado ni
 * a nombre de otro, y este código ni siquiera puede equivocarse en eso.
 */

const VERTICALES = ["citas", "eventos", "hospedajes", "restaurantes"] as const;

export async function crearNegocioLealtad(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/lealtad/login");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const verticalCrudo = String(formData.get("vertical") ?? "");
  // Sin whitelist explícita el valor viajaría del navegador directo a
  // la base — el check lo pararía, pero con un error críptico.
  const vertical = (VERTICALES as readonly string[]).includes(verticalCrudo)
    ? verticalCrudo
    : "citas";

  if (!nombre || nombre.length > 80) {
    redirect("/lealtad/nuevo?error=nombre");
  }

  const slug = await generarSlugUnico(supabase, nombre);

  const { data, error } = await supabase
    .from("ranchos")
    .insert({
      owner_id: user.id,
      nombre,
      slug,
      vertical,
      // 'otros' es la única categoría compartida entre verticales: el
      // negocio de solo-lealtad no se publica, así que la categoría es
      // un requisito de la tabla, no una decisión de directorio.
      categoria: "otros",
      estado: "pendiente",
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/lealtad/nuevo?error=guardar");
  }

  // Derecho a elegir su paquete: el negocio se creó exactamente para
  // eso, y la solicitud es el paso que sigue — no una pantalla vacía.
  redirect(`/lealtad/planes?negocio=${data.id}`);
}
