"use client";

import { esDemo } from "@/lib/demo";
import { rutaDeNegocio } from "@/lib/ruta-negocio";
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconHeart, IconPin, IconStar } from "@/components/icons";
import {
  SUBCATEGORIA_LABEL,
  enConfiguracion,
  type Rancho,
} from "@/app/mi-negocio/types";
import {
  categoriaGradiente,
  categoriaIcono,
  categoriaLabel,
  esCategoriaValida,
} from "@/lib/categorias-vertical";
import { alternarFavorito } from "@/app/eventos/favoritos-actions";
import { esFechaHoy, fmtFechaCorta } from "@/lib/fechas";

export type Calificacion = { rancho_id: string; promedio: number; total: number };

/**
 * Tarjeta única para todo el marketplace: grilla de resultados y
 * rieles del home usan exactamente esta misma pieza. Fondo blanco,
 * foto cuadrada aparte del texto — nada de degradado ni botón
 * "Reservar" adentro; la tarjeta completa es el link.
 */
export default function RanchoCard({
  rancho,
  index = 0,
  calificacion,
  proximaLibre,
  favoritoInicial,
  sesionActiva,
  ancho,
  sizes,
  prioridad,
}: {
  rancho: Rancho;
  index?: number;
  calificacion: Calificacion | null;
  /** undefined = no aplica (no es "lugares"); null = agotado; string = fecha ISO libre. */
  proximaLibre?: string | null;
  favoritoInicial: boolean;
  sesionActiva: boolean;
  /** Ancho CSS (ej. "220px" o un clamp()) para uso en riel horizontal; sin esto, ocupa el 100% de su celda de grilla. */
  ancho?: string;
  /**
   * El `sizes` de la foto. El valor por defecto describe la GRILLA del
   * directorio; quien pone `ancho` está sacando la tarjeta de esa
   * grilla y metiéndola en un riel, donde mide otra cosa — y con un
   * `sizes` que miente el navegador baja una foto más chica de lo que
   * la ranura necesita y se ve blanda. Los rieles pasan el suyo (ver
   * `SIZES_TARJETA` en riel-proveedores.tsx), calculado a partir del
   * mismo `clamp()` que define el ancho.
   */
  sizes?: string;
  /**
   * Si el precio lleva su unidad («por evento», «por noche»…). Por
   * defecto sí — es lo correcto dentro de un directorio de una sola
   * vertical, donde la unidad SÍ describe lo que se está mirando.
   *
   * Se apaga donde la lista mezcla verticales, como la portada: ahí
   * conviven una barbería y un salón de eventos, y como `unidad_precio`
   * arrastra el 'evento' por defecto de la 0033, la barbería diría
   * «desde ₡1.500 por evento». El monto es cierto; la unidad, no.
   */
  /**
   * Si esta tarjeta se pelea por el ancho de banda con el resto de la
   * página (`loading="eager"` + `fetchPriority="high"` en su foto).
   *
   * Por defecto es «la primera de la lista», que es el comportamiento
   * de siempre y el correcto cuando hay UNA lista en pantalla. Deja de
   * serlo cuando hay varias: la portada pasó de un riel a seis
   * carriles, y con el default cada uno marcaba su primera foto como
   * prioritaria — seis imágenes compitiendo con el héroe, que es
   * justamente lo que Google mide. Quien monta la lista sabe si la suya
   * es la que va arriba de todo; la tarjeta sola, no.
   */
  prioridad?: boolean;
}) {
  // Enlaza DIRECTO a la ficha, sin pasar por el rebote de `/{slug}`.
  // Acá decía `/${slug}` para todos, y para Citas y Restaurantes eso es
  // un 307: cada clic en el directorio pagaba un viaje de ida y vuelta
  // antes de empezar a cargar. Ver src/lib/ruta-negocio.ts.
  const href = rutaDeNegocio(rancho);
  // Cantón y provincia alcanzan: la dirección exacta se desbordaba y
  // quedaba cortada a media palabra.
  const ubicacion = [rancho.canton, rancho.provincia].filter(Boolean).join(", ");
  // eslint-disable-next-line react-hooks/purity -- "nuevo" es una etiqueta de vitrina; no pasa nada si queda desactualizada un instante entre renders
  const esNuevo = Date.now() - new Date(rancho.created_at).getTime() < 1000 * 60 * 60 * 24 * 30;

  // Criterio compartido (src/lib/demo.ts): mira `detalles.demo` además
  // del prefijo del slug. Con solo el slug, los demos sembrados para
  // parecer un negocio real salían SIN el aviso.
  const demo = esDemo(rancho.slug, rancho.detalles);
  // Esta card se usa en Eventos, Hospedajes y favoritos de cualquier
  // vertical: rubro, ícono y gradiente salen del helper por vertical
  // (categorias-vertical.ts), que ya sabe caer a "otros" si la
  // categoría no matchea.
  const rubro = rancho.subcategoria
    ? SUBCATEGORIA_LABEL[rancho.subcategoria]
    : esCategoriaValida(rancho.vertical ?? "eventos", rancho.categoria)
      ? categoriaLabel(rancho.vertical ?? "eventos", rancho.categoria)
      : rancho.categoria;

  // En configuración: se ve en el directorio pero no se puede abrir —
  // el dueño todavía la está armando.
  const enPausa = enConfiguracion(rancho.detalles);

  // Sin `prioridad` explícita, el comportamiento de siempre.
  const prioritaria = prioridad ?? index === 0;

  return (
    <article
      data-reveal
      className="h-full"
      // Tope en 6 para no hacer esperar de más a las cards de más
      // abajo en páginas grandes — el efecto ya se nota igual.
      style={
        {
          "--reveal-delay": `${Math.min(index, 6) * 60}ms`,
          ...(ancho ? { width: ancho, flex: `0 0 ${ancho}` } : {}),
        } as React.CSSProperties
      }
    >
      {/* El mismo lenguaje de la card de Citas: foto 16:10 con el
          rubro encima, cuerpo blanco con nombre + nota, ubicación y el
          pie "Desde ₡ · Reservar →". Una sola card en todo el sitio. */}
      <Link
        href={enPausa ? "#" : href}
        aria-disabled={enPausa || undefined}
        tabIndex={enPausa ? -1 : undefined}
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)] transition-all ${
          enPausa
            ? "pointer-events-none"
            : "hover:-translate-y-1 hover:border-aventurea-navy/50 hover:shadow-[0_20px_44px_-20px_rgba(22,41,94,0.4)]"
        }`}
      >
        {/* 4:3 en vez de 16:10 — la foto es la protagonista y el
            bloque blanco de abajo queda lo más chico posible. */}
        <div
          className="relative aspect-[4/3] overflow-hidden bg-aventurea-blue-light"
          style={
            !rancho.foto_url
              ? { backgroundImage: categoriaGradiente(rancho.vertical ?? "eventos", rancho.categoria) }
              : undefined
          }
        >
          {rancho.foto_url ? (
            <Image
              src={rancho.foto_url}
              alt={rancho.nombre}
              fill
              // La foto de la primera card es el elemento LCP medido de
              // /eventos, del home y de /citas — y salía `loading=lazy`,
              // o sea que el navegador la dejaba para el final. Eager +
              // prioridad alta, sin `preload`: son varios rieles y no se
              // sabe cuál queda arriba de todo, y los docs de Next 16
              // desaconsejan el <link preload> justo en ese caso.
              loading={prioritaria ? "eager" : undefined}
              fetchPriority={prioritaria ? "high" : undefined}
              sizes={sizes ?? "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 260px"}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-12 [&_svg]:w-12">
              {categoriaIcono(rancho.vertical ?? "eventos", rancho.categoria)}
            </span>
          )}

          {/* El velo de "en configuración": tapa la foto entera para
              que se lea de una que esa publicación todavía no se puede
              abrir, sin sacarla del directorio. */}
          {enPausa && (
            <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-aventurea-navy/70 px-4 text-center backdrop-blur-[2px]">
              <span className="rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-aventurea-navy">
                En configuración
              </span>
              <span className="text-[11.5px] font-bold leading-snug text-white/85">
                Muy pronto disponible para reservar
              </span>
            </span>
          )}

          <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
            {rubro}
          </span>

          <span className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            {demo && (
              <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
                Demo
              </span>
            )}
            {/* Destacado le gana el puesto a "Nuevo". */}
            {rancho.destacado_orden != null ? (
              <span className="rounded-lg bg-aventurea-sky px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-sm">
                ★ Destacado
              </span>
            ) : (
              esNuevo && (
                <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-ink backdrop-blur">
                  Nuevo
                </span>
              )
            )}
          </span>

          <BotonFavorito ranchoId={rancho.id} inicial={favoritoInicial} sesionActiva={sesionActiva} />
        </div>

        <div className="flex flex-1 flex-col px-4 pb-3 pt-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold leading-snug text-aventurea-ink">
              {rancho.nombre}
            </h3>
            {calificacion && (
              <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[12.5px] font-bold text-aventurea-ink">
                <IconStar className="h-3.5 w-3.5 text-bookea-naranja-fuerte" />
                {calificacion.promedio.toFixed(1).replace(".", ",")}
                <span className="font-semibold text-aventurea-ink-soft">
                  ({calificacion.total})
                </span>
              </span>
            )}
          </div>
          {ubicacion && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-aventurea-ink-soft">
              <IconPin className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />
              {ubicacion}
            </p>
          )}

          {rancho.categoria === "lugares" && proximaLibre !== undefined && (
            <span
              className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                proximaLibre
                  ? "border-aventurea-navy text-aventurea-navy"
                  : "border-aventurea-line text-zinc-500"
              }`}
            >
              <i
                aria-hidden
                className={`h-1 w-1 rounded-full ${proximaLibre ? "bg-aventurea-navy" : "bg-zinc-300"}`}
              />
              {proximaLibre
                ? esFechaHoy(proximaLibre)
                  ? "Libre ahora"
                  : `Libre desde ${fmtFechaCorta(proximaLibre)}`
                : "Agotado"}
            </span>
          )}

          {/* ⚠️ ACÁ IBA «Desde ₡X» Y SE SACÓ A PEDIDO DEL DUEÑO (26 ago
              2026): «en los CARDS quitá lo de desde y que sale el precio
              más bajo».

              El dato tenía un problema de fondo: `precio_desde` es UN
              número para un negocio que vende MUCHAS cosas a precios
              distintos. En un salón de eventos casi es el precio; en una
              barbería con veinte servicios, «desde ₡5.000» es el corte
              más barato y no dice nada de lo que la persona va a pagar
              — pero le ancla la expectativa igual, y se la ancla mal.

              El precio de verdad vive en la ficha, servicio por
              servicio, que es donde se puede leer sin que engañe.

              NO se tocó la ficha del negocio (`rancho-portal.tsx`) ni la
              descripción que sale en Google (`lib/seo-negocio.ts`): ahí
              el precio va con el contexto que lo hace cierto. */}
          <div className="mt-auto flex items-center justify-end gap-2 border-t border-aventurea-line/70 pt-2.5">
            <span
              className={`shrink-0 text-[13px] font-extrabold ${
                enPausa ? "text-aventurea-ink-soft" : "text-bookea-naranja-fuerte"
              }`}
            >
              {enPausa ? "No disponible aún" : "Reservar →"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function BotonFavorito({
  ranchoId,
  inicial,
  sesionActiva,
}: {
  ranchoId: string;
  inicial: boolean;
  sesionActiva: boolean;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(inicial);
  const [pending, startTransition] = useTransition();

  function alternar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!sesionActiva) {
      router.push("/cuenta");
      return;
    }
    const nuevo = !activo;
    setActivo(nuevo);
    startTransition(async () => {
      const res = await alternarFavorito(ranchoId, nuevo);
      if (res?.error) setActivo(!nuevo);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pending}
      aria-label={activo ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={activo}
      className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-110 disabled:opacity-70"
    >
      <IconHeart className={`h-4 w-4 ${activo ? "text-aventurea-orange" : "text-aventurea-ink-soft"}`} />
    </button>
  );
}
