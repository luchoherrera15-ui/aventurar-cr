import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PasesSlider from "./pases-slider";

/**
 * DEMO · LAVACAR — landing profesional armada sobre el mockup que trajo
 * el dueño (`puramatcha/lavacar.html`, HTML+CSS suelto, sin React ni
 * Tailwind). Esta versión reemplaza por completo el primer intento de
 * esta página (que calcaba `demo/js-detailing` en cambio): "tomemos
 * ESE diseño, basémonos en eso" fue explícito.
 *
 * Ruta ESTÁTICA que le gana a la dinámica hermana `[tipo]` para este
 * slug exacto — mismo mecanismo que ya usa `demo/js-detailing` (Next.js
 * resuelve una carpeta estática antes que la dinámica). Verificado en
 * runtime, no solo en el build: `programa_lealtad['lavacars']` de
 * `demo/[tipo]/page.tsx` queda sin usar para RENDERIZAR, pero se
 * mantiene para que el carrusel "Mirá otro tipo de negocio" de las
 * otras categorías lo siga listando — apunta acá.
 *
 * ------------------------------------------------------------------
 * LO QUE CAMBIÓ RESPECTO AL HTML ORIGINAL, Y POR QUÉ
 * ------------------------------------------------------------------
 * 1. TIPOGRAFÍA: el mockup importaba Inter + Space Grotesk por
 *    @import. Todo /lealtad ya carga Montserrat como su propia
 *    familia (ver `app/lealtad/layout.tsx` — reemplaza a Figtree A
 *    PROPÓSITO para este módulo). Sumar una tercera familia solo para
 *    esta página fragmentaría el sistema tipográfico sin necesidad:
 *    se tradujo la ESCALA (tamaños, pesos, tracking, line-height) a
 *    Montserrat, no la familia.
 *
 * 2. LAS 5 FOTOS DE UNSPLASH DEL MOCKUP: las cinco mostraban un logo o
 *    nombre de marca de auto bien legible al abrirlas (Mercedes-AMG en
 *    el hero, baldes "Meguiar's" en el Porsche, "RANGE ROVER" escrito
 *    en el capó, el rodete de BMW) — inaceptable por la misma regla que
 *    ya se aplicó a las franjas de Lavacar/Courier. Se reemplazaron por
 *    fotos YA verificadas y autohosteadas del banco de franjas
 *    (`lavacar-1/2/4.jpg`), sin logo de terceros.
 *
 * 3. EL SLIDER DE LA DERECHA: pedido explícito del dueño — en vez de
 *    las 3 ofertas de servicio del mockup, muestra la MISMA tarjeta de
 *    Lavacar El Rayo en sus 4 formas (sellos/descuento/puntos/cashback,
 *    `pases-slider.tsx`). El mockup apilaba sus tarjetas en flujo
 *    normal con la inactiva atenuada; con un pase completo (más alto
 *    que esas tarjetas de oferta) eso no entra en el alto del hero, así
 *    que quedó como carrusel de una sola tarjeta visible a la vez.
 *
 * 4. LOS BOTONES "Ver beneficios"/"Comprar paquete" y "Ver
 *    paquete"/"Comprar"/"Reservar" de las tarjetas de producto: esto es
 *    un negocio que NO EXISTE (Lavacar El Rayo es el ejemplo, como en
 *    el resto de /lealtad/demo) — no hay un carrito real detrás. Los
 *    botones quedaron con el mismo tono llamativo del mockup pero
 *    apuntando a las dos acciones reales de esta pantalla: armar tu
 *    propia tarjeta o ver los paquetes de Bookea.
 */

const AMARILLO = "#f5bd18";
const LINEA = "rgba(255,255,255,.12)";

export const metadata: Metadata = {
  title: "Demo · Lavacar · Lealtad Bookea",
};

const FOTO_HERO = "/lealtad/plantillas/franjas/lavacar-4.jpg";
const FOTO_PACK5 = "/lealtad/plantillas/franjas/lavacar-1.jpg";
const FOTO_PREMIUM = "/lealtad/plantillas/franjas/lavacar-2.jpg";
const FOTO_CERAMICO = "/lealtad/plantillas/franjas/lavacar-4.jpg";

type Producto = {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  precio: string;
  boton: string;
  foto?: string;
};

const PRODUCTOS: Producto[] = [
  {
    id: "pack5",
    tag: "Favorito",
    titulo: "Pack 5 Lavados",
    texto: "Ideal para clientes frecuentes.",
    precio: "₡38.000",
    boton: "Ver paquete",
    foto: FOTO_PACK5,
  },
  {
    id: "premium",
    tag: "Premium",
    titulo: "Pack Premium",
    texto: "3 lavados premium + beneficio.",
    precio: "₡24.000",
    boton: "Ver paquete",
    foto: FOTO_PREMIUM,
  },
  {
    id: "giftcard",
    tag: "Gift Card",
    titulo: "Gift Card",
    texto: "Regalá un lavado. Sin tarjetas físicas.",
    precio: "Desde ₡5.000",
    boton: "Comprar",
  },
  {
    id: "ceramico",
    tag: "Nuevo",
    titulo: "Cerámico",
    texto: "Protección avanzada y acabado premium.",
    precio: "₡18.900",
    boton: "Reservar",
    foto: FOTO_CERAMICO,
  },
];

export default function DemoLavacarsPage() {
  return (
    <main className="min-h-svh bg-[#070809] px-[17px] py-8 text-white">
      <div className="mx-auto w-full max-w-[1380px]">
        {/* ══════════════ TOPBAR ══════════════ */}
        <header className="flex h-[66px] items-center justify-between text-[11px] tracking-[.04em] text-[#9298a2]">
          <Link href="/lealtad" className="text-[#8d929b] hover:text-white">
            ← Volver
          </Link>
          <div className="text-[12px] font-semibold tracking-[.22em]">
            BOOKEA <span style={{ color: AMARILLO }}>•</span> LEALTAD
          </div>
          <a
            href="#productos"
            className="hidden border px-[15px] py-[10px] text-[9px] font-extrabold uppercase tracking-[.1em] text-white sm:block"
            style={{ borderColor: LINEA }}
          >
            Ver paquetes
          </a>
        </header>

        {/* ══════════════ HERO ══════════════ */}
        <section className="relative overflow-hidden bg-[#151719] lg:min-h-[690px]">
          <div className="absolute inset-0">
            <Image
              src={FOTO_HERO}
              alt=""
              fill
              priority
              sizes="(min-width: 1380px) 1380px, 100vw"
              className="object-cover"
              style={{ objectPosition: "62% center" }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  // Oscuro en las DOS puntas -izquierda para el texto,
                  // derecha para que el pase se recorte contra algo
                  // sólido- con la foto asomando solo en el medio. Antes
                  // se apagaba de golpe hacia la derecha y el pase (navy)
                  // quedaba compitiendo con la espuma clara de fondo.
                  "linear-gradient(90deg,rgba(0,0,0,.93) 0%,rgba(0,0,0,.72) 30%,rgba(0,0,0,.22) 54%,rgba(0,0,0,.62) 76%,rgba(0,0,0,.9) 100%)," +
                  "linear-gradient(0deg,rgba(0,0,0,.48),transparent 50%)",
              }}
            />
          </div>

          <div className="relative flex flex-col gap-10 px-6 py-10 sm:px-[58px] sm:py-[62px] lg:min-h-[690px] lg:justify-center">
            <div className="max-w-[680px]">
              <div className="text-[9px] font-extrabold uppercase tracking-[.22em] text-[#b5bac3]">
                Lavacar El Rayo · Programa de lealtad
              </div>
              <h1 className="mt-[15px] text-[clamp(38px,6vw,86px)] leading-[.92] tracking-[-.045em] font-bold">
                Un lavado no se olvida.
                <br />
                <span style={{ color: AMARILLO }}>Una tarjeta, sí.</span>
              </h1>
              <p className="mt-[22px] max-w-[480px] text-[14px] leading-[1.7] text-[#c0c4cb]">
                <strong className="text-white">Lavacar El Rayo</strong> no existe — es el ejemplo.
                Premiamos cada visita: acumulá sellos, desbloqueá beneficios y hacé que tu próximo
                lavado valga más.
              </p>

              <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                <div
                  className="min-w-[150px] border px-4 py-3.5"
                  style={{ borderColor: LINEA, background: "rgba(0,0,0,.36)" }}
                >
                  <b className="block text-[11px]">LA REGLA</b>
                  <small className="text-[9px] text-[#8e949e]">1 sello por lavado completo</small>
                </div>
                <div
                  className="min-w-[150px] border px-4 py-3.5"
                  style={{ borderColor: LINEA, background: "rgba(0,0,0,.36)" }}
                >
                  <b className="block text-[11px]">LA RECOMPENSA</b>
                  <small className="text-[9px] text-[#8e949e]">6.º lavado gratis</small>
                </div>
              </div>

              <div className="mt-[26px] flex flex-wrap gap-2">
                <Link
                  href="/lealtad/nuevo"
                  className="inline-flex items-center justify-center bg-white px-[18px] py-[13px] text-[9px] font-extrabold uppercase tracking-[.1em] text-[#070809]"
                >
                  Quiero esto en mi negocio
                </Link>
                <a
                  href="#productos"
                  className="inline-flex items-center justify-center border px-[18px] py-[13px] text-[9px] font-extrabold uppercase tracking-[.1em] text-white"
                  style={{ borderColor: LINEA }}
                >
                  Ver paquetes
                </a>
              </div>
            </div>

            {/* El slider vive DENTRO del hero, a la derecha en desktop
                -mismo lugar que el mockup- y en flujo normal debajo del
                texto en pantallas angostas, donde no hay espacio para
                superponerlo sin tapar la letra. */}
            <div className="flex justify-center lg:absolute lg:right-7 lg:top-1/2 lg:block lg:-translate-y-1/2">
              <PasesSlider />
            </div>
          </div>
        </section>

        {/* ══════════════ PRODUCTOS ══════════════ */}
        <section className="py-[70px]" id="productos">
          <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-[.22em] text-[#b5bac3]">
                Paquetes y productos
              </div>
              <h2 className="mt-[7px] text-[clamp(26px,3.5vw,38px)] leading-[1.02] tracking-[-.03em] font-bold">
                Comprá hoy. Volvé después.
              </h2>
            </div>
            <p className="max-w-[330px] text-[11px] text-[#777e89] sm:text-right">
              Paquetes diseñados para premiar la recurrencia y convertir cada visita en una nueva
              oportunidad.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {PRODUCTOS.map((p) => (
              <article key={p.id} className="border" style={{ borderColor: LINEA, background: "#0d0f12" }}>
                {p.foto ? (
                  <div className="relative h-[150px] sm:h-[190px]">
                    <Image src={p.foto} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(0deg,rgba(0,0,0,.58),transparent 55%)" }}
                    />
                    <span className="absolute left-3 top-3 bg-white px-[7px] py-[5px] text-[8px] font-extrabold uppercase text-[#090a0c]">
                      {p.tag}
                    </span>
                  </div>
                ) : (
                  <div
                    className="relative flex h-[150px] items-center justify-center sm:h-[190px]"
                    style={{ background: "linear-gradient(155deg,#1a1704,#070809 70%)" }}
                  >
                    <span className="absolute left-3 top-3 bg-white px-[7px] py-[5px] text-[8px] font-extrabold uppercase text-[#090a0c]">
                      {p.tag}
                    </span>
                    <span className="text-[13px] font-extrabold uppercase tracking-[.18em]" style={{ color: AMARILLO }}>
                      Gift Card
                    </span>
                  </div>
                )}
                <div className="p-[17px]">
                  <h3 className="text-[17px] font-bold leading-tight">{p.titulo}</h3>
                  <p className="mt-1.5 min-h-[30px] text-[10px] text-[#777e88]">{p.texto}</p>
                  <div className="mt-3.5 flex items-center justify-between">
                    <span className="text-[16px] font-bold">{p.precio}</span>
                    <Link
                      href="/lealtad/nuevo"
                      className="border px-2.5 py-2 text-[8px] font-extrabold uppercase text-white hover:bg-white hover:text-[#08090b]"
                      style={{ borderColor: LINEA }}
                    >
                      {p.boton}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="border-t pb-6 pt-6 text-center" style={{ borderColor: LINEA }}>
          <p className="text-[11px] text-white/30">
            Esta tarjeta todavía no existe — es la vista previa de cómo quedaría. Se activa cuando
            vos la pedís.
          </p>
        </div>
      </div>
    </main>
  );
}
