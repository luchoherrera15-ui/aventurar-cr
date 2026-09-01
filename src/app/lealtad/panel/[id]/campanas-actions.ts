"use server";

import { revalidatePath } from "next/cache";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadoCupoNotificaciones } from "@/lib/lealtad/cupo-notificaciones";
import { planDelNegocio } from "@/lib/lealtad/plan-del-negocio";
import type { EstadoLimite } from "@/lib/lealtad/planes";

/**
 * ════════════════════════════════════════════════════════════════════
 *  CAMPAÑAS AUTOMÁTICAS — marcar un día y que salga sola
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 sep 2026): «marcar días para hacer campañas
 * automáticas de notificaciones a los usuarios».
 *
 * Acá vive el CRUD de la regla. El envío no: eso lo hace el barrido
 * (`/api/lealtad/campanas`), que corre cada hora y usa exactamente el
 * mismo `enviarNotificacionPromocional` que el botón manual — con su
 * cupo y su reserva atómica. Dos caminos al mismo envío tienen que
 * pasar por la misma puerta o el tope del paquete deja de valer.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA PANTALLA TIENE QUE DECIR ANTES DE QUE SE ACTIVE
 * ------------------------------------------------------------------
 * Un día marcado son ~4,3 envíos al mes. Los topes son 1 / 25 /
 * ilimitado (ver `planes.ts`). O sea que Starter aguanta cinco días
 * por semana e Impulso no tiene techo — pero el paquete gratis se queda
 * sin cupo en la primera semana, y eso hay que decirlo antes.
 *
 * `resumenDeCampanas` devuelve esa cuenta hecha —cuántos envíos implica
 * lo que marcó contra cuántos le quedan— para que el panel lo diga
 * ANTES de prender el interruptor. Descubrirlo el tercer miércoles,
 * cuando la promo no salió y el local estaba lleno de gente esperando
 * el 2×1, es la peor forma de enterarse.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; motivo: string };

/** Cuántas veces cae un día de la semana en un mes, en promedio. */
const SEMANAS_POR_MES = 52 / 12;

export type Campana = {
  id: string;
  diaSemana: number;
  hora: number;
  etiqueta: string;
  mensaje: string;
  activa: boolean;
};

export type ResumenCampanas = {
  campanas: Campana[];
  /** Envíos al mes que implican las campañas ACTIVAS. */
  enviosEstimados: number;
  /** El cupo del paquete, ya contado contra lo usado este mes. */
  cupo: EstadoLimite;
  /** Lo que pasó en los últimos envíos, para explicar los saltos. */
  ultimos: { campanaId: string; dia: string; estado: string; detalle: string | null }[];
};

/**
 * Mismo portero que el resto de Marketing: mandarle un aviso a los
 * clientes es una acción del NEGOCIO, no una tarea de mostrador — un
 * colaborador con checklist no la tiene.
 */
async function accesoDeNegocio(ranchoId: string) {
  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.user) return { ok: false as const, motivo: "Iniciá sesión de nuevo.", userId: null };
  if (!acceso.esDueno && !acceso.esAdmin) {
    return { ok: false as const, motivo: "Esto lo maneja el dueño del negocio.", userId: null };
  }
  return { ok: true as const, motivo: "", userId: acceso.user.id };
}

/**
 * La tarjeta tiene que ser de ESTE negocio. `programaId` llega del
 * navegador y `programa_lealtad` es legible por `anon`: sin este
 * chequeo, un id ajeno dejaría programarle campañas a otro negocio.
 */
async function programaDelNegocio(
  db: ReturnType<typeof createAdminClient>,
  ranchoId: string,
  programaId: string,
): Promise<boolean> {
  if (!db) return false;
  const { data } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", programaId)
    .maybeSingle();
  return data?.rancho_id === ranchoId;
}

/** Las campañas de una tarjeta, con la cuenta de cupo ya hecha. */
export async function resumenDeCampanas(
  ranchoId: string,
  programaId: string,
): Promise<Resultado<ResumenCampanas>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };
  if (!(await programaDelNegocio(db, ranchoId, programaId))) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  const { data, error } = await db
    .from("campanas_lealtad")
    .select("id, dia_semana, hora, etiqueta, mensaje, activa")
    .eq("programa_id", programaId)
    .order("dia_semana");
  if (error) {
    // El mensaje dice CUÁL migración falta: «no se pudo cargar» manda a
    // adivinar, y esta pantalla es nueva.
    if (error.message.includes("campanas_lealtad")) {
      return { ok: false, motivo: "Falta correr la migración 0226 en Supabase." };
    }
    return { ok: false, motivo: "No se pudieron leer las campañas: " + error.message };
  }

  const campanas: Campana[] = (data ?? []).map((c) => ({
    id: c.id as string,
    diaSemana: c.dia_semana as number,
    hora: c.hora as number,
    etiqueta: c.etiqueta as string,
    mensaje: c.mensaje as string,
    activa: c.activa as boolean,
  }));

  const plan = await planDelNegocio(db, ranchoId);
  const cupo = await estadoCupoNotificaciones(db, ranchoId, plan);

  const { data: envios } = await db
    .from("campanas_lealtad_envios")
    .select("campana_id, dia, estado, detalle")
    .in("campana_id", campanas.length > 0 ? campanas.map((c) => c.id) : ["-"])
    .order("dia", { ascending: false })
    .limit(12);

  return {
    ok: true,
    datos: {
      campanas,
      enviosEstimados: Math.round(campanas.filter((c) => c.activa).length * SEMANAS_POR_MES),
      cupo,
      ultimos: (envios ?? []).map((e) => ({
        campanaId: e.campana_id as string,
        dia: e.dia as string,
        estado: e.estado as string,
        detalle: (e.detalle as string | null) ?? null,
      })),
    },
  };
}

/**
 * Crear o pisar la campaña de un día. Es un upsert por (programa, día)
 * a propósito: la grilla del panel es un calendario donde se toca un
 * día, y «tocar el miércoles» significa una sola cosa. Con un insert a
 * secas, tocar dos veces dejaría dos avisos el mismo miércoles.
 */
export async function guardarCampana(datos: {
  ranchoId: string;
  programaId: string;
  diaSemana: number;
  hora: number;
  etiqueta: string;
  mensaje: string;
}): Promise<Resultado<{ id: string }>> {
  const acceso = await accesoDeNegocio(datos.ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };
  if (!(await programaDelNegocio(db, datos.ranchoId, datos.programaId))) {
    return { ok: false, motivo: "Esa tarjeta no es de este negocio." };
  }

  // Los mismos rangos que el CHECK de la 0226: rebotar acá da un
  // mensaje en español en vez del error crudo de Postgres.
  if (!Number.isInteger(datos.diaSemana) || datos.diaSemana < 0 || datos.diaSemana > 6) {
    return { ok: false, motivo: "Ese día no existe." };
  }
  if (!Number.isInteger(datos.hora) || datos.hora < 0 || datos.hora > 23) {
    return { ok: false, motivo: "Esa hora no existe." };
  }
  const etiqueta = datos.etiqueta.trim().slice(0, 12);
  if (etiqueta.length === 0) {
    return { ok: false, motivo: "Ponele un nombre corto para el calendario (ej. «2×1»)." };
  }
  const mensaje = datos.mensaje.trim().slice(0, 180);
  if (mensaje.length < 3) {
    return { ok: false, motivo: "Escribí el aviso que le va a llegar a tus clientes." };
  }

  const { data, error } = await db
    .from("campanas_lealtad")
    .upsert(
      {
        rancho_id: datos.ranchoId,
        programa_id: datos.programaId,
        dia_semana: datos.diaSemana,
        hora: datos.hora,
        etiqueta,
        mensaje,
        activa: true,
        creado_por: acceso.userId,
      },
      { onConflict: "programa_id,dia_semana" },
    )
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("campanas_lealtad")) {
      return { ok: false, motivo: "Falta correr la migración 0226 en Supabase." };
    }
    return { ok: false, motivo: "No se pudo guardar: " + error.message };
  }

  revalidatePath(`/lealtad/panel/${datos.ranchoId}`);
  return { ok: true, datos: { id: data.id as string } };
}

/** Prender o apagar una campaña sin perder el texto que ya funcionaba. */
export async function alternarCampana(
  ranchoId: string,
  campanaId: string,
  activa: boolean,
): Promise<Resultado<null>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // El `eq("rancho_id")` es el que impide apagar la campaña de otro
  // negocio con un id adivinado: el chequeo va en el WHERE, no en un
  // `if` que después se puede olvidar.
  const { error } = await db
    .from("campanas_lealtad")
    .update({ activa })
    .eq("id", campanaId)
    .eq("rancho_id", ranchoId);
  if (error) return { ok: false, motivo: "No se pudo cambiar: " + error.message };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true, datos: null };
}

/** Borrar la campaña de un día. */
export async function borrarCampana(
  ranchoId: string,
  campanaId: string,
): Promise<Resultado<null>> {
  const acceso = await accesoDeNegocio(ranchoId);
  if (!acceso.ok) return { ok: false, motivo: acceso.motivo };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  const { error } = await db
    .from("campanas_lealtad")
    .delete()
    .eq("id", campanaId)
    .eq("rancho_id", ranchoId);
  if (error) return { ok: false, motivo: "No se pudo borrar: " + error.message };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true, datos: null };
}
