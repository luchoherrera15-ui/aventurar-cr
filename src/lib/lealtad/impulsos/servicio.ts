import type { SupabaseClient } from "@supabase/supabase-js";
import { identidadesDeMiembros } from "@/lib/lealtad/identidades-db";
import { MAX_IMPULSOS_POR_TARJETA } from "./catalogo";
import { nombreDePila } from "./mensaje";
import { reintentoSeguro, textoDeMotivo } from "./motivos";
import { plantillaPorId, PLANTILLAS, type PlantillaImpulso } from "./preconfigurados";
import { leerInfoPrograma } from "./repositorio";
import { ESTADOS_TAREA, type EntradaImpulso, type EstadoImpulso, type EstadoTarea, type Impulso, type InfoPrograma } from "./tipos";
import { normalizarEntrada, validarImpulso, type ResultadoValidacion } from "./validacion";
import type { CambioDeEstado, ConteoDeTareas, FilaHistorial, FiltrosHistorial, ImpulsoVista, PaginaDeHistorial, PlantillaVista } from "./vista";
import { definicionDeActivadorEnVoz, textosDe, type Voz } from "./voz-foorkie";
import { partesLocales } from "./zona-horaria";

/**
 * ════════════════════════════════════════════════════════════════════
 *  IMPULSOS AUTOMÁTICOS — EL SERVICIO (lo que se hace con un impulso)
 * ════════════════════════════════════════════════════════════════════
 *
 * Las operaciones sobre los impulsos de una tarjeta, SIN saber quién las pide: leer, ver el historial, guardar,
 * cambiar el estado, duplicar, eliminar, crear desde una plantilla y reintentar un mensaje. Las usan dos
 * puertas distintas, cada una con su propia comprobación de acceso:
 *
 *   · las acciones del panel de Bookea (`impulsos-actions.ts`): el dueño o el admin con sesión;
 *   · las rutas firmadas de Foorkie (`/api/plataforma/foorkie/impulsos/*`): el vínculo con un local de
 *     Foorkie y la marca `lealtad_por_foorkie`.
 *
 * Este archivo NO autentica, NO revalida páginas y NO crea el cliente de la base: recibe la base y quién
 * actúa. Lo que SÍ hace, siempre y sin saltarse nada, es la defensa de datos que no depende de la puerta:
 *
 *   1. La tarjeta es de ESE negocio (`programaId` llega de afuera, y `programa_lealtad` es legible por anon).
 *   2. El impulso (si viene uno) es de esa tarjeta Y de ese negocio.
 *   3. Lo que llega se reconstruye campo por campo (`normalizarEntrada`) y se valida: guardar no exige lo mismo
 *      que activar, y un impulso ACTIVO no puede quedar inválido.
 *
 * Cada fallo trae un `codigo` estable (para que quien llama decida qué hacer) y un `motivo` ya redactado.
 * La `voz` del contexto decide en qué palabras: la de Bookea por defecto, la de Foorkie para sus restaurantes
 * (nunca se les nombra a Bookea).
 */

type Db = SupabaseClient;

/** A quién se le habla y quién actúa. `actorId` queda en `creado_por` de lo que se crea. */
export type ContextoDelServicio = {
  ranchoId: string;
  programaId: string;
  actorId: string;
  /** En qué palabras salen los textos. Por defecto, la de Bookea. */
  voz?: Voz;
};

export type CodigoDeImpulsos =
  | "sin_migracion"
  | "sin_tarjeta"
  | "sin_impulso"
  | "validacion"
  | "no_editable"
  | "limite"
  | "plantilla_no_disponible"
  | "plantilla_no_existe"
  | "estado_invalido"
  | "riesgo_de_duplicado"
  | "tarea_no_reintentable"
  | "error_base";

export type ProblemaDeCampo = { campo: string; mensaje: string };

export type FalloDelServicio = { ok: false; codigo: CodigoDeImpulsos; motivo: string; problemas?: ProblemaDeCampo[] };
export type ResultadoDelServicio<T> = { ok: true; datos: T } | FalloDelServicio;

/** Cuántas filas tiene cada página del historial. */
export const POR_PAGINA = 25;
/** Cuántas filas de la cola se leen para contar por estado. Más viejas que esto no entran en el resumen. */
const TOPE_DE_CONTEO = 10_000;

const COLUMNAS_IMPULSO =
  "id, rancho_id, programa_id, nombre, descripcion, activador, activador_config, condiciones, canal, titulo, cuerpo, retraso_minutos, horario, vigente_desde, vigente_hasta, espera_minima_horas, estado, plantilla, version, activado_en, ultimo_escaneo_en, creado_por, created_at, updated_at";

// ═══════════════════════════════════════════════════════════════════
//  AYUDAS
// ═══════════════════════════════════════════════════════════════════

/** ¿El error es «esa tabla no existe todavía»? (migración sin correr). */
export function faltaLaMigracion(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  // Sin código, por el texto: tiene que nombrar una de las tablas Y decir que no existe (un CHECK que
  // viola `impulsos_lealtad_...` no es una migración sin correr).
  const mensaje = error.message ?? "";
  return /impulsos_(lealtad|tareas|eventos)/.test(mensaje) && /does not exist|no existe|schema cache|could not find/i.test(mensaje);
}

function fallo(codigo: CodigoDeImpulsos, motivo: string, problemas?: ProblemaDeCampo[]): FalloDelServicio {
  return { ok: false, codigo, motivo, ...(problemas ? { problemas } : {}) };
}

/** Un fallo de la base: «falta la migración» si es eso, y si no el mensaje que corresponda a la operación. */
function falloDeBase(c: ContextoDelServicio, error: { code?: string; message?: string } | null, queFallo: string): FalloDelServicio {
  if (faltaLaMigracion(error)) return fallo("sin_migracion", textosDe(c.voz).sinMigracion);
  return fallo("error_base", `${queFallo}: ${error?.message ?? "sin respuesta"}`);
}

const SIN_TARJETA = () => fallo("sin_tarjeta", "Esa tarjeta no es de este negocio.");
const SIN_IMPULSO = () => fallo("sin_impulso", "Ese impulso no existe en esta tarjeta.");

/** El contexto de la tarjeta, comprobando que es de ESTE negocio. */
async function infoDeLaTarjeta(db: Db, c: ContextoDelServicio): Promise<InfoPrograma | null> {
  const info = await leerInfoPrograma(db, c.programaId);
  if (!info || info.ranchoId !== c.ranchoId) return null;
  return info;
}

async function leerImpulso(db: Db, c: ContextoDelServicio, id: string): Promise<{ ok: true; impulso: Impulso | null } | FalloDelServicio> {
  const { data, error } = await db
    .from("impulsos_lealtad")
    .select(COLUMNAS_IMPULSO)
    .eq("id", id)
    .eq("rancho_id", c.ranchoId)
    .eq("programa_id", c.programaId)
    .maybeSingle();
  if (error) {
    return faltaLaMigracion(error) ? falloDeBase(c, error, "") : fallo("error_base", "No se pudo leer el impulso.");
  }
  return { ok: true, impulso: (data ?? null) as unknown as Impulso | null };
}

function conteoVacio(): ConteoDeTareas {
  return Object.fromEntries(ESTADOS_TAREA.map((e) => [e, 0])) as ConteoDeTareas;
}

export function hoyDe(zona: string): string {
  return partesLocales(new Date(), zona).fecha;
}

/** El contexto con el que se valida un impulso en esta tarjeta. */
function contextoDeValidacion(info: InfoPrograma, voz: Voz | undefined) {
  return { modo: info.modo, esFoorkie: info.esFoorkie, tieneRecompensa: info.meta !== null, hoy: hoyDe(info.zona), voz };
}

/** Lo que se le dice a quien llama cuando la validación no deja seguir. */
function problemasDe(r: ResultadoValidacion, que: "guardar" | "activar"): ProblemaDeCampo[] {
  return r.problemas.filter((p) => p.bloquea === "guardar" || que === "activar").map((p) => ({ campo: p.campo, mensaje: p.mensaje }));
}

/** El motivo de una plantilla que hoy no se puede usar, en la voz que toca. */
export function motivoDePlantilla(p: PlantillaImpulso, voz: Voz | undefined): string | undefined {
  if (!p.motivo || voz !== "foorkie") return p.motivo;
  // El motivo de una plantilla es el `noDisponible` de su activador: en la voz de Foorkie se toma de ahí.
  return definicionDeActivadorEnVoz(p.entrada("sellos").activador, voz)?.noDisponible ?? p.motivo;
}

export function plantillasDeLaVista(voz: Voz | undefined): PlantillaVista[] {
  return PLANTILLAS.map((p) => {
    const motivo = motivoDePlantilla(p, voz);
    return { id: p.id, nombre: p.nombre, resumen: p.resumen, disponible: p.disponible, ...(motivo ? { motivo } : {}) };
  });
}

/** Cuántos impulsos cuentan para el tope (los archivados no). */
async function cuantosImpulsos(db: Db, programaId: string): Promise<{ count: number | null; error: { code?: string; message: string } | null }> {
  const { count, error } = await db
    .from("impulsos_lealtad")
    .select("id", { count: "exact", head: true })
    .eq("programa_id", programaId)
    .neq("estado", "archivado");
  return { count, error };
}

const mensajeDelTope = (que: "crear" | "duplicar") =>
  `Una tarjeta puede tener hasta ${MAX_IMPULSOS_POR_TARJETA} impulsos. Archivá o eliminá alguno para ${que === "crear" ? "crear" : "duplicar"} otro.`;

// ═══════════════════════════════════════════════════════════════════
//  LEER
// ═══════════════════════════════════════════════════════════════════

export type DatosDelServicio = { info: InfoPrograma; impulsos: ImpulsoVista[]; plantillas: PlantillaVista[] };

/** Todo lo que una pantalla necesita para dibujarse: la tarjeta, sus impulsos (con su conteo) y las plantillas. */
export async function servicioDatos(db: Db, c: ContextoDelServicio): Promise<ResultadoDelServicio<DatosDelServicio>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();

  const { data, error } = await db
    .from("impulsos_lealtad")
    .select(COLUMNAS_IMPULSO)
    .eq("programa_id", c.programaId)
    .eq("rancho_id", c.ranchoId)
    .order("created_at", { ascending: false });
  if (error) return falloDeBase(c, error, "No se pudieron leer los impulsos");
  const impulsos = (data ?? []) as unknown as Impulso[];

  const conteos = new Map<string, ConteoDeTareas>();
  const ultimo = new Map<string, string>();
  if (impulsos.length > 0) {
    // La cola se lee de a mil filas (el tope de PostgREST) hasta el tope de conteo: un negocio con
    // mucho movimiento no se come la memoria, y lo viejo no entra en el resumen (se dice en la pantalla).
    for (let desde = 0; desde < TOPE_DE_CONTEO; desde += 1000) {
      const { data: filas, error: errorTareas } = await db
        .from("impulsos_tareas")
        .select("impulso_id, estado, enviada_en")
        .eq("programa_id", c.programaId)
        .order("created_at", { ascending: false })
        .range(desde, desde + 999);
      if (errorTareas) break; // El resumen es un extra: sin él la pantalla igual sirve.
      const lote = (filas ?? []) as { impulso_id: string; estado: string; enviada_en: string | null }[];
      for (const f of lote) {
        const cuenta = conteos.get(f.impulso_id) ?? conteoVacio();
        if ((ESTADOS_TAREA as readonly string[]).includes(f.estado)) cuenta[f.estado as EstadoTarea] += 1;
        conteos.set(f.impulso_id, cuenta);
        if (f.enviada_en && (!ultimo.get(f.impulso_id) || f.enviada_en > (ultimo.get(f.impulso_id) as string))) {
          ultimo.set(f.impulso_id, f.enviada_en);
        }
      }
      if (lote.length < 1000) break;
    }
  }

  const vista: ImpulsoVista[] = impulsos.map((i) => ({
    ...i,
    conteo: conteos.get(i.id) ?? conteoVacio(),
    ultimoEnvio: ultimo.get(i.id) ?? null,
  }));

  return { ok: true, datos: { info, impulsos: vista, plantillas: plantillasDeLaVista(c.voz) } };
}

/** El historial de mensajes: qué se mandó, a quién, cuándo y qué pasó. De a 25, con filtros. */
export async function servicioHistorial(
  db: Db,
  c: ContextoDelServicio,
  filtros: FiltrosHistorial = {},
): Promise<ResultadoDelServicio<PaginaDeHistorial>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();

  const pagina = Math.max(0, Math.min(10_000, Math.trunc(filtros.pagina ?? 0)));
  const estado = filtros.estado && filtros.estado !== "todos" && (ESTADOS_TAREA as readonly string[]).includes(filtros.estado) ? filtros.estado : null;
  const impulsoId = typeof filtros.impulsoId === "string" && /^[0-9a-f-]{36}$/i.test(filtros.impulsoId) ? filtros.impulsoId : null;

  let consulta = db
    .from("impulsos_tareas")
    .select(
      "id, impulso_id, miembro_id, canal, estado, ejecutar_en, enviada_en, intentos, motivo, detalle, mensaje_titulo, mensaje_cuerpo, impulsos_lealtad(nombre)",
      { count: "exact" },
    )
    .eq("programa_id", c.programaId)
    .eq("rancho_id", c.ranchoId)
    .order("ejecutar_en", { ascending: false })
    .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
  if (estado) consulta = consulta.eq("estado", estado);
  if (impulsoId) consulta = consulta.eq("impulso_id", impulsoId);

  const { data, error, count } = await consulta;
  if (error) return falloDeBase(c, error, "No se pudo leer el historial");
  type Fila = {
    id: string;
    impulso_id: string;
    miembro_id: string;
    canal: string;
    estado: EstadoTarea;
    ejecutar_en: string;
    enviada_en: string | null;
    intentos: number;
    motivo: string | null;
    detalle: string | null;
    mensaje_titulo: string | null;
    mensaje_cuerpo: string | null;
    impulsos_lealtad: { nombre: string } | { nombre: string }[] | null;
  };
  const filas = (data ?? []) as unknown as Fila[];

  // Los nombres se piden aparte y solo de los de esta página: el historial nunca carga la lista de clientes entera.
  const miembroIds = [...new Set(filas.map((f) => f.miembro_id))];
  const nombres = new Map<string, string>();
  if (miembroIds.length > 0) {
    const { data: miembros } = await db.from("miembros").select("id, persona_id, cliente_id").in("id", miembroIds).eq("programa_id", c.programaId);
    const identidades = await identidadesDeMiembros(
      db,
      ((miembros ?? []) as { id: string; persona_id: string | null; cliente_id: string | null }[]).map((m) => ({
        id: m.id,
        persona_id: m.persona_id,
        cliente_id: m.cliente_id,
      })),
      c.ranchoId,
    );
    for (const [id, ident] of identidades) nombres.set(id, nombreDePila(ident?.nombre ?? null) ?? "Cliente");
  }

  const salida: FilaHistorial[] = filas.map((f) => {
    const rel = Array.isArray(f.impulsos_lealtad) ? f.impulsos_lealtad[0] : f.impulsos_lealtad;
    const reintentable = f.estado === "fallida";
    return {
      id: f.id,
      impulsoId: f.impulso_id,
      impulsoNombre: rel?.nombre ?? "Impulso eliminado",
      cliente: nombres.get(f.miembro_id) ?? "Cliente",
      canal: f.canal,
      estado: f.estado,
      ejecutarEn: f.ejecutar_en,
      enviadaEn: f.enviada_en,
      intentos: f.intentos,
      motivo: f.motivo,
      motivoTexto: textoDeMotivo(f.motivo, c.voz),
      detalle: f.detalle,
      titulo: f.mensaje_titulo,
      cuerpo: f.mensaje_cuerpo,
      reintentable,
      reintentoConRiesgo: reintentable && !reintentoSeguro(f.motivo),
    };
  });

  return { ok: true, datos: { filas: salida, total: count ?? salida.length, pagina, porPagina: POR_PAGINA } };
}

// ═══════════════════════════════════════════════════════════════════
//  ESCRIBIR
// ═══════════════════════════════════════════════════════════════════

/** Lo que todavía no salió de un impulso se cancela (con su motivo) para que pausar signifique «no sale nada más». */
async function cancelarTareasAbiertas(db: Db, impulsoId: string, motivo: string): Promise<void> {
  await db
    .from("impulsos_tareas")
    .update({
      estado: "cancelada",
      motivo,
      detalle: null,
      proximo_intento_en: null,
      updated_at: new Date().toISOString(),
    })
    .eq("impulso_id", impulsoId)
    // Solo lo que NO está siendo enviado ahora mismo: una tarea «procesando» ya tiene un worker encima,
    // que vuelve a mirar el estado del impulso justo antes de mandar.
    .in("estado", ["programada", "pendiente"]);
}

/** Crea un impulso (borrador) o guarda los cambios de uno existente. */
export async function servicioGuardar(
  db: Db,
  c: ContextoDelServicio,
  impulsoId: string | null,
  crudo: unknown,
): Promise<ResultadoDelServicio<{ id: string; avisos: string[] }>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();

  const entrada = normalizarEntrada(crudo);
  const validacion = validarImpulso(entrada, contextoDeValidacion(info, c.voz));
  if (!validacion.puedeGuardar) {
    return fallo("validacion", "Revisá los datos marcados antes de guardar.", problemasDe(validacion, "guardar"));
  }

  if (impulsoId === null) {
    const { count, error: errorCuenta } = await cuantosImpulsos(db, c.programaId);
    if (errorCuenta) return falloDeBase(c, errorCuenta, "No se pudo guardar");
    if ((count ?? 0) >= MAX_IMPULSOS_POR_TARJETA) return fallo("limite", mensajeDelTope("crear"));
    const { data, error } = await db
      .from("impulsos_lealtad")
      .insert({ ...entrada, rancho_id: c.ranchoId, programa_id: c.programaId, estado: "borrador", creado_por: c.actorId })
      .select("id")
      .single();
    if (error || !data) return falloDeBase(c, error, "No se pudo guardar");
    return { ok: true, datos: { id: (data as { id: string }).id, avisos: validacion.avisos } };
  }

  const leido = await leerImpulso(db, c, impulsoId);
  if (!leido.ok) return leido;
  const actual = leido.impulso;
  if (!actual) return SIN_IMPULSO();
  if (actual.estado === "archivado") {
    return fallo("no_editable", "Un impulso archivado no se edita. Duplicalo para armar uno nuevo con esos datos.");
  }
  // Un impulso ACTIVO sale a clientes de verdad: no puede quedar a medias. Si el cambio lo deja inválido,
  // se pide arreglarlo o pausarlo primero, en vez de guardar algo que el motor va a omitir.
  if (actual.estado === "activo" && !validacion.puedeActivar) {
    return fallo(
      "no_editable",
      "Este impulso está activo y con esos cambios no podría salir. Arreglá lo marcado o pausalo antes de editarlo.",
      problemasDe(validacion, "activar"),
    );
  }

  const cambiaElDisparo =
    actual.activador !== entrada.activador || JSON.stringify(actual.activador_config) !== JSON.stringify(entrada.activador_config);

  const ahora = new Date().toISOString();
  const { error } = await db
    .from("impulsos_lealtad")
    .update({ ...entrada, version: actual.version + 1, updated_at: ahora })
    .eq("id", impulsoId)
    .eq("rancho_id", c.ranchoId)
    .eq("programa_id", c.programaId);
  if (error) return falloDeBase(c, error, "No se pudo guardar");

  if (cambiaElDisparo) await cancelarTareasAbiertas(db, impulsoId, "impulso_editado");
  return { ok: true, datos: { id: impulsoId, avisos: validacion.avisos } };
}

/** Activar, pausar, archivar o devolver a borrador. Activar vuelve a validar TODO. */
export async function servicioCambiarEstado(
  db: Db,
  c: ContextoDelServicio,
  impulsoId: string,
  nuevo: CambioDeEstado,
): Promise<ResultadoDelServicio<{ estado: EstadoImpulso; avisos: string[] }>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();

  const leido = await leerImpulso(db, c, impulsoId);
  if (!leido.ok) return leido;
  const actual = leido.impulso;
  if (!actual) return SIN_IMPULSO();
  if (actual.estado === nuevo) return { ok: true, datos: { estado: nuevo, avisos: [] } };
  if (actual.estado === "archivado" && nuevo !== "borrador") {
    return fallo("estado_invalido", "Un impulso archivado no se activa. Duplicalo para armar uno nuevo con esos datos.");
  }

  let avisos: string[] = [];
  const cambios: Record<string, unknown> = { estado: nuevo, updated_at: new Date().toISOString() };

  if (nuevo === "activo") {
    const entrada: EntradaImpulso = normalizarEntrada(actual);
    const validacion = validarImpulso(entrada, contextoDeValidacion(info, c.voz));
    if (!validacion.puedeActivar) {
      return fallo("validacion", "Todavía no se puede activar. Revisá lo marcado.", problemasDe(validacion, "activar"));
    }
    avisos = validacion.avisos;
    // `activado_en` es la línea de corte: el impulso solo toma lo que pase DESPUÉS de este momento. Al
    // reactivar tras una pausa se vuelve a sellar, así lo ocurrido mientras estaba pausado no sale tarde.
    cambios.activado_en = new Date().toISOString();
  }

  const { error } = await db
    .from("impulsos_lealtad")
    .update(cambios)
    .eq("id", impulsoId)
    .eq("rancho_id", c.ranchoId)
    .eq("programa_id", c.programaId);
  if (error) return falloDeBase(c, error, "No se pudo cambiar el estado");

  if (nuevo === "pausado" || nuevo === "archivado" || nuevo === "borrador") {
    await cancelarTareasAbiertas(db, impulsoId, nuevo === "archivado" ? "impulso_eliminado" : "impulso_pausado");
  }
  return { ok: true, datos: { estado: nuevo, avisos } };
}

/** Una copia en borrador, para armar una variante sin tocar el original. */
export async function servicioDuplicar(db: Db, c: ContextoDelServicio, impulsoId: string): Promise<ResultadoDelServicio<{ id: string }>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();
  const leido = await leerImpulso(db, c, impulsoId);
  if (!leido.ok) return leido;
  const actual = leido.impulso;
  if (!actual) return SIN_IMPULSO();

  const { count } = await cuantosImpulsos(db, c.programaId);
  if ((count ?? 0) >= MAX_IMPULSOS_POR_TARJETA) return fallo("limite", mensajeDelTope("duplicar"));

  const copia = normalizarEntrada(actual);
  const nombre = `Copia de ${copia.nombre}`.slice(0, 80);
  const { data, error } = await db
    .from("impulsos_lealtad")
    .insert({ ...copia, nombre, rancho_id: c.ranchoId, programa_id: c.programaId, estado: "borrador", creado_por: c.actorId })
    .select("id")
    .single();
  if (error || !data) return falloDeBase(c, error, "No se pudo duplicar");
  return { ok: true, datos: { id: (data as { id: string }).id } };
}

/**
 * Eliminar con protección: un impulso que ya mandó (o intentó mandar) mensajes NO se borra, se archiva —el
 * historial de lo que salió a clientes de verdad tiene que quedar—. Uno que nunca salió se borra del todo.
 */
export async function servicioEliminar(
  db: Db,
  c: ContextoDelServicio,
  impulsoId: string,
): Promise<ResultadoDelServicio<{ resultado: "eliminado" | "archivado" }>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();
  const leido = await leerImpulso(db, c, impulsoId);
  if (!leido.ok) return leido;
  if (!leido.impulso) return SIN_IMPULSO();

  // Primero se frena todo lo que esperaba: si hay un worker a mitad de camino, al volver a mirar el impulso
  // lo encuentra pausado/archivado y no manda.
  await db.from("impulsos_lealtad").update({ estado: "pausado", updated_at: new Date().toISOString() }).eq("id", impulsoId).eq("rancho_id", c.ranchoId).eq("estado", "activo");
  await cancelarTareasAbiertas(db, impulsoId, "impulso_eliminado");

  const { count, error: errorCuenta } = await db
    .from("impulsos_tareas")
    .select("id", { count: "exact", head: true })
    .eq("impulso_id", impulsoId)
    .in("estado", ["enviada", "entregada", "fallida", "procesando"]);
  if (errorCuenta) return falloDeBase(c, errorCuenta, "No se pudo revisar el historial");

  if ((count ?? 0) > 0) {
    const { error } = await db
      .from("impulsos_lealtad")
      .update({ estado: "archivado", updated_at: new Date().toISOString() })
      .eq("id", impulsoId)
      .eq("rancho_id", c.ranchoId);
    if (error) return falloDeBase(c, error, "No se pudo archivar");
    return { ok: true, datos: { resultado: "archivado" } };
  }

  const { error } = await db.from("impulsos_lealtad").delete().eq("id", impulsoId).eq("rancho_id", c.ranchoId).eq("programa_id", c.programaId);
  if (error) return falloDeBase(c, error, "No se pudo eliminar");
  return { ok: true, datos: { resultado: "eliminado" } };
}

/** Crea un BORRADOR desde una de las plantillas. Nunca nace activo: el negocio lo lee, lo ajusta y recién ahí lo activa. */
export async function servicioCrearDesdePlantilla(
  db: Db,
  c: ContextoDelServicio,
  plantillaId: string,
): Promise<ResultadoDelServicio<{ id: string }>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();

  const plantilla = plantillaPorId(plantillaId);
  if (!plantilla) return fallo("plantilla_no_existe", "Esa plantilla no existe.");
  if (!plantilla.disponible) {
    return fallo("plantilla_no_disponible", motivoDePlantilla(plantilla, c.voz) ?? "Esa plantilla todavía no se puede usar.");
  }

  const { count } = await cuantosImpulsos(db, c.programaId);
  if ((count ?? 0) >= MAX_IMPULSOS_POR_TARJETA) return fallo("limite", mensajeDelTope("crear"));

  const entrada = normalizarEntrada(plantilla.entrada(info.modo));
  const { data, error } = await db
    .from("impulsos_lealtad")
    .insert({ ...entrada, plantilla: plantilla.id, rancho_id: c.ranchoId, programa_id: c.programaId, estado: "borrador", creado_por: c.actorId })
    .select("id")
    .single();
  if (error || !data) return falloDeBase(c, error, "No se pudo crear");
  return { ok: true, datos: { id: (data as { id: string }).id } };
}

/**
 * Reintento manual de un mensaje que falló. Vuelve a la cola como si fuera nuevo (el motor revalida todo
 * antes de mandarlo: consentimiento, vigencia, condiciones, tope diario). Un mensaje con «resultado
 * incierto» solo se reintenta si la persona confirma que entiende que podría llegarle dos veces.
 */
export async function servicioReintentar(
  db: Db,
  c: ContextoDelServicio,
  tareaId: string,
  confirmarRiesgo = false,
): Promise<ResultadoDelServicio<null>> {
  const info = await infoDeLaTarjeta(db, c);
  if (!info) return SIN_TARJETA();

  const { data, error } = await db
    .from("impulsos_tareas")
    .select("id, impulso_id, estado, motivo, rancho_id, programa_id")
    .eq("id", tareaId)
    .eq("rancho_id", c.ranchoId)
    .eq("programa_id", c.programaId)
    .maybeSingle();
  if (error) return falloDeBase(c, error, "No se pudo leer el mensaje");
  const t = data as { id: string; impulso_id: string; estado: string; motivo: string | null } | null;
  if (!t) return fallo("tarea_no_reintentable", "Ese mensaje no existe en esta tarjeta.");
  if (t.estado !== "fallida") return fallo("tarea_no_reintentable", "Solo se pueden reintentar los mensajes que fallaron.");
  if (!reintentoSeguro(t.motivo) && !confirmarRiesgo) {
    return fallo(
      "riesgo_de_duplicado",
      "No se sabe si ese mensaje salió. Si lo reintentás, el cliente podría recibirlo dos veces. Confirmá para reintentar igual.",
    );
  }

  const leido = await leerImpulso(db, c, t.impulso_id);
  if (!leido.ok) return leido;
  const imp = leido.impulso;
  if (!imp || imp.estado !== "activo") {
    return fallo("tarea_no_reintentable", "El impulso no está activo: activalo primero para reintentar sus mensajes.");
  }

  const ahora = new Date().toISOString();
  // Condicionado a `fallida`: dos clics (o dos personas) no lo encolan dos veces.
  const { data: tocadas, error: errorUpdate } = await db
    .from("impulsos_tareas")
    .update({
      estado: "programada",
      intentos: 0,
      ejecutar_en: ahora,
      proximo_intento_en: null,
      reclamada_en: null,
      envio_iniciado_en: null,
      motivo: null,
      detalle: null,
      updated_at: ahora,
    })
    .eq("id", tareaId)
    .eq("estado", "fallida")
    .select("id");
  if (errorUpdate) return falloDeBase(c, errorUpdate, "No se pudo reintentar");
  if (!tocadas || tocadas.length === 0) return fallo("tarea_no_reintentable", "Ese mensaje ya cambió de estado. Actualizá la pantalla.");
  return { ok: true, datos: null };
}
