import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * QUIÉN VE EL AVISO Y QUIÉN NO.
 *
 * Es la decisión que no se puede equivocar: el dueño y su equipo lo ven,
 * Bookea entra igual para poder ayudar, y a alguien ajeno no se le dice
 * nada de un negocio que no es suyo.
 */

type Acceso = { ok: boolean; esAdmin: boolean; esDueno: boolean };

let bloqueo: Record<string, unknown> | null = null;
let acceso: Acceso = { ok: true, esAdmin: false, esDueno: true };
const verificar = vi.fn(async () => acceso);

vi.mock("@/lib/auth", () => ({ verificarAccesoLealtad: () => verificar() }));
vi.mock("@/lib/lealtad/membresia-vencida", () => ({
  bloqueoPorMembresia: async () => bloqueo,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c = {
        select: () => c,
        eq: () => c,
        maybeSingle: async () => ({ data: { nombre: "Zuccherino" }, error: null }),
      };
      return c;
    },
  }),
}));

const { default: Layout } = await import("./layout");
const { default: Popup } = await import("./popup-membresia-vencida");

const PANEL = "EL PANEL";
const abrir = () =>
  Layout({ children: PANEL, params: Promise.resolve({ id: "r-1" }) }) as Promise<unknown>;

/** El popup que quedó adentro del `<Suspense>`, o null si pasó el panel. */
function popupDe(salida: unknown): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement<{ children: unknown }>(salida)) return null;
  const hijo = salida.props.children;
  if (!isValidElement<Record<string, unknown>>(hijo) || hijo.type !== Popup) return null;
  return hijo;
}

const VENCIDA = {
  origen: "paquete",
  hasta: "2026-11-01T00:00:00+00:00",
  plan: "impulso",
  comprobanteEnRevision: false,
};

beforeEach(() => {
  bloqueo = null;
  acceso = { ok: true, esAdmin: false, esDueno: true };
  verificar.mockClear();
});

describe("la puerta del panel", () => {
  it("sin regalía vencida pasa directo, sin sumarle el chequeo de acceso a la carga", async () => {
    await expect(abrir()).resolves.toBe(PANEL);
    expect(verificar).not.toHaveBeenCalled();
  });

  it("al dueño le sale el popup EN VEZ del panel, no encima", async () => {
    bloqueo = VENCIDA;
    const salida = await abrir();
    const popup = popupDe(salida);
    expect(popup?.props).toMatchObject({
      ranchoId: "r-1",
      negocio: "Zuccherino",
      paquete: "Impulso",
      fecha: "sábado 31 de octubre de 2026",
      esDueno: true,
      comprobanteEnRevision: false,
    });
    expect(JSON.stringify(salida)).not.toContain(PANEL);
  });

  it("a un colaborador también, marcado para no ofrecerle pagar", async () => {
    bloqueo = VENCIDA;
    acceso = { ok: true, esAdmin: false, esDueno: false };
    expect(popupDe(await abrir())?.props.esDueno).toBe(false);
  });

  it("Bookea entra igual: tiene que poder ayudarle al negocio", async () => {
    bloqueo = VENCIDA;
    acceso = { ok: true, esAdmin: true, esDueno: false };
    await expect(abrir()).resolves.toBe(PANEL);
  });

  it("a alguien ajeno no se le dice nada: la página hace su redirect de siempre", async () => {
    bloqueo = VENCIDA;
    acceso = { ok: false, esAdmin: false, esDueno: false };
    await expect(abrir()).resolves.toBe(PANEL);
  });
});
