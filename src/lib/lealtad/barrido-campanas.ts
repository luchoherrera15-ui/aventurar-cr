import { createAdminClient } from "@/lib/supabase/admin";
import { fechaISOCR } from "@/lib/fechas";
import { enviarMensajePromocional } from "@/lib/wallet/mensaje-promocional";
import { planDelNegocio } from "@/lib/lealtad/plan-del-negocio";
import {
  liberarCupoNotificacion,
  reservarCupoNotificacion,
} from "@/lib/lealtad/cupo-notificaciones";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL BARRIDO QUE MANDA LAS CAMPAÑAS AUTOMÁTICAS (0226)
 * ════════════════════════════════════════════════════════════════════
 *
 * Corre cada hora. Mira qué campañas activas caen HOY a ESTA hora de
 * Costa Rica y le manda el aviso a los pases de esa tarjeta.
 *
 * ------------------------------------------------------------------
 * EL ENVÍO DOBLE SE EVITA EN LA BASE, NO ACÁ
 * ------------------------------------------------------------------
 * `campanas_lealtad_envios` tiene PK (campana_id, dia). Este barrido
 * INSERTA PRIMERO y solo manda si el insert entró. Si el cron se
 * dispara dos veces —GitHub Actions reintenta, alguien lo corre a mano,
 * dos instancias a la vez— el segundo choca contra la PK y se va sin
 * hacer nada.
 *
 * Un `if (yaSeMandó)` leído antes de mandar NO alcanza: entre la
 * lectura y la escritura está el envío entero, que son segundos reales
 * hablando con Apple y con Google. Es la misma lección que ya dejó
 * `reservarCupoNotificacion` con el cupo (ver su cabecera).
 *
 * ------------------------------------------------------------------
 * EL CUPO ES EL DEL PAQUETE, SIN EXCEPCIONES
 * ------------------------------------------------------------------
 * Se reserva con la MISMA función que el botón manual (topes en
 * `planes.ts`: 1 / 10 / 50 / ilimitado). Una campaña
 * automática no es un permiso para saltarse el tope: cuando no hay
 * cupo, el envío se anota como `sin_cupo` y el panel lo muestra. Que se
 * salte en silencio sería peor que no tener la función — el negocio
 * cree que su promo salió.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO REVIENTA SI UNA CAMPAÑA FALLA
 * ------------------------------------------------------------------
 * Cada campaña se procesa en su propio try. Un negocio con los
 * certificados de Apple vencidos no puede dejar sin promo a los otros
 * veinte que salen a la misma hora.
 */

/** Lo que devuelve una corrida, para el log del cron. */
export type ResultadoBarrido = {
  hora: number;
  dia: string;
  candidatas: number;
  enviadas: number;
  sinCupo: number;
  errores: number;
  nota?: string;
};

/**
 * La hora de Costa Rica ahora mismo (0–23).
 *
 * CR no tiene horario de verano, así que UTC−6 es constante y la cuenta
 * es exacta todo el año. Se hace con `Intl` igual que el resto del repo
 * y no restando 6 a mano: una resta a mano cerca de medianoche cambia
 * el DÍA sin que nadie lo note, y este barrido usa los dos.
 */
function horaCR(ahora: Date = new Date()): number {
  const txt = new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    hour12: false,
  }).format(ahora);
  return Number.parseInt(txt, 10);
}

/**
 * 0 = domingo … 6 = sábado, en hora de Costa Rica.
 *
 * Sale de `fechaISOCR(ahora)` y NO de `hoyISOCR()`: tienen que mirar el
 * mismo instante que `horaCR`. Con `hoyISOCR()` el día se calculaba
 * siempre contra el reloj real aunque se pasara otra fecha, así que en
 * una prueba la hora seguía al parámetro y el día no — y cerca de
 * medianoche eso significa buscar las campañas del día equivocado.
 *
 * El mediodía en el Date construido es a propósito: con `T00:00:00Z`,
 * `getUTCDay()` está a un redondeo de caer en el día anterior.
 */
function diaSemanaCR(ahora: Date = new Date()): number {
  return new Date(`${fechaISOCR(ahora)}T12:00:00Z`).getUTCDay();
}

export async function barrerCampanas(ahora: Date = new Date()): Promise<ResultadoBarrido> {
  const hora = horaCR(ahora);
  const dia = fechaISOCR(ahora);
  const diaSemana = diaSemanaCR(ahora);
  const vacio: ResultadoBarrido = {
    hora,
    dia,
    candidatas: 0,
    enviadas: 0,
    sinCupo: 0,
    errores: 0,
  };

  const db = createAdminClient();
  if (!db) return { ...vacio, nota: "Sin llave de servicio: no se pudo leer nada." };

  const { data, error } = await db
    .from("campanas_lealtad")
    .select("id, rancho_id, programa_id, mensaje, etiqueta")
    .eq("dia_semana", diaSemana)
    .eq("hora", hora)
    .eq("activa", true);

  if (error) {
    // Sin la migración corrida, esto responde 200 con la nota en vez de
    // reventar cada hora: un cron que falla en loop por una tabla que
    // falta se vuelve ruido que nadie mira.
    return { ...vacio, nota: "No se pudieron leer las campañas: " + error.message };
  }

  const campanas = data ?? [];
  const res: ResultadoBarrido = { ...vacio, candidatas: campanas.length };

  for (const c of campanas) {
    const campanaId = c.id as string;
    const ranchoId = c.rancho_id as string;
    const programaId = c.programa_id as string;

    try {
      // ── EL CANDADO ─────────────────────────────────────────────
      // Se anota el intento ANTES de mandar. Si otra corrida ya lo
      // anotó, este insert choca contra la PK y esta campaña se salta.
      const { error: eCandado } = await db
        .from("campanas_lealtad_envios")
        .insert({ campana_id: campanaId, dia, estado: "enviado" });
      if (eCandado) {
        // 23505 = unique_violation: ya se mandó hoy. No es un error.
        if (eCandado.code !== "23505") {
          res.errores++;
          console.error("[campanas] No se pudo anotar el envío:", eCandado.message);
        }
        continue;
      }

      // ── EL CUPO, EL MISMO QUE EL BOTÓN MANUAL ──────────────────
      const plan = await planDelNegocio(db, ranchoId);
      const reserva = await reservarCupoNotificacion(db, ranchoId, programaId, plan);
      if (!reserva.reservado) {
        await db
          .from("campanas_lealtad_envios")
          .update({
            estado: "sin_cupo",
            detalle: `Sin cupo este mes (tope ${reserva.limite ?? 0}).`,
          })
          .eq("campana_id", campanaId)
          .eq("dia", dia);
        res.sinCupo++;
        continue;
      }

      const envio = await enviarMensajePromocional(programaId, c.mensaje as string);
      if (!envio.ok) {
        // El aviso no llegó a ningún lado: se libera la reserva para no
        // cobrarle cupo a un mensaje que nunca salió. Mismo criterio que
        // `enviarNotificacionPromocional`.
        await liberarCupoNotificacion(db, reserva.id);
        await db
          .from("campanas_lealtad_envios")
          .update({ estado: "error", detalle: envio.motivo.slice(0, 300) })
          .eq("campana_id", campanaId)
          .eq("dia", dia);
        res.errores++;
        continue;
      }

      await db
        .from("campanas_lealtad_envios")
        .update({
          detalle: `Apple: ${envio.apple?.avisados ?? 0} · Google: ${envio.googleEnviados}`,
        })
        .eq("campana_id", campanaId)
        .eq("dia", dia);
      res.enviadas++;
    } catch (e) {
      // Una campaña rota no puede dejar sin promo a las demás.
      res.errores++;
      console.error("[campanas] Falló la campaña", campanaId, e);
    }
  }

  return res;
}
