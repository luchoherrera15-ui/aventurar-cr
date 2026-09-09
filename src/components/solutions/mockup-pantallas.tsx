import { IconCheck, IconCloche, IconStar } from "@/components/icons";
import type { DatosPagina } from "./vista-pagina";
import {
  paletaDelTema,
  pilaFuente,
  PRESETS,
  RADIOS,
  type Fuente,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";

/**
 * LAS PANTALLAS DE MUESTRA DEL HÉROE — el menú y el pase.
 *
 * Pedido del dueño (4 sep 2026): «que cada card tenga algo distinto: la
 * menú, el linktree, el pase de lealtad».
 *
 * ── POR QUÉ ESTAS DOS SON PROPIAS Y EL LINKTREE NO ─────────────────
 * El linktree del medio monta `VistaPagina`, el componente REAL que
 * sirve /s/<slug>: ahí no hay imitación posible ni necesaria.
 *
 * El menú y el pase no pueden hacer lo mismo, y por razones concretas:
 *
 *   · El menú real (`MenuConCarrito`) es un componente de cliente con
 *     carrito, hoja de confirmación y una server action detrás. Meter
 *     eso en un héroe sería cargar el pedido entero para dibujar cuatro
 *     platos.
 *   · El pase real (`VistaPase`, de Lealtad) siempre dibuja sus
 *     pestañas Apple/Google y el aviso de «vista aproximada»: son
 *     controles del EDITOR, no de un aparato. Dentro de un teléfono se
 *     leerían como parte de la pantalla del cliente, que es mentira.
 *
 * Así que estas dos son maquetas de venta, y se declaran como tales.
 * Lo que sí comparten con lo real es el SISTEMA DE DISEÑO: los colores,
 * los radios, las tintas y la cara tipográfica salen de los mismos
 * helpers que viste la página de verdad (`paletaDelTema`, `RADIOS`,
 * `pilaFuente`). Por eso tocar un tema en el héroe las repinta a las
 * tres igual que a /s/<slug> — y por eso una cara nueva en la 0232
 * aparece acá sola, sin tocar este archivo.
 */

/**
 * EL NEGOCIO DE MUESTRA — «Casa Nostra».
 *
 * Una sola muestra para el héroe y para las cards de la landing: si
 * cambia el nombre o un enlace, cambia en todos lados a la vez. Lo que
 * cada pantalla decide aparte es el vestido (tema, cara, acabado).
 */
export const MUESTRA_PAGINA: Omit<
  DatosPagina,
  "tema" | "estiloLinks" | "redondeo" | "colorAcento" | "fuente" | "efecto" | "estiloPortada"
> = {
  nombre: "Casa Nostra",
  bajada: "Pastas caseras, horno de leña y vinos de la casa.",
  logoUrl: null,
  fotoPortadaUrl: null,
  whatsapp: "88887777",
  direccion: "Av. Principal 123",
  colorFondo: "#0a1226",
  links: [
    { id: "1", etiqueta: "Reservar con descuento", url: "#", icono: "reservar" },
    { id: "2", etiqueta: "Pedir para recoger", url: "#", icono: "tienda" },
    { id: "3", etiqueta: "Cómo llegar", url: "#", icono: "mapa" },
    { id: "4", etiqueta: "Escribinos", url: "#", icono: "whatsapp" },
  ],
  seccionesMenu: ["Entradas", "Pastas", "Postres"],
  hayMenu: true,
  aceptaPedidos: true,
  mesa: null,
};

const PLATOS = [
  { n: "Tagliatelle al ragú", d: "Ocho horas de cocción lenta", p: "₡8 900" },
  { n: "Burrata con tomate", d: "Albahaca y aceite de oliva", p: "₡6 400" },
  { n: "Risotto de hongos", d: "Porcini y parmesano", p: "₡9 200" },
  { n: "Tiramisú de la casa", d: "Receta de la nonna", p: "₡3 800" },
];

/** EL MENÚ — secciones, platos y precios, como se ven en /s/<slug>/menu. */
export function MockupCarta({
  tema,
  redondeo,
  acento,
  fuente,
  nombre = "Casa Nostra",
  portadaUrl = null,
}: {
  tema: Tema;
  redondeo: Redondeo;
  acento: string;
  fuente: Fuente;
  nombre?: string;
  /** La foto de portada arriba del título, como en /s/<slug>/menu. */
  portadaUrl?: string | null;
}) {
  const p = paletaDelTema(tema, "#0a1226", acento);
  const r = RADIOS[redondeo] ?? RADIOS.suave;

  return (
    <div
      className="flex min-h-full flex-col px-4 pb-6 pt-12"
      style={{
        background: `linear-gradient(180deg, ${p.fondo} 0%, ${p.fondo2} 100%)`,
        color: p.tinta,
        fontFamily: pilaFuente(fuente),
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ border: `1px solid ${p.borde}`, color: p.suave }}
        >
          ← {nombre}
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ background: p.superficie, border: `1px solid ${p.borde}` }}
        >
          Mesa 4
        </span>
      </div>

      {/* La portada, si la hay: de borde a borde y fundida hacia el
          fondo, igual que en /s/<slug>/menu. */}
      {portadaUrl && (
        <div aria-hidden className="relative -mx-4 mt-3 h-[112px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portadaUrl} alt="" className="h-full w-full object-cover" />
          <span
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, transparent 40%, ${p.fondo} 100%)` }}
          />
        </div>
      )}

      <h2 className="mt-4 text-[19px] font-extrabold leading-tight">El menú</h2>
      <p className="mt-0.5 text-[10.5px]" style={{ color: p.suave }}>
        Elegí y pedí desde tu mesa
      </p>

      {/* Las anclas de sección, como en el menú real. */}
      <div className="mt-3 flex gap-1.5">
        {["Entradas", "Pastas", "Postres"].map((s, i) => (
          <span
            key={s}
            className="rounded-full px-2.5 py-1 text-[9.5px] font-bold"
            style={{
              background: i === 1 ? p.acento : p.superficie,
              color: i === 1 ? p.tintaSobreAcento : p.tinta,
              border: `1px solid ${i === 1 ? p.acento : p.borde}`,
            }}
          >
            {s}
          </span>
        ))}
      </div>

      <ul className="mt-3.5 flex flex-col gap-2">
        {PLATOS.map((x, i) => (
          <li
            key={x.n}
            className="flex items-center gap-2.5 border p-2"
            style={{ background: p.superficie, borderColor: i === 0 ? p.acento : p.borde, borderRadius: r.pieza }}
          >
            {/* El lugar de la foto. Un bloque con el ícono y no una
                imagen inventada: prometer fotos de comida que el negocio
                todavía no subió sería vender otra cosa. */}
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center"
              style={{ background: p.fondo2, borderRadius: r.foto, color: p.suave }}
            >
              <IconCloche className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-extrabold leading-tight">{x.n}</span>
              <span className="block truncate text-[9.5px]" style={{ color: p.suave }}>
                {x.d}
              </span>
              <span className="mt-0.5 block text-[11px] font-bold" style={{ color: p.acento }}>
                {x.p}
              </span>
            </span>
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center text-[15px] font-extrabold"
              style={{ background: p.acento, color: p.tintaSobreAcento, borderRadius: 999 }}
            >
              +
            </span>
          </li>
        ))}
      </ul>

      {/* La barra del carrito, que es lo que cuenta la historia: acá se
          pide. */}
      <div
        className="mt-auto flex items-center justify-between px-4 py-2.5 text-[11.5px] font-extrabold"
        style={{ background: p.acento, color: p.tintaSobreAcento, borderRadius: r.pieza }}
      >
        <span>Ver pedido · 3</span>
        <span className="tabular-nums">₡21 200 →</span>
      </div>
    </div>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PASE DE LEALTAD — la pantalla de Wallet, no una tarjeta suelta
 * ════════════════════════════════════════════════════════════════════
 *
 * Rehecho el 8 sep 2026: el dueño lo vio en la landing y dijo «ese paso
 * digital se ve supermal». Tenía razón, y el problema no era la tarjeta
 * sino el CONTEXTO: flotaba sobre un panel beige, con la palabra
 * «Wallet» suelta arriba y una lista de ventajas abajo. Se leía como una
 * lámina de PowerPoint, no como el teléfono de un cliente.
 *
 * Ahora es lo que de verdad se ve al abrir Wallet:
 *   · fondo casi negro, como la app;
 *   · la barra de arriba con «Wallet» y el + ;
 *   · LA PILA: dos pases asomando detrás del que está al frente, que es
 *     la seña visual que hace que se lea como Wallet y no como una card;
 *   · el pase con su cabecera (logo, negocio, contador), su franja de
 *     sellos, la línea del premio y el código de barras sobre blanco.
 *
 * Va DENTRO de `<Telefono>` en las landings: el marco del aparato es
 * lo que termina de venderlo. Este componente es solo la pantalla.
 */
export function MockupPase({
  tema,
  acento,
  fuente,
  nombre = "Casa Nostra",
}: {
  tema: Tema;
  acento: string;
  fuente: Fuente;
  nombre?: string;
}) {
  const p = paletaDelTema(tema, "#0a1226", acento);
  const sellos = 7;
  const meta = 10;
  const inicial = nombre.trim().charAt(0).toUpperCase() || "B";

  return (
    <div
      className="flex min-h-full flex-col px-3.5 pb-5 pt-10"
      style={{ background: "linear-gradient(180deg,#101114 0%,#08090b 42%)", fontFamily: pilaFuente(fuente) }}
    >
      {/* La barra de la app. */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[19px] font-extrabold tracking-[-0.02em] text-white">Wallet</span>
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-white/12 text-[15px] font-bold leading-none text-white/80">
          +
        </span>
      </div>

      {/* LA PILA. Los dos de atrás no llevan contenido a propósito: son
          el canto de otras tarjetas, y con texto competirían con el que
          importa. */}
      <div className="relative mt-5">
        <span
          aria-hidden
          className="absolute inset-x-6 -top-3 h-8 rounded-[14px]"
          style={{ background: "#343a45", boxShadow: "0 -6px 14px rgba(0,0,0,.45)" }}
        />
        <span
          aria-hidden
          className="absolute inset-x-3 -top-1.5 h-8 rounded-[15px]"
          style={{ background: "#4a5162", boxShadow: "0 -6px 14px rgba(0,0,0,.45)" }}
        />

        <div
          className="relative overflow-hidden"
          style={{
            background: p.acento,
            color: p.tintaSobreAcento,
            borderRadius: 17,
            boxShadow: "0 18px 34px -12px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.16)",
          }}
        >
          {/* Cabecera: logo, negocio y contador — el orden de un pase real. */}
          <div className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-3">
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[12px] font-extrabold"
              style={{ background: "rgba(255,255,255,.92)", color: p.acento }}
            >
              {inicial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-extrabold leading-tight">{nombre}</span>
              <span className="block text-[9px] uppercase tracking-[0.12em] opacity-70">Tarjeta de sellos</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[8px] font-bold uppercase tracking-[0.14em] opacity-70">Sellos</span>
              <span className="block text-[17px] font-extrabold leading-none tabular-nums">
                {sellos}<span className="text-[11px] opacity-70">/{meta}</span>
              </span>
            </span>
          </div>

          {/* La franja: en un pase de Wallet los sellos van sobre una
              banda más oscura que el cuerpo. Es lo que se mira primero. */}
          <div className="px-2.5 pb-2.5">
            <div className="rounded-[11px] px-2.5 py-2.5" style={{ background: "rgba(0,0,0,.16)" }}>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: meta }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="grid aspect-square place-items-center rounded-full"
                    style={{
                      background: i < sellos ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.14)",
                      color: p.acento,
                      boxShadow: i < sellos ? "0 1px 2px rgba(0,0,0,.25)" : "inset 0 0 0 1px rgba(255,255,255,.18)",
                    }}
                  >
                    {i < sellos && <IconStar className="h-[8px] w-[8px]" />}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 flex items-baseline justify-between text-[9px] font-bold uppercase tracking-[0.12em] opacity-75">
                Próxima regalía
                <span className="text-[11px] font-extrabold normal-case tracking-normal opacity-100">
                  Te faltan {meta - sellos}
                </span>
              </p>
            </div>
          </div>

          {/* El código, sobre blanco: ningún pase lo lleva sobre el color. */}
          <div className="bg-white px-3.5 pb-3 pt-3">
            <div aria-hidden className="flex h-8 items-end justify-center gap-[2px]">
              {Array.from({ length: 38 }, (_, i) => (
                <span
                  key={i}
                  className="w-[2px] bg-[#10192e]"
                  style={{ height: `${[100, 55, 80, 40, 95, 65, 88, 48][i % 8]}%` }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-center text-[7.5px] font-bold uppercase tracking-[0.22em] text-[#10192e]/55">
              {nombre} · Bookea
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 px-1 text-center text-[10px] font-semibold leading-relaxed text-white/45">
        Se actualiza sola cada vez que le sellan.
        <br />
        Apple Wallet y Google Wallet.
      </p>

      {/* Las OTRAS tarjetas del cliente, plegadas contra el borde de
          abajo. Wallet se ve así, y sin ellas la pantalla queda vacía
          debajo del pase — que fue justo lo que se veía mal. */}
      <div aria-hidden className="mt-auto -mx-3.5 flex flex-col">
        <span className="mx-4 h-9 rounded-t-[15px]" style={{ background: "#5c6474", boxShadow: "0 -8px 18px rgba(0,0,0,.5)" }} />
        <span className="mx-2 -mt-4 h-9 rounded-t-[16px]" style={{ background: "#8a93a6", boxShadow: "0 -8px 18px rgba(0,0,0,.5)" }} />
        <span className="-mt-4 h-10 rounded-t-[17px]" style={{ background: "#d8dde6", boxShadow: "0 -8px 18px rgba(0,0,0,.5)" }} />
      </div>
    </div>
  );
}

/**
 * EL PEDIDO RECIBIDO — la confirmación que ve el cliente (0233).
 *
 * Pedido del dueño (5 sep 2026): To go y Exprés se piden POR LA WEB y
 * caen en el Modo restaurante. Esta pantalla es lo que el cliente ve
 * después de enviar: el código, la modalidad, qué pidió y cómo paga.
 * Reemplaza a la maqueta del chat de WhatsApp, que vendía un flujo que
 * ya no es el del producto.
 */
export function MockupPedido({ nombre = "Casa Nostra" }: { nombre?: string }) {
  const p = paletaDelTema("claro", "#0a1226", PRESETS.claro.acentoSugerido);
  return (
    <div
      className="flex min-h-full flex-col px-4 pb-6 pt-12"
      style={{ background: `linear-gradient(180deg, ${p.fondo} 0%, ${p.fondo2} 100%)`, color: p.tinta }}
    >
      <span className="self-start rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ border: `1px solid ${p.borde}`, color: p.suave }}>
        ← {nombre}
      </span>

      <div className="mt-4 rounded-2xl border p-3.5" style={{ background: p.superficie, borderColor: p.acento }}>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
            style={{ background: p.acento, color: p.tintaSobreAcento }}
          >
            <IconCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-extrabold leading-tight">Pedido #A1B2 recibido</span>
            <span className="block text-[10px]" style={{ color: p.suave }}>
              Hoy, 9:41
            </span>
          </span>
          <span
            className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em]"
            style={{ background: p.acento, color: p.tintaSobreAcento }}
          >
            To go
          </span>
        </div>

        <ul className="mt-3 flex flex-col gap-1 text-[10.5px]">
          <li className="flex justify-between gap-2"><span>2× Tagliatelle al ragú</span><span className="tabular-nums" style={{ color: p.suave }}>₡17 800</span></li>
          <li className="flex justify-between gap-2"><span>1× Burrata con tomate</span><span className="tabular-nums" style={{ color: p.suave }}>₡6 400</span></li>
        </ul>
        <div className="mt-2 flex justify-between border-t pt-2 text-[11.5px] font-extrabold" style={{ borderColor: p.borde }}>
          <span>Total</span>
          <span className="tabular-nums">₡24 200</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl px-3 py-2.5 text-[10.5px] leading-snug" style={{ background: p.superficie, color: p.tinta }}>
        Pagás en efectivo al recoger. Te avisamos al <strong>8888 7777</strong> cuando esté listo.
      </div>

      <p className="mt-3 text-[9.5px]" style={{ color: p.suave }}>
        En el local ya lo ven en su Modo restaurante.
      </p>
    </div>
  );
}
