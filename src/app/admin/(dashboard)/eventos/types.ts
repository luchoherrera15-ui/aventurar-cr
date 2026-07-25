export type Reserva = {
  id: string;
  fecha: string;
  nombre: string;
  contacto: string;
  tipo_evento: string;
  invitados: number | null;
  estado: "pendiente" | "confirmada" | "rechazada" | "bloqueada";
  monto_total: number | null;
  metodo_pago: "sinpe" | "transferencia" | null;
  deposito_monto: number | null;
  deposito_comprobante_url: string | null;
  deposito_validado: boolean;
  evento_pagado: boolean;
  notas: string | null;
  origen: "web" | "manual";
  created_at: string;
};
