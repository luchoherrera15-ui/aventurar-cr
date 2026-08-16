import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * EQUIPO CANÓNICO DE LEALTAD (Wallet V2, Fase 2B) — `cuentas_equipo` es
 * la fuente de autorización desde ahora. `rancho_colaboradores` sigue
 * existiendo (la usan módulos legacy que esta fase no toca) y sirve
 * como RESPALDO temporal, solo mientras el rancho de ese colaborador
 * todavía no tiene `cuenta` (ver la migración 0158 y la vista
 * `wallet_v2_equipo_fallback_pendiente`).
 *
 * Cada vez que este helper tiene que caer al respaldo, lo REGISTRA —
 * es la "métrica" que pide la Fase 2B para poder decidir, con datos y
 * no a ojo, cuándo retirar el camino legacy.
 *
 * ------------------------------------------------------------------
 * CONDICIÓN OBJETIVA DE RETIRO DEL FALLBACK
 * ------------------------------------------------------------------
 * Retirar `rancho_colaboradores` de este archivo (y dejar que
 * `cuentas_equipo` resuelva sola) cuando, en producción:
 *   1. `select count(*) from wallet_v2_equipo_fallback_pendiente` da 0, Y
 *   2. Pasaron 30 días consecutivos sin ningún log
 *      "[wallet-v2] fallback a rancho_colaboradores" en ese entorno.
 * Ninguna de las dos condiciones sola alcanza: la vista en 0 dice que
 * hoy no hace falta, pero no garantiza que no vuelva a hacer falta
 * (un alta nueva podría, en teoría, crear un rancho sin cuenta si algo
 * más adelante lo permitiera) — los 30 días de logs limpios son la
 * evidencia de que en la práctica ya no ocurre.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type PermisosLealtad = {
  acreditar?: boolean;
  canjear?: boolean;
  revertir?: boolean;
  auditoria?: boolean;
};

export type MiembroDeEquipo = {
  usuarioId: string;
  /** Siempre en el vocabulario canónico: 'propietario' | 'administrador' | 'colaborador'. */
  rol: "propietario" | "administrador" | "colaborador";
  permisos: PermisosLealtad;
  /** true = esta fila vino del respaldo legacy, no de cuentas_equipo. */
  viaFallback: boolean;
};

/**
 * Registra un uso del fallback. Hoy es un `console.warn` estructurado
 * — consistente con cómo el resto del módulo de Wallet ya loguea
 * eventos operativos (ver `servicio.ts`) — y es exactamente lo que un
 * grep o una alerta de log puede contar para medir la condición de
 * retiro de arriba. No se monta un sistema de métricas nuevo para
 * esto: sería más infraestructura que el problema que resuelve.
 */
function registrarUsoDeFallback(contexto: { ranchoId: string; usuarioId: string; motivo: string }) {
  console.warn("[wallet-v2] fallback a rancho_colaboradores", contexto);
}

/**
 * El equipo de UN negocio, en el vocabulario canónico, resolviendo
 * primero contra `cuentas_equipo` y cayendo a `rancho_colaboradores`
 * SOLO para los usuarios que no aparezcan ahí — nunca al revés, y
 * nunca mezclando: si `cuentas_equipo` ya tiene a alguien, esa fila
 * gana siempre, aunque `rancho_colaboradores` también lo liste.
 */
export async function equipoCanonicoDelNegocio(
  db: Admin,
  quien: { ranchoId: string; cuentaId?: string | null },
): Promise<MiembroDeEquipo[]> {
  const resultado: MiembroDeEquipo[] = [];
  const yaResueltos = new Set<string>();

  if (quien.cuentaId) {
    const { data: equipo } = await db
      .from("cuentas_equipo")
      .select("usuario_id, rol, permisos")
      .eq("cuenta_id", quien.cuentaId);

    for (const fila of equipo ?? []) {
      resultado.push({
        usuarioId: fila.usuario_id as string,
        rol: fila.rol as MiembroDeEquipo["rol"],
        permisos: (fila.permisos as PermisosLealtad | null) ?? {},
        viaFallback: false,
      });
      yaResueltos.add(fila.usuario_id as string);
    }
  }

  const { data: legacy } = await db
    .from("rancho_colaboradores")
    .select("usuario_id, rol, permisos_lealtad")
    .eq("rancho_id", quien.ranchoId);

  for (const fila of legacy ?? []) {
    const usuarioId = fila.usuario_id as string;
    if (yaResueltos.has(usuarioId)) continue; // cuentas_equipo ya lo tenía — esa fila gana

    registrarUsoDeFallback({ ranchoId: quien.ranchoId, usuarioId, motivo: "no_esta_en_cuentas_equipo" });

    const rolLegacy = fila.rol as string;
    resultado.push({
      usuarioId,
      rol: "colaborador", // mismo mapeo que la migración 0158 — nunca 'administrador'
      permisos:
        rolLegacy === "administrador"
          ? { acreditar: true, canjear: true, revertir: true, auditoria: true }
          : ((fila.permisos_lealtad as PermisosLealtad | null) ?? {}),
      viaFallback: true,
    });
  }

  return resultado;
}

/** ¿Este usuario puede hacer esta acción de lealtad en este negocio? */
export async function tienePermisoLealtad(
  db: Admin,
  quien: { ranchoId: string; cuentaId?: string | null; usuarioId: string },
  accion: keyof PermisosLealtad,
): Promise<boolean> {
  const equipo = await equipoCanonicoDelNegocio(db, quien);
  const miembro = equipo.find((m) => m.usuarioId === quien.usuarioId);
  if (!miembro) return false;
  if (miembro.rol === "propietario" || miembro.rol === "administrador") return true;
  return !!miembro.permisos[accion];
}
