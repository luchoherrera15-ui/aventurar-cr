import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import { PLANES_VIGENTES } from "@/lib/lealtad/planes";
import { TIPOS_TARJETA_ID } from "@/lib/lealtad/tipos-tarjeta";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
import NavLealtad from "./nav-lealtad";
import BurbujaContacto from "./burbuja-contacto";
import ConfiguradorLealtad from "./configurador-lealtad";
import MockupRecorrido from "./mockup-recorrido";
import MockupAnuncios from "./mockup-anuncios";
import MockupRescate from "./mockup-rescate";
import MockupHitos from "./mockup-hitos";
import MockupCercania from "./mockup-cercania";
import MockupHeroPase from "./mockup-hero-pase";
import MockupPanelNegocio from "./mockup-panel-negocio";
import BotonCrearPase from "./boton-crear-pase";
import AsiFunciona from "./asi-funciona";
import SelectorTiposLanding from "./selector-tipos-landing";
import FlujoAutomatizaciones from "./flujo-automatizaciones";
import SeccionWallets from "./seccion-wallets";
import SeccionConfianza from "./seccion-confianza";
import SeccionBeneficios from "./seccion-beneficios";
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

// Se cae la ISR de 6 horas que tenía esta página (`revalidate = 21600`):
// el configurador ahora crea la cuenta y el negocio en /lealtad/crear, y
// para decidir si le muestra a la visita el paso «Tu cuenta» necesita
// saber si ya hay sesión — eso exige leer la cookie en cada pedido, que
// es justo lo que una página estática no puede hacer.

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
  },
};

/**
 * LOS CUATRO PILARES — contra qué compite Bookea Lealtad.
 *
 * Cada uno es una capacidad que el producto TIENE hoy, no una promesa:
 * el pase en Wallet nativo, el refresco silencioso del pase, los
 * anuncios push (con ubicaciones en los paquetes que las incluyen) y la
 * identidad por persona detrás de cada sello. El `contraste` es la
 * mitad que hace el trabajo: sin él cada card es una característica
 * suelta; con él, cada card es una razón para dejar el cartón.
 */
const PILARES: {
  icono: NombreIcono;
  titulo: string;
  texto: string;
  contraste: string;
}[] = [
  {
    icono: "movil",
    titulo: "No se pierde ni se moja",
    texto:
      "La tarjeta vive en la billetera del teléfono, al lado de la del banco y del pase de abordar. El cliente la trae encima siempre, sin acordarse de nada.",
    contraste: "El cartón se arruga, se moja y termina en la guantera.",
  },
  {
    icono: "repetir",
    titulo: "Se actualiza sola",
    texto:
      "Escaneás su código y el conteo cambia en su teléfono en el momento. No tiene que abrir una app, ni refrescar, ni pedirte que le cuentes cuántos lleva.",
    contraste: "En papel, el saldo solo existe cuando alguien lo busca.",
  },
  {
    icono: "campana",
    titulo: "Le podés escribir",
    texto:
      "Un anuncio tuyo le aparece en la pantalla de bloqueo. Y con los paquetes que traen ubicaciones, le aparece justo cuando pasa cerca de tu local.",
    contraste: "Una tarjeta de cartón no avisa nada, nunca.",
  },
  {
    icono: "clientes",
    titulo: "Sabés quién vuelve",
    texto:
      "Cada sello queda con nombre. Tu panel te dice quiénes son los de siempre, quiénes hace rato no aparecen y quién está por llegar a su premio.",
    contraste: "Con sellos de hule no sabés ni cuántas tarjetas repartiste.",
  },
];

const CUPO_MAX_ANUNCIOS = PLANES_VIGENTES.reduce(
  (max, p) => Math.max(max, p.limites.notificacionesMes ?? 0),
  0,
);

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
      "Armar la tarjeta son cinco pasos, sin diseñador: en menos de 10 minutos la tenés lista para compartir con tu primer cliente.",
  },
  {
    pregunta: "¿Puedo empezar sin pagar?",
    respuesta:
      "Sí — el paquete gratis no vence ni pide tarjeta de crédito. Alcanza para armar tu tarjeta y probarla con clientes reales; cuando crezcas, subís de paquete.",
  },
  {
    pregunta: "¿Cómo se paga?",
    respuesta:
      "Por SINPE Móvil o transferencia: adjuntás el comprobante con tu solicitud y Bookea activa el programa.",
  },
];

export default async function LealtadPage() {
  // Del lado del SERVIDOR, con la cookie de sesión: el nav de arriba
  // muestra de QUIÉN es la sesión (nombre de la cuenta) y no solo si
  // hay una — ver src/lib/lealtad/sesion-nav.ts.
  const sesion = await sesionDelNavLealtad();

  return (
    <main className="min-h-svh bg-white">
      <RevealOnScroll />
      <NavLealtad logueado={sesion.logueado} nombre={sesion.nombre} />
      <BurbujaContacto />

      {/* ============================================================
          0 · ARMÁ TU TARJETA — pedido del dueño (esta sesión): el
          configurador vuelve a vivir en la landing, ahora pegado al
          header en vez de a mitad de página o en su propia pantalla
          (/lealtad/crear sigue existiendo para quien llega por un
          link directo). Los botones "¡Creá tu pase!" de esta misma
          página hacen scroll hasta acá (BotonCrearPase) — es lo
          primero interactivo que se ve, antes de cualquier texto de
          venta.
          ============================================================ */}
      <section className="px-5 pt-6 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          <ConfiguradorLealtad haySesion={sesion.logueado} />
        </div>
      </section>

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

            <div className="mt-8">
              <BotonCrearPase variante="primario" grande>
                ¡Creá tu tarjeta de fidelidad gratis! <span aria-hidden>→</span>
              </BotonCrearPase>
              <p className="mt-3 flex items-center justify-center gap-2 text-[13.5px] font-bold text-aventurea-ink-soft lg:justify-start">
                <span aria-hidden>📲</span>
                Tus clientes la agregan al Wallet al instante — sin instalar
                nada.
              </p>
            </div>

            {/* Tres hechos reales, no cifras inventadas — el mismo
                lenguaje de "número prominente + etiqueta" del resto del
                rediseño, en vez del checklist con palomitas. */}
            <div className="mt-7 grid grid-cols-3 gap-2">
              {[
                { valor: "Gratis", etiqueta: "primera tarjeta" },
                {
                  valor: String(TIPOS_TARJETA_ID.length),
                  etiqueta: "tipos de tarjeta",
                },
                { valor: "0", etiqueta: "apps que instalar" },
              ].map((s) => (
                <div
                  key={s.etiqueta}
                  className="rounded-xl border border-aventurea-line bg-white/80 px-3 py-2.5 text-center lg:text-left"
                >
                  <p className="text-[17px] font-extrabold leading-none text-aventurea-navy">
                    {s.valor}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-aventurea-ink-soft">
                    {s.etiqueta}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[13px] text-aventurea-ink-soft/80">
              ¿Ya tenés el programa?{" "}
              <Link
                href="/cuenta?volver=lealtad"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline transition-colors hover:opacity-75"
                style={{ color: "var(--accion)" }}
              >
                Entrá acá
              </Link>
            </p>
          </div>

          <MockupHeroPase />
        </div>
      </section>

      {/* ============================================================
          3 · EL PROBLEMA — contra qué compite Bookea Lealtad. No es
          "qué es" (eso ya lo hizo el hero): es "por qué importa".
          ============================================================ */}
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              El problema del cartón
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[24ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08] text-aventurea-navy">
              Cuatro cosas que una tarjeta de cartón{" "}
              <TextoDegradado>nunca va a hacer.</TextoDegradado>
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-aventurea-ink-soft">
              No es la misma tarjeta de siempre en versión digital. Es lo que se
              vuelve posible cuando el sello deja de vivir en un papel.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PILARES.map((pilar, i) => (
              <div
                key={pilar.titulo}
                data-reveal
                className="group flex flex-col rounded-2xl border border-aventurea-line bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accion)]/40 hover:shadow-[0_8px_24px_-16px_rgba(22,41,94,0.35)]"
                style={
                  { "--reveal-delay": `${i * 70}ms` } as React.CSSProperties
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl transition-colors group-hover:bg-[color:var(--accion)] group-hover:text-white"
                    style={{
                      background: "var(--accion-suave)",
                      color: "var(--accion-fuerte)",
                    }}
                  >
                    <Icono nombre={pilar.icono} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] font-bold leading-tight text-aventurea-navy">
                  {pilar.titulo}
                </h3>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-aventurea-ink-soft">
                  {pilar.texto}
                </p>
                <p className="mt-3.5 border-t border-aventurea-line pt-3 text-[11.5px] font-semibold text-aventurea-ink-soft/75">
                  <span aria-hidden className="mr-1.5 text-red-400">
                    ✕
                  </span>
                  {pilar.contraste}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          4 · CÓMO FUNCIONA — la mecánica general (timeline editorial,
          no cards) y, como su prueba visual inmediata, el recorrido
          de una visita real en el mostrador. Antes eran dos secciones
          separadas con dos encabezados; acá es un solo movimiento.
          ============================================================ */}
      <section id="como-funciona" className="scroll-mt-16 px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Así funciona
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08] text-aventurea-navy">
              En diez minutos tenés tu tarjeta andando
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Sin diseñador, sin desarrollador y sin que tus clientes instalen
              nada.
            </p>
          </div>

          <AsiFunciona />

          <div data-reveal className="mt-20">
            <div className="mx-auto max-w-[52ch] text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
                En el mostrador
              </p>
              <h3 className="titulo mx-auto mt-3 text-[22px] leading-tight text-aventurea-navy sm:text-[26px]">
                Así se registra cada visita
              </h3>
            </div>
            <div className="mt-10">
              <MockupRecorrido />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          5 · APPLE WALLET + GOOGLE WALLET — dónde vive la tarjeta.
          ============================================================ */}
      <section className="bg-aventurea-sky-light/40 px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Apple Wallet · Google Wallet
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[22ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08] text-aventurea-navy">
              Tu programa vive donde tus clientes ya están.
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Nada de instalar una app aparte: la tarjeta entra directo a la
              billetera que el teléfono ya trae instalada, junto a la del banco
              y el pase de abordar.
            </p>
          </div>
          <div data-reveal className="mt-14">
            <SeccionWallets />
          </div>
        </div>
      </section>

      {/* ============================================================
          6 · SOLUCIONES — elegí el tipo, la tarjeta y la explicación
          cambian juntas. El único selector interactivo de la página
          que decide qué mostrar, no solo cómo se ve.
          ============================================================ */}
      <section id="soluciones" className="scroll-mt-16 px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Soluciones
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(30px,5vw,54px)] leading-[1.06] text-aventurea-navy">
              Elegí qué guardan en el teléfono
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Los ocho tipos de tarjeta que el producto arma de verdad. Tocá
              cada uno y mirá cómo cambia la tarjeta en el teléfono.
            </p>
          </div>

          <div data-reveal className="mt-12">
            <SelectorTiposLanding />
          </div>
        </div>
      </section>

      {/* ============================================================
          7 · TU PANEL — lo que ve el dueño del negocio: las cifras
          reales (KPIs), la herramienta para escribirle a sus
          clientes, y por qué se puede confiar en lo que el panel
          dice. Antes eran tres secciones sueltas ("Resultados" con
          una tarjetita de tres cifras, "Marketing" y "Confianza");
          acá son un solo panel con tres pestañas de contenido, que es
          justamente la metáfora correcta.
          ============================================================ */}
      <section id="panel" className="scroll-mt-16 px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              El panel del negocio
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[24ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08] text-aventurea-navy">
              No te prometemos clientes fieles.{" "}
              <TextoDegradado>Te mostramos cuánto compran.</TextoDegradado>
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Cada sello queda respaldado por su compra: tu panel te dice cuánto
              venden tus clientes con tarjeta, cuánto gastan por visita y
              quiénes vuelven.
            </p>
          </div>

          <div data-reveal className="mx-auto mt-12 max-w-[880px]">
            <MockupPanelNegocio />
            <p className="mt-3 text-center text-[11.5px] font-bold text-aventurea-ink-soft/70">
              Vista de ejemplo del panel — no son cifras de un negocio real.
            </p>
          </div>

          {/* Sub-movimiento: la misma pantalla también te deja
              escribirle al cliente. Reusa la sección "Marketing"
              anterior, ahora como parte del panel en vez de una
              sección propia — es literalmente la misma pestaña. */}
          <div
            data-reveal
            className="mt-20 border-t border-aventurea-line pt-16"
          >
            <div className="mx-auto max-w-[54ch] text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
                Desde el mismo panel
              </p>
              <h3 className="titulo mx-auto mt-3 max-w-[20ch] text-[24px] leading-tight text-aventurea-navy sm:text-[30px]">
                Escribís el anuncio. Les llega al teléfono.
              </h3>
              <p className="mx-auto mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
                Tus anuncios les llegan como notificación a los clientes que ya
                tienen tu tarjeta en su Wallet — sin pedir números ni armar
                listas de correo. Enviás hasta {CUPO_MAX_ANUNCIOS} al mes según
                tu paquete.
              </p>
            </div>
            <div className="mt-12">
              <MockupAnuncios />
            </div>
          </div>

          {/* Sub-movimiento: por qué se puede confiar en lo de arriba. */}
          <div
            data-reveal
            className="mt-20 border-t border-aventurea-line pt-16"
          >
            <p className="mx-auto max-w-[54ch] text-center text-[13px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft">
              Y nada de esto depende de la palabra de nadie
            </p>
            <div className="mt-8">
              <SeccionConfianza />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          8 · LO QUE CORRE SOLO — automatizaciones reales, cada una
          etiquetada según si corre sola o con ayuda de un asesor.
          ============================================================ */}
      <section className="px-5 pb-4 pt-16 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <p
            data-reveal
            className="mx-auto mb-8 max-w-[62ch] text-center text-[13px] leading-relaxed text-aventurea-ink-soft"
          >
            Vos seguís atendiendo tu negocio.{" "}
            <strong className="text-aventurea-navy">
              Bookea se encarga de que nadie se olvide de volver.
            </strong>
          </p>
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Lo que corre solo
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[22ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08] text-aventurea-navy">
              Bookea se acuerda, aunque nadie esté pendiente.
            </h2>
          </div>
          <div
            data-reveal
            className="mt-10"
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            <FlujoAutomatizaciones />
          </div>
        </div>
      </section>

      {/* ── Franja 1: EL RESCATE (con tu asesor) — mockup de panel ── */}
      <section className="px-5 pb-20 pt-10 sm:px-8">
        <div className="mx-auto grid w-full max-w-[1120px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div data-reveal>
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Trabaja solo · Con tu asesor
            </p>
            <h3 className="titulo mt-4 max-w-[16ch] text-[clamp(26px,4vw,42px)] leading-[1.1] text-aventurea-navy">
              El cliente que dejó de venir no se pierde solo.
            </h3>
            <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              La mayoría de los clientes no se van enojados: se van sin darse
              cuenta. Tu panel te muestra quiénes tenían la tarjeta andando y
              hace semanas no aparecen. Con tu asesor armás el anuncio que los
              trae de vuelta, y les llega al teléfono donde ya tienen tus sellos
              guardados.
            </p>
            <p className="mt-5 rounded-xl bg-[#f2f4f8] px-3.5 py-3 text-[12.5px] font-bold text-[#5a6478]">
              Esta es la única de las tres que hoy hacés con ayuda, no sola — y
              lo decimos así de claro.
            </p>
          </div>
          <div
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            <MockupRescate />
          </div>
        </div>
      </section>

      {/* ── Franja 2: LOS HITOS (automático) — teléfono, sellos + hito ── */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto grid w-full max-w-[1120px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div data-reveal className="order-2 lg:order-1">
            <MockupHitos />
          </div>
          <div
            data-reveal
            className="order-1 lg:order-2"
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Trabaja solo · Automático
            </p>
            <h3 className="titulo mt-4 max-w-[15ch] text-[clamp(26px,4vw,42px)] leading-[1.1] text-aventurea-navy">
              Los hitos que le importan, sin que nadie se acuerde.
            </h3>
            <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              El primer sello, el penúltimo y el premio alcanzado salen solos
              por correo. Son los tres momentos en que un cliente decide si el
              programa le importa, y ninguno depende de que alguien en tu
              negocio se acuerde de escribirle.
            </p>
            <ul className="mt-5 flex flex-col gap-2 text-[13.5px] font-semibold text-aventurea-navy">
              <li>
                🎉 &ldquo;¡Tu tarjeta ya arrancó!&rdquo; — con el primer sello
              </li>
              <li>☕ &ldquo;¡Te falta uno!&rdquo; — con el penúltimo</li>
              <li>
                🏆 &ldquo;¡Premio desbloqueado!&rdquo; — al completar la meta
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Franja 3: CUANDO PASAN CERCA (automático) — teléfono + mapa ── */}
      <section className="px-5 pb-24 pt-20 sm:px-8">
        <div className="mx-auto grid w-full max-w-[1120px] items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div data-reveal>
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
              Trabaja solo · Automático
            </p>
            <h3 className="titulo mt-4 max-w-[15ch] text-[clamp(26px,4vw,42px)] leading-[1.1] text-aventurea-navy">
              Un recordatorio justo cuando puede entrar.
            </h3>
            <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              Con las ubicaciones activadas, el pase aparece en la pantalla del
              teléfono cuando el cliente está a unas cuadras de tu local. No es
              un correo que se lee en la noche: es un recordatorio en el momento
              exacto en que puede entrar.
            </p>
            <p className="mt-5 text-[13px] font-bold text-aventurea-ink-soft">
              📍 Disponible desde el paquete Impulso — mirá &ldquo;Elegí qué
              guardan en el teléfono&rdquo; más arriba.
            </p>
          </div>
          <div
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
          >
            <MockupCercania />
          </div>
        </div>
      </section>

      {/* ============================================================
          9 · PRECIOS — panel navy redondeado, los cuatro paquetes
          reales de src/lib/lealtad/planes.ts.
          ============================================================ */}
      <section id="planes" className="scroll-mt-16 px-5 py-24 sm:px-8">
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
                ¡Creá tu tarjeta de fidelidad gratis! <span aria-hidden>→</span>
              </BotonCrearPase>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          BENEFICIOS — cierra el recorrido con cuatro capacidades reales
          del producto (antes acá vivía el listado "Para qué rubros";
          pedido del dueño, ago 2026: reemplazarlo por tarjetas con
          mini-maqueta, ver seccion-beneficios.tsx).
          ============================================================ */}
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <p
            data-reveal
            className="text-center text-[13.5px] font-bold text-aventurea-ink-soft"
          >
            Hecho para negocios donde el cliente{" "}
            <span className="text-aventurea-navy">vuelve</span>.
          </p>
          <div data-reveal className="mt-8">
            <SeccionBeneficios />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
