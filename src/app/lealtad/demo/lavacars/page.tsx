import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PasesSlider from "./pases-slider";
import GrillaProductos from "./grilla-productos";

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
 * 4. LOS BOTONES DE LOS PAQUETES: segundo pedido del dueño — esta
 *    página dejó de ser "así se vería la lealtad" y pasó a ser "así
 *    podría verse el SITIO del lavacar", para mostrársela a lavacars
 *    de verdad. Cada paquete abre un panel de "solicitar el servicio"
 *    (ubicación + depósito de adelanto, `grilla-productos.tsx`) en vez
 *    de mandar a otra pantalla — sigue siendo mockup (no hay pago ni
 *    fila real detrás), pero ahora se ve y se siente completo.
 *
 * 5. TERCERA VUELTA — tercer mockup del dueño (mismo archivo, editado):
 *    hero en grilla de dos columnas (texto | pase) en vez de superponer
 *    el pase con posición absoluta. Pedido explícito: "resaltemos el
 *    pase" pero "mantené el slide entre los pases" — el mockup trae UN
 *    pase fijo (20% off); acá sigue el carrusel de 4 formas de
 *    `pases-slider.tsx`, solo que ahora en su propia columna en vez de
 *    flotando encima de la foto. Las 5 fotos de ESTA vuelta del mockup
 *    tampoco sirvieron -un Porsche con "PORSCHE" en el baúl y placa de
 *    EEUU, un gato (nada que ver), un Audi con el aro a la vista, la
 *    misma de Meguiar's ya rechazada antes, y una que ni carga (404)-
 *    así que se siguen usando las fotos ya verificadas del banco.
 */

const AMARILLO = "#ffb800";
const LINEA = "rgba(255,255,255,.12)";

export const metadata: Metadata = {
  title: "Demo · Lavacar · Lealtad Bookea",
};

const FOTO_HERO = "/lealtad/plantillas/franjas/lavacar-4.jpg";

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

        {/* ══════════════ HERO — grilla de 2 columnas ══════════════ */}
        <section className="relative overflow-hidden bg-[#151719]">
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
                  // sólido- con la foto asomando solo en el medio.
                  "linear-gradient(90deg,rgba(0,0,0,.93) 0%,rgba(0,0,0,.72) 30%,rgba(0,0,0,.22) 54%,rgba(0,0,0,.62) 76%,rgba(0,0,0,.9) 100%)," +
                  "linear-gradient(0deg,rgba(0,0,0,.48),transparent 50%)",
              }}
            />
            {/* Se funde con el negro del resto de la página en vez de
                cortar en seco -el `.hero:after` del mockup. */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[140px]"
              style={{ background: "linear-gradient(transparent,#070809)" }}
            />
          </div>

          {/* Grilla, no posición absoluta: el pase gana su PROPIA
              columna en vez de flotar encima de la foto -pedido
              explícito de "resaltemos el pase" del tercer mockup. */}
          <div className="relative grid gap-10 px-6 py-10 sm:px-[42px] sm:py-16 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-20">
            <div className="max-w-[680px]">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="text-[9px] font-extrabold uppercase tracking-[.22em] text-[#b5bac3]">
                  Lavacar El Rayo · Premium
                </div>
                <span
                  className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.14em]"
                  style={{ borderColor: "rgba(255,184,0,.4)", color: AMARILLO }}
                >
                  ● A domicilio
                </span>
              </div>
              <h1 className="mt-[15px] text-[clamp(38px,6vw,86px)] leading-[.92] tracking-[-.045em] font-bold">
                Tu carro.
                <br />
                <span style={{ color: AMARILLO }}>Otro nivel.</span>
              </h1>
              <p className="mt-[22px] max-w-[510px] text-[14px] leading-[1.7] text-[#c1c7cb]">
                <strong className="text-white">Lavacar El Rayo</strong> no existe — es el ejemplo.
                Lavado profesional y detallado, a domicilio. Reservá tu turno, dejá el adelanto y
                acumulá beneficios en tu pase digital.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <div className="border px-[17px] py-3.5" style={{ borderColor: LINEA, background: "rgba(7,9,11,.65)" }}>
                  <b className="block text-[15px]">+2.500</b>
                  <small className="text-[9px] uppercase tracking-wide text-[#7f888f]">Carros atendidos</small>
                </div>
                <div className="border px-[17px] py-3.5" style={{ borderColor: LINEA, background: "rgba(7,9,11,.65)" }}>
                  <b className="block text-[15px]">4.9/5</b>
                  <small className="text-[9px] uppercase tracking-wide text-[#7f888f]">Clientes</small>
                </div>
                <div className="border px-[17px] py-3.5" style={{ borderColor: LINEA, background: "rgba(7,9,11,.65)" }}>
                  <b className="block text-[15px]">30–90 min</b>
                  <small className="text-[9px] uppercase tracking-wide text-[#7f888f]">Tiempo estimado</small>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                <a
                  href="#productos"
                  className="inline-flex items-center justify-center bg-white px-[18px] py-[13px] text-[9px] font-extrabold uppercase tracking-[.1em] text-[#070809]"
                >
                  Ver servicios
                </a>
                <Link
                  href="/lealtad/crear"
                  className="inline-flex items-center justify-center border px-[18px] py-[13px] text-[9px] font-extrabold uppercase tracking-[.1em] text-white"
                  style={{ borderColor: LINEA }}
                >
                  Quiero esto en mi negocio
                </Link>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <PasesSlider />
            </div>
          </div>
        </section>

        {/* ══════════════ SERVICIOS ══════════════ */}
        <section className="py-[70px]" id="productos">
          <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-[.22em] text-[#b5bac3]">
                Servicios
              </div>
              <h2 className="mt-[7px] text-[clamp(26px,3.5vw,38px)] leading-[1.02] tracking-[-.03em] font-bold">
                Elegí cómo querés dejarlo.
              </h2>
            </div>
            <p className="max-w-[330px] text-[11px] text-[#777e89] sm:text-right">
              Servicios rápidos para el día a día y tratamientos completos para recuperar el
              acabado del vehículo — todos a domicilio.
            </p>
          </div>

          <GrillaProductos />
        </section>

        {/* ══════════════ BENEFICIOS ══════════════ */}
        <section className="border-t py-[70px]" style={{ borderColor: LINEA }}>
          <div className="mb-7">
            <div className="text-[9px] font-extrabold uppercase tracking-[.22em] text-[#b5bac3]">
              Bookea Wallet
            </div>
            <h2 className="mt-[7px] text-[clamp(26px,3.5vw,38px)] leading-[1.02] tracking-[-.03em] font-bold">
              Cada visita cuenta.
            </h2>
            <p className="mt-2 max-w-[560px] text-[12px] leading-[1.6] text-[#8f989f]">
              El sitio del negocio y el pase digital viven juntos: el cliente pide el servicio,
              lo recibe en su casa y acumula beneficios desde el mismo lugar.
            </p>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <div className="border p-[30px]" style={{ borderColor: LINEA, background: "#0b0e11" }}>
              <div className="text-[9px] font-extrabold uppercase tracking-[.18em]" style={{ color: AMARILLO }}>
                Programa El Rayo
              </div>
              <h3 className="mt-2 text-[24px] leading-tight tracking-[-.03em]">
                9 lavados. El décimo va por la casa.
              </h3>
              <p className="mt-2.5 max-w-[450px] text-[12px] leading-[1.6] text-[#8f989f]">
                Mostrá tu pase digital en cada visita. Cada lavado elegible suma un sello solo.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {Array.from({ length: 10 }, (_, i) => (
                  <span
                    key={i}
                    className="grid h-[37px] w-[37px] place-items-center border text-[10px] font-extrabold"
                    style={
                      i < 5
                        ? { background: AMARILLO, color: "#111", borderColor: AMARILLO }
                        : { borderColor: "#343a3f" }
                    }
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                ))}
              </div>
            </div>

            <div className="border p-[30px]" style={{ borderColor: LINEA, background: "#0b0e11" }}>
              <div className="text-[9px] font-extrabold uppercase tracking-[.18em]" style={{ color: AMARILLO }}>
                Reservas online
              </div>
              <h3 className="mt-2 text-[24px] leading-tight tracking-[-.03em]">Reservá sin llamar.</h3>
              <p className="mt-2.5 max-w-[450px] text-[12px] leading-[1.6] text-[#8f989f]">
                Elegí servicio, ubicación y hora. El negocio recibe la solicitud y llega hasta
                donde estés.
              </p>
              <a
                href="#productos"
                className="mt-6 inline-flex items-center justify-center bg-white px-[18px] py-[13px] text-[9px] font-extrabold uppercase tracking-[.1em] text-[#070809]"
              >
                Agendar servicio
              </a>
            </div>
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
