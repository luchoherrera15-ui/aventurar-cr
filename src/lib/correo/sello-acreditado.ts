import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";

/**
 * EL CORREO DE LOS SELLOS — solo en los HITOS, nunca en cada sello.
 *
 * La primera versión de este archivo mandaba un correo por CADA sello,
 * como "respaldo" de un pase de Wallet que no se actualizaba solo. Ese
 * bug ya se corrigió de raíz (el pase se refresca en segundos — ver el
 * fix de passesUpdatedSince), así que el correo-por-sello pasó de
 * respaldo útil a spam: tres correos en un día para un mismo cliente,
 * dos con media hora de diferencia, todos diciendo lo mismo que la
 * tarjeta ya mostraba en el teléfono.
 *
 * Lo que queda es lo que el correo hace MEJOR que el pase: traer al
 * cliente de vuelta en los momentos que importan.
 *
 *   · PRIMER sello   → bienvenida cálida + invitación a agregar la
 *                      tarjeta al Wallet (si todavía no la tiene, este
 *                      es EL momento de decírselo).
 *   · PENÚLTIMO      → «te falta solo 1» — el correo que genera la
 *                      próxima visita.
 *   · META alcanzada → «premio desbloqueado» — el momento de oro.
 *   · Todo lo demás  → NINGÚN correo. El pase ya se actualizó solo.
 *
 * El remitente visible sigue siendo Bookea, pero el correo HABLA como
 * el negocio: el nombre del negocio va primero en el asunto y en el
 * encabezado — es SU programa de fidelidad; Bookea es la plataforma y
 * aparece como tal, en el pie.
 */

/**
 * El correo de este miembro, sea por cuenta (perfiles) o por alta con QR
 * (personas). Se exporta: bienvenida-al-plan.ts lo reusa tal cual — dos
 * formas de resolver el mismo correo se desincronizan el día que alguien
 * cambie una y no la otra.
 */
export async function correoDelMiembro(
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

type Hito =
  | { tipo: "bienvenida" }
  | { tipo: "falta_uno"; premio: string }
  | { tipo: "premio"; premio: string };

/**
 * ¿Este saldo amerita correo? PURA y exportada para poder probarla sin
 * base de datos. `meta` es el costo de la recompensa más barata activa
 * (null si el programa no tiene ninguna — ahí solo cabe la bienvenida).
 *
 * Prioridad cuando un mismo saldo calza en dos hitos (metas chicas:
 * con meta=2, el sello 1 es primer sello Y penúltimo a la vez):
 * premio > falta uno > bienvenida — siempre gana el más cercano a la
 * plata.
 */
export function hitoDelSaldo(saldo: number, meta: number | null, premio: string | null): Hito | null {
  if (meta !== null && meta > 0 && premio) {
    // Exactamente en la meta — no ">=": si el negocio sigue sellando
    // sin que el cliente canjee (11/10, 12/10...), repetirle "premio
    // desbloqueado" en cada sello sería el mismo spam que este archivo
    // existe para eliminar.
    if (saldo === meta) return { tipo: "premio", premio };
    if (saldo === meta - 1) return { tipo: "falta_uno", premio };
  }
  if (saldo === 1) return { tipo: "bienvenida" };
  return null;
}

const ETIQUETA_UNIDAD: Record<string, [string, string]> = {
  sellos: ["sello", "sellos"],
  puntos: ["punto", "puntos"],
};

function unidadDe(modo: string, cantidad: number): string {
  const par = ETIQUETA_UNIDAD[modo] ?? ETIQUETA_UNIDAD.sellos;
  return cantidad === 1 ? par[0] : par[1];
}

/**
 * Manda el correo del hito si este saldo lo amerita. Nunca lanza — no
 * puede tumbar la operación que lo originó (el sello ya se dio).
 *
 * Mantiene el nombre y la firma de siempre: los tres puntos que lo
 * llaman (escáner, panel manual, citas) no cambian.
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
      .select("modo, rancho_id")
      .eq("id", miembro.programa_id as string)
      .maybeSingle();
    if (!programa) return;

    const { data: negocio } = await db
      .from("ranchos")
      .select("nombre, slug")
      .eq("id", programa.rancho_id as string)
      .maybeSingle();
    const negocioNombre = ((negocio?.nombre as string | null) ?? "").trim() || "El negocio";
    const slug = ((negocio?.slug as string | null) ?? "").trim();

    const { data: recompensa } = await db
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", miembro.programa_id as string)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle();

    const meta = recompensa ? Number(recompensa.costo_puntos) : null;
    const premio = recompensa ? String(recompensa.nombre).trim() : null;

    const hito = hitoDelSaldo(saldo, meta, premio);
    if (!hito) return; // sello intermedio: el pase ya se actualizó solo, nada de spam

    const modo = tipoDe((programa.modo as string | null) ?? null);
    // "visita" para sellos (se sella al venir), "compra" para el resto
    // (puntos/cashback se ganan comprando).
    const gracias = modo === "sellos" ? "¡Gracias por tu visita!" : "¡Gracias por tu compra!";
    const progreso = meta !== null ? `${saldo}/${meta}` : `${saldo}`;
    const enlaceTarjeta = slug ? `${SITIO}/tarjeta/${slug}` : `${SITIO}/cuenta/lealtad`;

    let asunto: string;
    let titulo: string;
    let cuerpo: string;
    let cta: string;

    if (hito.tipo === "premio") {
      asunto = `${negocioNombre} — 🎉 ¡Premio desbloqueado!`;
      titulo = `🎉 ¡Lo lograste! Tu ${escaparHtml(hito.premio)} te espera`;
      cuerpo = `Completaste tu tarjeta (${progreso}). Mostrala en el mostrador de ${escaparHtml(
        negocioNombre,
      )} en tu próxima visita y canjeá tu premio.`;
      cta = "Ver mi tarjeta";
    } else if (hito.tipo === "falta_uno") {
      asunto = `${negocioNombre} — ¡te falta solo 1!`;
      titulo = `${gracias} Vas ${progreso}`;
      cuerpo = `Te falta 1 ${unidadDe(modo, 1)} para tu ${escaparHtml(
        hito.premio,
      )} — tu próxima visita a ${escaparHtml(negocioNombre)} tiene premio.`;
      cta = "Ver mi tarjeta";
    } else {
      asunto = `${negocioNombre} — ¡tu tarjeta ya arrancó!`;
      titulo = `${gracias} Vas ${progreso}`;
      cuerpo =
        premio && meta !== null
          ? `Ya tenés tu primer ${unidadDe(modo, 1)} en ${escaparHtml(
              negocioNombre,
            )}. Al llegar a ${meta} te llevás: ${escaparHtml(premio)}.`
          : `Ya tenés tu primer ${unidadDe(modo, 1)} en ${escaparHtml(negocioNombre)}.`;
      cta = "Agregar mi tarjeta al Wallet";
    }

    await enviarCorreo({
      to: correo,
      subject: asunto,
      // Los hexadecimales van literales porque ningún cliente de correo
      // soporta variables CSS. El botón es el azul de acción sobre el
      // blanco del buzón (#0f4c9e con letra blanca, 8,24:1). Antes era
      // naranja con letra navy, y el correo de bienvenida usaba el mismo
      // naranja con letra BLANCA: dos criterios para el mismo botón.
      html: `
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a93a6">
          ${escaparHtml(negocioNombre)}
        </p>
        <h2 style="margin:0 0 12px;font-size:21px;color:#0a1226">${titulo}</h2>
        <p style="margin:0 0 8px;font-size:34px;font-weight:800;color:#0a1226">${escaparHtml(progreso)}</p>
        <p style="margin:0 0 22px;font-size:14.5px;line-height:1.55;color:#4b5468">${cuerpo}</p>
        <p style="margin:0 0 24px">
          <a href="${enlaceTarjeta}"
             style="display:inline-block;background:#0f4c9e;color:#ffffff;padding:12px 22px;
                    border-radius:10px;font-weight:800;text-decoration:none;font-size:14px">
            ${escaparHtml(cta)}
          </a>
        </p>
        <p style="margin:0;font-size:12px;color:#9aa1b0">
          Programa de fidelidad de ${escaparHtml(negocioNombre)} · con Bookea.
          Si tenés la tarjeta en tu Wallet, ya se actualizó sola en tu teléfono.
        </p>
      `,
    });
  } catch (e) {
    console.warn("[correo] No se pudo avisar el hito de la tarjeta:", e);
  }
}
