"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { avisarListaEspera } from "@/lib/lista-espera";
import { verificarAccesoOperativo } from "@/lib/auth";
import { otorgarPuntosPorCita } from "@/lib/lealtad/citas";
import { agruparClientes } from "@/lib/crm-citas";
import { utcDesdeZona } from "@/lib/agenda/zona";
import {
  guardarHorarioMiembroCore,
  guardarServiciosMiembroCore,
} from "@/lib/agenda/equipo";
import {
  agruparHorarioRecurso,
  diaDeSemana,
  rangosDelDia,
} from "@/lib/agenda/disponibilidad";
import { hoyISOCR } from "@/lib/fechas";
import { horarioDeDetalles, horaAMinutos, type HorarioSemana } from "@/app/citas/tipos";

/**
 * Acciones del panel de Citas: el equipo que atiende (equipo_rancho,
 * con su tipo y su horario propio), los servicios que da cada quien
 * (servicios_recurso), los bloqueos de agenda (bloqueos_agenda), la
 * cita manual con hora (walk-in), la asistencia y el horario semanal
 * del negocio (ranchos.detalles.horario_citas).
 *
 * Las políticas de la base ya limitan todo al dueño o a un admin; acá
 * se confirma la sesión y se validan los datos antes de tocar nada,
 * como en el resto del panel.
 */

/** Una persona (o recurso) del equipo tal como vive en equipo_rancho. */
export type MiembroEquipo = {
  id: string;
  rancho_id: string;
  nombre: string;
  rol: string | null;
  foto_url: string | null;
  activo: boolean;
  orden: number;
  /** profesional = persona; espacio/equipo = camilla, cabina, silla... */
  tipo: "profesional" | "espacio" | "equipo";
  /** Solo espacios con cupo compartido (mesas); null en personas. */
  capacidad: number | null;
  /**
   * Cuántas RESERVAS caben a la vez en el recurso (0109) — distinto de
   * `capacidad`, que son personas. Opcional porque el panel nunca lo
   * editó: ausente = 1, que es como se comportó siempre. Lo lee la
   * ocupación del día para no contar de menos una cabina compartida.
   */
  cupo_simultaneo?: number | null;
  created_at: string;
};

export type MiembroInput = {
  nombre: string;
  rol: string;
  fotoUrl: string | null;
  activo: boolean;
  tipo: "profesional" | "espacio" | "equipo";
  capacidad: number | null;
};

type Resultado = { error?: string; miembro?: MiembroEquipo };

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX = /^[0-9a-f-]{36}$/i;

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoOperativo(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  return { supabase, ok };
}

function validarMiembro(datos: MiembroInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 60) {
    return "El nombre es obligatorio (máximo 60 caracteres).";
  }
  if (datos.rol.trim().length > 60) {
    return "El rol es muy largo (máximo 60 caracteres).";
  }
  if (!["profesional", "espacio", "equipo"].includes(datos.tipo)) {
    return "El tipo no es válido.";
  }
  if (
    datos.capacidad !== null &&
    (!Number.isInteger(datos.capacidad) || datos.capacidad < 1 || datos.capacidad > 100)
  ) {
    return "La capacidad debe ser un número entre 1 y 100.";
  }
  return null;
}

function aFila(datos: MiembroInput) {
  return {
    nombre: datos.nombre.trim(),
    rol: datos.rol.trim() || null,
    foto_url: datos.fotoUrl,
    activo: datos.activo,
    tipo: datos.tipo,
    // La capacidad solo tiene sentido en espacios compartidos (mesas);
    // en personas y equipos individuales queda null.
    capacidad: datos.tipo === "espacio" ? datos.capacidad : null,
  };
}

/** El equipo y el horario también se ven en la página pública de citas. */
function refrescar(ranchoId: string) {
  revalidatePath(`/mi-negocio/${ranchoId}/citas`);
  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath("/citas", "layout");
}

export async function crearMiembroEquipo(
  ranchoId: string,
  datos: MiembroInput,
): Promise<Resultado> {
  const invalido = validarMiembro(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // La persona nueva va al final: `orden` es lo que las flechas ↑/↓
  // reacomodan después.
  const { data: ultimo } = await supabase
    .from("equipo_rancho")
    .select("orden")
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("equipo_rancho")
    .insert({
      rancho_id: ranchoId,
      orden: (ultimo?.orden ?? 0) + 1,
      ...aFila(datos),
    })
    .select("*")
    .single();

  if (error) {
    // El caso típico: la migración 0055 todavía no se corrió.
    if (/equipo_rancho|column/.test(error.message)) {
      return {
        error: "Falta correr la última migración en Supabase (supabase/migrations).",
      };
    }
    return { error: "No se pudo guardar: " + error.message };
  }

  refrescar(ranchoId);
  return { miembro: data as MiembroEquipo };
}

export async function actualizarMiembroEquipo(
  ranchoId: string,
  miembroId: string,
  datos: MiembroInput,
): Promise<Resultado> {
  const invalido = validarMiembro(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const { data, error } = await supabase
    .from("equipo_rancho")
    .update(aFila(datos))
    .eq("id", miembroId)
    .eq("rancho_id", ranchoId)
    .select("*")
    .single();

  if (error) return { error: "No se pudo guardar: " + error.message };

  refrescar(ranchoId);
  return { miembro: data as MiembroEquipo };
}

/** Guarda el orden completo tal como quedó en el panel (flechas ↑/↓). */
export async function reordenarEquipo(
  ranchoId: string,
  idsEnOrden: string[],
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  for (let i = 0; i < idsEnOrden.length; i++) {
    const { error } = await supabase
      .from("equipo_rancho")
      .update({ orden: i + 1 })
      .eq("id", idsEnOrden[i])
      .eq("rancho_id", ranchoId);
    if (error) return { error: "No se pudo reordenar: " + error.message };
  }

  refrescar(ranchoId);
  return {};
}

export async function eliminarMiembroEquipo(
  ranchoId: string,
  miembroId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // Sus citas quedan: reservas.miembro_id pasa a null (on delete set null).
  const { error } = await supabase
    .from("equipo_rancho")
    .delete()
    .eq("id", miembroId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  refrescar(ranchoId);
  return {};
}

// ------------------------------------------------------------
// Horario propio por miembro (horarios_recurso, 0061)
// ------------------------------------------------------------

/** Un rango laboral de un día concreto. Varios por día = turno partido. */
export type RangoHorarioMiembro = { dow: number; abre: string; cierra: string };

/**
 * Guarda el horario propio de una persona del equipo. La semántica es
 * la del motor (0081): los días CON filas sustituyen al horario del
 * negocio; `null` borra todo y la persona vuelve a heredar completo.
 * `diasLibres` marca los días en que la persona no trabaja — se
 * guardan con el rango centinela para que NO hereden el del negocio.
 */
export async function guardarHorarioMiembro(
  ranchoId: string,
  miembroId: string,
  rangos: RangoHorarioMiembro[] | null,
  diasLibres: number[] = [],
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // La lógica vive en el núcleo compartido con /api/citas/equipo (la
  // app móvil): una sola definición de la semántica del centinela.
  const res = await guardarHorarioMiembroCore(supabase, ranchoId, miembroId, rangos, diasLibres);
  if (res.error) return res;

  refrescar(ranchoId);
  return {};
}

// ------------------------------------------------------------
// Servicios por miembro (servicios_recurso, 0061)
// ------------------------------------------------------------

/**
 * Define qué servicios da una persona. La tabla funciona por servicio
 * ("este servicio lo dan estas personas"; sin filas = lo dan todas),
 * así que al desmarcar un servicio que hoy es "de todos" hay que
 * materializar la lista con el resto del equipo activo.
 */
export async function guardarServiciosMiembro(
  ranchoId: string,
  miembroId: string,
  itemIdsQueDa: string[],
): Promise<{ error?: string; advertencia?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // La lógica (incluida la materialización de "de todos" → lista) vive
  // en el núcleo compartido con /api/citas/equipo (la app móvil).
  const res = await guardarServiciosMiembroCore(supabase, ranchoId, miembroId, itemIdsQueDa);
  if (res.error) return res;

  refrescar(ranchoId);
  return res;
}

// ------------------------------------------------------------
// Bloqueos de agenda (bloqueos_agenda, 0061)
// ------------------------------------------------------------

/** Un bloqueo tal como vive en la tabla (timestamptz). */
export type BloqueoAgenda = {
  id: string;
  rancho_id: string;
  miembro_id: string | null;
  inicio: string;
  fin: string;
  motivo: string | null;
};

export type BloqueoInput = {
  /** null = bloquea el negocio entero. */
  miembroId: string | null;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string;
  horaFin: string;
  motivo: string;
};

/**
 * Bloquea una franja (almuerzo, vacaciones, cita externa). El dueño
 * piensa en hora de pared de su negocio; la tabla guarda instantes.
 */
export async function crearBloqueoAgenda(
  ranchoId: string,
  input: BloqueoInput,
): Promise<{ error?: string; bloqueo?: BloqueoAgenda }> {
  if (!FECHA_REGEX.test(input.fechaInicio) || !FECHA_REGEX.test(input.fechaFin)) {
    return { error: "Revisá las fechas." };
  }
  if (!HORA_REGEX.test(input.horaInicio) || !HORA_REGEX.test(input.horaFin)) {
    return { error: "Revisá las horas: alguna quedó incompleta." };
  }
  if (input.miembroId !== null && !UUID_REGEX.test(input.miembroId)) {
    return { error: "Miembro inválido." };
  }
  const motivo = input.motivo.trim().slice(0, 200);

  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("zona_horaria")
    .eq("id", ranchoId)
    .maybeSingle();
  const zona = rancho?.zona_horaria || "America/Costa_Rica";

  const inicio = utcDesdeZona(input.fechaInicio, input.horaInicio, zona);
  const fin = utcDesdeZona(input.fechaFin, input.horaFin, zona);
  if (fin.getTime() <= inicio.getTime()) {
    return { error: "El final del bloqueo tiene que ser después del inicio." };
  }
  // Un año como tope: un "bloqueo eterno" casi siempre es un error de
  // dedo, y para cerrar el negocio está el estado de la publicación.
  if (fin.getTime() - inicio.getTime() > 366 * 86400000) {
    return { error: "Un bloqueo no puede durar más de un año." };
  }

  if (input.miembroId) {
    const { data: miembro } = await supabase
      .from("equipo_rancho")
      .select("id")
      .eq("id", input.miembroId)
      .eq("rancho_id", ranchoId)
      .maybeSingle();
    if (!miembro) return { error: "Esa persona no está en tu equipo." };
  }

  const { data, error } = await supabase
    .from("bloqueos_agenda")
    .insert({
      rancho_id: ranchoId,
      miembro_id: input.miembroId,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      motivo: motivo || null,
    })
    .select("id, rancho_id, miembro_id, inicio, fin, motivo")
    .single();

  if (error) return { error: "No se pudo bloquear: " + error.message };

  refrescar(ranchoId);
  return { bloqueo: data as BloqueoAgenda };
}

export async function eliminarBloqueoAgenda(
  ranchoId: string,
  bloqueoId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("bloqueos_agenda")
    .delete()
    .eq("id", bloqueoId)
    .eq("rancho_id", ranchoId);
  if (error) return { error: "No se pudo quitar el bloqueo: " + error.message };

  refrescar(ranchoId);
  return {};
}

// ------------------------------------------------------------
// Cita manual con hora (walk-in) y reprogramación
// ------------------------------------------------------------

export type CitaManualInput = {
  fecha: string;
  hora: string;
  /** null = usar la duración del servicio (o 30). */
  duracionMinutos: number | null;
  /** null = sin persona asignada (estorba a todo el equipo). */
  miembroId: string | null;
  /** null = servicio libre (queda solo el texto en tipoEvento). */
  itemId: string | null;
  tipoEvento: string;
  nombre: string;
  telefono: string;
  correo: string;
  notas: string;
  /** null = usar el precio del catálogo (o sin monto). */
  monto: number | null;
};

/**
 * Los choques que el dueño está por pisar. No frenan (el dueño manda
 * sobre su agenda — igual que el importador 0077), pero se avisan y
 * hay que confirmar. El solape duro con la misma persona sí lo frena
 * la base (trigger 0055), con o sin aviso.
 */
async function detectarAdvertencias(
  supabase: Awaited<ReturnType<typeof verificarAccesoOperativo>>["supabase"],
  ranchoId: string,
  datos: {
    fecha: string;
    hora: string;
    duracionMin: number;
    /** Limpieza del servicio nuevo — la franja ocupa duración + esto. */
    bufferMin?: number;
    miembroId: string | null;
    ignorarReservaId?: string;
  },
): Promise<string[]> {
  const avisos: string[] = [];
  const ini = horaAMinutos(datos.hora);
  const fin = ini + datos.duracionMin;
  // El buffer cuenta para chocar con otras citas, no para el horario
  // ni los bloqueos (la limpieza puede pasar del cierre) — misma regla
  // que franja_chocada / el motor (0081).
  const finConBuffer = fin + (datos.bufferMin ?? 0);

  type CitaExistenteFila = {
    id: string;
    hora_inicio: string;
    duracion_minutos: number | null;
    miembro_id: string | null;
    nombre: string | null;
    reserva_items: { rancho_items: { buffer_min: number | null } | null }[] | null;
  };

  const [{ data: rancho }, { data: citas }, { data: bloqueos }, horariosMiembro] =
    await Promise.all([
      supabase
        .from("ranchos")
        .select("zona_horaria, detalles")
        .eq("id", ranchoId)
        .maybeSingle(),
      supabase
        .from("reservas")
        .select(
          "id, hora_inicio, duracion_minutos, miembro_id, nombre, reserva_items(rancho_items(buffer_min))",
        )
        .eq("rancho_id", ranchoId)
        .eq("fecha", datos.fecha)
        .in("estado", ["confirmada", "bloqueada"])
        .not("hora_inicio", "is", null),
      supabase
        .from("bloqueos_agenda")
        .select("miembro_id, inicio, fin, motivo")
        .eq("rancho_id", ranchoId)
        .lte("inicio", `${datos.fecha}T23:59:59+14:00`)
        .gte("fin", `${datos.fecha}T00:00:00-12:00`),
      datos.miembroId
        ? supabase
            .from("horarios_recurso")
            .select("dow, abre, cierra")
            .eq("miembro_id", datos.miembroId)
        : Promise.resolve({ data: null }),
    ]);

  const zona = rancho?.zona_horaria || "America/Costa_Rica";

  // 1. Choque con otra cita (misma regla que franja_chocada: sin
  //    persona choca con todo; la del sync sin persona estorba a
  //    todos; cada cita existente ocupa duración + SU buffer).
  for (const c of (citas ?? []) as unknown as CitaExistenteFila[]) {
    if (datos.ignorarReservaId && c.id === datos.ignorarReservaId) continue;
    const cBuffer = Math.max(
      0,
      ...(c.reserva_items ?? []).map((ri) => ri.rancho_items?.buffer_min ?? 0),
    );
    const cIni = horaAMinutos(String(c.hora_inicio).slice(0, 5));
    const cFin = cIni + (c.duracion_minutos ?? 30) + cBuffer;
    const mismaPersona =
      datos.miembroId === null || c.miembro_id === null || c.miembro_id === datos.miembroId;
    if (mismaPersona && ini < cFin && cIni < finConBuffer) {
      avisos.push(
        `Se monta sobre otra cita de ese día (${String(c.hora_inicio).slice(0, 5)}${c.nombre ? `, ${c.nombre}` : ""}).`,
      );
      break;
    }
  }

  // 2. Bloqueos de agenda (los del negocio entero y los de la persona).
  const inicioNueva = utcDesdeZona(datos.fecha, datos.hora, zona).getTime();
  const finNueva = inicioNueva + datos.duracionMin * 60000;
  for (const b of bloqueos ?? []) {
    if (b.miembro_id !== null && b.miembro_id !== datos.miembroId) continue;
    const bIni = new Date(b.inicio).getTime();
    const bFin = new Date(b.fin).getTime();
    if (inicioNueva < bFin && bIni < finNueva) {
      avisos.push(
        b.motivo
          ? `Cae dentro de un bloqueo de agenda ("${b.motivo}").`
          : "Cae dentro de un bloqueo de agenda.",
      );
      break;
    }
  }

  // 3. Fuera del horario laboral (de la persona, o del negocio).
  const horario = horarioDeDetalles(rancho?.detalles ?? null);
  const filasHorario = (horariosMiembro?.data ?? null) as
    | { dow: number; abre: string; cierra: string }[]
    | null;
  const recurso =
    datos.miembroId && filasHorario && filasHorario.length > 0
      ? {
          id: datos.miembroId,
          horario: agruparHorarioRecurso(
            filasHorario.map((h) => ({
              dow: h.dow,
              abre: String(h.abre).slice(0, 5),
              cierra: String(h.cierra).slice(0, 5),
            })),
          ),
        }
      : null;
  const dow = diaDeSemana(datos.fecha);
  const rangos = rangosDelDia(recurso, dow, horario);
  // Sin horario del negocio Y sin horario propio para ese día, el RPC
  // no restringe nada (compatibilidad 0055) — avisar acá sería un
  // falso positivo.
  const tienePropioEseDia = recurso?.horario?.[String(dow)] !== undefined;
  const sinRestriccion = horario === null && !tienePropioEseDia;
  const dentro = sinRestriccion || rangos.some((r) => ini >= r.inicio && fin <= r.fin);
  if (!dentro) {
    avisos.push("Queda fuera del horario laboral de ese día.");
  }

  return avisos;
}

/**
 * Carga una cita a mano, con hora — el walk-in y el "me escribió por
 * WhatsApp". A diferencia del RPC crear_cita (que es del cliente y
 * exige fecha futura), acá el dueño puede registrar la cita de hace
 * una hora. Si la franja pisa algo se devuelven advertencias y no se
 * crea; con `ignorarAvisos` se crea igual (la base solo frena el
 * solape duro con la misma persona).
 */
export async function crearCitaManual(
  ranchoId: string,
  input: CitaManualInput,
  opciones?: { ignorarAvisos?: boolean },
): Promise<{ error?: string; advertencias?: string[]; reservaId?: string }> {
  if (!FECHA_REGEX.test(input.fecha)) return { error: "Revisá la fecha." };
  if (!HORA_REGEX.test(input.hora)) return { error: "Revisá la hora." };
  if (
    input.duracionMinutos !== null &&
    (!Number.isInteger(input.duracionMinutos) ||
      input.duracionMinutos < 5 ||
      input.duracionMinutos > 480)
  ) {
    return { error: "La duración debe estar entre 5 y 480 minutos." };
  }
  if (input.miembroId !== null && !UUID_REGEX.test(input.miembroId)) {
    return { error: "Miembro inválido." };
  }
  if (input.itemId !== null && !UUID_REGEX.test(input.itemId)) {
    return { error: "Servicio inválido." };
  }
  if (
    input.monto !== null &&
    (!Number.isFinite(input.monto) || input.monto < 0 || input.monto > 100_000_000)
  ) {
    return { error: "Revisá el monto." };
  }
  const nombre = input.nombre.trim().slice(0, 120);
  if (!nombre) return { error: "El nombre del cliente es obligatorio." };
  const telefono = input.telefono.trim().slice(0, 40);
  const notas = input.notas.trim().slice(0, 500);
  // Mismo criterio de normalización que consentimientos (0083): sin
  // espacios NI comas/puntos y coma — un correo con coma rompería los
  // filtros y los envíos aguas abajo.
  const correo = input.correo.trim().toLowerCase();
  if (correo && (correo.indexOf("@") < 1 || /[\s,;]/.test(correo))) {
    return { error: "El correo no se ve válido." };
  }

  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // El servicio del catálogo pone sus defaults (duración y precio) —
  // el texto libre queda para lo que no está en el catálogo.
  let tipoEvento = input.tipoEvento.trim().slice(0, 120) || "Cita";
  let duracion = input.duracionMinutos;
  let monto = input.monto;
  let bufferMin = 0;
  if (input.itemId) {
    const { data: item } = await supabase
      .from("rancho_items")
      .select("id, nombre, precio, duracion_minutos, buffer_min")
      .eq("id", input.itemId)
      .eq("rancho_id", ranchoId)
      .maybeSingle();
    if (!item) return { error: "Ese servicio no está en tu catálogo." };
    tipoEvento = item.nombre;
    if (duracion === null) duracion = item.duracion_minutos ?? null;
    if (monto === null && item.precio !== null) monto = Number(item.precio);
    bufferMin = (item.buffer_min as number | null) ?? 0;
  }
  const duracionMin = duracion ?? 30;

  if (input.miembroId) {
    const { data: miembro } = await supabase
      .from("equipo_rancho")
      .select("id")
      .eq("id", input.miembroId)
      .eq("rancho_id", ranchoId)
      .maybeSingle();
    if (!miembro) return { error: "Esa persona no está en tu equipo." };
  }

  if (!opciones?.ignorarAvisos) {
    const advertencias = await detectarAdvertencias(supabase, ranchoId, {
      fecha: input.fecha,
      hora: input.hora,
      duracionMin,
      bufferMin,
      miembroId: input.miembroId,
    });
    if (advertencias.length > 0) return { advertencias };
  }

  // Mismo camino que la reserva manual de eventos: la política de
  // insert solo permite pendiente/temporal, así que nace pendiente y
  // el dueño la confirma con un update (su política de update).
  const { data: creada, error: errorInsert } = await supabase
    .from("reservas")
    .insert({
      rancho_id: ranchoId,
      fecha: input.fecha,
      hora_inicio: input.hora,
      duracion_minutos: duracionMin,
      miembro_id: input.miembroId,
      nombre,
      contacto: telefono || null,
      whatsapp: telefono || null,
      correo: correo || null,
      tipo_evento: tipoEvento,
      notas: notas || null,
      monto_total: monto,
      deposito_monto: 0,
      estado: "pendiente",
      origen: "manual",
    })
    .select("id")
    .single();
  if (errorInsert || !creada) {
    return { error: "No se pudo crear la cita: " + (errorInsert?.message ?? "error") };
  }

  const { error: errorConfirmar } = await supabase
    .from("reservas")
    .update({ estado: "confirmada" })
    .eq("id", creada.id)
    .eq("rancho_id", ranchoId);

  if (errorConfirmar) {
    // El trigger anti-solape (0055) la rechazó. Borrarla no se puede
    // (la RLS de DELETE en reservas es solo del admin), así que el
    // borrador pendiente se cancela para que no quede una cita
    // fantasma esperando en la agenda.
    await supabase
      .from("reservas")
      .update({ estado: "cancelada", cancelada_en: new Date().toISOString() })
      .eq("id", creada.id)
      .eq("rancho_id", ranchoId);
    if (errorConfirmar.code === "23505" || /ocupad|ya hay/i.test(errorConfirmar.message)) {
      return {
        error:
          "Esa persona ya tiene una cita confirmada que se monta con esta franja — ni con advertencia se puede duplicar.",
      };
    }
    return { error: "No se pudo confirmar la cita: " + errorConfirmar.message };
  }

  refrescar(ranchoId);
  return { reservaId: creada.id as string };
}

/**
 * Reprograma una cita: fecha, hora y/o persona. La base (trigger 0055)
 * frena el solape duro; el resto de choques se avisan igual que en la
 * cita manual.
 */
export async function moverCita(
  ranchoId: string,
  reservaId: string,
  destino: { fecha: string; hora: string; miembroId: string | null },
  opciones?: { ignorarAvisos?: boolean },
): Promise<{ error?: string; advertencias?: string[] }> {
  if (!FECHA_REGEX.test(destino.fecha)) return { error: "Revisá la fecha." };
  if (!HORA_REGEX.test(destino.hora)) return { error: "Revisá la hora." };
  if (destino.miembroId !== null && !UUID_REGEX.test(destino.miembroId)) {
    return { error: "Miembro inválido." };
  }

  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const { data: cita } = await supabase
    .from("reservas")
    .select(
      "id, estado, fecha, duracion_minutos, correo, nombre, reserva_items(rancho_items(buffer_min))",
    )
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!cita) return { error: "No encontramos esa cita." };
  if (cita.estado !== "confirmada" && cita.estado !== "pendiente") {
    return { error: "Solo se pueden reprogramar citas pendientes o confirmadas." };
  }
  const bufferCita = Math.max(
    0,
    ...((cita.reserva_items ?? []) as unknown as {
      rancho_items: { buffer_min: number | null } | null;
    }[]).map((ri) => ri.rancho_items?.buffer_min ?? 0),
  );

  if (destino.miembroId) {
    const { data: miembro } = await supabase
      .from("equipo_rancho")
      .select("id")
      .eq("id", destino.miembroId)
      .eq("rancho_id", ranchoId)
      .maybeSingle();
    if (!miembro) return { error: "Esa persona no está en tu equipo." };
  }

  if (!opciones?.ignorarAvisos) {
    const advertencias = await detectarAdvertencias(supabase, ranchoId, {
      fecha: destino.fecha,
      hora: destino.hora,
      duracionMin: cita.duracion_minutos ?? 30,
      bufferMin: bufferCita,
      miembroId: destino.miembroId,
      ignorarReservaId: reservaId,
    });
    if (advertencias.length > 0) return { advertencias };
  }

  const { error } = await supabase
    .from("reservas")
    .update({
      fecha: destino.fecha,
      hora_inicio: destino.hora,
      miembro_id: destino.miembroId,
      // La cita movida vuelve a merecer su recordatorio: si ya se
      // avisó para la fecha vieja, el cron tiene que avisar de nuevo
      // para la nueva.
      recordatorio_enviado: false,
      recordatorio_cobro_enviado: false,
    })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) {
    if (error.code === "23505" || /ocupad|ya hay/i.test(error.message)) {
      return {
        error:
          "Esa persona ya tiene una cita confirmada que se monta con esa franja — ni con advertencia se puede duplicar.",
      };
    }
    return { error: "No se pudo reprogramar: " + error.message };
  }

  // Si una cita CONFIRMADA cambió de día, el día viejo quedó con una
  // franja libre: se les avisa a los de la lista de espera (0095).
  // Una pendiente no ocupaba espacio — mover una no libera nada.
  const fechaVieja = cita.fecha as string;
  if (cita.estado === "confirmada" && fechaVieja !== destino.fecha) {
    after(() => avisarListaEspera(ranchoId, fechaVieja));
  }

  refrescar(ranchoId);
  return {};
}

/**
 * Cancela una cita (estado final 'cancelada' — el de la vertical de
 * citas, distinto del 'rechazada' de eventos). Libera la franja al
 * instante: la vista de disponibilidad solo cuenta confirmadas y
 * bloqueadas.
 */
export async function cancelarCita(
  ranchoId: string,
  reservaId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // El estado ANTES de cancelar decide si hay franja liberada: una
  // cita pendiente nunca ocupó espacio en la vista de disponibilidad,
  // así que cancelarla no le libera nada a la lista de espera.
  const { data: previa } = await supabase
    .from("reservas")
    .select("id, estado, fecha")
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("reservas")
    .update({ estado: "cancelada", cancelada_en: new Date().toISOString() })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    .in("estado", ["pendiente", "confirmada"])
    .select("id, fecha")
    .maybeSingle();

  if (error) return { error: "No se pudo cancelar: " + error.message };
  if (!data) return { error: "Esa cita ya no se puede cancelar." };

  // La franja quedó libre: se les avisa a los de la lista de espera de
  // ese día (0095) — después de responder, sin frenar la cancelación.
  if (previa?.estado === "confirmada") {
    const fechaLiberada = data.fecha as string;
    after(() => avisarListaEspera(ranchoId, fechaLiberada));
  }

  refrescar(ranchoId);
  return {};
}

// ------------------------------------------------------------
// Asistencia
// ------------------------------------------------------------

/** El aviso de re-enganche que dispara marcar un no-show. */
export type ClienteReincidente = {
  nombre: string | null;
  correo: string | null;
  fallosSeguidos: number;
};

/**
 * Marca la asistencia de una cita: cumplida o no asistió. Solo desde
 * una cita confirmada (o corrigiendo entre esos dos estados) — nunca
 * revive una cancelada ni toca una temporal.
 *
 * Si queda cumplida, el cliente gana los puntos del programa de
 * lealtad del negocio — desacoplado: si la lealtad falla o no existe,
 * la cita queda cumplida igual.
 *
 * Si queda como no-show y con esta el cliente acumula dos (o más)
 * seguidos, se devuelve `reincidente` para que el panel ofrezca
 * mandarle una promoción de re-enganche ahí mismo.
 */
export async function marcarAsistenciaCita(
  ranchoId: string,
  reservaId: string,
  asistencia: "cumplida" | "no_asistio",
): Promise<{ error?: string; puntosOtorgados?: number; reincidente?: ClienteReincidente }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from("reservas")
    .update(
      asistencia === "cumplida"
        ? { estado: "cumplida", cumplida_en: ahora, no_asistio_en: null }
        : { estado: "no_asistio", no_asistio_en: ahora, cumplida_en: null },
    )
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    .in("estado", ["confirmada", "cumplida", "no_asistio"])
    .select("id, nombre, correo, whatsapp, cliente_id")
    .maybeSingle();

  if (error) return { error: "No se pudo actualizar la cita: " + error.message };
  if (!data) {
    return { error: "Esa cita no se puede marcar (¿está cancelada o todavía pendiente?)." };
  }

  let puntosOtorgados: number | undefined;
  let reincidente: ClienteReincidente | undefined;

  if (asistencia === "cumplida") {
    const puntos = await otorgarPuntosPorCita(reservaId);
    if (puntos.otorgado) puntosOtorgados = puntos.puntos;
  } else {
    // ¿Con esta ya son dos no-shows seguidos? Se agrupan las citas
    // recientes del negocio con la MISMA lib del CRM y se busca la
    // ficha que contiene esta cita. Nada del usuario entra a un filtro
    // de PostgREST (correo/teléfono son texto libre — interpolarlos en
    // un .or() permitiría romper la consulta a propósito). Si el
    // cálculo falla, la cita queda marcada igual.
    try {
      const { data: historial } = await supabase
        .from("reservas")
        .select("id, fecha, hora_inicio, estado, nombre, correo, whatsapp, cliente_id, monto_total")
        .eq("rancho_id", ranchoId)
        .not("hora_inicio", "is", null)
        .order("fecha", { ascending: false })
        .limit(500);
      const cliente = agruparClientes(historial ?? [], hoyISOCR()).find((c) =>
        c.citaIds.includes(reservaId),
      );
      if (cliente && cliente.fallosSeguidos >= 2) {
        reincidente = {
          nombre: cliente.nombre,
          correo: cliente.correo,
          fallosSeguidos: cliente.fallosSeguidos,
        };
      }
    } catch {
      // El aviso de reincidencia es un plus: nunca tumba la marcación.
    }
  }

  refrescar(ranchoId);
  return { puntosOtorgados, reincidente };
}

// ------------------------------------------------------------
// Horario semanal del negocio
// ------------------------------------------------------------

/**
 * Guarda el horario semanal en ranchos.detalles.horario_citas.
 *
 * `detalles` guarda más cosas (los campos propios del servicio), así
 * que se lee lo actual y se mezcla — nunca se pisa otra llave.
 */
export async function guardarHorarioCitas(
  ranchoId: string,
  horario: HorarioSemana,
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // Se reconstruye limpio: solo los días 0 (domingo) a 6 (sábado),
  // cada uno abierto con horas válidas o null (cerrado).
  const limpio: HorarioSemana = {};
  for (let dow = 0; dow < 7; dow++) {
    const dia = horario[String(dow)];
    if (!dia) {
      limpio[String(dow)] = null;
      continue;
    }
    if (!HORA_REGEX.test(dia.abre) || !HORA_REGEX.test(dia.cierra)) {
      return { error: "Revisá las horas: alguna quedó incompleta." };
    }
    if (dia.abre >= dia.cierra) {
      return { error: "La hora de cierre tiene que ser después de la de apertura." };
    }
    limpio[String(dow)] = { abre: dia.abre, cierra: dia.cierra };
  }

  const { data: actual, error: errorLectura } = await supabase
    .from("ranchos")
    .select("detalles")
    .eq("id", ranchoId)
    .maybeSingle();
  if (errorLectura) {
    return { error: "No se pudo leer la configuración: " + errorLectura.message };
  }

  const detalles =
    actual?.detalles && typeof actual.detalles === "object" && !Array.isArray(actual.detalles)
      ? (actual.detalles as Record<string, unknown>)
      : {};

  const { error } = await supabase
    .from("ranchos")
    .update({ detalles: { ...detalles, horario_citas: limpio } })
    .eq("id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  refrescar(ranchoId);
  return {};
}
