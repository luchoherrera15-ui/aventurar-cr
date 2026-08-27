import type { Metadata } from "next";
import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/server";
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";
import type { Rancho } from "@/app/mi-negocio/types";
import { agruparPorRubro } from "@/lib/carriles-home";
import RielProveedores from "@/components/riel-proveedores";
import type { Calificacion } from "@/components/rancho-card";
import SiteFooter from "@/components/site-footer";
import ContadorCitas from "./contador-citas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /demo/citas — LA PLATAFORMA LLENA, PARA ENSEÑARLA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (27 ago 2026): un demo completo con 100 negocios,
 * su equipo, lo que hacen y 25 reseñas cada uno, con cuentas a las que
 * se pueda entrar sin token.
 *
 * ── POR QUÉ NO ESTÁ EN `/demo` A SECAS ──────────────────────────────
 *
 * Esa ruta ya es la demo de LEALTAD, que es otro producto y se vende a
 * otra persona. Meter 99 fichas de citas ahí adentro habría convertido
 * dos argumentos de venta en uno confuso.
 *
 * ── DE DÓNDE SALEN LOS NEGOCIOS ─────────────────────────────────────
 *
 * De la base, igual que los reales: `estado = 'aprobado'` y
 * `en_marketplace = false`. Esa segunda columna es exactamente lo que
 * los mantiene FUERA de la portada — sin ella, 99 negocios de mentira
 * enterrarían a los 3 de verdad.
 *
 * Que estén en la base y no en un archivo estático es lo que hace que
 * la demo sirva: se pueden abrir, se les puede ver el equipo, se les
 * pueden leer las 25 reseñas y se puede reservar de verdad.
 *
 * ── EL CLIENTE ANÓNIMO, A PROPÓSITO ─────────────────────────────────
 *
 * Esta página es idéntica para todo el mundo y no muestra nada privado,
 * así que se lee sin cookies. Eso además la deja cacheable.
 */

export const metadata: Metadata = {
  title: "Demostración · Bookea",
  // ⚠️ Fuera de Google. Son 99 negocios que no existen: indexarlos
  // sería llenar el buscador de fichas falsas con el nombre de Bookea
  // encima, y alguien podría llegar buscando una barbería de verdad.
  robots: { index: false, follow: false },
};

export const revalidate = 300;

/** Los mismos rieles de la portada, con el catálogo de mentira. */
async function leerDemo(): Promise<Rancho[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("ranchos")
    .select(COLUMNAS_CARD)
    .eq("estado", "aprobado")
    .eq("en_marketplace", false)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Rancho[];
}

/**
 * La nota de cada negocio, de la vista que ya la calcula sobre sus
 * reseñas. Sin esto las tarjetas saldrían sin estrella y el demo se
 * vería más pobre que la portada real — al revés de lo que busca.
 */
async function leerNotas(): Promise<Map<string, Calificacion>> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("calificaciones_rancho")
    .select("rancho_id, promedio, total");
  return new Map(
    (data ?? []).map((c) => [
      c.rancho_id as string,
      {
        rancho_id: c.rancho_id as string,
        promedio: Number(c.promedio),
        total: Number(c.total),
      },
    ]),
  );
}

export default async function DemoCitasPage() {
  const [negocios, notas] = await Promise.all([leerDemo(), leerNotas()]);
  const rieles = agruparPorRubro(negocios);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* La franja que dice qué es esto. Va arriba de todo y es lo
          primero que se lee: una demo que no se anuncia como demo es
          una mentira con buena tipografía. */}
      <div className="bg-aventurea-navy px-4 py-2.5 text-center">
        <p className="text-[12.5px] font-bold text-white">
          DEMOSTRACIÓN · Estos {negocios.length} negocios no existen. Los datos son de
          muestra.
        </p>
      </div>

      <section className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-10 sm:px-6">
        <h1 className="titulo text-[clamp(28px,4.4vw,44px)] leading-[1.06] text-[color:var(--navy)]">
          Así se ve Bookea lleno
        </h1>
        <p className="mt-3 max-w-[58ch] text-[15.5px] leading-relaxed text-aventurea-ink-soft">
          {negocios.length} negocios con su equipo, sus servicios y 25 reseñas cada uno.
          Entrá a cualquiera: podés ver quién atiende, qué hace y reservar como lo haría
          un cliente.
        </p>

        <div className="mt-5">
          <ContadorCitas />
        </div>

        {/* Las dos puertas del demo. El código va escrito porque el
            punto es justamente que NO hay que esperar un correo. */}
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
              Entrar como cliente
            </p>
            <p className="mt-0.5 text-[14px] font-bold text-aventurea-ink">
              cliente.demo@bookea.lat
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
              Entrar como negocio
            </p>
            <p className="mt-0.5 text-[14px] font-bold text-aventurea-ink">
              negocio.demo@bookea.lat
            </p>
          </div>
          <div className="shrink-0">
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
              Código
            </p>
            <p className="mt-0.5 text-[18px] font-extrabold tabular-nums text-aventurea-navy">
              123456
            </p>
          </div>
          <Link
            href="/cuenta"
            className="presionable flex h-11 shrink-0 items-center justify-center rounded-xl px-5 text-[14px] font-extrabold text-white"
            style={{ background: "var(--navy)" }}
          >
            Ir a entrar →
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1180px] px-4 pb-16 sm:px-6">
        <div className="flex flex-col gap-5 sm:gap-7">
          {rieles.map((riel) => (
            <RielProveedores
              key={riel.vertical}
              titulo={riel.titulo}
              items={riel.items}
              conteo={riel.total}
              // Las notas reales de cada demo se calculan solas en
              // `calificaciones_rancho` a partir de sus 25 reseñas.
              calificaciones={notas}
              // Vacío: la demo no calcula disponibilidad real, y una
              // fecha inventada de «libre desde» sí sería una mentira
              // funcional — alguien la leería como un dato.
              proximasLibres={new Map()}
              favoritosIds={new Set()}
              sesionActiva={false}
            />
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
