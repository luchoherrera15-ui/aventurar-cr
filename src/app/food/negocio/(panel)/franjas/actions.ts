"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { verificarAccesoNegocioFood } from "@/lib/food/auth";

/** Tope de filas que genera un envío recurrente — ver crearFranjasRecurrentes. */
const LIMITE_FRANJAS_RECURRENTES = 200;

export type EstadoFranja = { error: string | null; ok?: boolean; cantidad?: number };

function traducir(mensaje: string): string {
  if (mensaje.includes("food_franjas_unica")) {
    return "Ya existe una franja de este negocio en esa sede, fecha y hora.";
  }
  if (mensaje.includes("food_franjas_check") || /descuento_porcentaje/.test(mensaje)) {
    return "El descuento tiene que estar entre 0 % y 90 %.";
  }
  if (mensaje.includes("food_franjas_cupo_coherente")) {
    return "La capacidad no puede ser menor al cupo ya reservado.";
  }
  if (/violates foreign key constraint/.test(mensaje) && /food_reservations/.test(mensaje)) {
    return "Esa franja ya tiene reservas — apagala en vez de borrarla.";
  }
  return "No se pudo guardar. Revisá los datos e intentá de nuevo.";
}

export async function crearFranja(
  negocioId: string,
  _previo: EstadoFranja,
  formData: FormData,
): Promise<EstadoFranja> {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const locationId = String(formData.get("location_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const capacidad = Number(formData.get("capacidad") ?? 0);
  const descuento = Number(formData.get("descuento_porcentaje") ?? 0);

  if (!locationId || !fecha || !hora) return { error: "Completá sede, fecha y hora." };
  if (!Number.isInteger(capacidad) || capacidad < 1) return { error: "La capacidad tiene que ser al menos 1." };
  // El `min` del input ya lo evita en el navegador; esto es la defensa
  // real del servidor. Una franja de una fecha pasada nunca podría
  // reservarse (el RPC la rechaza) y quedaría en la lista sin que nada
  // explique por qué nadie la elige.
  if (fecha < hoyISOCR()) return { error: "No podés abrir una franja en una fecha que ya pasó." };

  const supabase = await createClient();
  const { error } = await supabase.from("food_franjas").insert({
    business_id: negocioId,
    location_id: locationId,
    fecha,
    hora,
    capacidad,
    descuento_porcentaje: descuento,
  });

  if (error) return { error: traducir(error.message) };

  revalidatePath("/food/negocio/franjas");
  return { error: null, ok: true };
}

/**
 * Abrir MUCHAS franjas de una sola vez: todas las combinaciones de
 * fecha (dentro de un rango, filtradas por día de semana) × hora
 * elegidas, con la misma capacidad y descuento para todas. Mismo
 * `.insert()` que `crearFranja` de arriba, solo que con un array de
 * filas — Supabase ya soporta insertar varias filas en un solo viaje,
 * así que no hace falta ningún RPC nuevo.
 *
 * Pensado para abrir mediodía y noche de martes a sábado durante varias
 * semanas de una sola vez, en vez de decenas de envíos manuales del
 * formulario simple.
 */
export async function crearFranjasRecurrentes(
  negocioId: string,
  _previo: EstadoFranja,
  formData: FormData,
): Promise<EstadoFranja> {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const locationId = String(formData.get("location_id") ?? "");
  const desde = String(formData.get("desde") ?? "");
  const hasta = String(formData.get("hasta") ?? "");
  const capacidad = Number(formData.get("capacidad") ?? 0);
  const descuento = Number(formData.get("descuento_porcentaje") ?? 0);
  // Días de la semana como en Date#getUTCDay(): 0 = domingo ... 6 = sábado.
  const dias = new Set(formData.getAll("dias").map((v) => Number(v)));
  const horas = [...new Set(formData.getAll("horas").map((v) => String(v)))];

  if (!locationId || !desde || !hasta) return { error: "Completá sede y el rango de fechas." };
  if (!Number.isInteger(capacidad) || capacidad < 1) return { error: "La capacidad tiene que ser al menos 1." };
  if (desde < hoyISOCR()) return { error: "La fecha 'desde' no puede ser anterior a hoy." };
  if (hasta < desde) return { error: "La fecha 'hasta' no puede ser anterior a la fecha 'desde'." };
  if (dias.size === 0) return { error: "Elegí al menos un día de la semana." };
  if (horas.length === 0) return { error: "Agregá al menos una hora." };

  // El tope de RANGO se revisa antes de generar nada: sin esto, un
  // "hasta" muy lejano (ej. error de tipeo en el año) recorre miles de
  // días solo para enterarse después de que ya se pasó del tope de
  // filas — mismo criterio de "fallar temprano" que el resto del
  // formulario.
  const [ya, ma, da] = desde.split("-").map(Number);
  const [yb, mb, db] = hasta.split("-").map(Number);
  const diasDeRango =
    Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000) + 1;
  if (diasDeRango > 366) return { error: "El rango de fechas no puede superar un año." };

  const filas: {
    business_id: string;
    location_id: string;
    fecha: string;
    hora: string;
    capacidad: number;
    descuento_porcentaje: number;
  }[] = [];

  // `sumarDiasISO`, no `new Date().toISOString()`: ese patrón exacto
  // corrió una fecha entera por el desfase UTC/Costa Rica esta misma
  // noche en otra parte de FOOD (ver src/lib/fechas.ts).
  let cursor = desde;
  for (let i = 0; i < diasDeRango; i++) {
    const [y, m, d] = cursor.split("-").map(Number);
    const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dias.has(diaSemana)) {
      for (const hora of horas) {
        filas.push({
          business_id: negocioId,
          location_id: locationId,
          fecha: cursor,
          hora,
          capacidad,
          descuento_porcentaje: descuento,
        });
      }
    }
    if (filas.length > LIMITE_FRANJAS_RECURRENTES) {
      return {
        error: `Eso generaría más de ${LIMITE_FRANJAS_RECURRENTES} franjas — acortá el rango de fechas, los días o las horas.`,
      };
    }
    cursor = sumarDiasISO(cursor, 1);
  }

  if (filas.length === 0) {
    return { error: "Ese rango y esos días no generan ninguna franja." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("food_franjas").insert(filas);

  if (error) return { error: traducir(error.message) };

  revalidatePath("/food/negocio/franjas");
  return { error: null, ok: true, cantidad: filas.length };
}

export async function alternarFranja(negocioId: string, franjaId: string, activa: boolean) {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("food_franjas")
    .update({ activa, updated_at: new Date().toISOString() })
    .eq("id", franjaId)
    .eq("business_id", negocioId);

  if (error) return { error: traducir(error.message) };

  revalidatePath("/food/negocio/franjas");
  return { error: null, ok: true };
}

export async function borrarFranja(negocioId: string, franjaId: string) {
  const { ok } = await verificarAccesoNegocioFood(negocioId);
  if (!ok) return { error: "No tenés permiso sobre este negocio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("food_franjas")
    .delete()
    .eq("id", franjaId)
    .eq("business_id", negocioId);

  if (error) return { error: traducir(error.message) };

  revalidatePath("/food/negocio/franjas");
  return { error: null, ok: true };
}
