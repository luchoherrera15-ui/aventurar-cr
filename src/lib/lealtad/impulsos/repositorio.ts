import type { SupabaseClient } from "@supabase/supabase-js";
import { minutoISOCR, TZ_CR } from "@/lib/fechas";
import { identidadesDeMiembros } from "@/lib/lealtad/identidades-db";
import { operaAhora } from "@/lib/lealtad/programas";
import { localDeFoorkieDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";
import { ACTIVADORES } from "./catalogo";
import { armarContextoCliente, resumirLedger, type FilaLedger } from "./contexto";
import { MAX_INTENTOS_DE_EVENTO, type CambiosTarea, type ClienteCargado, type NuevaTarea, type RepoImpulsos } from "./motor";
import type { EventoImpulso, Impulso, InfoPrograma, Tarea } from "./tipos";
import { zonaValida } from "./zona-horaria";

/**
 * EL REPOSITORIO DE LOS IMPULSOS CONTRA SUPABASE.
 *
 * Corre con la llave de servicio (las tablas de impulsos no le dan escritura a nadie más), así que
 * TODA decisión de «a quién le toca» se toma en el motor, que comprueba en cada paso que el negocio, la
 * tarjeta y el cliente cuadren. Acá no se decide nada: se lee y se escribe.
 *
 * Una consulta que falla LANZA (con un mensaje sin datos personales): un error callado acá se
 * convertiría en «no había nada que mandar», y eso es justo lo que no puede pasar.
 */

type Db = SupabaseClient;

const ACTIVADORES_POR_TIEMPO = ACTIVADORES.filter((a) => a.disponible && a.fuente === "tiempo").map((a) => a.id);
const MINUTOS_ENTRE_ESCANEOS = 55;

function fallo(donde: string, error: { message: string }): never {
  throw new Error(`${donde}: ${error.message}`);
}

export function crearRepoSupabase(db: Db): RepoImpulsos {
  return {
    async eventosPendientes(limite) {
      const { data, error } = await db
        .from("impulsos_eventos")
        .select("id, rancho_id, programa_id, miembro_id, tipo, clave, ocurrido_en, datos, intentos")
        .is("procesado_en", null)
        .order("created_at", { ascending: true })
        .limit(limite);
      if (error) fallo("eventos", error);
      return (data ?? []) as unknown as EventoImpulso[];
    },

    async cerrarEvento(id, resultado) {
      const ahora = new Date().toISOString();
      if (!resultado?.error) {
        const { error } = await db.from("impulsos_eventos").update({ procesado_en: ahora }).eq("id", id);
        if (error) fallo("cerrar evento", error);
        return;
      }
      const { data } = await db.from("impulsos_eventos").select("intentos").eq("id", id).maybeSingle();
      const intentos = (Number((data as { intentos?: unknown } | null)?.intentos) || 0) + 1;
      const { error } = await db
        .from("impulsos_eventos")
        .update({
          intentos,
          error: resultado.error.slice(0, 300),
          // Pasados varios intentos se da por perdido: un hecho roto no puede atascar la cola para siempre.
          ...(intentos >= MAX_INTENTOS_DE_EVENTO ? { procesado_en: ahora } : {}),
        })
        .eq("id", id);
      if (error) fallo("registrar error del evento", error);
    },

    async impulsosActivos(programaId) {
      const { data, error } = await db.from("impulsos_lealtad").select("*").eq("programa_id", programaId).eq("estado", "activo");
      if (error) fallo("impulsos activos", error);
      return (data ?? []) as unknown as Impulso[];
    },

    async impulsoPorId(id) {
      const { data, error } = await db.from("impulsos_lealtad").select("*").eq("id", id).maybeSingle();
      if (error) fallo("impulso", error);
      return (data ?? null) as unknown as Impulso | null;
    },

    async impulsosParaEscanear(ahora) {
      if (ACTIVADORES_POR_TIEMPO.length === 0) return [];
      const limite = new Date(ahora.getTime() - MINUTOS_ENTRE_ESCANEOS * 60_000).toISOString();
      const { data, error } = await db
        .from("impulsos_lealtad")
        .select("*")
        .eq("estado", "activo")
        .in("activador", ACTIVADORES_POR_TIEMPO)
        .or(`ultimo_escaneo_en.is.null,ultimo_escaneo_en.lt.${limite}`);
      if (error) fallo("impulsos por escanear", error);
      return (data ?? []) as unknown as Impulso[];
    },

    async marcarEscaneo(id, ahora) {
      const { error } = await db.from("impulsos_lealtad").update({ ultimo_escaneo_en: ahora.toISOString() }).eq("id", id);
      if (error) fallo("marcar escaneo", error);
    },

    async infoPrograma(programaId) {
      return leerInfoPrograma(db, programaId);
    },

    async contextoCliente(miembroId, info, ahora) {
      return leerContextoCliente(db, miembroId, info, ahora);
    },

    async visitasHasta(miembroId, hasta) {
      const { data, error } = await db
        .from("transacciones_puntos")
        .select("id, tipo, puntos, referencia, created_at, reversion_de")
        .eq("miembro_id", miembroId)
        .lte("created_at", hasta.toISOString())
        .limit(5000);
      if (error) fallo("visitas", error);
      return resumirLedger((data ?? []) as unknown as FilaLedger[], TZ_CR).visitas;
    },

    async inactivos(programaId, hoy, zona, diasMin, diasMax, limite) {
      const { data, error } = await db.rpc("impulsos_inactivos", {
        p_programa: programaId,
        p_hoy: hoy,
        p_zona: zona,
        p_dias_min: diasMin,
        p_dias_max: diasMax,
        p_limite: limite,
      });
      if (error) fallo("inactivos", error);
      return ((data ?? []) as { miembro_id: string; ultima_actividad: string }[]).map((r) => ({
        miembroId: r.miembro_id,
        ultima: String(r.ultima_actividad).slice(0, 10),
      }));
    },

    async crearTarea(t: NuevaTarea) {
      const { error } = await db.from("impulsos_tareas").insert({
        impulso_id: t.impulso_id,
        rancho_id: t.rancho_id,
        programa_id: t.programa_id,
        miembro_id: t.miembro_id,
        evento_id: t.evento_id,
        clave: t.clave,
        canal: t.canal,
        ejecutar_en: t.ejecutar_en,
        estado: t.estado,
        motivo: t.motivo ?? null,
        detalle: t.detalle ?? null,
        version_impulso: t.version_impulso,
      });
      // 23505 = ya existe «este impulso por este hecho»: es la garantía antiduplicados, no un error.
      if (error) {
        if (error.code === "23505") return "duplicada";
        fallo("crear tarea", error);
      }
      return "creada";
    },

    async reclamarTareas(limite, ahora) {
      const { data, error } = await db.rpc("impulsos_reclamar_tareas", { p_limite: limite, p_ahora: ahora.toISOString() });
      if (error) fallo("reclamar tareas", error);
      return (data ?? []) as unknown as Tarea[];
    },

    async actualizarTarea(id, cambios: CambiosTarea) {
      const { error } = await db
        .from("impulsos_tareas")
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) fallo("actualizar tarea", error);
    },

    async enviosDelCliente(miembroId, desde) {
      const { data, error } = await db
        .from("impulsos_tareas")
        .select("impulso_id, enviada_en")
        .eq("miembro_id", miembroId)
        .eq("estado", "enviada")
        .gte("enviada_en", desde.toISOString());
      if (error) fallo("envíos del cliente", error);
      return (data ?? []) as unknown as { impulso_id: string; enviada_en: string }[];
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
//  LECTURAS COMPUESTAS
// ═══════════════════════════════════════════════════════════════════

type FilaPrograma = {
  id: string;
  rancho_id: string;
  nombre: string | null;
  modo: string | null;
  estado: string | null;
  activo: boolean | null;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  cuenta_id?: string | null;
};

/** La tarjeta, su negocio, su meta y si es de Foorkie. null = no existe. */
export async function leerInfoPrograma(db: Db, programaId: string): Promise<InfoPrograma | null> {
  // `cuenta_id` (0134) se pide con reintento: nombrar una columna que la base no tiene falla la consulta entera.
  let fila: FilaPrograma | null = null;
  const conCuenta = await db
    .from("programa_lealtad")
    .select("id, rancho_id, nombre, modo, estado, activo, vigente_desde, vigente_hasta, cuenta_id")
    .eq("id", programaId)
    .maybeSingle();
  if (conCuenta.error) {
    const sinCuenta = await db
      .from("programa_lealtad")
      .select("id, rancho_id, nombre, modo, estado, activo, vigente_desde, vigente_hasta")
      .eq("id", programaId)
      .maybeSingle();
    if (sinCuenta.error) fallo("tarjeta", sinCuenta.error);
    fila = (sinCuenta.data ?? null) as unknown as FilaPrograma | null;
  } else {
    fila = (conCuenta.data ?? null) as unknown as FilaPrograma | null;
  }
  if (!fila) return null;

  const [rancho, recompensa, local] = await Promise.all([
    db.from("ranchos").select("nombre, zona_horaria").eq("id", fila.rancho_id).maybeSingle(),
    db
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", programaId)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle(),
    localDeFoorkieDeLaTarjeta(db, { programaId, ranchoId: fila.rancho_id }),
  ]);
  if (rancho.error) fallo("negocio", rancho.error);

  const r = (rancho.data ?? null) as { nombre?: string | null; zona_horaria?: string | null } | null;
  const rec = (recompensa.data ?? null) as { nombre?: string | null; costo_puntos?: unknown } | null;
  const costo = rec ? Number(rec.costo_puntos) : NaN;

  return {
    programaId,
    ranchoId: fila.rancho_id,
    nombrePrograma: (fila.nombre ?? "").trim() || "Tu tarjeta",
    nombreNegocio: (r?.nombre ?? "").trim(),
    modo: fila.modo ?? "sellos",
    zona: zonaValida(r?.zona_horaria) ? r.zona_horaria : TZ_CR,
    opera: operaAhora(
      { estado: fila.estado, activo: !!fila.activo, vigente_desde: fila.vigente_desde, vigente_hasta: fila.vigente_hasta },
      minutoISOCR(),
    ),
    esFoorkie: local !== null,
    meta: Number.isFinite(costo) && costo > 0 ? costo : null,
    recompensa: rec?.nombre ? String(rec.nombre).trim() : null,
    cuentaId: fila.cuenta_id ?? null,
  };
}

/** Todo lo que se sabe de un cliente. null = ese miembro no es de esta tarjeta (o no existe). */
export async function leerContextoCliente(db: Db, miembroId: string, info: InfoPrograma, ahora: Date): Promise<ClienteCargado | null> {
  // `programa_id` en el filtro: un miembro de OTRA tarjeta no se puede cargar con esta aunque el id sea válido.
  const { data: m, error } = await db
    .from("miembros")
    .select("id, estado, persona_id, cliente_id, created_at")
    .eq("id", miembroId)
    .eq("programa_id", info.programaId)
    .maybeSingle();
  if (error) fallo("cliente", error);
  if (!m) return null;
  const miembro = m as unknown as { id: string; estado: string; persona_id: string | null; cliente_id: string | null; created_at: string };

  const [ledger, pases, identidades] = await Promise.all([
    db
      .from("transacciones_puntos")
      .select("id, tipo, puntos, referencia, created_at, reversion_de")
      .eq("miembro_id", miembroId)
      .order("created_at", { ascending: true })
      .limit(5000),
    db.from("pases_wallet").select("plataforma").eq("miembro_id", miembroId).eq("activo", true),
    identidadesDeMiembros(db, [{ id: miembro.id, persona_id: miembro.persona_id, cliente_id: miembro.cliente_id }], info.ranchoId),
  ]);
  if (ledger.error) fallo("movimientos del cliente", ledger.error);
  if (pases.error) fallo("pases del cliente", pases.error);

  const resumen = resumirLedger((ledger.data ?? []) as unknown as FilaLedger[], info.zona);
  const plataformas = ((pases.data ?? []) as { plataforma?: string }[]).map((p) => String(p.plataforma));

  return {
    miembroActivo: miembro.estado === "activa",
    ctx: armarContextoCliente(
      info,
      { nombreCompleto: identidades.get(miembro.id)?.nombre ?? null, creadoEn: miembro.created_at, plataformas },
      resumen,
      ahora,
    ),
  };
}
