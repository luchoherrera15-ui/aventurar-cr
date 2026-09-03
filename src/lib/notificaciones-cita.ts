import { createAdminClient } from "@/lib/supabase/admin";
import {
  destinatariosDelNegocio,
  type DestinatarioNegocio,
} from "@/lib/destinatarios-negocio";
import {
  enlacesCalendario,
  enviarCorreo,
  plantillaCitaConfirmada,
  plantillaCitaNuevaProveedor,
} from "@/lib/email";
import { enviarPush } from "@/lib/push";
import { horaBonita } from "@/app/citas/tipos";

/**
 * Los avisos de una cita recién creada: correo al cliente ("quedó
 * confirmada") y al negocio ("tenés una cita nueva"), más el push de
 * cada uno. Vive acá y no en la acción de la web porque hay dos
 * caminos que terminan en lo mismo — la acción crearCita de la web y
 * la app móvil, que llama al RPC directo y luego pega en
 * /api/citas/[id]/confirmacion porque no tiene servidor propio.
 *
 * Una sola vez por cita: la bandera `confirmacion_enviada` se reclama
 * DENTRO del update, el mismo patrón de las reservas de eventos.
 * Nunca lanza: la cita ya quedó guardada pase lo que pase.
 *
 * @param opciones.maxAntiguedadMinutos Solo avisa si la cita se creó
 *   hace menos de ese rato — lo usa el endpoint público para acotar
 *   lo que puede disparar un desconocido.
 */
export async function notificarCitaConfirmada(
  reservaId: string,
  opciones?: { maxAntiguedadMinutos?: number },
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  let consulta = admin
    .from("reservas")
    .update({ confirmacion_enviada: true })
    .eq("id", reservaId)
    .eq("confirmacion_enviada", false)
    .not("hora_inicio", "is", null);

  if (opciones?.maxAntiguedadMinutos) {
    const desde = new Date(
      Date.now() - opciones.maxAntiguedadMinutos * 60 * 1000,
    ).toISOString();
    consulta = consulta.gte("created_at", desde);
  }

  const { data } = await consulta
    .select(
      // `rancho_id` va acá para que el push del negocio pueda llevarlo
      // a SU agenda. Sin él, la notificación de una cita nueva no tiene
      // con qué armar la ruta y termina cayendo en una pestaña que le
      // muestra al dueño sus propias reservas como cliente — vacía.
      "id, rancho_id, nombre, correo, fecha, hora_inicio, duracion_minutos, tipo_evento, monto_total, deposito_monto, miembro_id, cliente_id, ranchos(nombre, owner_id, direccion_exacta, canton, provincia, sinpe_numero, sinpe_titular)",
    )
    .maybeSingle();
  if (!data) return;

  const r = data as unknown as {
    id: string;
    /** El negocio, para que el push del dueño abra SU agenda. */
    rancho_id: string | null;
    nombre: string | null;
    correo: string | null;
    fecha: string;
    hora_inicio: string;
    duracion_minutos: number | null;
    tipo_evento: string | null;
    monto_total: number | null;
    deposito_monto: number | null;
    miembro_id: string | null;
    cliente_id: string | null;
    ranchos: {
      nombre: string;
      owner_id: string;
      direccion_exacta: string | null;
      canton: string | null;
      provincia: string | null;
      sinpe_numero: string | null;
      sinpe_titular: string | null;
    } | null;
  };

  // Depósito para asegurar la cita (0095): si el RPC lo fijó, el
  // correo trae el monto y la cuenta SINPE del negocio.
  const deposito = Number(r.deposito_monto ?? 0);

  const nombreNegocio = r.ranchos?.nombre ?? "el negocio";
  const hora = horaBonita(r.hora_inicio.slice(0, 5));

  // Los botones de "guardar en mi calendario" del correo: Google
  // Calendar prellenado y el .ics para Apple/Outlook.
  const calendario = enlacesCalendario({
    reservaId: r.id,
    titulo: `${r.tipo_evento ?? "Cita"} — ${nombreNegocio}`,
    fecha: r.fecha,
    horaInicio: r.hora_inicio.slice(0, 5),
    duracionMinutos: r.duracion_minutos ?? 30,
    ubicacion:
      [r.ranchos?.direccion_exacta, r.ranchos?.canton, r.ranchos?.provincia]
        .filter(Boolean)
        .join(", ") || null,
  });
  const [y, m, d] = r.fecha.split("-").map(Number);
  const fechaLarga = new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let nombreMiembro: string | null = null;
  if (r.miembro_id) {
    const { data: miembro } = await admin
      .from("equipo_rancho")
      .select("nombre")
      .eq("id", r.miembro_id)
      .maybeSingle();
    nombreMiembro = miembro?.nombre ?? null;
  }

  if (r.correo) {
    await enviarCorreo({
      to: r.correo,
      subject: `Tu cita en ${nombreNegocio} quedó confirmada`,
      html: plantillaCitaConfirmada({
        nombreCliente: r.nombre || r.correo,
        nombreNegocio,
        servicio: r.tipo_evento ?? "tu servicio",
        fechaLarga,
        hora,
        duracionMinutos: r.duracion_minutos ?? 30,
        monto: r.monto_total,
        nombreMiembro,
        reservaId: r.id,
        calendario,
        deposito,
        sinpe: {
          numero: r.ranchos?.sinpe_numero ?? null,
          titular: r.ranchos?.sinpe_titular ?? null,
        },
      }),
    });
  }

  // Al negocio: el dueño Y los colaboradores seteados (pedido del
  // dueño, 2 sep 2026) — el administrador que atiende la agenda tiene
  // que enterarse igual que el owner.
  let equipo: DestinatarioNegocio[] = [];
  if (r.ranchos?.owner_id && r.rancho_id) {
    equipo = await destinatariosDelNegocio(admin, r.rancho_id, r.ranchos.owner_id);
    for (const persona of equipo) {
      await enviarCorreo({
        to: persona.email,
        subject: `Cita nueva en ${nombreNegocio}: ${fechaLarga}, ${hora}`,
        html: plantillaCitaNuevaProveedor({
          nombreProveedor: persona.nombre || persona.email,
          nombreNegocio,
          nombreCliente: r.nombre || "Un cliente",
          servicio: r.tipo_evento ?? "un servicio",
          fechaLarga,
          hora,
          nombreMiembro,
          calendario,
        }),
      });
    }
  }

  // El push acompaña al correo: al negocio le suena la cita nueva en
  // el teléfono, y el cliente (si reservó con cuenta) recibe la
  // confirmación. La bandera del update de arriba evita repetidos.
  // ── ADÓNDE LLEVA EL AVISO DEL NEGOCIO ────────────────────────────
  // A su AGENDA del día de la cita, que es donde se atiende: ahí sale
  // en la grilla con el cliente y el servicio, y desde ahí se marca
  // cumplida, se cancela o se abre el chat.
  //
  // Antes iba a "/?tab=reservas", y eso estaba mal de una forma que no
  // se veía: esa pestaña consulta reservas con `cliente_id = mi
  // usuario`, o sea que al DUEÑO le mostraba las reservas que él hizo
  // como cliente — casi siempre ninguna. Le sonaba el teléfono por una
  // cita y aterrizaba en una lista vacía.
  //
  // Si por lo que sea faltara el id del negocio, se manda a la raíz en
  // vez de armar "/negocio/undefined/agenda".
  const agendaDelNegocio = r.rancho_id
    ? `/negocio/${r.rancho_id}/agenda?fecha=${r.fecha}`
    : "/";

  await enviarPush({
    // Si perfiles no devolvió a nadie (cuentas sin correo), el push
    // igual va al owner — son canales distintos.
    usuarios: equipo.length ? equipo.map((p) => p.id) : [r.ranchos?.owner_id],
    titulo: `Cita nueva en ${nombreNegocio}`,
    cuerpo: `${r.nombre || "Un cliente"} — ${r.tipo_evento ?? "un servicio"}, ${fechaLarga}, ${hora}.`,
    data: { url: agendaDelNegocio },
  });
  await enviarPush({
    usuarios: [r.cliente_id],
    titulo: "¡Tu cita quedó confirmada!",
    cuerpo:
      deposito > 0
        ? `${nombreNegocio} — ${fechaLarga}, ${hora}. Asegurala con tu depósito por SINPE (revisá el correo).`
        : `${nombreNegocio} — ${fechaLarga}, ${hora}. El pago es en el local.`,
    data: { url: "/?tab=reservas" },
  });
}
