import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import CatalogoTratamientos from "./catalogo-tratamientos";
import CarruselTiposDeTarjeta from "./carrusel-tipos-tarjeta";

/**
 * DEMO · LAVACAR — versión "landing profesional", pedida explícitamente
 * distinta de la plantilla genérica de `/lealtad/demo/[tipo]` (que
 * sigue sirviendo a las otras seis categorías sin cambios).
 *
 * Ruta ESTÁTICA que le gana a la dinámica hermana `[tipo]` para este
 * slug exacto — el mismo mecanismo que ya usa `demo/js-detailing`
 * (Next.js resuelve una carpeta estática antes que la dinámica), así
 * que `programa_lealtad['lavacars']` en `demo/[tipo]/page.tsx` queda
 * sin usar para RENDERIZAR (nunca se llega a esa rama) pero se
 * mantiene para que el carrusel "Mirá otro tipo de negocio" de las
 * otras categorías lo siga listando — apunta acá.
 *
 * Estética calcada de `demo/js-detailing/page.tsx` a propósito: negro
 * puro, tipografía apretada en mayúsculas, casi nada de radios
 * redondeados — es la referencia de "profesional" que pidió el dueño.
 * La diferencia con esa página: acá SÍ hay foto de fondo en el hero
 * (ahí no, porque compite con el mockup del pase) y dos secciones
 * nuevas que esa página no necesita (un negocio puntual no necesita
 * "elegí tu tratamiento" ni "mirá las otras formas de tarjeta").
 */

const NEGRO = "#050505";
const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";
const ACENTO = "var(--orange)";

export const metadata: Metadata = {
  title: "Demo · Lavacar · Lealtad Bookea",
};

const PASOS: [string, string, string] = [
  "El cliente escanea el QR de la caseta mientras espera su carro.",
  "Cada lavado suma su sello — sin tarjetitas mojadas en la guantera.",
  "El lavado gratis decide a dónde vuelve el próximo sábado.",
];

const TAMBIEN = [
  {
    titulo: "Gift cards digitales",
    texto:
      "Tu cliente compra una tarjeta de regalo y le llega al Wallet a quien la recibe, lista para usarse.",
  },
  {
    titulo: "Paquetes prepagados",
    texto: "«5 lavados», «10 tratamientos»: cobrás por adelantado y el pase descuenta solo.",
  },
  {
    titulo: "Cupones con vencimiento",
    texto: "«Hace 30 días no venís, tenés 15% off» — con fecha límite, no perdido en un chat.",
  },
];

export default function DemoLavacarsPage() {
  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NEGRO }}>
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad" className="text-[12.5px] font-bold text-white/45 hover:text-white">
            ← Volver
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">
            Bookea
          </span>
        </header>

        {/* ══════════════ HERO, con foto de fondo ══════════════ */}
        <div className="relative mt-8 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/lealtad/plantillas/franjas/lavacar-4.jpg"
              alt=""
              fill
              priority
              sizes="(min-width: 980px) 980px, 100vw"
              className="object-cover"
              style={{ objectPosition: "60% 35%" }}
            />
            {/* Degradado de izquierda a derecha: el texto vive a la
                izquierda sobre negro casi sólido, y la foto se deja ver
                entera del lado derecho — no un velo parejo que apaga la
                imagen que se pidió explícitamente de fondo. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(100deg, rgba(5,5,5,.97) 0%, rgba(5,5,5,.88) 32%, rgba(5,5,5,.5) 58%, rgba(5,5,5,.12) 82%, rgba(5,5,5,0) 100%)",
              }}
            />
          </div>

          <div className="relative px-6 py-12 sm:px-10 sm:py-16">
            <span
              className="inline-block border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ borderColor: "rgba(157,180,255,.45)", color: ACCION }}
            >
              Demo · Lavacar
            </span>
            <h1 className="mt-5 max-w-[16ch] text-[clamp(30px,5.5vw,52px)] font-extrabold uppercase leading-[0.98] tracking-tight text-white">
              Un lavado no se olvida.
              <br />
              <span style={{ color: ACCION }}>Una tarjeta, sí.</span>
            </h1>
            <p className="mt-4 max-w-[46ch] text-[14.5px] leading-relaxed text-white/65">
              <strong className="text-white">Lavacar El Rayo</strong> no existe — es el ejemplo. Tu
              tarjeta llevaría tu nombre, tus colores y tu regalía.
            </p>

            <div className="mt-7 grid max-w-[420px] gap-2.5">
              <div className="border border-white/15 px-4 py-3" style={{ background: "rgba(5,5,5,.4)" }}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/45">La regla</p>
                <p className="mt-0.5 text-[13.5px] font-bold text-white">1 sello por lavado completo</p>
              </div>
              <div className="border border-white/15 px-4 py-3" style={{ background: "rgba(5,5,5,.4)" }}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/45">La regalía</p>
                <p className="mt-0.5 text-[13.5px] font-bold text-white">El sexto lavado va gratis</p>
              </div>
            </div>

            <ol className="mt-7 grid max-w-[46ch] gap-3">
              {PASOS.map((p, i) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-white/75">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-extrabold"
                    style={{ background: ACENTO, color: "#0a1226" }}
                  >
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/lealtad/nuevo"
                className="px-6 py-3 text-[14px] font-bold uppercase tracking-wide transition-transform hover:scale-[1.02]"
                style={{ background: ACCION, color: ACCION_TINTA }}
              >
                Quiero esto en mi negocio
              </Link>
              <Link
                href="/lealtad/planes"
                className="border border-white/25 px-6 py-3 text-[14px] font-bold uppercase tracking-wide text-white/80 hover:border-white/60"
              >
                Ver los paquetes
              </Link>
            </div>
          </div>
        </div>

        {/* ══════════════ CATÁLOGO EN PESTAÑAS ══════════════ */}
        <div className="mt-16 border-t border-white/10 pt-10">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Nuestros tratamientos
          </p>
          <h2 className="mt-2 text-center text-[clamp(22px,3.2vw,30px)] font-extrabold uppercase leading-tight tracking-tight text-white">
            Elegí, y la tarjeta hace el resto
          </h2>
          <div className="mt-8">
            <CatalogoTratamientos />
          </div>
        </div>

        {/* ══════════════ CARRUSEL DE TIPOS DE TARJETA ══════════════ */}
        <div className="mt-16 border-t border-white/10 pt-10">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            La misma tarjeta, a tu manera
          </p>
          <h2 className="mt-2 text-center text-[clamp(22px,3.2vw,30px)] font-extrabold uppercase leading-tight tracking-tight text-white">
            Sellos, descuento, puntos o cashback
          </h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-center text-[13.5px] leading-relaxed text-white/55">
            Vos elegís cómo premia a tus clientes — deslizá para ver las cuatro formas que puede
            tener la tarjeta de Lavacar El Rayo.
          </p>
          <div className="mt-8">
            <CarruselTiposDeTarjeta />
          </div>
        </div>

        {/* ── Lo que además cabe en la misma tarjeta ── */}
        <div className="mt-16 border-t border-white/10 pt-8">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Y en la misma tarjeta también podés dar
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {TAMBIEN.map((t) => (
              <div key={t.titulo} className="border border-white/12 p-4" style={{ background: "rgba(255,255,255,.04)" }}>
                <p className="text-[13.5px] font-extrabold text-white">{t.titulo}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{t.texto}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 pt-6 text-center">
          <p className="text-[11px] text-white/30">
            Esta tarjeta todavía no existe — es la vista previa de cómo quedaría. Se activa cuando
            vos la pedís.
          </p>
        </div>
      </div>
    </main>
  );
}
