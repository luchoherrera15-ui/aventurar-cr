import type { Metadata } from "next";
import Link from "next/link";
import MockupAnuncios from "@/app/lealtad/mockup-anuncios";
import {
  ETIQUETAS_CAPACIDAD,
  PLANES_VIGENTES,
  etiquetaNotificacionesDe,
  puede,
} from "@/lib/lealtad/planes";
import { SITIO } from "@/lib/sitio";
import { PASES_DEMO, type PaseDemo } from "./datos-pases";
import { slugsQueEmiten } from "./estado-tarjetas";
import { QrInstalacion, TelefonoConPase } from "./piezas-demo";

/**
 * /demo — LA PÁGINA CON LA QUE SE VENDE BOOKEA LEALTAD.
 *
 * No es la landing (`/lealtad`, que explica el producto y sus paquetes)
 * ni la demo de FOOD (`/food/demo`, que es otro producto). Esta es la
 * pieza que se le abre a un dueño de negocio en la mesa: cuatro
 * industrias, cada una con su tarjeta dibujada dentro de un teléfono y
 * con un QR que la instala AHÍ MISMO en el celular de quien mira.
 *
 * ------------------------------------------------------------------
 * LOS QR SON DE VERDAD, Y SI NO PUEDEN SERLO LO DICEN
 * ------------------------------------------------------------------
 * Cada QR apunta a `/tarjeta/{slug}`, la MISMA puerta pública por la
 * que un cliente agrega su tarjeta en el mostrador de un negocio real:
 * deja su contacto y se lleva el pase a Apple Wallet o Google Wallet.
 * Los cuatro programas se siembran con `scripts/sembrar-pases-demo.mjs`.
 *
 * Antes de dibujar el código, la página le pregunta a la base si ese
 * programa está EMITIENDO (`estado-tarjetas.ts`, con la misma función
 * que usa /tarjeta/[slug]). Si todavía no se sembró, el QR no queda
 * muerto: apunta a `/lealtad/crear` y el texto dice «pase de ejemplo».
 * Un QR que no abre nada en la mesa de una venta es peor que no tenerlo.
 *
 * ------------------------------------------------------------------
 * NADA DE CIFRAS INVENTADAS
 * ------------------------------------------------------------------
 * El bloque de métricas nombra las cifras que el panel YA calcula
 * (`panel/[id]/impacto-comercial.tsx`: ventas con Bookea, compras
 * registradas, ticket promedio, clientes recurrentes, recompensas
 * canjeadas, sellos emitidos). Los números que se ven son utilería y
 * están rotulados «vista de ejemplo», igual que en /lealtad. El cupo de
 * notificaciones sale de `src/lib/lealtad/planes.ts`, no de un texto
 * escrito acá.
 *
 * Los cuatro negocios son FICTICIOS y la página lo declara arriba.
 */

/* Esta página era force-dynamic: dos consultas de servicio en fila, en
   CADA visita, para un dato que solo cambia cuando corre el seed. Ahora
   la consulta vive detrás de `unstable_cache` (una hora, tag
   "demo-catalogo" — ver estado-tarjetas.ts) y este `revalidate` la
   acompaña para que el HTML también se regenere: sin él la página
   quedaría estática del build y los QR congelados hasta el próximo
   deploy. El peor caso —el seed recién corrido tarda hasta una hora en
   verse— es benigno: el QR de respaldo apunta a /lealtad/crear y lo
   dice con honestidad («pase de ejemplo»), no queda un enlace muerto. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pases demo",
  description:
    "Cuatro tarjetas de lealtad de muestra —cafetería, sala de belleza, lavacar y courier— con el pase dibujado dentro del teléfono y el QR para llevárselo al Wallet.",
  // Fuera de los buscadores a propósito: los negocios de esta página
  // son ficticios y no tienen por qué aparecer en Google como si el
  // directorio los tuviera.
  robots: { index: false, follow: false },
};

/* ── La paleta de la página ────────────────────────────────────────
   Oscura, y es lo único que puede ser: los cuatro pases traen paletas
   fuertes y distintas (espresso, vino, turquesa y cian). Sobre blanco
   se pelearían entre ellos; sobre este casi-negro cada uno se lee como
   una joya en su vitrina, y el color de cada box sale del pase mismo —
   la página no le aporta ni un color propio. */
const TINTA = "#04060d";
const TINTA_2 = "#080c17";

/** El primer paquete del catálogo que trae la proyección de crecimiento. */
const PLAN_CON_PROYECCION = PLANES_VIGENTES.find((p) => puede(p.id, "proyeccion_metricas"));

/**
 * Las cifras del panel, en el orden en que las muestra
 * `impacto-comercial.tsx`. Los VALORES son utilería declarada; los
 * RÓTULOS son los seis que el panel calcula de verdad, palabra por
 * palabra, para que esta página no prometa una métrica que no existe.
 */
const CIFRAS_DE_EJEMPLO: { rotulo: string; valor: string }[] = [
  { rotulo: "Ventas con Bookea", valor: "₡184.500" },
  { rotulo: "Compras registradas", valor: "30" },
  { rotulo: "Ticket promedio", valor: "₡6.150" },
  { rotulo: "Clientes recurrentes", valor: "23" },
  { rotulo: "Recompensas canjeadas", valor: "7" },
  { rotulo: "Sellos emitidos", valor: "146" },
];

/** Qué le contesta cada cifra al dueño. Nada de esto es una promesa de
 *  resultado: es qué pregunta responde el panel. */
const LECTURAS: { titulo: string; texto: string }[] = [
  {
    titulo: "Cuánto entra por escaneo",
    texto:
      "Cada sello se registra junto con la compra que lo generó, así que el panel suma las ventas de tus clientes con tarjeta y saca el ticket promedio por visita. No es «cuántos sellos di»: es cuánta plata pasó por caja con el programa puesto.",
  },
  {
    titulo: "Si el programa hace volver",
    texto:
      "«Clientes recurrentes» cuenta a los que ya hicieron dos compras o más, y al lado van las recompensas canjeadas. Ahí se ve, sin adjetivos, si la tarjeta está generando la segunda visita o solo está regalando sellos.",
  },
  {
    titulo: "Si va creciendo o se aplanó",
    texto:
      "Las ventanas se comparan completas —los últimos 30 días contra los 30 anteriores—, nunca lo que va del mes contra un mes entero. Es la diferencia entre una caída de verdad y una caída de calendario.",
  },
];

export default async function DemoPasesPage() {
  const vivos = await slugsQueEmiten(PASES_DEMO.map((p) => p.slug));

  return (
    <main
      className="min-h-svh text-white"
      style={{
        background: `radial-gradient(90% 55% at 50% 0%, #101a33 0%, ${TINTA_2} 45%, ${TINTA} 100%)`,
      }}
    >
      {/* ═══════════ ENCABEZADO ═══════════ */}
      <header className="mx-auto w-full max-w-[1180px] px-5 pb-4 pt-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/lealtad" className="text-[15px] font-extrabold tracking-tight text-white">
            Bookea <span className="font-medium text-white/55">Lealtad</span>
          </Link>
          <Link
            href="/lealtad/crear"
            className="rounded-full px-5 py-2.5 text-[13px] font-extrabold transition-transform hover:scale-[1.03]"
            style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
          >
            Creá tu tarjeta
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[color:var(--accion-claro)]">
          Pases de demostración
        </p>
        <h1 className="titulo mt-5 max-w-[19ch] text-[clamp(34px,6vw,68px)] font-extrabold leading-[1.02] tracking-tight">
          Así se ve tu negocio{" "}
          <span
            style={{
              background: "linear-gradient(105deg,#ffffff 0%,#c8d6ff 45%,#9db4ff 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            dentro del teléfono
          </span>{" "}
          de tu cliente.
        </h1>
        <p className="mt-6 max-w-[62ch] text-[clamp(15px,1.9vw,19px)] leading-relaxed text-white/70">
          Cuatro industrias, cuatro tarjetas, un solo lugar: la billetera que el cliente ya
          trae instalada. Escaneá el código de la que se parezca a tu negocio y la tarjeta
          queda en tu teléfono —Apple Wallet o Google Wallet— antes de que termines de leer
          esta página.
        </p>
        <p className="mt-5 max-w-[62ch] text-[13px] leading-relaxed text-white/45">
          Los cuatro negocios de esta página son{" "}
          <strong className="text-white/70">ficticios</strong>, hechos para mostrar el
          producto: ni sus nombres ni sus regalías corresponden a ningún cliente de Bookea.
        </p>
      </section>

      {/* ═══════════ LOS CUATRO BOXES ═══════════ */}
      <section className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-5 pb-24 sm:px-8">
        {PASES_DEMO.map((pase, i) => (
          <BoxIndustria key={pase.id} pase={pase} indice={i + 1} vivo={vivos.has(pase.slug)} />
        ))}
      </section>

      {/* ═══════════ MÉTRICAS ═══════════ */}
      <section className="mx-auto w-full max-w-[1180px] px-5 pb-24 sm:px-8">
        <div className="max-w-[60ch]">
          <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[color:var(--accion-claro)]">
            Lo que devuelve
          </p>
          <h2 className="titulo mt-4 text-[clamp(26px,4.2vw,46px)] font-extrabold leading-[1.06]">
            ¿Vale la pena el programa? El panel lo contesta con plata, no con adjetivos.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/70">
            Cada sello queda respaldado por la compra que lo generó. Con eso, la pestaña
            Métricas arma el <strong className="text-white">Impacto comercial</strong> del
            negocio: cuánto vendieron tus clientes con tarjeta, cuánto gastan por visita y
            cuántos volvieron.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_minmax(0,420px)] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {LECTURAS.map((l) => (
              <div key={l.titulo} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-[15px] font-extrabold text-white">{l.titulo}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/60">{l.texto}</p>
              </div>
            ))}
          </div>

          {/* El panel de ejemplo: rótulos reales, números de utilería. */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/55">
                Impacto comercial
              </p>
              <p className="text-[10.5px] font-bold text-white/40">últimos 30 días</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2.5">
              {CIFRAS_DE_EJEMPLO.map((c) => (
                <div key={c.rotulo} className="rounded-xl border border-white/10 bg-[#0b1120] px-3.5 py-3">
                  <dt className="text-[10.5px] font-bold leading-tight text-white/55">{c.rotulo}</dt>
                  <dd className="mt-1 text-[19px] font-extrabold leading-none text-white">
                    {c.valor}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-center text-[11px] font-bold text-white/40">
              Vista de ejemplo del panel — los números son utilería, no cifras de un negocio
              real.
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-[70ch] text-[13px] leading-relaxed text-white/50">
          {ETIQUETAS_CAPACIDAD.analitica} vienen en todos los paquetes.
          {PLAN_CON_PROYECCION ? (
            <>
              {" "}
              {ETIQUETAS_CAPACIDAD.proyeccion_metricas} se suma desde el paquete{" "}
              <strong className="text-white/75">{PLAN_CON_PROYECCION.nombre}</strong>.
            </>
          ) : null}
        </p>
      </section>

      {/* ═══════════ NOTIFICACIONES (el bloque que el dueño subrayó) ═══════════ */}
      <section className="px-3 pb-20 sm:px-8">
        <div
          className="mx-auto w-full max-w-[1180px] rounded-[34px] px-5 py-14 sm:px-10 sm:py-20"
          style={{ background: "#ffffff", color: "var(--text)" }}
        >
          <div className="mx-auto max-w-[60ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[color:var(--accion)]">
              Y esto es lo que nadie más te da
            </p>
            <h2 className="titulo mt-4 text-[clamp(28px,5vw,54px)] font-extrabold leading-[1.04] text-aventurea-navy">
              Escribile a tus clientes y aparecé en su pantalla de bloqueo.
            </h2>
            <p
              className="mt-6 text-[clamp(17px,2.3vw,24px)] font-bold leading-snug"
              style={{ color: "var(--accion-fuerte)" }}
            >
              «Te extrañamos ☕ Esta semana, doble sello en tu bebida favorita»
            </p>
            <p className="mt-5 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Lo escribís en tu panel y le llega como notificación a todos los que ya tienen
              tu tarjeta en el Wallet. Sin pedir números de teléfono, sin armar listas de
              correo y sin pagar publicidad para alcanzar a gente que ya te compró. Es tu
              propia base de clientes, y te contesta el mismo día.
            </p>
          </div>

          {/* El mockup animado que ya existe en /lealtad: el anuncio se
              escribe solo en el panel y la notificación entra deslizándose
              en la pantalla de bloqueo. Respeta prefers-reduced-motion. */}
          <div className="mt-12">
            <MockupAnuncios />
          </div>

          {/* El cupo NO se escribe a mano: sale de planes.ts. */}
          <div className="mx-auto mt-14 max-w-[880px]">
            <p className="text-center text-[13px] font-bold uppercase tracking-[0.16em] text-aventurea-ink-soft">
              Cuántos anuncios podés mandar, según tu paquete
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PLANES_VIGENTES.map((plan) => (
                <li
                  key={plan.id}
                  className="rounded-2xl border border-aventurea-line bg-aventurea-cream px-4 py-4 text-center"
                >
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
                    {plan.nombre}
                  </p>
                  <p className="mt-1.5 text-[15px] font-extrabold leading-snug text-aventurea-navy">
                    {etiquetaNotificacionesDe(plan)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              Mandar anuncios viene en los cuatro paquetes; lo que cambia con el paquete es el
              cupo del mes.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ CIERRE ═══════════ */}
      <section className="mx-auto w-full max-w-[1180px] px-5 pb-24 text-center sm:px-8">
        <h2 className="titulo mx-auto max-w-[20ch] text-[clamp(28px,4.6vw,50px)] font-extrabold leading-[1.05]">
          La tuya se arma en una sentada.
        </h2>
        <p className="mx-auto mt-5 max-w-[54ch] text-[15px] leading-relaxed text-white/65">
          Elegís el tipo de tarjeta, ponés tu logo, tus colores y qué se gana. Salís con tu QR
          listo para el mostrador y con tu tarjeta viva en el teléfono de tu primer cliente.
        </p>
        <Link
          href="/lealtad/crear"
          className="mt-9 inline-block rounded-full px-9 py-4 text-[16px] font-extrabold transition-transform hover:scale-[1.03]"
          style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
        >
          Creá tu tarjeta
        </Link>
        <p className="mt-8 text-[12.5px] text-white/35">
          <Link href="/lealtad" className="underline hover:text-white/60">
            Ver cómo funciona Bookea Lealtad
          </Link>
        </p>
      </section>
    </main>
  );
}

/**
 * UN BOX POR INDUSTRIA: el texto a la izquierda, el teléfono con su
 * pase y su QR a la derecha. En móvil el grid colapsa a una columna y,
 * como el texto va primero en el DOM, queda arriba y el teléfono abajo
 * — sin ningún `order` que le cambie el recorrido a un lector de
 * pantalla respecto de lo que se ve.
 *
 * El color del box NO lo elige esta página: sale del pase (`acento` y
 * `fondo` de datos-pases.ts), así que cada industria respira su propia
 * identidad sobre el mismo casi-negro y la página no se vuelve un
 * arcoíris.
 */
function BoxIndustria({
  pase,
  indice,
  vivo,
}: {
  pase: PaseDemo;
  indice: number;
  vivo: boolean;
}) {
  const { copy, Pase, acento, fondo } = pase;
  const url = vivo ? `${SITIO}/tarjeta/${pase.slug}` : `${SITIO}/lealtad/crear`;

  return (
    <article
      className="grid gap-10 rounded-[34px] border p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:gap-14 lg:p-12"
      style={{
        borderColor: `${acento}2e`,
        background: `radial-gradient(120% 120% at 100% 0%, ${fondo} 0%, rgba(255,255,255,.03) 55%, rgba(255,255,255,.02) 100%)`,
        boxShadow: `inset 0 1px 0 ${acento}1f`,
      }}
    >
      {/* ── El texto de la actividad ──────────────────────────────── */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-extrabold tabular-nums" style={{ color: `${acento}99` }}>
            {String(indice).padStart(2, "0")}
          </span>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em]"
            style={{ background: `${acento}1f`, color: acento }}
          >
            {pase.industria}
          </span>
        </div>

        <h2 className="titulo mt-5 text-[clamp(23px,3.2vw,36px)] font-extrabold leading-[1.1]">
          {copy.titulo}
        </h2>

        <p className="mt-3 text-[13px] font-bold text-white/50">
          {copy.negocio} · {copy.rubro}{" "}
          <span className="text-white/30">(negocio ficticio)</span>
        </p>

        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-white/70">{copy.parrafo}</p>

        <ul className="mt-6 grid gap-3">
          {copy.bullets.map((b) => (
            <li key={b} className="flex gap-3 text-[14px] leading-relaxed text-white/70">
              <span
                aria-hidden
                className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: acento }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-7 grid gap-3 sm:grid-cols-2">
          <div
            className="rounded-2xl border px-4 py-3.5"
            style={{ borderColor: `${acento}26`, background: "rgba(255,255,255,.03)" }}
          >
            <dt className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white/45">
              La mecánica
            </dt>
            <dd className="mt-1.5 text-[13.5px] font-bold leading-snug text-white">
              {copy.mecanica}
            </dd>
          </div>
          <div
            className="rounded-2xl border px-4 py-3.5"
            style={{ borderColor: `${acento}26`, background: "rgba(255,255,255,.03)" }}
          >
            <dt className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white/45">
              La regalía
            </dt>
            <dd className="mt-1.5 text-[13.5px] font-bold leading-snug" style={{ color: acento }}>
              {copy.regalia}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── El teléfono con el pase, y el QR que lo instala ────────── */}
      <div className="flex flex-col items-center gap-5">
        <TelefonoConPase etiqueta={copy.negocio}>
          <Pase sellos={pase.sellos} meta={pase.meta} />
        </TelefonoConPase>
        <QrInstalacion url={url} real={vivo} negocio={copy.negocio} acento={acento} />
      </div>
    </article>
  );
}
