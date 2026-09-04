import { fmtColones } from "@/lib/finanzas";
import { METODO_PAGO, MODALIDAD, type MetodoPago, type Modalidad } from "./tipos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PEDIDO QUE VIAJA POR WHATSAPP — el texto y el enlace
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (4 sep 2026): «la persona arma el pedido, llena sus
 * datos y, organizadamente, se manda un mensaje de WhatsApp al
 * restaurante — como los que uno envía desde una página».
 *
 * ── CÓMO FUNCIONA «EL API» ──────────────────────────────────────────
 * No hay API que llamar ni cuenta de WhatsApp Business que configurar:
 * un enlace `https://wa.me/<número>?text=<mensaje>` abre WhatsApp (la
 * app en el teléfono, WhatsApp Web en la compu) con el chat del
 * negocio y el mensaje YA ESCRITO. La persona solo toca «Enviar». Es el
 * mecanismo oficial de Meta para esto y el que usan las páginas que el
 * dueño describió.
 *
 * Lo que sí es nuestro: que el mensaje llegue ORDENADO. Un pedido que
 * el cliente teclea a mano llega incompleto la mitad de las veces
 * (sin dirección, sin forma de pago); armado acá, llega siempre con
 * los mismos campos en el mismo orden, y la cocina lo lee de un
 * vistazo.
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
  renglones: { nombre: string; cantidad: number; precio: number }[];
  costoEnvio: number;
  total: number;
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
  const lineas: string[] = [];
  lineas.push(`*Pedido #${p.codigo} · ${p.negocio}*`);
  lineas.push(MODALIDAD[p.modalidad].rotulo);
  lineas.push("");

  for (const r of p.renglones) {
    lineas.push(`${r.cantidad}× ${r.nombre} — ${fmtColones(r.precio * r.cantidad)}`);
  }
  if (p.modalidad === "express") {
    lineas.push(`Envío — ${p.costoEnvio > 0 ? fmtColones(p.costoEnvio) : "gratis"}`);
  }
  lineas.push(`*Total: ${fmtColones(p.total)}*`);
  lineas.push("");

  lineas.push(`Nombre: ${p.cliente.nombre}`);
  lineas.push(`Teléfono: ${p.cliente.telefono}`);
  if (p.cliente.cedula) lineas.push(`Cédula: ${p.cliente.cedula}`);
  if (p.modalidad === "express") lineas.push(`Dirección: ${p.cliente.direccion}`);
  lineas.push(`Pago: ${METODO_PAGO[p.cliente.metodoPago]}`);
  if (p.cliente.nota) lineas.push(`Nota: ${p.cliente.nota}`);
  lineas.push("");
  lineas.push(`Enviado desde bookea.lat/s/${p.slug}`);

  return lineas.join("\n");
}

/**
 * El número en el formato que wa.me exige: solo dígitos, con país.
 *
 * Ocho dígitos es un número de Costa Rica sin el 506 — el mismo
 * criterio que usa `VistaPagina` para el botón de WhatsApp de la
 * página. Más largo, se asume que ya trae país.
 */
export function numeroParaWhatsapp(crudo: string): string {
  const d = (crudo ?? "").replace(/\D/g, "");
  return d.length === 8 ? `506${d}` : d;
}

/** El enlace completo. `encodeURIComponent` es lo que hace que los saltos de línea y las ₡ lleguen enteros. */
export function enlaceDeWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numeroParaWhatsapp(numero)}?text=${encodeURIComponent(texto)}`;
}

/**
 * El código corto de un pedido: los primeros cuatro del UUID, en
 * mayúsculas. Cuatro hex son 65.536 combinaciones — de sobra para que
 * un local distinga los pedidos DE HOY, que es para lo único que sirve.
 */
export function codigoDePedido(id: string): string {
  return id.replace(/-/g, "").slice(0, 4).toUpperCase();
}
