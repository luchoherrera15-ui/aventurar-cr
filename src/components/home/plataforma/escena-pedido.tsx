import { IconWhatsapp } from "@/components/icons";
import { textoDelPedido, type PedidoParaWhatsapp } from "@/lib/solutions/whatsapp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PEDIDO, PASO A PASO — la escena del héroe
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (23 sep 2026): «primero sale que alguien escribe
 * "hola, quiero hacer un pedido" y le responden con el link; luego
 * entra y ve la página del restaurante con su portada, su icono y los
 * menús por categoría; luego cada línea del menú donde se puede pedir,
 * la gente selecciona; luego se manda el mensaje por WhatsApp y
 * también llega a un panel en la aplicación. Que todo se vaya viendo
 * paso a paso».
 *
 * Son cuatro cuadros numerados. La escena anterior tenía dos —menú y
 * WhatsApp— y se saltaba lo más importante: de dónde sale el cliente y
 * a dónde cae el pedido del lado del negocio.
 *
 * ── EL MENSAJE FINAL NO ESTÁ ESCRITO A MANO ─────────────────────────
 *
 * Lo arma `textoDelPedido()`, la MISMA función pura que usa el
 * producto. Si cambia el formato, cambia también acá, solo.
 *
 * ── EL NEGOCIO ES INVENTADO, Y TIENE QUE SERLO ──────────────────────
 *
 * «Casa Matcha» no existe. El nombre que se mencionó al pedir esto
 * —Pura Matcha— es un CLIENTE REAL de Lealtad, y ponerlo en la portada
 * de Bookea daría a entender que avala el producto o que su página es
 * esta. Los clientes reales no se usan de maqueta sin permiso.
 *
 * El dominio propio (`casamatcha.app`) sí es una capacidad de verdad:
 * la migración 0234 agregó dominio propio por negocio.
 */

const PEDIDO: PedidoParaWhatsapp = {
  negocio: "Casa Matcha",
  slug: "casa-matcha",
  codigo: "7F2A",
  modalidad: "llevar",
  renglones: [
    {
      nombre: "Matcha latte",
      cantidad: 2,
      precio: 3200,
      detalles: ["Leche de almendra", "Sin azúcar"],
    },
    { nombre: "Cheesecake de matcha", cantidad: 1, precio: 2800 },
  ],
  costoEnvio: 0,
  total: 9200,
  cliente: {
    nombre: "María Jiménez",
    telefono: "8888 0000",
    cedula: "",
    direccion: "",
    metodoPago: "transferencia",
    nota: "Paso a las 3:00",
  },
};

/**
 * El azul del link-app de comida: `#2447BF`, el del spec.
 *
 * NO es `--acento` (el #0082E6 del resto del home) a propósito: los
 * pasos 2 y 3 dibujan OTRO producto, con su propia paleta neutra y su
 * propio azul. Pintarlo con el de Bookea sería maquillar la captura
 * para que combine con la página, que es justo lo contrario de enseñar
 * el producto como es.
 */
const ESTILO_LINK_APP = {
  "--link-acento": "#2447BF",
  "--link-tenue": "#B9C4E8",
} as React.CSSProperties;

/** Las categorías de la carta, en el riel de la página. */
const CATEGORIAS = ["Bebidas", "Matcha", "Postres", "Desayunos"];

/** Los renglones del menú, con su foto y su precio. */
const MENU = [
  { nombre: "Matcha latte", precio: "₡3.200", nota: "Leche de almendra", elegido: 2 },
  { nombre: "Matcha frío", precio: "₡3.400", nota: "", elegido: 0 },
  { nombre: "Cheesecake de matcha", precio: "₡2.800", nota: "", elegido: 1 },
  { nombre: "Galleta de matcha", precio: "₡1.400", nota: "", elegido: 0 },
];

/** El encabezado de cada cuadro: el número y qué pasa ahí. */
function Paso({
  n,
  titulo,
  children,
}: {
  n: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--tinta)] text-[12.5px] font-extrabold text-white">
          {n}
        </span>
        <span className="text-[13.5px] font-extrabold text-[color:var(--tinta)]">
          {titulo}
        </span>
      </div>
      <div className="flex-1 overflow-hidden rounded-[16px] border border-[color:var(--linea)] bg-white shadow-[0_20px_50px_-32px_rgba(20,22,26,0.3)]">
        {children}
      </div>
    </div>
  );
}

export default function EscenaPedido() {
  const mensaje = textoDelPedido(PEDIDO);

  return (
    <div
      // Demostración, no interfaz: nada navega y un lector de pantalla
      // no tiene por qué recorrerla como si fueran controles.
      aria-hidden
      className="grid select-none gap-6 text-left sm:grid-cols-2 lg:grid-cols-4"
      style={ESTILO_LINK_APP}
    >
      {/* ── 1. LA CONVERSACIÓN ───────────────────────────────────
          `h-full`: la grilla estira las cuatro tarjetas a la misma
          altura, y sin esto el fondo del chat cubría solo el alto de
          las dos burbujas y dejaba media tarjeta en blanco. */}
      <Paso n="1" titulo="Te escriben">
        <div className="h-full bg-[#EFE7DE] px-3 py-4">
          <div className="max-w-[85%] rounded-[12px] rounded-tl-[4px] bg-white px-3 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
            <p className="text-[12.5px] leading-snug text-[#111B21]">
              Hola, quiero hacer un pedido
            </p>
          </div>

          <div className="ml-auto mt-2.5 max-w-[90%] rounded-[12px] rounded-tr-[4px] bg-[#DCF8C6] px-3 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
            <p className="text-[12.5px] leading-snug text-[#111B21]">
              ¡Hola! Podés hacerlo directo acá:
            </p>
            <p className="mt-1 text-[12.5px] font-bold text-[#027EB5]">
              casamatcha.app
            </p>
            <p className="mt-1 text-right text-[10px] text-[#667781]">11:58 ✓✓</p>
          </div>
        </div>
      </Paso>

      {/* ── 2. LA PÁGINA ─────────────────────────────────────────
          Sigue la especificación del link-app de comida (23 sep 2026):
          portada de una sola foto con las esquinas de abajo
          redondeadas, la píldora del descuento arriba a la izquierda,
          el logo CENTRADO Y DEBAJO —sin montarse sobre la portada, que
          es lo que pedía el spec y lo que este mockup hacía mal—,
          nombre, «CATEGORÍA · ZONA» en azul y mayúsculas, y los tres
          botones Reservar / Pedir / Contacto. */}
      <Paso n="2" titulo="Entra a tu página">
        <div className="flex h-full flex-col bg-white">
          <div className="relative h-[76px] shrink-0 overflow-hidden rounded-b-[16px] bg-[linear-gradient(135deg,#1f3d2b_0%,#4a7c59_55%,#8fb996_100%)]">
            <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-2 py-0.5 text-[9.5px] font-extrabold text-[color:var(--link-acento)]">
              Hasta -20% hoy
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center px-3 pb-3 pt-2.5 text-center">
            {/* El logo: círculo con aro blanco, debajo de la portada. */}
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--link-acento)] text-[16px] font-extrabold text-white ring-[3px] ring-white">
              C
            </span>

            <p className="mt-1.5 text-[14px] font-extrabold text-[#0F172A]">
              Casa Matcha
            </p>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--link-acento)]">
              Cafetería · Escazú
            </p>

            {/* Los tres botones del spec. */}
            <div className="mt-2.5 flex w-full gap-1.5">
              <span className="flex-1 rounded-[10px] bg-[color:var(--link-acento)] py-1.5 text-[10.5px] font-extrabold text-white">
                Reservar
              </span>
              <span className="flex-1 rounded-[10px] bg-[#F4F6FB] py-1.5 text-[10.5px] font-extrabold text-[#0F172A]">
                Pedir
              </span>
              <span className="flex-1 rounded-[10px] bg-[#F4F6FB] py-1.5 text-[10.5px] font-extrabold text-[#0F172A]">
                Contacto
              </span>
            </div>

            {/* El riel de categorías, con scroll horizontal. */}
            <div className="mt-3 flex w-full gap-2 overflow-hidden">
              {CATEGORIAS.map((c) => (
                <span key={c} className="flex shrink-0 flex-col items-center gap-1">
                  <span className="h-8 w-8 rounded-[10px] bg-[#F4F6FB]" />
                  <span className="text-[8.5px] font-semibold text-[#7B7F8A]">
                    {c}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Paso>

      {/* ── 3. EL MENÚ Y LA SELECCIÓN ────────────────────────────
          La fila de plato del spec: foto a la izquierda, nombre en
          negrita, descripción tenue, precio en azul y el «+» azul a la
          derecha. «· con opciones» marca los platos que abren la hoja
          de modificadores (quitar ingredientes, extras con precio). */}
      <Paso n="3" titulo="Arma el pedido">
        <div className="flex h-full flex-col bg-white">
          <ul className="flex-1 px-2 py-2">
            {MENU.map((m) => (
              <li
                key={m.nombre}
                className={`flex items-center gap-2.5 rounded-[12px] px-2 py-2 ${
                  m.elegido ? "bg-[#F4F6FB]" : ""
                }`}
              >
                <span className="h-9 w-9 shrink-0 rounded-[10px] bg-[#F4F6FB]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-extrabold text-[#0F172A]">
                    {m.nombre}
                  </span>
                  <span className="block truncate text-[10px] text-[#7B7F8A]">
                    {m.nota ? `${m.nota} · con opciones` : "Recién preparado"}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-extrabold text-[color:var(--link-acento)]">
                    {m.precio}
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${
                    m.elegido ? "bg-[color:var(--link-acento)]" : "bg-[color:var(--link-tenue)]"
                  }`}
                >
                  {m.elegido ? m.elegido : "+"}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-[color:var(--linea)] bg-[color:var(--superficie)] px-4 py-2.5">
            <span className="text-[11.5px] text-[color:var(--tinta-suave)]">
              3 productos
            </span>
            <span className="titulo text-[15px] text-[color:var(--tinta)]">₡9.200</span>
          </div>
          <div className="px-3 pb-3 pt-2.5">
            <span className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#25D366] px-3 py-2.5 text-[12.5px] font-extrabold text-white">
              <IconWhatsapp className="h-3.5 w-3.5" />
              Enviar pedido
            </span>
          </div>
        </div>
      </Paso>

      {/* ── 4. LLEGA A LOS DOS LADOS ───────────────────────────── */}
      <Paso n="4" titulo="Te llega, por dos vías">
        <div className="flex h-full flex-col">
          {/* El mensaje real, recortado: acá importa que se reconozca
              la forma, no que se lea entero — abajo está completo en la
              sección de Pedidos. */}
          <div className="bg-[#EFE7DE] px-3 py-3">
            <div className="ml-auto max-w-[96%] rounded-[12px] rounded-tr-[4px] bg-[#DCF8C6] px-2.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.1)]">
              <p className="line-clamp-[9] whitespace-pre-line text-[10.5px] leading-[1.5] text-[#111B21]">
                {mensaje}
              </p>
            </div>
          </div>

          {/* Y el panel del negocio: la comanda entrando. */}
          <div className="flex-1 border-t border-[color:var(--linea)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--tinta-suave)]">
                Comandas
              </span>
              <span className="flex items-center gap-1 rounded-full bg-[color:var(--ok-suave)] px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--ok)]" />
                <span className="text-[9.5px] font-extrabold uppercase text-[color:var(--ok)]">
                  En vivo
                </span>
              </span>
            </div>

            <div className="mt-2.5 rounded-[10px] border border-[color:var(--acento)] bg-[color:var(--acento-suave)] px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-extrabold text-[color:var(--tinta)]">
                  #7F2A
                </span>
                <span className="text-[12px] font-bold text-[color:var(--tinta)]">
                  ₡9.200
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[color:var(--tinta-suave)]">
                María J. · Para llevar
              </p>
            </div>
          </div>
        </div>
      </Paso>
    </div>
  );
}
