"use server";

import { redirect } from "next/navigation";
import { buscarCuentaAdmin } from "@/lib/celebrar/admin";
import { conPrefijo } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { esAdminCelebrar, prefijoDeLaPeticion, sesionCelebrar } from "@/lib/celebrar/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * CARGAR CRÉDITOS A MANO (regalo o ajuste) desde el admin: para un pago
 * por SINPE, una cortesía o corregir algo. Es lo mismo que hace el
 * script `scripts/celebrar-acreditar-creditos.mjs`, con la misma RPC
 * (`celebrar_acreditar_creditos`, solo service role) y la misma regla:
 * una referencia repetida no acredita dos veces.
 */
export async function acreditarAMano(formData: FormData): Promise<void> {
  const [prefijo, sesion, esAdmin] = await Promise.all([prefijoDeLaPeticion(), sesionCelebrar(), esAdminCelebrar()]);
  const volver = conPrefijo(RUTA.appAdminCreditos, prefijo);
  if (!sesion || !esAdmin) redirect(volver);

  const correo = String(formData.get("correo") ?? "").trim();
  const cantidad = Number(formData.get("cantidad"));
  const tipo = String(formData.get("tipo") ?? "regalo");
  const concepto = String(formData.get("concepto") ?? "").trim() || (tipo === "ajuste" ? "Ajuste del equipo" : "Créditos de regalo");
  const referencia = String(formData.get("referencia") ?? "").trim() || null;
  const montoCrc = Number(formData.get("monto_crc"));

  const aviso = (m: string) => redirect(`${volver}?aviso=${encodeURIComponent(m)}`);
  if (!correo) aviso("Falta el correo de la cuenta.");
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 100_000) aviso("La cantidad tiene que ser un entero positivo.");
  if (!["regalo", "ajuste", "compra"].includes(tipo)) aviso("Tipo inválido.");

  const cuenta = await buscarCuentaAdmin(correo);
  if (!cuenta) aviso(`No hay ninguna cuenta con el correo ${correo}.`);

  const db = createAdminClient();
  if (!db) aviso("Falta SUPABASE_SERVICE_ROLE_KEY en este servidor.");

  const { data, error } = await db!.rpc("celebrar_acreditar_creditos", {
    p_owner: cuenta!.id,
    p_cantidad: cantidad,
    p_tipo: tipo,
    p_concepto: `${concepto} · por ${sesion!.email ?? "el equipo"}`,
    p_referencia: referencia,
    p_monto_crc: tipo === "compra" && Number.isFinite(montoCrc) && montoCrc > 0 ? Math.round(montoCrc) : null,
  });
  if (error) aviso(`No se pudo acreditar: ${error.message}`);
  if (data === false) aviso(`La referencia «${referencia}» ya estaba registrada: no se acreditó nada.`);
  aviso(`Listo: ${cantidad} créditos a ${cuenta!.correo} (saldo anterior ${cuenta!.saldo}).`);
}
