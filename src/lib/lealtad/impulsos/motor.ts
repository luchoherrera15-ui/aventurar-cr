import {
  definicionDeActivador,
  definicionDeCanal,
  ESPERA_REINTENTO_MIN,
  MAX_INTENTOS,
  TOLERANCIA_RETRASO_HORAS,
  TOPE_DIARIO_POR_CLIENTE,
} from "./catalogo";
import { evaluarCondiciones } from "./condiciones";
import { claveDeInactividad, claveDeTarea, dispara, type SnapshotDelEvento } from "./eventos";
import { vistaPrevia } from "./mensaje";
import { calcularEjecucion, dentroDelHorario, esperaDeReintento, instanteEnHorario } from "./programacion";
import type { ContextoCliente, EventoImpulso, Impulso, InfoPrograma, Tarea } from "./tipos";
import { partesLocales } from "./zona-horaria";

/**
 * EL MOTOR DE LOS IMPULSOS AUTOMÁTICOS.
 *
 * Tres pasos, siempre en este orden, cada vez que corre (cada ~5 minutos):
 *
 *   1. MATERIALIZAR  convierte los hechos que anotaron los triggers («se inscribió», «sumó un sello»)
 *                    en tareas programadas, una por cada impulso activo al que ese hecho le toca.
 *   2. ESCANEAR      busca lo que ningún hecho avisa porque es una ausencia (clientes que dejaron de
 *                    venir) y también lo vuelve tarea.
 *   3. PROCESAR      toma las tareas cuya hora ya llegó, vuelve a comprobar que el mensaje todavía
 *                    tiene sentido, lo arma y lo manda por su canal.
 *
 * ── LAS GARANTÍAS, Y DÓNDE VIVE CADA UNA ────────────────────────────
 *   Sin duplicados      una tarea es «este impulso por este hecho»: la base tiene un índice único sobre
 *                       (impulso, clave), así que crearla dos veces es imposible, no solo improbable.
 *   Sin carreras        las tareas se TOMAN con `FOR UPDATE SKIP LOCKED` (la función `reclamarTareas`):
 *                       dos corridas a la vez se reparten las tareas, nunca se las pisan.
 *   Sin enviar a ciegas «enviada» se escribe DESPUÉS de que el proveedor aceptó. Si el proceso muere
 *                       mitad de camino, la tarea no se reenvía sola: queda `fallida/resultado_incierto`
 *                       para que una persona decida. Un mensaje perdido es mejor que uno doble.
 *   Sin mensajes viejos entre que se programa y que sale, el cliente pudo volver, canjear o dejar de ser
 *                       cliente. Todo se vuelve a mirar JUSTO antes de mandar.
 *   Aislado por negocio cada tarea lleva su negocio y su tarjeta, y el motor descarta lo que no cuadra.
 *
 * El motor no sabe de Supabase ni de Resend: habla con un `RepoImpulsos` y unos `CanalesDeEnvio` que se le
 * pasan. Por eso se puede probar entero, con todos sus casos raros, sin base de datos ni proveedores.
 */

// ═══════════════════════════════════════════════════════════════════
//  LO QUE EL MOTOR NECESITA DEL MUNDO
// ═══════════════════════════════════════════════════════════════════

export type NuevaTarea = {
  impulso_id: string;
  rancho_id: string;
  programa_id: string;
  miembro_id: string;
  evento_id: string | null;
  clave: string;
  canal: string;
  ejecutar_en: string;
  estado: "programada" | "omitida";
  motivo?: string | null;
  detalle?: string | null;
  version_impulso: number;
};

export type CambiosTarea = Partial<
  Pick<
    Tarea,
    | "estado"
    | "motivo"
    | "detalle"
    | "mensaje_titulo"
    | "mensaje_cuerpo"
    | "enviada_en"
    | "proximo_intento_en"
    | "ejecutar_en"
    | "intentos"
    | "reclamada_en"
    | "envio_iniciado_en"
    | "version_impulso"
  >
>;

export type ClienteCargado = {
  /** false = el cliente se dio de baja o se pausó. */
  miembroActivo: boolean;
  ctx: ContextoCliente;
};

export interface RepoImpulsos {
  eventosPendientes(limite: number): Promise<EventoImpulso[]>;
  /** Cierra el hecho. Con `error`, suma un intento; pasados 5 intentos se da por perdido. */
  cerrarEvento(id: string, resultado?: { error?: string }): Promise<void>;

  impulsosActivos(programaId: string): Promise<Impulso[]>;
  impulsoPorId(id: string): Promise<Impulso | null>;
  /** Impulsos activos por tiempo cuyo último escaneo fue hace más de una hora (o nunca). */
  impulsosParaEscanear(ahora: Date): Promise<Impulso[]>;
  marcarEscaneo(id: string, ahora: Date): Promise<void>;

  infoPrograma(programaId: string): Promise<InfoPrograma | null>;
  contextoCliente(miembroId: string, info: InfoPrograma, ahora: Date): Promise<ClienteCargado | null>;
  /** Visitas reales (sin el sello de regalo) hasta un instante, ya contando ese. */
  visitasHasta(miembroId: string, hasta: Date): Promise<number>;
  inactivos(
    programaId: string,
    hoy: string,
    zona: string,
    diasMin: number,
    diasMax: number,
    limite: number,
  ): Promise<{ miembroId: string; ultima: string }[]>;

  crearTarea(t: NuevaTarea): Promise<"creada" | "duplicada">;
  reclamarTareas(limite: number, ahora: Date): Promise<Tarea[]>;
  actualizarTarea(id: string, cambios: CambiosTarea): Promise<void>;
  /** Mensajes ya enviados a este cliente desde `desde` (de todos los impulsos). */
  enviosDelCliente(miembroId: string, desde: Date): Promise<{ impulso_id: string; enviada_en: string }[]>;
}

export type EntradaDeEnvio = {
  tarea: Tarea;
  impulso: Impulso;
  info: InfoPrograma;
  ctx: ContextoCliente;
  /** Ya con las variables puestas y acortado para el canal. */
  titulo: string;
  cuerpo: string;
  /** Hay que llamarlo JUSTO antes de hablar con el proveedor (marca el punto sin retorno). */
  marcarInicio(): Promise<void>;
};

export type ResultadoDeEnvio =
  | { tipo: "enviado"; detalle: string }
  | { tipo: "omitido"; motivo: string; detalle: string }
  | { tipo: "fallo"; motivo: string; detalle: string; permanente: boolean };

export interface CanalesDeEnvio {
  wallet(e: EntradaDeEnvio): Promise<ResultadoDeEnvio>;
  correo(e: EntradaDeEnvio): Promise<ResultadoDeEnvio>;
}

// ═══════════════════════════════════════════════════════════════════
//  RESULTADO DE UNA CORRIDA
// ═══════════════════════════════════════════════════════════════════

export type ResumenCorrida = {
  eventos: number;
  tareasCreadas: number;
  tareasDuplicadas: number;
  escaneados: number;
  procesadas: number;
  enviadas: number;
  omitidas: number;
  fallidas: number;
  reintentos: number;
  reprogramadas: number;
  canceladas: number;
  errores: string[];
};

export function resumenVacio(): ResumenCorrida {
  return {
    eventos: 0,
    tareasCreadas: 0,
    tareasDuplicadas: 0,
    escaneados: 0,
    procesadas: 0,
    enviadas: 0,
    omitidas: 0,
    fallidas: 0,
    reintentos: 0,
    reprogramadas: 0,
    canceladas: 0,
    errores: [],
  };
}

export type OpcionesDeCorrida = {
  /** Instante fijo (pruebas). Por omisión, el reloj real, leído de nuevo en cada paso. */
  ahora?: Date;
  /** Reloj en milisegundos para el presupuesto de tiempo. */
  reloj?: () => number;
  limiteEventos?: number;
  limiteInactivos?: number;
  /** Tiempo máximo que la corrida sigue tomando tareas nuevas. */
  presupuestoMs?: number;
  /** Tareas que se toman de una vez. */
  tamanoLote?: number;
  /** Clientes distintos que se atienden en paralelo. */
  paralelismo?: number;
};

const HORA_MS = 3_600_000;
/** Cuántas veces se reintenta procesar un hecho que dio error antes de darlo por perdido. */
export const MAX_INTENTOS_DE_EVENTO = 5;

/** Un error dicho sin datos personales y sin volcar objetos enormes en un log. */
export function mensajeSeguro(e: unknown): string {
  const texto = e instanceof Error ? e.message : typeof e === "string" ? e : "error desconocido";
  return texto.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo]").slice(0, 300);
}

// ═══════════════════════════════════════════════════════════════════
//  LA CORRIDA
// ═══════════════════════════════════════════════════════════════════

class CacheDeCorrida {
  private infos = new Map<string, Promise<InfoPrograma | null>>();
  private activos = new Map<string, Promise<Impulso[]>>();
  constructor(private repo: RepoImpulsos) {}
  info(programaId: string) {
    let p = this.infos.get(programaId);
    if (!p) this.infos.set(programaId, (p = this.repo.infoPrograma(programaId)));
    return p;
  }
  impulsos(programaId: string) {
    let p = this.activos.get(programaId);
    if (!p) this.activos.set(programaId, (p = this.repo.impulsosActivos(programaId)));
    return p;
  }
}

type Entorno = {
  repo: RepoImpulsos;
  canales: CanalesDeEnvio;
  cache: CacheDeCorrida;
  resumen: ResumenCorrida;
  ahora: () => Date;
};

export async function correrImpulsos(
  repo: RepoImpulsos,
  canales: CanalesDeEnvio,
  opciones: OpcionesDeCorrida = {},
): Promise<ResumenCorrida> {
  const fijo = opciones.ahora;
  const entorno: Entorno = {
    repo,
    canales,
    cache: new CacheDeCorrida(repo),
    resumen: resumenVacio(),
    ahora: () => fijo ?? new Date(),
  };
  const reloj = opciones.reloj ?? Date.now;
  const inicio = reloj();

  // Cada paso es independiente: que uno falle no deja sin procesar los otros.
  const pasos: [string, () => Promise<void>][] = [
    ["materializar", () => materializarEventos(entorno, opciones.limiteEventos ?? 200)],
    ["escanear", () => escanearPorTiempo(entorno, opciones.limiteInactivos ?? 200)],
    [
      "procesar",
      () =>
        procesarTareas(entorno, {
          reloj,
          inicio,
          presupuestoMs: opciones.presupuestoMs ?? 45_000,
          tamanoLote: opciones.tamanoLote ?? 10,
          paralelismo: opciones.paralelismo ?? 4,
        }),
    ],
  ];
  for (const [nombre, paso] of pasos) {
    try {
      await paso();
    } catch (e) {
      entorno.resumen.errores.push(`${nombre}: ${mensajeSeguro(e)}`);
    }
  }
  return entorno.resumen;
}

// ═══════════════════════════════════════════════════════════════════
//  1. MATERIALIZAR: de hechos a tareas
// ═══════════════════════════════════════════════════════════════════

async function materializarEventos(e: Entorno, limite: number): Promise<void> {
  const eventos = await e.repo.eventosPendientes(limite);
  for (const ev of eventos) {
    e.resumen.eventos++;
    try {
      const info = await e.cache.info(ev.programa_id);
      // Un hecho de una tarjeta que ya no existe, o de otro negocio: se cierra, no se procesa.
      if (!info || info.ranchoId !== ev.rancho_id) {
        await e.repo.cerrarEvento(ev.id);
        continue;
      }
      const candidatos = (await e.cache.impulsos(ev.programa_id)).filter(
        (i) => i.rancho_id === ev.rancho_id && definicionDeActivador(i.activador)?.fuente === "evento",
      );
      if (candidatos.length > 0) {
        const necesitaVisitas = ev.tipo === "ledger_ganado" && candidatos.some((i) => i.activador === "primera_visita");
        const snap: SnapshotDelEvento = {
          modo: info.modo,
          meta: info.meta,
          visitasHastaElHecho: necesitaVisitas ? await e.repo.visitasHasta(ev.miembro_id, new Date(ev.ocurrido_en)) : 0,
        };
        for (const imp of candidatos) {
          if (!dispara(imp, ev, snap)) continue;
          await programarTarea(e, imp, info, {
            miembroId: ev.miembro_id,
            eventoId: ev.id,
            clave: claveDeTarea(ev),
            ocurridoEn: new Date(ev.ocurrido_en),
            registrarOmitidas: true,
          });
        }
      }
      await e.repo.cerrarEvento(ev.id);
    } catch (err) {
      e.resumen.errores.push(`evento: ${mensajeSeguro(err)}`);
      await e.repo.cerrarEvento(ev.id, { error: mensajeSeguro(err) }).catch(() => undefined);
    }
  }
}

type DatosDeProgramacion = {
  miembroId: string;
  eventoId: string | null;
  clave: string;
  ocurridoEn: Date;
  /** Dejar constancia (como omitida) de lo que no se pudo programar, en vez de callarlo. */
  registrarOmitidas: boolean;
};

async function programarTarea(e: Entorno, imp: Impulso, info: InfoPrograma, d: DatosDeProgramacion): Promise<void> {
  const r = calcularEjecucion({
    ocurridoEn: d.ocurridoEn,
    retrasoMinutos: imp.retraso_minutos,
    horario: imp.horario,
    zona: info.zona,
    vigenteDesde: imp.vigente_desde,
    vigenteHasta: imp.vigente_hasta,
  });
  const base = {
    impulso_id: imp.id,
    rancho_id: imp.rancho_id,
    programa_id: imp.programa_id,
    miembro_id: d.miembroId,
    evento_id: d.eventoId,
    clave: d.clave,
    canal: imp.canal,
    version_impulso: imp.version,
  };
  if (!r.ok) {
    // Lo que pasó antes de que arrancara la campaña no es una omisión: no era para ese impulso.
    if (r.motivo === "antes_de_vigencia" || !d.registrarOmitidas) return;
    const res = await e.repo.crearTarea({
      ...base,
      ejecutar_en: e.ahora().toISOString(),
      estado: "omitida",
      motivo: r.motivo === "horario_invalido" ? "error_interno" : r.motivo,
      detalle: null,
    });
    if (res === "creada") e.resumen.omitidas++;
    return;
  }
  const res = await e.repo.crearTarea({ ...base, ejecutar_en: r.ejecutarEn.toISOString(), estado: "programada" });
  if (res === "creada") e.resumen.tareasCreadas++;
  else e.resumen.tareasDuplicadas++;
}

// ═══════════════════════════════════════════════════════════════════
//  2. ESCANEAR: las ausencias
// ═══════════════════════════════════════════════════════════════════

async function escanearPorTiempo(e: Entorno, limite: number): Promise<void> {
  const ahora = e.ahora();
  const pendientes = await e.repo.impulsosParaEscanear(ahora);
  for (const imp of pendientes) {
    // Hoy el único activador por tiempo que se puede cumplir con datos reales es la inactividad.
    if (imp.activador !== "inactividad") continue;
    try {
      const info = await e.cache.info(imp.programa_id);
      if (info && info.ranchoId === imp.rancho_id && info.opera) {
        const dias = imp.activador_config.dias ?? 30;
        const ventana = imp.activador_config.ventana_dias ?? 30;
        const hoy = partesLocales(ahora, info.zona).fecha;
        const lista = await e.repo.inactivos(imp.programa_id, hoy, info.zona, dias, dias + ventana, limite);
        for (const item of lista) {
          e.resumen.escaneados++;
          await programarTarea(e, imp, info, {
            miembroId: item.miembroId,
            eventoId: null,
            clave: claveDeInactividad(item.miembroId, item.ultima),
            ocurridoEn: ahora,
            registrarOmitidas: false,
          });
        }
      }
      await e.repo.marcarEscaneo(imp.id, ahora);
    } catch (err) {
      e.resumen.errores.push(`escaneo: ${mensajeSeguro(err)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  3. PROCESAR: de tareas a mensajes
// ═══════════════════════════════════════════════════════════════════

type Presupuesto = {
  reloj: () => number;
  inicio: number;
  presupuestoMs: number;
  tamanoLote: number;
  paralelismo: number;
};

async function procesarTareas(e: Entorno, p: Presupuesto): Promise<void> {
  while (p.reloj() - p.inicio < p.presupuestoMs) {
    const lote = await e.repo.reclamarTareas(p.tamanoLote, e.ahora());
    if (lote.length === 0) return;

    // Las tareas de un mismo cliente van una tras otra (el tope diario y la espera mínima dependen de
    // lo que ya se le mandó); clientes distintos, en paralelo.
    const carriles = new Map<string, Tarea[]>();
    for (const t of lote) carriles.set(t.miembro_id, [...(carriles.get(t.miembro_id) ?? []), t]);
    const filas = [...carriles.values()];
    let siguiente = 0;
    const trabajadores = Array.from({ length: Math.min(p.paralelismo, filas.length) }, async () => {
      while (siguiente < filas.length) {
        const carril = filas[siguiente++];
        for (const t of carril) await ejecutarSeguro(e, t);
      }
    });
    await Promise.all(trabajadores);

    if (lote.length < p.tamanoLote) return;
  }
}

async function ejecutarSeguro(e: Entorno, t: Tarea): Promise<void> {
  e.resumen.procesadas++;
  try {
    await ejecutarTarea(e, t);
  } catch (err) {
    // Algo inesperado ANTES de llegar al proveedor: se reintenta como cualquier fallo transitorio.
    e.resumen.errores.push(`tarea: ${mensajeSeguro(err)}`);
    await cerrarConFallo(e, t, { motivo: "error_interno", detalle: mensajeSeguro(err), permanente: false }).catch(() => undefined);
  }
}

/** Para los activadores que dependen de un número exacto: ¿lo que los disparó sigue siendo cierto? */
export function sigueVigente(imp: Pick<Impulso, "activador" | "activador_config">, c: ContextoCliente): boolean {
  switch (imp.activador) {
    case "inactividad":
      return c.diasSinActividad !== null && c.diasSinActividad >= (imp.activador_config.dias ?? 30);
    case "meta_proxima":
      return c.meta !== null && c.meta - c.saldo === (imp.activador_config.faltan ?? 1);
    case "recompensa_alcanzada":
      return c.meta !== null && c.saldo >= c.meta;
    default:
      return true;
  }
}

async function ejecutarTarea(e: Entorno, t: Tarea): Promise<void> {
  const ahora = e.ahora();
  const omitir = (motivo: string, detalle: string | null = null) => cerrarOmitida(e, t, motivo, detalle);

  const imp = await e.repo.impulsoPorId(t.impulso_id);
  if (!imp) return cerrarCancelada(e, t, "impulso_eliminado");
  // Defensa de aislamiento: una tarea solo se cumple con el impulso, el negocio y la tarjeta que dice.
  if (imp.rancho_id !== t.rancho_id || imp.programa_id !== t.programa_id) {
    return cerrarConFallo(e, t, { motivo: "error_interno", detalle: "La tarea no cuadra con su impulso.", permanente: true });
  }
  if (imp.estado !== "activo") return cerrarCancelada(e, t, "impulso_pausado");

  const info = await e.cache.info(t.programa_id);
  if (!info || info.ranchoId !== t.rancho_id || !info.opera) return omitir("tarjeta_inactiva");

  if (ahora.getTime() - Date.parse(t.ejecutar_en) > TOLERANCIA_RETRASO_HORAS * HORA_MS) return omitir("vencida");

  if (imp.vigente_hasta && partesLocales(ahora, info.zona).fecha > imp.vigente_hasta) return omitir("fuera_de_vigencia");

  // Si la corrida se atrasó y ya cayó fuera de la ventana, se corre a la próxima (o se omite).
  if (!dentroDelHorario(ahora, imp.horario, info.zona)) {
    const siguiente = instanteEnHorario(ahora, imp.horario, info.zona);
    if (!siguiente) return omitir("fuera_de_horario");
    if (imp.vigente_hasta && partesLocales(siguiente, info.zona).fecha > imp.vigente_hasta) return omitir("fuera_de_vigencia");
    e.resumen.reprogramadas++;
    return e.repo.actualizarTarea(t.id, {
      estado: "programada",
      ejecutar_en: siguiente.toISOString(),
      reclamada_en: null,
      intentos: Math.max(0, t.intentos - 1),
    });
  }

  const cargado = await e.repo.contextoCliente(t.miembro_id, info, ahora);
  if (!cargado || !cargado.miembroActivo) return omitir("miembro_inactivo");
  const ctx = cargado.ctx;

  if (!sigueVigente(imp, ctx)) return omitir("ya_no_aplica");
  const cond = evaluarCondiciones(imp.condiciones, ctx);
  if (!cond.cumple) return omitir("condiciones_no_cumplidas", cond.motivo);

  // Cuántos mensajes de impulsos recibió ya este cliente, de todos los impulsos y de este.
  const horasMirando = Math.max(24, imp.espera_minima_horas);
  const envios = await e.repo.enviosDelCliente(t.miembro_id, new Date(ahora.getTime() - horasMirando * HORA_MS));
  const hace = (horas: number) => ahora.getTime() - horas * HORA_MS;
  if (
    imp.espera_minima_horas > 0 &&
    envios.some((x) => x.impulso_id === imp.id && Date.parse(x.enviada_en) > hace(imp.espera_minima_horas))
  ) {
    return omitir("espera_minima");
  }
  if (envios.filter((x) => Date.parse(x.enviada_en) > hace(24)).length >= TOPE_DIARIO_POR_CLIENTE) {
    return omitir("tope_diario_cliente");
  }

  const canal = definicionDeCanal(imp.canal);
  if (!canal || !canal.disponible) {
    return cerrarConFallo(e, t, { motivo: "error_interno", detalle: "El canal del impulso no está disponible.", permanente: true });
  }
  const mensaje = vistaPrevia({ titulo: imp.titulo, cuerpo: imp.cuerpo }, canal, ctx);
  if (mensaje.faltantes.length > 0) return omitir("variable_faltante", `Faltó: ${mensaje.faltantes.join(", ")}`);
  if (mensaje.cuerpo.trim() === "") return omitir("variable_faltante", "El mensaje quedó vacío.");

  // true desde que quedó anotado el punto sin retorno: a partir de ahí no se sabe si el mensaje salió.
  let iniciado = false;
  const entrada: EntradaDeEnvio = {
    tarea: t,
    impulso: imp,
    info,
    ctx,
    titulo: mensaje.titulo,
    cuerpo: mensaje.cuerpo,
    marcarInicio: async () => {
      await e.repo.actualizarTarea(t.id, { envio_iniciado_en: ahora.toISOString() });
      iniciado = true;
    },
  };

  let resultado: ResultadoDeEnvio;
  try {
    resultado = imp.canal === "wallet" ? await e.canales.wallet(entrada) : await e.canales.correo(entrada);
  } catch (err) {
    // Una excepción ANTES del punto sin retorno es un fallo común y se reintenta. Una DESPUÉS no dice si el
    // mensaje salió: reintentarla podría duplicarlo, así que queda para que una persona decida.
    resultado = iniciado
      ? { tipo: "fallo", motivo: "resultado_incierto", detalle: mensajeSeguro(err), permanente: true }
      : { tipo: "fallo", motivo: "error_interno", detalle: mensajeSeguro(err), permanente: false };
  }

  if (resultado.tipo === "enviado") {
    e.resumen.enviadas++;
    return e.repo.actualizarTarea(t.id, {
      estado: "enviada",
      enviada_en: e.ahora().toISOString(),
      motivo: null,
      detalle: resultado.detalle.slice(0, 400),
      mensaje_titulo: mensaje.titulo,
      mensaje_cuerpo: mensaje.cuerpo,
      version_impulso: imp.version,
    });
  }
  if (resultado.tipo === "omitido") return omitir(resultado.motivo, resultado.detalle);
  return cerrarConFallo(e, t, resultado);
}

// ── cómo se cierra cada tarea ──────────────────────────────────────

async function cerrarOmitida(e: Entorno, t: Tarea, motivo: string, detalle: string | null): Promise<void> {
  e.resumen.omitidas++;
  await e.repo.actualizarTarea(t.id, { estado: "omitida", motivo, detalle: detalle?.slice(0, 400) ?? null });
}

async function cerrarCancelada(e: Entorno, t: Tarea, motivo: string): Promise<void> {
  e.resumen.canceladas++;
  await e.repo.actualizarTarea(t.id, { estado: "cancelada", motivo });
}

async function cerrarConFallo(
  e: Entorno,
  t: Tarea,
  f: { motivo: string; detalle: string; permanente: boolean },
): Promise<void> {
  const detalle = f.detalle.slice(0, 400);
  if (f.permanente || t.intentos >= MAX_INTENTOS) {
    e.resumen.fallidas++;
    await e.repo.actualizarTarea(t.id, { estado: "fallida", motivo: f.motivo, detalle });
    return;
  }
  e.resumen.reintentos++;
  const espera = esperaDeReintento(t.intentos, ESPERA_REINTENTO_MIN);
  await e.repo.actualizarTarea(t.id, {
    estado: "pendiente",
    motivo: f.motivo,
    detalle,
    proximo_intento_en: new Date(e.ahora().getTime() + espera * 60_000).toISOString(),
    // El proveedor contestó que no: ese intento no mandó nada, así que el próximo empieza limpio.
    envio_iniciado_en: null,
    reclamada_en: null,
  });
}
