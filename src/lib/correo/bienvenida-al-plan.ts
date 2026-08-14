import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";
import { camposSegunModo } from "@/lib/wallet/tarjeta";
import { tipoDe, leerBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import { consultarSaldo } from "@/lib/lealtad/motor";
import { correoDelMiembro } from "./sello-acreditado";

/**
 * EL CORREO DE BIENVENIDA — «Ya sos parte del plan de X», la primera
 * vez que alguien se afilia a una tarjeta.
 *
 * Pedido explícito del dueño: quien se afilia por el QR del mostrador
 * (`/tarjeta/[slug]`) no recibe hoy ninguna confirmación por correo de
 * que quedó adentro — el respaldo de "sello acreditado" (mismo módulo)
 * solo sale en ACREDITACIONES posteriores, no en el alta en sí.
 *
 * Se dispara SOLO cuando `alta_persona_por_qr` devuelve
 * `miembro_nuevo: true` (0138) — una membresía genuinamente nueva, no
 * cada vez que alguien re-escanea un QR del que ya es miembro. Ese
 * booleano lo calcula la propia base (0138:1929), no se adivina acá.
 *
 * Reusa `camposSegunModo` (el mismo lector que arma el pase y el correo
 * de sello acreditado) para el saldo actual: si el programa regala
 * sellos iniciales (`config.inicial`, tipos-tarjeta.ts), ese primer
 * sello YA está en el saldo que este correo muestra — sin lógica
 * especial para "bono de bienvenida", el saldo real ya lo cuenta.
 */
export async function avisarBienvenidaAlPlan(miembroId: string): Promise<void> {
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
    const saldo = (await consultarSaldo(miembroId)) ?? 0;

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
      subject: `¡Ya sos parte del plan de lealtad de ${negocioNombre}!`,
      html: `
        <h2 style="margin:0 0 12px;font-size:20px">🎉 ¡Bienvenido!</h2>
        <p style="margin:0 0 16px;font-size:14px;color:#555">
          Tu tarjeta de <strong>${escaparHtml(negocioNombre)}</strong> ya está lista y sumando
          en cada visita.
        </p>
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
          Si guardaste la tarjeta en tu Wallet, ahí también la vas a ver actualizada — este
          correo es tu respaldo por si tarda en verse en el teléfono.
        </p>
      `,
    });
  } catch (e) {
    console.warn("[correo] No se pudo avisar la bienvenida al plan:", e);
  }
}
