import { createAdminClient } from "@/lib/supabase/admin";
import { emisoraDeFilasCrudas } from "@/lib/wallet/programa-principal";
import { minutoISOCR } from "@/lib/fechas";

/**
 * ¿EL QR DE ESTE PASE LLEVA A UNA TARJETA DE VERDAD?
 *
 * La respuesta no se adivina ni se escribe a mano: se le pregunta a la
 * base exactamente lo mismo que le pregunta `/tarjeta/[slug]` antes de
 * ofrecer el botón de Wallet —el negocio existe y alguno de sus
 * programas ESTÁ EMITIENDO— y se usa la misma función que elige cuál
 * (`emisoraDeFilasCrudas`). Si esta página preguntara por su cuenta,
 * podría prometer un pase que la otra pantalla luego no entrega.
 *
 * Se lee con la llave de servicio por la razón de siempre en Lealtad:
 * un negocio "solo lealtad" vive en estado 'pendiente' —invisible en el
 * directorio público, que es justo lo que se quiere para los demo— y la
 * RLS no lo mostraría. Lo único que sale de acá es un booleano.
 *
 * Nunca lanza: sin llave de servicio, sin tabla o con la base caída,
 * responde que ninguno está vivo y la página cae sola al QR honesto de
 * «pase de ejemplo».
 */
export async function slugsQueEmiten(slugs: readonly string[]): Promise<Set<string>> {
  const vivos = new Set<string>();
  const admin = createAdminClient();
  if (!admin || slugs.length === 0) return vivos;

  try {
    const { data: negocios } = await admin
      .from("ranchos")
      .select("id, slug")
      .in("slug", [...slugs]);

    const filas = (negocios ?? []) as { id: string; slug: string }[];
    if (filas.length === 0) return vivos;

    // `select *` y no una lista de columnas: las columnas de las
    // 0134/0135/0136 pueden no estar en este entorno y una lista
    // explícita haría fallar la consulta entera (mismo criterio que
    // /tarjeta/[slug]).
    const { data: programas } = await admin
      .from("programa_lealtad")
      .select("*")
      .in(
        "rancho_id",
        filas.map((f) => f.id),
      );

    const ahoraCR = minutoISOCR();
    const porNegocio = new Map<string, Record<string, unknown>[]>();
    for (const p of (programas ?? []) as Record<string, unknown>[]) {
      const id = typeof p.rancho_id === "string" ? p.rancho_id : null;
      if (!id) continue;
      const lista = porNegocio.get(id);
      if (lista) lista.push(p);
      else porNegocio.set(id, [p]);
    }

    for (const negocio of filas) {
      const suyos = porNegocio.get(negocio.id) ?? [];
      if (emisoraDeFilasCrudas(suyos, ahoraCR)) vivos.add(negocio.slug);
    }
  } catch {
    return vivos;
  }

  return vivos;
}
