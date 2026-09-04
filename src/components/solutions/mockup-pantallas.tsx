import { IconCheck, IconCloche, IconStar } from "@/components/icons";
import {
  paletaDelTema,
  pilaFuente,
  RADIOS,
  type Fuente,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";

/**
 * LAS PANTALLAS DE MUESTRA DEL HÉROE — la carta y el pase.
 *
 * Pedido del dueño (4 sep 2026): «que cada card tenga algo distinto: la
 * carta, el linktree, el pase de lealtad».
 *
 * ── POR QUÉ ESTAS DOS SON PROPIAS Y EL LINKTREE NO ─────────────────
 * El linktree del medio monta `VistaPagina`, el componente REAL que
 * sirve /s/<slug>: ahí no hay imitación posible ni necesaria.
 *
 * La carta y el pase no pueden hacer lo mismo, y por razones concretas:
 *
 *   · La carta real (`MenuConCarrito`) es un componente de cliente con
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

const PLATOS = [
  { n: "Tagliatelle al ragú", d: "Ocho horas de cocción lenta", p: "₡8 900" },
  { n: "Burrata con tomate", d: "Albahaca y aceite de oliva", p: "₡6 400" },
  { n: "Risotto de hongos", d: "Porcini y parmesano", p: "₡9 200" },
  { n: "Tiramisú de la casa", d: "Receta de la nonna", p: "₡3 800" },
];

/** LA CARTA — secciones, platos y precios, como se ven en /s/<slug>/menu. */
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

      {/* Las anclas de sección, como en la carta real. */}
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
