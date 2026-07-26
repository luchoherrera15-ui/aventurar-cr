import {
  IconCheck,
  IconFacebook,
  IconGlobe,
  IconInstagram,
  IconPin,
  IconTiktok,
  IconWaze,
  IconWhatsapp,
} from "@/components/icons";
import {
  CAMPOS_POR_CATEGORIA,
  formatearValor,
} from "@/app/mi-rancho/campos-servicio";
import {
  AMENIDADES_GRUPOS,
  CATEGORIA_GRADIENTE,
  FOTOS_DESTACADAS,
  type Categoria,
} from "@/app/mi-rancho/types";

/**
 * La "división" grande del portal: una de las fotos del negocio a pantalla
 * completa, oscurecida, con el texto de presentación encima.
 */
export function PresentacionSeccion({
  foto,
  categoria,
  eyebrow,
  titulo,
  texto,
  datos,
}: {
  foto: string | null;
  categoria: Categoria;
  eyebrow: string;
  titulo: string;
  texto: string | null;
  datos: { icono: React.ReactNode; titulo: string; detalle: string }[];
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={
          foto
            ? { backgroundImage: `url(${foto})` }
            : { backgroundImage: CATEGORIA_GRADIENTE[categoria] }
        }
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/80" />

      <div className="relative mx-auto max-w-[900px] px-7 py-16 text-center sm:py-20">
        <span className="inline-flex items-center gap-3 text-[11px] font-light uppercase tracking-[0.28em] text-white/60 before:block before:h-px before:w-8 before:bg-white/40 after:block after:h-px after:w-8 after:bg-white/40">
          {eyebrow}
        </span>
        <h2 className="mt-4 text-balance text-[30px] font-bold leading-tight text-white sm:text-[40px]">
          {titulo}
        </h2>
        {texto && (
          <p className="mx-auto mt-5 max-w-[62ch] whitespace-pre-line text-[14.5px] leading-relaxed text-white/75">
            {texto}
          </p>
        )}

        {datos.length > 0 && (
          <div className="mt-10 grid grid-cols-1 gap-7 sm:grid-cols-3">
            {datos.map((d) => (
              <div key={d.titulo} className="flex flex-col items-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white/85 [&_svg]:h-5 [&_svg]:w-5">
                  {d.icono}
                </span>
                <h3 className="mt-3 text-[15px] font-bold text-white">
                  {d.titulo}
                </h3>
                <p className="mt-0.5 text-[12.5px] text-white/60">{d.detalle}</p>
              </div>
            ))}
          </div>
        )}
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

  if (grupos.length === 0) return null;

  return (
    <section className="py-14">
      <div className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
          Lo que incluye
        </p>
        <h2 className="mt-2 text-[26px] font-bold text-aventurea-ink">
          Amenidades del lugar
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((g) => (
            <div key={g.titulo}>
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
        <h2 className="mt-2 text-[26px] font-bold text-aventurea-ink">
          Detalles y cobertura
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((g) => (
            <div key={g.titulo}>
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

/** Galería: las primeras fotos grandes y el resto en tira de miniaturas. */
export function GaleriaSeccion({
  fotos,
  nombre,
}: {
  fotos: string[];
  nombre: string;
}) {
  if (fotos.length === 0) return null;

  const destacadas = fotos.slice(0, FOTOS_DESTACADAS);
  const resto = fotos.slice(FOTOS_DESTACADAS);

  return (
    <section className="border-t border-aventurea-line py-14">
      <div className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
          Galería
        </p>
        <h2 className="mt-2 text-[26px] font-bold text-aventurea-ink">
          Conocé el espacio
        </h2>

        <div
          className={`mt-7 grid gap-3 ${
            destacadas.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
          }`}
        >
          {destacadas.map((url, i) => (
            <div
              key={url}
              className={`overflow-hidden rounded-2xl bg-aventurea-cream-2 ${
                destacadas.length === 1 ? "aspect-[16/9]" : "aspect-[4/3]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${nombre} — foto ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>

        {resto.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {resto.map((url, i) => (
              <div
                key={url}
                className="aspect-[4/3] overflow-hidden rounded-xl bg-aventurea-cream-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${nombre} — foto ${FOTOS_DESTACADAS + i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Contacto directo, redes sociales y ubicación. */
export function ContactoSeccion({
  nombre,
  whatsappHref,
  instagram,
  facebook,
  tiktok,
  sitioWeb,
  ubicacion,
  googleMaps,
  waze,
}: {
  nombre: string;
  whatsappHref: string | null;
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
      <div className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
          Contacto
        </p>
        <h2 className="mt-2 text-[26px] font-bold text-aventurea-ink">
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
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
            >
              <IconWhatsapp className="h-4 w-4" />
              Escribir por WhatsApp
            </a>
          )}
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

        {!whatsappHref && redes.length === 0 && (
          <p className="mt-4 text-[13px] text-zinc-500">
            Este negocio todavía no dejó un contacto público.
          </p>
        )}
      </div>
    </section>
  );
}
