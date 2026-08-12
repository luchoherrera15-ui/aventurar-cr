"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LugarServicio, ModalidadServicio, RanchoItem } from "../types";

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
  /** Forma de la capacidad del servicio (0117). null = individual. */
  modalidad: ModalidadServicio | null;
  /** Dónde se presta (0117). null = presencial. */
  lugarServicio: LugarServicio | null;
  /** Personas mínimas para que la sesión se realice (0117). */
  cupoMinSesion: number | null;
  /** Personas máximas en UNA sesión (0117). Declarativo: todavía no
   *  lo hace cumplir ningún motor. */
  cupoMaxSesion: number | null;
  /** Horas mínimas de anticipación (0118). Lo hace cumplir el RPC. */
  anticipacionMinHoras: number | null;
  /** Días máximos hacia adelante (0118). Lo hace cumplir el RPC. */
  anticipacionMaxDias: number | null;
  /** Adelanto de este servicio (0118). null = el del negocio. */
  depositoServicio: number | null;
  activo: boolean;
};

const MODALIDADES: readonly ModalidadServicio[] = ["individual", "grupal", "recurso"];
const LUGARES: readonly LugarServicio[] = ["presencial", "online", "hibrido"];

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
  // Mismos rangos que rancho_items_cupo_sesion_check (0117). El cupo de
  // la SESIÓN es cuánta gente atiende el servicio a la vez; no se
  // confunde con min/maxPorReserva, que son unidades de un pedido.
  for (const [valor, cual] of [
    [datos.cupoMinSesion, "mínimo"],
    [datos.cupoMaxSesion, "máximo"],
  ] as const) {
    if (valor !== null && (!Number.isInteger(valor) || valor < 1 || valor > 999)) {
      return `El ${cual} de personas por sesión debe estar entre 1 y 999.`;
    }
  }
  if (
    datos.cupoMinSesion !== null &&
    datos.cupoMaxSesion !== null &&
    datos.cupoMaxSesion < datos.cupoMinSesion
  ) {
    return "El máximo de personas por sesión no puede ser menor que el mínimo.";
  }
  // Los mismos valores que aceptan rancho_items_modalidad_check y
  // rancho_items_lugar_servicio_check (0117). La base los rechazaría
  // igual, pero acá el mensaje sale en español en vez de un error de
  // constraint — y una acción de servidor no debe confiar en que el
  // cliente mandó una de las opciones del select.
  if (datos.modalidad !== null && !MODALIDADES.includes(datos.modalidad)) {
    return "Esa modalidad no existe.";
  }
  if (datos.lugarServicio !== null && !LUGARES.includes(datos.lugarServicio)) {
    return "Ese lugar de atención no existe.";
  }
  // Mismos rangos que rancho_items_anticipacion_check (0118). Estos no
  // son cosméticos: el RPC rechaza la cita que los incumple.
  if (
    datos.anticipacionMinHoras !== null &&
    (!Number.isInteger(datos.anticipacionMinHoras) ||
      datos.anticipacionMinHoras < 0 ||
      datos.anticipacionMinHoras > 720)
  ) {
    return "La anticipación mínima debe estar entre 0 y 720 horas (30 días).";
  }
  if (
    datos.anticipacionMaxDias !== null &&
    (!Number.isInteger(datos.anticipacionMaxDias) ||
      datos.anticipacionMaxDias < 1 ||
      datos.anticipacionMaxDias > 365)
  ) {
    return "El máximo hacia adelante debe estar entre 1 y 365 días.";
  }
  // Mismo rango que ranchos_deposito_citas_check (0095).
  if (
    datos.depositoServicio !== null &&
    (!Number.isFinite(datos.depositoServicio) ||
      datos.depositoServicio < 0 ||
      datos.depositoServicio > 10000000)
  ) {
    return "El adelanto debe estar entre ₡0 y ₡10.000.000.";
  }
  return null;
}

function aFila(datos: ItemInput) {
  // El cupo por sesión solo tiene sentido en un servicio grupal. Si el
  // dueño vuelve a "individual" después de haber puesto 20, se guarda
  // null: así lo que hay en la base es siempre lo que el panel muestra,
  // y no queda un 20 escondido esperando a la ocurrencia de clase.
  const esGrupal = datos.modalidad === "grupal";
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
    modalidad: datos.modalidad,
    lugar_servicio: datos.lugarServicio,
    cupo_min_sesion: esGrupal ? datos.cupoMinSesion : null,
    cupo_max_sesion: esGrupal ? datos.cupoMaxSesion : null,
    anticipacion_min_horas: datos.anticipacionMinHoras,
    anticipacion_max_dias: datos.anticipacionMaxDias,
    deposito_servicio: datos.depositoServicio,
    activo: datos.activo,
  };
}

/**
 * Columnas que agregó una migración posterior a la 0035. Las
 * migraciones las pega el dueño a mano en el SQL Editor, así que el
 * código puede llegar a producción antes que el esquema: si alguna de
 * estas no existe todavía, el insert/update ENTERO fallaría y el
 * catálogo quedaría de piedra. Se detecta ese caso y se reintenta sin
 * ellas, para que lo viejo se siga pudiendo editar con la base vieja.
 */
/**
 * Van agrupadas POR MIGRACIÓN, no en una lista suelta. Postgres nombra
 * una sola columna desconocida por error, así que si se soltaran todas
 * de golpe una base con la 0061 y la 0067 pero sin la 0117 perdería en
 * silencio el buffer y el paquete base: se guardaría "bien" y el dueño
 * vería su configuración desaparecer sin ningún aviso.
 *
 * Soltando de a una migración, solo se pierde lo que esa base
 * realmente no puede guardar.
 */
const GRUPOS_OPCIONALES: readonly (readonly string[])[] = [
  ["buffer_min"], // 0061
  ["es_paquete_base"], // 0067
  ["modalidad", "lugar_servicio", "cupo_min_sesion", "cupo_max_sesion"], // 0117
  ["anticipacion_min_horas", "anticipacion_max_dias", "deposito_servicio"], // 0118
];

type Fila = Record<string, unknown>;
type Respuesta = { data: unknown; error: { message: string } | null };

/**
 * Ejecuta el guardado y, si la base no tiene alguna migración, vuelve a
 * intentar sin las columnas de ESA migración. Cada vuelta suelta un
 * grupo que todavía estaba en la fila, así que el ciclo siempre avanza
 * y termina.
 */
async function guardarTolerante(
  fila: Fila,
  intentar: (fila: Fila) => PromiseLike<Respuesta>,
): Promise<Respuesta> {
  const actual: Fila = { ...fila };

  for (let vuelta = 0; vuelta <= GRUPOS_OPCIONALES.length; vuelta++) {
    const res = await intentar(actual);
    if (!res.error) return res;

    const culpable = GRUPOS_OPCIONALES.find((grupo) =>
      grupo.some((c) => c in actual && res.error!.message.includes(c)),
    );
    if (!culpable) return res;
    for (const c of culpable) delete actual[c];
  }

  return intentar(actual);
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

  const { data, error } = await guardarTolerante(aFila(datos), (fila) =>
    supabase
      .from("rancho_items")
      .insert({
        rancho_id: ranchoId,
        orden: (ultimo?.orden ?? 0) + 1,
        ...fila,
      })
      .select("*")
      .single(),
  );

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
  const { data, error } = await guardarTolerante(aFila(datos), (fila) =>
    supabase
      .from("rancho_items")
      .update(fila)
      .eq("id", itemId)
      .eq("rancho_id", ranchoId)
      .select("*")
      .single(),
  );

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
