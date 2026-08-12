import { describe, expect, it } from "vitest";
import {
  ETIQUETAS_PERMISO,
  PERMISOS_EMPLEADO_NUEVO,
  PERMISOS_NADA,
  PERMISOS_TODO,
  permisosDeFila,
} from "./permisos";

/**
 * El checklist es una frontera de seguridad: estos tests fijan que la
 * duda siempre NIEGA. Un empleado con un jsonb raro no puede terminar
 * revirtiendo movimientos por un truthy accidental.
 */

describe("permisosDeFila", () => {
  it("administrador puede todo, sin mirar el checklist", () => {
    expect(permisosDeFila("administrador", null)).toEqual(PERMISOS_TODO);
    // Aunque el checklist diga que no: el rol manda.
    expect(permisosDeFila("administrador", { acreditar: false })).toEqual(PERMISOS_TODO);
  });

  it("empleado recibe exactamente su checklist", () => {
    expect(
      permisosDeFila("empleado", { acreditar: true, canjear: true }),
    ).toEqual({ acreditar: true, canjear: true, revertir: false, auditoria: false });
    expect(
      permisosDeFila("empleado", PERMISOS_TODO),
    ).toEqual(PERMISOS_TODO);
  });

  it("solo el true LITERAL concede — truthy no alcanza", () => {
    expect(
      permisosDeFila("empleado", {
        acreditar: "true",
        canjear: 1,
        revertir: {},
        auditoria: [true],
      }),
    ).toEqual(PERMISOS_NADA);
  });

  it("checklist ausente, nulo, array o basura = nada", () => {
    expect(permisosDeFila("empleado", null)).toEqual(PERMISOS_NADA);
    expect(permisosDeFila("empleado", undefined)).toEqual(PERMISOS_NADA);
    expect(permisosDeFila("empleado", [])).toEqual(PERMISOS_NADA);
    expect(permisosDeFila("empleado", "todo")).toEqual(PERMISOS_NADA);
    expect(permisosDeFila("empleado", 7)).toEqual(PERMISOS_NADA);
  });

  it("un rol desconocido se trata como empleado, nunca como administrador", () => {
    expect(permisosDeFila("supervisor", { acreditar: true })).toEqual({
      ...PERMISOS_NADA,
      acreditar: true,
    });
    expect(permisosDeFila(null, null)).toEqual(PERMISOS_NADA);
  });

  it("el default del empleado nuevo opera el mostrador y nada más", () => {
    // Espejo del default de la 0127: {"acreditar": true, "canjear": true}.
    expect(permisosDeFila("empleado", { acreditar: true, canjear: true })).toEqual(
      PERMISOS_EMPLEADO_NUEVO,
    );
    expect(PERMISOS_EMPLEADO_NUEVO.revertir).toBe(false);
    expect(PERMISOS_EMPLEADO_NUEVO.auditoria).toBe(false);
  });

  it("cada permiso tiene etiqueta para el checklist de Equipo", () => {
    for (const llave of Object.keys(PERMISOS_TODO)) {
      const etiqueta = ETIQUETAS_PERMISO[llave as keyof typeof ETIQUETAS_PERMISO];
      expect(etiqueta.titulo.length).toBeGreaterThan(0);
      expect(etiqueta.detalle.length).toBeGreaterThan(0);
    }
  });
});
