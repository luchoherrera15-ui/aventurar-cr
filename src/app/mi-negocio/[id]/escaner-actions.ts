"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoOperativo } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { otorgarPuntos } from "@/lib/lealtad/motor";

/**
 * Sumar un sello escaneando la tarjeta del cliente.
 *
 * Lo puede hacer el dueño o un colaborador: `verificarAccesoOperativo`
 * resuelve los dos. Hoy ser colaborador ES el permiso — no hay
 * permisos granulares en `rancho_colaboradores` (0116).
 *
 * El QR del pase lleva el `serial_number`, que es la identidad de la
 * tarjeta. De ahí sale el miembro y de ahí el programa.
 */

export type ResultadoEscaneo =
  | { ok: true; cliente: string; saldo: number; yaEstaba: false }
  | { ok: true; cliente: string; saldo: number; yaEstaba: true }
  | { ok: false; motivo: string };

/**
 * La cámara lee el QR unas diez veces por segundo. Sin protección, un
 * solo acercamiento daría diez sellos.
 *
 * El cliente para el bucle al primer acierto, pero eso es cortesía: la
 * garantía va en el servidor, con una referencia que incluye el MINUTO.
 * `transacciones_puntos` tiene único (miembro_id, referencia), así que
 * el segundo intento del mismo minuto rebota solo.
 *
 * Consecuencia aceptada: no se pueden dar dos sellos al mismo cliente
 * dentro del mismo minuto. Para eso está el botón manual del panel.
 */
function referenciaDelMinuto(serial: string, ahora: Date) {
  return `escaneo:${serial}:${ahora.toISOString().slice(0, 16)}`;
}

export async function sumarSelloEscaneado(
  ranchoId: string,
  serialNumber: string,
): Promise<ResultadoEscaneo> {
  const { user, ok } = await verificarAccesoOperativo(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };

  const serial = serialNumber.trim();
  if (!serial || serial.length > 100) {
    return { ok: false, motivo: "Ese código no es una tarjeta de Bookea." };
  }

  // Llave de servicio: `pases_wallet` no le da lectura al negocio, solo
  // al dueño de la tarjeta (0060). El acceso ya se comprobó arriba.
  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { data: pase } = await db
    .from("pases_wallet")
    .select("miembro_id")
    .eq("serial_number", serial)
    .maybeSingle();

  if (!pase) return { ok: false, motivo: "Esa tarjeta no existe." };

  const { data: miembro } = await db
    .from("miembros")
    .select("id, estado, cliente_id, programa_id")
    .eq("id", pase.miembro_id)
    .maybeSingle();

  if (!miembro) return { ok: false, motivo: "Esa tarjeta ya no tiene dueño." };
  if (miembro.estado !== "activa") {
    return { ok: false, motivo: "Esa membresía está " + miembro.estado + "." };
  }

  // LA COMPROBACIÓN QUE IMPORTA: que la tarjeta sea de ESTE negocio.
  // Sin esto, escanear la tarjeta de otro local sumaría puntos acá — y
  // el serial viene del QR, o sea de fuera.
  const { data: programa } = await db
    .from("programa_lealtad")
    .select("id, rancho_id, activo, puntos_por_visita")
    .eq("id", miembro.programa_id)
    .maybeSingle();

  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta es de otro negocio." };
  }
  if (!programa.activo) {
    return { ok: false, motivo: "Tu programa de lealtad está apagado." };
  }

  const puntos = programa.puntos_por_visita > 0 ? programa.puntos_por_visita : 1;

  const resultado = await otorgarPuntos({
    miembroId: miembro.id,
    puntos,
    motivo: "Sello por visita (escaneo)",
    referencia: referenciaDelMinuto(serial, new Date()),
  });

  if (!resultado.ok) return { ok: false, motivo: resultado.error };

  const { data: perfil } = await db
    .from("perfiles")
    .select("nombre")
    .eq("id", miembro.cliente_id)
    .maybeSingle();

  const cliente = (perfil?.nombre as string | null)?.trim() || "Cliente";

  revalidatePath(`/mi-negocio/${ranchoId}`);

  // `otorgado: false` acá significa "ya se le dio este minuto", no un
  // fallo: se le dice al del mostrador para que no lo intente otra vez.
  return {
    ok: true,
    cliente,
    saldo: resultado.saldo,
    yaEstaba: !resultado.otorgado,
  };
}
