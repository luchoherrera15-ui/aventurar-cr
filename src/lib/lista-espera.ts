import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo } from "@/lib/email";
import { enviarPush } from "@/lib/push";
import { plantillaEspacioLiberado } from "@/lib/correo/citas-fase2";
import { fechaLargaCR, hoyISOCR } from "@/lib/fechas";

/**
 * El aviso de la lista de espera (0095): cuando el negocio cancela o
 * mueve una cita, la franja queda libre — y los que estaban esperando
 * ese día se enteran al instante. Modo v1: se avisa A TODOS los
 * apuntados y reserva quien confirme primero (el RPC crear_cita sigue
 * siendo el árbitro de la franja: no puede haber doble reserva).
 *
 * NUNCA lanza ni bloquea: la cancelación ya quedó en la base; el aviso
 * es un plus. `avisado_en` es el reclamo — se marca DENTRO del mismo
 * update que selecciona (patrón 0047), así dos liberaciones seguidas
 * no duplican el correo.
 */
export async function avisarListaEspera(ranchoId: string, fecha: string): Promise<void> {
  try {
    // Liberar una franja de ayer no le sirve a nadie.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < hoyISOCR()) return;

    const admin = createAdminClient();
    if (!admin) return;

    // El claim: solo las filas sin avisar, marcadas en el mismo update.
    const { data: apuntados } = await admin
      .from("lista_espera")
      .update({ avisado_en: new Date().toISOString() })
      .eq("rancho_id", ranchoId)
      .eq("fecha", fecha)
      .is("avisado_en", null)
      .select("id, cliente_id, correo, nombre");
    if (!apuntados || apuntados.length === 0) return;

    const { data: rancho } = await admin
      .from("ranchos")
      .select("id, nombre, slug")
      .eq("id", ranchoId)
      .maybeSingle();
    if (!rancho) return;

    const sitio = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";
    const urlReservar = `${sitio}/citas/${rancho.slug ?? rancho.id}/reservar`;
    const fechaLarga = fechaLargaCR(fecha);

    for (const a of apuntados as {
      id: string;
      cliente_id: string;
      correo: string | null;
      nombre: string | null;
    }[]) {
      // SIEMPRE al correo de la CUENTA (perfiles.email). El de la fila
      // es texto que escribió el cliente: usarlo de destinatario haría
      // de este aviso un relé de correo abierto (apuntarse con el
      // correo de un tercero y hacerle llegar correos de Bookea).
      const { data: perfil } = await admin
        .from("perfiles")
        .select("email")
        .eq("id", a.cliente_id)
        .maybeSingle();
      const correo = perfil?.email ?? null;

      let correoSalio = false;
      if (correo) {
        const res = await enviarCorreo({
          to: correo,
          subject: `Se liberó un espacio en ${rancho.nombre} — ${fechaLarga}`,
          html: plantillaEspacioLiberado({
            nombreDestinatario: a.nombre || correo,
            nombreNegocio: rancho.nombre,
            fechaLarga,
            urlReservar,
          }),
        });
        correoSalio = res.enviado;
      }
      await enviarPush({
        usuarios: [a.cliente_id],
        titulo: `¡Se liberó un espacio en ${rancho.nombre}!`,
        cuerpo: `Estabas en lista de espera para el ${fechaLarga}. Reserva quien llegue primero.`,
        data: { url: "/?tab=reservas" },
      });
      // Si había correo y NO salió (Resend caído, key ausente), se
      // devuelve el claim: la fila queda re-avisable en la próxima
      // liberación en vez de perdida con cara de "Ya avisado".
      if (correo && !correoSalio) {
        await admin.from("lista_espera").update({ avisado_en: null }).eq("id", a.id);
      }
    }
  } catch {
    // El aviso jamás tumba la operación que liberó la franja.
  }
}
