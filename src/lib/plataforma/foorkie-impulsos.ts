import type { SupabaseClient } from "@supabase/supabase-js";
import { leerVinculo, uuidDe, ausente, type Lectura, type Vinculo } from "@/lib/plataforma/foorkie-caja";
import { localDeFoorkieDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";
import { construirCatalogo, type Catalogo } from "@/lib/lealtad/impulsos/catalogo-vista";
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
  type CodigoDeImpulsos,
  type ContextoDelServicio,
  type ProblemaDeCampo,
  type ResultadoDelServicio,
} from "@/lib/lealtad/impulsos/servicio";
import { ESTADOS_TAREA, type EstadoImpulso, type EstadoTarea } from "@/lib/lealtad/impulsos/tipos";
import type { CambioDeEstado, ImpulsoVista, PaginaDeHistorial, PlantillaVista } from "@/lib/lealtad/impulsos/vista";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS IMPULSOS AUTOMÁTICOS, DESDE FOORKIE
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (21 oct 2026): los impulsos automáticos de Bookea Lealtad («cuando pase X, esperá Y y
 * mandale Z a ese cliente») se manejan TODOS desde el panel de Foorkie. Bookea sigue siendo el motor: Foorkie
 * pide y manda por estas rutas firmadas (`/api/plataforma/foorkie/impulsos[/<accion>]`, la misma puerta de
 * `abrirLaCaja`) y las dos puertas —el panel de Bookea y esta— usan el MISMO servicio
 * (`@/lib/lealtad/impulsos/servicio`): ni una regla está escrita dos veces.
 *
 *   impulsos             lee: la tarjeta, sus impulsos (con conteo), las plantillas y el catálogo
 *   impulsos/historial   lee: los mensajes que salieron (o no) y por qué
 *   impulsos/guardar     crea (borrador) o edita un impulso
 *   impulsos/estado      activar, pausar, archivar o devolver a borrador
 *   impulsos/duplicar    una copia en borrador
 *   impulsos/eliminar    borra (o archiva, si ya mandó mensajes)
 *   impulsos/plantilla   un borrador desde una plantilla
 *   impulsos/reintentar  vuelve a la cola un mensaje que falló
 *
 * ── SOLO TARJETAS DE FOORKIE, Y EN SU VOZ ──────────────────────────
 * Con la marca `lealtad_por_foorkie` (`localDeFoorkieDeLaTarjeta`, la misma guardia de las reglas, los mensajes
 * y las ubicaciones). Orden de las comprobaciones: firma → vínculo con un local de Foorkie (`abrirLaCaja`) →
 * marca de Foorkie → el resto. Una tarjeta vinculada pero sin la marca (la de Pura Matcha) contesta
 * `no_es_de_foorkie` y NO se lee ni se escribe nada de sus impulsos.
 *
 * Todo texto que sale por acá va en la voz de Foorkie (`voz: "foorkie"`, ver `voz-foorkie.ts`): a un
 * restaurante de Foorkie nunca se le nombra a Bookea.
 *
 * ── QUIÉN ACTÚA ─────────────────────────────────────────────────────
 * El dueño del negocio (`vinculo.ownerId` de `abrirLaCaja`): queda en `creado_por` de lo que se crea. Quién de
 * su equipo toca los impulsos lo decide Foorkie.
 */

type Db = SupabaseClient;

/** Más que esto no pasa un impulso entero por `impulsos/guardar` (el cuerpo del mensaje solo ya llega a 2.000 caracteres). */
export const MAX_CUERPO_IMPULSO = 16_000;

export const MOTIVO_NO_ES_DE_FOORKIE =
  "Esta tarjeta no es de Foorkie Lealtad: sus impulsos automáticos no se manejan desde Foorkie.";

/** Un rechazo con su código, el motivo listo para mostrar y el status (la forma de `FalloDeReglas`). */
export type FalloDeImpulsos = {
  ok: false;
  codigo: CodigoDeImpulsos | "no_es_de_foorkie";
  motivo: string;
  status: number;
  problemas?: ProblemaDeCampo[];
};

/** Lo que dice la respuesta de un fallo (sin el `status`, que va en el encabezado). */
export function cuerpoDelFallo(f: FalloDeImpulsos): Record<string, unknown> {
  return { ok: false, codigo: f.codigo, motivo: f.motivo, ...(f.problemas ? { problemas: f.problemas } : {}) };
}

const STATUS: Record<CodigoDeImpulsos, number> = {
  sin_migracion: 503,
  sin_tarjeta: 404,
  sin_impulso: 404,
  validacion: 422,
  no_editable: 409,
  limite: 409,
  plantilla_no_disponible: 409,
  plantilla_no_existe: 404,
  estado_invalido: 409,
  riesgo_de_duplicado: 409,
  tarea_no_reintentable: 409,
  error_base: 500,
};

// ════════════════════════════════════════════════════════════════════
//  1. Lo que manda Foorkie
// ════════════════════════════════════════════════════════════════════

const ESTADOS_IMPULSO_PEDIDOS: readonly CambioDeEstado[] = ["activo", "pausado", "archivado", "borrador"];

/** `impulsos`: solo la tarjeta. */
export function leerPedidoImpulsos(d: Record<string, unknown>): Lectura<Vinculo> {
  return leerVinculo(d);
}

export type PedidoHistorialImpulsos = Vinculo & { estado: EstadoTarea | "todos"; impulsoId: string | null; pagina: number };

/** `impulsos/historial`: la tarjeta y los filtros (`estado`, `impulso_id`, `pagina`; todos opcionales). */
export function leerPedidoHistorialImpulsos(d: Record<string, unknown>): Lectura<PedidoHistorialImpulsos> {
  const v = leerVinculo(d);
  if (!v.ok) return v;

  let estado: EstadoTarea | "todos" = "todos";
  if (!ausente(d.estado)) {
    if (typeof d.estado !== "string" || (d.estado !== "todos" && !(ESTADOS_TAREA as readonly string[]).includes(d.estado))) {
      return { ok: false, motivo: `El estado del historial es «todos» o uno de: ${ESTADOS_TAREA.join(", ")}.` };
    }
    estado = d.estado as EstadoTarea | "todos";
  }

  let impulsoId: string | null = null;
  if (!ausente(d.impulso_id)) {
    impulsoId = uuidDe(d.impulso_id);
    if (!impulsoId) return { ok: false, motivo: "El impulso (impulso_id) no es válido." };
  }

  let pagina = 0;
  if (!ausente(d.pagina)) {
    if (typeof d.pagina !== "number" || !Number.isFinite(d.pagina)) return { ok: false, motivo: "La página tiene que ser un número (desde 0)." };
    pagina = Math.max(0, Math.min(10_000, Math.trunc(d.pagina)));
  }
  return { ok: true, valor: { ...v.valor, estado, impulsoId, pagina } };
}

export type PedidoGuardarImpulso = Vinculo & { impulsoId: string | null; impulso: unknown };

/** `impulsos/guardar`: la tarjeta, el `impulso_id` (null = uno nuevo) y el `impulso` crudo (se reconstruye campo por campo). */
export function leerPedidoGuardarImpulso(d: Record<string, unknown>): Lectura<PedidoGuardarImpulso> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  let impulsoId: string | null = null;
  if (!ausente(d.impulso_id)) {
    impulsoId = uuidDe(d.impulso_id);
    if (!impulsoId) return { ok: false, motivo: "El impulso (impulso_id) no es válido." };
  }
  if (!d.impulso || typeof d.impulso !== "object" || Array.isArray(d.impulso)) {
    return { ok: false, motivo: "Mandá el impulso (impulso) como un objeto." };
  }
  return { ok: true, valor: { ...v.valor, impulsoId, impulso: d.impulso } };
}

export type PedidoDeUnImpulso = Vinculo & { impulsoId: string };

/** `impulsos/duplicar` e `impulsos/eliminar`: la tarjeta y el `impulso_id`. */
export function leerPedidoDeUnImpulso(d: Record<string, unknown>): Lectura<PedidoDeUnImpulso> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const impulsoId = uuidDe(d.impulso_id);
  if (!impulsoId) return { ok: false, motivo: "Falta el impulso (impulso_id, un uuid)." };
  return { ok: true, valor: { ...v.valor, impulsoId } };
}

export type PedidoEstadoImpulso = PedidoDeUnImpulso & { estado: CambioDeEstado };

/** `impulsos/estado`: el impulso y el `estado` al que pasa. */
export function leerPedidoEstadoImpulso(d: Record<string, unknown>): Lectura<PedidoEstadoImpulso> {
  const u = leerPedidoDeUnImpulso(d);
  if (!u.ok) return u;
  if (typeof d.estado !== "string" || !(ESTADOS_IMPULSO_PEDIDOS as readonly string[]).includes(d.estado)) {
    return { ok: false, motivo: `El estado tiene que ser uno de: ${ESTADOS_IMPULSO_PEDIDOS.join(", ")}.` };
  }
  return { ok: true, valor: { ...u.valor, estado: d.estado as CambioDeEstado } };
}

export type PedidoPlantillaImpulso = Vinculo & { plantillaId: string };

/** `impulsos/plantilla`: la tarjeta y el `plantilla_id`. */
export function leerPedidoPlantillaImpulso(d: Record<string, unknown>): Lectura<PedidoPlantillaImpulso> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  if (typeof d.plantilla_id !== "string" || d.plantilla_id.trim() === "" || d.plantilla_id.length > 80) {
    return { ok: false, motivo: "Falta la plantilla (plantilla_id)." };
  }
  return { ok: true, valor: { ...v.valor, plantillaId: d.plantilla_id.trim() } };
}

export type PedidoReintentarImpulso = Vinculo & { tareaId: string; confirmarRiesgo: boolean };

/** `impulsos/reintentar`: el mensaje (`tarea_id`) y, si se sabe el riesgo, `confirmar_riesgo`. */
export function leerPedidoReintentarImpulso(d: Record<string, unknown>): Lectura<PedidoReintentarImpulso> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const tareaId = uuidDe(d.tarea_id);
  if (!tareaId) return { ok: false, motivo: "Falta el mensaje (tarea_id, un uuid)." };
  if (!ausente(d.confirmar_riesgo) && typeof d.confirmar_riesgo !== "boolean") {
    return { ok: false, motivo: "«confirmar_riesgo» tiene que ser true o false." };
  }
  return { ok: true, valor: { ...v.valor, tareaId, confirmarRiesgo: d.confirmar_riesgo === true } };
}

// ════════════════════════════════════════════════════════════════════
//  2. La guardia y el mapeo
// ════════════════════════════════════════════════════════════════════

const NO_ES_DE_FOORKIE: FalloDeImpulsos = { ok: false, codigo: "no_es_de_foorkie", motivo: MOTIVO_NO_ES_DE_FOORKIE, status: 403 };

function falloDelServicio(f: Extract<ResultadoDelServicio<unknown>, { ok: false }>): FalloDeImpulsos {
  return { ok: false, codigo: f.codigo, motivo: f.motivo, status: STATUS[f.codigo], ...(f.problemas ? { problemas: f.problemas } : {}) };
}

/**
 * La guardia de la marca y el servicio, en ese orden. Si algo lanza (la base no contesta en una lectura de
 * la tarjeta), es `error_base`: nunca un 500 crudo.
 */
async function correr<T>(
  db: Db,
  p: Vinculo,
  actorId: string,
  operacion: (contexto: ContextoDelServicio) => Promise<ResultadoDelServicio<T>>,
): Promise<{ ok: true; datos: T } | FalloDeImpulsos> {
  if ((await localDeFoorkieDeLaTarjeta(db, { programaId: p.programaId, ranchoId: p.ranchoId })) === null) return NO_ES_DE_FOORKIE;
  try {
    const r = await operacion({ ranchoId: p.ranchoId, programaId: p.programaId, actorId, voz: "foorkie" });
    return r.ok ? r : falloDelServicio(r);
  } catch (e) {
    console.warn("[foorkie] Los impulsos fallaron:", e instanceof Error ? e.message : e);
    return { ok: false, codigo: "error_base", motivo: "No pudimos completar la operación con los impulsos. Probá de nuevo.", status: 500 };
  }
}

// ════════════════════════════════════════════════════════════════════
//  3. Las operaciones
// ════════════════════════════════════════════════════════════════════

/** Lo que `impulsos` contesta: la forma de `DatosDeImpulsos` sin lo que en Foorkie no hace falta (`esFoorkie`, `correoConfigurado`). */
export type ImpulsosLeidos = {
  ok: true;
  contexto: {
    programaId: string;
    nombrePrograma: string;
    nombreNegocio: string;
    modo: string;
    zona: string;
    hoy: string;
    tieneRecompensa: boolean;
    recompensa: string | null;
    meta: number | null;
    tarjetaOpera: boolean;
  };
  impulsos: ImpulsoVista[];
  plantillas: PlantillaVista[];
  catalogo: Catalogo;
};

/** `impulsos`: lo que la pantalla de Foorkie necesita para dibujarse. Solo lee. */
export async function impulsosDeLaTarjeta(db: Db, p: Vinculo, actorId: string): Promise<ImpulsosLeidos | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioDatos(db, c));
  if (!r.ok) return r;
  const { info, impulsos, plantillas } = r.datos;
  return {
    ok: true,
    contexto: {
      programaId: info.programaId,
      nombrePrograma: info.nombrePrograma,
      nombreNegocio: info.nombreNegocio,
      modo: info.modo,
      zona: info.zona,
      hoy: hoyDe(info.zona),
      tieneRecompensa: info.meta !== null,
      recompensa: info.recompensa,
      meta: info.meta,
      tarjetaOpera: info.opera,
    },
    impulsos,
    plantillas,
    catalogo: construirCatalogo(info.modo, { nombreNegocio: info.nombreNegocio, nombrePrograma: info.nombrePrograma }, "foorkie"),
  };
}

/** `impulsos/historial`: los mensajes, de a 25. Solo lee. */
export async function historialDeLaTarjeta(
  db: Db,
  p: PedidoHistorialImpulsos,
  actorId: string,
): Promise<({ ok: true } & PaginaDeHistorial) | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioHistorial(db, c, { estado: p.estado, impulsoId: p.impulsoId, pagina: p.pagina }));
  return r.ok ? { ok: true, ...r.datos } : r;
}

/** `impulsos/guardar`: crea (borrador) o edita. */
export async function guardarImpulsoDeFoorkie(
  db: Db,
  p: PedidoGuardarImpulso,
  actorId: string,
): Promise<{ ok: true; id: string; avisos: string[] } | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioGuardar(db, c, p.impulsoId, p.impulso));
  return r.ok ? { ok: true, ...r.datos } : r;
}

/** `impulsos/estado`: activar (valida todo), pausar, archivar o devolver a borrador. */
export async function cambiarEstadoDeFoorkie(
  db: Db,
  p: PedidoEstadoImpulso,
  actorId: string,
): Promise<{ ok: true; estado: EstadoImpulso; avisos: string[] } | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioCambiarEstado(db, c, p.impulsoId, p.estado));
  return r.ok ? { ok: true, ...r.datos } : r;
}

/** `impulsos/duplicar`: una copia en borrador. */
export async function duplicarImpulsoDeFoorkie(db: Db, p: PedidoDeUnImpulso, actorId: string): Promise<{ ok: true; id: string } | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioDuplicar(db, c, p.impulsoId));
  return r.ok ? { ok: true, ...r.datos } : r;
}

/** `impulsos/eliminar`: borra, o archiva si ya mandó mensajes. */
export async function eliminarImpulsoDeFoorkie(
  db: Db,
  p: PedidoDeUnImpulso,
  actorId: string,
): Promise<{ ok: true; resultado: "eliminado" | "archivado" } | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioEliminar(db, c, p.impulsoId));
  return r.ok ? { ok: true, ...r.datos } : r;
}

/** `impulsos/plantilla`: un borrador desde una plantilla. */
export async function plantillaDeFoorkie(db: Db, p: PedidoPlantillaImpulso, actorId: string): Promise<{ ok: true; id: string } | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioCrearDesdePlantilla(db, c, p.plantillaId));
  return r.ok ? { ok: true, ...r.datos } : r;
}

/** `impulsos/reintentar`: vuelve a la cola un mensaje que falló. */
export async function reintentarDeFoorkie(db: Db, p: PedidoReintentarImpulso, actorId: string): Promise<{ ok: true } | FalloDeImpulsos> {
  const r = await correr(db, p, actorId, (c) => servicioReintentar(db, c, p.tareaId, p.confirmarRiesgo));
  return r.ok ? { ok: true } : r;
}
