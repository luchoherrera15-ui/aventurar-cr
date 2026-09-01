import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SeccionTiposTarjeta from "./seccion-tipos-tarjeta";
import SiteFooter from "@/components/site-footer";
import { IMAGEN_OG } from "@/lib/sitio";
import NavLealtad from "./nav-lealtad";
import BurbujaContacto from "./burbuja-contacto";
import MockupHeroPase from "./mockup-hero-pase";
import BotonCrearPase from "./boton-crear-pase";
import FranjaLatam from "./franja-latam";
import SeccionPorQue from "./seccion-por-que";
import SeccionComoTrabajamos from "./seccion-como-trabajamos";
import PreciosLanding from "./precios-landing";
import FaqAcordeon from "./faq-acordeon";

/**
 * /lealtad — rediseño "storytelling de producto" 2026-08.
 *
 * Segunda pasada sobre el rediseño SaaS anterior (ver historial de
 * git): la primera ya tenía casi todas las piezas correctas —el hero
 * con el teléfono animado, el selector interactivo de tipos, el
 * recorrido del mostrador, las automatizaciones honestas— pero
 * repartidas en ~15 secciones de punta a punta, cada una con su
 * propio encabezado, sin pedir nunca "¿esto puede vivir junto con lo
 * de al lado?". Esta pasada NO tira ese trabajo: lo reordena y lo
 * funde en 11 movimientos con una razón de ser cada uno, y agrega la
 * única pieza que faltaba de verdad — un mockup real del panel del
 * negocio (antes era una tarjetita de tres cifras metida a presión
 * dentro de "Resultados").
 *
 * El orden cuenta una sola historia, de punta a punta:
 *   Hero (qué es) → para quién es → el problema (el cartón) →
 *   cómo funciona (+ el mostrador) → vive en el Wallet → elegís el
 *   tipo → tu panel (KPIs + marketing + confianza) → lo que corre
 *   solo (automatizaciones) → precios → FAQ → cierre.
 *
 * Los paquetes y sus viñetas salen de src/lib/lealtad/planes.ts (la
 * misma fuente que /lealtad/planes) y el catálogo de tipos de
 * src/lib/lealtad/tipos-tarjeta.ts — nada de esto se escribe a mano
 * acá para que la landing no pueda prometer algo que el producto no
 * tiene. El motor real vive en la migración 0060 (programa_lealtad,
 * ledger de puntos, pases) y el impacto comercial en la 0197
 * (lealtad_transacciones) — ver impacto-comercial.tsx, la fuente real
 * de las cinco cifras que ahora muestra MockupPanelNegocio.
 */

const NAVY_PROFUNDO = "#0a1226";
const NAVY = "#16295e";

/* ── Los papeles de color de esta página ──────────────────────────
   Azul lo que se toca, naranja lo que se gana — ver globals.css
   (tokens de `.lealtad`). Las franjas navy piden la variante CLARA
   del azul: `--accion` sobre navy da 1,44:1 y desaparece. */
const ACCION_OSCURO = "var(--accion-claro)";
const ACENTO_CLARO = "var(--orange-acento-claro)";

/** El degradado navy→azul para texto: se usa con cuenta gotas (hero,
 *  problema, panel, cierre) — no en cada encabezado de la página, o
 *  deja de leerse como énfasis y pasa a ser papel tapiz. */
const DEGRADADO_TEXTO =
  "linear-gradient(110deg,#0b3168 0%,#0f4c9e 55%,#3672c9 100%)";

/**
 * UN PASO DE «¿CÓMO FUNCIONA?»: su número, su encabezado y su demo.
 *
 * Existe para que los tres pasos no se escriban tres veces con el mismo
 * markup copiado — que es exactamente cómo se despegan entre sí a la
 * primera corrección.
 *
 * El número va en un disco y NO como cifra fantasma de fondo (que es lo
 * que hacía `asi-funciona.tsx`): acá debajo hay un mockup a color con
 * teléfonos y controles, y una cifra gigante translúcida detrás pelearía
 * con él. Arriba de un texto suelto funcionaba; arriba de esto, no.
 */

function TextoDegradado({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: DEGRADADO_TEXTO,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {children}
    </span>
  );
}

// ── ESTA PÁGINA VUELVE A SER ESTÁTICA (ago 2026) ────────────────────
//
// Acá decía que la ISR se había caído «porque el configurador necesita
// saber si hay sesión, y eso exige leer la cookie en cada pedido». Eso
// dejó de ser cierto: el configurador se mudó a /lealtad/crear, y lo
// único que seguía leyendo la cookie era el nombre de la esquina del
// nav — que ahora `NavLealtad` resuelve solo, en el navegador.
//
// Sin cookies de por medio, Next la prerenderiza sola. No se declara
// `force-static` a propósito: con `dynamic = "auto"`, el día que
// alguien vuelva a meter un `cookies()` acá la página simplemente
// vuelve a ser dinámica. Con `force-static`, ese `cookies()` devolvería
// vacío EN SILENCIO y nadie se enteraría hasta verlo en producción.

export const metadata: Metadata = {
  title: "Lealtad",
  description:
    "Sellos, puntos, cupones y membresías directo en el Wallet de tus clientes. Sin apps que instalar, sin contratos, y armado en menos de 10 minutos.",
  alternates: { canonical: "/lealtad" },
  openGraph: {
    title:
      "Bookea Lealtad — Convertí compradores de un día en clientes de por vida",
    description:
      "Tarjetas de sellos, puntos, cupones y membresías en Apple Wallet y Google Wallet. Sin apps, sin contratos, sin tarjeta de crédito.",
    url: "/lealtad",
    type: "website",
    // Sin esto la vista previa se quedaba SIN imagen: declarar un
    // `openGraph` propio reemplaza el del layout raíz entero, y con él
    // se va la que enchufa `opengraph-image.tsx`. Ver `IMAGEN_OG`.
    images: [IMAGEN_OG],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bookea Lealtad — Convertí compradores de un día en clientes de por vida",
    description:
      "Tarjetas de sellos, puntos, cupones y membresías en Apple Wallet y Google Wallet. Sin apps, sin contratos.",
  },
};


const FAQ: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Mis clientes necesitan instalar una app?",
    respuesta:
      "No. La tarjeta se agrega a Apple Wallet o Google Wallet, que ya vienen instalados en su teléfono. Nadie descarga nada de más.",
  },
  {
    pregunta: "¿Y si mi cliente no tiene iPhone?",
    respuesta:
      "Funciona igual en Android: la misma tarjeta se agrega a Google Wallet. Los dos caminos salen del mismo programa, no son dos productos distintos.",
  },
  {
    pregunta: "¿Cuánto tarda en estar listo?",
    respuesta:
      "Se arma en una sola pantalla, sin diseñador y viendo cómo va quedando: en menos de 10 minutos la tenés lista para compartir con tu primer cliente.",
  },
  {
    pregunta: "¿Puedo empezar sin pagar?",
    respuesta:
      "Sí — el paquete gratis no vence ni pide tarjeta de crédito. Alcanza para armar tu tarjeta y probarla con clientes reales; cuando crezcas, subís de paquete.",
  },
  {
    pregunta: "¿Cómo se paga?",
    /**
     * Los tres métodos de tarjeta NO son un deseo: son lo que el
     * producto ya cobra. `abrirCheckoutDeSuscripcion` (checkout.ts) es
     * la que abre el pago de los paquetes, y ahí NO se declara
     * `payment_method_types` — eso es deliberado y está comentado en el
     * archivo: en el momento en que esa lista se escribe a mano
     * (`["card"]`), Stripe deja de resolver los métodos solo y las
     * billeteras DESAPARECEN. Sin la lista, Checkout muestra tarjeta +
     * Apple Pay + Google Pay según el dispositivo.
     *
     * O sea que quien pague desde un iPhone ve Apple Pay y quien pague
     * desde Android ve Google Pay, sin una línea de código de nuestro
     * lado. Por eso se puede prometer acá.
     *
     * SINPE se queda primero y no por costumbre: es el que más se usa
     * en Costa Rica, y es el único camino para quien no tiene tarjeta.
     */
    respuesta:
      "Con tarjeta de crédito o débito, Apple Pay o Google Pay — el cobro se hace al instante y el programa queda activo. También por SINPE Móvil o transferencia: adjuntás el comprobante con tu solicitud y Bookea lo activa.",
  },
];

export default async function LealtadPage() {
  // ⚠️ ACÁ SE LEÍA LA SESIÓN EN EL SERVIDOR, Y ERA LO ÚNICO QUE
  // VOLVÍA DINÁMICA A ESTA PÁGINA.
  //
  // Es una landing de marketing: el mismo HTML para todo el mundo. El
  // único await era `sesionDelNavLealtad()` —leer una cookie para saber
  // qué decir en la esquina del nav—, y Next no puede prerenderizar una
  // página que lee cookies. Resultado: la landing entera se armaba de
  // nuevo, con su CPU, en cada visita (x-vercel-cache: MISS siempre).
  //
  // Ahora  resuelve la sesión solo, en el navegador, con el
  // cliente de Supabase del navegador. Esta página se prerenderiza y
  // sale del CDN. Ver el comentario de .

  return (
    <main className="min-h-svh bg-white">
      <RevealOnScroll />
      <NavLealtad autoOcultar />
      <BurbujaContacto />

      {/* ============================================================
          1 · HERO — qué es, la promesa, el producto en la mano.
          ============================================================ */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 76% 38%, rgba(15,76,158,.10), transparent 32%)," +
            "radial-gradient(circle at 92% 78%, rgba(243,146,0,.09), transparent 26%)," +
            "linear-gradient(180deg,#ffffff 0%,#fbfcff 100%)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-[280px] -top-[220px] h-[720px] w-[720px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(214,226,248,.6), transparent 66%)",
          }}
        />

        <div className="relative mx-auto grid w-[min(1180px,92vw)] items-center gap-8 pb-10 pt-10 sm:pt-14 lg:grid-cols-[49%_51%] lg:gap-2 lg:pb-16">
          <div className="text-center lg:text-left">
            <p
              className="inline-flex items-center gap-2 rounded-full border border-[#dbe3f4] bg-white/75 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] shadow-[0_6px_20px_rgba(20,40,90,.05)]"
              style={{ color: "var(--accion)" }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ACENTO_CLARO }}
              />
              Bookea Lealtad · Apple y Google Wallet
            </p>

            <h1 className="titulo mt-5 max-w-[15ch] text-balance text-[clamp(38px,5.2vw,64px)] leading-[1.0] tracking-tight text-aventurea-navy">
              Convertí compradores de un día en{" "}
              <TextoDegradado>clientes de por vida.</TextoDegradado>
            </h1>

            <p className="mt-5 max-w-[50ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Una tarjeta de fidelización que vive en el teléfono de tus
              clientes y trae más visitas y más recompra.{" "}
              <strong className="text-aventurea-navy">
                Apple Wallet y Google Wallet.
              </strong>{" "}
              Sin apps. Sin tarjetas de cartón.
            </p>

            {/* Acá vivían los dos botones del hero. El de crear se
                mudó a la barra de arriba (queda a la vista todo el
                rato, no solo en la primera pantalla) y el de ayuda
                ya vive en la burbuja flotante de la esquina.

                En su lugar sube la línea de rubros, que estaba abajo
                de las banderas: es la que contesta «¿esto sirve para
                MI negocio?», y esa pregunta llega antes que cualquier
                otra cosa. */}
            <p className="mt-7 max-w-[54ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              Aumentamos las ventas de{" "}
              <strong className="font-bold text-aventurea-navy">cafeterías</strong>,{" "}
              <strong className="font-bold text-aventurea-navy">restaurantes</strong>,{" "}
              <strong className="font-bold text-aventurea-navy">hoteles</strong>,{" "}
              <strong className="font-bold text-aventurea-navy">barberías</strong>,{" "}
              <strong className="font-bold text-aventurea-navy">estéticas</strong>,{" "}
              <strong className="font-bold text-aventurea-navy">salones de belleza</strong>,{" "}
              <strong className="font-bold text-aventurea-navy">spas</strong> y{" "}
              <strong className="font-bold text-aventurea-navy">tiendas</strong> en toda
              Latinoamérica.
            </p>

            {/* ── ACÁ VIVÍAN TRES CARDS DE CIFRAS ────────────────────
                «Gratis / primera tarjeta», «8 / tipos de tarjeta» y
                «0 / apps que instalar». Se fueron (pedido del dueño,
                ago 2026): el héroe ya tiene título, bajada, dos botones
                y el teléfono con la tarjeta, y tres recuadros más
                cargaban la primera pantalla sin agregar un dato que no
                estuviera dicho.

                Los tres hechos no se perdieron: «sin apps que instalar»
                está en la bajada y en las preguntas frecuentes, y los
                tipos de tarjeta tienen su propia sección con el
                selector. */}
          </div>

          <MockupHeroPase />
        </div>
      </section>

      {/* ============================================================
          LATINOAMÉRICA — las banderas y para qué negocios sirve.

          Pedido del dueño (31 ago 2026): «primero las banderas en la
          parte superior yendo de un lado a otro, todas desde México
          hasta Argentina, y luego un texto» con los rubros.

          Va ACÁ, pegada al hero, y no más abajo: quien acaba de leer
          la promesa grande lo primero que se pregunta es si esto es
          para su país y para su tipo de negocio. Las dos respuestas
          están en esta franja.
          ============================================================ */}
      <FranjaLatam />

      <SeccionPorQue />

      <SeccionComoTrabajamos />

      {/* ============================================================
          8 · TIPOS DE TARJETAS — el teléfono fijo, el pase que cambia.

          ── ACÁ VIVÍA «¿CÓMO FUNCIONA?» (1 sep 2026) ─────────────────
          Eran tres pasos en un slider —armás la tarjeta, la sellás, el
          cliente vuelve— con un mockup interactivo cada uno. Contaban
          el CICLO del producto.

          El dueño pidió cambiarla por el CATÁLOGO: los ocho tipos de
          tarjeta, con un teléfono fijo al lado que cambia el pase al
          elegir. La pregunta que llega a esta altura de la página ya no
          es «¿cómo se usa?» sino «¿sirve para lo mío?», y ocho pases
          reales la contestan mejor que tres pasos.

          `PasosSlider`, `MockupCreacion`, `MockupEscaneo` y
          `MockupFidelidad` siguen enteros en el repo: solo dejaron de
          importarse acá. Borrarlos es otra pasada.
          ============================================================ */}
      <SeccionTiposTarjeta />

      {/* ============================================================
          9 · PRECIOS — panel navy redondeado, los cuatro paquetes
          reales de src/lib/lealtad/planes.ts.
          ============================================================ */}
      <section id="planes" className="scroll-mt-28 px-5 py-24 sm:px-8">
        <div
          data-tema="oscuro"
          className="relative mx-auto w-full max-w-[1160px] overflow-hidden rounded-[32px] px-6 py-12 sm:px-10 sm:py-14"
          style={{
            background: NAVY,
            boxShadow: "0 35px 80px rgba(12,25,64,.18)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-28 -top-36 h-[400px] w-[400px] rounded-full bg-white/[0.05]"
          />
          <div data-reveal className="relative">
            <div className="mx-auto max-w-[56ch] text-center">
              <p
                className="text-[12px] font-bold uppercase tracking-[0.22em]"
                style={{ color: ACCION_OSCURO }}
              >
                Beneficios y planes
              </p>
              <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(28px,4.4vw,44px)] leading-[1.08] text-white">
                Empezá pequeño y crecé cuando lo necesités.
              </h2>
              <p className="mx-auto mt-4 max-w-[48ch] text-[15px] leading-relaxed text-white/60">
                Empezá gratis, sin tarjeta de crédito y sin vencimiento. Cuando
                tu programa crezca, subís de paquete — nunca antes.
              </p>
            </div>

            <div className="mt-10">
              <PreciosLanding />
            </div>

            <p className="mt-8 text-center text-[12px] font-bold text-white/55">
              <Link
                href="/lealtad/planes"
                className="underline transition-colors hover:text-white"
              >
                Ver el detalle completo de cada paquete →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          10 · FAQ
          ============================================================ */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[760px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Preguntas frecuentes
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(28px,4.4vw,44px)] leading-[1.08] text-aventurea-navy">
              Lo que preguntan antes de empezar
            </h2>
          </div>

          <div data-reveal className="mt-10">
            <FaqAcordeon items={FAQ} />
          </div>
        </div>
      </section>

      {/* ============================================================
          11 · CIERRE — caja navy redondeada con el CTA final.
          ============================================================ */}
      <section
        className="px-5 py-24 text-center sm:px-8"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(15,76,158,.10) 0%, transparent 45%), #fbfcff",
        }}
      >
        <div
          data-tema="oscuro"
          data-reveal
          className="relative mx-auto w-full max-w-[980px] overflow-hidden rounded-[32px] px-6 py-16 sm:px-10 sm:py-20"
          style={{
            background: NAVY_PROFUNDO,
            boxShadow: "0 35px 80px rgba(12,25,64,.2)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-52 h-[430px] w-[430px] rounded-full"
            style={{ background: "rgba(157,180,255,.14)" }}
          />
          <div className="relative">
            <h2 className="titulo text-[clamp(30px,4.8vw,54px)] leading-[1.05] text-white">
              Tu competencia reparte tarjetas de cartón.
              <br />
              <span style={{ color: ACCION_OSCURO }}>
                Vos, sellos en el teléfono.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-[48ch] text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/60">
              Contanos de tu negocio y armamos tu programa — sin contratos, sin
              permanencia mínima.
            </p>
            <div className="mt-9">
              <BotonCrearPase variante="oscuro">
                ¡Creá tu tarjeta de fidelidad{" "}
                <span className="palabra-gratis palabra-gratis--sobre-claro">gratis</span>!{" "}
                <span aria-hidden>→</span>
              </BotonCrearPase>
            </div>
          </div>
        </div>
      </section>



      <SiteFooter />
    </main>
  );
}
