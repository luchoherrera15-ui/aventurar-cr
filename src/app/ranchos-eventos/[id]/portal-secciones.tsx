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
} from "@/app/mi-rancho/campos-servicio";
import {
  AMENIDADES,
  AMENIDADES_GRUPOS,
  CATEGORIA_GRADIENTE,
  CATEGORIA_ICONO,
  type Categoria,
} from "@/app/mi-rancho/types";
import GaleriaHeroFotos from "@/components/galeria-hero";

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
        <p className="flex items-center justify-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-5 before:bg-aventurea-navy after:block after:h-[1.5px] after:w-5 after:bg-aventurea-navy">
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
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aventurea-orange/10 text-aventurea-orange [&_svg]:h-5 [&_svg]:w-5">
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
export function AmenidadesSeccion({ amenidades }: { amenidades: string[] }) {
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

  return (
    <section className="py-14">
      <div className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
          Lo que incluye
        </p>
        <h2 className="titulo mt-2 text-[28px] text-aventurea-ink">
          Amenidades del lugar
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
              <ul className="flex flex-col gap-2">
                {g.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-2.5 text-[13.5px] text-aventurea-ink"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aventurea-green/15 text-aventurea-green">
                      <IconCheck className="h-3 w-3" />
                    </span>
                    {i.label}
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
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
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
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-5 before:bg-aventurea-navy">
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
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-5 before:bg-aventurea-navy">
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

/** Contacto: el chat de la plataforma primero, redes y ubicación después. */
export function ContactoSeccion({
  nombre,
  chatHref,
  instagram,
  facebook,
  tiktok,
  sitioWeb,
  ubicacion,
  googleMaps,
  waze,
}: {
  nombre: string;
  /** Ruta que abre (o retoma) el hilo de consulta con este negocio. */
  chatHref: string;
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
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
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
                className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
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
                className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange"
              >
                <IconWaze className="h-4 w-4" />
                Abrir en Waze
              </a>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {/* Todo pasa por el chat de la plataforma: la conversación
              queda guardada, con notificaciones en la bandeja, y no se
              pierde en un WhatsApp externo. */}
          <a
            href={chatHref}
            className="inline-flex items-center gap-2 rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Preguntar por el chat
          </a>
          {redes.map((r) => (
            <a
              key={r.label}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange [&_svg]:h-4 [&_svg]:w-4"
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
