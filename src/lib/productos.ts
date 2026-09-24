/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS CUATRO PRODUCTOS DE BOOKEA — una sola lista, un solo lugar
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «la gente se registra, ingresa, y ahí
 * va a tener por cards qué servicios quiere agregar. ¿Qué ofrecemos?
 * Tu link app, los planes de lealtad, las automatizaciones y el
 * marketplace de servicios. La idea es cobrar por esto, pero al
 * principio todo va a ser gratis para poder entrar».
 *
 * Esta es esa lista. La misma que pinta las cuatro tarjetas del home y
 * la misma que pinta la pantalla de «elegí qué activar». Un archivo, no
 * dos: si se agrega un quinto producto o cambia un nombre, cambia acá y
 * las dos pantallas lo siguen. Si vivieran separadas, en tres semanas
 * el home diría una cosa y el panel otra — que es exactamente lo que
 * pasó antes con los nombres de Linksy.
 *
 * ── ⚠️ QUÉ **NO** ES ESTE ARCHIVO ───────────────────────────────────
 *
 * No es una taxonomía nueva. La decisión congelada #5 de
 * `docs/arquitectura.md` prohíbe inventar otra lista de tipos o de
 * módulos, y con razón. Acá hay tres niveles distintos, y este archivo
 * es el de más arriba:
 *
 *   1. PRODUCTO      ← este archivo. Lo que se OFRECE y se cobra.
 *   2. add-on        `src/lib/solutions/addons.ts` — las partes que se
 *                    prenden dentro de la página (menú, pedidos…).
 *   3. módulo        `src/lib/business/modulos.ts` — las pantallas del
 *                    panel de operación (agenda, clientes, equipo…).
 *
 * Un producto ENCIENDE add-ons y módulos; no los reemplaza. Por eso
 * cada producto de acá apunta con `activar` a la pantalla que ya existe
 * y sabe hacer ese trabajo, en vez de duplicarla.
 *
 * ── PRECIOS ─────────────────────────────────────────────────────────
 *
 * Todo en ₡0 mientras se arranca, por decisión del dueño. El precio de
 * lista vive en código (igual que `ADDONS` y que `PLANES` de Lealtad) y
 * lo que un negocio concreto pagó vive en su fila. Cuando se cobre, se
 * cambia `precioMes` acá y nada más se entera.
 */

export const PRODUCTOS_ID = [
  "pagina",
  "lealtad",
  "automatizaciones",
  "marketplace",
] as const;

export type ProductoId = (typeof PRODUCTOS_ID)[number];

/** Qué tan real es hoy. Lo que se enseña tiene que poder entregarse. */
export type EstadoProducto = "vivo" | "en-obra";

export type Producto = {
  id: ProductoId;
  /** Como se llama de cara al cliente. Ver la nota de nombres abajo. */
  nombre: string;
  /** Una frase. La promesa, no la descripción técnica. */
  promesa: string;
  /**
   * Cómo se resuelve esto HOY, sin Bookea. Una frase, en el idioma del
   * dueño («una foto en el estado», «un cuaderno»). El home la pinta
   * como «antes → después»; vive acá y no en el home por la misma
   * razón que todo lo demás: una sola lista (docs/bookea-producto.md §2).
   */
  antes: string;
  /** Tres cosas concretas que trae. Para la tarjeta de «activar». */
  incluye: readonly string[];
  /** ₡ por mes. 0 = gratis. Hoy son todos 0. */
  precioMes: number;
  /** A dónde va el «Activar»: la pantalla que YA hace ese trabajo. */
  activar: string;
  /** A dónde va el «Ver más» del home. */
  verMas: string;
  estado: EstadoProducto;
};

/**
 * ── SOBRE EL NOMBRE DEL PRIMERO ─────────────────────────────────────
 *
 * El dueño lo llamó «tu link app, o tu página web, o como queramos
 * llamarlo». La decisión congelada #2 ya lo resolvió: de cara al
 * cliente es **«tu página»**, sin marca nueva que aprender («Bookea
 * Link» queda solo como nombre técnico interno, donde el repo ya lo
 * usa). Por eso acá dice «Tu página» y la promesa explica que es el
 * link hub. Si el dueño prefiere «Tu link app», se cambia esta línea y
 * el home y el onboarding cambian juntos.
 */
export const PRODUCTOS: readonly Producto[] = [
  {
    id: "pagina",
    nombre: "Tu página",
    promesa: "Tu menú, tus links y tu QR en una sola página.",
    antes: "Un menú en PDF que nadie abre",
    incluye: [
      "Menú o catálogo con fotos y precios",
      "Tus redes y tus links, en un solo lugar",
      "QR propio y dominio si lo querés",
    ],
    precioMes: 0,
    // `/solutions/crear` es la pantalla real de alta: pide el nombre,
    // arma el slug y deja el link hub andando. No se duplica acá.
    activar: "/solutions/crear",
    verMas: "/solutions",
    estado: "vivo",
  },
  {
    id: "lealtad",
    nombre: "Pases de lealtad",
    promesa: "Sellos y recompensas en Apple Wallet y Google Wallet.",
    antes: "Una tarjeta de cartón que se pierde",
    incluye: [
      "Tu logo, tus colores y tu regalía",
      "El cliente se agrega con un QR",
      "Se actualiza solo en el teléfono",
    ],
    precioMes: 0,
    // ⚠️ ZONA PROTEGIDA. Lealtad está en producción con clientes
    // reales: acá SOLO se enlaza su alta, que ya existe y funciona.
    // Nada de este archivo toca su lógica.
    activar: "/lealtad/nuevo",
    verMas: "/lealtad",
    estado: "vivo",
  },
  {
    id: "automatizaciones",
    nombre: "Automatizaciones",
    promesa: "Comentan una palabra en Instagram y les llega tu link.",
    antes: "Responder cada comentario a mano",
    incluye: [
      "Respuesta pública bajo el comentario",
      "Mensaje directo con tu página",
      "La palabra clave la elegís vos",
    ],
    precioMes: 0,
    // Vive dentro del panel de la página: sin página no hay a dónde
    // mandar el DM. Por eso su alta es la misma.
    activar: "/solutions/crear",
    verMas: "/solutions",
    // ⚠️ El código está construido y probado en local (0238 aplicada),
    // pero la app de Meta todavía no existe, así que hoy no se puede
    // entregar. Mientras siga en «en-obra», la pantalla lo dice.
    estado: "en-obra",
  },
  {
    id: "marketplace",
    nombre: "Reservas",
    promesa: "Tu negocio aparece en Bookea y te reservan desde ahí.",
    antes: "Cadenas de mensajes para cuadrar una hora",
    incluye: [
      "Ficha con fotos, servicios y precios",
      "Agenda con tus horarios y tu equipo",
      "La reserva entra sola, sin aprobar nada",
    ],
    precioMes: 0,
    activar: "/publicar",
    verMas: "/negocios",
    estado: "vivo",
  },
] as const;

/** El producto por id. Explota si el id no existe: es un bug, no un caso. */
export function producto(id: ProductoId): Producto {
  const encontrado = PRODUCTOS.find((p) => p.id === id);
  if (!encontrado) throw new Error(`Producto desconocido: ${id}`);
  return encontrado;
}

/** ¿Hay algo que cobrar hoy? Mientras sea `false`, la pantalla dice «gratis». */
export function hayProductosPagos(): boolean {
  return PRODUCTOS.some((p) => p.precioMes > 0);
}
