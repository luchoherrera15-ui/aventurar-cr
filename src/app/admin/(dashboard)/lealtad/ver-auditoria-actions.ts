"use server";

import { requireAdmin, verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import { identidadesDeMiembros, miembrosConIdentidad } from "@/lib/lealtad/identidades-db";
import { fichaVisible, numeroCorto, SIN_DATOS } from "@/lib/lealtad/identidad-miembro";

/**
 * AUDITORÍA DE SELLOS, desde /admin/complementos — SOLO LECTURA.
 *
 * Contesta la pregunta de soporte de siempre: "a este cliente le
 * faltan sellos" / "¿quién le dio esto?". Por cada miembro del
 * programa: cuántos puntos/sellos tiene, y el desglose de CADA
 * movimiento con cuánto, por qué, quién lo acreditó (o lo canjeó) y
 * cuándo.
 *
 * ── DOS CAPAS DE PERMISO, igual que "Ver clientes" (`ver-clientes-actions.ts`) ──
 * Acá se lee nombre/correo/teléfono de personas reales Y el nombre de
 * quién operó el mostrador (dueño o colaborador), así que:
 *   1. `requireAdmin()` primero — barato, corta temprano si ni siquiera
 *      es admin de plataforma;
 *   2. `verificarAccesoLealtad(ranchoId)` después — el MISMO camino que
 *      ya usa "Ver clientes" y el panel del propio negocio, no un
 *      tercer mecanismo de permiso inventado acá.
 *
 * ── POR QUÉ NO ES EL "ACTIVIDAD" DEL PANEL DEL NEGOCIO ────────────────
 * `ActividadLealtad` (lealtad-secciones.tsx) hace casi esto mismo, pero
 * vive DENTRO del panel operativo del negocio (`/lealtad/panel/[id]`),
 * al lado de botones para acreditar/canjear/revertir de verdad. Un
 * admin mirando desde afuera no tiene por qué entrar por esa puerta —
 * el mismo motivo por el que "Ver clientes" arma su propia ficha en vez
 * de reusar el mostrador operativo: apretar un botón real por error
 * sobre el negocio de otro sería el peor bug posible acá.
 *
 * ── AGRUPADO POR MIEMBRO, NO POR MOVIMIENTO ───────────────────────────
 * La pregunta que trae a un admin acá es "¿qué tiene ESTE cliente?",
 * no "¿qué pasó a las 14:32?" — por eso la lista principal es de
 * miembros (con su saldo) y el detalle de movimientos se abre por
 * miembro, no al revés.
 */

export type MovimientoDeAuditoria = {
  id: string;
  /** 'ganado' | 'canjeado' | 'ajuste'. */
  tipo: string;
  /** Ya viene con signo (negativo en canje/ajuste) — se muestra tal cual. */
  puntos: number;
  motivo: string;
  saldoPosterior: number | null;
  /** Quién lo acreditó/canjeó/ajustó. null = lo hizo el sistema. */
  porQuien: string | null;
  /** ISO del momento exacto (`transacciones_puntos.created_at`). */
  fecha: string;
};

export type MiembroDeAuditoria = {
  miembroId: string;
  nombre: string;
  sinNombre: boolean;
  /** Suma de los movimientos QUE SE TRAJERON. Ver `movimientosTruncados`. */
  saldo: number;
  /** Del más nuevo al más viejo. */
  movimientos: MovimientoDeAuditoria[];
};

export type ResultadoAuditoria =
  | {
      ok: true;
      miembros: MiembroDeAuditoria[];
      totalMiembros: number;
      /** true = hay más miembros que los que se muestran (tope de 300). */
      miembrosTruncados: boolean;
      /**
       * true = se llegó al tope de movimientos por negocio. Los saldos
       * y el historial de las cuentas más viejas o más activas pueden
       * quedar incompletos — se dice, no se disfraza.
       */
      movimientosTruncados: boolean;
      totalProgramas: number;
    }
  | { ok: false; motivo: string };

/**
 * Techo de miembros que se traen a pantalla completa. Mismo número que
 * "Ver clientes" (`TOPE_CLIENTES_VISTA`): calibrado contra el plan
 * "Ilimitado" sin forzar traer miles de fichas por un click.
 */
const TOPE_MIEMBROS = 300;
/** Techo de movimientos por negocio, repartidos entre sus miembros. */
const TOPE_MOVIMIENTOS = 3000;

export async function auditoriaDeNegocio(ranchoId: string): Promise<ResultadoAuditoria> {
  const { ok: esAdmin } = await requireAdmin();
  if (!esAdmin) {
    return { ok: false, motivo: "No tenés permiso para ver la auditoría de este negocio." };
  }

  const acceso = await verificarAccesoLealtad(ranchoId);
  if (!acceso.ok) {
    return {
      ok: false,
      motivo: "Ese negocio no existe, o no se pudo confirmar el acceso a su lealtad.",
    };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: FALTA_SERVICE_KEY };

  // Un negocio puede tener varias tarjetas (0134): se audita TODO junto,
  // no una a la vez — el mismo criterio que ya usa "Ver clientes".
  const { data: programas, error: errorProgramas } = await admin
    .from("programa_lealtad")
    .select("id")
    .eq("rancho_id", ranchoId);
  if (errorProgramas) {
    return { ok: false, motivo: "No se pudieron leer las tarjetas de este negocio." };
  }

  const idsProgramas = (programas ?? []).map((p) => p.id as string);
  if (idsProgramas.length === 0) {
    return {
      ok: false,
      motivo: "Este negocio no tiene ningún programa de lealtad — no hay nada que auditar.",
    };
  }

  const miembros = await miembrosConIdentidad(admin, { programaIds: idsProgramas });
  if (miembros.length === 0) {
    return {
      ok: true,
      miembros: [],
      totalMiembros: 0,
      miembrosTruncados: false,
      movimientosTruncados: false,
      totalProgramas: idsProgramas.length,
    };
  }

  const identidades = await identidadesDeMiembros(admin, miembros, ranchoId);

  const totalMiembros = miembros.length;
  const miembrosTruncados = totalMiembros > TOPE_MIEMBROS;
  // El más nuevo primero: si hay que recortar, se prefiere perder a los
  // miembros más viejos antes que a los que se afiliaron hace poco.
  const miembrosAMostrar = [...miembros]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, TOPE_MIEMBROS);
  const idsAMostrar = miembrosAMostrar.map((m) => m.id);

  const { data: tx } = idsAMostrar.length
    ? await admin
        .from("transacciones_puntos")
        .select("id, miembro_id, tipo, puntos, motivo, saldo_posterior, usuario_id, created_at")
        .in("miembro_id", idsAMostrar)
        .order("created_at", { ascending: false })
        .limit(TOPE_MOVIMIENTOS)
    : { data: [] };

  const filas = (tx ?? []) as {
    id: string;
    miembro_id: string;
    tipo: string;
    puntos: number;
    motivo: string | null;
    saldo_posterior: number | null;
    usuario_id: string | null;
    created_at: string;
  }[];
  const movimientosTruncados = filas.length >= TOPE_MOVIMIENTOS;

  // QUIÉN lo hizo: el MISMO criterio que ya usa el panel del propio
  // negocio (`lealtad-secciones.tsx`, `auditoria-resumen.tsx`) —
  // `perfiles.nombre`, "Colaborador" si no se resuelve, y
  // `usuario_id` null se muestra como "sistema" en la pantalla.
  const operadores = [...new Set(filas.map((t) => t.usuario_id).filter((v): v is string => !!v))];
  const { data: perfilesOp } = operadores.length
    ? await admin.from("perfiles").select("id, nombre").in("id", operadores)
    : { data: [] };
  const nombreOperador = new Map(
    ((perfilesOp ?? []) as { id: string; nombre: string | null }[]).map((p) => [
      p.id,
      (p.nombre ?? "").trim() || "Colaborador",
    ]),
  );

  const porMiembro = new Map<string, MovimientoDeAuditoria[]>();
  for (const t of filas) {
    const lista = porMiembro.get(t.miembro_id) ?? [];
    lista.push({
      id: t.id,
      tipo: t.tipo,
      puntos: t.puntos,
      motivo: (t.motivo ?? "").trim() || "—",
      saldoPosterior: t.saldo_posterior,
      porQuien: t.usuario_id ? (nombreOperador.get(t.usuario_id) ?? "Colaborador") : null,
      fecha: t.created_at,
    });
    porMiembro.set(t.miembro_id, lista);
  }

  const miembrosOut: MiembroDeAuditoria[] = miembrosAMostrar
    .map((m) => {
      const vista = fichaVisible(
        identidades.get(m.id) ?? { nombre: null, correo: null, telefono: null },
        { alta: m.created_at, miembroId: m.id },
      );
      const corto = numeroCorto(m.id);
      const movimientos = porMiembro.get(m.id) ?? [];
      return {
        miembroId: m.id,
        nombre: vista.titulo === SIN_DATOS && corto ? `${SIN_DATOS} nº ${corto}` : vista.titulo,
        sinNombre: vista.sinNombre,
        saldo: movimientos.reduce((acc, mv) => acc + mv.puntos, 0),
        movimientos,
      };
    })
    // Quien tuvo actividad primero (el movimiento más reciente adelante);
    // quien nunca tuvo ninguna, al final — es a quienes SÍ se movieron a
    // los que un admin viene a mirar.
    .sort((a, b) => (b.movimientos[0]?.fecha ?? "").localeCompare(a.movimientos[0]?.fecha ?? ""));

  return {
    ok: true,
    miembros: miembrosOut,
    totalMiembros,
    miembrosTruncados,
    movimientosTruncados,
    totalProgramas: idsProgramas.length,
  };
}
