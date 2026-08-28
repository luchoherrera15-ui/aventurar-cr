import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import HeaderSimple from "@/components/home/header-simple";
import SiteFooter from "@/components/site-footer";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /negocios — BOOKEA PARA NEGOCIOS, la página que le vende a un dueño
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (28 ago 2026), con una landing de Fresha de
 * referencia: «necesito que creemos algo similar a esto, que en la
 * parte superior diga BOOKEA PARA NEGOCIOS un botón y entrar ahí lleve
 * a eso».
 *
 * ── SIMILAR EN ESTRUCTURA, BOOKEA EN TODO LO DEMÁS ──────────────────
 *
 * De Fresha se toma el ARMADO que funciona: héroe con el software a la
 * vista, grilla de rubros con foto, tres columnas de qué hace por vos,
 * preguntas frecuentes y cierre con llamado. La estética NO se copia:
 * CLAUDE.md manda estilo propio de la marca, así que esto es navy y
 * naranja de Bookea, no el violeta de Fresha.
 *
 * ── SIN NÚMEROS INVENTADOS, Y ES UNA REGLA VIEJA ────────────────────
 *
 * La referencia presume «+130.000 negocios» y «+1.000M de citas». Esos
 * son los números DE FRESHA. Acá no se inventa el equivalente — la
 * regla de la portada («el home no inventa estrellas ni cifras») aplica
 * igual: la franja bajo el héroe afirma cosas del PRODUCTO, que son
 * verdad con 3 negocios o con 3.000.
 *
 * ── LAS FOTOS DE LOS RUBROS ─────────────────────────────────────────
 *
 * Son las MISMAS de los pools verificados del demo
 * (`scripts/fotos-demo-100.json`): cada una fue mirada en una hoja de
 * contactos antes de usarse, y la etiqueta de cada ficha corresponde a
 * lo que la foto de verdad muestra. No agregar ids nuevos acá sin
 * mirarlos primero — así se coló una vez un masaje al carril de Uñas.
 *
 * ── «VER LA PLATAFORMA LLENA» VA AL DEMO ────────────────────────────
 *
 * El botón secundario lleva a /demo-bookea: 99 negocios navegables con
 * reseñas y equipo. Es el mejor argumento de venta que existe en el
 * sitio — un dueño que duda puede tocar el producto funcionando en vez
 * de creerle a una lista de promesas.
 */

export const metadata: Metadata = {
  title: "Bookea para negocios",
  description:
    "Agenda en línea, reservas instantáneas, recordatorios y tarjetas de lealtad en el Wallet. Publicá tu negocio gratis en Bookea.",
};

const img = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/**
 * Rubro → foto verificada. El comentario de cada línea dice QUÉ muestra
 * la foto — es la razón de que esté en esa ficha y no en otra.
 */
const RUBROS: { label: string; foto: string }[] = [
  // uñas recién hechas, primer plano
  { label: "Salones de uñas", foto: "photo-1604654894610-df63bc536371" },
  // interior de barbería de ladrillo
  { label: "Barberías", foto: "photo-1585747860715-2ba37e788b70" },
  // cabello rosado al viento
  { label: "Salones de belleza", foto: "photo-1470259078422-826894b933aa" },
  // tratamiento facial de cerca
  { label: "Estética y pestañas", foto: "photo-1512290923902-8a9f81dc236c" },
  // toalla, loción y flores
  { label: "Spa y bienestar", foto: "photo-1540555700478-4be289fbecef" },
  // masaje con aceite en la espalda
  { label: "Masajes", foto: "photo-1544161515-4ab6ce6db874" },
  // dos personas conversando en consulta
  { label: "Psicología y terapia", foto: "photo-1631217868264-e5b90bb7e133" },
  // recepción de clínica
  { label: "Clínicas y consultorios", foto: "photo-1519494026892-80bbd2d6fd0d" },
  // consultorio dental
  { label: "Odontología", foto: "photo-1629909613654-28e377c37b09" },
  // brazo tatuado, primer plano
  { label: "Tatuajes y piercing", foto: "photo-1611501275019-9b5cda994e8d" },
  // pesas del gimnasio
  { label: "Fitness y entrenamiento", foto: "photo-1534438327276-14e5300c3a48" },
  // clase de yoga en colchonetas
  { label: "Yoga y pilates", foto: "photo-1518611012118-696072aa579a" },
];

/** La agenda del héroe: dibujada, no capturada — así nunca desactualiza. */
const AGENDA_MOCK: {
  dia: string;
  citas: { hora: string; titulo: string; tono: string }[];
}[] = [
  {
    dia: "Jueves",
    citas: [
      { hora: "9:00", titulo: "Manicura semipermanente", tono: "#dbeafe" },
      { hora: "10:30", titulo: "Corte y barba", tono: "#ffedd5" },
      { hora: "13:00", titulo: "Masaje relajante", tono: "#dcfce7" },
    ],
  },
  {
    dia: "Viernes",
    citas: [
      { hora: "8:30", titulo: "Consulta de valoración", tono: "#fef9c3" },
      { hora: "11:00", titulo: "Gel X — set completo", tono: "#dbeafe" },
      { hora: "15:00", titulo: "Color y peinado", tono: "#fce7f3" },
    ],
  },
  {
    dia: "Sábado",
    citas: [
      { hora: "9:00", titulo: "Pedicura spa", tono: "#dcfce7" },
      { hora: "10:00", titulo: "Fade clásico", tono: "#ffedd5" },
      { hora: "12:30", titulo: "Limpieza facial", tono: "#e0e7ff" },
    ],
  },
];

export default function NegociosPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white">
      <div className="bg-[#fff4e6]">
        <HeaderSimple />

        {/* ── EL HÉROE ─────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-10 sm:pt-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-bookea-naranja-fuerte">
                <span aria-hidden className="block h-[1.5px] w-[18px] bg-bookea-naranja-fuerte" />
                Bookea para negocios
              </p>
              <h1 className="titulo mt-3 text-[clamp(32px,4.8vw,54px)] leading-[1.05] text-[color:var(--navy)]">
                El software de reservas para salones, spas y consultorios
              </h1>
              <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-aventurea-ink-soft sm:text-[17.5px]">
                Tu agenda en línea, reservas que entran solas, recordatorios
                automáticos y una tarjeta de lealtad que vive en el teléfono de
                tus clientes. Todo en un solo lugar.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/publicar"
                  className="presionable inline-flex items-center gap-2 rounded-xl px-7 py-4 text-[15.5px] font-extrabold text-white"
                  style={{ background: "var(--navy)" }}
                >
                  Publicá tu negocio gratis <span aria-hidden>→</span>
                </Link>
                {/* El demo es el argumento: tocá el producto lleno en vez
                    de creerle a una promesa. */}
                <Link
                  href="/demo-bookea"
                  className="presionable inline-flex items-center gap-2 rounded-xl border-2 border-[color:var(--navy)] px-6 py-3.5 text-[15px] font-extrabold text-[color:var(--navy)]"
                >
                  Ver la plataforma llena
                </Link>
              </div>
            </div>

            {/* La agenda, dibujada. Una captura envejece; esto no. */}
            <div
              aria-hidden
              className="rounded-3xl border border-aventurea-line bg-white p-4 shadow-[0_30px_70px_-30px_rgba(16,47,82,0.4)] sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-[13px] font-extrabold text-aventurea-ink">Tu agenda</p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald-700">
                  3 reservas nuevas
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {AGENDA_MOCK.map((col) => (
                  <div key={col.dia} className="rounded-2xl bg-aventurea-cream-2/60 p-2">
                    <p className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                      {col.dia}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {col.citas.map((c) => (
                        <div
                          key={c.hora}
                          className="rounded-lg px-2 py-1.5"
                          style={{ background: c.tono }}
                        >
                          <p className="text-[10px] font-bold tabular-nums text-aventurea-ink-soft">
                            {c.hora}
                          </p>
                          <p className="truncate text-[11px] font-bold leading-tight text-aventurea-ink">
                            {c.titulo}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── LA FRANJA DE VERDADES ──────────────────────────────────────
          Donde la referencia pone «+130.000 negocios» (los números de
          Fresha), acá van afirmaciones del producto: ciertas con 3
          negocios o con 3.000. El home no inventa cifras; esta página
          tampoco. */}
      <section className="border-b border-aventurea-line bg-white">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-2 gap-6 px-5 py-8 text-center sm:grid-cols-4">
          {[
            ["Reserva instantánea", "sin llamadas ni mensajes de ida y vuelta"],
            ["Recordatorios automáticos", "menos citas perdidas"],
            ["Lealtad en el Wallet", "Apple y Google, sin apps que instalar"],
            ["Hecho para Costa Rica", "precios en colones, SINPE, voseo"],
          ].map(([t, s]) => (
            <div key={t}>
              <p className="text-[15px] font-extrabold text-[color:var(--navy)]">{t}</p>
              <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">{s}</p>
            </div>
          ))}
        </div>
      </section>

      <main className="flex-1">
        {/* ── LOS RUBROS, CON FOTO ─────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[1180px] px-5 py-16">
          <h2 className="titulo text-center text-[clamp(24px,3.4vw,36px)] text-[color:var(--navy)]">
            Una plataforma, todos los rubros
          </h2>
          <p className="mx-auto mt-3 max-w-[56ch] text-center text-[15px] leading-relaxed text-aventurea-ink-soft">
            Si tus clientes reservan con vos una hora, Bookea es para tu
            negocio.
          </p>

          <div className="mt-9 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
            {RUBROS.map((r) => (
              <Link
                key={r.label}
                href="/publicar"
                className="presionable group relative aspect-[4/3] overflow-hidden rounded-2xl"
              >
                <Image
                  src={img(r.foto, 700)}
                  alt={r.label}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,18,42,0.72)_0%,rgba(6,18,42,0.15)_45%,transparent_70%)]"
                />
                <span className="absolute inset-x-3 bottom-3 text-[14px] font-extrabold text-white drop-shadow">
                  {r.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── QUÉ HACE POR VOS, EN TRES ────────────────────────────── */}
        <section className="bg-aventurea-cream-2/50">
          <div className="mx-auto w-full max-w-[1180px] px-5 py-16">
            <h2 className="titulo text-center text-[clamp(24px,3.4vw,36px)] text-[color:var(--navy)]">
              Todo lo que necesitás para operar
            </h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {[
                {
                  t: "Gestioná",
                  puntos: [
                    "Agenda por horas, con tu equipo y sus horarios",
                    "Reservas instantáneas: espacio + fecha = reservado",
                    "Recordatorios automáticos por correo",
                    "Importá tu agenda de papel con una foto",
                  ],
                },
                {
                  t: "Crecé",
                  puntos: [
                    "Tu ficha en el marketplace, con tus precios a la vista",
                    "Reseñas verificadas: solo quien tuvo cita puede opinar",
                    "Tu equipo con su perfil, su foto y sus propias reseñas",
                    "Salís en Google con tu propia página",
                  ],
                },
                {
                  t: "Fidelizá",
                  puntos: [
                    "Tarjeta de sellos en Apple y Google Wallet",
                    "El cliente la agrega al instante, sin instalar nada",
                    "Correos automáticos en los hitos del programa",
                    "Vos diseñás la tarjeta: colores, logo y premio",
                  ],
                },
              ].map((col) => (
                <div
                  key={col.t}
                  className="rounded-3xl border border-aventurea-line bg-white p-6"
                >
                  <h3 className="text-[19px] font-extrabold text-[color:var(--navy)]">
                    {col.t}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {col.puntos.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-aventurea-ink">
                        <span
                          aria-hidden
                          className="mt-[7px] block h-1.5 w-1.5 shrink-0 rounded-full bg-bookea-naranja-fuerte"
                        />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PREGUNTAS FRECUENTES ─────────────────────────────────── */}
        <section className="mx-auto w-full max-w-[820px] px-5 py-16">
          <h2 className="titulo text-center text-[clamp(24px,3.4vw,36px)] text-[color:var(--navy)]">
            Preguntas frecuentes
          </h2>
          <div className="mt-8 flex flex-col gap-3">
            {[
              [
                "¿Cuánto cuesta publicar mi negocio?",
                "Nada. Publicar tu negocio en el marketplace es gratis: creás tu ficha, cargás tus servicios con sus precios y empezás a recibir reservas.",
              ],
              [
                "¿Cómo reservan mis clientes?",
                "Entran a tu página, eligen el servicio, la persona y la hora, y la reserva queda hecha al instante — sin llamadas ni mensajes de ida y vuelta. A vos te llega el aviso y la cita aparece en tu agenda.",
              ],
              [
                "¿Necesito instalar algo?",
                "No. Todo funciona desde el navegador, en la computadora o en el teléfono. Y tus clientes tampoco instalan nada: hasta la tarjeta de lealtad vive en el Wallet que ya traen.",
              ],
              [
                "¿Qué es la tarjeta de lealtad?",
                "Una tarjeta de sellos digital en Apple Wallet y Google Wallet: el cliente junta sellos con cada visita y canjea su premio. Vos la diseñás con tus colores y tu logo, y arranca gratis.",
              ],
              [
                "¿Puedo manejar a mi equipo?",
                "Sí. Cada persona del equipo tiene su perfil, sus servicios, su horario y su día libre — y el cliente puede reservar con alguien en específico.",
              ],
            ].map(([q, a]) => (
              // <details> nativo: se abre y cierra sin una línea de
              // JavaScript, con teclado y lector de pantalla gratis.
              <details
                key={q}
                className="group rounded-2xl border border-aventurea-line bg-white px-5 py-4"
              >
                <summary className="cursor-pointer list-none text-[15px] font-extrabold text-aventurea-ink [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {q}
                    <span
                      aria-hidden
                      className="text-[18px] text-aventurea-ink-soft transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-aventurea-ink-soft">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── EL CIERRE ────────────────────────────────────────────── */}
        <section className="px-5 pb-16">
          <div
            className="mx-auto w-full max-w-[1180px] rounded-[32px] px-6 py-14 text-center sm:px-10"
            style={{ background: "#0a1226" }}
          >
            <h2 className="titulo text-[clamp(26px,3.8vw,40px)] leading-[1.1] text-white">
              Tu próxima reserva puede entrar sola.
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-white/60">
              Publicá tu negocio hoy — la ficha, la agenda y las reservas no te
              cuestan nada.
            </p>
            <div className="mt-8">
              <Link
                href="/publicar"
                className="presionable inline-flex items-center gap-2 rounded-xl px-8 py-4 text-[15.5px] font-extrabold text-[#0a1226]"
                style={{ background: "#ffffff" }}
              >
                Publicá tu negocio gratis <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
