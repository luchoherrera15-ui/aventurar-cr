"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CrearSolicitudInput = {
  fecha: string;
  nombre: string;
  contacto: string;
  tipo_evento: string;
  invitados: number;
  deposito_monto: number;
  metodo_pago: "sinpe" | "transferencia";
  deposito_comprobante_url: string;
  notas: string | null;
};

export async function crearSolicitudReserva(input: CrearSolicitudInput) {
  const supabase = await createClient();

  const { error } = await supabase.from("reservas").insert({
    fecha: input.fecha,
    nombre: input.nombre,
    contacto: input.contacto,
    tipo_evento: input.tipo_evento,
    invitados: input.invitados,
    estado: "pendiente",
    deposito_monto: input.deposito_monto,
    metodo_pago: input.metodo_pago,
    deposito_comprobante_url: input.deposito_comprobante_url,
    notas: input.notas,
    origen: "web",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/eventos-salon");
  revalidatePath("/admin/eventos");
  return { error: null };
}
