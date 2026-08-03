"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import {
  aFilaReserva,
  detectarChoques,
  normalizarFila,
  validarFila,
  type ConfigNegocio,
  type FilaAgenda,
  type FilaCruda,
  type VerticalAgenda,
} from "@/lib/agenda/importar-agenda";

/**
 * "Traé tu agenda" — las acciones del panel del dueño.
 *
 * El importador tiene dos caminos y la línea entre ellos es de cobro:
 *
 *   MANUAL (gratis)  — el dueño llena la tabla, o pega columnas de
 *                      Excel que se parten con código, sin IA.
 *   CON IA (add-on)  — Claude lee las fotos de la agenda. Requiere
 *                      `addons_negocio.agenda_ia` activo, y eso solo
 *                      lo enciende el servidor (ver 0077).
 *
 * `guardarLoteAgenda` es común a los dos: la IA nunca escribe en la
 * base — propone filas, el dueño las revisa, y el guardado es el
 * mismo camino gratuito de siempre.
 */

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  if (!ok) return { supabase, negocio: null as ConfigNegocio | null };

  const { data } = await supabase
    .from("ranchos")
    .select("id, vertical, categoria, capacidad_min, capacidad_max, eventos_por_dia")
    .eq("id", ranchoId)
    .maybeSingle();

  if (!data) return { supabase, negocio: null };

  const negocio: ConfigNegocio = {
    id: data.id as string,
    vertical: ((data.vertical as string) || "eventos") as VerticalAgenda,
    categoria: (data.categoria as string) ?? null,
    capacidadMin: (data.capacidad_min as number) ?? null,
    capacidadMax: (data.capacidad_max as number) ?? null,
    eventosPorDia: (data.eventos_por_dia as number) ?? null,
  };
  return { supabase, negocio };
}

// ------------------------------------------------------------------
// El add-on
// ------------------------------------------------------------------

/**
 * ¿Puede este negocio usar la lectura con IA?
 *
 * Se consulta con la llave de servicio a propósito: el gate de un
 * complemento de pago no puede depender de lo que el navegador diga,
 * ni de una fila que el dueño pudiera escribir.
 */
export async function puedeUsarAgendaIA(ranchoId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("tiene_addon", {
    p_rancho_id: ranchoId,
    p_addon: "agenda_ia",
  });
  if (error) return false;
  return data === true;
}

/** Fallos permitidos antes de trancar, y por cuánto tiempo. */
const MAX_FALLOS = 3;
const VENTANA_MINUTOS = 15;

/**
 * Compara sin filtrar información por el tiempo que tarda.
 *
 * Un `===` corta en el primer carácter distinto, así que medir cuánto
 * demora la respuesta deja adivinar el código dígito por dígito. Se
 * comparan los digest SHA-256 porque siempre miden lo mismo:
 * `timingSafeEqual` exige búferes del mismo largo, y de paso no se
 * filtra ni la longitud del código.
 */
function comparacionSegura(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Desbloquea la lectura con IA escribiendo el código.
 *
 * Nadie tiene el complemento activo de entrada: se entra escribiendo
 * el código y eso enciende `addons_negocio.agenda_ia` para ESE negocio.
 *
 * La comparación vive acá, en el servidor, a propósito. Si estuviera
 * en el componente, el código viajaría en el bundle de JavaScript y
 * se leería con abrir las herramientas del navegador — dejaría de ser
 * un candado. Por lo mismo el código nunca se devuelve al cliente:
 * la respuesta solo dice si abrió o no.
 *
 * OJO: es un código corto y compartido, pensado para habilitar a mano
 * mientras no exista el flujo de cobro. No es protección de pago:
 * quien lo tenga lo puede pasar, y son 10.000 combinaciones. Cuando
 * entre la pasarela, esto se reemplaza por la compra real.
 */
export async function desbloquearAgendaIA(
  ranchoId: string,
  codigo: string,
): Promise<{ error?: string; ok?: boolean; esperaMinutos?: number }> {
  const { negocio } = await verificarDueno(ranchoId);
  if (!negocio) return { error: "No encontramos tu publicación." };

  const admin = createAdminClient();
  if (!admin) return { error: "Falta la configuración del servidor." };

  // --- Freno a la fuerza bruta ---
  // Los fallos se cuentan en la base, no en memoria: en Vercel cada
  // request puede caer en otra instancia y un contador en RAM se
  // reiniciaría solo.
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString();
  const { data: fallos } = await admin
    .from("intentos_desbloqueo")
    .select("created_at")
    .eq("rancho_id", ranchoId)
    .eq("addon", "agenda_ia")
    .eq("exito", false)
    .gte("created_at", desde)
    .order("created_at", { ascending: true });

  if ((fallos?.length ?? 0) >= MAX_FALLOS) {
    // La espera corre desde el fallo MÁS VIEJO de la ventana: así se
    // va liberando de a poco en vez de trancar de golpe otros 15
    // minutos con cada intento nuevo.
    const masViejo = new Date(fallos![0].created_at as string).getTime();
    const libreEn = masViejo + VENTANA_MINUTOS * 60_000;
    const minutos = Math.max(1, Math.ceil((libreEn - Date.now()) / 60_000));
    return {
      error: `Demasiados intentos fallidos. Probá de nuevo en ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
      esperaMinutos: minutos,
    };
  }

  const esperado = process.env.CODIGO_AGENDA_IA ?? "0018";
  if (!comparacionSegura(codigo.trim(), esperado)) {
    await admin
      .from("intentos_desbloqueo")
      .insert({ rancho_id: ranchoId, addon: "agenda_ia", exito: false });

    const restantes = MAX_FALLOS - ((fallos?.length ?? 0) + 1);
    return {
      error:
        restantes > 0
          ? `Ese código no es. Te quedan ${restantes} intento${restantes === 1 ? "" : "s"}.`
          : `Ese código no es. Esperá ${VENTANA_MINUTOS} minutos antes de volver a probar.`,
    };
  }

  // Acertó: se limpia el historial de fallos para que un intento
  // legítimo anterior no le cuente en contra más adelante.
  await admin
    .from("intentos_desbloqueo")
    .delete()
    .eq("rancho_id", ranchoId)
    .eq("addon", "agenda_ia");
  await admin
    .from("intentos_desbloqueo")
    .insert({ rancho_id: ranchoId, addon: "agenda_ia", exito: true });

  const { error } = await admin.from("addons_negocio").upsert(
    {
      rancho_id: ranchoId,
      addon: "agenda_ia",
      activo: true,
      activado_en: new Date().toISOString(),
      notas: "Desbloqueado con código de acceso",
    },
    { onConflict: "rancho_id,addon" },
  );
  if (error) return { error: "No se pudo activar: " + error.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { ok: true };
}

export type EstadoAddon = {
  activo: boolean;
  venceEn: string | null;
  /** Cuántas corridas de IA lleva el negocio (para mostrar consumo). */
  corridasIa: number;
};

export async function estadoAddonAgendaIA(ranchoId: string): Promise<EstadoAddon> {
  const { negocio } = await verificarDueno(ranchoId);
  if (!negocio) return { activo: false, venceEn: null, corridasIa: 0 };

  const admin = createAdminClient();
  if (!admin) return { activo: false, venceEn: null, corridasIa: 0 };

  const { data: addon } = await admin
    .from("addons_negocio")
    .select("activo, vence_en")
    .eq("rancho_id", ranchoId)
    .eq("addon", "agenda_ia")
    .maybeSingle();

  const { count } = await admin
    .from("importaciones_agenda")
    .select("id", { count: "exact", head: true })
    .eq("rancho_id", ranchoId)
    .in("metodo", ["ia_texto", "ia_foto"]);

  const vigente =
    addon?.activo === true &&
    (addon.vence_en == null || new Date(addon.vence_en as string) > new Date());

  return {
    activo: vigente,
    venceEn: (addon?.vence_en as string) ?? null,
    corridasIa: count ?? 0,
  };
}

// ------------------------------------------------------------------
// Camino MANUAL: pegar columnas (sin IA, gratis)
// ------------------------------------------------------------------

/**
 * Parte texto pegado de una hoja de cálculo en filas.
 *
 * Es un partidor determinista — separa por tabulaciones, punto y coma
 * o comas, en ese orden de preferencia. No interpreta lenguaje ni
 * adivina: para eso está el camino con IA. Como no llama a ningún
 * modelo, es gratis y corre en el servidor sin costo.
 *
 * Espera el orden: fecha, nombre, personas, hora inicio, hora fin,
 * monto, adelanto. Las columnas que falten quedan vacías.
 */
export async function partirTextoPegado(
  ranchoId: string,
  texto: string,
): Promise<{ error?: string; filas?: FilaAgenda[] }> {
  const { negocio } = await verificarDueno(ranchoId);
  if (!negocio) return { error: "No encontramos tu publicación." };

  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length === 0) return { error: "No pegaste nada." };

  const separador = lineas[0].includes("\t") ? "\t" : lineas[0].includes(";") ? ";" : ",";

  const ENCABEZADOS = /fecha|nombre|cliente|persona|monto|hora/i;
  const filas: FilaAgenda[] = [];

  for (const linea of lineas.slice(0, 400)) {
    const celdas = linea.split(separador).map((c) => c.trim());
    // Saltar una fila de encabezados si viene pegada del Excel.
    if (filas.length === 0 && celdas.filter((c) => ENCABEZADOS.test(c)).length >= 2) continue;

    const [fecha, nombre, personas, horaInicio, horaFin, monto, adelanto] = celdas;
    if (!fecha) continue;

    filas.push(
      normalizarFila({
        fecha: normalizarFecha(fecha) ?? fecha,
        nombre: nombre ?? "",
        personas,
        horaInicio,
        horaFin,
        montoTotal: monto,
        adelanto,
        avisos: normalizarFecha(fecha) ? [] : ["No se entendió la fecha — revisala."],
      } as FilaCruda),
    );
  }

  if (filas.length === 0) {
    return { error: "No se reconoció ninguna fila. Revisá que la primera columna sea la fecha." };
  }
  return { filas };
}

/** "01/08/2026", "1-8-26", "2026-08-01" → "2026-08-01". */
function normalizarFecha(bruta: string): string | null {
  const t = bruta.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += 2000;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// ------------------------------------------------------------------
// Guardar el lote (común a los dos caminos, siempre gratis)
// ------------------------------------------------------------------

export type ResultadoGuardado = {
  error?: string;
  guardadas?: number;
  /** Filas que la base rechazó, con el motivo. */
  rechazadas?: { nombre: string; fecha: string; motivo: string }[];
  importacionId?: string;
};

export async function guardarLoteAgenda(
  ranchoId: string,
  filasCrudas: FilaAgenda[],
  metodo: "manual" | "ia_texto" | "ia_foto",
): Promise<ResultadoGuardado> {
  const { supabase, negocio } = await verificarDueno(ranchoId);
  if (!negocio) return { error: "No encontramos tu publicación." };

  if (!Array.isArray(filasCrudas) || filasCrudas.length === 0) {
    return { error: "No hay filas para guardar." };
  }
  if (filasCrudas.length > 400) {
    return { error: "Son demasiadas filas de una vez. Guardá por partes (máximo 400)." };
  }

  // Si el lote dice venir de IA, el negocio tiene que tener el add-on.
  // Si no, se registra como manual — no se bloquea el guardado, porque
  // guardar siempre es gratis; lo que se cobra es la lectura.
  let metodoReal = metodo;
  if (metodo !== "manual" && !(await puedeUsarAgendaIA(ranchoId))) {
    metodoReal = "manual";
  }

  const filas = filasCrudas.map((f) => normalizarFila(f));
  const choques = detectarChoques(filas, negocio);

  const admin = createAdminClient();
  if (!admin) return { error: "Falta la configuración del servidor." };

  const { data: importacion, error: errImp } = await admin
    .from("importaciones_agenda")
    .insert({
      rancho_id: ranchoId,
      metodo: metodoReal,
      filas_propuestas: filas.length,
    })
    .select("id")
    .single();
  if (errImp || !importacion) {
    return { error: "No se pudo abrir la importación: " + (errImp?.message ?? "") };
  }
  const importacionId = importacion.id as string;

  const ahoraIso = new Date().toISOString();
  const rechazadas: { nombre: string; fecha: string; motivo: string }[] = [];
  let guardadas = 0;

  for (const fila of filas) {
    const check = validarFila(fila, negocio);
    if (!check.ok) {
      rechazadas.push({ nombre: fila.nombre, fecha: fila.fecha, motivo: check.errores[0] });
      continue;
    }
    const choque = choques.get(fila.id);
    if (choque) {
      rechazadas.push({ nombre: fila.nombre, fecha: fila.fecha, motivo: choque });
      continue;
    }

    const payload = aFilaReserva(fila, negocio, { importacionId, ahoraIso });

    // La política de insert solo deja crear en 'pendiente'/'temporal';
    // se confirma con un update, que sí permite la política del dueño.
    // Igual criterio que crearReservaManual.
    const { data: creada, error: errIns } = await supabase
      .from("reservas")
      .insert({ ...payload, estado: "pendiente" })
      .select("id")
      .single();

    if (errIns || !creada) {
      rechazadas.push({
        nombre: fila.nombre,
        fecha: fila.fecha,
        motivo:
          errIns?.code === "23505"
            ? "Esa fecha ya está tomada."
            : (errIns?.message ?? "No se pudo crear."),
      });
      continue;
    }

    const { error: errUpd } = await supabase
      .from("reservas")
      .update({ estado: "confirmada" })
      .eq("id", creada.id);

    if (errUpd) {
      rechazadas.push({
        nombre: fila.nombre,
        fecha: fila.fecha,
        motivo:
          errUpd.code === "23505"
            ? "Esa fecha ya tiene una reserva confirmada."
            : errUpd.message,
      });
      // Queda pendiente, no huérfana: sigue visible y editable.
      continue;
    }
    guardadas += 1;
  }

  await admin
    .from("importaciones_agenda")
    .update({ filas_guardadas: guardadas })
    .eq("id", importacionId);

  revalidatePath(`/mi-negocio/${ranchoId}`);
  revalidatePath("/admin/eventos");

  return { guardadas, rechazadas, importacionId };
}

/**
 * Deshace una importación completa.
 *
 * Es la red de seguridad del importador: si el dueño guardó 40 filas
 * mal leídas, no tiene que borrarlas una por una. Solo toca lo que
 * entró en ESA corrida y que siga marcado como importado — una
 * reserva que ya editó a mano conserva su `importacion_id`, así que
 * se avisa cuántas se van.
 */
export async function deshacerImportacion(
  ranchoId: string,
  importacionId: string,
): Promise<{ error?: string; borradas?: number }> {
  const { supabase, negocio } = await verificarDueno(ranchoId);
  if (!negocio) return { error: "No encontramos tu publicación." };

  const { data: filas, error } = await supabase
    .from("reservas")
    .select("id")
    .eq("rancho_id", ranchoId)
    .eq("importacion_id", importacionId);

  if (error) return { error: "No se pudo leer la importación: " + error.message };
  if (!filas || filas.length === 0) return { borradas: 0 };

  const { error: errDel } = await supabase
    .from("reservas")
    .delete()
    .in(
      "id",
      filas.map((f) => f.id),
    );
  if (errDel) return { error: "No se pudieron borrar: " + errDel.message };

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return { borradas: filas.length };
}

// ------------------------------------------------------------------
// Ascender un bloqueo importado de Google a reserva de verdad
// ------------------------------------------------------------------

/**
 * Un evento traído de Google entra como bloqueo anónimo (origen
 * 'sync'): tapa la fecha pero no tiene cliente ni plata. Esto lo
 * convierte en una reserva real con los datos que complete el dueño.
 *
 * Se corta el vínculo con la agenda externa (`agenda_externa_id` y
 * `sync_uid` a null) a propósito: si se dejara, la próxima
 * sincronización lo volvería a tratar como suyo y podría borrarlo al
 * reconciliar.
 */
export async function ascenderBloqueoAReserva(
  ranchoId: string,
  reservaId: string,
  datos: Partial<FilaAgenda>,
): Promise<{ error?: string }> {
  const { supabase, negocio } = await verificarDueno(ranchoId);
  if (!negocio) return { error: "No encontramos tu publicación." };

  const { data: bloqueo } = await supabase
    .from("reservas")
    .select("id, fecha, fecha_fin, hora_inicio, duracion_minutos, origen, estado")
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  if (!bloqueo) return { error: "No encontramos ese bloqueo." };
  if (bloqueo.origen !== "sync") {
    return { error: "Ese registro no vino de un calendario externo." };
  }

  const fila = normalizarFila({
    ...datos,
    fecha: datos.fecha ?? (bloqueo.fecha as string),
  } as FilaCruda);

  const check = validarFila(fila, negocio);
  if (!check.ok) return { error: check.errores[0] };

  const ahoraIso = new Date().toISOString();
  const payload = aFilaReserva(fila, negocio, { importacionId: "", ahoraIso });
  delete payload.importacion_id;
  delete payload.rancho_id;

  const { error } = await supabase
    .from("reservas")
    .update({
      ...payload,
      origen: "manual",
      estado: "confirmada",
      sync_uid: null,
      agenda_externa_id: null,
    })
    .eq("id", reservaId)
    .eq("rancho_id", ranchoId);

  if (error) {
    if (error.code === "23505") return { error: "Esa fecha ya tiene una reserva confirmada." };
    return { error: "No se pudo convertir: " + error.message };
  }

  revalidatePath(`/mi-negocio/${ranchoId}`);
  return {};
}

/** Los bloqueos traídos de calendarios externos que aún no son reserva. */
export async function bloqueosImportables(ranchoId: string) {
  const { supabase, negocio } = await verificarDueno(ranchoId);
  if (!negocio) return [];

  const { data } = await supabase
    .from("reservas")
    .select("id, fecha, fecha_fin, hora_inicio, duracion_minutos, nombre, tipo_evento")
    .eq("rancho_id", ranchoId)
    .eq("origen", "sync")
    .gte("fecha", hoyISOCR())
    .order("fecha")
    .limit(200);

  return data ?? [];
}
