import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaPublica, mesaDeBusqueda } from "@/lib/solutions/datos";
import { ICONO_LINK } from "@/lib/solutions/tipos";

/**
 * /s/<slug> — LA PÁGINA PÚBLICA DE UN NEGOCIO DE SOLUTIONS (el linktree).
 *
 * Vestida con la marca del negocio (sus dos colores, su logo, su
 * portada) y con sus puertas en el orden que él decidió. Minimalista a
 * propósito: una columna, tiles iguales, nada de Bookea salvo el pie.
 *
 * `?mesa=N` viene del QR de la mesa y se propaga al menú: es lo que
 * hace que la comanda sepa de dónde salió sin reimprimir nada.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await paginaPublica(slug);
  if (!datos) return { title: "Página no encontrada" };
  return {
    title: datos.negocio.nombre,
    description: datos.negocio.bajada || `${datos.negocio.nombre} en Bookea.`,
    openGraph: datos.negocio.foto_portada_url ? { images: [datos.negocio.foto_portada_url] } : undefined,
  };
}

export default async function PaginaSolutions({ params, searchParams }: Props) {
  const { slug } = await params;
  const busqueda = await searchParams;
  const datos = await paginaPublica(slug);
  if (!datos) notFound();

  const { negocio, links, menu, paleta } = datos;
  const mesa = mesaDeBusqueda(busqueda.mesa, negocio.mesas);
  const sufijoMesa = mesa ? `?mesa=${mesa}` : "";
  const hayMenu = negocio.mostrar_menu && menu.length > 0;
  const inicial = (negocio.nombre.trim().charAt(0) || "•").toUpperCase();
  const linkWhatsapp = negocio.whatsapp ? `https://wa.me/${negocio.whatsapp.length === 8 ? "506" : ""}${negocio.whatsapp}` : null;
  const linkMapa = negocio.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.direccion)}`
    : null;

  const tile =
    "flex min-h-[64px] items-center gap-4 rounded-2xl border p-4 transition-opacity hover:opacity-90";

  return (
    <main className="min-h-svh px-5 pb-10 pt-6" style={{ background: paleta.fondo, color: paleta.tinta }}>
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5">
        {/* ── Cabecera con la marca ─────────────────────────────── */}
        <header className="relative overflow-hidden rounded-3xl border" style={{ borderColor: paleta.borde }}>
          {negocio.foto_portada_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={negocio.foto_portada_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, transparent 20%, ${paleta.fondo} 96%)` }}
          />
          <div className="relative flex min-h-[176px] flex-col justify-end gap-3 p-5">
            {mesa && (
              <span
                className="absolute right-4 top-4 rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ background: paleta.superficie, border: `1px solid ${paleta.borde}` }}
              >
                Mesa {mesa}
              </span>
            )}
            <div className="flex items-center gap-3.5">
              {negocio.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={negocio.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
              ) : (
                <span
                  aria-hidden
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px] font-extrabold"
                  style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
                >
                  {inicial}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{negocio.nombre}</h1>
                {negocio.bajada && (
                  <p className="mt-0.5 text-[13px]" style={{ color: paleta.suave }}>
                    {negocio.bajada}
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Las puertas ───────────────────────────────────────── */}
        <nav aria-label={`Secciones de ${negocio.nombre}`} className="flex flex-col gap-3">
          {hayMenu && (
            <Link
              href={`/s/${negocio.slug}/menu${sufijoMesa}`}
              className={tile}
              style={{ background: paleta.superficie, borderColor: paleta.acento }}
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]"
                style={{ background: paleta.acento }}
              >
                🍽
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold leading-tight">
                  {negocio.acepta_pedidos && mesa ? "Ver el menú y pedir" : "Ver el menú"}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: paleta.suave }}>
                  {menu
                    .slice(0, 3)
                    .map((g) => g.seccion?.nombre ?? "Otros")
                    .join(" · ")}
                </span>
              </span>
              <span aria-hidden style={{ color: paleta.suave }}>›</span>
            </Link>
          )}

          {links.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={tile}
              style={{ background: paleta.superficie, borderColor: paleta.borde }}
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]"
                style={{ background: paleta.superficie, border: `1px solid ${paleta.borde}` }}
              >
                {ICONO_LINK[l.icono]?.glifo ?? "🔗"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-extrabold leading-tight">{l.etiqueta}</span>
              </span>
              <span aria-hidden style={{ color: paleta.suave }}>›</span>
            </a>
          ))}
        </nav>

        {/* ── Contacto ──────────────────────────────────────────── */}
        {(linkWhatsapp || linkMapa) && (
          <section className="flex flex-col gap-2 text-[13px]" style={{ color: paleta.suave }}>
            {linkMapa && (
              <a href={linkMapa} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                📍 {negocio.direccion}
              </a>
            )}
            {linkWhatsapp && (
              <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                💬 Escribinos por WhatsApp
              </a>
            )}
          </section>
        )}

        <footer className="mt-2 text-center text-[11px]" style={{ color: paleta.suave }}>
          Hecho con <Link href="/solutions" className="font-bold underline-offset-2 hover:underline">Bookea</Link>
        </footer>
      </div>
    </main>
  );
}
