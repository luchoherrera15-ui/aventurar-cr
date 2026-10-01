/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS PRODUCTOS DE BOOKEA — una sola lista, un solo lugar
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «la gente se registra, ingresa, y ahí
 * va a tener por cards qué servicios quiere agregar… La idea es cobrar
 * por esto, pero al principio todo va a ser gratis para poder entrar».
 *
 * Decisión del dueño (30 sep 2026): «Deja solo PLANES DE LEALTAD Y
 * RESERVAS». La página con menú y links y las automatizaciones de
 * Instagram salieron del producto: hoy se ofrecen dos cosas.
 *
 * Esta es esa lista. La misma que pinta las tarjetas del home y la
 * misma que pinta la pantalla de «elegí qué activar». Un archivo, no
 * dos: si se agrega un producto o cambia un nombre, cambia acá y las
 * dos pantallas lo siguen. Si vivieran separadas, en tres semanas el
 * home diría una cosa y el panel otra.
 *
 * ── ⚠️ QUÉ **NO** ES ESTE ARCHIVO ───────────────────────────────────
 *
 * No es una taxonomía nueva. La decisión congelada #5 de
 * `docs/arquitectura.md` prohíbe inventar otra lista de tipos o de
 * módulos, y con razón. Acá hay tres niveles distintos, y este archivo
 * es el de más arriba:
 *
 *   1. PRODUCTO      ← este archivo. Lo que se OFRECE y se cobra.
 *   2. add-on        `src/lib/addons.ts` — los complementos que se
 *                    prenden por negocio (lealtad, asistente IA…).
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

export const PRODUCTOS_ID = ["lealtad", "marketplace"] as const;

export type ProductoId = (typeof PRODUCTOS_ID)[number];

export type Producto = {
  id: ProductoId;
  /** Como se llama de cara al cliente. */
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
};

export const PRODUCTOS: readonly Producto[] = [
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
