import type { Metadata } from "next";
import Link from "next/link";
import { sesionDelNavLealtad } from "@/lib/lealtad/sesion-nav";
import { enlaceWhatsapp } from "@/lib/contacto-bookea";
import NavLealtad from "../nav-lealtad";
import BurbujaContacto from "../burbuja-contacto";
import { Icono, type NombreIcono } from "../panel/[id]/iconos";
import { MaquetaInvitar, MaquetaPanel, MaquetaGanancias } from "./maquetas-partner";

/**
 * /lealtad/partner — LA PROPUESTA PARA QUIEN TRAE NEGOCIOS.
 *
 * Pedido del dueño (31 ago 2026): una página para «los moderadores o
 * partners», con tres pasos y sus maquetas.
 *
 * ------------------------------------------------------------------
 * DE QUÉ HABLA, EN CONCRETO
 * ------------------------------------------------------------------
 * El mecanismo YA existe en el producto y no es una promesa de folleto:
 * `agentes_lealtad` (migración 0219) guarda el nombre del agente y su
 * `codigo`, y ese código se escribe en el alta —el campo «¿Te atendió
 * un agente de Bookea?» del paso de paquetes— para que el negocio quede
 * acreditado a esa persona. Esta página es la cara pública de eso.
 *
 * ------------------------------------------------------------------
 * ⚠️ LO QUE ESTA PÁGINA NO PUEDE PROMETER TODAVÍA
 * ------------------------------------------------------------------
 * El PANEL del partner no está construido: hoy los agentes se siembran
 * a mano y no hay una pantalla donde el partner entre a ver sus
 * negocios ni sus montos. Por eso el paso 2 habla en futuro («vas a
 * tener») y no hay ningún botón que lleve a un panel inexistente: el
 * único camino real de esta página es postularse.
 *
 * Cuando ese panel exista, acá se cambia el tiempo verbal y se agrega
 * el enlace. Mientras tanto, prometerlo en presente sería vender una
 * pantalla que al partner nuevo le va a faltar el primer día.
 *
 * ------------------------------------------------------------------
 * Y TAMPOCO INVENTA UNA COMISIÓN
 * ------------------------------------------------------------------
 * No hay un porcentaje escrito en ningún lado del producto, así que la
 * página no dice «ganás X %»: dice que el ingreso es mensual y que se
 * conversa. Un número inventado acá es el que después hay que honrar.
 */

export const metadata: Metadata = {
  title: "Programa de partners · Bookea Lealtad",
  description:
    "Traé negocios a Bookea Lealtad y ganá un ingreso mensual mientras sigan activos. Tu código, tu panel y tus clientes.",
  alternates: { canonical: "/lealtad/partner" },
};

const PASOS: {
  numero: string;
  icono: NombreIcono;
  titulo: string;
  texto: string;
  maqueta: React.ReactNode;
}[] = [
  {
    numero: "01",
    icono: "afiliar",
    titulo: "Invitás a tus clientes",
    texto:
      "Te damos un código propio. Se lo pasás a los negocios que ya conocés —por WhatsApp, redes o en persona— y cuando se registran con él, quedan acreditados a tu nombre para siempre.",
    maqueta: <MaquetaInvitar />,
  },
  {
    numero: "02",
    icono: "metricas",
    titulo: "Vas a tener tu panel",
    texto:
      "Una pantalla propia para ver qué negocios trajiste, cuáles ya están activos, en qué paquete están y cuánto suman este mes. Sin pedirle el reporte a nadie.",
    maqueta: <MaquetaPanel />,
  },
  {
    numero: "03",
    icono: "moneda",
    titulo: "Ganás todos los meses",
    texto:
      "No es una comisión de una sola vez: mientras el negocio siga activo con su programa, vos seguís ganando. Cada negocio que traés se suma al ingreso del mes siguiente.",
    maqueta: <MaquetaGanancias />,
  },
];

const REQUISITOS: { icono: NombreIcono; texto: string }[] = [
  { icono: "personas", texto: "Tenés contacto con dueños de negocios que atienden clientes seguido" },
  { icono: "tarjeta", texto: "Entendés el producto: te ayudamos a armar tu primera tarjeta" },
  { icono: "reloj", texto: "Sin exclusividad ni horario: trabajás a tu ritmo" },
];

/**
 * El mensaje con el que se abre WhatsApp. Escrito una vez y usado en
 * los dos botones, para que el equipo reciba SIEMPRE la misma frase:
 * así se reconoce de un vistazo que el mensaje viene de esta página y
 * no de la burbuja de ayuda general.
 */
const MENSAJE_PARTNER = "¡Quiero ser partner!";

export default async function PaginaPartner() {
  const sesion = await sesionDelNavLealtad();

  // `enlaceWhatsapp` devuelve null si el número no está configurado.
  // En ese caso los botones caen a la burbuja de ayuda en vez de
  // apuntar a un `wa.me` roto.
  const whatsapp = enlaceWhatsapp(MENSAJE_PARTNER);

  return (
    <main className="relative min-h-svh bg-[#f7f9fc]">
      <NavLealtad logueado={sesion.logueado} nombre={sesion.nombre} />

      {/* ── EL ENCABEZADO ───────────────────────────────────────────
          Sin mockup al lado a propósito: los tres pasos de abajo ya
          traen tres maquetas, y una cuarta acá arriba compite con el
          titular en la primera pantalla. */}
      <section className="px-5 pb-14 pt-16 sm:px-8 sm:pb-16 sm:pt-20">
        <div className="mx-auto w-full max-w-[820px] text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{
              background: "var(--hoja)",
              borderColor: "var(--line)",
              color: "var(--navy)",
            }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--orange)" }}
            />
            Programa de partners
          </span>

          <h1 className="titulo mx-auto mt-5 max-w-[20ch] text-[38px] leading-[1.05] text-aventurea-ink sm:text-[52px]">
            Traé negocios a Bookea y ganá{" "}
            <span className="text-aventurea-navy">todos los meses</span>.
          </h1>

          <p className="mx-auto mt-5 max-w-[58ch] text-[16px] leading-relaxed text-aventurea-ink-soft sm:text-[17.5px]">
            Si ya trabajás con dueños de cafeterías, salones o tiendas, tenés lo más difícil:
            la confianza. Nosotros ponemos el producto, la plataforma y el soporte.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {/* Sale del sitio, así que es un <a> y no un <Link>: se
                puede abrir en otra pestaña y copiar. */}
            <a
              href={whatsapp ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="presionable inline-flex min-h-[48px] items-center rounded-xl px-6 text-[14px] font-extrabold"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              Quiero ser partner →
            </a>
            <Link
              href="/lealtad"
              className="presionable inline-flex min-h-[48px] items-center rounded-xl border px-6 text-[14px] font-extrabold text-aventurea-ink"
              style={{ borderColor: "var(--line)", background: "var(--hoja)" }}
            >
              Ver el producto
            </Link>
          </div>
        </div>
      </section>

      {/* ── LOS TRES PASOS ──────────────────────────────────────────
          En filas alternadas y no en tres columnas: cada paso tiene un
          párrafo de verdad y una maqueta con detalle, y en una columna
          de un tercio las dos cosas quedan ilegibles. Alternando el
          lado, además, la vista no cae en la monotonía de tres bloques
          idénticos. */}
      <section className="px-5 pb-8 sm:px-8">
        <div className="mx-auto w-full max-w-[1080px] space-y-6">
          {PASOS.map((p, i) => (
            <article
              key={p.numero}
              className="grid items-center gap-8 rounded-[24px] border bg-white p-6 sm:p-10 lg:grid-cols-2 lg:gap-12"
              style={{ borderColor: "var(--line)" }}
            >
              <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                <span className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]"
                    style={{ background: "var(--accion-suave)", color: "var(--accion)" }}
                  >
                    <Icono nombre={p.icono} className="h-5 w-5" />
                  </span>
                  <span
                    className="text-[13px] font-extrabold tabular-nums"
                    style={{ color: "var(--accion)" }}
                  >
                    {p.numero}
                  </span>
                </span>
                <h2 className="titulo mt-4 text-[26px] leading-tight text-aventurea-ink sm:text-[30px]">
                  {p.titulo}
                </h2>
                <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
                  {p.texto}
                </p>
              </div>

              <div
                className={`flex items-center justify-center rounded-[18px] px-4 py-8 ${
                  i % 2 === 1 ? "lg:order-1" : ""
                }`}
                style={{ background: "var(--accion-suave)" }}
              >
                {p.maqueta}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── A QUIÉN LE SIRVE ────────────────────────────────────────
          Tres líneas honestas en vez de «requisitos»: no hay examen ni
          cuota, y decirlo así evita que alguien no escriba por creer
          que le falta algo. */}
      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-[1080px]">
          <h2 className="titulo text-center text-[28px] leading-tight text-aventurea-ink sm:text-[34px]">
            ¿Esto es para vos?
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {REQUISITOS.map((r) => (
              <div
                key={r.texto}
                className="elevar rounded-[18px] border bg-white p-5"
                style={{ borderColor: "var(--line)" }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-[12px]"
                  style={{ background: "var(--navy-suave)", color: "var(--navy)" }}
                >
                  <Icono nombre={r.icono} className="h-5 w-5" />
                </span>
                <p className="mt-3.5 text-[14px] leading-relaxed text-aventurea-ink">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EL CIERRE ───────────────────────────────────────────────
          El único camino real de la página: escribirnos. No hay un
          «entrá a tu panel» porque ese panel todavía no existe (ver la
          cabecera del archivo). */}
      <section className="px-5 pb-20 sm:px-8">
        <div
          className="mx-auto w-full max-w-[1080px] rounded-[24px] px-6 py-12 text-center sm:px-12 sm:py-16"
          style={{ background: "var(--navy)" }}
        >
          <h2 className="titulo mx-auto max-w-[22ch] text-[28px] leading-tight text-white sm:text-[36px]">
            Contanos a cuántos negocios podés llegar
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed text-aventurea-rail">
            Conversamos cómo funciona el programa, cuánto se gana por negocio y te damos tu
            código. Sin compromiso.
          </p>
          <p className="mx-auto mt-7">
            <a
              href={whatsapp ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="presionable inline-flex min-h-[48px] items-center rounded-xl px-6 text-[14px] font-extrabold"
              style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
            >
              Escribinos por WhatsApp →
            </a>
          </p>
          <p className="mt-4 text-[12.5px] text-aventurea-rail">
            O tocá el botón de ayuda de la esquina y te contestamos por WhatsApp.
          </p>
        </div>
      </section>

      <BurbujaContacto />
    </main>
  );
}
