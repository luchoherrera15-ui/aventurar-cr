import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  destinatariosDelNegocio,
  type DestinatarioNegocio,
} from "@/lib/destinatarios-negocio";
import {
  enviarCorreo,
  plantillaAvisoAgenda,
  plantillaFindeLibre,
  plantillaPedirResena,
  plantillaRecordatorioCita,
  plantillaRecordatorioCobro,
  plantillaRecordatorioEvento,
} from "@/lib/email";
import { agruparClientes, esReincidente } from "@/lib/crm-citas";
import { enviarPush } from "@/lib/push";
import { sincronizarAgendaExterna } from "@/lib/agenda/importar-ics";
import { avisarPruebasPorVencer } from "@/lib/lealtad/avisos-prueba";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { horaBonita } from "@/app/citas/tipos";
import { fmtColones, saldoPendiente, type ReservaFinanzas } from "@/lib/finanzas";

/**
 * Los avisos diarios — lo dispara el cron de Vercel una vez al día
 * (ver vercel.json). Cinco trabajos, cada uno con su bandera de
 * una-sola-vez:
 *
 *  1. Recordatorio T-1: reservas confirmadas para MAÑANA (hora de
 *     Costa Rica) → correo al cliente y al proveedor
 *     (recordatorio_enviado).
 *  2. Pedir reseña: eventos confirmados de AYER → "¿cómo te fue?
 *     calificá tu experiencia" al cliente (resena_solicitada).
 *  3. Finde libre: si un Lugar tiene libre un viernes/sábado/domingo
 *     que está a 2-3 días, se le avisa al dueño para que pueda poner
 *     un descuento y pelear esa fecha (avisos_finde_libre).
 *  4. Recordatorio de cobro: eventos confirmados de HOY con saldo sin
 *     cobrar → aviso al proveedor por correo y push, antes de que el
 *     auto-cobro de la noche (/api/auto-cobro) lo dé por cobrado solo
 *     (recordatorio_cobro_enviado).
 *  5. Aviso de agenda (solo negocios de citas): citas de AYER que
 *     quedaron sin marcar (¿vino o no vino?) y clientes que ya
 *     acumulan dos no-shows seguidos → correo y push al dueño con el
 *     CTA a su panel (avisos_agenda, un aviso por día como máximo).
 *     Avisar, no auto-marcar: no_asistio tiene consecuencias (lealtad).
 *  6. Refresco de agendas externas conectadas.
 *  7. Pruebas de Lealtad por vencer: aviso al dueño unos días ANTES
 *     del corte. No apaga nada — el corte lo hace cumplir la base con
 *     `addons_negocio.vence_en`; esto es solo la cortesía de avisar.
 *
 * Corre con la service key (el cron no tiene sesión de usuario). Si
 * falta la key o la de Resend, responde explicando qué falta en vez
 * de fallar en silencio.
 */
export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno." },
      { status: 500 },
    );
  }

  const manana = sumarDiasISO(hoyISOCR(), 1);

  const { data, error } = await admin
    .from("reservas")
    .select(
      "id, fecha, hora_inicio, nombre, correo, tipo_evento, invitados, rancho_id, cliente_id, ranchos(nombre, owner_id)",
    )
    .eq("estado", "confirmada")
    .eq("fecha", manana)
    .eq("recordatorio_enviado", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Fila = {
    id: string;
    fecha: string;
    hora_inicio: string | null;
    nombre: string | null;
    correo: string | null;
    tipo_evento: string | null;
    invitados: number | null;
    rancho_id: string;
    cliente_id: string | null;
    ranchos: { nombre: string; owner_id: string } | null;
  };
  const reservas = (data ?? []) as unknown as Fila[];

  let enviados = 0;
  for (const r of reservas) {
    const nombreRancho = r.ranchos?.nombre ?? "tu evento";
    // Solo las citas llevan hora_inicio — es el discriminador entre
    // "mañana es tu cita a las 2:30" y "mañana es tu evento".
    const esCita = r.hora_inicio !== null;
    const hora = esCita ? horaBonita(r.hora_inicio!.slice(0, 5)) : null;

    // Al cliente, al correo que dejó en la reserva.
    if (r.correo) {
      await enviarCorreo({
        to: r.correo,
        subject: esCita
          ? `Mañana es tu cita en ${nombreRancho}`
          : `Mañana es tu evento en ${nombreRancho}`,
        html: esCita
          ? plantillaRecordatorioCita({
              nombreDestinatario: r.nombre || r.correo,
              nombreNegocio: nombreRancho,
              fecha: r.fecha,
              hora: hora!,
              servicio: r.tipo_evento,
              esProveedor: false,
            })
          : plantillaRecordatorioEvento({
              nombreDestinatario: r.nombre || r.correo,
              nombreRancho,
              fecha: r.fecha,
              esProveedor: false,
              tipoEvento: r.tipo_evento,
              invitados: r.invitados,
            }),
      });
    }

    // Al negocio: el dueño Y los colaboradores seteados (pedido del
    // dueño, 2 sep 2026) — quien va a atender mañana necesita el
    // recordatorio igual que el owner.
    let equipo: DestinatarioNegocio[] = [];
    if (r.ranchos?.owner_id && r.rancho_id) {
      equipo = await destinatariosDelNegocio(admin, r.rancho_id, r.ranchos.owner_id);
      for (const persona of equipo) {
        await enviarCorreo({
          to: persona.email,
          subject: esCita
            ? `Mañana tenés una cita en ${nombreRancho}`
            : `Mañana tenés un evento en ${nombreRancho}`,
          html: esCita
            ? plantillaRecordatorioCita({
                nombreDestinatario: persona.nombre || persona.email,
                nombreNegocio: nombreRancho,
                fecha: r.fecha,
                hora: hora!,
                servicio: r.tipo_evento,
                esProveedor: true,
              })
            : plantillaRecordatorioEvento({
                nombreDestinatario: persona.nombre || persona.email,
                nombreRancho,
                fecha: r.fecha,
                esProveedor: true,
                tipoEvento: r.tipo_evento,
                invitados: r.invitados,
              }),
        });
      }
    }

    // El push acompaña al correo — al teléfono de cada parte.
    await enviarPush({
      usuarios: [r.cliente_id],
      titulo: esCita
        ? `Mañana: tu cita en ${nombreRancho}`
        : `Mañana: tu evento en ${nombreRancho}`,
      cuerpo: esCita
        ? `${r.tipo_evento ?? "Tu servicio"} a las ${hora}. Si no podés llegar, avisá por el chat.`
        : "Todo listo para mañana. Cualquier duda, escribí por el chat.",
      data: { url: "/?tab=reservas" },
    });
    // ── EL RECORDATORIO DEL NEGOCIO VA A SU AGENDA ─────────────────
    // Iba a "/?tab=reservas", que es la pestaña del CLIENTE: consulta
    // reservas con `cliente_id = mi usuario`, así que al dueño le
    // mostraba las reservas que él hizo como cliente — casi siempre
    // ninguna. Le sonaba el teléfono por su propio evento de mañana y
    // aterrizaba en una lista vacía.
    //
    // El día del evento va en la URL para que abra parado ahí. Si
    // faltara el id del negocio se manda a la raíz, nunca a
    // "/negocio/undefined/agenda".
    const agendaDelNegocio = r.rancho_id
      ? `/negocio/${r.rancho_id}/agenda?fecha=${r.fecha}`
      : "/";

    await enviarPush({
      // Si perfiles no devolvió a nadie (cuentas sin correo), el push
      // igual va al owner — son canales distintos.
      usuarios: equipo.length ? equipo.map((p) => p.id) : [r.ranchos?.owner_id],
      titulo: esCita
        ? `Mañana tenés una cita en ${nombreRancho}`
        : `Mañana tenés un evento en ${nombreRancho}`,
      cuerpo: esCita
        ? `${r.nombre || "Un cliente"} — ${r.tipo_evento ?? "servicio"} a las ${hora}.`
        : `${r.nombre || "Un cliente"}${r.invitados ? ` — ${r.invitados} invitados` : ""}. Revisá tu agenda.`,
      data: { url: agendaDelNegocio },
    });

    await admin
      .from("reservas")
      .update({ recordatorio_enviado: true })
      .eq("id", r.id);
    enviados++;
  }

  // ---------- 2. Pedir reseña: los eventos de ayer ----------
  const ayer = sumarDiasISO(hoyISOCR(), -1);
  // El reclamo va DENTRO del update (una sola vez por reserva, aunque
  // el cron corra dos veces) — mismo patrón que los correos de reserva.
  const { data: paraResena } = await admin
    .from("reservas")
    .update({ resena_solicitada: true })
    .eq("estado", "confirmada")
    .eq("fecha", ayer)
    .eq("resena_solicitada", false)
    .not("correo", "is", null)
    .select("id, nombre, correo, ranchos(nombre)");

  let resenasPedidas = 0;
  for (const r of (paraResena ?? []) as unknown as {
    id: string;
    nombre: string | null;
    correo: string;
    ranchos: { nombre: string } | null;
  }[]) {
    const nombreRancho = r.ranchos?.nombre ?? "tu proveedor";
    await enviarCorreo({
      to: r.correo,
      subject: `¿Cómo te fue con ${nombreRancho}? Dejá tu reseña`,
      html: plantillaPedirResena({
        nombreCliente: r.nombre || r.correo,
        nombreRancho,
      }),
    });
    resenasPedidas++;
  }

  // ---------- 3. Finde libre: viernes/sábado/domingo a 2-3 días ----------
  // Solo Lugares: son los que se reservan por fecha exclusiva y a los
  // que un finde vacío les duele. Se avisa una única vez por
  // (rancho, fecha) — avisos_finde_libre lleva el registro.
  const hoy = hoyISOCR();
  const candidatas = [sumarDiasISO(hoy, 2), sumarDiasISO(hoy, 3)].filter((f) => {
    const dow = new Date(f + "T00:00:00").getDay();
    return dow === 5 || dow === 6 || dow === 0; // vie, sáb, dom
  });

  let findesAvisados = 0;
  if (candidatas.length > 0) {
    const { data: lugares } = await admin
      .from("ranchos")
      .select("id, nombre, owner_id")
      .eq("categoria", "lugares")
      .eq("estado", "aprobado");

    const { data: ocupadas } = await admin
      .from("reservas")
      .select("rancho_id, fecha")
      .in("fecha", candidatas)
      .in("estado", ["pendiente", "confirmada"]);
    const ocupadaSet = new Set(
      (ocupadas ?? []).map((o) => `${o.rancho_id}:${o.fecha}`),
    );

    for (const lugar of (lugares ?? []) as {
      id: string;
      nombre: string;
      owner_id: string;
    }[]) {
      for (const fechaLibre of candidatas) {
        if (ocupadaSet.has(`${lugar.id}:${fechaLibre}`)) continue;

        // El insert es el reclamo: si ya se avisó de esta fecha, el
        // unique lo rechaza y no se repite el correo.
        const { error: yaAvisado } = await admin
          .from("avisos_finde_libre")
          .insert({ rancho_id: lugar.id, fecha: fechaLibre });
        if (yaAvisado) continue;

        const { data: perfil } = await admin
          .from("perfiles")
          .select("nombre, email")
          .eq("id", lugar.owner_id)
          .maybeSingle();
        if (!perfil?.email) continue;

        await enviarCorreo({
          to: perfil.email,
          subject: `${lugar.nombre}: este finde tenés una fecha libre`,
          html: plantillaFindeLibre({
            nombreProveedor: perfil.nombre || perfil.email,
            nombreRancho: lugar.nombre,
            fecha: fechaLibre,
          }),
        });
        findesAvisados++;
      }
    }
  }

  // ---------- 4. Recordatorio de cobro: eventos de HOY ----------
  // Mismo criterio que el bloque "Pendientes" del panel de cada negocio
  // (saldoPendiente() de src/lib/finanzas.ts) — el aviso y lo que ve el
  // dueño en su panel tienen que decir lo mismo. El reclamo va DENTRO
  // del update, como el de "pedir reseña": si el cron corre dos veces,
  // no se manda el aviso dos veces.
  const { data: paraCobro } = await admin
    .from("reservas")
    .update({ recordatorio_cobro_enviado: true })
    .eq("estado", "confirmada")
    .eq("fecha", hoy)
    .eq("evento_pagado", false)
    .eq("recordatorio_cobro_enviado", false)
    .select(
      "id, fecha, nombre, tipo_evento, invitados, monto_total, monto_cobrado_final, deposito_monto, deposito_validado, deposito_pagado_en, evento_pagado, saldo_pagado_en, rancho_id, ranchos(nombre, owner_id)",
    );

  type FilaCobro = ReservaFinanzas & {
    rancho_id: string;
    ranchos: { nombre: string; owner_id: string } | null;
  };

  let cobrosAvisados = 0;
  for (const r of (paraCobro ?? []) as unknown as FilaCobro[]) {
    // El saldo puede ya estar en 0 (el dueño lo marcó a mano temprano
    // en el día, antes de que corriera el cron) — ahí no hay nada que
    // avisar.
    const saldo = saldoPendiente(r);
    if (saldo <= 0 || !r.ranchos?.owner_id) continue;

    const nombreRancho = r.ranchos.nombre;
    // Dueño + colaboradores: el que está en el local el día del evento
    // es muchas veces el administrador, no el owner.
    const equipoCobro = await destinatariosDelNegocio(
      admin,
      r.rancho_id,
      r.ranchos.owner_id,
    );
    for (const persona of equipoCobro) {
      await enviarCorreo({
        to: persona.email,
        subject: `Hoy cobrás en ${nombreRancho}`,
        html: plantillaRecordatorioCobro({
          nombreProveedor: persona.nombre || persona.email,
          nombreRancho,
          ranchoId: r.rancho_id,
          nombreEvento: r.nombre,
          saldoPendiente: saldo,
        }),
      });
    }

    // A las FINANZAS de su negocio, que es donde se registra el cobro.
    //
    // El comentario que estaba acá decía «el teléfono no tiene una
    // pestaña finanzas propia» y por eso mandaba a "/?tab=reservas".
    // Era cierto lo de la pestaña y falso lo que se concluía: la app SÍ
    // tiene `/negocio/[id]/finanzas`. Y la pestaña a la que mandaba es
    // la del CLIENTE —filtra por `cliente_id = mi usuario`—, así que al
    // dueño le abría una lista vacía en vez de la plata que tiene que
    // cobrar hoy.
    await enviarPush({
      usuarios: equipoCobro.length
        ? equipoCobro.map((p) => p.id)
        : [r.ranchos.owner_id],
      titulo: `Hoy cobrás — ${nombreRancho}`,
      cuerpo: `Faltan ${fmtColones(saldo)} por cobrar${r.nombre ? ` de ${r.nombre}` : ""}.`,
      data: { url: r.rancho_id ? `/negocio/${r.rancho_id}/finanzas` : "/" },
    });
    cobrosAvisados++;
  }

  // ---------- 5. Aviso de agenda de citas (0094) ----------
  // Las citas de ayer que nadie marcó siguen 'confirmada' para
  // siempre y ensucian el CRM. El sistema AVISA y el dueño decide —
  // auto-marcar no_asistio castigaría al cliente sin derecho a réplica.
  let avisosAgendaEnviados = 0;
  {
    type FilaSinMarcar = {
      rancho_id: string;
      hora_inicio: string;
      nombre: string | null;
      tipo_evento: string | null;
      ranchos: { id: string; nombre: string; owner_id: string; vertical: string } | null;
    };
    const { data: sinMarcarData } = await admin
      .from("reservas")
      .select(
        "rancho_id, hora_inicio, nombre, tipo_evento, ranchos!inner(id, nombre, owner_id, vertical)",
      )
      .eq("estado", "confirmada")
      .eq("fecha", ayer)
      .not("hora_inicio", "is", null)
      .eq("ranchos.vertical", "citas")
      .order("hora_inicio", { ascending: true });

    const porRancho = new Map<
      string,
      { nombre: string; ownerId: string; sinMarcar: FilaSinMarcar[] }
    >();
    for (const r of (sinMarcarData ?? []) as unknown as FilaSinMarcar[]) {
      if (!r.ranchos) continue;
      const entrada = porRancho.get(r.rancho_id) ?? {
        nombre: r.ranchos.nombre,
        ownerId: r.ranchos.owner_id,
        sinMarcar: [],
      };
      entrada.sinMarcar.push(r);
      porRancho.set(r.rancho_id, entrada);
    }

    // Negocios donde AYER se marcó algún no-show: ahí puede haber un
    // cliente que acaba de acumular su segunda falta seguida.
    const { data: noShowsAyer } = await admin
      .from("reservas")
      .select("rancho_id, ranchos!inner(id, nombre, owner_id, vertical)")
      .eq("estado", "no_asistio")
      .gte("no_asistio_en", `${ayer}T00:00:00-06:00`)
      .not("hora_inicio", "is", null)
      .eq("ranchos.vertical", "citas");
    for (const r of (noShowsAyer ?? []) as unknown as FilaSinMarcar[]) {
      if (!r.ranchos || porRancho.has(r.rancho_id)) continue;
      porRancho.set(r.rancho_id, {
        nombre: r.ranchos.nombre,
        ownerId: r.ranchos.owner_id,
        sinMarcar: [],
      });
    }

    for (const [ranchoId, info] of porRancho) {
      // Reincidentes: la ficha se deriva de las reservas del negocio
      // con la misma lib del panel (una sola definición de "faltó a
      // sus últimas dos").
      const { data: historial } = await admin
        .from("reservas")
        .select(
          "id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total",
        )
        .eq("rancho_id", ranchoId)
        .gte("fecha", sumarDiasISO(hoy, -180))
        .not("hora_inicio", "is", null)
        // Lo más reciente primero: si el negocio tiene más de mil
        // citas en seis meses, la racha se calcula sobre las últimas.
        .order("fecha", { ascending: false })
        .limit(1000);
      const reincidentes = agruparClientes(historial ?? [], hoy)
        .filter(esReincidente)
        .map((c) => ({ nombre: c.nombre, fallosSeguidos: c.fallosSeguidos }));

      if (info.sinMarcar.length === 0 && reincidentes.length === 0) continue;

      // El insert es el reclamo: una fila por (negocio, día) — si ya
      // existe, hoy ya se avisó y no se repite.
      const { error: yaAvisado } = await admin
        .from("avisos_agenda")
        .insert({ rancho_id: ranchoId, fecha: hoy });
      if (yaAvisado) continue;

      // Dueño + colaboradores: la agenda la cierra quien la atiende.
      const equipoAgenda = await destinatariosDelNegocio(
        admin,
        ranchoId,
        info.ownerId,
      );
      for (const persona of equipoAgenda) {
        await enviarCorreo({
          to: persona.email,
          subject:
            info.sinMarcar.length > 0
              ? `${info.nombre}: tenés ${info.sinMarcar.length} cita${info.sinMarcar.length === 1 ? "" : "s"} de ayer sin marcar`
              : `${info.nombre}: tenés clientes por recuperar`,
          html: plantillaAvisoAgenda({
            nombreProveedor: persona.nombre || persona.email,
            nombreNegocio: info.nombre,
            ranchoId,
            sinMarcar: info.sinMarcar.map((c) => ({
              hora: horaBonita(String(c.hora_inicio).slice(0, 5)),
              nombre: c.nombre,
              servicio: c.tipo_evento,
            })),
            reincidentes,
          }),
        });
      }
      await enviarPush({
        usuarios: equipoAgenda.length
          ? equipoAgenda.map((p) => p.id)
          : [info.ownerId],
        titulo:
          info.sinMarcar.length > 0
            ? `${info.sinMarcar.length} cita${info.sinMarcar.length === 1 ? "" : "s"} de ayer sin marcar`
            : "Tenés clientes por recuperar",
        cuerpo:
          info.sinMarcar.length > 0
            ? "Marcá si vinieron o no — así tu asistencia y tus clientes quedan al día."
            : "Hay clientes que te fallaron dos veces seguidas. Mandales una promo desde tu panel.",
        // Dos avisos distintos, dos destinos distintos. Antes los dos
        // iban a "/?tab=reservas", la pestaña del cliente, donde el
        // dueño no puede marcar ni escribirle a nadie.
        //
        //  · Citas sin marcar → la agenda de AYER, que es el día que
        //    hay que cerrar. La de hoy no tiene nada que marcar.
        //  · Clientes por recuperar → su lista de clientes.
        data: {
          url:
            info.sinMarcar.length > 0
              ? `/negocio/${ranchoId}/agenda?fecha=${ayer}`
              : `/negocio/${ranchoId}/clientes`,
        },
      });
      avisosAgendaEnviados++;
    }
  }

  // 6. Refresco diario de las agendas externas conectadas (0072): lo
  // que el proveedor agregó en su Google/Apple Calendar entra solo,
  // sin que tenga que tocar "Sincronizar ahora". Tolerante: si la
  // tabla no existe o una agenda falla, el resto de avisos ya salió.
  let agendasSincronizadas = 0;
  {
    const { data: agendasData } = await admin
      .from("agendas_externas")
      .select("id")
      .limit(100);
    for (const a of (agendasData ?? []) as { id: string }[]) {
      try {
        const r = await sincronizarAgendaExterna(a.id);
        if (r.ok) agendasSincronizadas++;
      } catch {
        // El error queda anotado en la propia agenda (ultimo_error).
      }
    }
  }

  // 7. La prueba de 14 días del módulo de Lealtad que está por
  // terminarse: aviso al dueño ANTES del corte, nunca el día después.
  //
  // OJO CON LO QUE ESTE PASO **NO** HACE: no apaga nada. El corte lo
  // hace cumplir la base sola (`addons_negocio.vence_en` +
  // `tiene_addon()`), así que si esta corrida no sale, la prueba
  // termina igual el día que le toca — lo único que se pierde es la
  // cortesía de avisar. Por eso vive colgado del cron que ya existía y
  // no estrena uno propio: un cron más es una pieza más que se puede
  // caer en silencio, y no hacía falta ninguna.
  const { avisados: pruebasAvisadas } = await avisarPruebasPorVencer(admin);

  return NextResponse.json({
    fecha: manana,
    reservas: reservas.length,
    avisadas: enviados,
    resenasPedidas,
    findesAvisados,
    cobrosAvisados,
    avisosAgendaEnviados,
    agendasSincronizadas,
    pruebasAvisadas,
  });
}
