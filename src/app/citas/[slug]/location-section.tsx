import { IconPin } from "@/components/icons";

const TITULO = "titulo text-[18px] text-aventurea-navy";

/**
 * La sección de ubicación del perfil público.
 *
 * SIN MAPA REAL A PROPÓSITO: `package.json` no trae ninguna librería de
 * mapas (Leaflet, Mapbox, Google Maps JS...) y en el repo no hay
 * ninguna llave de Google Maps configurada — se buscó "GOOGLE_MAPS" y
 * "maps.googleapis" en el código y en .env.example / .env.local.example,
 * sin resultado. Instalar una dependencia nueva solo para esto no es el
 * pedido, así que acá va un bloque visual con el pin y la dirección en
 * vez de un mapa embebido.
 *
 * CUANDO EXISTA una API key (Google Static Maps o similar), el
 * rectángulo de acá abajo es justo donde iría la imagen del mapa real,
 * usando `latitud`/`longitud` — el resto del bloque (dirección, botón
 * "Cómo llegar") queda igual.
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
        {/* Placeholder del mapa — ver comentario del componente. */}
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
