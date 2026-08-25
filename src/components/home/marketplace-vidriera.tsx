import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";
import { enConfiguracion, UNIDAD_PRECIO_LABEL, type Rancho, type UnidadPrecio } from "@/app/mi-negocio/types";
import { categoriaGradiente, categoriaIcono, categoriaLabel } from "@/lib/categorias-vertical";
import { rutaDeNegocio } from "@/lib/ruta-negocio";
import { esDemo } from "@/lib/demo";

/**
 * LA VIDRIERA DEL MARKETPLACE — 5 negocios reales, en el home nuevo.
 *
 * Antes el marketplace ERA la portada (RielesCatalogo). Ahora es una
 * vitrina chica más abajo: cinco tarjetas, variedad de categorías si
 * la hay, y el link "Ver todo el catálogo" a `/eventos` — que ya es un
 * directorio completo por su cuenta (Directorio + SelectorVertical),
 * así que esta sección no necesita traer ni el buscador ni los rieles
 * que se sacaron del home.
 *
 * MISMA REGLA QUE EL RESTO DEL SITIO: nada de negocios de mentira. Si
 * hoy hay menos de cinco negocios aprobados y reales, se muestran los
 * que hay — no se completa con relleno. `esDemo` saca las cuentas
 * `*.demo@bookea.lat` sembradas para pruebas (ver memoria del
 * proyecto): esta vidriera es la cara pública del sitio, no puede
 * mostrar un negocio de mentira como si fuera un cliente.
 */

const TOPE = 5;

type NegocioVidriera = {
  id: string;
  nombre: string;
  categoriaTexto: string;
  precioTexto: string | null;
  fotoUrl: string | null;
  gradiente: string;
  icono: React.ReactNode;
  href: string;
};

function fmtColones(n: number | null): string | null {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

/** Hasta 5, preferiendo no repetir vertical+categoría antes de repetir. */
function elegirVariados(lista: Rancho[], tope: number): Rancho[] {
  const vistos = new Set<string>();
  const variados: Rancho[] = [];
  const resto: Rancho[] = [];
  for (const r of lista) {
    const clave = `${r.vertical ?? "eventos"}:${r.categoria}`;
    if (!vistos.has(clave) && variados.length < tope) {
      vistos.add(clave);
      variados.push(r);
    } else {
      resto.push(r);
    }
  }
  for (const r of resto) {
    if (variados.length >= tope) break;
    variados.push(r);
  }
  return variados;
}

async function leerVidrieraMarketplace(): Promise<NegocioVidriera[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select(COLUMNAS_CARD)
    .eq("estado", "aprobado")
    .order("created_at", { ascending: false });

  const aprobados = (data ?? []) as unknown as Rancho[];
  const pintables = aprobados.filter(
    (r) => !enConfiguracion(r.detalles) && !esDemo(r.slug, r.detalles),
  );
  const elegidos = elegirVariados(pintables, TOPE);

  return elegidos.map((r) => {
    const vertical = r.vertical ?? "eventos";
    const unidad = r.unidad_precio as UnidadPrecio | null;
    const precio = fmtColones(r.precio_desde);
    return {
      id: r.id,
      nombre: r.nombre,
      categoriaTexto: categoriaLabel(vertical, r.categoria),
      precioTexto: precio ? `Desde ${precio}${unidad ? ` ${UNIDAD_PRECIO_LABEL[unidad]}` : ""}` : null,
      fotoUrl: r.foto_url ?? null,
      gradiente: categoriaGradiente(vertical, r.categoria),
      icono: categoriaIcono(vertical, r.categoria),
      href: rutaDeNegocio(r),
    };
  });
}

export default async function MarketplaceVidriera() {
  const negocios = await leerVidrieraMarketplace();
  if (negocios.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-14 lg:px-6 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="titulo text-[26px] text-[color:var(--navy)] sm:text-[32px]">
            Descubrí el marketplace
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[14.5px] text-aventurea-ink-soft">
            Lugares, servicios y experiencias reales, listos para reservar directo.
          </p>
        </div>
        <Link
          href="/eventos"
          className="shrink-0 text-[13.5px] font-bold text-[color:var(--accion)] underline underline-offset-2 hover:text-[color:var(--accion-hover)]"
        >
          Ver todo el catálogo →
        </Link>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {negocios.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            className="group overflow-hidden rounded-2xl border border-aventurea-line bg-white transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(6,38,83,0.25)]"
          >
            <div className={`relative aspect-square w-full ${n.fotoUrl ? "" : n.gradiente}`}>
              {n.fotoUrl ? (
                <Image
                  src={n.fotoUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-white/80 [&_svg]:h-9 [&_svg]:w-9">
                  {n.icono}
                </span>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--navy)] shadow-sm">
                {n.categoriaTexto}
              </span>
            </div>
            <div className="p-3">
              <p className="truncate text-[13.5px] font-extrabold text-aventurea-ink">{n.nombre}</p>
              {n.precioTexto && (
                <p className="mt-0.5 truncate text-[12px] text-aventurea-ink-soft">{n.precioTexto}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
