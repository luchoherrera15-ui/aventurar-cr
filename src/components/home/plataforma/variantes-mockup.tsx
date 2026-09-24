import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import { configPorDefecto } from "@/lib/lealtad/tipos-tarjeta";
import { textoDelPedido, type PedidoParaWhatsapp } from "@/lib/solutions/whatsapp";
import { IconInstagram, IconWhatsapp } from "@/components/icons";
import DemoAutomatizacion from "./demo-automatizacion";
import DemoReservas from "./demo-reservas";
import { VerMas } from "./piezas";
import PiezaPagina from "./pieza-pagina";
import { PRODUCTOS } from "@/lib/productos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS CUATRO VARIANTES — material de comparación, no de producción
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (23 sep 2026): «hagamos pruebas con los 4 tipos de
 * diseño, mostrame para ver cómo se verían».
 *
 * Las cuatro enseñan LO MISMO —menú, lealtad, automatizaciones y
 * marketplace— y cambian solo la forma de presentarlo. Viven juntas en
 * un archivo a propósito: es una comparación que se mira una vez y se
 * tira, no una biblioteca. Cuando se elija una, esa se muda a
 * `cuatro-productos.tsx` y este archivo se borra entero.
 *
 * ⚠️ Nada de esto está enlazado desde el home. Vive en
 * `/prueba-mockups`, que además no se indexa.
 *
 * Las piezas de producto son las de siempre: `VistaPase` (Lealtad, que
 * solo se importa) y `textoDelPedido()` (el mensaje real de WhatsApp).
 */

// ── Los datos, compartidos por las cuatro ──────────────────────────

/**
 * El logo y la banda del pase, como SVG en un `data:` URI.
 *
 * `VistaPase` los pinta con `<img src>`, así que cualquier URL sirve —
 * y un SVG embebido evita meter un archivo al repo para una
 * demostración. Sin logo el pase se veía a medio terminar: el aro
 * quedaba vacío y la banda superior no existía.
 *
 * ⚠️ `encodeURIComponent` no es opcional: el `#` de los colores corta
 * el `data:` URI en seco y el navegador se queda con medio SVG.
 */
const svg = (contenido: string) =>
  `data:image/svg+xml,${encodeURIComponent(contenido)}`;

/** Una taza, en el ámbar del sello sobre el café del pase. */
const LOGO_CAFE = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#1d1410"/>
  <path d="M18 24h22v12a11 11 0 0 1-11 11h0a11 11 0 0 1-11-11V24Z"
        fill="none" stroke="#e0a34a" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M40 27h4a5 5 0 0 1 0 10h-4"
        fill="none" stroke="#e0a34a" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M24 12c0 3-2 3-2 6M31 12c0 3-2 3-2 6"
        fill="none" stroke="#e0a34a" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>
</svg>`);

/** La banda de arriba: granos difusos, nada de foto de archivo. */
const BANDA_CAFE = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b1c14"/>
      <stop offset="55%" stop-color="#4a3122"/>
      <stop offset="100%" stop-color="#7a5333"/>
    </linearGradient>
  </defs>
  <rect width="320" height="90" fill="url(#g)"/>
  <g fill="#e0a34a" opacity=".22">
    <ellipse cx="40" cy="26" rx="13" ry="9" transform="rotate(-25 40 26)"/>
    <ellipse cx="96" cy="64" rx="11" ry="7.5" transform="rotate(15 96 64)"/>
    <ellipse cx="168" cy="30" rx="14" ry="9.5" transform="rotate(-10 168 30)"/>
    <ellipse cx="236" cy="62" rx="12" ry="8" transform="rotate(30 236 62)"/>
    <ellipse cx="290" cy="28" rx="10" ry="7" transform="rotate(-18 290 28)"/>
  </g>
</svg>`);

const BASE = configPorDefecto("sellos");
const PASE: DatosVista = {
  negocioNombre: "Café Aroma",
  modo: "sellos",
  beneficio: BASE.tipo === "sellos" ? { ...BASE, recompensa: "Un café gratis" } : BASE,
  colorFondo: "#1d1410",
  colorSello: "#e0a34a",
  logoUrl: LOGO_CAFE,
  bannerUrl: BANDA_CAFE,
  // Sin esto los sellos son discos lisos. `iconoSello` es la opción
  // real del producto (0145, doce íconos): una cafetería marca con
  // taza. El default —`null`— usa el logo, que en este pase es una
  // taza ya recortada y adentro del disco se perdía.
  iconoSello: "cafe",
  saldoEjemplo: 7,
};

const PEDIDO: PedidoParaWhatsapp = {
  negocio: "Casa Matcha",
  slug: "casa-matcha",
  codigo: "7F2A",
  modalidad: "llevar",
  renglones: [
    { nombre: "Matcha latte", cantidad: 2, precio: 3200, detalles: ["Leche de almendra"] },
    { nombre: "Cheesecake", cantidad: 1, precio: 2800 },
  ],
  costoEnvio: 0,
  total: 9200,
  cliente: {
    nombre: "María Jiménez",
    telefono: "8888 0000",
    cedula: "",
    direccion: "",
    metodoPago: "transferencia",
    nota: "",
  },
};

const AZUL = "#2447BF";

const PLATOS = [
  { nombre: "Matcha latte", detalle: "Leche de almendra · con opciones", precio: "₡3.200", n: 2 },
  { nombre: "Cheesecake de matcha", detalle: "Recién hecho", precio: "₡2.800", n: 1 },
  { nombre: "Galleta de matcha", detalle: "Recién hecha", precio: "₡1.400", n: 0 },
];

// ── Las piezas sueltas, SIN marco de teléfono ──────────────────────

/** El menú del link-app, a tamaño legible. */
export function PiezaMenu({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[16px] border border-[color:var(--linea)] bg-white ${className}`}
    >
      <div className="flex items-center gap-2.5 border-b border-[color:var(--linea)] px-4 py-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-extrabold text-white"
          style={{ backgroundColor: AZUL }}
        >
          C
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-extrabold text-[#0F172A]">
            Casa Matcha
          </span>
          <span
            className="block text-[9px] font-extrabold uppercase tracking-[0.1em]"
            style={{ color: AZUL }}
          >
            Cafetería · Escazú
          </span>
        </span>
      </div>
      <ul className="divide-y divide-[color:var(--linea)]">
        {PLATOS.map((p) => (
          <li key={p.nombre} className="flex items-center gap-3 px-4 py-3">
            <span className="h-11 w-11 shrink-0 rounded-[10px] bg-[#F4F6FB]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-extrabold text-[#0F172A]">
                {p.nombre}
              </span>
              <span className="block truncate text-[11.5px] text-[#7B7F8A]">
                {p.detalle}
              </span>
              <span
                className="mt-0.5 block text-[13px] font-extrabold"
                style={{ color: AZUL }}
              >
                {p.precio}
              </span>
            </span>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
              style={{ backgroundColor: p.n ? AZUL : "#B9C4E8" }}
            >
              {p.n || "+"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El mensaje que le entra al local, en su burbuja. */
export function PiezaWhatsapp({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-[#EFE7DE] p-4 ${className}`}>
      <div className="ml-auto max-w-[94%] rounded-[14px] rounded-tr-[4px] bg-[#DCF8C6] px-4 py-3 shadow-[0_1px_1px_rgba(0,0,0,0.12)]">
        <p className="whitespace-pre-line text-[12.5px] leading-[1.55] text-[#111B21]">
          {textoDelPedido(PEDIDO)}
        </p>
        <p className="mt-1.5 text-right text-[10px] text-[#667781]">12:04 ✓✓</p>
      </div>
    </div>
  );
}

/** El comentario de Instagram y el DM que sale solo. */
export function PiezaAutomatizacion({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] border border-[color:var(--linea)] bg-white p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <IconInstagram className="h-4 w-4 text-[#C13584]" />
        <span className="text-[12.5px] font-extrabold text-[#0F172A]">casamatcha</span>
      </div>

      <div className="mt-3 rounded-[12px] bg-[color:var(--superficie)] px-3.5 py-2.5">
        <p className="text-[12.5px] text-[#0F172A]">
          <span className="font-extrabold">maria.j</span> Quiero el{" "}
          <span className="font-extrabold" style={{ color: AZUL }}>
            MENÚ
          </span>
        </p>
      </div>

      <p className="py-2 text-center text-[11px] text-[color:var(--tinta-suave)]">
        ↓ Bookea responde sola
      </p>

      <div className="rounded-[12px] rounded-tl-[4px] bg-[#DCF8C6] px-3.5 py-2.5">
        <p className="text-[12.5px] leading-snug text-[#111B21]">
          ¡Hola! Acá está nuestro menú:
        </p>
        <p className="text-[12.5px] font-bold text-[#027EB5]">casamatcha.app</p>
      </div>

      <div className="mt-2.5 flex items-center gap-2 rounded-[12px] bg-[#25D366]/10 px-3.5 py-2">
        <IconWhatsapp className="h-3.5 w-3.5 text-[#25D366]" />
        <span className="text-[11.5px] font-extrabold text-[#0F172A]">
          También por WhatsApp
        </span>
      </div>
    </div>
  );
}

/** La ficha del negocio en el directorio. */
export function PiezaMarketplace({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[16px] border border-[color:var(--linea)] bg-white ${className}`}
    >
      <div className="relative h-[110px] bg-[color:var(--superficie)]">
        <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold text-[color:var(--tinta)]">
          Barbería
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-[color:var(--ok-suave)] px-2.5 py-1 text-[10.5px] font-extrabold text-[color:var(--ok)]">
          Verificado
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-[15px] font-extrabold text-[color:var(--tinta)]">
          Silence Barber
        </p>
        <p className="text-[12.5px] text-[color:var(--tinta-suave)]">
          Desamparados, San José
        </p>
        <span className="mt-3 block rounded-[10px] bg-[color:var(--tinta)] py-2 text-center text-[13px] font-extrabold text-white">
          Reservar
        </span>
      </div>
    </div>
  );
}

/** El pase, sin marco: la tarjeta sola. */
export function PiezaPase({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <VistaPase datos={PASE} superficie="clara" marco="ninguno" />
    </div>
  );
}

// ── El texto de cada producto, igual en las cuatro ─────────────────

/**
 * Sale del CATÁLOGO, no de una copia local.
 *
 * Acá había una lista escrita a mano y ya se había despegado: decía
 * «Tu app» cuando el producto pasó a llamarse «Tu página». Eso es
 * exactamente lo que `src/lib/productos.ts` viene a evitar — un solo
 * lugar donde está el nombre, y todas las pantallas lo siguen.
 */
const TEXTOS = PRODUCTOS.map((p) => ({
  titulo: p.nombre,
  resumen: p.promesa,
}));

function Pie({ i }: { i: number }) {
  return (
    // `mt-auto` para que el botón se apoye en el piso de la caja: los
    // resúmenes no miden lo mismo y si no, cada botón queda a su altura.
    <div className="mt-auto flex flex-col items-center pt-5 text-center">
      <p className="text-[16px] font-extrabold text-[color:var(--tinta)]">
        {TEXTOS[i].titulo}
      </p>
      <p className="mb-4 mt-1 text-[13px] leading-snug text-[color:var(--tinta-suave)]">
        {TEXTOS[i].resumen}
      </p>
      <VerMas />
    </div>
  );
}

// `group` para que el botón «Ver más» se pinte cuando el mouse entra en
// cualquier parte de la caja.
const CAJA =
  "group flex flex-col rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--superficie)] p-5";

// ══════════════════════════════════════════════════════════════════
//  A — PIEZAS RECORTADAS, SIN MARCO
// ══════════════════════════════════════════════════════════════════
export function VarianteA() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className={CAJA}>
        <PiezaPagina />
        <Pie i={0} />
      </div>
      <div className={CAJA}>
        <PiezaPase />
        <Pie i={1} />
      </div>
      <div className={CAJA}>
        <DemoAutomatizacion />
        <Pie i={2} />
      </div>
      <div className={CAJA}>
        <DemoReservas />
        <Pie i={3} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  B — BENTO: CUATRO TAMAÑOS DISTINTOS
// ══════════════════════════════════════════════════════════════════
export function VarianteB() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* El pase manda: es lo más terminado del producto.
          Su caja mide dos filas, así que le sobra alto: el `flex-1` con
          `items-center` deja el pase FLOTANDO en el medio en vez de
          pegado arriba con un hueco blanco debajo. */}
      <div className={`${CAJA} lg:row-span-2`}>
        <div className="flex flex-1 items-center justify-center">
          <PiezaPase />
        </div>
        <Pie i={1} />
      </div>

      {/* El menú, ancho. */}
      <div className={`${CAJA} lg:col-span-2`}>
        <div className="grid items-center gap-5 sm:grid-cols-2">
          <PiezaPagina />
          <div className="text-left">
            <p className="text-[19px] font-extrabold text-[color:var(--tinta)]">
              {TEXTOS[0].titulo}
            </p>
            <p className="mt-1.5 text-[14px] leading-snug text-[color:var(--tinta-suave)]">
              {TEXTOS[0].resumen}
            </p>
            <VerMas className="mt-4" />
          </div>
        </div>
      </div>

      <div className={CAJA}>
        <DemoAutomatizacion />
        <Pie i={2} />
      </div>
      <div className={CAJA}>
        <DemoReservas />
        <Pie i={3} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  D — UNA FILA POR PRODUCTO, A TAMAÑO GRANDE
// ══════════════════════════════════════════════════════════════════
export function VarianteD() {
  const filas = [
    <PiezaPagina key="m" />,
    <PiezaPase key="p" />,
    <DemoAutomatizacion key="a" />,
    <DemoReservas key="r" />,
  ];
  return (
    <div className="space-y-6">
      {filas.map((pieza, i) => (
        <div
          key={i}
          className={`group grid items-center gap-8 rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--superficie)] p-8 lg:grid-cols-2 ${
            i % 2 ? "lg:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="mx-auto w-full max-w-[340px]">{pieza}</div>
          <div className="text-left">
            <p className="titulo text-[clamp(22px,3vw,30px)] text-[color:var(--tinta)]">
              {TEXTOS[i].titulo}
            </p>
            <p className="mt-2.5 max-w-[42ch] text-[15px] leading-relaxed text-[color:var(--tinta-suave)]">
              {TEXTOS[i].resumen}
            </p>
            <VerMas className="mt-5" />
          </div>
        </div>
      ))}
    </div>
  );
}
