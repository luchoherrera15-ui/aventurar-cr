import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarAAdministradores } from "@/lib/correo/administradores";
import { evaluarAnomalias, mediana } from "@/lib/lealtad/api/alertas";

/**
 * EL BARRIDO DIARIO DE LA API DE LEALTAD.
 *
 * Hace tres cosas, y las tres tienen que existir en la entrega 1:
 *
 * 1. CONSOLIDA el día anterior en el agregado permanente y PURGA el
 *    detalle de más de 90 días. Guardar para siempre `ruta + miembro +
 *    timestamp` de cada llamada sería construir exactamente el perfil
 *    conductual que el resto del diseño evita.
 * 2. BUSCA ANOMALÍAS: IP nunca vista, volumen contra la mediana de 30
 *    días, y tarjetas distintas tocadas en un día.
 * 3. CORTA SOLA lo que pasa de 10× — y avisa. Una alerta que llega a un
 *    correo que nadie lee no contiene nada.
 *
 * ------------------------------------------------------------
 * EL CORTE AUTOMÁTICO ES EL MISMO BOTÓN DE PÁNICO
 * ------------------------------------------------------------
 * Este cron suspendía la AUTORIZACIÓN con un `update` a mano y nada
 * más. Cortaba la llamada siguiente, sí — pero no aguantaba, y una
 * suspensión que no aguanta es peor que no tener suspensión, porque
 * alguien cree que cortó:
 *
 *   · `desarrolladores.estado` quedaba en 'aprobado', así que el
 *     integrador seguía apareciendo en `desarrolladores_admitidos` y
 *     cualquier dueño —incluido el mismo, al que el vendedor le dice
 *     «se cayó la conexión, dele Autorizar otra vez»— lo volvía a
 *     conectar en un clic, con llave nueva.
 *   · Y la llave nueva estrena `kid`, o sea que estrena historial: con
 *     `medianaPrevia = 0` queda debajo del piso de ruido y
 *     `evaluarAnomalias` NO vuelve a marcarla. Rotar la llave reseteaba
 *     el detector.
 *   · El `update` tampoco miraba su propio error, así que el correo
 *     podía anunciar «quedaron SUSPENDIDAS» sin que se hubiera escrito
 *     nada.
 *
 * El corte manual de Bookea sí aguanta, y aguanta porque además deja
 * `desarrolladores.estado = 'suspendido'`, que es lo que mira
 * `api_lealtad_autenticar` (0178:417). Así que los dos caminos pasan
 * ahora por EL MISMO punto de corte: `api_lealtad_panico` (0178:307),
 * en una sola transacción, apagando las llaves, suspendiendo las
 * autorizaciones y marcando al desarrollador.
 *
 * Es deliberadamente amplio: el disparo son 10× la mediana de 30 días
 * (o 10× las tarjetas distintas), que es exactamente la forma de un
 * `.env` filtrado o de un barrido, y un `.env` filtrado no respeta las
 * fronteras entre negocios. El acuerdo que el desarrollador firmó lo
 * dice con todas las letras (acuerdo.ts, 3.f): se somete a la
 * suspensión inmediata si Bookea detecta un patrón anómalo, «sin
 * perjuicio de reclamar después». Reinstalarlo es una decisión de
 * Bookea, no un botón que el vendedor le dicta al dueño por teléfono.
 *
 * El disparador es GitHub Actions y no `vercel.json`, igual que
 * `/api/lealtad/pases-en-pausa`: Vercel Hobby solo permite crons
 * diarios y rechaza el deploy entero si aparece uno más frecuente.
 *
 * Responde 200 aunque no haya podido hacer nada (sin migraciones, sin
 * llave de servicio): el motivo viaja en `nota`. Un cron que devuelve
 * error todos los días por una variable que falta se vuelve ruido que
 * nadie mira.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cuántos días de detalle se conservan. El agregado es permanente. */
const RETENCION_DIAS = 90;

type FilaDia = {
  dia: string;
  kid: string;
  estado_http: number;
  llamadas: number;
  miembros_distintos: number;
};

export async function GET(request: Request) {
  const noAutorizado = autorizarCron(request);
  if (noAutorizado) return noAutorizado;

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ ok: true, nota: "Sin llave de servicio: no se hizo nada." });
  }

  // El día de AYER en hora de Costa Rica: el de hoy todavía se está
  // escribiendo y consolidarlo daría un agregado que cambia solo.
  const hoyCR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
  const ayer = new Date(`${hoyCR}T00:00:00-06:00`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  const dia = ayer.toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });

  const { error: errorConsolidar } = await db.rpc("api_lealtad_consolidar_dia", {
    p_dia: dia,
    p_retencion_dias: RETENCION_DIAS,
  });
  if (errorConsolidar) {
    return NextResponse.json({
      ok: true,
      nota: "Faltan las migraciones 0177/0178: " + errorConsolidar.message,
    });
  }

  // ── Anomalías, llave por llave ────────────────────────────────
  const { data: agregado } = await db
    .from("bitacora_api_lealtad_dia")
    .select("dia, kid, estado_http, llamadas, miembros_distintos")
    .gte("dia", restarDias(dia, 31))
    .lte("dia", dia)
    .limit(20000);

  const porKid = new Map<string, FilaDia[]>();
  for (const f of ((agregado ?? []) as FilaDia[])) {
    const lista = porKid.get(f.kid) ?? [];
    lista.push(f);
    porKid.set(f.kid, lista);
  }

  const avisos: string[] = [];
  /** Los cortes que NO se pudieron hacer. Se dicen, no se esconden. */
  const noCortadas: string[] = [];
  let suspendidas = 0;

  for (const [kid, filas] of porKid) {
    const deAyer = filas.filter((f) => f.dia === dia);
    if (deAyer.length === 0) continue;
    const previas = filas.filter((f) => f.dia !== dia);

    const llamadasHoy = deAyer.reduce((s, f) => s + f.llamadas, 0);
    // El agregado guarda «tarjetas distintas» por (ruta × estado), así
    // que el máximo de esas filas es la mejor cota inferior que hay sin
    // volver al detalle. Alcanza para la señal: lo que se busca es un
    // salto de orden de magnitud, no un número exacto.
    const miembrosHoy = Math.max(0, ...deAyer.map((f) => f.miembros_distintos));
    const bloqueos429 = deAyer
      .filter((f) => f.estado_http === 429)
      .reduce((s, f) => s + f.llamadas, 0);

    const porDiaPrevio = new Map<string, number>();
    const miembrosPrevios = new Map<string, number>();
    for (const f of previas) {
      porDiaPrevio.set(f.dia, (porDiaPrevio.get(f.dia) ?? 0) + f.llamadas);
      miembrosPrevios.set(f.dia, Math.max(miembrosPrevios.get(f.dia) ?? 0, f.miembros_distintos));
    }

    const ipsNuevas = await contarIpsNuevas(db, kid, dia);

    const veredicto = evaluarAnomalias({
      llamadasHoy,
      medianaPrevia: mediana([...porDiaPrevio.values()]),
      ipsNuevas,
      miembrosHoy,
      medianaMiembros: mediana([...miembrosPrevios.values()]),
      bloqueos429: Math.max(0, bloqueos429),
    });

    if (veredicto.nivel === "ninguna") continue;
    avisos.push(`${kid}: ${veredicto.motivos.join(" ")}`);

    if (veredicto.nivel === "suspender") {
      const corte = await cortarPorAnomalia(db, kid, veredicto.motivos);
      if (corte.ok) suspendidas += 1;
      else noCortadas.push(`${kid}: NO SE PUDO CORTAR — ${corte.motivo}`);
    }
  }

  if (avisos.length > 0) {
    await avisarAAdministradores({
      subject: `API de Lealtad — ${avisos.length} anomalía(s) el ${dia}`,
      html:
        `<h2 style="margin:0 0 12px">Anomalías en la API de Lealtad (${dia})</h2>` +
        (suspendidas > 0
          ? `<p style="margin:0 0 12px;padding:10px 12px;background:#fee;border-left:3px solid #c00;font-size:13px">
               <b>${suspendidas} desarrollador(es) quedaron SUSPENDIDOS automáticamente.</b>
             </p>`
          : "") +
        // LO QUE NO SE PUDO CORTAR VA PRIMERO Y EN ROJO. Un correo que
        // solo cuenta lo que sí funcionó es cómo alguien se queda
        // creyendo que el acceso está cerrado cuando sigue abierto.
        (noCortadas.length > 0
          ? `<p style="margin:0 0 12px;padding:10px 12px;background:#fee;border-left:3px solid #c00;font-size:13px">
               <b>ATENCIÓN: ${noCortadas.length} corte(s) NO se pudieron hacer.</b> Esas llaves
               SIGUEN ABIERTAS y hay que apagarlas a mano.
             </p>
             <ul style="font-size:13px;color:#900">${noCortadas
               .map((a) => `<li>${a.replaceAll("<", "&lt;")}</li>`)
               .join("")}</ul>`
          : "") +
        `<ul style="font-size:13px">${avisos
          .map((a) => `<li>${a.replaceAll("<", "&lt;")}</li>`)
          .join("")}</ul>` +
        `<p style="margin:16px 0 0;font-size:12px">Las llaves se apagan desde
         <a href="https://www.bookea.lat/admin/developers">/admin/developers</a>.</p>`,
    });
  }

  return NextResponse.json({
    ok: true,
    dia,
    llaves_revisadas: porKid.size,
    anomalias: avisos.length,
    suspendidas,
    no_cortadas: noCortadas.length,
  });
}

/**
 * EL CORTE AUTOMÁTICO, POR EL MISMO PUNTO QUE EL BOTÓN DE PÁNICO.
 *
 * Recibe un `kid` (lo único que el agregado diario guarda) y tiene que
 * llegar hasta el DESARROLLADOR, porque cortar menos que eso no aguanta
 * — ver el comentario largo del encabezado. El camino es
 * `llaves_api_lealtad.kid → autorizacion_id → desarrollador_id`, y a
 * partir de ahí manda `api_lealtad_panico` (0178:307), que en UNA
 * transacción revoca todas las llaves del developer en TODOS los
 * negocios, suspende sus autorizaciones y lo marca `suspendido`.
 *
 * Devuelve el motivo del fallo en vez de tragárselo: el correo dice
 * «quedaron SUSPENDIDAS» y esa frase tiene que ser verdad. Un corte que
 * no se pudo hacer se anuncia como no hecho.
 */
async function cortarPorAnomalia(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  kid: string,
  motivos: string[],
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: llave, error: errorLlave } = await db
    .from("llaves_api_lealtad")
    .select("autorizacion_id")
    .eq("kid", kid)
    .maybeSingle();
  if (errorLlave) return { ok: false, motivo: errorLlave.message };
  if (!llave?.autorizacion_id) return { ok: false, motivo: "No se encontró la llave del kid." };

  const { data: autorizacion, error: errorAut } = await db
    .from("autorizaciones_api")
    .select("desarrollador_id")
    .eq("id", llave.autorizacion_id as string)
    .maybeSingle();
  if (errorAut) return { ok: false, motivo: errorAut.message };
  if (!autorizacion?.desarrollador_id) {
    return { ok: false, motivo: "La llave no cuelga de ninguna autorización." };
  }

  const { error } = await db.rpc("api_lealtad_panico", {
    p_desarrollador_id: autorizacion.desarrollador_id as string,
    // El motivo queda escrito en `motivo_revocacion` de cada llave: el
    // día que el integrador reclame, la razón está ahí y no en un log.
    p_motivo: `Corte automático (${kid}): ${motivos.join(" ")}`.slice(0, 300),
  });
  if (error) return { ok: false, motivo: error.message };

  return { ok: true };
}

/**
 * Huellas de IP que aparecieron ayer y NUNCA antes para esta llave.
 *
 * Se cuenta sobre el detalle de 90 días —el único lugar donde vive el
 * `ip_hmac`— y nunca sobre una IP en claro, que no existe en ninguna
 * tabla de este sistema.
 */
async function contarIpsNuevas(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  kid: string,
  dia: string,
): Promise<number> {
  const desde = `${dia}T00:00:00-06:00`;
  const hasta = `${sumarDias(dia, 1)}T00:00:00-06:00`;

  const [{ data: ayer }, { data: antes }] = await Promise.all([
    db
      .from("bitacora_api_lealtad")
      .select("ip_hmac")
      .eq("kid", kid)
      .gte("created_at", desde)
      .lt("created_at", hasta)
      .limit(5000),
    db
      .from("bitacora_api_lealtad")
      .select("ip_hmac")
      .eq("kid", kid)
      .lt("created_at", desde)
      .limit(5000),
  ]);

  const conocidas = new Set(
    ((antes ?? []) as { ip_hmac: string | null }[]).map((f) => f.ip_hmac).filter(Boolean),
  );
  // Si no hay historial previo, no hay «IP nueva» que reportar: sería
  // avisar el primer día de todas las llaves del mundo.
  if (conocidas.size === 0) return 0;

  const nuevas = new Set(
    ((ayer ?? []) as { ip_hmac: string | null }[])
      .map((f) => f.ip_hmac)
      .filter((ip): ip is string => Boolean(ip) && !conocidas.has(ip)),
  );
  return nuevas.size;
}

function restarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
