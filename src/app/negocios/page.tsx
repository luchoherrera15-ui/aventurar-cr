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


/**
 * La agenda grande, por colaborador. Misma filosofía que AGENDA_MOCK:
 * dibujada, no capturada. Los nombres son de utilería y los huecos
 * «Libre» van a propósito — un día de mentira lleno al 100 % se ve de
 * mentira.
 */
const AGENDA_EQUIPO: {
  nombre: string;
  rol: string;
  iniciales: string;
  color: string;
  citas: { hora: string; titulo?: string; tono?: string; libre?: boolean }[];
}[] = [
  {
    nombre: "Valeria",
    rol: "Estilista",
    iniciales: "VA",
    color: "#5b7cc9",
    citas: [
      { hora: "9:00", titulo: "Color y peinado", tono: "#dbeafe" },
      { hora: "11:30", titulo: "Corte y cepillado", tono: "#fce7f3" },
      { hora: "14:00", libre: true },
      { hora: "15:30", titulo: "Peinado de evento", tono: "#e0e7ff" },
    ],
  },
  {
    nombre: "Marco",
    rol: "Barbero",
    iniciales: "MA",
    color: "#b06428",
    citas: [
      { hora: "9:30", titulo: "Fade clásico", tono: "#ffedd5" },
      { hora: "10:30", titulo: "Corte y barba", tono: "#fef9c3" },
      { hora: "12:00", titulo: "Afeitado clásico", tono: "#ffedd5" },
      { hora: "15:30", libre: true },
    ],
  },
  {
    nombre: "Sofía",
    rol: "Uñas",
    iniciales: "SO",
    color: "#c05299",
    citas: [
      { hora: "9:00", titulo: "Gel X — set completo", tono: "#fce7f3" },
      { hora: "11:00", titulo: "Manicura semipermanente", tono: "#dbeafe" },
      { hora: "13:30", titulo: "Pedicura spa", tono: "#dcfce7" },
      { hora: "16:00", titulo: "Retiro y esmaltado", tono: "#fef9c3" },
    ],
  },
  {
    nombre: "Daniela",
    rol: "Masajista",
    iniciales: "DA",
    color: "#3f8f6b",
    citas: [
      { hora: "10:00", titulo: "Masaje relajante", tono: "#dcfce7" },
      { hora: "12:30", libre: true },
      { hora: "14:00", titulo: "Piedras calientes", tono: "#ffedd5" },
      { hora: "16:30", titulo: "Masaje deportivo", tono: "#dbeafe" },
    ],
  },
];

export default function NegociosPage() {
  return (
    /* `isolate` + fondo propio: la aurora va en un hijo con z negativo,
       y sin el contexto de apilado ese z se escaparía del div y la
       aurora quedaría pintada DETRÁS de este mismo fondo — invisible.
       Es el mismo tropiezo que ya tuvo /lealtad/ingresar. */
    /* BLANCA, no crema (pedido del dueño, 28 ago 2026: «el anaranjado
       está demasiado empachoso — la página blanca y solo un poco de
       naranja que se mueva»). El único naranja fijo que queda es el de
       los acentos; el resto lo ponen las tres manchas de la aurora,
       moviéndose despacio sobre blanco. */
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip bg-white">
      {/* ── LA AURORA, SOLO ARRIBA (tercera vuelta del dueño, 28 ago
          2026: «un solo blanco en toda la página, que el blur naranja
          se mueva en la parte superior») ──────────────────────────────
          La primera versión pintaba la página crema; la segunda llevaba
          la aurora FIJA por todo el scroll y el naranja aparecía a
          mitad de página. Esta es la definitiva: una franja absoluta
          anclada al TOPE, con `aurora-caja` — que ya trae la máscara
          que se apaga hacia abajo — así el naranja vive en el héroe,
          se funde a blanco antes de la agenda, y el resto de la página
          es blanco de verdad. Clases `aurora-lenta-*` (48-67 s, viajes
          largos): acá se lee, y el movimiento corto se vuelve un tic. */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[560px] sm:h-[700px]">
        <div className="aurora-caja">
          <div className="aurora-mancha-lenta aurora-lenta-1" />
          <div className="aurora-mancha-lenta aurora-lenta-2" />
          <div className="aurora-mancha-lenta aurora-lenta-3" />
        </div>
      </div>

      {/* El envoltorio del héroe ya no pinta su crema sólida: taparía a
          la aurora justo donde más se luce. El tono lo da el fondo del
          root, que es de la misma familia. */}
      <div>
        <HeaderSimple />

        {/* ── EL HÉROE ─────────────────────────────────────────────── */}
        {/* CENTRADO y en columna (pedido del dueño, 28 ago 2026: «el
            primer header más centrado y abajo el mockup»). El grid de
            dos columnas se fue: titular, bajada y botones al centro, y
            el teléfono del antes/después debajo, también centrado. */}
        <section className="mx-auto w-full max-w-[880px] px-5 pb-16 pt-10 text-center sm:pt-14">
            <div>
              <p className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-bookea-naranja-fuerte">
                <span aria-hidden className="block h-[1.5px] w-[18px] bg-bookea-naranja-fuerte" />
                Bookea para negocios
              </p>
              <h1 className="titulo mt-3 text-[clamp(32px,4.8vw,54px)] leading-[1.05] text-[color:var(--navy)]">
                El software de reservas para salones, spas y consultorios
              </h1>
              <p className="mx-auto mt-4 max-w-[52ch] text-[16px] leading-relaxed text-aventurea-ink-soft sm:text-[17.5px]">
                Tu agenda en línea, reservas que entran solas, recordatorios
                automáticos y una tarjeta de lealtad que vive en el teléfono de
                tus clientes. Todo en un solo lugar.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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

            {/* ── EL ANTES Y EL DESPUÉS, EN UN SOLO TELÉFONO ──────────
                (pedido del dueño, 28 ago 2026: «un mockup de un
                teléfono de WhatsApp recibiendo muchas notificaciones y
                luego una transición hacia otro teléfono brindando las
                soluciones de Bookea»). Dos teléfonos APILADOS en la
                misma celda con fundido entre ellos (reloj de 16 s en
                globals.css): primero la pantalla bloqueada ahogada en
                avisos de WhatsApp — que es el día a día real de un
                salón sin sistema — y después la agenda de Bookea con
                las mismas citas entrando solas y confirmadas. El caos
                no usa el logo de WhatsApp, solo su realidad: avisos
                que se apilan y un contador de «sin responder». Con
                prefers-reduced-motion queda SOLO el después. */}
            <div aria-hidden className="mx-auto mt-12 w-full max-w-[300px]">
              <div className="mock-pila">
                {/* Teléfono A · el caos */}
                <div className="mock-tel-caos opacity-0">
                  <div className="overflow-hidden rounded-[30px] border-[8px] border-[#0a1226] bg-[#eef1f6] shadow-[0_36px_80px_-36px_rgba(10,18,38,0.55)]">
                    <div className="px-3 pb-4 pt-2">
                      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#0a1226]/80" />
                      <p className="text-center text-[26px] font-extrabold tabular-nums text-aventurea-ink">9:41</p>
                      <div className="mb-2 flex justify-center">
                        <span className="mock-badge-caos rounded-full bg-red-500 px-2.5 py-0.5 text-[9.5px] font-extrabold text-white">
                          14 sin responder
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {[
                          ["María", "Hola!! ¿Tienen campo mañana?", "mock-msj-1"],
                          ["Camila", "¿Me pasás los precios? 🙏", "mock-msj-2"],
                          ["José", "¿Puedo mover mi cita de hoy?", "mock-msj-3"],
                          ["Daniela", "Llamada perdida (2)", "mock-msj-4"],
                          ["Andrea", "Al final no llego 😞", "mock-msj-5"],
                        ].map(([quien, texto, clase]) => (
                          <div key={quien} className={`${clase} rounded-xl bg-white px-2.5 py-1.5 shadow-sm`}>
                            <p className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-wide text-[#128c4b]">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#25d366]" />
                              {quien} · ahora
                            </p>
                            <p className="truncate text-[10px] font-bold leading-tight text-aventurea-ink">
                              {texto}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Teléfono B · Bookea, todo entrando solo */}
                <div className="mock-tel-orden">
                  <div className="overflow-hidden rounded-[30px] border-[8px] border-[#0a1226] bg-white shadow-[0_36px_80px_-36px_rgba(10,18,38,0.55)]">
                    <div className="px-3 pb-4 pt-2">
                      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#0a1226]/80" />
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[12px] font-extrabold text-aventurea-ink">Tu agenda</p>
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wide text-emerald-700">
                          <span className="mock-punto-vivo block h-1 w-1 rounded-full bg-emerald-500" />
                          En vivo
                        </span>
                      </div>
                      <div className="mock-b-toast mb-1.5 rounded-xl bg-[#e3f6ec] px-2.5 py-1.5">
                        <p className="text-[8px] font-extrabold uppercase tracking-wide text-[#146c43]">
                          Reserva nueva
                        </p>
                        <p className="text-[10px] font-bold leading-tight text-aventurea-ink">
                          Entró sola — sin un solo chat
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {[
                          ["9:00", "Manicura — María", "#dbeafe", "mock-b-1"],
                          ["11:00", "Corte y barba — José", "#ffedd5", "mock-b-2"],
                          ["13:30", "Pedicura spa — Camila", "#dcfce7", "mock-b-3"],
                          ["15:00", "Gel X — Andrea", "#fce7f3", "mock-b-4"],
                        ].map(([hh, tt, tono, clase]) => (
                          <div
                            key={hh}
                            className={`${clase} flex items-center justify-between rounded-xl px-2.5 py-1.5`}
                            style={{ background: tono }}
                          >
                            <span className="min-w-0">
                              <span className="block text-[8px] font-bold tabular-nums text-aventurea-ink-soft">{hh}</span>
                              <span className="block truncate text-[10px] font-bold text-aventurea-ink">{tt}</span>
                            </span>
                            <span className="shrink-0 text-[8.5px] font-extrabold text-emerald-700">✓ Confirmada</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* El rótulo de cada mitad, apilado con el mismo reloj. */}
              <div className="mock-pila mt-3 text-center">
                <p className="mock-cap-caos text-[12.5px] font-bold text-aventurea-ink-soft opacity-0">
                  Así se ve organizar citas por WhatsApp…
                </p>
                <p className="mock-cap-orden text-[12.5px] font-bold text-aventurea-ink-soft">
                  …y así se ve con Bookea: solas y confirmadas.
                </p>
              </div>
            </div>
        </section>
      </div>

      {/* ── LA FRANJA DE VERDADES ──────────────────────────────────────
          Donde la referencia pone «+130.000 negocios» (los números de
          Fresha), acá van afirmaciones del producto: ciertas con 3
          negocios o con 3.000. El home no inventa cifras; esta página
          tampoco. */}
      {/* Translúcida y no blanca sólida: una banda opaca cruzando la
          página cortaría la aurora en dos. */}
      <section className="border-b border-aventurea-line bg-white/60">
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
        {/* ── LA AGENDA GRANDE, POR COLABORADOR ────────────────────────
            (pedido del dueño, 28 ago 2026: «una agenda grande, tipo una
            sección, organizada por estilista o colaborador — qué le
            toca a cada uno»). Dibujada como la del héroe: una captura
            envejece con el primer cambio de interfaz; esto no. Los
            huecos LIBRES van a propósito — una agenda de mentira llena
            al 100 % se ve de mentira. */}
        <section className="mx-auto w-full max-w-[1180px] px-5 pb-8 pt-16">
          <h2 className="titulo text-center text-[clamp(24px,3.4vw,36px)] text-[color:var(--navy)]">
            La agenda, ordenada por colaborador
          </h2>
          <p className="mx-auto mt-3 max-w-[58ch] text-center text-[15px] leading-relaxed text-aventurea-ink-soft">
            Cada quien ve lo suyo — sus citas, sus huecos, su día completo — y
            vos ves el negocio entero de un vistazo.
          </p>

          <div
            aria-hidden
            className="mt-9 rounded-3xl border border-aventurea-line bg-white p-4 shadow-[0_30px_70px_-35px_rgba(16,47,82,0.35)] sm:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-[14px] font-extrabold text-aventurea-ink">
                Viernes 4 de setiembre
              </p>
              <span className="rounded-full bg-aventurea-cream-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                13 citas · 3 espacios libres
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {AGENDA_EQUIPO.map((col) => (
                <div key={col.nombre} className="rounded-2xl bg-aventurea-cream-2/60 p-3">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                      style={{ background: col.color }}
                    >
                      {col.iniciales}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-extrabold text-aventurea-ink">
                        {col.nombre}
                      </span>
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        {col.rol}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {col.citas.map((c) =>
                      c.libre ? (
                        <div
                          key={c.hora}
                          className="rounded-lg border border-dashed border-aventurea-line px-2.5 py-2"
                        >
                          <p className="text-[10.5px] font-bold tabular-nums text-aventurea-ink-soft">
                            {c.hora}
                          </p>
                          <p className="text-[12px] font-bold text-aventurea-ink-soft">
                            Libre — se puede reservar
                          </p>
                        </div>
                      ) : (
                        <div
                          key={c.hora}
                          className="rounded-lg px-2.5 py-2"
                          style={{ background: c.tono }}
                        >
                          <p className="text-[10.5px] font-bold tabular-nums text-aventurea-ink-soft">
                            {c.hora}
                          </p>
                          <p className="truncate text-[12.5px] font-bold leading-tight text-aventurea-ink">
                            {c.titulo}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── «STARTUP COMPLETO Y GRATIS» — el panel, con sus aparatos ──
            Titular con las palabras del dueño. El teléfono y el iPad
            están DIBUJADOS (CSS), no son fotos de stock de un aparato
            ajeno: cuentan una sola historia entre los dos — al teléfono
            le entra la reserva nueva y el iPad ya la muestra en el
            resumen. Los números de adentro son datos de MUESTRA de un
            panel (como las citas de la agenda del héroe), no cifras de
            la plataforma: la regla de «no inventar cifras» aplica a
            Bookea, no al lorem de un mockup. */}
        <section className="mx-auto w-full max-w-[1180px] px-5 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-bookea-naranja-fuerte">
                <span aria-hidden className="block h-[1.5px] w-[18px] bg-bookea-naranja-fuerte" />
                Panel de administración
              </p>
              <h2 className="titulo mt-3 text-[clamp(26px,3.6vw,40px)] leading-[1.08] text-[color:var(--navy)]">
                Startup completo y gratis para administrar tu negocio
              </h2>
              <p className="mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-aventurea-ink-soft">
                Todo lo que un local necesita para operar el día a día, sin
                pagar licencias ni instalar nada:
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {[
                  ["Agenda automática", "las reservas entran solas y caen en el calendario de quien corresponde"],
                  ["Control de clientes", "quién vino, cuándo volvió y qué se hizo, sin cuadernos"],
                  ["Estadísticas diarias y semanales", "citas, ocupación y plata, al día y por semana"],
                  ["Mapeo de tu clientela", "de dónde llegan, quiénes repiten y quiénes son nuevos"],
                  ["Recordatorios automáticos", "menos citas perdidas sin perseguir a nadie"],
                ].map(([tt, ss]) => (
                  <li key={tt} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-aventurea-ink">
                    <span aria-hidden className="mt-[7px] block h-1.5 w-1.5 shrink-0 rounded-full bg-bookea-naranja-fuerte" />
                    <span>
                      <strong className="font-extrabold">{tt}</strong> — {ss}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link
                  href="/publicar"
                  className="presionable inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[15px] font-extrabold text-white"
                  style={{ background: "var(--navy)" }}
                >
                  Empezá gratis <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            {/* ── EL iPAD Y EL TELÉFONO, EN VIVO ──────────────────────
                Segunda pasada de realismo (pedido del dueño, 28 ago
                2026: «más realistas, que salgan más popups»). Sobre el
                reloj de 24 s de siempre ahora pasan MÁS cosas, todas
                derivadas de los mismos tres actos (ver globals.css):

                  · el teléfono tiene barra de estado y notch, y se
                    SACUDE una gota cuando le cae cada aviso;
                  · cuatro avisos en vez de tres (se sumó el violeta de
                    «recordatorios enviados» — la automatización
                    también avisa);
                  · el iPad tiene la identidad del negocio (Studio
                    Bella) y le caen DOS popups propios: la
                    confirmación de María y su reseña de 5 estrellas;
                  · los tres números viven: reservas 23⇄24, ocupación
                    82⇄84 % y clientes nuevos 6→7 con la clienta del
                    tercer acto;
                  · la barra del viernes destella cuando entra la
                    reserva (brightness, no transform: la entrada de
                    las barras ya usa transform y dos animaciones sobre
                    la misma propiedad no se componen — gana la última). */}
            <div aria-hidden className="relative mx-auto w-full max-w-[560px] pb-12 pl-6">
              <div className="mock-flotar overflow-hidden rounded-[26px] border-[10px] border-[#0a1226] bg-white shadow-[0_40px_90px_-40px_rgba(10,18,38,0.55)]">
                <div className="relative bg-[#fbfcff] p-4 sm:p-5">
                  {/* Los popups del iPad, apilados arriba a la derecha. */}
                  <div className="mock-pila absolute right-3 top-3 z-10 w-[190px]">
                    <div className="mock-ipad-toast-1 rounded-xl border border-emerald-100 bg-white px-2.5 py-1.5 shadow-lg opacity-0">
                      <p className="text-[8px] font-extrabold uppercase tracking-wide text-emerald-700">
                        ✓ Cita confirmada
                      </p>
                      <p className="truncate text-[9.5px] font-bold text-aventurea-ink">
                        María — Gel X, hoy 15:00
                      </p>
                    </div>
                    <div className="mock-ipad-toast-2 rounded-xl border border-amber-100 bg-white px-2.5 py-1.5 shadow-lg opacity-0">
                      <p className="text-[8px] font-extrabold uppercase tracking-wide text-amber-600">
                        ★ Reseña nueva — 5.0
                      </p>
                      <p className="truncate text-[9.5px] font-bold text-aventurea-ink">
                        «Me encantó, volví a reservar»
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--navy)] text-[8.5px] font-extrabold text-white">
                        SB
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-extrabold leading-tight text-aventurea-ink">
                          Studio Bella
                        </span>
                        <span className="block text-[8.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                          Resumen de la semana
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                      <span aria-hidden className="mock-punto-vivo block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      En vivo
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white p-2.5 shadow-[0_6px_18px_-10px_rgba(16,47,82,0.3)]">
                      <p className="text-[9.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">Reservas</p>
                      <p className="mt-0.5 text-[19px] font-extrabold tabular-nums text-[color:var(--navy)]">
                        <span className="mock-cifra">
                          <span className="mock-cifra-vieja">23</span>
                          <span className="mock-cifra-nueva">24</span>
                        </span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 shadow-[0_6px_18px_-10px_rgba(16,47,82,0.3)]">
                      <p className="text-[9.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">Clientes nuevos</p>
                      <p className="mt-0.5 text-[19px] font-extrabold tabular-nums text-[color:var(--navy)]">
                        {/* 6 → 7 con la Manicura francesa del acto 3:
                            clienta nueva, número nuevo. */}
                        <span className="mock-cifra">
                          <span className="mock-cifra2-vieja">6</span>
                          <span className="mock-cifra2-nueva">7</span>
                        </span>
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 shadow-[0_6px_18px_-10px_rgba(16,47,82,0.3)]">
                      <p className="text-[9.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">Ocupación</p>
                      <p className="mt-0.5 text-[19px] font-extrabold tabular-nums text-[color:var(--navy)]">
                        {/* Mismo reloj que Reservas: 82 cuando 23, 84
                            cuando 24 — los números no se contradicen. */}
                        <span className="mock-cifra">
                          <span className="mock-cifra-vieja">82%</span>
                          <span className="mock-cifra-nueva">84%</span>
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-white p-3 shadow-[0_6px_18px_-10px_rgba(16,47,82,0.3)]">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                      Citas por día
                    </p>
                    <div className="flex items-end gap-1.5">
                      {[
                        ["L", 45], ["K", 60], ["M", 38], ["J", 72], ["V", 100], ["S", 88], ["D", 20],
                      ].map(([dia, alto], i) => (
                        <div key={dia as string} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                          <div className="flex h-20 w-full items-end">
                            <div
                              className={`${dia === "V" ? "mock-barra mock-barra-destello" : "mock-barra"} w-full rounded-t-md`}
                              style={{
                                height: `${alto}%`,
                                background: dia === "V" ? "var(--navy)" : "#dbe3f2",
                                animationDelay: `${i * 90}ms`,
                              }}
                            />
                          </div>
                          <span className="text-[8.5px] font-bold text-aventurea-ink-soft">{dia}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mock-fila-nueva mt-3 flex items-center justify-between rounded-xl bg-[#eef4ff] px-3 py-2">
                    <p className="text-[11px] font-bold text-aventurea-ink">
                      15:00 · Gel X — set completo · Sofía
                    </p>
                    <span className="rounded-full bg-[color:var(--navy)] px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">
                      Nueva
                    </span>
                  </div>
                </div>
              </div>

              <div className="mock-flotar-tel absolute -bottom-2 -left-1 w-[150px] sm:w-[180px]">
                <div className="mock-tel-sacudida overflow-hidden rounded-[26px] border-[7px] border-[#0a1226] bg-white shadow-[0_30px_60px_-25px_rgba(10,18,38,0.6)]">
                  <div className="bg-white p-2.5 pt-1.5">
                    {/* La barra de estado y el notch: lo que hace que un
                        rectángulo se lea como un teléfono. */}
                    <div className="relative mb-1.5 flex items-center justify-between px-0.5 pt-0.5">
                      <span className="text-[8px] font-extrabold tabular-nums text-aventurea-ink">9:41</span>
                      <span aria-hidden className="absolute left-1/2 top-0 h-[9px] w-12 -translate-x-1/2 rounded-full bg-[#0a1226]" />
                      <span className="flex items-center gap-1">
                        <span className="flex items-end gap-[1.5px]">
                          <span className="block h-[3px] w-[2px] rounded-sm bg-aventurea-ink" />
                          <span className="block h-[5px] w-[2px] rounded-sm bg-aventurea-ink" />
                          <span className="block h-[7px] w-[2px] rounded-sm bg-aventurea-ink" />
                        </span>
                        <span className="relative block h-[7px] w-[13px] rounded-[2px] border border-aventurea-ink">
                          <span className="absolute inset-[1px] right-[4px] rounded-[1px] bg-aventurea-ink" />
                        </span>
                      </span>
                    </div>
                    {/* Los CUATRO avisos del reloj, apilados. Los que no
                        son del primer acto llevan opacity-0 de base
                        (prefers-reduced-motion deja el cuadro del acto
                        1, quieto y coherente). */}
                    <div className="mock-pila mb-2">
                      <div className="mock-toast-1 rounded-lg bg-[#eef4ff] px-2 py-1.5">
                        <p className="text-[8px] font-extrabold uppercase tracking-wide text-[color:var(--navy)]">
                          Nueva reserva
                        </p>
                        <p className="text-[9.5px] font-bold leading-tight text-aventurea-ink">
                          Gel X — hoy 15:00, con Sofía
                        </p>
                      </div>
                      <div className="mock-toast-4 rounded-lg bg-[#efe9ff] px-2 py-1.5 opacity-0">
                        <p className="text-[8px] font-extrabold uppercase tracking-wide text-[#5b34c4]">
                          Automático
                        </p>
                        <p className="text-[9.5px] font-bold leading-tight text-aventurea-ink">
                          Recordatorios enviados a 5 clientas ✓
                        </p>
                      </div>
                      <div className="mock-toast-2 rounded-lg bg-[#fff1de] px-2 py-1.5 opacity-0">
                        <p className="text-[8px] font-extrabold uppercase tracking-wide text-[#9a4b00]">
                          Cancelación
                        </p>
                        <p className="text-[9.5px] font-bold leading-tight text-aventurea-ink">
                          Uñas acrílicas — hoy 13:30
                        </p>
                      </div>
                      <div className="mock-toast-3 rounded-lg bg-[#e3f6ec] px-2 py-1.5 opacity-0">
                        <p className="text-[8px] font-extrabold uppercase tracking-wide text-[#146c43]">
                          Nueva reserva
                        </p>
                        <p className="text-[9.5px] font-bold leading-tight text-aventurea-ink">
                          Manicura francesa — hoy 13:30
                        </p>
                      </div>
                    </div>
                    <p className="mb-1.5 px-0.5 text-[10px] font-extrabold text-aventurea-ink">Hoy</p>
                    <div className="flex flex-col gap-1">
                      <div className="rounded-md px-1.5 py-1" style={{ background: "#dbeafe" }}>
                        <p className="text-[7.5px] font-bold tabular-nums text-aventurea-ink-soft">9:00</p>
                        <p className="truncate text-[8.5px] font-bold text-aventurea-ink">Manicura</p>
                      </div>
                      <div className="rounded-md px-1.5 py-1" style={{ background: "#dcfce7" }}>
                        <p className="text-[7.5px] font-bold tabular-nums text-aventurea-ink-soft">11:00</p>
                        <p className="truncate text-[8.5px] font-bold text-aventurea-ink">Pedicura spa</p>
                      </div>
                      <div className="mock-pila">
                        <div className="mock-cita-sale rounded-md px-1.5 py-1" style={{ background: "#ffedd5" }}>
                          <p className="text-[7.5px] font-bold tabular-nums text-aventurea-ink-soft">13:30</p>
                          <p className="truncate text-[8.5px] font-bold text-aventurea-ink">Uñas acrílicas</p>
                        </div>
                        <div className="mock-cita-reemplazo rounded-md px-1.5 py-1 opacity-0" style={{ background: "#e3f6ec" }}>
                          <p className="text-[7.5px] font-bold tabular-nums text-aventurea-ink-soft">13:30</p>
                          <p className="truncate text-[8.5px] font-bold text-aventurea-ink">Manicura francesa</p>
                        </div>
                      </div>
                      <div className="mock-cita-entra rounded-md px-1.5 py-1" style={{ background: "#fce7f3" }}>
                        <p className="text-[7.5px] font-bold tabular-nums text-aventurea-ink-soft">15:00</p>
                        <p className="truncate text-[8.5px] font-bold text-aventurea-ink">Gel X</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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
        <section>
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
