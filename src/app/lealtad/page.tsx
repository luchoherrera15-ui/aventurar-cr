import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import {
  ETIQUETAS_CAPACIDAD,
  PLANES,
  precioDe,
} from "@/lib/lealtad/planes";
import { TIPOS_TARJETA } from "@/lib/lealtad/tipos-tarjeta";
import { FICHAS } from "./contenido-tipos";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";
import NavLealtad from "./nav-lealtad";
import BurbujaContacto from "./burbuja-contacto";
import ConfiguradorLealtad from "./configurador-lealtad";
import MockupRecorrido from "./mockup-recorrido";

/**
 * /lealtad — rediseño 2026-08.
 *
 * Ya no es una landing "inmersiva sin chrome": tiene nav real y
 * alterna franjas claras (la mayoría) con tres franjas navy (hero,
 * el bloque de planes y el cierre), en vez del navy de punta a punta
 * que tenía antes. El objetivo es que en menos de 20 segundos se
 * entienda qué es, qué recibe el cliente, cómo se registra una
 * visita y que funciona con Apple Wallet y Google Wallet sin que
 * nadie instale una app — no vender con adjetivos.
 *
 * Los paquetes y sus viñetas salen de src/lib/lealtad/planes.ts (la
 * misma fuente que /lealtad/planes) y el catálogo de tipos de
 * src/lib/lealtad/tipos-tarjeta.ts — nada de esto se escribe a mano
 * acá para que la landing no pueda prometer algo que el producto no
 * tiene. El motor real vive en la migración 0060 (programa_lealtad,
 * ledger de puntos, pases).
 */

const NAVY_PROFUNDO = "#0a1226";
const NAVY = "#16295e";
const NARANJA = "#ee7420";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Lealtad",
  description:
    "Sellos, puntos, cupones y membresías directo en el Wallet de tus clientes. Sin apps que instalar, sin contratos, y armado en menos de 10 minutos.",
  alternates: { canonical: "/lealtad" },
  openGraph: {
    title: "Bookea Lealtad — Hacé que cada visita se convierta en la próxima",
    description:
      "Tarjetas de sellos, puntos, cupones y membresías en Apple Wallet y Google Wallet. Sin apps, sin contratos, sin tarjeta de crédito.",
    url: "/lealtad",
    type: "website",
  },
};

const PASOS: { titulo: string; texto: string; detalle: string }[] = [
  {
    titulo: "Armás tu tarjeta",
    texto:
      "Elegís el tipo (sellos, puntos, cupón…), ponés tus colores y tu logo, y decidís qué se gana. La vas viendo en el teléfono mientras la armás.",
    detalle: "Cinco pasos · sin diseñador",
  },
  {
    titulo: "La compartís",
    texto:
      "Imprimís el póster para tu mostrador o mandás el link por WhatsApp. Quien lo abre agrega la tarjeta a su Wallet y queda afiliado solo.",
    detalle: "QR y link · sin app que instalar",
  },
  {
    titulo: "Sellás y ellos vuelven",
    texto:
      "En cada visita escaneás su código desde el panel. El sello entra y la tarjeta se actualiza sola en su teléfono.",
    detalle: "Un escaneo · el saldo lo lleva el sistema",
  },
];

/** Los cuatro que pide el rediseño, con contenido real de contenido-tipos.ts. */
const SOLUCIONES: { tipo: keyof typeof FICHAS }[] = [
  { tipo: "sellos" },
  { tipo: "puntos" },
  { tipo: "cupon" },
  { tipo: "membresia" },
];

const PLAN_ARRANQUE = PLANES.arranque;

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
      "Sí — el plan Prueba dura 14 días, no pide tarjeta de crédito y alcanza para armar tu primera tarjeta y probarla con clientes reales.",
  },
  {
    pregunta: "¿Cómo se paga?",
    respuesta:
      "Por SINPE Móvil o transferencia: adjuntás el comprobante con tu solicitud y Bookea activa el programa.",
  },
];

export default function LealtadPage() {
  return (
    <main className="min-h-svh bg-white">
      <RevealOnScroll />
      <NavLealtad />
      <BurbujaContacto />

      {/* ================= HERO (navy) ================= */}
      <section
        data-tema="oscuro"
        className="relative overflow-hidden pb-16 pt-14 sm:pb-24 sm:pt-20"
        style={{ background: NAVY_PROFUNDO, color: "#ffffff" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-[18%] top-[26%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-[140px]"
          style={{ background: NARANJA }}
        />

        <div className="relative mx-auto w-[min(1180px,92vw)] py-6">
          <div className="mx-auto max-w-[790px] text-center">
            <p
              className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em]"
              style={{ color: "#ffb98c" }}
            >
              ✦ Tarjetas y pases para Apple y Google Wallet
            </p>

            <h1 className="titulo mt-5 text-balance text-[clamp(34px,5.4vw,58px)] leading-[1.03]">
              Hacé que cada visita se convierta en la próxima.
            </h1>

            <p className="mx-auto mt-5 max-w-[58ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-white/60">
              Bookea Lealtad le da a cada cliente una tarjeta en el teléfono —Apple Wallet y
              Google Wallet— que suma sellos o puntos en cada visita y se actualiza sola. Armala
              acá mismo y mirá cómo queda, antes de crear cuenta.
            </p>

            <ul className="mx-auto mt-7 flex max-w-[52ch] flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] font-bold text-white/65">
              {["Primera tarjeta gratis", "Sin apps que instalar", "Sin tarjeta de crédito"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span aria-hidden style={{ color: NARANJA }}>
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12">
            <ConfiguradorLealtad />
          </div>

          <div className="mt-8 flex flex-col items-center gap-2 text-center">
            <a
              href="#como-funciona"
              className="presionable rounded-full border border-white/25 px-6 py-3 text-[13.5px] font-bold text-white/90"
            >
              Ver cómo funciona
            </a>
            <p className="mt-2 text-[13px] text-white/40">
              ¿Ya tenés el programa?{" "}
              <Link
                href="/cuenta?volver=lealtad"
                className="font-bold underline transition-colors hover:text-white/80"
                style={{ color: NARANJA }}
              >
                Entrá acá
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ================= COMPATIBILIDAD (claro) ================= */}
      <section className="px-5 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center justify-between gap-4 rounded-2xl border border-aventurea-line bg-white px-6 py-5 shadow-[0_16px_38px_-28px_rgba(16,47,82,0.3)] sm:flex-row">
          <p className="text-[13px] font-extrabold text-aventurea-navy">
            Una tarjeta. Dos wallets. Cero aplicaciones nuevas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] font-bold text-aventurea-ink-soft">
            <span> Apple Wallet</span>
            <span>◉ Google Wallet</span>
            <span>▦ Código QR</span>
          </div>
        </div>
      </section>

      {/* ================= CÓMO FUNCIONA (claro) ================= */}
      <section id="como-funciona" className="scroll-mt-16 px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-aventurea-orange">
              Así funciona
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08] text-aventurea-navy">
              En diez minutos tenés tu tarjeta andando
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Sin diseñador, sin desarrollador y sin que tus clientes instalen nada.
            </p>
          </div>

          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li
                key={p.titulo}
                data-reveal
                className="rounded-3xl border border-aventurea-line bg-white p-6 shadow-[0_10px_28px_-20px_rgba(22,41,94,0.4)]"
                style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-[15px] font-extrabold"
                  style={{ background: NARANJA, color: "#0a1226" }}
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[18px] font-extrabold leading-tight text-aventurea-navy">
                  {p.titulo}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">{p.texto}</p>
                <p className="mt-4 text-[12px] font-bold text-aventurea-orange">{p.detalle}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= MOCKUP 2: el recorrido de una visita ================= */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-aventurea-orange">
              En el mostrador
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[22ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08] text-aventurea-navy">
              Así se registra cada visita
            </h2>
          </div>

          <div data-reveal className="mt-12">
            <MockupRecorrido />
          </div>
        </div>
      </section>

      {/* ================= SOLUCIONES (claro, tinte) ================= */}
      <section id="soluciones" className="scroll-mt-16 bg-aventurea-sky-light/40 px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-aventurea-orange">
              Soluciones
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(30px,5vw,54px)] leading-[1.06] text-aventurea-navy">
              Elegí qué guardan en el teléfono
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUCIONES.map(({ tipo }, i) => {
              const def = TIPOS_TARJETA[tipo];
              const ficha = FICHAS[tipo];
              return (
                <div
                  key={tipo}
                  data-reveal
                  className="rounded-3xl border border-aventurea-line bg-white p-6"
                  style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
                >
                  <span
                    className="grid h-11 w-11 place-items-center rounded-2xl"
                    style={{ background: "var(--color-aventurea-orange-light)", color: NARANJA }}
                  >
                    <Icono nombre={def.icono as NombreIcono} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[16px] font-extrabold text-aventurea-navy">{def.nombre}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-aventurea-ink-soft">
                    {def.descripcion}
                  </p>
                  <p className="mt-3 text-[11.5px] font-bold text-aventurea-ink-soft/80">
                    {ficha.paraQuien}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= BENEFICIOS Y PLANES (navy) ================= */}
      <section id="planes" data-tema="oscuro" className="scroll-mt-16 px-5 py-24 sm:px-8" style={{ background: NAVY }}>
        <div className="mx-auto w-full max-w-[1020px]">
          <div data-reveal className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
                Beneficios y planes
              </p>
              <h2 className="titulo mt-4 max-w-[16ch] text-[clamp(28px,4.4vw,44px)] leading-[1.08] text-white">
                Empezá pequeño y crecé cuando lo necesités.
              </h2>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/60">
                Probalo gratis 14 días, sin tarjeta de crédito. Cuando tu programa crezca, subís
                de paquete — nunca antes.
              </p>

              <p className="mt-6 text-[26px] font-extrabold text-white">
                Desde {precioDe(PLAN_ARRANQUE)}
                <span className="text-[14px] font-bold text-white/50"> / mes</span>
              </p>

              <Link
                href="/lealtad/planes"
                className="presionable mt-6 inline-block rounded-full px-7 py-3.5 text-[14px] font-extrabold"
                style={{ background: NARANJA, color: "#0a1226" }}
              >
                Ver planes
              </Link>
            </div>

            <ul className="grid gap-3.5">
              {(
                ["wallet", "personalizacion_tarjeta", "poster_qr", "modo_mostrador"] as const
              ).map((c) => (
                <li key={c} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                    style={{ background: "rgba(255,255,255,.08)" }}
                  >
                    <Icono nombre="listo" className="h-3.5 w-3.5 text-white" />
                  </span>
                  <span className="text-[14px] leading-relaxed text-white/80">
                    {ETIQUETAS_CAPACIDAD[c]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= FAQ (claro) ================= */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[760px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-aventurea-orange">
              Preguntas frecuentes
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(28px,4.4vw,44px)] leading-[1.08] text-aventurea-navy">
              Lo que preguntan antes de empezar
            </h2>
          </div>

          <div data-reveal className="mt-10 divide-y divide-aventurea-line rounded-3xl border border-aventurea-line bg-white">
            {FAQ.map((f) => (
              <details key={f.pregunta} className="group p-5 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] font-extrabold text-aventurea-navy marker:content-none">
                  {f.pregunta}
                  <span
                    aria-hidden
                    className="shrink-0 text-[18px] font-bold text-aventurea-orange transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {f.respuesta}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CIERRE (navy) ================= */}
      <section data-tema="oscuro" className="px-5 py-28 text-center sm:px-8" style={{ background: NAVY_PROFUNDO }}>
        <div data-reveal className="mx-auto w-full max-w-[760px]">
          <h2 className="titulo text-[clamp(32px,5.6vw,64px)] leading-[1.04] text-white">
            Tu competencia reparte tarjetas de cartón.
            <br />
            Vos, sellos en el teléfono.
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/60">
            Contanos de tu negocio y armamos tu programa — sin contratos, sin permanencia mínima.
          </p>
          <Link
            href="/lealtad/nuevo"
            className="presionable mt-9 inline-block rounded-full px-9 py-4 text-[15px] font-bold transition-transform hover:scale-[1.03]"
            style={{ background: NARANJA, color: "#0a1226" }}
          >
            Crear mi programa gratis
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
