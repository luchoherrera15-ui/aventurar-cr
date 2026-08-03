"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RanchoItem } from "../types";

/**
 * CRUD del catálogo (menú/paquetes/productos) de un negocio. Las
 * políticas de la base ya limitan todo al dueño del rancho; acá se
 * validan los datos y se refresca la página.
 *
 * Desde 0050 un ítem es un paquete reservable de verdad: foto,
 * duración, sección, mínimos por pedido y cupo por día.
 */

type Resultado = { error?: string; item?: RanchoItem };

export type ItemInput = {
  nombre: string;
  descripcion: string;
  precio: number | null;
  unidad: string;
  tipo: "paquete" | "producto";
  grupo: string;
  duracionHoras: number | null;
  /** Duración en minutos — la vertical de Citas mide así sus servicios. */
  duracionMinutos: number | null;
  /** Minutos de limpieza/preparación después de la cita (0061). El
   *  motor de disponibilidad los respeta: la franja ocupa duración +
   *  buffer. null = 0. */
  bufferMin: number | null;
  fotoUrl: string | null;
  minPorReserva: number;
  maxPorReserva: number | null;
  capacidadDia: number | null;
  /** true = este paquete SUSTITUYE la tarifa por evento/paquete del
   *  cotizador al elegirlo (0067). */
  esPaqueteBase: boolean;
  activo: boolean;
};

function validar(datos: ItemInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 120) {
    return "El nombre es obligatorio (máximo 120 caracteres).";
  }
  if (datos.precio !== null && (!Number.isFinite(datos.precio) || datos.precio < 0)) {
    return "El precio no puede ser negativo.";
  }
  if (datos.grupo.trim().length > 40) {
    return "El nombre de la sección es muy largo (máximo 40 caracteres).";
  }
  if (
    datos.duracionHoras !== null &&
    (!Number.isFinite(datos.duracionHoras) ||
      datos.duracionHoras <= 0 ||
      datos.duracionHoras > 240)
  ) {
    return "La duración debe ser una cantidad de horas entre 0 y 240.";
  }
  // Mismo rango que el check de la base (rancho_items_duracion_minutos_check).
  if (
    datos.duracionMinutos !== null &&
    (!Number.isInteger(datos.duracionMinutos) ||
      datos.duracionMinutos < 5 ||
      datos.duracionMinutos > 480)
  ) {
    return "La duración debe ser una cantidad de minutos entre 5 y 480.";
  }
  // Mismo rango que el check de la base (buffer_min 0..240, 0061).
  if (
    datos.bufferMin !== null &&
    (!Number.isInteger(datos.bufferMin) || datos.bufferMin < 0 || datos.bufferMin > 240)
  ) {
    return "El tiempo de limpieza debe estar entre 0 y 240 minutos.";
  }
  if (!Number.isInteger(datos.minPorReserva) || datos.minPorReserva < 1) {
    return "El mínimo por reserva debe ser al menos 1.";
  }
  if (
    datos.maxPorReserva !== null &&
    (!Number.isInteger(datos.maxPorReserva) || datos.maxPorReserva < datos.minPorReserva)
  ) {
    return "El máximo por reserva no puede ser menor que el mínimo.";
  }
  if (
    datos.capacidadDia !== null &&
    (!Number.isInteger(datos.capacidadDia) || datos.capacidadDia < 1)
  ) {
    return "La cantidad por día debe ser al menos 1.";
  }
  return null;
}

function aFila(datos: ItemInput) {
  return {
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion.trim() || null,
    precio: datos.precio,
    unidad: datos.unidad.trim() || null,
    tipo: datos.tipo,
    grupo: datos.grupo.trim() || null,
    duracion_horas: datos.duracionHoras,
    duracion_minutos: datos.duracionMinutos,
    buffer_min: datos.bufferMin ?? 0,
    foto_url: datos.fotoUrl,
    min_por_reserva: datos.minPorReserva,
    max_por_reserva: datos.maxPorReserva,
    capacidad_dia: datos.capacidadDia,
    es_paquete_base: datos.esPaqueteBase,
    activo: datos.activo,
  };
}

/**
 * Si las migraciones 0061/0067 todavía no se corrieron, las columnas
 * buffer_min / es_paquete_base no existen y el insert/update entero
 * fallaría. Se detecta ese caso puntual y se reintenta sin ellas, para
 * que el catálogo siga siendo editable con la base vieja.
 */
function sinPaqueteBase(fila: ReturnType<typeof aFila>) {
  const copia = { ...fila } as Record<string, unknown>;
  delete copia.es_paquete_base;
  delete copia.buffer_min;
  return copia;
}

function faltaColumnaPaqueteBase(mensaje: string) {
  return mensaje.includes("es_paquete_base") || mensaje.includes("buffer_min");
}

export async function crearItemCatalogo(
  ranchoId: string,
  datos: ItemInput,
): Promise<Resultado> {
  const invalido = validar(datos);
  if (invalido) return { error: invalido };

  const supabase = await createClient();

  // El nuevo va al final: `orden` es lo que las flechas del panel
  // reacomodan después.
  const { data: ultimo } = await supabase
    .from("rancho_items")
    .select("orden")
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fila = aFila(datos);
  let { data, error } = await supabase
    .from("rancho_items")
    .insert({
      rancho_id: ranchoId,
      orden: (ultimo?.orden ?? 0) + 1,
      ...fila,
    })
    .select("*")
    .single();

  // Base sin la migración 0067: se guarda sin es_paquete_base.
  if (error && faltaColumnaPaqueteBase(error.message)) {
    ({ data, error } = await supabase
      .from("rancho_items")
      .insert({
        rancho_id: ranchoId,
        orden: (ultimo?.orden ?? 0) + 1,
        ...sinPaqueteBase(fila),
      })
      .select("*")
      .single());
  }

  if (error) {
    // El caso típico: las migraciones todavía no se corrieron.
    if (/rancho_items|column/.test(error.message)) {
      return {
        error:
          "Falta correr la última migración en Supabase (supabase/migrations).",
      };
    }
    return { error: "No se pudo guardar: " + error.message };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { item: data as RanchoItem };
}

export async function actualizarItemCatalogo(
  ranchoId: string,
  itemId: string,
  datos: ItemInput,
): Promise<Resultado> {
  const invalido = validar(datos);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const fila = aFila(datos);
  let { data, error } = await supabase
    .from("rancho_items")
    .update(fila)
    .eq("id", itemId)
    .eq("rancho_id", ranchoId)
    .select("*")
    .single();

  // Base sin la migración 0067: se guarda sin es_paquete_base.
  if (error && faltaColumnaPaqueteBase(error.message)) {
    ({ data, error } = await supabase
      .from("rancho_items")
      .update(sinPaqueteBase(fila))
      .eq("id", itemId)
      .eq("rancho_id", ranchoId)
      .select("*")
      .single());
  }

  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { item: data as RanchoItem };
}

/**
 * Config del "menú incluido con elección de N" por sección (jsonb
 * ranchos.detalles.elecciones_incluidas): "de la sección Postres,
 * elegí 1 sin costo". Con 0 (o vacío) la sección vuelve a cobrarse
 * normal. No necesita migración: es una llave más del jsonb.
 */
export async function guardarEleccionesIncluidas(
  ranchoId: string,
  elecciones: Record<string, number>,
): Promise<{ error?: string }> {
  const limpio: Record<string, number> = {};
  for (const [grupo, n] of Object.entries(elecciones)) {
    const nombre = grupo.trim().slice(0, 40);
    if (!nombre) continue;
    if (!Number.isInteger(n) || n < 1 || n > 20) continue;
    limpio[nombre] = n;
  }

  const supabase = await createClient();
  const { data: rancho, error: errorLectura } = await supabase
    .from("ranchos")
    .select("detalles")
    .eq("id", ranchoId)
    .maybeSingle();
  if (errorLectura || !rancho) {
    return { error: "No se pudo leer la configuración del negocio." };
  }

  const detalles = {
    ...((rancho.detalles as Record<string, unknown>) ?? {}),
    elecciones_incluidas: limpio,
  };

  const { error } = await supabase
    .from("ranchos")
    .update({ detalles })
    .eq("id", ranchoId);
  if (error) return { error: "No se pudo guardar: " + error.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}

/**
 * "Estación 1" → "Estación 2" en dos clics: copia el ítem con todos
 * sus datos, listo para cambiarle el nombre o el precio.
 */
export async function duplicarItemCatalogo(
  ranchoId: string,
  itemId: string,
): Promise<Resultado> {
  const supabase = await createClient();

  const { data: original } = await supabase
    .from("rancho_items")
    .select("*")
    .eq("id", itemId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  if (!original) return { error: "No encontramos ese ítem." };

  const { data: ultimo } = await supabase
    .from("rancho_items")
    .select("orden")
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const copia = { ...(original as RanchoItem) } as Record<string, unknown>;
  delete copia.id;
  delete copia.created_at;
  copia.nombre = `${original.nombre} (copia)`.slice(0, 120);
  copia.orden = (ultimo?.orden ?? 0) + 1;

  const { data, error } = await supabase
    .from("rancho_items")
    .insert(copia)
    .select("*")
    .single();

  if (error) return { error: "No se pudo duplicar: " + error.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { item: data as RanchoItem };
}

/** Guarda el orden completo tal como quedó en el panel (flechas ↑/↓). */
export async function reordenarCatalogo(
  ranchoId: string,
  idsEnOrden: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient();

  for (let i = 0; i < idsEnOrden.length; i++) {
    const { error } = await supabase
      .from("rancho_items")
      .update({ orden: i + 1 })
      .eq("id", idsEnOrden[i])
      .eq("rancho_id", ranchoId);
    if (error) return { error: "No se pudo reordenar: " + error.message };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}

export async function eliminarItemCatalogo(
  ranchoId: string,
  itemId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("rancho_items")
    .delete()
    .eq("id", itemId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}
