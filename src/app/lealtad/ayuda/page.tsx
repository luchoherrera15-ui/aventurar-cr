import type { Metadata } from "next";
import Link from "next/link";
import NavLealtad from "../nav-lealtad";
import HistoriaLealtad, {
  Contador,
  PantallaTarjeta,
  SeccionViva,
  TelefonoMarco,
} from "./historia-lealtad";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /lealtad/ayuda — LA EXPERIENCIA DE PRODUCTO DE BOOKEA LEALTAD
 * ════════════════════════════════════════════════════════════════════
 *
 * Tercera vida de esta página en un mismo día, y esta es la grande: el
 * dueño trajo un encargo completo — «una experiencia tipo página de
 * producto de Apple, no una landing tradicional: el usuario hace
 * scroll y la interfaz va evolucionando, con un teléfono protagonista;
 * la sensación debe ser “estoy viendo Bookea Lealtad funcionar delante
 * de mí”». La narrativa pedida: CREAR → REGISTRAR → PREMIAR →
 * COMUNICAR → HACER VOLVER.
 *
 * ── EL MAPA DE LA PÁGINA ────────────────────────────────────────────
 *
 *   1. HÉROE — titular grande, dos CTA y el teléfono con la tarjeta
 *      «Mi Café» recibiendo un aviso.
 *   2. LA HISTORIA (historia-lealtad.tsx) — la escena sticky de cuatro
 *      fases con el riel de progreso. El cómo técnico vive allá.
 *   3. EL MENSAJE + estrategias por rubro.
 *   4. EL CICLO — descubre → registrate → visitá → recibí → volvé.
 *   5. ANALYTICS — el tablero con contadores y la lista de «necesitan
 *      un empujón» (con su pastilla de EJEMPLO: números de utilería).
 *   6. «NO ES SOLO PUNTOS» — las cinco palabras.
 *   7. EL CIERRE en navy, con el teléfono otra vez.
 *
 * ── LO QUE ESTA PÁGINA NO HACE ──────────────────────────────────────
 *
 * No presume cifras de Bookea (la regla de siempre): los 1.284
 * clientes y María Rodríguez son utilería de mockup, dichos como tal.
 * Y no instala librerías de animación: scroll nativo, transforms y
 * CSS — el porqué de rendimiento está en historia-lealtad.tsx.
 */

export const metadata: Metadata = {
  title: "Bookea Lealtad, en vivo",
  description:
    "Mirá Bookea Lealtad funcionar: creá tu programa, registrá clientes con un QR, premiá desde tu celular y hacelos volver con notificaciones.",
};

const TITULO_SECCION =
  "titulo text-[clamp(26px,3.6vw,44px)] font-extrabold leading-[1.06] text-[#0d1733]";

export default function AyudaLealtadPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <NavLealtad />

      <main className="flex-1">
        {/* ════════════════ EL HÉROE ════════════════ */}
        <section className="mx-auto grid w-full max-w-[1180px] items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="text-center lg:text-left">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#2563eb]">
              Bookea Lealtad
            </p>
            <h1 className="titulo mt-4 text-[clamp(34px,5vw,60px)] font-extrabold leading-[1.02] text-[#0d1733]">
              Convertí clientes
              <br />
              en clientes frecuentes.
            </h1>
            <p className="mx-auto mt-5 max-w-[46ch] text-[16.5px] leading-relaxed text-[#5b6478] lg:mx-0">
              Bookea Lealtad te permite crear, administrar y hacer crecer tu
              programa de fidelización desde un solo lugar.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/lealtad/nuevo"
                className="presionable inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15px] font-extrabold text-white"
                style={{ background: "#16295e" }}
              >
                Crear mi programa <span aria-hidden>→</span>
              </Link>
              <a
                href="#historia"
                className="presionable inline-flex items-center gap-2 rounded-xl border-2 border-[#16295e] px-6 py-3.5 text-[14.5px] font-extrabold text-[#16295e]"
              >
                Ver cómo funciona <span aria-hidden>↓</span>
              </a>
            </div>
            <p className="mt-6 text-[13px] font-bold text-[#8a91a4]">
              Bookea convierte cada visita en una oportunidad para que el
              cliente vuelva.
            </p>
          </div>

          <div className="hl-flotar mx-auto">
            <TelefonoMarco>
              <PantallaTarjeta />
            </TelefonoMarco>
          </div>
        </section>

        {/* ════════════ LA HISTORIA (sticky, 4 fases) ════════════ */}
        <HistoriaLealtad />

        {/* ════════════ EL MENSAJE + ESTRATEGIAS ════════════ */}
        <SeccionViva className="mx-auto w-full max-w-[1080px] px-5 py-20 text-center">
          <h2 className={`${TITULO_SECCION} hl-revelar`}>
            Tu cliente ya está en tu negocio.
            <br />
            Ahora podés volver a hablarle.
          </h2>
          <p className="hl-revelar mx-auto mt-4 max-w-[54ch] text-[15.5px] leading-relaxed text-[#5b6478]">
            Descuentos, promociones, productos nuevos, eventos, recompensas:
            llegan directo a la tarjeta que tus clientes ya tienen en el
            teléfono. Sin números que recolectar, sin listas de difusión.
          </p>

          <p className="hl-revelar mt-14 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#2563eb]">
            ¿No sabés qué estrategia usar?
          </p>
          <h3 className="hl-revelar titulo mt-2 text-[clamp(20px,2.6vw,30px)] font-extrabold text-[#0d1733]">
            Te ayudamos a diseñar la adecuada para tu negocio.
          </h3>
          <div className="hl-revelar mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["☕", "Cafeterías", "10 sellos = café gratis. Simple, visible, adictivo."],
              ["✂️", "Barberías", "Cada 8 cortes, uno va por la casa — y el cliente no cambia de barbero."],
              ["💆", "Spas y salones", "Puntos por cada colón: se canjean por tratamientos."],
            ].map(([emoji, rubro, texto]) => (
              <div
                key={rubro}
                className="rounded-3xl border border-[#e6eaf3] bg-white p-6 text-left shadow-[0_20px_50px_-30px_rgba(13,23,51,0.35)]"
              >
                <p className="text-[26px]">{emoji}</p>
                <p className="mt-2 text-[16px] font-extrabold text-[#0d1733]">{rubro}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5b6478]">{texto}</p>
              </div>
            ))}
          </div>
        </SeccionViva>

        {/* ════════════ EL CICLO BOOKEA ════════════ */}
        <SeccionViva className="bg-[#f7f8fb] py-20">
          <div className="mx-auto grid w-full max-w-[1080px] items-center gap-12 px-5 lg:grid-cols-2">
            {/* El anillo con las cinco estaciones, girando despacio. */}
            <div className="relative mx-auto hidden h-[420px] w-[420px] sm:block" aria-hidden>
              <span className="hl-anillo absolute inset-6 rounded-full border-2 border-dashed border-[#c7cede]" />
              <div className="absolute inset-0 grid place-items-center">
                <div
                  className="w-[190px] rounded-2xl p-4 text-white shadow-xl"
                  style={{ background: "linear-gradient(150deg,#16295e,#0f4c9e)" }}
                >
                  <p className="text-[12px] font-extrabold">Mi Café</p>
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span
                        key={i}
                        className={`h-[13px] w-[13px] rounded-full ${i < 7 ? "bg-white" : "border border-white/40"}`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-white/75">7 / 10 sellos</p>
                </div>
              </div>
              {[
                ["Descubre", "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"],
                ["Registrate", "right-0 top-[30%] translate-x-1/3"],
                ["Visitá", "bottom-[12%] right-[8%]"],
                ["Recibí", "bottom-[12%] left-[8%]"],
                ["Volvé", "left-0 top-[30%] -translate-x-1/3"],
              ].map(([n, pos]) => (
                <span
                  key={n}
                  className={`absolute ${pos} rounded-full border border-[#e6eaf3] bg-white px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16295e] shadow-md`}
                >
                  {n}
                </span>
              ))}
            </div>
            {/* La versión de teléfono: la lista con sus flechas. */}
            <div className="flex flex-col items-center gap-1 sm:hidden" aria-hidden>
              {["Descubre", "Registrate", "Visitá", "Recibí", "Volvé"].map((n, i) => (
                <div key={n} className="flex flex-col items-center">
                  {i > 0 && <span className="text-[16px] text-[#c7cede]">↓</span>}
                  <span className="rounded-full border border-[#e6eaf3] bg-white px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#16295e] shadow-sm">
                    {n}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <p className="hl-revelar text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#2563eb]">
                El ciclo Bookea
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                {["Más visitas.", "Más datos.", "Más relación.", "Más clientes que vuelven."].map(
                  (l) => (
                    <p key={l} className={`${TITULO_SECCION} hl-revelar`}>
                      {l}
                    </p>
                  ),
                )}
              </div>
              <p className="hl-revelar mt-5 max-w-[44ch] text-[15px] leading-relaxed text-[#5b6478]">
                Y cuando el ciclo cierra, vuelve a empezar: cada regreso suma un
                sello más, un dato más y una razón más para la próxima visita.
              </p>
            </div>
          </div>
        </SeccionViva>

        {/* ════════════ ANALYTICS ════════════ */}
        <SeccionViva className="mx-auto w-full max-w-[1080px] px-5 py-20">
          <div className="text-center">
            <h2 className={`${TITULO_SECCION} hl-revelar`}>
              Dejá de adivinar.
              <br />
              Empezá a conocer a tus clientes.
            </h2>
          </div>

          <div className="hl-revelar mt-10 rounded-[28px] border border-[#e6eaf3] bg-white p-5 shadow-[0_40px_90px_-45px_rgba(13,23,51,0.4)] sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-extrabold text-[#0d1733]">Tu tablero de Lealtad</p>
              {/* La misma pastilla honesta de toda la familia mockup-*:
                  estos números son utilería, no promesas. */}
              <span className="rounded-full bg-[#f2f4f8] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
                Ejemplo ilustrativo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Clientes totales", 1284, "", 0],
                ["Clientes activos", 842, "", 0],
                ["Nuevos este mes", 126, "+", 0],
                ["Inactivos", 87, "", 0],
                ["Frecuencia", 2.8, "", 1],
              ].map(([k, v, pre, dec]) => (
                <div key={k as string} className="rounded-2xl bg-[#f7f8fb] p-3.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
                    {k}
                  </p>
                  <p className="mt-1 text-[24px] font-extrabold text-[#0d1733]">
                    <Contador
                      hasta={v as number}
                      prefijo={pre as string}
                      decimales={dec as number}
                      sufijo={k === "Frecuencia" ? " visitas" : ""}
                      className={k === "Frecuencia" ? "text-[17px]" : ""}
                    />
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl bg-[#f7f8fb] p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
                  Visitas por semana
                </p>
                <div className="flex items-end gap-2">
                  {[38, 52, 44, 66, 58, 84, 100, 90].map((alto, i) => (
                    <div key={i} className="flex h-28 min-w-0 flex-1 items-end">
                      <div
                        className="hl-barra w-full rounded-t-md"
                        style={{
                          height: `${alto}%`,
                          background: i >= 6 ? "#2563eb" : "#dbe3f2",
                          animationDelay: `${i * 80}ms`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f7f8fb] p-4">
                <p className="mb-3 text-[10px] font-extrabold uppercase tracking-wide text-[#8a91a4]">
                  Necesitan un empujón
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    ["María", "32 días sin visitar"],
                    ["Carlos", "28 días sin visitar"],
                    ["Andrea", "24 días sin visitar"],
                  ].map(([n, d]) => (
                    <div
                      key={n}
                      className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm"
                    >
                      <span className="text-[12.5px] font-extrabold text-[#0d1733]">{n}</span>
                      <span className="text-[11px] font-bold text-[#8a91a4]">{d}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/lealtad/entrar"
                  className="presionable mt-3 block rounded-xl py-2.5 text-center text-[12.5px] font-extrabold text-white"
                  style={{ background: "#16295e" }}
                >
                  Crear campaña
                </Link>
              </div>
            </div>
          </div>
          <p className="hl-revelar mt-4 text-center text-[13.5px] font-bold text-[#5b6478]">
            Los datos se convierten en acciones — y las acciones, en visitas.
          </p>
        </SeccionViva>

        {/* ════════════ NO ES SOLO PUNTOS ════════════ */}
        <SeccionViva className="bg-[#f7f8fb] py-20">
          <div className="mx-auto w-full max-w-[880px] px-5 text-center">
            <p className="hl-revelar text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#2563eb]">
              Bookea Lealtad
            </p>
            <h2 className={`${TITULO_SECCION} hl-revelar mt-3`}>
              No es solo un programa de puntos.
              <br />
              Es la relación con tus clientes.
            </h2>
            <div className="hl-revelar mx-auto mt-10 grid max-w-[640px] gap-3 text-left">
              {[
                ["Conocer", "quiénes son tus clientes."],
                ["Premiar", "a quienes vuelven."],
                ["Recuperar", "a quienes dejaron de visitarte."],
                ["Comunicar", "directamente con ellos."],
                ["Crecer", "tu negocio a partir de datos reales."],
              ].map(([verbo, resto]) => (
                <p
                  key={verbo}
                  className="border-b border-[#e6eaf3] pb-3 text-[17px] leading-snug text-[#5b6478] last:border-0"
                >
                  <span className="mr-2 font-extrabold uppercase tracking-wide text-[#0d1733]">
                    {verbo}
                  </span>
                  {resto}
                </p>
              ))}
            </div>
          </div>
        </SeccionViva>

        {/* ════════════ EL CIERRE ════════════ */}
        <section className="px-5 py-20" style={{ background: "#0a1226" }}>
          <div className="mx-auto grid w-full max-w-[1080px] items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div className="text-center lg:text-left">
              <h2 className="titulo text-[clamp(30px,4.2vw,52px)] font-extrabold leading-[1.05] text-white">
                Tu próximo cliente frecuente
                <br />
                puede empezar hoy.
              </h2>
              <p className="mx-auto mt-5 max-w-[44ch] text-[15.5px] leading-relaxed text-white/65 lg:mx-0">
                Creá tu programa de lealtad y empezá a construir relaciones que
                duren.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link
                  href="/lealtad/nuevo"
                  className="presionable inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-[15px] font-extrabold text-[#0a1226]"
                >
                  Crear mi programa de lealtad <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/ayuda"
                  className="presionable inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-6 py-3.5 text-[14.5px] font-extrabold text-white"
                >
                  Hablar con un asesor
                </Link>
              </div>
            </div>
            <div className="hl-flotar mx-auto" style={{ animationDelay: "1.4s" }}>
              <TelefonoMarco>
                <PantallaTarjeta />
              </TelefonoMarco>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
