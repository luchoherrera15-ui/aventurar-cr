/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS SEIS RUBROS DEL DESFILE DE LA LANDING
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (30 ago 2026): barberías, salones de belleza,
 * lavacares, tiendas en línea, joyerías y cafeterías, cada uno como una
 * pantalla de teléfono. Los pinta `desfile-rubros.tsx`.
 *
 * ── SON EJEMPLOS, Y SE NOTA ────────────────────────────────────────
 * Los nombres de negocio son inventados y genéricos a propósito
 * («Barbería El Roble», no el nombre de un cliente real). La regla del
 * módulo es que la landing NUNCA presuma cifras ni clientes que no
 * existen: acá no se promete ningún resultado, solo se muestra cómo se
 * ve una tarjeta en cada rubro.
 *
 * ── LAS FOTOS ──────────────────────────────────────────────────────
 * Son de Pexels (licencia libre, sin atribución obligatoria) y viven en
 * Cloudflare Images, NO en `public/`. El 30 ago 2026 se vació `public/`
 * de 61 MB a 1,6 MB justamente porque ese peso se clonaba y volvía a
 * subir en cada despliegue; sumar seis fotos nuevas al repo habría
 * empezado a deshacerlo. Se suben con
 * `scripts/subir-rubros-a-cloudflare.mjs`.
 *
 * `creditoFoto` no es obligatorio por licencia — se guarda por el mismo
 * motivo que en `plantillas-franjas.ts`: poder rastrear de dónde salió
 * cada imagen si algún día hace falta.
 */

const BASE =
  process.env.NEXT_PUBLIC_IMAGES_URL ?? "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g";

export type PantallaRubro = {
  id: string;
  /** Cómo se llama el rubro en la tarjeta y al pie del teléfono. */
  rubro: string;
  /** El negocio de ejemplo. Inventado, genérico, nunca un cliente real. */
  negocio: string;
  /** Qué se lleva el cliente al completar. */
  premio: string;
  /** Cuántos sellos pide la tarjeta y cuántos lleva el ejemplo. */
  meta: number;
  saldo: number;
  /** El color de la tarjeta. Sale de las paletas de Lealtad, no de un
   *  hex inventado por rubro. */
  color: string;
  foto: string;
  creditoFoto: string;
};

const foto = (id: string) => `${BASE}/lealtad/rubros/${id}/public`;

export const PANTALLAS_RUBRO: PantallaRubro[] = [
  {
    id: "barberia",
    rubro: "Barbería",
    negocio: "Barbería El Roble",
    premio: "El corte 10 va por la casa",
    meta: 10,
    saldo: 7,
    color: "#1f2937",
    foto: foto("barberia"),
    creditoFoto: "Pexels",
  },
  {
    id: "belleza",
    rubro: "Salón de belleza",
    negocio: "Estudio Aurora",
    premio: "Manicura gratis al llegar a 8",
    meta: 8,
    saldo: 5,
    color: "#7c2d5a",
    foto: foto("belleza"),
    creditoFoto: "Pexels",
  },
  {
    id: "lavacar",
    rubro: "Lavacar",
    negocio: "Lavacar El Rayo",
    premio: "5% de vuelta en cada lavada",
    meta: 6,
    saldo: 4,
    color: "#0e4d92",
    foto: foto("lavacar"),
    creditoFoto: "Pexels",
  },
  {
    id: "tienda",
    rubro: "Tienda en línea",
    negocio: "Tienda Manglar",
    premio: "Envío gratis en tu compra 5",
    meta: 5,
    saldo: 3,
    color: "#155e52",
    foto: foto("tienda"),
    creditoFoto: "Pexels",
  },
  {
    id: "joyeria",
    rubro: "Joyería",
    negocio: "Joyería Alba",
    premio: "Limpieza de piezas sin costo",
    meta: 6,
    saldo: 2,
    color: "#4a3410",
    foto: foto("joyeria"),
    creditoFoto: "Pexels",
  },
  {
    id: "cafeteria",
    rubro: "Cafetería",
    negocio: "Café Aroma",
    premio: "El décimo café es gratis",
    meta: 10,
    saldo: 6,
    color: "#5b3a21",
    foto: foto("cafeteria"),
    creditoFoto: "Pexels",
  },
];
