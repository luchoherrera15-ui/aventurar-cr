import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  ETIQUETAS_CAPACIDAD,
  PLANES as PLANES_REALES,
  PLANES_ID,
} from "@/lib/lealtad/planes";
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
 * Los paquetes salen de src/lib/lealtad/planes.ts (la misma fuente que
 * /lealtad/planes); el motor real vive en la migración 0060
 * (programa_lealtad, ledger de puntos, pases).
 */

const NAVY_PROFUNDO = "#0a1226";
const NAVY = "#16295e";
const NARANJA = "#ee7420";

export const metadata: Metadata = {
  title: "Lealtad",
  description:
    "Sellos y puntos digitales para tu negocio: tarjeta en el teléfono, descuentos al instante y todo conectado a tus reservas y citas de Bookea.",
};

/**
 * Los paquetes REALES, derivados de la única fuente de verdad
 * (src/lib/lealtad/planes.ts, 0124): Básico / Estándar / Enterprise.
 * Antes acá vivía una lista inventada con otros nombres y precios —
 * la landing prometía una cosa y la plataforma vendía otra.
 */
const PAQUETES = PLANES_ID.map((id) => {
  const def = PLANES_REALES[id];
  return {
    id,
    nombre: def.nombre,
    limite: def.limiteMiembros,
    precio: def.precioMensual,
    incluye: def.capacidades.map((c) => ETIQUETAS_CAPACIDAD[c]),
    destacado: id === "enterprise",
  };
});

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

/**
 * El catálogo de la familia de pases: cada producto que puede vivir
 * como tarjeta en el Wallet del cliente. La lealtad y los paquetes de
 * membresía (0120) ya existen en la plataforma; el resto es el mapa de
 * lo que la familia ofrece — por eso cada card lleva su categoría de
 * negocio (retención, reactivación…) en vez de un precio.
 */
const PRODUCTOS_PASE: {
  titulo: string;
  texto: string;
  chip: string;
  icono: React.ReactNode;
}[] = [
  {
    titulo: "Pase de confirmación de cita",
    texto:
      "Cada reserva o cita genera su pase con fecha, hora y ubicación. Recordatorios en la pantalla del teléfono, sin que tengás que mover un dedo.",
    chip: "Citas y reservas",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    titulo: "Tarjetas de lealtad digitales",
    texto:
      "El clásico «10 sellos y el 11 gratis», pero digital: se sella solo con cada visita, sin cartón que se pierde ni que se olvide traer al cliente.",
    chip: "Retención",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="16" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    titulo: "Gift cards digitales",
    texto:
      "Tarjetas de regalo que se compran dentro de Bookea y se guardan directo en el Wallet de quien las recibe, listas para usarse en cualquier visita.",
    chip: "Nuevo ingreso",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M3 12h18M12 8v13M12 8c-2.5 0-4.5-1.5-4.5-3.2C7.5 3.2 9 2.5 10.2 3c1.5.6 1.8 3 1.8 5zm0 0c2.5 0 4.5-1.5 4.5-3.2 0-1.6-1.5-2.3-2.7-1.8-1.5.6-1.8 3-1.8 5z" />
      </svg>
    ),
  },
  {
    titulo: "Paquetes prepagados",
    texto:
      "«5 masajes», «10 clases», «manicure x4». El pase muestra el saldo restante y se descuenta solo en cada visita — la caja entra por adelantado.",
    chip: "Caja anticipada",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
        <path d="M3 8l9 5 9-5M12 13v8" />
      </svg>
    ),
  },
  {
    titulo: "Membresías",
    texto:
      "Acceso ilimitado o precio de socio, con la fecha de renovación visible en el pase — como un carnet, pero que nunca se olvida en casa.",
    chip: "Ingreso recurrente",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="11" r="2.2" />
        <path d="M5.5 17c.8-1.8 2-2.6 3.5-2.6s2.7.8 3.5 2.6M15 9h4M15 13h4" />
      </svg>
    ),
  },
  {
    titulo: "Pases VIP / prioridad",
    texto:
      "Para tus clientes de más valor: otro color, otro diseño, y beneficios reales como prioridad de horario o un descuento fijo.",
    chip: "Segmentación",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5l2.9 5.9 6.6 1-4.7 4.6 1.1 6.5-5.9-3.1-5.9 3.1 1.1-6.5L2.5 9.4l6.6-1z" />
      </svg>
    ),
  },
  {
    titulo: "Cupones y promos con vencimiento",
    texto:
      "«Hace 30 días no venís — tenés 15% off»: entregado como pase con fecha límite, no como un código que se pierde en un chat.",
    chip: "Reactivación",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8z" />
        <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    ),
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
          {/* El ataque: la promesa es CRECER la clientela — el triple
              beneficio en el orden en que el dueño lo siente. La
              animación de al lado lo dibuja: el contador sube y los
              avisos caen. */}
          <h1 className="titulo mx-auto mt-5 max-w-[16ch] text-balance text-[clamp(34px,5.8vw,62px)] leading-[1.04]">
            Más clientes. Más visitas. Más ventas.
          </h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-white/60">
            El programa de lealtad que vive en el teléfono: tus clientes
            acumulan sellos, vuelven más seguido — y te traen al siguiente.
          </p>

          <div className="relative mt-10 sm:mt-12" data-reveal>
            <HeroTelefono />
          </div>

          {/* Cómo funciona, en una línea de tres pasos — la versión
              breve; el detalle vive en las escenas de más abajo. */}
          <div className="mx-auto mt-10 grid max-w-[760px] gap-3 text-left sm:grid-cols-3">
            {[
              ["1", "Ponés el QR en tu mostrador", "El cliente lo escanea una vez y la tarjeta queda en su Wallet."],
              ["2", "Cada visita suma sola", "Sellos o puntos, con tus reglas — el pase se actualiza al instante."],
              ["3", "Canjean… y vuelven", "El premio los trae de vuelta, y la tarjeta se los recuerda a diario."],
            ].map(([n, titulo, texto]) => (
              <div
                key={n}
                data-reveal
                className="rounded-2xl border border-white/12 p-4"
                style={{ background: "rgba(255,255,255,.04)" }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                  style={{ background: NARANJA }}
                >
                  {n}
                </span>
                <p className="mt-2.5 text-[13.5px] font-extrabold text-white">{titulo}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{texto}</p>
              </div>
            ))}
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
              href="/lealtad/nuevo"
              className="rounded-full border border-white/25 px-7 py-3.5 text-[14.5px] font-bold text-white/90 transition-colors hover:border-white/60"
            >
              Quiero el programa en mi negocio
            </Link>
          </div>

          {/* Para quien YA lo tiene. Sin esto la landing solo habla con
              el que todavía no compró, y el que ya pagó tiene que
              adivinar por dónde entra. */}
          <p className="mt-5 text-[13px] text-white/45">
            ¿Ya tenés el programa?{" "}
            <Link
              href="/lealtad/login"
              className="font-bold underline transition-colors hover:text-white/80"
              style={{ color: NARANJA }}
            >
              Entrá acá
            </Link>
          </p>
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

      {/* ================= LA FAMILIA DE PASES ================= */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto w-[min(1120px,92vw)]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Más que sellos
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Cada producto, un pase en el teléfono
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Sin apps extra y sin papel: cada tarjeta vive en el Wallet de tu
              cliente y se actualiza sola cada vez que reserva, compra o
              visita tu negocio.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTOS_PASE.map((p, i) => (
              <div
                key={p.titulo}
                data-reveal
                className="flex flex-col rounded-3xl border border-white/12 p-6"
                style={
                  {
                    background: "rgba(255,255,255,.04)",
                    "--reveal-delay": `${(i % 3) * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5"
                  style={{ background: "rgba(238,116,32,.14)", color: NARANJA }}
                >
                  {p.icono}
                </span>
                <h3 className="mt-4 text-[16.5px] font-extrabold text-white">{p.titulo}</h3>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-white/55">
                  {p.texto}
                </p>
                <span
                  className="mt-4 self-start rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide"
                  style={{ background: "rgba(238,116,32,.14)", color: NARANJA }}
                >
                  {p.chip}
                </span>
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

      {/* ================= PAQUETES ================= */}
      <section id="precios" className="scroll-mt-8 px-5 py-24 sm:px-8" style={{ background: NAVY }}>
        <div className="mx-auto w-[min(1120px,92vw)]">
          <div data-reveal className="text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Paquetes
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Elegí el tamaño de tu programa.
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Dejás la solicitud con tu depósito y el equipo de Bookea genera el
              programa y la tarjeta por vos — con tus colores, tu logo y tu regalía.
            </p>
          </div>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {PAQUETES.map((plan) => (
              <div
                key={plan.id}
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
                  {plan.destacado ? "El más completo" : "Paquete"}
                </p>
                <p className="titulo mt-2 text-[36px] leading-none tracking-tight text-white">
                  {plan.nombre}
                </p>
                {plan.precio !== null && (
                  <p className="mt-2 text-[22px] font-extrabold leading-none text-white">
                    ₡{plan.precio.toLocaleString("es-CR")}
                    <span className="text-[13px] font-bold text-white/50"> /mes</span>
                  </p>
                )}
                <p className="mt-1.5 text-[12.5px] text-white/50">
                  Hasta {plan.limite === null ? "miembros ilimitados" : `${plan.limite.toLocaleString("es-CR")} miembros`}
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
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
                  href="/lealtad/planes"
                  className={`mt-7 flex h-11 items-center justify-center rounded-full text-[14px] font-bold transition-transform hover:scale-[1.02] ${
                    plan.destacado ? "text-white" : "border border-white/25 text-white"
                  }`}
                  style={plan.destacado ? { background: NARANJA } : undefined}
                >
                  Solicitar {plan.nombre}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-[12px] text-white/40">
            El pago es por SINPE Móvil o transferencia: adjuntás el comprobante
            con la solicitud y Bookea activa tu programa.
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
