import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/server";
import type { FoodBusiness } from "@/lib/food/tipos";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { IconCloche } from "@/components/icons";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "FOOD.BOOKEA — Restaurantes con descuento por horario",
  description:
    "Reservá una franja horaria en tu restaurante favorito y comé con descuento en Costa Rica.",
};

/**
 * EL DIRECTORIO PÚBLICO DE FOOD.BOOKEA.
 *
 * Cliente anónimo (createAnonClient), no el de cookies: esta página se
 * ve igual para todo el mundo y la RLS de food_businesses ya filtra
 * `activo` — mismo criterio de rendimiento que /i/[slug] (ver
 * src/lib/supabase/server.ts).
 *
 * `es_demo=false` explícito acá (0193): la RLS por sí sola no separa
 * real de demo (dos políticas SELECT permisivas se combinan con OR),
 * así que este filtro de la propia consulta es lo que de verdad
 * garantiza que el directorio real nunca muestre un negocio sembrado
 * para /food/demo. Ver el encabezado de la migración 0193 para el
 * razonamiento completo.
 */
export default async function FoodDirectorioPage() {
  const supabase = createAnonClient();
  const { data: negocios, error } = await supabase
    .from("food_businesses")
    .select("id, nombre, slug, descripcion, foto_portada_url, telefono")
    .eq("activo", true)
    .eq("es_demo", false)
    .order("nombre");

  if (error) console.error("[food] no se pudo cargar el directorio:", error.message);

  return (
    <>
      <SiteHeader breadcrumb="FOOD.BOOKEA" />
      <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
      <p className="text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
        FOOD.BOOKEA
      </p>
      <h1 className="mt-2 text-2xl font-bold text-aventurea-ink sm:text-3xl">
        Restaurantes con descuento por horario
      </h1>
      <p className="mt-2 max-w-[560px] text-[14px] text-aventurea-ink-soft">
        Reservá una franja horaria y comé con descuento. Cuanto antes o
        después de la hora pico reservés, mejor precio.
      </p>

      {!negocios || negocios.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-12 text-center">
          <p className="text-[15px] font-bold text-aventurea-ink">
            Todavía no hay restaurantes publicados
          </p>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] text-aventurea-ink-soft">
            ¿Tenés un restaurante?{" "}
            <Link href="/food/negocio" className="font-bold text-aventurea-navy underline">
              Sumalo acá
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(negocios as Pick<FoodBusiness, "id" | "nombre" | "slug" | "descripcion" | "foto_portada_url" | "telefono">[]).map(
            (n) => (
              <Link
                key={n.id}
                href={`/food/restaurante/${n.slug}`}
                className="overflow-hidden rounded-2xl border border-aventurea-line bg-white transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-aventurea-blue-light">
                  {n.foto_portada_url ? (
                    <Image
                      src={n.foto_portada_url}
                      alt={n.nombre}
                      fill
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 366px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-aventurea-navy/40">
                      <IconCloche className="h-10 w-10" />
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-[15px] font-bold text-aventurea-ink">{n.nombre}</p>
                  {n.descripcion && (
                    <p className="mt-1 line-clamp-2 text-[13px] text-aventurea-ink-soft">
                      {n.descripcion}
                    </p>
                  )}
                </div>
              </Link>
            ),
          )}
        </div>
      )}
      </main>
      <SiteFooter />
    </>
  );
}
