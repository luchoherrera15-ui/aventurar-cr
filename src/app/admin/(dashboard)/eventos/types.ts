/** Una línea del pedido armado desde el catálogo (rancho_items). */
export type LineaPedido = {
  item_id: string;
  nombre: string;
  precio: number | null;
  unidad: string | null;
  cantidad: number;
};

/** Snapshot del pedido al momento de reservar — los precios no cambian
 *  aunque el proveedor edite su catálogo después. */
export type DetallePedido = {
  items: LineaPedido[];
  total_estimado: number | null;
};

export type Reserva = {
  id: string;
  rancho_id: string | null;
  cliente_id: string | null;
  fecha: string;
  nombre: string | null;
  /** Campo viejo: reservas hechas antes de separar correo y WhatsApp. */
  contacto: string | null;
  correo: string | null;
  whatsapp: string | null;
  cedula: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  estado: "pendiente" | "confirmada" | "rechazada" | "bloqueada";
  /** Texto del bloque que el dueño configuró; las viejas traen un código. */
  horario_bloque: string | null;
  monto_total: number | null;
  metodo_pago: "sinpe" | "transferencia" | null;
  deposito_monto: number | null;
  deposito_comprobante_url: string | null;
  deposito_validado: boolean;
  evento_pagado: boolean;
  terminos_aceptados: boolean;
  notas: string | null;
  origen: "web" | "movil" | "manual";
  /** Solo en reservas de servicios (no Lugares): el pedido del catálogo. */
  detalle_pedido: DetallePedido | null;
  /** A qué hora empieza el evento ("15:00:00") — servicios, 0067.
   *  Opcionales: toleran una base sin la migración corrida. */
  hora_inicio?: string | null;
  /** Horas contratadas del servicio. */
  duracion_horas?: number | null;
  /** Último día de un alquiler multi-día. */
  fecha_fin?: string | null;
  created_at: string;
};
