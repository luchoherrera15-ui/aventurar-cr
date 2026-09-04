import { IconCheck, IconCloche, IconStar } from "@/components/icons";
import type { DatosPagina } from "./vista-pagina";
import {
  paletaDelTema,
  pilaFuente,
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
}: {
  tema: Tema;
  redondeo: Redondeo;
  acento: string;
  fuente: Fuente;
  nombre?: string;
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

/** EL PASE DE LEALTAD — cómo le queda al cliente en su Wallet. */
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

  return (
    <div
      className="flex min-h-full flex-col px-4 pb-6 pt-12"
      style={{
        background: `linear-gradient(180deg, ${p.fondo} 0%, ${p.fondo2} 100%)`,
        color: p.tinta,
        fontFamily: pilaFuente(fuente),
      }}
    >
      <p className="text-[13px] font-extrabold">Wallet</p>

      {/* La tarjeta: el objeto que de verdad guarda el cliente. */}
      <div
        className="mt-3 overflow-hidden shadow-lg"
        style={{ background: p.acento, color: p.tintaSobreAcento, borderRadius: 16 }}
      >
        <div className="flex items-start justify-between p-3.5">
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-extrabold leading-tight">{nombre}</span>
            <span className="block text-[9.5px] opacity-75">Tarjeta de sellos</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[8.5px] font-bold uppercase tracking-[0.14em] opacity-75">Sellos</span>
            <span className="block text-[15px] font-extrabold leading-none tabular-nums">
              {sellos}/{meta}
            </span>
          </span>
        </div>

        {/* Los sellos, que es lo que la persona mira. */}
        <div className="grid grid-cols-5 gap-1.5 px-3.5 pb-3.5">
          {Array.from({ length: meta }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="grid aspect-square place-items-center rounded-full"
              style={{
                background: i < sellos ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.18)",
                color: p.acento,
              }}
            >
              {i < sellos && <IconStar className="h-[9px] w-[9px]" />}
            </span>
          ))}
        </div>

        <div className="px-3.5 pb-3.5">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] opacity-75">
            Para tu próxima regalía
          </p>
          <p className="text-[11.5px] font-extrabold">Te faltan 3 sellos</p>
        </div>

        {/* El código de barras del pase — sin inventar un QR real. */}
        <div className="bg-white px-3.5 py-3">
          <div aria-hidden className="flex h-9 items-end justify-center gap-[2px]">
            {Array.from({ length: 34 }, (_, i) => (
              <span
                key={i}
                className="w-[2px] bg-[#10192e]"
                style={{ height: `${[100, 55, 80, 40, 95, 65][i % 6]}%` }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-center text-[8px] tracking-[0.2em] text-[#10192e]/60">
            BOOKEA · CASA NOSTRA
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-1.5">
        {["Se agrega con el QR del mostrador", "Sin apps que instalar", "Apple y Google Wallet"].map((t) => (
          <li key={t} className="flex items-center gap-2 text-[10.5px]" style={{ color: p.suave }}>
            {/* Los íconos del set solo aceptan `className`, así que el
                color lo pone el envoltorio y el SVG lo hereda. */}
            <span aria-hidden className="shrink-0" style={{ color: p.acento }}>
              <IconCheck className="h-3 w-3" />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * EL PEDIDO EN EL CHAT — cómo le llega al negocio por WhatsApp (0233).
 *
 * Los colores son los de WhatsApp (fondo, cabecera, burbuja saliente)
 * y no los del sistema, a propósito: la card vende «te llega por
 * WhatsApp», y para que eso se lea de un vistazo tiene que PARECER
 * WhatsApp. Es la única pantalla de Solutions con colores de un
 * tercero, y solo vive en la vitrina.
 *
 * El mensaje es el mismo formato que arma `whatsapp.ts`: título en
 * negrita, modalidad, renglones, total, datos del cliente en orden
 * fijo. Si aquello cambia, esto debería cambiar igual.
 */
export function MockupPedidoWhatsapp({ nombre = "Casa Nostra" }: { nombre?: string }) {
  const inicial = nombre.trim().charAt(0).toUpperCase();
  return (
    <div className="flex min-h-full flex-col pt-11" style={{ background: "#0b141a", color: "#e9edef" }}>
      <div className="flex items-center gap-2.5 px-3 py-2" style={{ background: "#1f2c34" }}>
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
          style={{ background: "#25d366", color: "#0b141a" }}
        >
          {inicial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-extrabold leading-tight">{nombre}</span>
          <span className="block text-[9.5px] opacity-70">en línea</span>
        </span>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-4 pt-3">
        <div
          className="ml-auto w-[94%] rounded-2xl rounded-tr-sm px-3 py-2 text-[10.5px] leading-[1.45]"
          style={{ background: "#005c4b" }}
        >
          <p className="font-extrabold">Pedido #A1B2 · {nombre}</p>
          <p className="opacity-90">Exprés</p>
          <p className="mt-1.5">
            2× Tagliatelle al ragú — ₡17 800
            <br />
            1× Burrata con tomate — ₡6 400
            <br />
            Envío — ₡1 500
          </p>
          <p className="font-extrabold">Total: ₡25 700</p>
          <p className="mt-1.5">
            Nombre: Luis
            <br />
            Teléfono: 8888 7777
            <br />
            Dirección: Escazú, 200 m sur del parque
            <br />
            Pago: Efectivo
          </p>
          <p className="mt-1 text-right text-[8.5px] opacity-60">9:41 ✓✓</p>
        </div>
        <div className="mr-auto max-w-[82%] rounded-2xl rounded-tl-sm px-3 py-2 text-[10.5px]" style={{ background: "#1f2c34" }}>
          ¡Recibido, Luis! Sale en 25 min.
          <span className="ml-2 text-[8.5px] opacity-60">9:42</span>
        </div>
      </div>
    </div>
  );
}
