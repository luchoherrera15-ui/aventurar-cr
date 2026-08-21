"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CRC_DEMO,
  horaBonita,
  mejorDescuento,
  precioSimbolo,
  type RestauranteDemo,
} from "@/lib/food/demo/tipos";
import { toggleFavorito, useFavoritosDemo } from "@/lib/food/demo/estado";
import { IconHeart, IconPin, IconStar } from "@/components/icons";

/**
 * La card de restaurante de la DEMO comercial. Es un componente aparte
 * de `RestauranteCard` (la card del directorio real) a propósito: acá
 * hay rating, reseñas, tipo de cocina, rango de precios y corazón de
 * favoritos — datos y funciones que en producción NO existen y que la
 * card real se niega a inventar. Fusionarlas obligaría a la card real a
 * aceptar props con forma de dato ficticio.
 */
export default function CardDemo({
  r,
  prioridad = false,
}: {
  r: RestauranteDemo;
  prioridad?: boolean;
}) {
  const router = useRouter();
  const favoritos = useFavoritosDemo();
  const esFavorito = favoritos.includes(r.slug);
  const descuento = mejorDescuento(r);
  const precioFinal = Math.round(r.precioPromedio * (1 - descuento / 100));
  const visibles = r.promociones.slice(0, 3);
  const restantes = r.promociones.length - visibles.length;
  const mejorDelDia = visibles.reduce((max, p) => Math.max(max, p.descuento), 0);

  return (
    <Link
      href={`/food/demo/restaurante/${r.slug}`}
      className="elevar group block overflow-hidden rounded-3xl border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(6,38,83,0.32)]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-aventurea-blue-light">
        <Image
          src={r.fotoPrincipal}
          alt={r.nombre}
          fill
          priority={prioridad}
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 400px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {descuento > 0 && (
          <span className="absolute left-3.5 top-3.5 rounded-full bg-aventurea-orange px-3.5 py-1.5 text-[15px] font-extrabold text-white shadow-elevado">
            −{descuento}%
          </span>
        )}
        <button
          type="button"
          aria-label={esFavorito ? "Quitar de favoritos" : "Guardar en favoritos"}
          aria-pressed={esFavorito}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorito(r.slug);
          }}
          className={`presionable absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-colors ${
            esFavorito ? "bg-aventurea-orange text-white" : "bg-white/85 text-aventurea-navy hover:bg-white"
          }`}
        >
          <IconHeart className="h-[18px] w-[18px]" />
        </button>
        {r.esNuevo && (
          <span className="absolute bottom-3.5 left-3.5 rounded-full bg-white/90 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
            Nuevo
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="titulo min-w-0 truncate text-[17.5px] leading-snug text-aventurea-ink">
            {r.nombre}
          </p>
          <p className="flex shrink-0 items-center gap-1 text-[13px] font-extrabold text-aventurea-ink">
            <IconStar className="h-3.5 w-3.5 text-amber-500" />
            {r.rating.toFixed(1)}
            <span className="font-bold text-aventurea-ink-soft">({r.resenas})</span>
          </p>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-aventurea-ink-soft">
          <IconPin className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />
          <span className="truncate">
            {r.zona} · {r.cocina} · {precioSimbolo(r.precioNivel)}
          </span>
        </p>

        <div className="mt-3.5">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
            Hoy
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {visibles.map((p) => (
              <span
                key={p.hora}
                className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
                  p.descuento === mejorDelDia
                    ? "border-aventurea-orange/40 bg-aventurea-orange-light text-aventurea-ink"
                    : "border-aventurea-line bg-white text-aventurea-ink"
                }`}
              >
                {horaBonita(p.hora)}
                <span className="ml-1 text-aventurea-orange-dark">−{p.descuento}%</span>
              </span>
            ))}
            {restantes > 0 && (
              <span className="rounded-lg border border-aventurea-line bg-white px-2 py-1.5 text-[12px] font-bold text-aventurea-ink-soft">
                +{restantes}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-aventurea-line pt-4">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2">
              <span className="text-[18px] font-extrabold text-aventurea-navy">
                {CRC_DEMO.format(precioFinal)}
              </span>
              {descuento > 0 && (
                <span className="text-[12.5px] text-aventurea-ink-soft line-through">
                  {CRC_DEMO.format(r.precioPromedio)}
                </span>
              )}
            </p>
            {/* La respuesta a "¿sobre qué se calcula?": es el consumo
                promedio POR PERSONA según el menú del restaurante. */}
            <p className="text-[10.5px] font-bold text-aventurea-ink-soft">
              por persona, según el menú
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[14px] font-extrabold text-aventurea-orange transition-transform group-hover:translate-x-0.5">
              Reservar →
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/food/demo/restaurante/${r.slug}#menu`);
              }}
              className="text-[12px] font-bold text-aventurea-navy underline-offset-2 hover:underline"
            >
              Ver menú
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
