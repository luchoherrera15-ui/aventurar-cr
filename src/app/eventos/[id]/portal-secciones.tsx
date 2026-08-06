import Image from "next/image";
import {
  IconCheck,
  IconFacebook,
  IconGlobe,
  IconInstagram,
  IconPin,
  IconStar,
  IconTiktok,
  IconWaze,
} from "@/components/icons";
import {
  CAMPOS_POR_CATEGORIA,
  formatearValor,
} from "@/app/mi-negocio/campos-servicio";
import {
  AMENIDADES,
  AMENIDADES_GRUPOS,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  type Categoria,
} from "@/app/mi-negocio/types";
import GaleriaHeroFotos from "@/components/galeria-hero";
import AmenidadesLista from "./amenidades-tabs";

/**
 * El texto de presentación (descripción larga). Antes iba encima de una
 * foto oscurecida a pantalla completa — la galería real ya vive arriba
 * de todo, en el hero, así que acá alcanza con texto plano.
 */
export function PresentacionSeccion({
  eyebrow,
  titulo,
  texto,
}: {
  eyebrow: string;
  titulo: string;
  texto: string | null;
}) {
  if (!texto) return null;

  return (
    <section className="border-t border-aventurea-line py-14">
      <div data-reveal className="mx-auto max-w-[720px] px-7 text-center">
        <p className="flex items-center justify-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-sky after:block after:h-[1.5px] after:w-5 after:bg-aventurea-sky">
          {eyebrow}
        </p>
        <h2 className="titulo mt-3 text-[26px] text-aventurea-ink">{titulo}</h2>
        <p className="mx-auto mt-5 max-w-[62ch] whitespace-pre-line text-[14.5px] leading-relaxed text-aventurea-ink-soft">
          {texto}
        </p>
      </div>
    </section>
  );
}

/**
 * El hero del detalle: 1 foto grande + hasta 4 chicas en desktop, la
 * primera sola en móvil. Nada de degradado ni texto encima — el
 * nombre y la ubicación van debajo, en texto plano.
 */
export function GaleriaHero({
  fotos,
  categoria,
  nombre,
}: {
  fotos: string[];
  categoria: Categoria;
  nombre: string;
}) {
  if (fotos.length === 0) {
    return (
      <div
        className="relative flex aspect-[16/9] items-center justify-center overflow-hidden sm:aspect-[21/9]"
        style={{ backgroundImage: CATEGORIA_GRADIENTE[categoria] }}
      >
        <span className="text-white/25 [&_svg]:h-16 [&_svg]:w-16">
          {CATEGORIA_ICONO[categoria]}
        </span>
      </div>
    );
  }

  return <GaleriaHeroFotos fotos={fotos} nombre={nombre} />;
}

/**
 * Franja clara con los datos de un vistazo (capacidad, amenidades,
 * ubicación). Va justo debajo del header y, además de informar, separa
 * las dos secciones con foto: pegadas se mezclaban los colores y se
 * leían como una sola imagen.
 */
export function ResumenSeccion({
  datos,
}: {
  datos: { icono: React.ReactNode; titulo: string; detalle: string }[];
}) {
  if (datos.length === 0) return null;

  return (
    <section className="border-b border-aventurea-line bg-aventurea-cream py-9">
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-4 px-7 sm:grid-cols-3">
        {datos.map((d, i) => (
          <div
            key={d.titulo}
            data-reveal
            style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
            className="flex items-center gap-3.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 shadow-[0_1px_2px_rgba(16,26,44,0.04)] transition-shadow hover:shadow-[0_8px_20px_-8px_rgba(16,26,44,0.15)]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aventurea-sky/10 text-aventurea-orange [&_svg]:h-5 [&_svg]:w-5">
              {d.icono}
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-aventurea-ink">
                {d.titulo}
              </h3>
              <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                {d.detalle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Lista de amenidades del lugar, agrupada como en el panel del dueño. */
export function AmenidadesSeccion({
  amenidades,
  enColumna = false,
}: {
  amenidades: string[];
  /** true = sin sección propia: vive dentro de la columna de contenido
   * del portal (así la tarjeta de precio sticky la acompaña). */
  enColumna?: boolean;
}) {
  const grupos = AMENIDADES_GRUPOS.map((g) => ({
    titulo: g.titulo,
    items: g.items.filter((i) => amenidades.includes(i.id)),
  })).filter((g) => g.items.length > 0);

  // Etiquetas que el dueño escribió a mano (no están en la lista
  // predefinida): se muestran igual, en un grupo aparte.
  const extras = amenidades.filter((a) => !AMENIDADES.includes(a));
  if (extras.length > 0) {
    grupos.push({
      titulo: "Otras",
      items: extras.map((a) => ({ id: a, label: a })),
    });
  }

  if (grupos.length === 0) return null;

  const contenido = (
    <>
      <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-sky">
        Lo que incluye
      </p>
      <h2 className={`titulo mt-2 text-aventurea-ink ${enColumna ? "text-[20px]" : "text-[28px]"}`}>
        Amenidades del lugar
      </h2>

      {/* Todos los grupos a la vista, cada uno en su tarjeta: las
          amenidades son material de decisión, no un acordeón. */}
      <div data-reveal className={enColumna ? "mt-4" : "mt-6"}>
        <AmenidadesLista grupos={grupos} enColumna={enColumna} />
      </div>
    </>
  );

  if (enColumna) return <div className="mt-10">{contenido}</div>;

  return (
    <section className="py-14">
      <div className="mx-auto max-w-[1080px] px-7">{contenido}</div>
    </section>
  );
}

/**
 * Detalles propios del tipo de servicio (mínimo de personas, equipo que
 * lleva, inventario...). Se arma con la misma definición que el formulario
 * del dueño, así lo que llena es exactamente lo que se muestra.
 */
export function DetallesSeccion({
  categoria,
  detalles,
}: {
  categoria: Categoria;
  detalles: Record<string, unknown>;
}) {
  const grupos = (CAMPOS_POR_CATEGORIA[categoria] ?? [])
    .map((g) => ({
      titulo: g.titulo,
      items: g.campos
        .map((campo) => ({
          label: campo.label,
          valor: formatearValor(campo, detalles?.[campo.id]),
          tipo: campo.tipo,
        }))
        .filter((i) => i.valor !== null),
    }))
    .filter((g) => g.items.length > 0);

  if (grupos.length === 0) return null;

  return (
    <section className="py-14">
      <div className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-sky">
          El servicio
        </p>
        <h2 className="titulo mt-2 text-[28px] text-aventurea-ink">
          Detalles y cobertura
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((g, gi) => (
            <div
              key={g.titulo}
              data-reveal
              style={{ "--reveal-delay": `${gi * 90}ms` } as React.CSSProperties}
              className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-[0_1px_2px_rgba(16,26,44,0.04)]"
            >
              <h3 className="mb-3 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                {g.titulo}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {g.items.map((i) => (
                  <li key={i.label} className="text-[13.5px]">
                    {/* Los "sí/no" se leen mejor como una lista con check
                        que como "Vajilla: Sí". */}
                    {i.tipo === "booleano" ? (
                      <span className="flex items-center gap-2.5 text-aventurea-ink">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aventurea-green/15 text-aventurea-green">
                          <IconCheck className="h-3 w-3" />
                        </span>
                        {i.label}
                      </span>
                    ) : (
                      <>
                        <span className="block text-[11.5px] text-aventurea-ink-soft">
                          {i.label}
                        </span>
                        <span className="mt-0.5 block font-bold text-aventurea-ink">
                          {i.valor}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Reseñas reales de clientes con reserva confirmada (tabla resenas). */
export type Resena = {
  id: string;
  calificacion: number;
  comentario: string | null;
  created_at: string;
};

export function ResenasSeccion({
  resenas,
  promedio,
  total,
}: {
  resenas: Resena[];
  promedio: number | null;
  total: number;
}) {
  if (resenas.length === 0) return null;

  return (
    <section className="border-t border-aventurea-line py-14">
      <div data-reveal className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-sky">
          Reseñas
        </p>
        <h2 className="titulo mt-2 flex items-center gap-2.5 text-[28px] text-aventurea-ink">
          <IconStar className="h-5 w-5" />
          {promedio !== null ? promedio.toFixed(2).replace(".", ",") : "—"}
          <span className="text-[16px] font-normal text-aventurea-ink-soft">
            · {total} reseña{total === 1 ? "" : "s"}
          </span>
        </h2>

        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {resenas.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5"
            >
              <div className="flex items-center gap-1" aria-label={`${r.calificacion} de 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <IconStar
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < r.calificacion ? "text-aventurea-ink" : "text-zinc-300"
                    }`}
                  />
                ))}
              </div>
              {r.comentario && (
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-aventurea-ink">
                  {r.comentario}
                </p>
              )}
              <p className="mt-2.5 text-[11.5px] text-zinc-500">
                {/* Los perfiles ajenos no son legibles (RLS) — pero toda
                    reseña viene de una reserva confirmada real. */}
                Cliente verificado ·{" "}
                {new Date(r.created_at).toLocaleDateString("es-CR", {
                  timeZone: "America/Costa_Rica",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * El cierre del portal: reseñas, ubicación y contacto en UNA sola
 * banda horizontal, sobre una foto de la galería del proveedor con
 * tarjetas de vidrio (blur hacia la imagen). Reemplaza a las tres
 * secciones apiladas que había antes — mismo contenido, un solo golpe
 * visual al final de la página.
 */
export function CierreSeccion({
  fotoFondo,
  nombre,
  resenas,
  promedio,
  total,
  ubicacion,
  googleMaps,
  waze,
  chatHref,
  instagram,
  facebook,
  tiktok,
  sitioWeb,
}: {
  /** Una foto de la galería del proveedor; null = fondo navy de marca. */
  fotoFondo: string | null;
  nombre: string;
  resenas: Resena[];
  promedio: number | null;
  total: number;
  ubicacion: string;
  googleMaps: string | null;
  waze: string | null;
  chatHref: string;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  sitioWeb: string | null;
}) {
  const ultimaResena = resenas[0] ?? null;
  const redes: { href: string; icono: React.ReactNode; label: string }[] = [
    { href: instagram, icono: <IconInstagram />, label: "Instagram" },
    { href: facebook, icono: <IconFacebook />, label: "Facebook" },
    { href: tiktok, icono: <IconTiktok />, label: "TikTok" },
    { href: sitioWeb, icono: <IconGlobe />, label: "Sitio web" },
  ].flatMap((r) => (r.href ? [{ ...r, href: r.href }] : []));

  const tarjetaCls =
    "flex flex-col rounded-2xl border border-white/15 bg-white/10 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl";
  const etiquetaCls =
    "text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60";
  const botonGlassCls =
    "inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-[12.5px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25";

  return (
    <section id="contacto" className="bento mx-3 mb-8 sm:mx-5 xl:mx-auto xl:max-w-[1280px]">
      {/* La foto de fondo con un velo navy: las tarjetas de vidrio
          necesitan contraste constante, venga la foto que venga. */}
      {fotoFondo && (
        <Image
          src={fotoFondo}
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div
        className={`absolute inset-0 ${
          fotoFondo
            ? "bg-gradient-to-b from-[#0f1d45]/80 via-[#101a2c]/60 to-[#0f1d45]/85"
            : "bg-gradient-to-b from-[#16295e] to-[#0f1d45]"
        }`}
      />

      <div data-reveal className="relative mx-auto max-w-[1080px] px-7 py-16">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-white/70 before:block before:h-[1.5px] before:w-5 before:bg-white/70">
          Conocé más
        </p>
        <h2 className="titulo mt-2 text-[28px] text-white">
          Reseñas, ubicación y contacto
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* ---------- Reseñas ---------- */}
          <div className={tarjetaCls}>
            <p className={etiquetaCls}>Reseñas</p>
            {total > 0 ? (
              <>
                <p className="mt-2.5 flex items-baseline gap-2 text-white">
                  <IconStar className="h-5 w-5 translate-y-0.5" />
                  <span className="text-[30px] font-bold leading-none">
                    {promedio !== null ? promedio.toFixed(2).replace(".", ",") : "—"}
                  </span>
                  <span className="text-[13.5px] text-white/70">
                    · {total} reseña{total === 1 ? "" : "s"}
                  </span>
                </p>
                {ultimaResena && (
                  <div className="mt-4 border-t border-white/15 pt-4">
                    <div
                      className="flex items-center gap-1"
                      aria-label={`${ultimaResena.calificacion} de 5`}
                    >
                      {Array.from({ length: 5 }, (_, i) => (
                        <IconStar
                          key={i}
                          className={`h-3 w-3 ${
                            i < ultimaResena.calificacion
                              ? "text-white"
                              : "text-white/25"
                          }`}
                        />
                      ))}
                    </div>
                    {ultimaResena.comentario && (
                      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-white/90">
                        “{ultimaResena.comentario}”
                      </p>
                    )}
                    <p className="mt-2 text-[11.5px] text-white/55">
                      Cliente verificado ·{" "}
                      {new Date(ultimaResena.created_at).toLocaleDateString("es-CR", {
                        timeZone: "America/Costa_Rica",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
                Todavía no hay reseñas. Todas vienen de reservas confirmadas
                reales — sé la primera persona en contarlo.
              </p>
            )}
          </div>

          {/* ---------- Ubicación ---------- */}
          <div className={tarjetaCls}>
            <p className={etiquetaCls}>Ubicación</p>
            {ubicacion ? (
              <p className="mt-3 flex items-start gap-2 text-[13.5px] leading-relaxed text-white/90">
                <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                {ubicacion}
              </p>
            ) : (
              <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
                Este proveedor se traslada a tu evento — el punto exacto se
                coordina al reservar.
              </p>
            )}
            {(googleMaps || waze) && (
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {googleMaps && (
                  <a
                    href={googleMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={botonGlassCls}
                  >
                    <IconPin className="h-4 w-4" />
                    Google Maps
                  </a>
                )}
                {waze && (
                  <a
                    href={waze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={botonGlassCls}
                  >
                    <IconWaze className="h-4 w-4" />
                    Waze
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ---------- Contacto ---------- */}
          <div className={tarjetaCls}>
            <p className={etiquetaCls}>Contacto</p>
            <p className="mt-2.5 text-[17px] font-bold text-white">
              Hablá con {nombre}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/70">
              La conversación queda guardada en Bookea, con tu pedido y tus
              acuerdos a la vista.
            </p>
            <div className="mt-auto flex flex-col gap-3 pt-4">
              <a
                href={chatHref}
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-[13.5px] font-bold text-aventurea-navy transition-colors hover:bg-white/90"
              >
                Preguntar por el chat
              </a>
              {redes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {redes.map((r) => (
                    <a
                      key={r.label}
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={r.label}
                      title={r.label}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25 [&_svg]:h-4 [&_svg]:w-4"
                    >
                      {r.icono}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "A dónde vas": mapa incrustado (sin API key) + botones de cómo llegar. */
export function MapaSeccion({
  nombre,
  ubicacion,
  latitud,
  longitud,
  googleMaps,
  waze,
}: {
  nombre: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  googleMaps: string | null;
  waze: string | null;
}) {
  const tieneCoordenadas = latitud !== null && longitud !== null;
  if (!tieneCoordenadas && !googleMaps) return null;

  return (
    <section className="border-t border-aventurea-line py-14">
      <div data-reveal className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-sky">
          Ubicación
        </p>
        <h2 className="titulo mt-2 text-[28px] text-aventurea-ink">A dónde vas</h2>
        {ubicacion && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px] text-aventurea-ink-soft">
            <IconPin className="h-3.5 w-3.5 shrink-0" />
            {ubicacion}
          </p>
        )}

        {tieneCoordenadas && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-aventurea-line">
            <iframe
              title={`Mapa de ${nombre}`}
              src={`https://www.google.com/maps?q=${latitud},${longitud}&z=15&output=embed`}
              className="h-[340px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          {googleMaps && (
            <a
              href={googleMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              <IconPin className="h-4 w-4" />
              Cómo llegar (Google Maps)
            </a>
          )}
          {waze && (
            <a
              href={waze}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy"
            >
              <IconWaze className="h-4 w-4" />
              Abrir en Waze
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/** Redes y ubicación del negocio (el chat vive en la tarjeta de
 * Contacto de CierreSeccion — acá no se repite el botón). */
export function ContactoSeccion({
  nombre,
  instagram,
  facebook,
  tiktok,
  sitioWeb,
  ubicacion,
  googleMaps,
  waze,
}: {
  nombre: string;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  sitioWeb: string | null;
  ubicacion: string;
  googleMaps: string | null;
  waze: string | null;
}) {
  const redes: { href: string; icono: React.ReactNode; label: string }[] = [
    { href: instagram, icono: <IconInstagram />, label: "Instagram" },
    { href: facebook, icono: <IconFacebook />, label: "Facebook" },
    { href: tiktok, icono: <IconTiktok />, label: "TikTok" },
    { href: sitioWeb, icono: <IconGlobe />, label: "Sitio web" },
  ].flatMap((r) => (r.href ? [{ ...r, href: r.href }] : []));

  return (
    <section
      id="contacto"
      className="border-t border-aventurea-line bg-aventurea-surface py-14"
    >
      <div data-reveal className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-sky">
          Contacto
        </p>
        <h2 className="titulo mt-2 text-[28px] text-aventurea-ink">
          Hablá con {nombre}
        </h2>

        {ubicacion && (
          <p className="mt-3 flex items-start gap-2 text-[13.5px] text-aventurea-ink-soft">
            <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-aventurea-orange" />
            {ubicacion}
          </p>
        )}

        {(googleMaps || waze) && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {googleMaps && (
              <a
                href={googleMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
              >
                <IconPin className="h-4 w-4" />
                Cómo llegar (Google Maps)
              </a>
            )}
            {waze && (
              <a
                href={waze}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange"
              >
                <IconWaze className="h-4 w-4" />
                Abrir en Waze
              </a>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {/* El chat vive en la tarjeta de Contacto de al lado — acá
              solo quedan las redes, sin repetir el botón. */}
          {redes.map((r) => (
            <a
              key={r.label}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange [&_svg]:h-4 [&_svg]:w-4"
            >
              {r.icono}
              {r.label}
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}
