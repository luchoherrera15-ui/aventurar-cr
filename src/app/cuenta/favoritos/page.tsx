import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import RanchoCard, { type Calificacion } from "@/components/rancho-card";
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";
import type { Rancho } from "../../mi-negocio/types";

export const metadata: Metadata = {
  title: "Tus favoritos",
  robots: { index: false },
};

/**
 * Los favoritos del cliente en su propia página (antes eran una
 * sección plegable dentro de /cuenta, que quedó como tablero de
 * cards): la cuadrícula completa de negocios guardados.
 */
export default async function CuentaFavoritosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  // La lista explícita también cuenta cuando `ranchos` viene embebido:
  // con `ranchos(*)` la fila entera —cuentas de cobro incluidas— viajaba
  // hasta RanchoCard, que es un componente cliente, y React la serializa
  // dentro del HTML. Ver src/lib/ranchos-publicos.ts.
  const { data: favoritosData } = await supabase
    .from("favoritos")
    .select(`ranchos(${COLUMNAS_CARD})`)
    .eq("cliente_id", user.id);

  // Los favoritos mezclan negocios de cualquier vertical (Eventos,
  // Citas...) — normalizarCategoria es Eventos-only y le pisaba la
  // categoría real a un negocio de Citas (ver src/lib/categorias-vertical.ts).
  // RanchoCard ya sabe leer categoria+vertical con ese helper.
  const favoritos = ((favoritosData ?? []) as unknown as { ranchos: Rancho | null }[])
    .map((f) => f.ranchos)
    .filter((r): r is Rancho => r !== null);

  const favoritoIds = favoritos.map((r) => r.id);
  const { data: calificacionesData } =
    favoritoIds.length > 0
      ? await supabase
          .from("calificaciones_rancho")
          .select("rancho_id, promedio, total")
          .in("rancho_id", favoritoIds)
      : { data: [] as Calificacion[] };
  const calificaciones = new Map<string, Calificacion>(
    ((calificacionesData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Tus favoritos" ancho="max-w-[960px]" />
      <main className="mx-auto max-w-[960px] px-6 py-8">
        <Link
          href="/cuenta"
          className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Volver a tu cuenta
        </Link>

        <h1 className="titulo mt-3 text-2xl text-aventurea-ink">Tus favoritos</h1>
        <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
          Los negocios que guardaste para volver a ellos.
        </p>

        {favoritos.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-aventurea-line bg-aventurea-surface p-8 text-center text-[13.5px] text-aventurea-ink-soft">
            Todavía no guardaste ningún favorito. Tocá el corazón de cualquier
            negocio del{" "}
            <Link href="/eventos" className="font-bold text-aventurea-navy hover:underline">
              directorio
            </Link>{" "}
            y acá te espera.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {favoritos.map((r, i) => (
              <RanchoCard
                key={r.id}
                rancho={r}
                index={i}
                calificacion={calificaciones.get(r.id) ?? null}
                proximaLibre={undefined}
                favoritoInicial
                sesionActiva
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
