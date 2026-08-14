import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  ETIQUETAS_CAPACIDAD,
  PLANES as PLANES_REALES,
  PLANES_OFRECIDOS,
  PLAN_DESTACADO,
  precioDe,
} from "@/lib/lealtad/planes";
import AcordeonTipos from "./acordeon-tipos";
import DemoNotificacion from "./demo-notificacion";
import CarruselNegocios from "./carrusel-negocios";
import PaquetesCliente from "./paquetes-cliente";
import TelefonoMockup, { PantallaWallet } from "./telefono-mockup";
import { FICHAS } from "./contenido-tipos";
import SeccionCrecimiento from "./seccion-crecimiento";
import SeccionDashboard from "./seccion-dashboard";
import PruebaSocial from "./prueba-social";
import BurbujaContacto from "./burbuja-contacto";
import { textoDelContador } from "@/lib/lealtad/contador-negocios";

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

/**
 * La franja de negocios depende del DIA, y una pagina estatica se
 * congela en el momento del build: sin esto el numero quedaria
 * clavado en el de la ultima vez que se desplego.
 *
 * Seis horas y no cero: la pagina sigue sirviendose desde el cache
 * del CDN a todo el mundo, y se regenera sola cuatro veces al dia.
 * `revalidate = 0` la volveria dinamica y le costaria a CADA
 * visitante el viaje al servidor — exactamente lo contrario de lo
 * que se esta corrigiendo en el resto del sitio.
 */
export const revalidate = 21600;

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
const PAQUETES = PLANES_OFRECIDOS.map((id) => {
  const def = PLANES_REALES[id];
  return {
    id,
    nombre: def.nombre,
    limite: def.limites.clientesActivos,
    // Ya formateado con su moneda: la landing no decide si un 9.99 son
    // dólares o colones — eso lo sabe el catálogo y nadie más.
    precio: precioDe(def),
    precioAnual: precioDe(def, "año"),
    esGratis: def.precioMensual === 0,
    incluye: def.capacidades.map((c) => ETIQUETAS_CAPACIDAD[c]),
    destacado: id === PLAN_DESTACADO,
  };
});

/**
 * Los tres pasos del alta, con lo que de verdad pasa en cada uno.
 *
 * `detalle` es el dato concreto —cuánto tarda, qué no hace falta— y no
 * un adjetivo: «sin diseñador» convence más que «fácil y rápido».
 */
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
      "En cada visita escaneás su código desde el panel. El sello entra al instante y la tarjeta se actualiza sola en su teléfono.",
    detalle: "Un escaneo · el saldo lo lleva el sistema",
  },
];



export default function LealtadPage() {
  return (
    // `data-tema="oscuro"` declara que esta pantalla es oscura a
    // propósito (ver globals.css). Con eso el navegador pinta lo suyo
    // —barras de scroll, cursor de texto, el textarea de la demo de
    // notificaciones— en esquema oscuro y deja de verse pegado encima.
    <main
      data-tema="oscuro"
      className="min-h-svh"
      style={{ background: NAVY_PROFUNDO, color: "#ffffff" }}
    >
      <RevealOnScroll />

      {/* La landing no tiene header (inmersiva a propósito): esta
          burbuja es la única puerta de vuelta al sitio. Fija, para que
          exista también a mitad del scroll. */}
      <Link
        href="/"
        className="fixed left-4 top-4 z-50 flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-bold text-white/85 backdrop-blur transition-colors hover:text-white"
        style={{ background: "rgba(10,18,38,.75)", borderColor: "rgba(255,255,255,.22)" }}
      >
        <span aria-hidden>←</span> Volver
      </Link>

      {/* La misma puerta que "¿Ya tenés el programa? Entrá acá" de más
          abajo, pero a un toque desde cualquier punto del scroll: quien
          ya tiene cuenta no debería tener que buscarla entre el resto
          del contenido de venta. */}
      <Link
        href="/lealtad/login"
        className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-bold text-white/85 backdrop-blur transition-colors hover:text-white"
        style={{ background: "rgba(10,18,38,.75)", borderColor: "rgba(255,255,255,.22)" }}
      >
        Entrar
        <span aria-hidden>→</span>
      </Link>

      <BurbujaContacto />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden pb-16 pt-14 sm:pb-24 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-[18%] top-[26%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-[140px]"
          style={{ background: NARANJA }}
        />

        <div className="relative mx-auto grid w-[min(1180px,92vw)] items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* ── El texto ──────────────────────────────────────────
              El ataque es la RETENCIÓN, no la adquisición: traer gente
              nueva es lo caro y lo que ya intentó con publicidad. Lo
              que no tiene es una razón para que vuelva. */}
          <div className="text-center lg:text-left">
            <p
              className="text-[12px] font-bold uppercase tracking-[0.22em]"
              style={{ color: NARANJA }}
            >
              Bookea Lealtad
            </p>

            <h1 className="titulo mt-5 text-balance text-[clamp(34px,5.4vw,60px)] leading-[1.03]">
              Atraé clientes. Convertilos en clientes de verdad.
            </h1>

            <p className="mx-auto mt-5 max-w-[52ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-white/60 lg:mx-0">
              Un cliente que vuelve vale más que tres que pasan una vez. Bookea Lealtad
              le da a cada persona una tarjeta en su teléfono —Apple Wallet y Google
              Wallet— que le recuerda por qué le conviene volver a tu negocio.
            </p>

            {/* Tres datos DUROS, no adjetivos: qué se paga, qué hay que
                instalar, cuánto se tarda. Son las tres objeciones que
                frenan a un dueño de local antes de leer nada más. */}
            <ul className="mx-auto mt-7 flex max-w-[52ch] flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] font-bold text-white/65 lg:mx-0 lg:justify-start">
              {[
                "Sin apps que instalar",
                "Sin contratos",
                "Sin tarjeta de crédito",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span aria-hidden style={{ color: NARANJA }}>
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/lealtad/nuevo"
                className="presionable w-full rounded-full px-8 py-4 text-center text-[15px] font-extrabold sm:w-auto"
                style={{ background: NARANJA, color: "#0a1226" }}
              >
                ¡Obtené tu pase gratis!
              </Link>
              <Link
                href="#precios"
                className="presionable w-full rounded-full border border-white/25 px-7 py-4 text-center text-[14.5px] font-bold text-white/90 sm:w-auto"
              >
                Ver precios
              </Link>
            </div>

            {/* ── LA PROMESA DE LOS 10 MINUTOS ──────────────────────
                Estaba acá abajo en gris al 45%, del mismo tamaño que
                un pie de página: la objeción más grande del dueño de
                un local —«esto me va a comer la semana»— contestada
                en letra que nadie lee.

                Ahora es una línea propia, con el número en naranja.
                No va en mayúsculas: un hero gritando se lee como
                anuncio de feria, y el resto del sitio no grita. El
                énfasis lo dan el tamaño, el color y el aire, que es
                lo que de verdad frena el ojo. */}
            <p className="mt-4 text-[14.5px] font-bold leading-snug text-white/75">
              <span style={{ color: NARANJA }}>En menos de 10 minutos</span> lo tenés
              listo y configurado.
            </p>

            {/* Para quien YA lo tiene. Sin esto la landing solo habla
                con el que todavía no compró, y el que ya pagó tiene que
                adivinar por dónde entra. */}
            <p className="mt-6 text-[13px] text-white/40">
              ¿Ya tenés el programa?{' '}
              <Link
                href="/lealtad/login"
                className="font-bold underline transition-colors hover:text-white/80"
                style={{ color: NARANJA }}
              >
                Entrá acá
              </Link>
            </p>
          </div>

          {/* ── El mockup ───────────────────────────────────────── */}
          <div className="relative">
            <TelefonoMockup>
              {/* La misma ficha que usa el acordeón, no una copia: acá
                  vivían el color y la foto de la cafetería duplicados,
                  y ya se habían desincronizado —el hero decía 8/10 y
                  más abajo la misma tarjeta decía 7/10—. */}
              <PantallaWallet
                negocio={FICHAS.sellos.negocio}
                colores={FICHAS.sellos.colores}
                arriba={FICHAS.sellos.arriba}
                valor={FICHAS.sellos.valor}
                abajo={FICHAS.sellos.abajo}
                foto={FICHAS.sellos.foto}
                detalle={FICHAS.sellos.detalle}
                movimientos={FICHAS.sellos.movimientos}
                sellos={[7, 10]}
              />
            </TelefonoMockup>
          </div>
          {/* ── La franja de prueba social ─────────────────────────
              Va DEBAJO de las dos columnas y no dentro de la del
              texto: así ocupa el vacío que dejaba el mockup —que es
              más alto que el texto— en vez de estirar una columna y
              descuadrar la otra.

              El número vive en UNA constante (arriba de este archivo)
              y no acá suelto, para que actualizarlo sea un solo
              cambio y no una búsqueda. */}
          <div className="lg:col-span-2">
            <PruebaSocial {...textoDelContador()} />
          </div>
        </div>
      </section>

      {/* ================= LOS OCHO TIPOS ================= */}
      {/* El acordeón sale del MISMO catálogo que el creador y el
          generador del pase (src/lib/lealtad/tipos-tarjeta.ts): la
          landing no puede prometer un tipo que el producto no tiene. */}
      <section className="px-5 py-24 sm:px-8">
        {/* ── POR QUÉ EL ANCHO ES `w-full max-w-…` Y NO `min(…,94vw)` ──
            Vale para todas las secciones de abajo, que llevan el mismo
            par `px-5` + contenedor centrado.

            La sección ya reserva su margen con `px-5`. Un ancho en
            `vw` NO sabe de ese padding: en 320px, `94vw` son 300,8px
            metidos en una caja de 280px, así que el bloque nacía 20px
            más ancho que su contenedor.

            Eso reventaba donde algo adentro usa `-mx-5` para sangrar
            hasta el borde de la pantalla —la fila de pestañas y el
            carrusel—: ese -20px cancelaba un padding que ya no
            quedaba, y la franja terminaba 21px afuera del viewport.
            De ahí el scroll horizontal de TODA la página en 320, 360,
            390 y 430.

            `w-full max-w-[…]` mide contra el contenedor y no contra
            la ventana: el margen lo pone `px-5` y las sangrías caen
            justo en el borde. El tope en px es el mismo de siempre. */}
        <div className="mx-auto w-full max-w-[1180px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Ocho formas de que vuelvan
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Elegí qué guardan en el teléfono
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Sellos, puntos, cupones, descuentos, membresías, gift cards, entradas y
              cashback. Cada uno vive en el Wallet y se actualiza solo.
            </p>
          </div>

          <div data-reveal className="mt-12">
            <AcordeonTipos />
          </div>
        </div>
      </section>

      <SeccionCrecimiento />

      <SeccionDashboard />

      {/* ================= LA DEMO DE NOTIFICACIONES ================= */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1080px]">
          <div data-reveal className="mx-auto max-w-[56ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Notificaciones
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(30px,5vw,54px)] leading-[1.06]">
              Previsualizá la notificación antes de enviarla.
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Escribila con las variables de cada cliente y mirá cómo le llega. Esto es una
              demostración: no manda nada ni guarda nada.
            </p>
          </div>

          <div
            data-reveal
            className="mt-12 rounded-3xl border border-white/12 p-5 sm:p-8"
            style={{ background: "rgba(255,255,255,.035)" }}
          >
            <DemoNotificacion />
          </div>
        </div>
      </section>

      {/* ================= ASÍ FUNCIONA, EN TRES PASOS ================= */}
      {/* Va ANTES de todo lo demás a propósito: quien llega no sabe qué
          es esto. Explicar el mecanismo en tres pasos concretos gana
          más que otra promesa de marketing. */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Así funciona
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08]">
              En diez minutos tenés tu tarjeta andando
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/55">
              Sin diseñador, sin desarrollador y sin que tus clientes instalen nada.
            </p>
          </div>

          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li
                key={p.titulo}
                data-reveal
                className="rounded-3xl border border-white/12 p-6"
                style={
                  {
                    background: "rgba(255,255,255,.04)",
                    "--reveal-delay": `${i * 80}ms`,
                  } as React.CSSProperties
                }
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-[15px] font-extrabold"
                  style={{ background: NARANJA, color: NAVY_PROFUNDO }}
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[18px] font-extrabold leading-tight text-white">
                  {p.titulo}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/60">{p.texto}</p>
                <p className="mt-4 text-[12px] font-bold" style={{ color: NARANJA }}>
                  {p.detalle}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= LOS NEGOCIOS ================= */}
      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1180px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Hecho para negocios con clientela que vuelve
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[22ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08]">
              Encontrá el tuyo y mirá cómo le quedaría
            </h2>
            <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/55">
              Cada rubro tiene su página: la tarjeta de ejemplo, la mecánica que le
              sirve y la regalía que sus clientes perseguirían.
            </p>
          </div>

          <div data-reveal className="mt-12">
            <CarruselNegocios />
          </div>
        </div>
      </section>

      {/* ================= PAQUETES ================= */}
      <section id="precios" className="scroll-mt-8 px-5 py-24 sm:px-8" style={{ background: NAVY }}>
        <div className="mx-auto w-full max-w-[1120px]">
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

          <div className="mt-14">
            <PaquetesCliente paquetes={PAQUETES} />
          </div>

          <p className="mt-8 text-center text-[12px] text-white/40">
            El pago es por SINPE Móvil o transferencia: adjuntás el comprobante
            con la solicitud y Bookea activa tu programa.
          </p>
        </div>
      </section>

      {/* ================= CIERRE ================= */}
      <section className="px-5 py-28 text-center sm:px-8">
        <div data-reveal className="mx-auto w-full max-w-[760px]">
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
