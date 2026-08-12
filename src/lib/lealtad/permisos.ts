/**
 * El checklist de permisos de lealtad (0127) — la parte PURA.
 *
 * Qué puede hacer cada cual dentro del módulo:
 *
 *   dueño / admin de plataforma  → todo (no pasan por el checklist)
 *   colaborador 'administrador'  → todo
 *   colaborador 'empleado'       → solo lo marcado en permisos_lealtad
 *
 * La configuración del PROGRAMA (reglas, recompensas, apariencia,
 * estado) no aparece acá a propósito: eso es de Bookea — el negocio
 * solicita, Bookea genera. Ningún checklist la puede conceder.
 *
 * Sin Supabase ni sesión: se puede testear entera.
 */

export type PermisoLealtad = "acreditar" | "canjear" | "revertir" | "auditoria";

export type PermisosLealtad = Record<PermisoLealtad, boolean>;

export const PERMISOS_TODO: PermisosLealtad = {
  acreditar: true,
  canjear: true,
  revertir: true,
  auditoria: true,
};

export const PERMISOS_NADA: PermisosLealtad = {
  acreditar: false,
  canjear: false,
  revertir: false,
  auditoria: false,
};

/** Lo que un empleado recién invitado puede hacer (default de la 0127). */
export const PERMISOS_EMPLEADO_NUEVO: PermisosLealtad = {
  acreditar: true,
  canjear: true,
  revertir: false,
  auditoria: false,
};

/** Para pintar el checklist en la pantalla de Equipo. */
export const ETIQUETAS_PERMISO: Record<PermisoLealtad, { titulo: string; detalle: string }> = {
  acreditar: {
    titulo: "Dar sellos y puntos",
    detalle: "Escanear tarjetas y acreditar visitas o compras.",
  },
  canjear: {
    titulo: "Canjear premios",
    detalle: "Entregar recompensas y marcarlas en la caja.",
  },
  revertir: {
    titulo: "Revertir movimientos",
    detalle: "Corregir errores y suspender membresías.",
  },
  auditoria: {
    titulo: "Ver la auditoría",
    detalle: "Quién dio puntos, quién canjeó, a qué hora.",
  },
};

/**
 * Resuelve el checklist de una fila de `rancho_colaboradores`.
 *
 * El jsonb llega de la base como `unknown`; solo un `true` literal
 * concede — cualquier otra cosa (ausente, "true", 1, null) niega. En
 * permisos, el empate lo pierde el permiso.
 */
export function permisosDeFila(
  rol: string | null | undefined,
  permisosJson: unknown,
): PermisosLealtad {
  if (rol === "administrador") return PERMISOS_TODO;

  const crudo =
    permisosJson && typeof permisosJson === "object" && !Array.isArray(permisosJson)
      ? (permisosJson as Record<string, unknown>)
      : {};

  return {
    acreditar: crudo.acreditar === true,
    canjear: crudo.canjear === true,
    revertir: crudo.revertir === true,
    auditoria: crudo.auditoria === true,
  };
}
