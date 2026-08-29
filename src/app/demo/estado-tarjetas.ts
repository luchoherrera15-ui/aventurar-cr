import { unstable_cache } from "next/cache";
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
async function consultarQueEmiten(slugs: readonly string[]): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin || slugs.length === 0) return [];

  try {
    // Las dos consultas eran una CADENA: la de programas esperaba los
    // ids que devolviera la de negocios, dos idas y vueltas puestas en
    // fila. Ahora viajan juntas — la de programas ya no necesita los
    // ids porque filtra por el slug del negocio a través de la FK
    // (`ranchos!inner`), así que ninguna depende de la otra.
    const [{ data: negocios }, { data: programas }] = await Promise.all([
      admin.from("ranchos").select("id, slug").in("slug", [...slugs]),
      // `select *` y no una lista de columnas: las columnas de las
      // 0134/0135/0136 pueden no estar en este entorno y una lista
      // explícita haría fallar la consulta entera (mismo criterio que
      // /tarjeta/[slug]). El `ranchos!inner(slug)` embebido existe SOLO
      // para poder filtrar por slug sin conocer los ids; el agrupado de
      // abajo sigue colgando de `rancho_id`, y a `emisoraDeFilasCrudas`
      // la clave extra no le cambia nada — recibe Record<string,
      // unknown> y lee lo suyo.
      admin
        .from("programa_lealtad")
        .select("*, ranchos!inner(slug)")
        .in("ranchos.slug", [...slugs]),
    ]);

    const filas = (negocios ?? []) as { id: string; slug: string }[];
    if (filas.length === 0) return [];

    const ahoraCR = minutoISOCR();
    const porNegocio = new Map<string, Record<string, unknown>[]>();
    for (const p of (programas ?? []) as Record<string, unknown>[]) {
      const id = typeof p.rancho_id === "string" ? p.rancho_id : null;
      if (!id) continue;
      const lista = porNegocio.get(id);
      if (lista) lista.push(p);
      else porNegocio.set(id, [p]);
    }

    const vivos: string[] = [];
    for (const negocio of filas) {
      const suyos = porNegocio.get(negocio.id) ?? [];
      if (emisoraDeFilasCrudas(suyos, ahoraCR)) vivos.push(negocio.slug);
    }
    return vivos;
  } catch {
    return [];
  }
}

/**
 * La consulta, cacheada UNA HORA con el tag "demo-catalogo".
 *
 * Este dato solo cambia cuando corre `scripts/sembrar-pases-demo.mjs` —
 * o sea casi nunca— y aun así /demo lo pedía en vivo, con dos consultas
 * de servicio, en CADA visita de venta. Adentro no hay `cookies()` ni
 * sesión: `createAdminClient` sale de puras variables de entorno, que
 * es justo lo que `unstable_cache` exige.
 *
 * El peor caso quedó acotado y es benigno: recién corrido el seed, la
 * página puede decir «pase de ejemplo» hasta una hora más (el QR
 * apunta a /lealtad/crear, no a un enlace muerto). Si algún día eso
 * estorba en una venta, el camino es `revalidateTag("demo-catalogo")`
 * desde una server action —para eso está el tag—, no volver a
 * force-dynamic.
 *
 * Devuelve y guarda un ARREGLO y no el Set con el que trabaja la
 * página: `unstable_cache` serializa el resultado para guardarlo, y un
 * Set serializado queda en `{}` — vacío, sin error y sin aviso.
 */
const consultaCacheada = unstable_cache(consultarQueEmiten, ["demo-catalogo"], {
  revalidate: 3600,
  tags: ["demo-catalogo"],
});

export async function slugsQueEmiten(slugs: readonly string[]): Promise<Set<string>> {
  return new Set(await consultaCacheada(slugs));
}
