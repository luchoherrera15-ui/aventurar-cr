"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCambioDePase } from "@/lib/wallet/servicio";

/**
 * Sumar una visita/compra escaneando la tarjeta del cliente.
 *
 * Lo puede hacer el dueño o un colaborador: `verificarAccesoOperativo`
 * resuelve los dos. El QR del pase lleva el `serial_number`, que es la
 * identidad de la tarjeta; de ahí sale el miembro.
 *
 * Desde la 0125 esto delega en el RPC `acreditar_lealtad`: el cálculo
 * de puntos, la compra mínima, los topes por transacción y por día y
 * el estado del programa se validan TODOS bajo lock en la base. El
 * navegador manda el hecho (escaneó, gastó tanto) — nunca los puntos.
 */

export type ResultadoEscaneo =
  | {
      ok: true;
      cliente: string;
      puntos: number;
      saldo: number;
      yaEstaba: boolean;
      /** Para que el panel pueda ofrecer el canje sin volver a escanear. */
      miembroId: string;
    }
  | { ok: false; motivo: string };

/**
 * La cámara lee el QR unas diez veces por segundo. El cliente para el
 * bucle al primer acierto, pero eso es cortesía: la garantía es esta
 * referencia con el MINUTO adentro — el unique del ledger rebota el
 * segundo intento del mismo minuto.
 *
 * Consecuencia aceptada: no se le dan dos sellos al mismo cliente
 * dentro del mismo minuto por escaneo. Para eso está el botón manual.
 */
function referenciaDelMinuto(serial: string, ahora: Date) {
  return `escaneo:${serial}:${ahora.toISOString().slice(0, 16)}`;
}

export async function sumarSelloEscaneado(
  ranchoId: string,
  serialNumber: string,
  /** Colones enteros de la compra; null = visita sin monto (sellos). */
  monto: number | null = null,
): Promise<ResultadoEscaneo> {
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };
  if (!permisos.acreditar) {
    return { ok: false, motivo: "No tenés permiso para dar sellos — pedíselo al dueño." };
  }

  const serial = serialNumber.trim();
  if (!serial || serial.length > 100) {
    return { ok: false, motivo: "Ese código no es una tarjeta de Bookea." };
  }
  if (monto !== null && (!Number.isInteger(monto) || monto < 0 || monto > 10_000_000)) {
    return { ok: false, motivo: "El monto debe ser una cantidad entera de colones." };
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
    .select("id, cliente_id, programa_id")
    .eq("id", pase.miembro_id)
    .maybeSingle();
  if (!miembro) return { ok: false, motivo: "Esa tarjeta ya no tiene dueño." };

  // LA COMPROBACIÓN QUE IMPORTA: que la tarjeta sea de ESTE negocio.
  // El serial viene del QR, o sea de fuera — sin esto, escanear la
  // tarjeta de otro local sumaría puntos acá.
  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa tarjeta es de otro negocio." };
  }

  const { data, error } = await db.rpc("acreditar_lealtad", {
    p_miembro_id: miembro.id,
    p_monto: monto,
    p_referencia: referenciaDelMinuto(serial, new Date()),
    p_usuario_id: user.id,
    p_motivo: monto === null ? "Sello por visita (escaneo)" : "Compra (escaneo)",
  });

  if (error) {
    if (error.message.includes("acreditar_lealtad")) {
      return { ok: false, motivo: "Falta correr la migración 0125 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo registrar: " + error.message };
  }

  const r = data as { otorgado: boolean; puntos?: number; saldo?: number; motivo?: string };
  const yaEstaba = !r.otorgado && r.motivo === "ya-otorgado";
  if (!r.otorgado && !yaEstaba) {
    return { ok: false, motivo: r.motivo ?? "No se pudo registrar." };
  }

  const { data: perfil } = await db
    .from("perfiles")
    .select("nombre")
    .eq("id", miembro.cliente_id)
    .maybeSingle();
  const cliente = (perfil?.nombre as string | null)?.trim() || "Cliente";

  // El aviso al teléfono nunca frena la operación (los puntos ya
  // están), pero SÍ tiene que ejecutarse: un `void` suelto muere cuando
  // Vercel congela la función al responder. `after` la mantiene viva.
  after(() => avisarCambioDePase(miembro.id));
  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    cliente,
    puntos: r.puntos ?? 0,
    saldo: r.saldo ?? 0,
    yaEstaba,
    miembroId: miembro.id,
  };
}
