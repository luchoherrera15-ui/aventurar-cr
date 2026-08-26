import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_CARD, pedirFilas } from "@/lib/ranchos-publicos";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import { verticalDe } from "@/lib/carriles-home";
import { destinosConDatos, type Puerta } from "@/components/nav/taxonomia-navegacion";
import type { Rancho } from "@/app/mi-negocio/types";

/**
 * ============================================================
 * EL DIRECTORIO DE UNA PUERTA — /experiencias y /servicios
 * ============================================================
 *
 * Las otras cuatro listas del sitio (/eventos, /citas, /hospedajes,
 * /restaurantes) son directorios de UNA VERTICAL: preguntan
 * `.eq("vertical", …)` y listo. Estas dos no pueden, y ahí está todo el
 * asunto:
 *
 *   · `experiencias` NO es una vertical. El CHECK de la 0076 acepta
 *     `eventos | citas | hospedajes | restaurantes` y nada más.
 *   · `servicios` tampoco, y encima junta rubros de DOS verticales
 *     distintas (la ferretería del evento vive en `eventos`; mascotas,
 *     automotriz y tatuajes viven en `citas`).
 *
 * Una PUERTA es una LENTE: la consulta se arma a partir de los destinos
 * que la puerta declara en `@/components/nav/taxonomia-navegacion`. Si
 * mañana se le agrega un rubro a la puerta, esta pantalla lo lista sola.
 *
 * ── POR QUÉ SE FILTRA EN MEMORIA ─────────────────────────────────
 *
 * Los destinos son pares (categoría, subcategoría) de verticales
 * distintas: en SQL eso es un `or()` anidado difícil de leer y fácil de
 * romper. Se traen las fichas aprobadas en una sola ida y el cruce se
 * hace acá, que es gratis y se lee. Es exactamente lo que ya hacen
 * /citas y /restaurantes con sus carriles.
 *
 * ⚠️ Y por eso la vertical tampoco se filtra en la consulta: una fila
 * vieja puede tener `vertical` en NULL, y en SQL un `.in()` no la
 * alcanza. `verticalDe()` la lee como «eventos» —que es lo que era antes
 * de que existieran las otras tres— igual que hace /eventos.
 *
 * ── LA REGLA DE VISIBILIDAD ──────────────────────────────────────
 *
 * `estado = 'aprobado'` Y `en_marketplace ≠ false` (0187): un cliente de
 * Bookea Lealtad no es una ficha del directorio. `!== false` y no
 * `=== true` porque sin la 0187 corrida la propiedad llega `undefined`.
 *
 * ⚠️ `COLUMNAS_CARD`, nunca `select("*")`: la misma fila guarda el SINPE
 * y la cuenta bancaria del proveedor (ver @/lib/ranchos-publicos).
 */

/** 0187 — columna joven: puede no existir en una base sin migrar. */
const COLUMNAS_PUERTA_JOVENES = "en_marketplace";

type FilaPuerta = Rancho & { en_marketplace?: boolean | null };

export default async function DirectorioPuerta({
  puerta,
  intro,
}: {
  puerta: Puerta;
  /** Una línea que explica qué se está mirando. La escribe cada ruta. */
  intro: string;
}) {
  const destinos = destinosConDatos(puerta);

  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    filas,
    { data: califData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    destinos.length === 0
      ? Promise.resolve([])
      : pedirFilas(
          (columnas) =>
            supabase
              .from("ranchos")
              .select(columnas)
              .eq("estado", "aprobado")
              .order("destacado_orden", { ascending: true, nullsFirst: false })
              .order("created_at", { ascending: false }),
          COLUMNAS_CARD,
          COLUMNAS_PUERTA_JOVENES,
        ),
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
  ]);

  // Mismo cast (y mismo motivo) que el resto de los directorios: la
  // tarjeta pide el tipo `Rancho` completo pero solo lee COLUMNAS_CARD.
  const negocios = (filas as unknown as FilaPuerta[])
    .filter((r) => r.en_marketplace !== false)
    .filter((r) =>
      destinos.some(
        (d) =>
          verticalDe(r) === d.vertical &&
          (!d.categoria || r.categoria === d.categoria) &&
          (!d.subcategoria || r.subcategoria === d.subcategoria),
      ),
    );

  const favoritosRes = user
    ? await supabase.from("favoritos").select("rancho_id").eq("cliente_id", user.id)
    : { data: [] };
  const califPorRancho = new Map(
    ((califData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );
  const favoritos = new Set(
    ((favoritosRes.data ?? []) as { rancho_id: string }[]).map((f) => f.rancho_id),
  );

  return (
    <section className="pb-16 pt-6">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
        <h1 className="text-[26px] font-extrabold tracking-tight text-aventurea-ink sm:text-[32px]">
          {puerta.label}
        </h1>
        <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
          {intro}
        </p>

        {negocios.length === 0 ? (
          /* El vacío HONESTO, con salida. Con el directorio todavía
             chico, cada rubro sin negocios es una oportunidad de captar
             oferta y no una decepción — pero solo si se dice la verdad:
             acá no hay nada TODAVÍA, y el camino de entrada está a un
             clic. Es el mismo patrón que ya usa /hospedajes. */
          <div className="bento bento-blanco mx-auto mt-10 max-w-[560px] p-10 text-center">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Todavía no hay nada publicado en {puerta.label}
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Estamos abriendo esta sección. Si es lo tuyo, sos de los
              primeros: publicá gratis y recibí reservas con tu propia
              página.
            </p>
            <Link href={puerta.ctaOferta.href} className="btn-naranja mt-6">
              {puerta.ctaOferta.texto}
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {negocios.map((n, i) => (
              <RanchoCard
                key={n.id}
                rancho={n}
                index={i}
                calificacion={califPorRancho.get(n.id) ?? null}
                favoritoInicial={favoritos.has(n.id)}
                sesionActiva={!!user}
                /* La lista mezcla verticales: una barbería y un salón de
                   eventos comparten grilla, y `unidad_precio` arrastra el
                   'evento' por defecto de la 0033. El monto es cierto; la
                   unidad, no. Mismo criterio que la portada. */
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
