import Image from "next/image";
import Link from "next/link";
import { CRC } from "@/lib/food/tipos";
import type { TarjetaFood } from "@/lib/food/tarjetas";
import { IconCloche, IconPin } from "@/components/icons";
import BotonFavorito from "./boton-favorito";

/**
 * La tarjeta grande del directorio de FOOD.BOOKEA — rediseño ago 2026
 * sobre el mockup del dueño: foto protagonista con badge de descuento,
 * nombre, ubicación real, platos del menú (en vez de un tipo de cocina
 * inventado — ver el comentario de `TarjetaFood.platos`), la fila de
 * horarios de la fecha más próxima y el precio original/con descuento
 * con el "Reservar →" naranja.
 *
 * El corazón de favoritos es real desde la 0201 (food_favoritos) — se
 * pinta solo cuando quien llama pasa `favoritoInicial`/`logueado`, así
 * que un lugar que todavía no resolvió esos datos (o no los necesita)
 * no paga nada de más. Sin rating ni distancia: esas columnas no
 * existen hoy en la base, y un número inventado es peor que no
 * tenerlo. Todo lo demás viene de `TarjetaFood`
 * (src/lib/food/tarjetas.ts); esta tarjeta no calcula nada, solo pinta.
 */
export default function RestauranteCard({
  tarjeta,
  prioridad = false,
  favoritoInicial,
  logueado = false,
}: {
  tarjeta: TarjetaFood;
  prioridad?: boolean;
  /** undefined = esta pantalla no resolvió favoritos (el corazón no se pinta). */
  favoritoInicial?: boolean;
  logueado?: boolean;
}) {
  const {
    nombre,
    slug,
    fotoUrl,
    ubicacion,
    platos,
    precioDesde,
    precioConDescuento,
    descuentoPorcentaje,
    esNuevo,
    franjasProximas,
    franjasProximasEtiqueta,
  } = tarjeta;

  const tieneOferta = precioConDescuento != null;
  const mejorDelDia = franjasProximas.reduce((max, f) => Math.max(max, f.descuento), 0);

  return (
    <Link
      href={`/food/restaurante/${slug}`}
      className="elevar group block overflow-hidden rounded-3xl border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(6,38,83,0.32)]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-aventurea-blue-light">
        {fotoUrl ? (
          <Image
            src={fotoUrl}
            alt={nombre}
            fill
            priority={prioridad}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 400px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-aventurea-navy/40">
            <IconCloche className="h-12 w-12" />
          </span>
        )}

        {/* El badge de descuento es lo primero que el ojo debe registrar
            en la card — de ahí el tamaño y el contraste. "Nuevo" se
            apila debajo en vez de compartir la esquina derecha con el
            favorito: dos controles/badges en la misma esquina se pisan
            en pantallas chicas. */}
        <div className="absolute left-3.5 top-3.5 flex flex-col items-start gap-1.5">
          {descuentoPorcentaje > 0 && (
            <span className="rounded-full bg-aventurea-orange px-3.5 py-1.5 text-[15px] font-extrabold text-white shadow-elevado">
              −{descuentoPorcentaje}%
            </span>
          )}
          {esNuevo && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
              Nuevo
            </span>
          )}
        </div>

        {favoritoInicial !== undefined && (
          <div className="absolute right-3.5 top-3.5">
            <BotonFavorito
              businessId={tarjeta.id}
              favoritoInicial={favoritoInicial}
              logueado={logueado}
              slugParaVolver={tarjeta.slug}
            />
          </div>
        )}
      </div>

      <div className="p-5">
        <p className="titulo text-[17.5px] leading-snug text-aventurea-ink">{nombre}</p>
        {(ubicacion || platos.length > 0) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-aventurea-ink-soft">
            {ubicacion && (
              <>
                <IconPin className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />
                <span className="truncate">{ubicacion}</span>
              </>
            )}
            {ubicacion && platos.length > 0 && <span aria-hidden>·</span>}
            {platos.length > 0 && <span className="truncate">{platos.join(" · ")}</span>}
          </p>
        )}

        {/* Los horarios de la fecha más próxima, con su % — el corazón
            del producto (descuento POR HORARIO) a la vista desde el
            directorio. El chip con mayor descuento se pinta naranja. */}
        {franjasProximas.length > 0 && (
          <div className="mt-3.5">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
              {franjasProximasEtiqueta}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {franjasProximas.map((f) => {
                const esLaMejor = f.descuento > 0 && f.descuento === mejorDelDia;
                return (
                  <span
                    key={f.hora}
                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
                      esLaMejor
                        ? "border-aventurea-orange/40 bg-aventurea-orange-light text-aventurea-ink"
                        : "border-aventurea-line bg-white text-aventurea-ink"
                    }`}
                  >
                    {f.hora}
                    {f.descuento > 0 && (
                      <span className="ml-1 text-aventurea-orange-dark">−{f.descuento}%</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-aventurea-line pt-4">
          <div className="min-w-0">
            {tieneOferta ? (
              <p className="flex items-baseline gap-2">
                <span className="text-[18px] font-extrabold text-aventurea-navy">
                  {CRC.format(precioConDescuento!)}
                </span>
                <span className="text-[12.5px] text-aventurea-ink-soft line-through">
                  {CRC.format(precioDesde!)}
                </span>
              </p>
            ) : precioDesde != null ? (
              <p className="text-[14px] font-bold text-aventurea-ink">
                Desde {CRC.format(precioDesde)}
              </p>
            ) : (
              <span aria-hidden />
            )}
          </div>
          <span className="shrink-0 text-[14px] font-extrabold text-aventurea-orange transition-transform group-hover:translate-x-0.5">
            Reservar →
          </span>
        </div>
      </div>
    </Link>
  );
}
