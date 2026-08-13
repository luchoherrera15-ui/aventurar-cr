import { describe, expect, it } from "vitest";
import {
  conteoPorFiltro,
  estadoVisible,
  filtrar,
  operaAhora,
  ESTADOS_VISIBLES,
  ETIQUETA_ESTADO,
  FILTROS,
  type FilaPrograma,
} from "./programas";

const AHORA = "2026-08-13T14:30";

function fila(extra: Partial<FilaPrograma> = {}): FilaPrograma {
  return { estado: "activo", activo: true, ...extra };
}

describe("estadoVisible", () => {
  it("una tarjeta activa sin fechas está activa", () => {
    expect(estadoVisible(fila(), AHORA)).toBe("activo");
  });

  it("dentro de su ventana, activa", () => {
    expect(
      estadoVisible(fila({ vigente_desde: "2026-08-01", vigente_hasta: "2026-08-31" }), AHORA),
    ).toBe("activo");
  });

  it("antes de empezar, programada", () => {
    expect(estadoVisible(fila({ vigente_desde: "2026-09-01" }), AHORA)).toBe("programado");
  });

  it("pasada su fecha, vencida", () => {
    expect(estadoVisible(fila({ vigente_hasta: "2026-08-01" }), AHORA)).toBe("vencido");
  });

  // ── Lo que alguien DECIDIÓ manda sobre el calendario ──────────────
  it("archivada sigue archivada aunque la fecha haya pasado", () => {
    const f = fila({ estado: "archivado", activo: false, vigente_hasta: "2026-08-01" });
    expect(estadoVisible(f, AHORA)).toBe("archivado");
  });

  it("pausada sigue pausada aunque esté dentro de su ventana", () => {
    const f = fila({ estado: "pausado", activo: false, vigente_hasta: "2026-12-31" });
    expect(estadoVisible(f, AHORA)).toBe("pausado");
  });

  it("un borrador con fecha futura es borrador, no «programada»", () => {
    // Programada significa «lista y esperando su día». Un borrador no
    // está listo: nadie lo publicó.
    const f = fila({ estado: "borrador", activo: false, vigente_desde: "2026-09-01" });
    expect(estadoVisible(f, AHORA)).toBe("borrador");
  });

  // ── El bug de zona horaria que esta función existe para evitar ────
  it("el día es el día: no se adelanta por UTC", () => {
    // `new Date("2026-09-01")` es medianoche UTC = 31 de agosto, 6 p.m.
    // en Costa Rica. Comparando así, una promo que arranca el 1 se
    // habría activado la tarde del 31.
    const arrancaEl1 = fila({ vigente_desde: "2026-09-01" });
    expect(estadoVisible(arrancaEl1, "2026-08-31T18:30")).toBe("programado");
    expect(estadoVisible(arrancaEl1, "2026-08-31T23:59")).toBe("programado");
    expect(estadoVisible(arrancaEl1, "2026-09-01T00:00")).toBe("activo");
  });

  it("vence al terminar su último día, no antes", () => {
    const hastaEl31 = fila({ vigente_hasta: "2026-08-31" });
    expect(estadoVisible(hastaEl31, "2026-08-31T23:59")).toBe("activo");
    expect(estadoVisible(hastaEl31, "2026-09-01T00:00")).toBe("vencido");
  });

  it("tolera una base sin las columnas de vigencia", () => {
    // Antes de la 0136 las columnas no existen y la fila no las trae.
    expect(estadoVisible({ estado: "activo", activo: true }, AHORA)).toBe("activo");
  });
});

describe("operaAhora", () => {
  // Esto es lo que decide si un canje procede. Una captura del QR o un
  // pase viejo en el teléfono no pueden saltárselo.
  it("solo la activa opera", () => {
    expect(operaAhora(fila(), AHORA)).toBe(true);
  });

  it("ni programada, ni vencida, ni pausada, ni borrador, ni archivada", () => {
    const casos: FilaPrograma[] = [
      fila({ vigente_desde: "2026-09-01" }),
      fila({ vigente_hasta: "2026-08-01" }),
      fila({ estado: "pausado", activo: false }),
      fila({ estado: "borrador", activo: false }),
      fila({ estado: "archivado", activo: false }),
    ];
    for (const c of casos) expect(operaAhora(c, AHORA)).toBe(false);
  });
});

describe("filtros", () => {
  const lista: FilaPrograma[] = [
    fila(),
    fila({ vigente_desde: "2026-09-01" }),
    fila({ vigente_hasta: "2026-08-01" }),
    fila({ estado: "borrador", activo: false }),
    fila({ estado: "borrador", activo: false }),
    fila({ estado: "archivado", activo: false }),
  ];

  it("cuenta cada estado y el total", () => {
    const c = conteoPorFiltro(lista, AHORA);
    expect(c.todos).toBe(6);
    expect(c.activo).toBe(1);
    expect(c.programado).toBe(1);
    expect(c.vencido).toBe(1);
    expect(c.borrador).toBe(2);
    expect(c.archivado).toBe(1);
    expect(c.pausado).toBe(0);
  });

  it("la suma de los estados es el total", () => {
    const c = conteoPorFiltro(lista, AHORA);
    const suma = ESTADOS_VISIBLES.reduce((t, e) => t + c[e], 0);
    expect(suma).toBe(c.todos);
  });

  it("filtrar devuelve justo lo que dice el conteo", () => {
    const c = conteoPorFiltro(lista, AHORA);
    for (const f of FILTROS) {
      expect(filtrar(lista, f.id, AHORA)).toHaveLength(c[f.id]);
    }
  });

  it("«todas» no pierde ninguna", () => {
    expect(filtrar(lista, "todos", AHORA)).toHaveLength(lista.length);
  });

  it("cada estado tiene su etiqueta en español", () => {
    for (const e of ESTADOS_VISIBLES) {
      expect(ETIQUETA_ESTADO[e].trim()).not.toBe("");
    }
  });
});
