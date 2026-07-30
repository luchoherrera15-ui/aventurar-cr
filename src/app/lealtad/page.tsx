import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconCheck, IconHeart, IconSparkles, IconStar } from "@/components/icons";

export const metadata: Metadata = {
  title: "Lealtad — el programa de clientes frecuentes de Bookea",
  description:
    "Sellos y puntos digitales para tu restaurante, café o salón: tarjeta en Apple Wallet y Google Wallet, canjes con QR y todo conectado a tus reservas.",
};

/**
 * La landing del producto de lealtad (bookea.lat/lealtad): Bookea
 * como proveedor del programa de clientes frecuentes para
 * restaurantes, cafés, salones y todo negocio con clientela que
 * vuelve. Misma línea bento de /publicar — bloques de color con
 * esquinas redondas sobre lienzo crema — y la tarjeta de sellos como
 * protagonista. Los precios son de lanzamiento; el motor real vive en
 * la migración 0060 (programa_lealtad, ledger de puntos, pases).
 */

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

export default function LealtadPage() {
  return (
    // El mismo lienzo crema de /publicar: los bloques bento encima.
    <div className="min-h-screen bg-aventurea-cream-2">
      <RevealOnScroll />
      <SiteHeader ancho="max-w-[1200px]" />

      {/* ---------- Hero bento ---------- */}
      <section className="px-4 pb-2 pt-6 lg:px-10">
        <div className="mx-auto grid max-w-[1200px] gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div
            data-reveal
            className="relative isolate overflow-hidden rounded-[32px] bg-aventurea-navy p-8 sm:p-12"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-aventurea-navy-3/60 blur-2xl"
            />
            <span className="inline-flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
              <IconSparkles className="h-3.5 w-3.5" />
              Bookea Lealtad
            </span>
            <h1 className="titulo mt-5 max-w-[15ch] text-balance text-[38px] text-white sm:text-[52px]">
              Que tus clientes vuelvan — y lo sientan
            </h1>
            <p className="mt-5 max-w-[46ch] text-balance text-[15.5px] leading-relaxed text-white/80 sm:text-[17px]">
              El programa de clientes frecuentes para tu restaurante, café o
              salón: sellos y puntos digitales, la tarjeta vive en el
              teléfono, y el canje es un escaneo de QR en el local.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/mi-rancho/nuevo"
                className="rounded-full bg-aventurea-orange px-7 py-3.5 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-orange-dark"
              >
                Quiero el programa en mi negocio
              </Link>
              <a
                href="#precios"
                className="rounded-full bg-white px-7 py-3.5 text-[14.5px] font-bold text-aventurea-navy transition-colors hover:bg-white/90"
              >
                Ver precios
              </a>
            </div>
          </div>

          {/* La tarjeta de sellos, protagonista del collage. */}
          <div className="grid gap-4">
            <div
              data-reveal
              style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
              className="relative overflow-hidden rounded-[32px] bg-aventurea-orange p-7"
            >
              {/* Mock de la tarjeta en el Wallet, flotando suave. */}
              <div className="anim-publicar-flotar mx-auto w-[260px] rounded-2xl bg-white p-4 shadow-[0_24px_50px_-18px_rgba(6,12,32,0.5)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-extrabold text-aventurea-navy">
                    Café La Esquina
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo estático */}
                  <img src="/icono-bookea.png" alt="" aria-hidden className="h-5 w-5" />
                </div>
                <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Cliente frecuente
                </p>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={`flex aspect-square items-center justify-center rounded-full text-[11px] ${
                        i < 7
                          ? "bg-aventurea-orange text-white"
                          : "border-2 border-dashed border-aventurea-line text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11px] font-bold text-aventurea-ink">
                  7 de 10 sellos —{" "}
                  <span className="text-aventurea-orange">
                    ¡te faltan 3 para tu café gratis!
                  </span>
                </p>
              </div>
              <p className="mt-5 text-center text-[13px] font-extrabold text-white">
                La tarjeta vive en Apple Wallet y Google Wallet
              </p>
            </div>
            <div
              data-reveal
              style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
              className="flex items-center gap-4 rounded-[32px] border border-aventurea-line bg-white p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aventurea-blue-light text-aventurea-navy">
                <IconHeart className="h-6 w-6" />
              </span>
              <p className="text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                <strong className="text-aventurea-ink">
                  Se actualiza solo:
                </strong>{" "}
                el cliente suma puntos y su tarjeta cambia en el teléfono al
                instante — sin apps que instalar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Cómo funciona — bloque azul ---------- */}
      <section className="mx-4 my-4 max-w-[1200px] overflow-hidden rounded-[32px] bg-aventurea-blue-light py-14 lg:mx-auto">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
          <div data-reveal className="text-center">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-navy">
              Así de simple
            </p>
            <h2 className="titulo mt-2 text-[28px] text-aventurea-ink sm:text-[34px]">
              Tres pasos y la clientela vuelve
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                paso: "1",
                titulo: "El cliente se afilia",
                texto:
                  "Escanea tu QR una sola vez y su tarjeta queda en el Wallet del teléfono — sin descargar nada.",
              },
              {
                paso: "2",
                titulo: "Suma en cada visita",
                texto:
                  "Un sello por visita o puntos por monto — vos decidís las reglas y el sistema lleva la cuenta.",
              },
              {
                paso: "3",
                titulo: "Canjea y vuelve",
                texto:
                  "Al completar, canjea su premio con el QR en el local. Y la tarjeta arranca de nuevo.",
              },
            ].map((p, i) => (
              <div
                key={p.paso}
                data-reveal
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                className="rounded-3xl bg-white p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-aventurea-navy text-[16px] font-extrabold text-white">
                  {p.paso}
                </span>
                <h3 className="mt-4 text-[16.5px] font-extrabold text-aventurea-ink">
                  {p.titulo}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {p.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Para quién ---------- */}
      <section className="py-12">
        <div className="mx-auto max-w-[1100px] px-6 text-center lg:px-10">
          <p data-reveal className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-orange">
            Hecho para negocios con clientela que vuelve
          </p>
          <div data-reveal className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {NEGOCIOS.map((n) => (
              <span
                key={n}
                className="rounded-full border border-aventurea-line bg-white px-4 py-2 text-[13px] font-bold text-aventurea-ink"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Precios — bloques bento ---------- */}
      <section id="precios" className="mx-4 my-4 max-w-[1200px] scroll-mt-24 overflow-hidden rounded-[32px] border border-aventurea-line bg-white py-14 lg:mx-auto">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
          <div data-reveal className="text-center">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-orange">
              Precios de lanzamiento
            </p>
            <h2 className="titulo mt-2 text-[28px] text-aventurea-ink sm:text-[34px]">
              Menos que un combo al mes
            </h2>
            <p className="mx-auto mt-2.5 max-w-[52ch] text-[14.5px] text-aventurea-ink-soft">
              Sin contratos ni permanencia mínima. Y si además tomás reservas
              con Bookea, todo vive en el mismo panel.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {PLANES.map((plan, i) => (
              <div
                key={plan.nombre}
                data-reveal
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                className={`flex flex-col rounded-3xl p-7 ${
                  plan.destacado
                    ? "bg-aventurea-navy text-white shadow-[0_24px_60px_-24px_rgba(22,41,94,0.6)]"
                    : "border border-aventurea-line bg-white"
                }`}
              >
                <p
                  className={`text-[12px] font-extrabold uppercase tracking-wide ${
                    plan.destacado ? "text-aventurea-orange" : "text-aventurea-ink-soft"
                  }`}
                >
                  {plan.nombre}
                </p>
                <p className={`mt-2 text-[34px] font-black tracking-tight ${plan.destacado ? "text-white" : "text-aventurea-ink"}`}>
                  {plan.precio}
                </p>
                <p className={`text-[12.5px] ${plan.destacado ? "text-white/70" : "text-aventurea-ink-soft"}`}>
                  {plan.detalle}
                </p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {plan.incluye.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                      <span
                        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full ${
                          plan.destacado
                            ? "bg-white/15 text-aventurea-orange"
                            : "bg-aventurea-green/15 text-aventurea-green"
                        }`}
                      >
                        <IconCheck className="h-2.5 w-2.5" />
                      </span>
                      <span className={plan.destacado ? "text-white/90" : "text-aventurea-ink"}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/mi-rancho/nuevo"
                  className={`mt-7 flex h-11 items-center justify-center rounded-full text-[14px] font-bold transition-colors ${
                    plan.destacado
                      ? "bg-aventurea-orange text-white hover:bg-aventurea-orange-dark"
                      : "border border-aventurea-navy text-aventurea-navy hover:bg-aventurea-navy hover:text-white"
                  }`}
                >
                  Empezar con {plan.nombre === "Para empezar" ? "el plan gratis" : plan.nombre}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[12px] text-zinc-500">
            Los pases de Apple Wallet y Google Wallet están en fase de
            habilitación — los primeros negocios en afiliarse los estrenan.
          </p>
        </div>
      </section>

      {/* ---------- CTA final — bloque navy ---------- */}
      <section className="px-4 pb-16 pt-4 lg:px-10">
        <div
          data-reveal
          className="relative isolate mx-auto max-w-[1200px] overflow-hidden rounded-[32px] bg-aventurea-navy px-6 py-14 text-center sm:py-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-aventurea-navy-3/60 blur-2xl"
          />
          <p className="flex items-center justify-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
            <IconStar className="h-3.5 w-3.5" /> Bookea Lealtad
          </p>
          <h2 className="titulo mx-auto mt-4 max-w-[22ch] text-balance text-[28px] text-white sm:text-[36px]">
            Tu competencia reparte tarjetas de cartón. Vos, sellos en el
            teléfono.
          </h2>
          <div className="mt-8">
            <Link
              href="/mi-rancho/nuevo"
              className="inline-flex rounded-full bg-aventurea-orange px-8 py-4 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Quiero mi programa de lealtad
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
