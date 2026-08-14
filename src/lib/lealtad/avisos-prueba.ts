import type { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo } from "@/lib/email";
import { fechaISOCR, fechaLargaCR, hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import {
  asuntoPruebaPorVencer,
  plantillaPruebaPorVencer,
} from "@/lib/correo/prueba-lealtad";
import { DIAS_AVISO_PREVIO, estadoDePrueba } from "./prueba";

/**
 * EL AVISO PREVIO DE LA PRUEBA — el único pedazo que necesita correr.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO NO ES UN CRON NUEVO
 * ------------------------------------------------------------------
 * El VENCIMIENTO no vive acá: vive en `addons_negocio.vence_en`, que
 * `tiene_addon()` compara contra `now()` en cada consulta. O sea que la
 * prueba se termina sola aunque esta función no corra nunca. Lo que
 * esta función hace es SOLO la cortesía de avisar antes.
 *
 * Y por eso se cuelga del cron que ya existe —`/api/recordatorios`,
 * una vez al día— en vez de estrenar uno propio. Un cron más es una
 * pieza más que se puede caer en silencio; enganchar el aviso a la
 * corrida diaria que ya está monitoreada no agrega ninguna. La peor
 * consecuencia de que este paso falle es un correo que no salió: el
 * negocio se entera igual al entrar al panel, y nadie opera gratis un
 * día de más.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO HACE FALTA UNA BANDERA DE «YA SE AVISÓ»
 * ------------------------------------------------------------------
 * Porque la ventana es UN día de calendario: se buscan los cortes que
 * caen exactamente el día `hoy + DIAS_AVISO_PREVIO` (en hora de Costa
 * Rica). El `vence_en` de un negocio cae en un solo día, así que una
 * corrida diaria lo toca una sola vez. No hace falta ninguna columna
 * nueva — y no tenerla es la razón por la que este cambio no pide una
 * migración.
 *
 * ------------------------------------------------------------------
 * SE LEE EL ESTADO VIVO, NO UNA PROMESA VIEJA
 * ------------------------------------------------------------------
 * Un negocio que ya eligió paquete deja de tener plan `prueba` y su
 * complemento pasa a `vence_en: null`, así que sale solo de la
 * consulta. Ese es el motivo de fondo por el que el aviso se decide el
 * día de mandarlo y no se agenda por adelantado al crear la cuenta:
 * agendado, le llegaría «tu prueba se termina» a alguien que ya pagó.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type ResumenAvisosPrueba = {
  /** Cuántos correos salieron. */
  avisados: number;
  /** Cuántos se saltaron (sin correo, suprimido, ya no está en prueba). */
  omitidos: number;
};

/** El comienzo del día `fecha` en hora de Costa Rica, como timestamptz. */
function inicioDelDiaCR(fecha: string): string {
  // CR es UTC-6 todo el año (no hay horario de verano), así que el
  // desfase se puede escribir fijo sin riesgo de que un mes del año
  // corra la ventana una hora.
  return `${fecha}T00:00:00-06:00`;
}

/**
 * Avisa a los negocios cuya prueba se termina en `DIAS_AVISO_PREVIO`.
 *
 * Nunca lanza: es un paso de cortesía dentro de un cron que hace otras
 * cinco cosas, y ninguna de ellas puede caerse porque un correo falle.
 */
export async function avisarPruebasPorVencer(
  db: Admin,
  opciones: { hoy?: string } = {},
): Promise<ResumenAvisosPrueba> {
  const resumen: ResumenAvisosPrueba = { avisados: 0, omitidos: 0 };

  try {
    const hoy = opciones.hoy ?? hoyISOCR();
    const objetivo = sumarDiasISO(hoy, DIAS_AVISO_PREVIO);

    const { data, error } = await db
      .from("addons_negocio")
      .select("rancho_id, vence_en")
      .eq("addon", "lealtad")
      .eq("activo", true)
      .gte("vence_en", inicioDelDiaCR(objetivo))
      .lt("vence_en", inicioDelDiaCR(sumarDiasISO(objetivo, 1)));

    if (error) {
      console.warn("[prueba] No se pudieron leer los complementos:", error.message);
      return resumen;
    }

    const filas = (data ?? []) as { rancho_id: string; vence_en: string }[];

    for (const fila of filas) {
      // El negocio: el nombre para el correo y el plan para confirmar
      // que sigue siendo una prueba. `select *` porque `plan_lealtad`
      // es de la 0124 y una lista explícita reventaría entera en una
      // base sin migrar.
      const { data: rancho } = await db
        .from("ranchos")
        .select("*")
        .eq("id", fila.rancho_id)
        .maybeSingle();
      if (!rancho) {
        resumen.omitidos++;
        continue;
      }

      const plan = (rancho.plan_lealtad as string | null) ?? null;
      const estado = estadoDePrueba({ plan, venceEn: fila.vence_en });
      // Ya no está en prueba (eligió paquete entre medio) o la fecha no
      // es de una prueba: no hay nada que avisar.
      if (!estado.esPrueba || estado.vencida) {
        resumen.omitidos++;
        continue;
      }

      const { data: perfil } = await db
        .from("perfiles")
        .select("email")
        .eq("id", rancho.owner_id as string)
        .maybeSingle();
      const correo = ((perfil?.email as string | null) ?? "").trim().toLowerCase();
      if (!correo.includes("@")) {
        resumen.omitidos++;
        continue;
      }

      // Rebotes duros y quejas de spam (0082): a ese buzón no se le
      // escribe más, ni siquiera algo transaccional — insistirle quema
      // la reputación del dominio para todos los demás negocios.
      const { data: supresion } = await db
        .from("supresiones_correo")
        .select("correo")
        .eq("correo", correo)
        .maybeSingle();
      if (supresion) {
        resumen.omitidos++;
        continue;
      }

      const datos = {
        nombreNegocio: ((rancho.nombre as string | null) ?? "tu negocio").trim(),
        ranchoId: fila.rancho_id,
        diasRestantes: estado.diasRestantes ?? 0,
        hasta: fechaLargaCR(fechaISOCR(new Date(fila.vence_en))),
      };

      const { enviado } = await enviarCorreo({
        to: correo,
        subject: asuntoPruebaPorVencer(datos),
        html: plantillaPruebaPorVencer(datos),
      });
      if (enviado) resumen.avisados++;
      else resumen.omitidos++;
    }
  } catch (e) {
    console.error("[prueba] El aviso de vencimiento falló:", e);
  }

  return resumen;
}
