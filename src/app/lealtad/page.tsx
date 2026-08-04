import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import EscenaSellos from "./escena-sellos";
import EscenaDescuentos from "./escena-descuentos";
import HeroTelefono from "./hero-telefono";

/**
 * /lealtad — rediseño completo con la misma línea que /invitaciones:
 * fondo navy de punta a punta, tipografía grande tipo Apple, sin el
 * header/footer del sitio (misma landing inmersiva, sin chrome), y
 * DOS escenas animadas en loop (100% CSS, cero JavaScript) en vez de
 * la tarjeta de sellos estática que había antes — ver
 * escena-sellos.tsx y escena-descuentos.tsx, que calcan el mecanismo
 * de Reel.tsx pero con su propio prefijo de clases/variables para no
 * chocar entre sí ni con `invitacion-*`.
 *
 * Los precios son de lanzamiento; el motor real vive en la migración
 * 0060 (programa_lealtad, ledger de puntos, pases).
 */

const NAVY_PROFUNDO = "#0a1226";
const NAVY = "#16295e";
const NARANJA = "#ee7420";

export const metadata: Metadata = {
  title: "Lealtad",
  description:
    "Sellos y puntos digitales para tu negocio: tarjeta en el teléfono, descuentos al instante y todo conectado a tus reservas y citas de Bookea.",
};

const PLANES: {
  nombre: string;
  precio: string;
  detalle: string;
  incluye: string[];
  destacado?: boolean;
}[] = [
  {
    nombre: "Para empezar",
    precio: "Gratis",
    detalle: "Probalo con tus clientes de siempre",
    incluye: [
      "Tarjeta digital de sellos",
      "Hasta 50 clientes afiliados",
      "1 recompensa activa",
      "Canje con QR en el local",
    ],
  },
  {
    nombre: "Lealtad",
    precio: "₡12 900",
    detalle: "por mes · precio de lanzamiento",
    incluye: [
      "Clientes y sellos ilimitados",
      "Tarjeta en Apple Wallet y Google Wallet",
      "Puntos por visita o por monto",
      "Catálogo de recompensas ilimitado",
      "El pase se actualiza solo al sumar puntos",
    ],
    destacado: true,
  },
  {
    nombre: "Pro",
    precio: "₡24 900",
    detalle: "por mes · para multi-sucursal",
    incluye: [
      "Todo lo del plan Lealtad",
      "Varias sucursales, un solo programa",
      "Paquetes de membresía de pago",
      "Reportes de visitas y canjes",
      "Acompañamiento para arrancar",
    ],
  },
];

const NEGOCIOS = [
  "Restaurantes",
  "Cafeterías",
  "Sodas",
  "Barberías",
  "Salones de belleza",
  "Spas",
  "Gimnasios",
  "Lavacars",
];

const VERTICALES = [
  {
    titulo: "Restaurantes y cafés",
    texto:
      "Un sello por visita, o puntos por lo que gastan. La tarjeta vive en su teléfono, no en una libretita de cartón que se pierde.",
  },
  {
    titulo: "Citas y Servicios",
    texto:
      "Barberías, salones, spas: cada turno que atendés por la agenda de Citas puede sumar solo, sin afiliar a nadie aparte — el cliente ya está en Bookea.",
  },
  {
    titulo: "Lugares para eventos",
    texto:
      "Quien ya reservó tu rancho o salón una vez, vuelve con puntos acumulados para el próximo — sin que tengas que acordarte vos de ofrecérselo.",
  },
];

/** Un cheque simple, en la línea de invitaciones/card-paquete.tsx. */
function Check({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LealtadPage() {
  return (
    <main className="min-h-svh" style={{ background: NAVY_PROFUNDO, color: "#ffffff" }}>
      <RevealOnScroll />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden pb-14 pt-16 sm:pb-20 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[30%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.18] blur-[130px]"
          style={{ background: NARANJA }}
        />

        <div className="relative mx-auto w-[min(1120px,92vw)] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
            Bookea Lealtad
          </p>
          <h1 className="titulo mx-auto mt-5 max-w-[18ch] text-balance text-[clamp(32px,5.6vw,58px)] leading-[1.05]">
            Que tus clientes vuelvan — y lo sientan.
          </h1>
          <p className="mx-auto mt-4 max-w-[48ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-white/60">
            El pase vive de verdad en el teléfono de tu cliente. Mirá:
          </p>

          <div className="relative mt-10 sm:mt-12" data-reveal>
            <HeroTelefono />
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-[12.5px] font-bold text-white/45">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            y
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M21.35 11.1h-9.17v2.73h5.24c-.23 1.42-1.63 4.17-5.24 4.17-3.16 0-5.73-2.61-5.73-5.83s2.57-5.83 5.73-5.83c1.8 0 3 .77 3.69 1.43l2.52-2.43C16.83 3.6 14.68 2.7 12.18 2.7c-5.13 0-9.29 4.16-9.29 9.29s4.16 9.29 9.29 9.29c5.36 0 8.92-3.77 8.92-9.08 0-.61-.07-1.08-.15-1.55z" />
            </svg>
            Apple Wallet y Google Wallet — el mismo pase, sin apps que instalar
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#precios"
              className="rounded-full px-7 py-3.5 text-[14.5px] font-bold text-white transition-transform hover:scale-[1.03]"
              style={{ background: NARANJA }}
            >
              Ver precios
            </Link>
            <Link
              href="/mi-negocio/nuevo"
              className="rounded-full border border-white/25 px-7 py-3.5 text-[14.5px] font-bold text-white/90 transition-colors hover:border-white/60"
            >
              Quiero el programa en mi negocio
            </Link>
          </div>
        </div>
      </section>

      {/* ================= ESCENA 1: SELLOS ================= */}
      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto w-[min(1120px,92vw)]">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <div data-reveal>
              <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
                En vivo, ahora mismo
              </p>
              <h2 className="titulo mt-4 max-w-[17ch] text-[clamp(30px,4.6vw,50px)] leading-[1.08]">
                Una tarjeta de sellos que se completa sola
              </h2>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/55">
                Esto no es un dibujo: es lo que ve tu cliente en su teléfono y
                lo que ves vos en tu panel, al mismo tiempo.
              </p>

              <div className="mt-9 flex flex-col gap-6">
                {[
                  {
                    titulo: "Se afilia con un QR",
                    texto: "Lo escanea una sola vez y su tarjeta queda en el teléfono — sin descargar nada.",
                  },
                  {
                    titulo: "Suma un sello en cada visita",
                    texto: "Vos decidís las reglas (por visita o por monto) y el sistema lleva la cuenta solo.",
                  },
                  {
                    titulo: "Se desbloquea y canjea",
                    texto: "Al completar la tarjeta, canjea su premio con el mismo QR — y arranca de nuevo.",
                  },
                ].map((p, i) => (
                  <div key={p.titulo} className="flex gap-4">
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                      style={{ background: NARANJA }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-[16px] font-extrabold text-white">{p.titulo}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">{p.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div data-reveal style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
              <EscenaSellos />
            </div>
          </div>
        </div>
      </section>

      {/* ================= ESCENA 2: DESCUENTOS Y PUNTOS ================= */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-24" style={{ background: NAVY }}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-1/4 h-[420px] w-[420px] rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: NARANJA }}
        />
        <div className="relative mx-auto w-[min(1120px,92vw)]">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div data-reveal className="order-2 lg:order-1">
              <EscenaDescuentos />
            </div>

            <div data-reveal className="order-1 lg:order-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
                Sin canjear en caja
              </p>
              <h2 className="titulo mt-4 max-w-[17ch] text-[clamp(30px,4.6vw,50px)] leading-[1.08]">
                El descuento se aplica al toque, no se pide
              </h2>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/55">
                Nada de anotar puntos a mano ni de que el cliente tenga que
                acordarse de pedirlo: aparece solo cuando le conviene.
              </p>

              <div className="mt-9 flex flex-col gap-6">
                {[
                  {
                    titulo: "Puntos que se ven de una",
                    texto: "El cliente ve cuánto tiene disponible apenas abre su tarjeta, sin preguntar.",
                  },
                  {
                    titulo: "Un toque y baja el total",
                    texto: "Usa sus puntos y el precio se actualiza en el momento — vos solo cobrás lo que queda.",
                  },
                  {
                    titulo: "Vos ves todo en tu panel",
                    texto: "Cuántos clientes canjearon hoy, cuánto representó en descuentos, quién fue.",
                  },
                ].map((p, i) => (
                  <div key={p.titulo} className="flex gap-4">
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                      style={{ background: NARANJA }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-[16px] font-extrabold text-white">{p.titulo}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">{p.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TAMBIÉN PARA CITAS Y SERVICIOS ================= */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto w-[min(1120px,92vw)]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              No es solo para restaurantes
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Un solo programa para todo lo que hacés en Bookea
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Lealtad no vive aparte del resto de la plataforma: se conecta
              con las Citas, las reservas y los pedidos que ya pasan por tu
              cuenta.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {VERTICALES.map((v, i) => (
              <div
                key={v.titulo}
                data-reveal
                className="rounded-3xl border border-white/12 p-6"
                style={
                  {
                    background: "rgba(255,255,255,.04)",
                    "--reveal-delay": `${i * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <h3 className="text-[16.5px] font-extrabold text-white">{v.titulo}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/55">{v.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PARA QUIÉN ================= */}
      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto w-[min(1120px,92vw)] text-center">
          <p data-reveal className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
            Hecho para negocios con clientela que vuelve
          </p>
          <div data-reveal className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {NEGOCIOS.map((n) => (
              <span
                key={n}
                className="rounded-xl border border-white/15 px-4 py-2 text-[13px] font-bold text-white/80"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRECIOS ================= */}
      <section id="precios" className="scroll-mt-8 px-5 py-24 sm:px-8" style={{ background: NAVY }}>
        <div className="mx-auto w-[min(1120px,92vw)]">
          <div data-reveal className="text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Precios de lanzamiento
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Menos que un combo al mes.
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Sin contratos ni permanencia mínima. Y si además tomás reservas
              o citas con Bookea, todo vive en el mismo panel.
            </p>
          </div>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {PLANES.map((plan) => (
              <div
                key={plan.nombre}
                data-reveal
                className={`flex flex-col rounded-3xl border p-7 ${plan.destacado ? "" : "border-white/12"}`}
                style={{
                  background: plan.destacado ? NAVY_PROFUNDO : "rgba(255,255,255,.04)",
                  borderColor: plan.destacado ? NARANJA : undefined,
                }}
              >
                <p
                  className="text-[12px] font-extrabold uppercase tracking-wide"
                  style={{ color: plan.destacado ? NARANJA : "rgba(255,255,255,.55)" }}
                >
                  {plan.nombre}
                </p>
                <p className="titulo mt-2 text-[36px] leading-none tracking-tight text-white">
                  {plan.precio}
                </p>
                <p className="mt-1.5 text-[12.5px] text-white/50">{plan.detalle}</p>

                <ul className="mt-6 flex flex-col gap-2.5">
                  {plan.incluye.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                      <span
                        className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: "rgba(238,116,32,.18)", color: NARANJA }}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      <span className="text-white/80">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/mi-negocio/nuevo"
                  className={`mt-7 flex h-11 items-center justify-center rounded-full text-[14px] font-bold transition-transform hover:scale-[1.02] ${
                    plan.destacado ? "text-white" : "border border-white/25 text-white"
                  }`}
                  style={plan.destacado ? { background: NARANJA } : undefined}
                >
                  Empezar con {plan.nombre === "Para empezar" ? "el plan gratis" : plan.nombre}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-[12px] text-white/40">
            Los pases de Apple Wallet y Google Wallet están en fase de
            habilitación — los primeros negocios en afiliarse los estrenan.
          </p>
        </div>
      </section>

      {/* ================= CIERRE ================= */}
      <section className="px-5 py-28 text-center sm:px-8">
        <div data-reveal className="mx-auto w-[min(760px,92vw)]">
          <h2 className="titulo text-[clamp(32px,5.6vw,64px)] leading-[1.04]">
            Tu competencia reparte tarjetas de cartón.
            <br />
            Vos, sellos en el teléfono.
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/60">
            Contanos de tu negocio y armamos tu programa — sin contratos, sin
            permanencia mínima.
          </p>
          <Link
            href="/mi-negocio/nuevo"
            className="mt-9 inline-block rounded-full px-9 py-4 text-[15px] font-bold text-white transition-transform hover:scale-[1.03]"
            style={{ background: NARANJA }}
          >
            Quiero mi programa de lealtad
          </Link>
        </div>
      </section>
    </main>
  );
}
