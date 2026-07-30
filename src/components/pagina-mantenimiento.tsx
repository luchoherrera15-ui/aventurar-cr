import Link from "next/link";
import SiteHeader from "./site-header";

/**
 * Página "en mantenimiento" para una sección de Bookea que todavía no
 * tiene directorio propio (Citas, Booking...) — mismo tono que la
 * puerta "Muy pronto" de la portada, pero como página completa para
 * que la ruta ya exista y se pueda linkear/indexar sin dar 404.
 */
export default function PaginaMantenimiento({
  breadcrumb,
  icono,
  titulo,
  descripcion,
  categorias,
}: {
  breadcrumb: string;
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  categorias: string[];
}) {
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb={breadcrumb} />

      <section className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-aventurea-line bg-aventurea-surface text-aventurea-orange shadow-sm [&_svg]:h-8 [&_svg]:w-8">
          {icono}
        </span>

        <span className="mt-5 rounded-full bg-aventurea-orange/10 px-3.5 py-1.5 text-[11.5px] font-extrabold uppercase tracking-wide text-aventurea-orange">
          En mantenimiento
        </span>

        <h1 className="mt-4 text-[clamp(26px,4vw,36px)] font-black tracking-[-0.5px] text-aventurea-ink">
          {titulo}
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
          {descripcion}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {categorias.map((c) => (
            <span
              key={c}
              className="rounded-full border border-aventurea-line bg-aventurea-surface px-3 py-1 text-[12px] font-bold text-aventurea-ink-soft"
            >
              {c}
            </span>
          ))}
        </div>

        <Link
          href="/eventos"
          className="mt-9 rounded-full bg-aventurea-navy px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-navy-2"
        >
          Mientras tanto, mirá el directorio de eventos
        </Link>
      </section>
    </div>
  );
}
