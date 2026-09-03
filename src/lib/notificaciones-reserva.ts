import { createAdminClient } from "@/lib/supabase/admin";
import {
  destinatariosDelNegocio,
  type DestinatarioNegocio,
} from "@/lib/destinatarios-negocio";
import { fmtFechaCorta } from "@/lib/fechas";
import { enviarPush } from "@/lib/push";
import {
  enlacesCalendario,
  enviarCorreo,
  plantillaConfirmacionReserva,
  plantillaReservaAprobada,
  plantillaReservaNuevaProveedor,
} from "@/lib/email";

/**
 * Los correos que salen cuando una reserva queda hecha: la
 * confirmación al cliente y el aviso al dueño del lugar.
 *
 * Vive acá y no dentro de la acción de la web porque hay dos caminos
 * que terminan en lo mismo — el formulario de la web y la app móvil,
 * que llama al endpoint /api/reservas/[id]/confirmacion porque no
 * tiene servidor propio. Tener la lógica de "a quién se le avisa" en
 * un solo lado evita que un cambio se aplique en uno y en el otro no.
 *
 * Solo servidor: usa la llave de servicio de Supabase.
 */

export type ResultadoNotificacion = {
  notificada: boolean;
  motivo?: "sin-service-key" | "no-elegible" | "error";
};

type FilaReserva = {
  id: string;
  fecha: string;
  nombre: string | null;
  correo: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  horario_bloque: string | null;
  deposito_monto: number | null;
  monto_total: number | null;
  rancho_id: string | null;
  cliente_id: string | null;
  ranchos: {
    nombre: string;
    owner_id: string;
    /** Solo las consultas que los piden los traen. */
    direccion_exacta?: string | null;
    canton?: string | null;
    provincia?: string | null;
  } | null;
};

/**
 * Manda los dos correos de una reserva recién completada. Una sola vez
 * por reserva: la bandera `confirmacion_enviada` se reclama dentro del
 * mismo UPDATE que lee los datos, así dos llamadas simultáneas no
 * mandan correos repetidos (ver 0042_aviso_reserva_nueva.sql).
 *
 * Que la bandera se marque ANTES de enviar es a propósito: si Resend
 * se cae, se pierde el correo en vez de arriesgar mandarlo diez veces.
 * Para un endpoint público conviene ese lado — y el correo acá es un
 * plus, la reserva ya quedó guardada pase lo que pase.
 *
 * Nunca lanza: quien la llama ya guardó la reserva y no puede fallar
 * por un correo.
 *
 * @param opciones.maxAntiguedadMinutos Solo avisa si la reserva se creó
 *   hace menos de ese rato. Lo usa el endpoint público para acotar lo
 *   que puede disparar un desconocido; los llamadores de confianza lo
 *   omiten.
 */
export async function notificarReservaCompletada(
  reservaId: string,
  opciones?: { maxAntiguedadMinutos?: number },
): Promise<ResultadoNotificacion> {
  // La llave de servicio no es una comodidad acá: la política de
  // lectura de `perfiles` solo deja ver el propio perfil, así que sin
  // ella no hay forma de averiguar el correo del dueño del lugar.
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      `[reserva] Falta SUPABASE_SERVICE_ROLE_KEY — no se avisó de la reserva ${reservaId}.`,
    );
    return { notificada: false, motivo: "sin-service-key" };
  }

  try {
    let consulta = admin
      .from("reservas")
      .update({ confirmacion_enviada: true })
      .eq("id", reservaId)
      .eq("estado", "pendiente")
      .eq("confirmacion_enviada", false);

    if (opciones?.maxAntiguedadMinutos) {
      const desde = new Date(
        Date.now() - opciones.maxAntiguedadMinutos * 60 * 1000,
      ).toISOString();
      consulta = consulta.gte("created_at", desde);
    }

    const { data, error } = await consulta
      .select(
        "id, fecha, nombre, correo, tipo_evento, invitados, horario_bloque, deposito_monto, monto_total, rancho_id, cliente_id, ranchos(nombre, owner_id)",
      )
      .maybeSingle();

    if (error) {
      console.error("[reserva] No se pudo reclamar el aviso:", error);
      return { notificada: false, motivo: "error" };
    }

    // Sin fila: ya se avisó, no existe, no está en 'pendiente' o quedó
    // fuera de la ventana. A propósito no se distingue entre esos casos
    // — quien llama al endpoint público no tiene por qué saber cuál es.
    if (!data) return { notificada: false, motivo: "no-elegible" };

    const reserva = data as unknown as FilaReserva;
    const nombreRancho = reserva.ranchos?.nombre ?? "el lugar reservado";

    // Al cliente, al correo que dejó en el formulario.
    const deposito = Number(reserva.deposito_monto ?? 0);
    if (reserva.correo) {
      await enviarCorreo({
        to: reserva.correo,
        // El correo del cliente no nombra al negocio: habla de "su
        // reserva en Bookea.lat" (pedido de producto).
        subject: "Su reserva en Bookea.lat fue exitosa",
        html: plantillaConfirmacionReserva({
          nombreCliente: reserva.nombre || reserva.correo,
          fecha: reserva.fecha,
          horario: reserva.horario_bloque ?? null,
          invitados: reserva.invitados,
          montoDeposito: deposito,
          // Lo que queda por pagarle al lugar el día del evento.
          montoPendiente: Math.max(0, Number(reserva.monto_total ?? 0) - deposito),
        }),
      });
    }

    // Al negocio: el dueño Y los colaboradores seteados (pedido del
    // dueño, 2 sep 2026 — «que los correos le lleguen a los
    // administradores de los ranchos»). El mismo correo para todos:
    // quien atiende necesita exactamente la misma información.
    let equipo: DestinatarioNegocio[] = [];
    if (reserva.ranchos?.owner_id && reserva.rancho_id) {
      equipo = await destinatariosDelNegocio(
        admin,
        reserva.rancho_id,
        reserva.ranchos.owner_id,
      );

      for (const persona of equipo) {
        await enviarCorreo({
          to: persona.email,
          subject: `Nueva reserva en ${nombreRancho} — ${fmtFechaCorta(reserva.fecha)}`,
          html: plantillaReservaNuevaProveedor({
            nombreProveedor: persona.nombre || persona.email,
            nombreRancho,
            ranchoId: reserva.rancho_id,
            nombreCliente: reserva.nombre || reserva.correo || "Un cliente",
            fecha: reserva.fecha,
            horario: reserva.horario_bloque ?? null,
            tipoEvento: reserva.tipo_evento,
            invitados: reserva.invitados,
            montoDeposito: reserva.deposito_monto,
            // Lo mismo que ya se le dice al cliente: total − adelanto.
            montoPendiente: Math.max(
              0,
              Number(reserva.monto_total ?? 0) - deposito,
            ),
          }),
        });
      }
    }

    // El push acompaña al correo: al equipo del negocio le suena el
    // teléfono con la reserva nueva, y al cliente (si reservó con
    // cuenta) le queda el aviso de "recibida". La misma bandera de
    // arriba evita repetidos. Si perfiles no devolvió a nadie (cuentas
    // sin correo), el push igual va al owner — son canales distintos.
    await enviarPush({
      usuarios: equipo.length
        ? equipo.map((p) => p.id)
        : [reserva.ranchos?.owner_id],
      titulo: `Nueva reserva en ${nombreRancho}`,
      cuerpo: `${reserva.nombre || "Un cliente"} reservó el ${fmtFechaCorta(reserva.fecha)} — revisá el comprobante.`,
      // Directo al panel del negocio en la app — "/?tab=reservas" es la
      // pestaña de reservas COMO CLIENTE, no donde se aprueba.
      data: { url: `/negocio/${reserva.rancho_id}` },
    });
    await enviarPush({
      usuarios: [reserva.cliente_id],
      titulo: "Recibimos tu reserva",
      cuerpo: `${nombreRancho} — ${fmtFechaCorta(reserva.fecha)}. Te avisamos en cuanto el negocio la confirme.`,
      data: { url: "/?tab=reservas" },
    });

    return { notificada: true };
  } catch (err) {
    // enviarCorreo ya se traga sus propios errores, pero una caída de
    // red hablando con Supabase sí puede tirar acá — y esta función no
    // puede lanzar hacia una reserva que ya se guardó.
    console.error("[reserva] Error inesperado avisando de la reserva:", err);
    return { notificada: false, motivo: "error" };
  }
}

/**
 * Le avisa al cliente que el proveedor le aprobó la reserva. Este es el
 * correo que confirma de verdad — el de `notificarReservaCompletada`
 * solo dice "la recibimos, está en aprobación".
 *
 * Lo llaman los tres caminos por los que se aprueba: el panel de admin,
 * el panel del proveedor en la web (los dos vía setEstadoReserva) y el
 * panel del móvil, que como no tiene servidor pega en
 * /api/reservas/[id]/aprobacion.
 *
 * Una sola vez por reserva: la bandera `aprobacion_enviada` se reclama
 * dentro del mismo UPDATE que lee los datos. Eso importa porque en el
 * móvil se puede quitar la confirmación y volver a confirmar, y sin la
 * bandera cada ida y vuelta le mandaría otro correo al cliente.
 *
 * Nunca lanza: la reserva ya quedó aprobada en la base pase lo que pase
 * con el correo.
 */
export async function notificarReservaAprobada(
  reservaId: string,
): Promise<ResultadoNotificacion> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      `[reserva] Falta SUPABASE_SERVICE_ROLE_KEY — no se avisó la aprobación de ${reservaId}.`,
    );
    return { notificada: false, motivo: "sin-service-key" };
  }

  try {
    const { data, error } = await admin
      .from("reservas")
      .update({ aprobacion_enviada: true })
      .eq("id", reservaId)
      .eq("estado", "confirmada")
      .eq("aprobacion_enviada", false)
      .select(
        "id, fecha, nombre, correo, tipo_evento, invitados, horario_bloque, deposito_monto, monto_total, rancho_id, cliente_id, ranchos(nombre, owner_id, direccion_exacta, canton, provincia)",
      )
      .maybeSingle();

    if (error) {
      console.error("[reserva] No se pudo reclamar el aviso de aprobación:", error);
      return { notificada: false, motivo: "error" };
    }

    // Sin fila: ya se avisó, todavía no está confirmada, o no existe.
    if (!data) return { notificada: false, motivo: "no-elegible" };

    const reserva = data as unknown as FilaReserva;
    if (!reserva.correo) return { notificada: false, motivo: "no-elegible" };

    const nombreRancho = reserva.ranchos?.nombre ?? "el lugar reservado";
    const deposito = Number(reserva.deposito_monto ?? 0);

    await enviarCorreo({
      to: reserva.correo,
      subject: "Su reserva en Bookea.lat quedó confirmada",
      html: plantillaReservaAprobada({
        nombreCliente: reserva.nombre || reserva.correo,
        fecha: reserva.fecha,
        horario: reserva.horario_bloque ?? null,
        tipoEvento: reserva.tipo_evento,
        invitados: reserva.invitados,
        montoPendiente: Math.max(0, Number(reserva.monto_total ?? 0) - deposito),
        // "Guardar en mi calendario": evento de día completo.
        calendario: enlacesCalendario({
          reservaId: reserva.id,
          titulo: `${reserva.tipo_evento ?? "Evento"} en ${nombreRancho}`,
          fecha: reserva.fecha,
          horaInicio: null,
          duracionMinutos: 0,
          ubicacion:
            [
              reserva.ranchos?.direccion_exacta,
              reserva.ranchos?.canton,
              reserva.ranchos?.provincia,
            ]
              .filter(Boolean)
              .join(", ") || null,
        }),
      }),
    });

    // Y al teléfono, si reservó con cuenta y tiene la app.
    await enviarPush({
      usuarios: [reserva.cliente_id],
      titulo: "¡Tu reserva quedó confirmada!",
      cuerpo: `${nombreRancho} te confirmó el ${fmtFechaCorta(reserva.fecha)}.`,
      data: { url: "/?tab=reservas" },
    });

    return { notificada: true };
  } catch (err) {
    console.error("[reserva] Error inesperado avisando la aprobación:", err);
    return { notificada: false, motivo: "error" };
  }
}
