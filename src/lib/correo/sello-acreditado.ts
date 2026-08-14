import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";
import { camposSegunModo } from "@/lib/wallet/tarjeta";
import { tipoDe, leerBeneficio } from "@/lib/lealtad/tipos-tarjeta";

/**
 * EL RESPALDO POR CORREO — «Se acreditó tu sello», con un link a
 * /cuenta/lealtad para verlo sin depender del Wallet.
 *
 * Nace de un problema real y medido esta misma tarde: el aviso push de
 * Apple no siempre despierta la app en el teléfono, así que la tarjeta
 * del Wallet puede quedar atrasada un rato (o hasta que el cliente
 * saque y vuelva a poner el pase). El correo NO tiene ese problema —
 * llega siempre o no llega, sin un paso intermedio que pueda fallar en
 * silencio — y el panel que enlaza (/cuenta/lealtad) lee el saldo
 * directo de la base en cada visita, nunca de una copia que se pueda
 * desactualizar.
 *
 * Se manda con la MISMA sesión de correo que ya recoge Bookea al pedir
 * el código de acceso (signInWithOtp) — no hace falta pedirle nada
 * nuevo a nadie.
 */

/** El correo de este miembro, sea por cuenta (perfiles) o por alta con QR (personas). */
async function correoDelMiembro(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  miembroId: string,
): Promise<string | null> {
  const { data: miembro } = await db
    .from("miembros")
    .select("cliente_id, persona_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return null;

  if (miembro.cliente_id) {
    const { data: perfil } = await db
      .from("perfiles")
      .select("email")
      .eq("id", miembro.cliente_id as string)
      .maybeSingle();
    const correo = ((perfil?.email as string | null) ?? "").trim();
    if (correo.includes("@")) return correo;
  }
  if (miembro.persona_id) {
    const { data: persona } = await db
      .from("personas")
      .select("correo")
      .eq("id", miembro.persona_id as string)
      .maybeSingle();
    const correo = ((persona?.correo as string | null) ?? "").trim();
    if (correo.includes("@")) return correo;
  }
  return null;
}

/**
 * Manda el correo de "sello acreditado". Nunca lanza — es un respaldo,
 * no puede tumbar la operación que lo originó (el sello ya se dio).
 *
 * Recibe el SALDO ya calculado (no lo vuelve a sumar): quien llama
 * —`otorgarPuntos`— ya lo tiene a mano, y pedirlo dos veces sería la
 * misma consulta repetida sin necesidad.
 */
export async function avisarSelloPorCorreo(miembroId: string, saldo: number): Promise<void> {
  try {
    const db = createAdminClient();
    if (!db) return;

    const correo = await correoDelMiembro(db, miembroId);
    if (!correo) return; // sin correo conocido, no hay a quién avisarle

    const { data: miembro } = await db
      .from("miembros")
      .select("programa_id")
      .eq("id", miembroId)
      .maybeSingle();
    if (!miembro) return;

    const { data: programa } = await db
      .from("programa_lealtad")
      .select("*")
      .eq("id", miembro.programa_id as string)
      .maybeSingle();
    if (!programa) return;

    const { data: negocio } = await db
      .from("ranchos")
      .select("nombre")
      .eq("id", programa.rancho_id as string)
      .maybeSingle();
    const negocioNombre = ((negocio?.nombre as string | null) ?? "").trim() || "el negocio";

    const modo = tipoDe((programa.modo as string | null) ?? null);
    const beneficio = leerBeneficio(programa.beneficio, modo);

    const { data: recompensa } = await db
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", miembro.programa_id as string)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle();

    const campos = camposSegunModo({
      negocioNombre,
      saldo,
      meta: recompensa
        ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
        : null,
      config: { modo, pase_color_fondo: null, pase_color_sello: null, pase_logo_url: null },
      beneficio,
    });

    await enviarCorreo({
      to: correo,
      // Genérico y no "¡Sello acreditado!": este mismo correo lo manda
      // un programa de puntos o de cashback, donde hablar de "sello" es
      // sencillamente falso.
      subject: `¡Tu tarjeta de ${negocioNombre} se actualizó!`,
      html: `
        <h2 style="margin:0 0 12px;font-size:20px">✓ ¡Listo! Ya se sumó</h2>
        <p style="margin:0 0 4px;font-size:14px;color:#555">${escaparHtml(campos.encabezado.label)}</p>
        <p style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0a1226">
          ${escaparHtml(campos.encabezado.value)}
        </p>
        <p style="margin:0 0 20px;font-size:14px;color:#555">${escaparHtml(campos.detalle.value)}</p>
        <p style="margin:0 0 20px">
          <a href="${SITIO}/cuenta/lealtad"
             style="display:inline-block;background:#ee7420;color:#fff;padding:12px 22px;
                    border-radius:10px;font-weight:700;text-decoration:none;font-size:14px">
            Ver mi tarjeta
          </a>
        </p>
        <p style="margin:0;font-size:12.5px;color:#999">
          Si tenés la tarjeta en tu Wallet, se actualiza sola ahí también — este correo es
          un respaldo por si tarda en verse en el teléfono.
        </p>
      `,
    });
  } catch (e) {
    console.warn("[correo] No se pudo avisar el sello acreditado:", e);
  }
}
