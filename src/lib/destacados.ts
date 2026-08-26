import type { SupabaseClient } from "@supabase/supabase-js";
// Solo el TIPO viaja desde el carrusel: es un módulo "use client" y un
// import de valor lo arrastraría al servidor. Los tipos se borran al
// compilar, así que esto no ata este archivo a nada del cliente.
import type { NegocioDestacado } from "@/components/carrusel-super-destacados";
import { enConfiguracion } from "@/app/mi-negocio/types";

/**
 * ============================================================
 * LOS «SÚPER DESTACADOS» (migración 0169)
 * ============================================================
 *
 * Hasta 10 negocios que el admin elige a mano desde /admin/ranchos para
 * que roten en la vitrina de arriba. Es una vitrina de TODO el
 * marketplace, no de una vertical: por eso la consulta no filtra por
 * `vertical` y por eso `hrefDeNegocio` (en el carrusel) manda a cada uno
 * a la ruta de la suya.
 *
 * Esto vivía adentro de src/app/eventos/page.tsx. Se mudó acá porque
 * ahora lo piden DOS pantallas —la portada nueva y el directorio— y dos
 * copias de la misma consulta son dos formas de que una se quede sin el
 * filtro de «en configuración» o sin el aviso «Demo».
 *
 * ⚠️ EL DEGRADADO ELEGANTE ES PARTE DEL CONTRATO. `super_destacado` la
 * trajo la 0169, y las migraciones acá las pega el dueño a mano en el
 * SQL Editor: hay bases (local, una restauración, un staging) donde la
 * columna puede no existir todavía. En ese caso PostgREST responde un
 * error de columna inexistente, `data` llega `null` y esta función
 * devuelve `[]` — el carrusel no se pinta y la página sigue viva. Ese
 * comportamiento estaba escrito en el directorio desde el día uno y se
 * conserva tal cual: la portada, que es la URL más visitada del sitio,
 * NO puede caerse porque falte una columna decorativa.
 */

/** El tope de la 0169: la vitrina no crece sola aunque el admin marque más. */
const MAXIMO = 10;

/**
 * Las únicas columnas que lee la tarjeta del carrusel.
 *
 * Nunca `select("*")` sobre `ranchos`: la misma fila guarda el SINPE y
 * la cuenta bancaria del proveedor, y esto termina serializado dentro
 * del HTML público (ver el comentario largo de @/lib/ranchos-publicos).
 *
 * `detalles` viaja porque ahí vive la marca autoritativa de negocio de
 * muestra (`esDemo`, en @/lib/demo), y `precio_desde` porque la tarjeta
 * del héroe de la portada muestra "Desde ₡X".
 */
const COLUMNAS_DESTACADO =
  "id, slug, nombre, foto_url, provincia, canton, categoria, vertical, detalles, verificado";

/** La fila cruda, tal como la devuelve PostgREST. */
type FilaDestacado = {
  id: string;
  slug: string | null;
  nombre: string;
  foto_url: string | null;
  provincia: string | null;
  canton: string | null;
  categoria: string;
  vertical?: string | null;
  detalles?: Record<string, unknown> | null;
  verificado?: boolean | null;
};

/**
 * Los súper destacados listos para el carrusel, ya filtrados y con los
 * nombres de campo que usan los componentes.
 *
 * Se le pasa el cliente de Supabase (no lo crea) para que quien llama
 * pueda meterla en su propio `Promise.all` junto al resto de sus
 * consultas: en el directorio eso ahorró ~165 ms de TTFB y la portada
 * hace lo mismo.
 */
export async function leerSuperDestacados(
  supabase: SupabaseClient,
): Promise<NegocioDestacado[]> {
  const { data } = await supabase
    .from("ranchos")
    .select(COLUMNAS_DESTACADO)
    .eq("estado", "aprobado")
    .eq("super_destacado", true)
    .order("created_at", { ascending: false })
    .limit(MAXIMO);

  return ((data ?? []) as unknown as FilaDestacado[])
    // Un negocio «en configuración» se ve en la grilla pero no se puede
    // abrir (la card le pone un velo y le corta el link). De héroe
    // clickeable de la portada sería una promesa que no se cumple: el
    // clic no lleva a ninguna parte. Se saca de la vitrina.
    .filter((n) => !enConfiguracion(n.detalles))
    .map((n) => ({
      id: n.id,
      slug: n.slug,
      nombre: n.nombre,
      fotoUrl: n.foto_url,
      provincia: n.provincia,
      canton: n.canton,
      categoria: n.categoria,
      vertical: n.vertical ?? "eventos",
      // Viaja al carrusel porque ahí se decide el aviso «Demo»: mirando
      // solo el slug, los demos sembrados para parecer un negocio real
      // (Café Oscuro, SILENCE BARBER SHOP) salían de héroes de la
      // portada sin decir que son de muestra.
      detalles: n.detalles ?? null,
      verificado: n.verificado ?? false,
    }));
}
