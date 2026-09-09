import { fmtMoneda, numeroInternacional, type Moneda, type Pais } from "@/lib/monedas";
import { hostPublicoSolutions, METODO_PAGO, MODALIDAD, type MetodoPago, type Modalidad } from "./tipos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PEDIDO QUE VIAJA POR WHATSAPP — el texto y el enlace
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (4 sep 2026): «la persona arma el pedido, llena sus
 * datos y, organizadamente, se manda un mensaje de WhatsApp al
 * restaurante — como los que uno envía desde una página».
 *
 * ⚠️ CAMBIO DE RUMBO (5 sep 2026): «To go y Exprés por la web, no por
 * WhatsApp». El pedido del cliente ya NO pasa por acá: entra por la
 * página y cae en el Modo restaurante. Lo que queda de WhatsApp es en
 * el otro sentido —el LOCAL le avisa al cliente que su pedido está
 * listo (`textoAvisoListo`)— y `textoDelPedido` se conserva por si un
 * local quiere reenviar una comanda a su propio chat de cocina. Y
 * desde el 6 sep, «consultar por WhatsApp» desde el catálogo de un
 * negocio que no vende en línea (`textoConsulta`).
 *
 * ── CÓMO FUNCIONA «EL API» ──────────────────────────────────────────
 * No hay API que llamar ni cuenta de WhatsApp Business que configurar:
 * un enlace `https://wa.me/<número>?text=<mensaje>` abre WhatsApp (la
 * app en el teléfono, WhatsApp Web en la compu) con el chat del
 * negocio y el mensaje YA ESCRITO. La persona solo toca «Enviar». Es el
 * mecanismo oficial de Meta para esto y el que usan las páginas que el
 * dueño describió.
 *
 * ── LA MONEDA Y EL PAÍS (0236) ──────────────────────────────────────
 * Los montos se escriben en la moneda del negocio (`fmtMoneda`) y el
 * número recibe el prefijo de SU país (`numeroInternacional`): antes
 * esto solo sabía de colones y del 506.
 *
 * ── PURO, Y POR ESO PROBADO ─────────────────────────────────────────
 * Este archivo no toca la base ni el navegador: recibe el pedido ya
 * validado por la action y devuelve texto. Así se prueba sin red
 * (whatsapp.test.ts), y el componente de cliente solo tiene que abrir
 * el enlace.
 *
 * ── SIN EMOJIS, A PROPÓSITO ─────────────────────────────────────────
 * El sitio los sacó de la UI (icons.tsx). En un mensaje de WhatsApp se
 * verían distinto en cada teléfono y no agregan nada que el orden y
 * las negritas (`*texto*`, que WhatsApp sí entiende) no den ya.
 */

export type PedidoParaWhatsapp = {
  negocio: string;
  slug: string;
  /** Código corto del pedido, para que el local lo encuentre en Comandas. */
  codigo: string;
  modalidad: Exclude<Modalidad, "mesa">;
  renglones: {
    nombre: string;
    cantidad: number;
    /** Ya con los extras sumados: es lo que se cobra por unidad. */
    precio: number;
    /** «Sin cebolla», «+ Queso», «Nota: …» (0241). */
    detalles?: string[];
  }[];
  costoEnvio: number;
  total: number;
  /** La moneda del negocio (0236). Sin ella, colones. */
  moneda?: Moneda;
  cliente: {
    nombre: string;
    telefono: string;
    cedula: string;
    direccion: string;
    metodoPago: MetodoPago;
    nota: string;
  };
};

/** El texto del mensaje, listo para el `?text=` de wa.me. */
export function textoDelPedido(p: PedidoParaWhatsapp): string {
  const m = p.moneda ?? "CRC";
  const lineas: string[] = [];
  lineas.push(`*Pedido #${p.codigo} · ${p.negocio}*`);
  lineas.push(MODALIDAD[p.modalidad].rotulo);
  lineas.push("");

  for (const r of p.renglones) {
    lineas.push(`${r.cantidad}× ${r.nombre} — ${fmtMoneda(r.precio * r.cantidad, m)}`);
    // Cómo lo quiere, debajo y con guion: en la cocina se lee de
    // corrido y no se confunde con otro plato.
    for (const d of r.detalles ?? []) lineas.push(`   - ${d}`);
  }
  if (p.modalidad === "express") {
    lineas.push(`Envío — ${p.costoEnvio > 0 ? fmtMoneda(p.costoEnvio, m) : "gratis"}`);
  }
  lineas.push(`*Total: ${fmtMoneda(p.total, m)}*`);
  lineas.push("");

  lineas.push(`Nombre: ${p.cliente.nombre}`);
  lineas.push(`Teléfono: ${p.cliente.telefono}`);
  if (p.cliente.cedula) lineas.push(`Documento: ${p.cliente.cedula}`);
  if (p.modalidad === "express") lineas.push(`Dirección: ${p.cliente.direccion}`);
  lineas.push(`Pago: ${METODO_PAGO[p.cliente.metodoPago]}`);
  if (p.cliente.nota) lineas.push(`Nota: ${p.cliente.nota}`);
  lineas.push("");
  // La firma lee el dominio del entorno: linksy.lat cuando el
  // interruptor está puesto, bookea.lat/s/… mientras no (ver
  // `urlPublicaSolutions`).
  lineas.push(`Enviado desde ${hostPublicoSolutions(p.slug)}`);

  return lineas.join("\n");
}

/**
 * El número en el formato que wa.me exige: solo dígitos, con país.
 *
 * Un número con el largo local del país recibe su prefijo (el 506 de
 * Costa Rica, el 52 de México, el 549 de un celular argentino); uno
 * más largo se asume que ya lo trae. Delegado en `monedas.ts`, que es
 * el único que sabe de países.
 */
export function numeroParaWhatsapp(crudo: string, pais: Pais = "CR"): string {
  return numeroInternacional(crudo, pais);
}

/** El enlace completo. `encodeURIComponent` es lo que hace que los saltos de línea y los símbolos lleguen enteros. */
export function enlaceDeWhatsapp(numero: string, texto: string, pais: Pais = "CR"): string {
  return `https://wa.me/${numeroParaWhatsapp(numero, pais)}?text=${encodeURIComponent(texto)}`;
}

/**
 * El código corto de un pedido: los primeros cuatro del UUID, en
 * mayúsculas. Cuatro hex son 65.536 combinaciones — de sobra para que
 * un local distinga los pedidos DE HOY, que es para lo único que sirve.
 */
export function codigoDePedido(id: string): string {
  return id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

/**
 * Lo que el local le manda al cliente desde el Modo restaurante cuando
 * el pedido pasa a «Listo». Va al teléfono que el cliente dejó al pedir.
 */
export function textoAvisoListo(p: {
  cliente: string;
  codigo: string;
  negocio: string;
  modalidad: Exclude<Modalidad, "mesa">;
}): string {
  const saludo = p.cliente.trim() ? `Hola ${p.cliente.trim()}` : "Hola";
  return p.modalidad === "express"
    ? `${saludo}, tu pedido #${p.codigo} de ${p.negocio} ya va en camino.`
    : `${saludo}, tu pedido #${p.codigo} de ${p.negocio} está listo para recoger.`;
}

/**
 * «Hola, quiero consultar por: Encerado completo (S/ 80.00)». Lo que
 * abre el botón de un ítem del catálogo cuando el negocio no vende en
 * línea pero sí tiene WhatsApp (0236): un lavacar, una barbería, una
 * boutique que prefiere cerrar por chat.
 */
export function textoConsulta(p: { negocio: string; item: string; precio: number | null; moneda: Moneda; slug: string }): string {
  const precio = p.precio === null ? "" : ` (${fmtMoneda(p.precio, p.moneda)})`;
  return `Hola ${p.negocio}, quiero consultar por: ${p.item}${precio}.\n\nVisto en ${hostPublicoSolutions(p.slug)}`;
}
