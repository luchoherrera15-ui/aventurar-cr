import type { Metadata } from "next";
import Link from "next/link";
import NavLealtad from "../nav-lealtad";
import CarruselPasos from "./carrusel-pasos";
import MockupCreacion from "../mockup-creacion";
import MockupPoster from "../mockup-poster";
import MockupEscaneo from "../mockup-escaneo";
import MockupFidelidad from "../mockup-fidelidad";
import MockupAnuncios from "../mockup-anuncios";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /lealtad/ayuda — EL TUTORIAL, EN CUATRO PASOS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (28 ago 2026): un botón «Tutorial de ayuda» en el
 * mostrador del panel que lleve a una página con «mockups en tipo
 * pasos»: crear el programa, imprimir el póster con QR, invitar a los
 * clientes (escaneo en el local o link por WhatsApp) y empezar a dar
 * beneficios — más el recordatorio de que se pueden mandar
 * notificaciones de descuentos y productos nuevos.
 *
 * ── LOS MOCKUPS SON LOS QUE YA EXISTEN ──────────────────────────────
 *
 * La landing de /lealtad ya tiene una familia entera de composiciones
 * animadas (mockup-creacion, mockup-escaneo, mockup-fidelidad,
 * mockup-anuncios). Acá se REUTILIZAN tal cual: dibujar «parecidos»
 * para el tutorial sería tener dos versiones de la misma pantalla que
 * se despegan al primer cambio. El único nuevo es MockupPoster —el
 * iPad entrando a «Póster y QR»— porque ese recorrido no existía
 * dibujado, y se suma a la familia por si la landing lo quiere después.
 *
 * ── PÚBLICA A PROPÓSITO ─────────────────────────────────────────────
 *
 * No pide sesión: el tutorial también sirve ANTES de crear el programa
 * (alguien evaluando Lealtad ve exactamente qué va a tener que hacer),
 * y un empleado nuevo puede abrirlo sin las llaves del panel.
 */

export const metadata: Metadata = {
  title: "Tutorial del programa de lealtad",
  description:
    "Cómo funciona tu programa de lealtad en Bookea, paso a paso: creá tu tarjeta, imprimí tu póster con QR, invitá a tus clientes y empezá a dar beneficios.",
};

export default function AyudaLealtadPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <NavLealtad />

      <main className="flex-1">
        {/* ── EL ENCABEZADO ──────────────────────────────────────────── */}
        <header className="mx-auto w-full max-w-[880px] px-5 pb-4 pt-14 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-bookea-naranja-fuerte">
            Tutorial de ayuda
          </p>
          <h1 className="titulo mt-3 text-[clamp(30px,4.4vw,48px)] leading-[1.06] text-aventurea-navy">
            Tu programa de lealtad, paso a paso
          </h1>
          <p className="mx-auto mt-4 max-w-[56ch] text-[15.5px] leading-relaxed text-aventurea-ink-soft">
            De cero a clientes que vuelven, en cuatro pasos. Todo se hace desde
            tu panel — sin diseñadores, sin imprentas y sin apps que tus
            clientes tengan que instalar.
          </p>
        </header>

        {/* Los cuatro pasos, en diapositivas con puntos (pedido del
            dueño: «tipo diapositivas, slideable hacia la derecha»).
            El contenido es EL MISMO que tenían las secciones apiladas;
            solo cambió el marco. */}
        <CarruselPasos
          pasos={[
            {
              titulo: "Creá tu programa de lealtad",
              mockup: <MockupCreacion />,
              contenido: (
                <>
                  <p>
                    Elegís el tipo de tarjeta (sellos, puntos, lo que le calce a
                    tu negocio), tus colores, tu logo y el premio de la meta. La
                    tarjeta queda lista en Apple Wallet y Google Wallet al
                    instante.
                  </p>
                  <p>
                    <Link
                      href="/lealtad/nuevo"
                      className="font-extrabold text-aventurea-navy underline underline-offset-2"
                    >
                      Crear mi programa →
                    </Link>
                  </p>
                </>
              ),
            },
            {
              titulo: "Imprimí tu póster con QR",
              mockup: <MockupPoster />,
              contenido: (
                <p>
                  En tu panel, entrá a{" "}
                  <strong className="font-extrabold text-aventurea-ink">«Póster y QR»</strong>:
                  elegís uno de los seis diseños, lo ves entero en pantalla y lo
                  imprimís desde el navegador. Ese QR es la puerta de entrada de
                  tus clientes — pegalo en la caja, en el espejo, donde se vea.
                </p>
              ),
            },
            {
              titulo: "Invitá a tus clientes",
              ancho: true,
              mockup: <MockupEscaneo />,
              contenido: (
                <>
                  <p>
                    En el local, tu cliente escanea el código del póster y su
                    tarjeta queda guardada en el teléfono — de una, sin
                    descargar nada.
                  </p>
                  <div className="mt-1 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4">
                    <p className="text-[12px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                      ¿La compra fue en línea?
                    </p>
                    <p className="mt-1 text-[14px]">
                      Mandale el link de tu tarjeta por WhatsApp y llega igual:
                    </p>
                    <div className="mt-3 flex justify-end">
                      <div className="max-w-[280px] rounded-2xl rounded-br-md bg-[#d9fdd3] px-3 py-2 text-left shadow-sm">
                        <p className="text-[13px] leading-snug text-[#111b21]">
                          ¡Gracias por tu compra! 💛 Sumá tu sello acá:{" "}
                          <span className="font-bold text-[#027eb5]">
                            bookea.lat/tarjeta/tu-negocio
                          </span>
                        </p>
                        <p className="mt-1 text-right text-[10px] font-semibold text-[#667781]">
                          2:41 p. m. <span className="text-[#53bdeb]">✓✓</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ),
            },
            {
              titulo: "Empezá a brindar beneficios",
              mockup: <MockupFidelidad />,
              contenido: (
                <p>
                  Cada visita suma sellos o puntos desde tu mostrador — lo hacés
                  vos o cualquiera de tu equipo. Al llegar a la meta, ahí mismo
                  entregás el premio y la tarjeta arranca de cero, lista para la
                  próxima vuelta.
                </p>
              ),
            },
          ]}
        />

        {/* ── EL RECORDATORIO IMPORTANTE ─────────────────────────────── */}        {/* ── EL RECORDATORIO IMPORTANTE ─────────────────────────────── */}
        <section className="bg-aventurea-navy py-14">
          <div className="mx-auto grid w-full max-w-[1080px] items-center gap-8 px-5 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
                ★ Importante
              </p>
              <h2 className="titulo mt-4 text-[clamp(22px,3vw,32px)] leading-[1.12] text-white">
                Podés mandarles notificaciones a tus clientes
              </h2>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-white/70">
                Descuentos, productos nuevos, la promo del día: lo escribís en
                tu panel y les llega directo a la tarjeta que ya tienen en el
                teléfono. Sin números que recolectar, sin listas de difusión.
              </p>
            </div>
            <MockupAnuncios />
          </div>
        </section>

        {/* ── EL CIERRE ──────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[880px] px-5 py-16 text-center">
          <h2 className="titulo text-[clamp(24px,3.2vw,36px)] leading-[1.1] text-aventurea-navy">
            Eso es todo — cuatro pasos y a fidelizar.
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/lealtad/nuevo"
              className="presionable inline-flex items-center gap-2 rounded-xl bg-aventurea-navy px-7 py-3.5 text-[15px] font-extrabold text-white"
            >
              Crear mi programa gratis <span aria-hidden>→</span>
            </Link>
            <Link
              href="/lealtad/entrar"
              className="presionable inline-flex items-center gap-2 rounded-xl border-2 border-aventurea-navy px-6 py-3 text-[14.5px] font-extrabold text-aventurea-navy"
            >
              Ya tengo uno: ir a mi panel
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
