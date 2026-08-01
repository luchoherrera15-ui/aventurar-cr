"use server";

import { redirect } from "next/navigation";
import { verificarBaja } from "@/lib/correo/baja";
import { registrarConsentimiento } from "@/lib/correo/marketing";

/**
 * Confirma la baja de correos de marketing. El formulario de /baja
 * manda de vuelta los mismos parámetros del link: acá se verifica la
 * firma OTRA vez (nunca se confía en campos ocultos) y recién entonces
 * se escribe la revocación en el ledger (0082).
 */
export async function confirmarBaja(formData: FormData): Promise<void> {
  const datos = verificarBaja({
    e: String(formData.get("e") ?? ""),
    r: String(formData.get("r") ?? "") || undefined,
    t: String(formData.get("t") ?? ""),
  });
  if (!datos) redirect("/baja");

  const { error } = await registrarConsentimiento({
    correo: datos.correo,
    ranchoId: datos.ranchoId,
    estado: "revocado",
    origen: "link_baja",
  });
  if (error) redirect("/baja?error=1");

  redirect(`/baja?listo=1${datos.ranchoId ? `&r=${datos.ranchoId}` : ""}`);
}
