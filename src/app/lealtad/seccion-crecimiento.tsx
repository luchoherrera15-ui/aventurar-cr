import Link from "next/link";
import { Icono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * «Atraé y fidelizá»: el argumento comercial, con los mockups a un
 * lado y el texto al otro.
 *
 * Es la sección que responde POR QUÉ, no QUÉ. Las demás muestran el
 * producto; esta explica qué cambia en la caja del negocio.
 *
 * ------------------------------------------------------------------
 * NO HAY NÚMEROS INVENTADOS
 * ------------------------------------------------------------------
 * La tentación acá es poner «+40% de visitas» y un gráfico subiendo.
 * No hay de dónde sacar ese 40: Bookea no tiene todavía un histórico
 * que lo respalde, y un porcentaje inventado en una landing es una
 * promesa que después alguien reclama.
 *
 * Así que el argumento va con MECANISMOS —lo que de verdad pasa— en
 * vez de resultados prometidos. «El cliente ve cuánto le falta» es
 * comprobable; «vendés 40% más» no.
 */

const NARANJA = "#ee7420";

const RAZONES: { icono: Parameters<typeof Icono>[0]["nombre"]; titulo: string; texto: string }[] = [
  {
    icono: "clientes",
    titulo: "Vuelven más seguido",
    texto:
      "Una tarjeta empezada es una razón para elegirte a vos y no al de la esquina. El cliente ve cuánto le falta cada vez que abre el teléfono — no hay que recordárselo.",
  },
  {
    icono: "metricas",
    titulo: "Gastan más por visita",
    texto:
      "Cuando faltan dos sellos para la regalía, sumar el postre deja de ser un gasto y pasa a ser un paso. La meta hace el trabajo que hacía el descuento.",
  },
  {
    icono: "actividad",
    titulo: "Sabés quién dejó de venir",
    texto:
      "El programa registra cada visita, así que la lista de «hace dos meses no viene» se arma sola. Un cupón a esa lista es plata que ya estaba perdida.",
  },
];

export default function SeccionCrecimiento() {
  return (
    <section className="px-5 py-24 sm:px-8">
      {/* `w-full max-w-…` y no `min(…,92vw)`: la sección ya deja su
          margen con `px-5`, y un ancho en `vw` lo ignora — en 320px
          pedía 294px dentro de una caja de 280px. Ver el comentario
          largo en page.tsx. */}
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-14 lg:grid-cols-2">
        {/* ── Los mockups ─────────────────────────────────────── */}
        <div data-reveal className="order-2 lg:order-1">
          <PilaDeTelefonos />
        </div>

        {/* ── El texto ────────────────────────────────────────── */}
        <div data-reveal className="order-1 lg:order-2">
          <p
            className="text-[12px] font-bold uppercase tracking-[0.22em]"
            style={{ color: NARANJA }}
          >
            Atraé y fidelizá
          </p>
          <h2 className="titulo mt-4 max-w-[16ch] text-[clamp(30px,4.6vw,52px)] leading-[1.06]">
            Conseguir un cliente cuesta. Que vuelva, no.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/60">
            La publicidad te trae gente una vez. El programa de lealtad es lo que hace
            que esa gente vuelva sola — y traiga a la siguiente.
          </p>

          <ul className="mt-9 space-y-6">
            {RAZONES.map((r) => (
              <li key={r.titulo} className="flex gap-4">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                  style={{ background: "rgba(238,116,32,.14)", color: NARANJA }}
                >
                  <Icono nombre={r.icono} className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[17px] font-extrabold text-white">
                    {r.titulo}
                  </span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-white/60">
                    {r.texto}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/lealtad/nuevo"
            className="presionable mt-10 inline-block rounded-full px-7 py-3.5 text-[14.5px] font-extrabold"
            style={{ background: NARANJA, color: "#0a1226" }}
          >
            Quiero mi programa →
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Dos teléfonos escalonados: el del cliente con su tarjeta, y detrás
 * el aviso que le llega. Escalonados y no lado a lado porque la
 * columna no da el ancho, y superpuestos cuentan una secuencia —
 * primero la tarjeta, después el recordatorio.
 *
 * El ancho va en `w-full max-w-` y no en `88vw`: en 320px ese 88vw
 * daba 281,6px dentro de una columna de 280, o sea que la pila se
 * apoyaba en 1,6px de suerte. Y los dos teléfonos van ROTADOS, así que
 * sobresalen unos px de la caja a propósito — ese margen tiene que
 * sobrar, no faltar.
 */
function PilaDeTelefonos() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[360px]" aria-hidden>
      {/* El de atrás: la notificación */}
      <div
        className="absolute right-0 top-4 w-[190px] rotate-[5deg] overflow-hidden rounded-[26px] border-4 border-black/60 shadow-2xl"
        style={{ background: "linear-gradient(170deg, #22304f 0%, #101a33 60%, #0a1226 100%)" }}
      >
        <div className="px-3 pb-6 pt-6 text-center">
          <p className="text-[34px] font-light leading-none text-white">9:41</p>
          <p className="text-[9px] text-white/50">jueves 21</p>
        </div>
        <div className="px-2 pb-5">
          <div className="rounded-xl bg-white/15 px-2.5 py-2 backdrop-blur">
            <p className="text-[8px] font-semibold text-white/80">Café La Esquina</p>
            <p className="mt-0.5 text-[9.5px] leading-snug text-white/90">
              Te faltan 2 sellos para tu café. ¡Te esperamos!
            </p>
          </div>
        </div>
      </div>

      {/* El de adelante: la tarjeta */}
      <div
        className="organico absolute bottom-0 left-0 w-[210px] -rotate-[4deg] rounded-[26px] shadow-2xl"
        style={
          {
            background: "#4a2f1d",
            "--c1": "#4a2f1d",
            "--c2": "#8a5a33",
            "--c3": "#c98f4e",
          } as React.CSSProperties
        }
      >
        <div className="px-4 pb-4 pt-4">
          <p className="text-[11px] font-medium text-white/85">Café La Esquina</p>
          <p className="mt-3 text-[8px] uppercase tracking-[0.18em] text-white/50">Sellos</p>
          <p className="text-[26px] font-extrabold leading-none text-white">8/10</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="h-4 w-4 rounded-full"
                style={{ background: NARANJA, opacity: i < 8 ? 1 : 0.2 }}
              />
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-snug text-white/60">
            Al décimo, tu bebida favorita va por la casa
          </p>
        </div>
        <div className="bg-white px-4 py-3">
          <div className="mx-auto h-11 w-11 rounded bg-[#0a1226]" />
          <p className="mt-1 text-center text-[6.5px] text-[#53657f]">Powered by Bookea.lat</p>
        </div>
      </div>
    </div>
  );
}
