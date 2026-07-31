import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

/**
 * El andamiaje de las páginas legales (privacidad, términos,
 * políticas): columna angosta, mismo header y mismo pie. Las tres
 * tenían —o iban a tener— el mismo markup copiado; acá vive una sola
 * vez junto con los H2/P que usan para el cuerpo.
 */
export default function PaginaLegal({
  breadcrumb,
  titulo,
  intro,
  actualizado,
  children,
}: {
  /** Lo que va después de la barra en el header. */
  breadcrumb: string;
  titulo: string;
  /** El párrafo de entrada, antes del primer apartado. */
  intro: React.ReactNode;
  /** "julio de 2026" — se muestra al pie del documento. */
  actualizado: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-svh bg-aventurea-cream">
      <SiteHeader breadcrumb={breadcrumb} ancho="max-w-[860px]" />
      <article className="mx-auto max-w-[860px] px-5 pb-16 pt-10 sm:px-7">
        <p className="text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
          Bookea · Costa Rica
        </p>
        <h1 className="mt-2 text-[clamp(26px,4vw,34px)] font-black tracking-[-1px] text-aventurea-ink">
          {titulo}
        </h1>
        <P>{intro}</P>

        {children}

        <p className="mt-10 text-[12.5px] text-zinc-400">
          Última actualización: {actualizado}.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}

/** Un apartado del documento. */
export const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-9 text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">
    {children}
  </h2>
);

/** Un párrafo del cuerpo. */
export const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
    {children}
  </p>
);

/** Una lista de puntos — para las enumeraciones largas de los términos,
 *  que en párrafo corrido no hay quien las lea. */
export const Lista = ({ children }: { children: React.ReactNode }) => (
  <ul className="mt-3 grid gap-2 pl-1">{children}</ul>
);

/** Un punto de la lista, con su viñeta naranja. */
export const Punto = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2.5 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
    <span
      aria-hidden
      className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-aventurea-orange"
    />
    <span>{children}</span>
  </li>
);

/** El destacado de los apartados que más protegen a Bookea: se ve
 *  distinto para que nadie pueda decir que estaba escondido. */
export const Destacado = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 rounded-2xl border border-aventurea-orange/25 bg-aventurea-orange/5 px-5 py-4 text-[14px] font-semibold leading-relaxed text-aventurea-ink">
    {children}
  </p>
);
