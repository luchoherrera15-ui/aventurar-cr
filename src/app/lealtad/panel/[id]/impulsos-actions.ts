"use server";

import { revalidatePath } from "next/cache";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hoyDe,
  servicioCambiarEstado,
  servicioCrearDesdePlantilla,
  servicioDatos,
  servicioDuplicar,
  servicioEliminar,
  servicioGuardar,
  servicioHistorial,
  servicioReintentar,
  type ContextoDelServicio,
  type ResultadoDelServicio,
} from "@/lib/lealtad/impulsos/servicio";
import type { EstadoImpulso } from "@/lib/lealtad/impulsos/tipos";
import type {
  CambioDeEstado,
  DatosDeImpulsos,
  FiltrosHistorial,
  PaginaDeHistorial,
  ResultadoAccion,
} from "./impulsos-vista";

/**
 * ════════════════════════════════════════════════════════════════════
 *  IMPULSOS AUTOMÁTICOS — las acciones del panel de Bookea
 * ════════════════════════════════════════════════════════════════════
 *
 * Todo lo que el panel hace con un impulso pasa por acá, con la llave de servicio (las tablas de
 * impulsos no le dan escritura a nadie más) y ANTES de tocar nada se comprueba, sin saltarse ninguna:
 *
 *   1. Quién pregunta es dueño o admin DE ESTE NEGOCIO (un colaborador de mostrador no maneja los
 *      mensajes automáticos: es una decisión del dueño, igual que Marketing).
 *
 * Y de ahí en adelante manda el servicio (`@/lib/lealtad/impulsos/servicio`), que es el mismo que usan las
 * rutas firmadas de Foorkie y que comprueba por su cuenta lo que no depende de la puerta:
 *
 *   2. La tarjeta es de ese negocio. `programaId` llega del navegador y `programa_lealtad` es legible
 *      por anon: sin esto, un id ajeno dejaría programarle mensajes a otro negocio.
 *   3. El impulso (si viene uno) es de esa tarjeta y de ese negocio.
 *
 * La base lo vuelve a comprobar con un trigger (`impulsos_validar_programa`): dos capas.
 *
 * Este archivo solo agrega lo propio de una pantalla: el acceso con sesión, la llave de servicio y el
 * `revalidatePath` para que la pantalla se refresque. Qué NO hace: mandar mensajes. Eso lo hace el motor
 * (`correrImpulsos`), que corre desde `/api/lealtad/impulsos`.
 */

type Acceso = { ok: true; userId: string } | { ok: false; motivo: string };
type Servicio = { db: NonNullable<ReturnType<typeof createAdminClient>>; contexto: ContextoDelServicio };

async function acceso(ranchoId: string): Promise<Acceso> {
  const a = await verificarAccesoLealtad(ranchoId);
  if (!a.user) return { ok: false, motivo: "Iniciá sesión de nuevo." };
  if (!a.esDueno && !a.esAdmin) return { ok: false, motivo: "Los mensajes automáticos los maneja el dueño del negocio." };
  return { ok: true, userId: a.user.id };
}

function fallo(motivo: string): { ok: false; motivo: string } {
  return { ok: false, motivo };
}

/** El acceso, la base y el contexto del servicio, o el fallo con el motivo para la pantalla. */
async function prepararServicio(ranchoId: string, programaId: string): Promise<Servicio | { ok: false; motivo: string }> {
  const a = await acceso(ranchoId);
  if (!a.ok) return fallo(a.motivo);
  const db = createAdminClient();
  if (!db) return fallo("No hay conexión de servicio.");
  return { db, contexto: { ranchoId, programaId, actorId: a.userId } };
}

/** Del resultado del servicio al de la pantalla: sin el `codigo` (es para las rutas de Foorkie). */
function aResultadoDeAccion<T>(r: ResultadoDelServicio<T>): ResultadoAccion<T> {
  if (r.ok) return r;
  return { ok: false, motivo: r.motivo, ...(r.problemas ? { problemas: r.problemas } : {}) };
}

function refrescar(ranchoId: string) {
  revalidatePath(`/lealtad/panel/${ranchoId}`);
}

/** Corre una operación del servicio y, si salió bien, refresca la pantalla. */
async function escribir<T>(
  ranchoId: string,
  programaId: string,
  operacion: (s: Servicio) => Promise<ResultadoDelServicio<T>>,
): Promise<ResultadoAccion<T>> {
  const s = await prepararServicio(ranchoId, programaId);
  if (!("db" in s)) return s;
  const r = await operacion(s);
  if (r.ok) refrescar(ranchoId);
  return aResultadoDeAccion(r);
}

// ═══════════════════════════════════════════════════════════════════
//  LEER
// ═══════════════════════════════════════════════════════════════════

/** Todo lo que la pantalla necesita para dibujarse. */
export async function datosDeImpulsos(ranchoId: string, programaId: string): Promise<DatosDeImpulsos> {
  const s = await prepararServicio(ranchoId, programaId);
  if (!("db" in s)) return { disponible: false, motivo: s.motivo };

  const r = await servicioDatos(s.db, s.contexto);
  if (!r.ok) {
    return { disponible: false, motivo: r.motivo, ...(r.codigo === "sin_migracion" ? { migracionFalta: true } : {}) };
  }
  const { info, impulsos, plantillas } = r.datos;
  return {
    disponible: true,
    contexto: {
      programaId,
      nombrePrograma: info.nombrePrograma,
      nombreNegocio: info.nombreNegocio,
      modo: info.modo,
      zona: info.zona,
      hoy: hoyDe(info.zona),
      esFoorkie: info.esFoorkie,
      tieneRecompensa: info.meta !== null,
      recompensa: info.recompensa,
      meta: info.meta,
      correoConfigurado: Boolean(process.env.RESEND_API_KEY),
      tarjetaOpera: info.opera,
    },
    impulsos,
    plantillas,
  };
}

/** El historial de mensajes: qué se mandó, a quién, cuándo y qué pasó. De a 25, con filtros. */
export async function historialDeImpulsos(
  ranchoId: string,
  programaId: string,
  filtros: FiltrosHistorial = {},
): Promise<ResultadoAccion<PaginaDeHistorial>> {
  const s = await prepararServicio(ranchoId, programaId);
  if (!("db" in s)) return s;
  return aResultadoDeAccion(await servicioHistorial(s.db, s.contexto, filtros));
}

// ═══════════════════════════════════════════════════════════════════
//  ESCRIBIR
// ═══════════════════════════════════════════════════════════════════

/** Crea un impulso (borrador) o guarda los cambios de uno existente. */
export async function guardarImpulso(
  ranchoId: string,
  programaId: string,
  impulsoId: string | null,
  crudo: unknown,
): Promise<ResultadoAccion<{ id: string; avisos: string[] }>> {
  return escribir(ranchoId, programaId, (s) => servicioGuardar(s.db, s.contexto, impulsoId, crudo));
}

/** Activar, pausar, archivar o devolver a borrador. Activar vuelve a validar TODO. */
export async function cambiarEstadoImpulso(
  ranchoId: string,
  programaId: string,
  impulsoId: string,
  nuevo: CambioDeEstado,
): Promise<ResultadoAccion<{ estado: EstadoImpulso; avisos: string[] }>> {
  return escribir(ranchoId, programaId, (s) => servicioCambiarEstado(s.db, s.contexto, impulsoId, nuevo));
}

/** Una copia en borrador, para armar una variante sin tocar el original. */
export async function duplicarImpulso(ranchoId: string, programaId: string, impulsoId: string): Promise<ResultadoAccion<{ id: string }>> {
  return escribir(ranchoId, programaId, (s) => servicioDuplicar(s.db, s.contexto, impulsoId));
}

/**
 * Eliminar con protección: un impulso que ya mandó (o intentó mandar) mensajes NO se borra, se archiva —el
 * historial de lo que salió a clientes de verdad tiene que quedar—. Uno que nunca salió se borra del todo.
 */
export async function eliminarImpulso(
  ranchoId: string,
  programaId: string,
  impulsoId: string,
): Promise<ResultadoAccion<{ resultado: "eliminado" | "archivado" }>> {
  return escribir(ranchoId, programaId, (s) => servicioEliminar(s.db, s.contexto, impulsoId));
}

/** Crea un BORRADOR desde una de las plantillas. Nunca nace activo: el negocio lo lee, lo ajusta y recién ahí lo activa. */
export async function crearDesdePlantilla(ranchoId: string, programaId: string, plantillaId: string): Promise<ResultadoAccion<{ id: string }>> {
  return escribir(ranchoId, programaId, (s) => servicioCrearDesdePlantilla(s.db, s.contexto, plantillaId));
}

/**
 * Reintento manual de un mensaje que falló. Vuelve a la cola como si fuera nuevo (el motor revalida todo
 * antes de mandarlo: consentimiento, vigencia, condiciones, tope diario). Un mensaje con «resultado
 * incierto» solo se reintenta si la persona confirma que entiende que podría llegarle dos veces.
 */
export async function reintentarMensaje(
  ranchoId: string,
  programaId: string,
  tareaId: string,
  confirmarRiesgo = false,
): Promise<ResultadoAccion> {
  return escribir(ranchoId, programaId, (s) => servicioReintentar(s.db, s.contexto, tareaId, confirmarRiesgo));
}
