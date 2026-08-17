import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, plantillaDevengoDiario } from "@/lib/email";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import {
  agruparDevengo,
  esFuncionDevengoInexistente,
  evaluarDevengo,
  MIGRACION_DEVENGO,
  MOTIVO_LABEL,
  resolverTarifa,
  ventanaValida,
  VENTANA_BARRIDO_DIAS,
  type FilaDevengada,
  type ReservaDevengable,
} from "@/lib/cobro-dia-evento";

/**
 * EL COBRO DE PLATAFORMA DEL DÍA DEL EVENTO.
 *
 * Lo dispara GitHub Actions una vez al día
 * (.github/workflows/cobro-del-dia.yml), NO vercel.json. Dos razones:
 *
 *   1. `vercel.json` está en la lista de archivos que no se tocan sin
 *      confirmación del dueño, y el aviso de pases-en-pausa.yml es
 *      claro: en el plan Hobby, un cron de más ahí puede hacer que
 *      Vercel rechace el deploy ENTERO sin dejar rastro en la lista de
 *      deployments. No vale la pena arriesgar el despliegue por un
 *      disparador que GitHub hace igual de bien.
 *   2. Si mañana hay que correrlo dos veces al día, en GitHub Actions
 *      es cambiar una línea; en Hobby, directamente no se puede.
 *
 * A QUÉ HORA: 05:30 UTC = 11:30 p. m. de Costa Rica del día del
 * evento. Está puesto media hora DESPUÉS de /api/auto-cobro (05:00
 * UTC), a propósito: ese acredita el saldo del evento, y así, cuando
 * el negocio ya registró lo que cobró de verdad (`monto_cobrado_final`,
 * más invitados u horas extra), la comisión de porcentaje sale de la
 * plata real y no de la cotización vieja.
 *
 * QUÉ HACE, EN UNA LÍNEA: llama a `devengar_cobros_del_dia` (migración
 * 0171) y avisa por correo al equipo de Bookea lo que se anotó.
 *
 * IDEMPOTENCIA — no está acá, está en la base. Todo el barrido es una
 * sola sentencia `insert … on conflict do nothing` apoyada en el índice
 * único (reserva_id, concepto). Esta ruta no consulta "¿ya existe?"
 * antes de escribir, porque entre esa consulta y el insert hay una
 * ventana en la que dos corridas simultáneas cobran dos veces. Acá el
 * candado ES el insert. Consecuencia práctica: una segunda corrida
 * devuelve CERO filas, y como el correo se arma con las filas
 * devueltas, tampoco se avisa dos veces.
 *
 * MODO SIMULACIÓN (`?simular=1`): calcula lo mismo con el espejo en
 * TypeScript (src/lib/cobro-dia-evento.ts) y NO escribe ni manda nada.
 * Funciona aunque la 0171 todavía no se haya pegado — sirve para mirar
 * qué va a pasar antes de encender el automático.
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

  const url = new URL(request.url);
  const dias = ventanaValida(url.searchParams.get("dias") ?? VENTANA_BARRIDO_DIAS);
  const simular = url.searchParams.get("simular") === "1";
  const hoy = hoyISOCR();

  if (simular) {
    return NextResponse.json(await simularBarrido(admin, dias, hoy));
  }

  // ---------- El barrido de verdad ----------
  const { data, error } = await admin.rpc("devengar_cobros_del_dia", {
    p_dias_atras: dias,
  });

  if (error) {
    if (esFuncionDevengoInexistente(error)) {
      return NextResponse.json(
        {
          error:
            `Todavía no existe la función del barrido: pegá ${MIGRACION_DEVENGO} ` +
            "en el SQL Editor de Supabase.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filas = (data ?? []) as unknown as FilaDevengada[];
  const resumen = agruparDevengo(filas);

  // ---------- El aviso ----------
  // Va DESPUÉS de escribir, nunca antes: si el correo falla, la plata
  // ya quedó anotada. Al revés (avisar y después cobrar) se puede
  // avisar de un cobro que no ocurrió.
  let avisados = 0;
  if (resumen.reservas > 0) {
    const { data: admins } = await admin
      .from("perfiles")
      .select("nombre, email")
      .eq("rol", "admin")
      .not("email", "is", null);

    for (const p of (admins ?? []) as { nombre: string | null; email: string }[]) {
      const { enviado } = await enviarCorreo({
        to: p.email,
        subject: `Bookea devengó ₡${Math.round(resumen.total).toLocaleString("es-CR")} hoy`,
        html: plantillaDevengoDiario({
          nombreDestinatario: p.nombre || p.email,
          total: resumen.total,
          reservas: resumen.reservas,
          negocios: resumen.negocios.map((n) => ({
            negocio: n.negocio,
            reservas: n.reservas,
            total: n.total,
          })),
          fecha: hoy,
        }),
      });
      if (enviado) avisados++;
    }
  }

  return NextResponse.json({
    fecha: hoy,
    ventanaDias: dias,
    devengados: resumen.reservas,
    total: resumen.total,
    negocios: resumen.negocios.map((n) => ({
      negocio: n.negocio,
      reservas: n.reservas,
      total: n.total,
    })),
    semanas: resumen.semanas,
    avisados,
  });
}

// ------------------------------------------------------------
// El modo simulación
// ------------------------------------------------------------

type ClienteAdmin = NonNullable<ReturnType<typeof createAdminClient>>;

type FilaReserva = ReservaDevengable & {
  ranchos: { nombre: string | null; zona_horaria: string | null } | null;
};

/**
 * Lo que el barrido HARÍA si corriera ahora, sin escribir nada.
 *
 * No comparte código con el SQL —es un espejo, y eso está dicho arriba
 * de src/lib/cobro-dia-evento.ts—, así que si algún día los dos no
 * coinciden, esta pantalla es justamente la que lo destapa.
 */
async function simularBarrido(admin: ClienteAdmin, dias: number, hoy: string) {
  // El rango se pide con un día de colchón a cada lado porque "hoy"
  // depende de la zona de cada negocio: uno de Tijuana y uno de
  // Costa Rica no cambian de día en el mismo momento. El filtro fino
  // lo hace evaluarDevengo, con la zona de cada uno.
  const desde = sumarDiasISO(hoy, -(dias + 1));
  const hasta = sumarDiasISO(hoy, 1);

  const { data: reservasData, error } = await admin
    .from("reservas")
    .select(
      "id, fecha, estado, invitados, monto_total, monto_cobrado_final, rancho_id, nombre, " +
        "ranchos(nombre, zona_horaria)",
    )
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .not("rancho_id", "is", null)
    .limit(2000);

  if (error) return { error: error.message };

  const reservas = (reservasData ?? []) as unknown as FilaReserva[];
  if (reservas.length === 0) {
    return { simulacion: true, fecha: hoy, ventanaDias: dias, devengarian: 0, total: 0 };
  }

  // Cuáles ya tienen su asiento: en la corrida real esto lo resuelve
  // el índice único; acá hay que preguntarlo.
  const { data: yaData } = await admin
    .from("cobros_plataforma")
    .select("reserva_id")
    .eq("concepto", "reserva")
    .in(
      "reserva_id",
      reservas.map((r) => r.id),
    );
  const yaDevengadas = new Set(
    ((yaData ?? []) as { reserva_id: string | null }[])
      .map((c) => c.reserva_id)
      .filter((id): id is string => Boolean(id)),
  );

  const { data: tarifasData } = await admin
    .from("cobro_negocio")
    .select("rancho_id, modelo, valor");
  const tarifas = new Map<string, { modelo: string; valor: number }>(
    ((tarifasData ?? []) as { rancho_id: string; modelo: string; valor: number }[]).map(
      (t) => [t.rancho_id, { modelo: t.modelo, valor: Number(t.valor ?? 0) }],
    ),
  );

  const { data: cfg } = await admin
    .from("configuracion_plataforma")
    .select("comision_por_persona")
    .maybeSingle();
  const comisionGlobal = Number(
    (cfg as { comision_por_persona: number | null } | null)?.comision_por_persona ?? 0,
  );

  const ahora = new Date();
  const devengarian: {
    reserva: string;
    negocio: string;
    cliente: string | null;
    fecha: string;
    monto: number;
    modelo: string;
    semana: string;
  }[] = [];
  const descartes: Record<string, number> = {};

  for (const r of reservas) {
    const veredicto = evaluarDevengo(
      {
        ...r,
        zona_horaria: r.ranchos?.zona_horaria ?? null,
        yaDevengada: yaDevengadas.has(r.id),
      },
      resolverTarifa(r.rancho_id ?? "", tarifas, comisionGlobal),
      ahora,
      dias,
    );

    if (!veredicto.devenga) {
      const etiqueta = MOTIVO_LABEL[veredicto.motivo];
      descartes[etiqueta] = (descartes[etiqueta] ?? 0) + 1;
      continue;
    }

    devengarian.push({
      reserva: r.id,
      negocio: r.ranchos?.nombre ?? "Negocio dado de baja",
      cliente: r.nombre,
      fecha: r.fecha,
      monto: veredicto.monto,
      modelo: veredicto.modelo,
      semana: veredicto.semana,
    });
  }

  return {
    simulacion: true,
    fecha: hoy,
    ventanaDias: dias,
    revisadas: reservas.length,
    devengarian: devengarian.length,
    total: devengarian.reduce((s, d) => s + d.monto, 0),
    detalle: devengarian.sort((a, b) => b.monto - a.monto).slice(0, 200),
    descartes,
  };
}
