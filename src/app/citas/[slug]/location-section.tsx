import { IconPin } from "@/components/icons";
import MapaPunto from "@/components/mapa-punto";

const TITULO = "titulo text-[18px] text-aventurea-navy";

/**
 * La sección de ubicación del perfil público.
 *
 * CON MAPA REAL desde el 28 ago 2026 («arreglar esto urgente, el tema
 * del mapa», dijo el dueño frente al cuadriculado de mentira). El
 * comentario que vivía acá («package.json no trae ninguna librería de
 * mapas») dejó de ser cierto en cuanto entró Leaflet para el selector
 * de ubicación — este bloque quedó de placeholder por inercia, no por
 * decisión.
 *
 * · CON COORDENADAS (las marca el dueño con el pin en el editar de
 *   mi-negocio): `MapaPunto` — Leaflet + OpenStreetMap, gratis y sin
 *   llave, con su botón de Satélite. El porqué de no usar Google Maps
 *   está en la cabecera de ese componente.
 * · SIN COORDENADAS: el bloque visual de siempre, con su leyenda
 *   honesta de «zona aproximada» — un mapa centrado en «Desamparados»
 *   a secas fingiría una precisión que el dato no tiene.
 */
export default function LocationSection({
  direccion,
  ubicacion,
  comoLlegarHref,
  latitud,
  longitud,
}: {
  direccion: string | null;
  ubicacion: string | null;
  comoLlegarHref: string | null;
  latitud: number | null;
  longitud: number | null;
}) {
  if (!direccion && !ubicacion && !comoLlegarHref) return null;

  const tieneCoordenadas = latitud !== null && longitud !== null;

  return (
    <div className="mt-9">
      <h2 className={TITULO}>Ubicación</h2>
      <div className="mt-3 overflow-hidden rounded-3xl border border-aventurea-line bg-aventurea-surface shadow-[0_14px_44px_-24px_rgba(22,41,94,0.35)]">
        {/* La comparación va INLINE y no vía `tieneCoordenadas`: es lo
            que le permite a TypeScript estrechar latitud/longitud a
            number dentro de la rama. */}
        {latitud !== null && longitud !== null ? (
          <MapaPunto
            latitud={latitud}
            longitud={longitud}
            altoClase="h-[200px] sm:h-[240px]"
          />
        ) : (
          <div
            className="relative flex h-[160px] items-center justify-center bg-[linear-gradient(160deg,#eef3fb_0%,#e2ecfa_100%)] sm:h-[190px]"
            aria-hidden="true"
          >
            <span
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#c8d6ef 1px, transparent 1px), linear-gradient(90deg, #c8d6ef 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <IconPin className="relative h-11 w-11 text-aventurea-navy" />
          </div>
        )}

        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {direccion ? (
              <>
                <p className="text-[14px] font-bold leading-relaxed text-aventurea-ink">
                  {direccion}
                </p>
                {ubicacion && (
                  <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">{ubicacion}</p>
                )}
              </>
            ) : (
              ubicacion && (
                <p className="text-[14px] font-bold leading-relaxed text-aventurea-ink">
                  {ubicacion}
                </p>
              )
            )}
            <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
              {tieneCoordenadas
                ? "Ubicación exacta registrada por el negocio."
                : "Zona aproximada — pedile la dirección exacta al negocio."}
            </p>
          </div>

          {comoLlegarHref && (
            <a
              href={comoLlegarHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-aventurea-navy px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              <IconPin className="h-4 w-4" />
              Cómo llegar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
