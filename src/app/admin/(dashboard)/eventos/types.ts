export type Reserva = {
  id: string;
  rancho_id: string | null;
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
  origen: "web" | "manual";
  created_at: string;
};
