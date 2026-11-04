import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * REGISTRAR UN PAGO DEJA UNA FECHA.
 *
 * Un pago por SINPE no tiene cobro recurrente que se corte solo. Si al
 * aprobarlo no queda escrita la fecha hasta la que cubre, ese negocio
 * paga una vez y no vuelve a ver el aviso de membresía vencida nunca.
 */

const FECHA = "2026-12-04T12:00:00.000Z";

type Fila = Record<string, unknown>;

let solicitud: Fila | null = null;
let fecha: string | null = FECHA;
let filasActualizadas: Fila[] = [{ rancho_id: "r-1" }];
let upserts: Fila[] = [];
let updates: { tabla: string; valores: Fila }[] = [];
let inserts: { tabla: string; fila: Fila }[] = [];
const aplicarPlan = vi.fn(async () => ({ ok: true as const, cuentaId: null }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({
    ok: true,
    supabase: { auth: { getUser: async () => ({ data: { user: { id: "admin-1" } } }) } },
  }),
}));
vi.mock("@/lib/lealtad/aplicar-plan", () => ({
  aplicarPlanDeLealtad: () => aplicarPlan(),
  planGuardadoDe: async () => ({ cuentaId: null, plan: "arranque" }),
}));
vi.mock("@/lib/lealtad/membresia-vencida", () => ({
  fechaDelPagoManual: async () => fecha,
}));
vi.mock("@/lib/lealtad/alta-desde-solicitud", () => ({ crearNegocioDesdeSolicitud: vi.fn() }));
vi.mock("@/lib/lealtad/ayuda-hilo", () => ({ abrirHiloDeAyudaDesdeAlta: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  FALTA_SERVICE_KEY: "falta la llave",
  createAdminClient: () => ({
    from(tabla: string) {
      const c = {
        select: () => c,
        eq: () => c,
        update(valores: Fila) {
          updates.push({ tabla, valores });
          return c;
        },
        insert: async (fila: Fila) => {
          inserts.push({ tabla, fila });
          return { error: null };
        },
        upsert: async (fila: Fila) => {
          upserts.push(fila);
          return { error: null };
        },
        maybeSingle: async () => ({ data: solicitud, error: null }),
        then: (ok: (r: { data: Fila[]; error: null }) => unknown) =>
          Promise.resolve({ data: filasActualizadas, error: null }).then(ok),
      };
      return c;
    },
  }),
}));

const { asignarPlanLealtad, atenderSolicitudLealtad } = await import("./plan-actions");

const SOLICITUD_DE_PAGO = {
  id: "s-1",
  rancho_id: "r-1",
  plan: "impulso",
  estado: "pendiente",
  metodo_pago: "sinpe",
};

beforeEach(() => {
  solicitud = SOLICITUD_DE_PAGO;
  fecha = FECHA;
  filasActualizadas = [{ rancho_id: "r-1" }];
  upserts = [];
  updates = [];
  inserts = [];
  aplicarPlan.mockClear();
});

const historial = () => inserts.find((i) => i.tabla === "historial_plan_lealtad")?.fila;
const delComplemento = () => updates.find((u) => u.tabla === "addons_negocio")?.valores;

describe("aprobar un SINPE", () => {
  it("el complemento queda con la fecha que cubre el pago", async () => {
    await atenderSolicitudLealtad({ solicitudId: "s-1", aprobar: true, mesesPagados: 1 });
    expect(upserts[0]).toMatchObject({ vence_en: FECHA, es_cortesia: false, activo: true });
    expect(historial()?.concepto).toBe("venta");
    expect(historial()?.motivo).toContain("cubre hasta 2026-12-04");
  });

  it("sin período no se aprueba, y no se escribió nada", async () => {
    const r = await atenderSolicitudLealtad({ solicitudId: "s-1", aprobar: true });
    expect(r.error).toMatch(/cubre este pago/);
    expect(aplicarPlan).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
  });

  it("no acepta un período inventado", async () => {
    const r = await atenderSolicitudLealtad({
      solicitudId: "s-1",
      aprobar: true,
      mesesPagados: 999,
    });
    expect(r.error).toMatch(/cubre este pago/);
    expect(aplicarPlan).not.toHaveBeenCalled();
  });

  it("si paga con tarjeta, el complemento queda sin fecha", async () => {
    fecha = null;
    await atenderSolicitudLealtad({ solicitudId: "s-1", aprobar: true, mesesPagados: 1 });
    expect(upserts[0]?.vence_en).toBeNull();
  });

  it("la Prueba gratis no pide período", async () => {
    solicitud = { ...SOLICITUD_DE_PAGO, plan: "prueba", metodo_pago: null };
    const r = await atenderSolicitudLealtad({ solicitudId: "s-1", aprobar: true });
    expect(r.error).toBeUndefined();
    expect(upserts).toHaveLength(1);
  });

  it("rechazar no pide período", async () => {
    const r = await atenderSolicitudLealtad({ solicitudId: "s-1", aprobar: false });
    expect(r.error).toBeUndefined();
    expect(upserts).toHaveLength(0);
  });
});

describe("registrar el movimiento a mano", () => {
  const venta = { ranchoId: "r-1", plan: "impulso", concepto: "venta" };

  it("«Ya paga — cerrar la regalía» deja la fecha y borra la marca de regalo", async () => {
    await asignarPlanLealtad({ ...venta, mesesPagados: 3 });
    expect(delComplemento()).toEqual({ vence_en: FECHA, es_cortesia: false });
    expect(historial()?.motivo).toContain("Cubre hasta 2026-12-04");
  });

  it("una venta sin período no toca el plan", async () => {
    const r = await asignarPlanLealtad(venta);
    expect(r.error).toMatch(/cubre este pago/);
    expect(aplicarPlan).not.toHaveBeenCalled();
  });

  it("con tarjeta no se escribe ninguna fecha", async () => {
    fecha = null;
    await asignarPlanLealtad({ ...venta, mesesPagados: 1 });
    expect(delComplemento()).toBeUndefined();
  });

  it("si no tiene complemento, lo dice en vez de callarlo", async () => {
    filasActualizadas = [];
    const r = await asignarPlanLealtad({ ...venta, mesesPagados: 1 });
    expect(r.aviso).toMatch(/fecha no se pudo anotar/);
  });

  it("una regalía limpia la fecha vieja: si no, seguiría bloqueado recién regalado", async () => {
    await asignarPlanLealtad({
      ranchoId: "r-1",
      plan: "impulso",
      concepto: "cortesia",
      motivo: "Le damos otro mes",
      cortesiaHasta: "2026-12-31T00:00:00.000Z",
    });
    expect(delComplemento()).toEqual({ vence_en: null });
  });

  it("una corrección no toca lo pagado", async () => {
    await asignarPlanLealtad({ ranchoId: "r-1", plan: "impulso", concepto: "correccion" });
    expect(delComplemento()).toBeUndefined();
  });
});
