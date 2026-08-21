import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import { tramoDelCliente, type RitmoNegocio, type TramoCliente } from "@/lib/lealtad/ciclo-cliente";
import { cargarLealtad } from "./datos-lealtad";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  LA VISTA DE AUDITORÍA DE CLIENTES — cada quien, a fondo
 * ═══════════════════════════════════════════════════════════════════
 *
 * `cargarLealtad` contesta "quién está y cuántos sellos lleva" — lo
 * que el mostrador necesita. Esta capa contesta lo que pide el DUEÑO
 * cuando audita: cuántas veces vino cada quien, cuánto ha gastado,
 * cuándo fue la última vez, en qué tramo del ciclo está y qué hizo
 * visita por visita.
 *
 * Se apoya en `cargarLealtad` (mismo `cache()` por render, cero
 * consultas repetidas) y le suma DOS fuentes que aquella no mira:
 *
 *   · `lealtad_transacciones` (0197) — la VENTA detrás de cada sello:
 *     monto, producto, quién la registró.
 *   · `canjes` — los premios entregados.
 *
 * El ledger (`transacciones_puntos`) sigue siendo la fuente del
 * saldo; estas dos son la fuente del NEGOCIO. La distinción viene de
 * la 0197 y acá se respeta: no se suma un colón que no esté en
 * `lealtad_transacciones`.
 */

export type ClienteAuditado = {
  miembroId: string;
  nombre: string;
  sinNombre: boolean;
  contacto: string[];
  soloContacto: boolean;
  estado: string;
  conPase: boolean;
  saldo: number;
  /** Cuántos le faltan para la recompensa. null = no hay meta. */
  faltan: number | null;
  puedeCanjear: boolean;
  /** Cuántas VISITAS con sello (movimientos 'ganado' del ledger). */
  visitas: number;
  /** YYYY-MM-DD de la última visita, o null si nunca vino. */
  ultimaVisita: string | null;
  diasSinVenir: number | null;
  /** Colones registrados en `lealtad_transacciones`. 0 si el negocio
   *  no registra montos — la UI lo dice en vez de pintar ₡0 como si
   *  el cliente no valiera nada. */
  gastoTotal: number;
  /** Cuántas de sus visitas traen monto (para saber si el ₡ es
   *  representativo o el negocio casi nunca lo registra). */
  ventasConMonto: number;
  ticketPromedio: number | null;
  canjes: number;
  /** Fecha de afiliación (YYYY-MM-DD). */
  desde: string;
  tramo: TramoCliente;
};

export type DatosClientes = {
  clientes: ClienteAuditado[];
  ritmo: RitmoNegocio;
  hoy: string;
  totales: {
    clientes: number;
    activos: number;
    enRiesgo: number;
    dormidos: number;
    perdidos: number;
    nuevos: number;
    gasto: number;
  };
};

/** El ritmo del negocio. Vive en `configuracion` del programa (el
 *  jsonb libre que ya existe) para no pedir migración: si no está,
 *  "semanal", el punto medio de los rubros que hoy usan Lealtad. */
export async function ritmoDelPrograma(programaId: string): Promise<RitmoNegocio> {
  const db = createAdminClient();
  if (!db) return "semanal";
  const { data } = await db
    .from("programa_lealtad")
    .select("configuracion")
    .eq("id", programaId)
    .maybeSingle();
  const crudo = (data?.configuracion as { ritmo_clientes?: string } | null)?.ritmo_clientes;
  return crudo === "diario" || crudo === "semanal" || crudo === "quincenal" || crudo === "mensual"
    ? crudo
    : "semanal";
}

export const cargarClientesAuditados = cache(
  async (programaId: string, meta: number | null): Promise<DatosClientes | null> => {
    const db = createAdminClient();
    if (!db) return null;

    const base = await cargarLealtad(programaId, meta);
    if (!base) return null;

    const hoy = hoyISOCR();
    const ritmo = await ritmoDelPrograma(programaId);
    const ids = base.fichas.map((f) => f.miembroId);

    const [ventasRes, canjesRes, miembrosRes, ledgerRes] = await Promise.all([
      ids.length
        ? db
            .from("lealtad_transacciones")
            .select("miembro_id, monto, created_at")
            .eq("programa_id", programaId)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from("canjes").select("miembro_id").in("miembro_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from("miembros").select("id, created_at").in("id", ids)
        : Promise.resolve({ data: [] }),
      // La última visita REAL y el conteo: los 'ganado' del ledger. La
      // ficha del mostrador trae los días pero no la FECHA, y filtrar
      // por rango la necesita.
      ids.length
        ? db
            .from("transacciones_puntos")
            .select("miembro_id, tipo, created_at")
            .in("miembro_id", ids)
        : Promise.resolve({ data: [] }),
    ]);

    const gasto = new Map<string, { total: number; conMonto: number }>();
    for (const v of (ventasRes.data ?? []) as { miembro_id: string; monto: number | null }[]) {
      const previo = gasto.get(v.miembro_id) ?? { total: 0, conMonto: 0 };
      if (v.monto !== null && Number.isFinite(Number(v.monto))) {
        previo.total += Number(v.monto);
        previo.conMonto += 1;
      }
      gasto.set(v.miembro_id, previo);
    }

    const canjesPor = new Map<string, number>();
    for (const c of (canjesRes.data ?? []) as { miembro_id: string }[]) {
      canjesPor.set(c.miembro_id, (canjesPor.get(c.miembro_id) ?? 0) + 1);
    }

    const desdePor = new Map<string, string>();
    for (const m of (miembrosRes.data ?? []) as { id: string; created_at: string }[]) {
      desdePor.set(m.id, m.created_at.slice(0, 10));
    }

    const visitasPor = new Map<string, { visitas: number; ultima: string | null }>();
    for (const t of (ledgerRes.data ?? []) as {
      miembro_id: string;
      tipo: string;
      created_at: string;
    }[]) {
      if (t.tipo !== "ganado") continue;
      const previo = visitasPor.get(t.miembro_id) ?? { visitas: 0, ultima: null };
      previo.visitas += 1;
      const fecha = t.created_at.slice(0, 10);
      if (previo.ultima === null || fecha > previo.ultima) previo.ultima = fecha;
      visitasPor.set(t.miembro_id, previo);
    }

    const clientes: ClienteAuditado[] = base.fichas.map((f) => {
      const v = visitasPor.get(f.miembroId) ?? { visitas: 0, ultima: null };
      const g = gasto.get(f.miembroId) ?? { total: 0, conMonto: 0 };
      const { tramo, dias } = tramoDelCliente(v.ultima, hoy, ritmo);
      return {
        miembroId: f.miembroId,
        nombre: f.nombre,
        sinNombre: f.sinNombre,
        contacto: f.contacto,
        soloContacto: f.soloContacto,
        estado: f.estado,
        conPase: f.conPase,
        saldo: f.saldo,
        faltan: f.faltan,
        puedeCanjear: f.puedeCanjear,
        visitas: v.visitas,
        ultimaVisita: v.ultima,
        diasSinVenir: dias,
        gastoTotal: Math.round(g.total),
        ventasConMonto: g.conMonto,
        ticketPromedio: g.conMonto > 0 ? Math.round(g.total / g.conMonto) : null,
        canjes: canjesPor.get(f.miembroId) ?? 0,
        desde: desdePor.get(f.miembroId) ?? hoy,
        tramo,
      };
    });

    return {
      clientes,
      ritmo,
      hoy,
      totales: {
        clientes: clientes.length,
        activos: clientes.filter((c) => c.tramo === "activo").length,
        enRiesgo: clientes.filter((c) => c.tramo === "en_riesgo").length,
        dormidos: clientes.filter((c) => c.tramo === "dormido").length,
        perdidos: clientes.filter((c) => c.tramo === "perdido").length,
        nuevos: clientes.filter((c) => c.tramo === "nuevo").length,
        gasto: clientes.reduce((s, c) => s + c.gastoTotal, 0),
      },
    };
  },
);

/**
 * LA LÍNEA DE TIEMPO DE UN CLIENTE — la auditoría propiamente.
 *
 * Todo lo que le pasó a UNA membresía, en orden: sellos (con su venta
 * si la hubo), ajustes y canjes. De acá se contesta "¿cuándo vino,
 * qué compró y qué se le dio?".
 */
export type EventoCliente = {
  /** ISO completo, para ordenar y mostrar hora. */
  fecha: string;
  tipo: "sello" | "canje" | "ajuste";
  puntos: number;
  monto: number | null;
  producto: string | null;
  referencia: string | null;
};

export async function lineaDeTiempo(
  programaId: string,
  miembroId: string,
): Promise<EventoCliente[] | null> {
  const db = createAdminClient();
  if (!db) return null;

  // La membresía TIENE que ser del programa que el permiso ya validó:
  // sin esto, cualquier dueño con panel podía auditar miembros de OTRO
  // negocio adivinando ids (mismo agujero que ya se tapó en
  // listarPasesDelPrograma).
  const { data: miembro } = await db
    .from("miembros")
    .select("id, programa_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro || miembro.programa_id !== programaId) return null;

  const [ledger, ventas] = await Promise.all([
    db
      .from("transacciones_puntos")
      .select("tipo, puntos, created_at")
      .eq("miembro_id", miembroId)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("lealtad_transacciones")
      .select("monto, producto, referencia, created_at")
      .eq("miembro_id", miembroId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  type VentaCruda = {
    monto: number | null;
    producto: string | null;
    referencia: string | null;
    created_at: string;
  };

  // La venta se empareja con su movimiento del ledger por cercanía en
  // el tiempo: se escriben en la misma operación del servidor, con
  // milisegundos de diferencia. Diez segundos de ventana — holgado
  // para una escritura encadenada, corto para que dos visitas del
  // mismo día no se mezclen.
  const ventasLibres: VentaCruda[] = [...((ventas.data ?? []) as VentaCruda[])];

  const eventos: EventoCliente[] = (
    (ledger.data ?? []) as { tipo: string; puntos: number; created_at: string }[]
  ).map((m) => {
    let venta: VentaCruda | null = null;
    if (m.tipo === "ganado") {
      const t = Date.parse(m.created_at);
      const i = ventasLibres.findIndex((v) => Math.abs(Date.parse(v.created_at) - t) < 10_000);
      if (i >= 0) venta = ventasLibres.splice(i, 1)[0];
    }
    return {
      fecha: m.created_at,
      tipo: m.tipo === "ganado" ? "sello" : m.tipo === "canjeado" ? "canje" : "ajuste",
      puntos: m.puntos,
      monto: venta?.monto ?? null,
      producto: venta?.producto ?? null,
      referencia: venta?.referencia ?? null,
    };
  });

  return eventos;
}
