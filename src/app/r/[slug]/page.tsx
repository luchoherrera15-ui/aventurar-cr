import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { datosDePaginaPublica, mesaDeBusqueda } from "./datos";

/**
 * /r/<slug> — LA PORTADA DEL NEGOCIO (0229): lo que abre el QR de la
 * mesa. La marca del RESTAURANTE manda (colores y logo de su tarjeta);
 * Bookea aparece una sola vez, en la última línea.
 *
 * El orden de los tiles es una decisión de producto: el MENÚ va
 * primero (quien escanea en la mesa tiene hambre) y la tarjeta de
 * lealtad segunda — convierte mejor como «ya que estás» que como
 * portada.
 *
 * `?mesa=N` es la PREVISTA de pedidos: hoy solo se muestra y se
 * propaga al menú, pero viaja en el link desde el día uno para que
 * activar pedidos no obligue a reimprimir ni un QR (la lección de
 * /tarjeta: el papel es inmutable).
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await datosDePaginaPublica(slug);
  if (!datos) return { title: "Página no encontrada" };
  return {
    title: datos.negocio.nombre,
    description:
      datos.pagina.bajada ||
      `Menú, tarjeta de lealtad e información de ${datos.negocio.nombre}.`,
  };
}

export default async function PaginaPublicaNegocio({ params, searchParams }: Props) {
  const { slug } = await params;
  const busqueda = await searchParams;
  const datos = await datosDePaginaPublica(slug);
  if (!datos) notFound();

  const { negocio, pagina, marca, tarjetaActiva, meta, seccionesMenu } = datos;
  const mesa = mesaDeBusqueda(busqueda.mesa);
  const sufijoMesa = mesa ? `?mesa=${mesa}` : "";

  // El dueño eligió que su QR caiga directo en el menú: la portada
  // redirige (el link impreso no cambia — cambia a dónde aterriza).
  // `?portada=1` es el bypass del «←» del menú: sin él, volver a la
  // portada rebotaba al menú en bucle y la tarjeta de lealtad, la promo
  // y el contacto quedaban inalcanzables para todo el mundo.
  const pidePortada = busqueda.portada === "1";
  if (
    !pidePortada &&
    pagina.qr_destino === "menu" &&
    pagina.mostrar_menu &&
    seccionesMenu.length > 0
  ) {
    redirect(`/r/${negocio.slug}/menu${sufijoMesa}`);
  }

  const hayMenu = pagina.mostrar_menu && seccionesMenu.length > 0;
  const inicial = (negocio.nombre.trim().charAt(0) || "•").toUpperCase();
  const direccion = [negocio.direccionExacta, negocio.provincia].filter(Boolean).join(", ");
  const linkMaps = direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`
    : null;
  const linkWhatsapp = negocio.whatsapp
    ? `https://wa.me/506${negocio.whatsapp.replace(/\D/g, "").slice(-8)}`
    : null;

  const tile =
    "flex items-center gap-4 rounded-2xl border p-4 transition-opacity hover:opacity-90";

  return (
    <main
      className="min-h-svh px-5 pb-10 pt-6"
      style={{ background: marca.colorFondo, color: marca.tinta }}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5">
        {/* ── El hero: la marca del negocio ─────────────────────── */}
        <header className="relative overflow-hidden rounded-3xl border" style={{ borderColor: marca.borde }}>
          {(pagina.foto_portada_url || marca.bannerUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pagina.foto_portada_url ?? marca.bannerUrl ?? ""}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
          )}
          {/* Velo para que el nombre se lea sobre cualquier foto. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 20%, ${marca.colorFondo} 96%)`,
            }}
          />
          <div className="relative flex min-h-[168px] flex-col justify-end gap-3 p-5">
            {mesa && (
              <span
                className="absolute right-4 top-4 rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ background: marca.superficie, border: `1px solid ${marca.borde}` }}
              >
                Mesa {mesa}
              </span>
            )}
            <div className="flex items-center gap-3.5">
              {marca.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={marca.logoUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px] font-extrabold"
                  style={{ background: marca.colorSello, color: marca.tintaSobreSello }}
                >
                  {inicial}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">
                  {negocio.nombre}
                </h1>
                {pagina.bajada && (
                  <p className="mt-0.5 text-[13px]" style={{ color: marca.suave }}>
                    {pagina.bajada}
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
              href={`/r/${negocio.slug}/menu${sufijoMesa}`}
              className={tile}
              style={{
                background: marca.superficie,
                borderColor: marca.colorSello,
              }}
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]"
                style={{ background: marca.colorSello }}
              >
                🍽
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold leading-tight">Ver el menú</span>
                <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: marca.suave }}>
                  {seccionesMenu.slice(0, 3).join(" · ")} — con precios
                </span>
              </span>
              <span aria-hidden style={{ color: marca.suave }}>
                ›
              </span>
            </Link>
          )}

          {tarjetaActiva && (
            <Link
              href={`/tarjeta/${negocio.slug}`}
              className={tile}
              style={{ background: marca.superficie, borderColor: marca.borde }}
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]"
                style={{ background: marca.superficie, border: `1px solid ${marca.borde}` }}
              >
                ⭐
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold leading-tight">
                  Tarjeta de lealtad
                </span>
                <span className="mt-0.5 block text-[12.5px]" style={{ color: marca.suave }}>
                  {meta && meta.costo > 0
                    ? `Al llegar a ${meta.costo}: ${meta.nombre}`
                    : "Sumá con cada visita, desde tu teléfono"}
                </span>
              </span>
              <span aria-hidden style={{ color: marca.suave }}>
                ›
              </span>
            </Link>
          )}

          {pagina.promo_activa && pagina.promo_titulo && (
            <div className={tile} style={{ background: marca.superficie, borderColor: marca.borde }}>
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]"
                style={{ background: marca.superficie, border: `1px solid ${marca.borde}` }}
              >
                🔥
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold leading-tight">
                  {pagina.promo_titulo}
                </span>
                {pagina.promo_detalle && (
                  <span className="mt-0.5 block text-[12.5px]" style={{ color: marca.suave }}>
                    {pagina.promo_detalle}
                  </span>
                )}
              </span>
            </div>
          )}
        </nav>

        {/* ── Ubicación y contacto ──────────────────────────────── */}
        {(direccion || linkWhatsapp) && (
          <section
            className="rounded-2xl border p-4"
            style={{ background: marca.superficie, borderColor: marca.borde }}
          >
            <h2 className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: marca.suave }}>
              Dónde estamos
            </h2>
            {direccion && <p className="mt-1.5 text-[13.5px] leading-snug">{direccion}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {linkMaps && (
                <a
                  href={linkMaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl px-3.5 py-2 text-[13px] font-bold"
                  style={{ background: marca.colorSello, color: marca.tintaSobreSello }}
                >
                  Cómo llegar
                </a>
              )}
              {linkWhatsapp && (
                <a
                  href={linkWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border px-3.5 py-2 text-[13px] font-bold"
                  style={{ borderColor: marca.borde }}
                >
                  WhatsApp
                </a>
              )}
            </div>
          </section>
        )}

        {/* La única línea de Bookea en toda la página. */}
        <footer className="pb-2 text-center text-[11px]" style={{ color: marca.suave }}>
          <a href="https://www.bookea.lat/lealtad" className="hover:underline">
            Hecho con Bookea
          </a>
        </footer>
      </div>
    </main>
  );
}
