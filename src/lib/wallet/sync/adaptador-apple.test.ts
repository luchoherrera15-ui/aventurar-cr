import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL ADAPTADOR DE APPLE del worker de sincronización, contra red de
 * mentira.
 *
 * Lo que se prueba acá NO es APNs ni Supabase de verdad — es que:
 *
 *   · un envío que sale bien vuelve `{ok:true}`;
 *   · un fallo PERMANENTE (sin credenciales configuradas, un trabajo
 *     mal enrutado, un pase que ya no existe) vuelve `reintentable:
 *     false` — reintentarlo no lo arregla;
 *   · un fallo TRANSITORIO (APNs no contesta, Supabase no contesta)
 *     vuelve `reintentable: true` — el backoff del worker se encarga;
 *   · la identidad del pase (serial_number, auth_token, y por lo
 *     tanto passTypeIdentifier/authenticationToken en el .pkpass que
 *     arma `generar.ts`) nunca la escribe este archivo — ni siquiera
 *     cuando el envío falla.
 *
 * `entregarApple` (aviso-de-pausa.ts) y `avisarPaseActualizado`
 * (apns.ts, más abajo del anterior) están mockeados: acá no sale ni
 * una sola petición HTTP/2 real hacia Apple.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("../firma", () => ({ credencialesDelEntorno: vi.fn() }));
vi.mock("../aviso-de-pausa", () => ({ entregarApple: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { credencialesDelEntorno } from "../firma";
import { entregarApple } from "../aviso-de-pausa";
import { motivoSeguro, sincronizarPaseApple } from "./adaptador-apple";
import type { TrabajoSync } from "./tipos";

// ── Los datos de siempre ─────────────────────────────────────────────

const CREDENCIALES = {
  certificado: "cert-pem",
  llave: "llave-pem",
  wwdr: "wwdr-pem",
  passTypeIdentifier: "pass.lat.bookea.afiliacion",
  teamIdentifier: "425GBKXN83",
};

function job(extra: Partial<TrabajoSync> = {}): TrabajoSync {
  return {
    id: "job-001",
    cuentaId: "cuenta-001",
    programaId: "programa-001",
    miembroId: "miembro-001",
    paseId: "pase-001",
    plataforma: "apple",
    operacion: "saldo",
    idempotencyKey: "clave-001",
    correlationId: "correlacion-001",
    versionLocalEsperada: 3,
    intentos: 0,
    maxIntentos: 8,
    ...extra,
  };
}

/**
 * Una base de mentira con UNA sola operación: `pases_wallet` por id.
 * `updateSpy` existe para probar la promesa central de este archivo —
 * que nunca se llama.
 */
function armarDb(fila: Record<string, unknown> | null, error: { message: string } | null = null) {
  const updateSpy = vi.fn();
  const maybeSingle = vi.fn(async () => ({ data: fila, error }));
  const db = {
    from: (_tabla: string) => ({
      select: (_cols: string) => ({
        eq: (_campo: string, _valor: unknown) => ({ maybeSingle }),
      }),
      update: updateSpy,
    }),
  };
  return { db: db as unknown as ReturnType<typeof createAdminClient>, updateSpy, maybeSingle };
}

function filaPase(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "pase-001", serial_number: "SERIAL-001", plataforma: "apple", ...extra };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credencialesDelEntorno).mockReturnValue(CREDENCIALES);
});

// ── ÉXITO ────────────────────────────────────────────────────────────

describe("un envío que sale bien", () => {
  it("busca el pase por id, se lo pasa a entregarApple, y devuelve ok:true", async () => {
    const { db, updateSpy } = armarDb(filaPase());
    vi.mocked(createAdminClient).mockReturnValue(db);
    vi.mocked(entregarApple).mockResolvedValue({ ok: true });

    const r = await sincronizarPaseApple(job());

    expect(r).toEqual({ ok: true });
    expect(vi.mocked(entregarApple)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(entregarApple).mock.calls[0][0]).toBe(db);
    expect(vi.mocked(entregarApple).mock.calls[0][1]).toEqual([
      { id: "pase-001", serialNumber: "SERIAL-001", plataforma: "apple", miembroId: "miembro-001" },
    ]);
    // La promesa central: ni un update a pases_wallet, con éxito o sin él.
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("sirve igual para las cuatro operaciones: el push es el mismo, sin payload", async () => {
    const { db } = armarDb(filaPase());
    vi.mocked(createAdminClient).mockReturnValue(db);
    vi.mocked(entregarApple).mockResolvedValue({ ok: true });

    for (const operacion of ["saldo", "diseno", "pausa", "mensaje_promocional"] as const) {
      const r = await sincronizarPaseApple(job({ operacion }));
      expect(r).toEqual({ ok: true });
    }
  });
});

// ── FALLO PERMANENTE: sin credenciales ──────────────────────────────

describe("sin credenciales de Apple configuradas", () => {
  it("se marca DEAD (no reintentable) sin tocar la base ni a entregarApple", async () => {
    vi.mocked(credencialesDelEntorno).mockReturnValue(null);

    const r = await sincronizarPaseApple(job());

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reintentable).toBe(false);
      expect(r.motivo).toContain("no está configurado");
    }
    expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled();
    expect(vi.mocked(entregarApple)).not.toHaveBeenCalled();
  });
});

// ── FALLO PERMANENTE: trabajo mal enrutado o pase inexistente ───────

describe("un trabajo que nunca se va a arreglar reintentando", () => {
  it("plataforma distinta de apple: DEAD sin llamar a nada más", async () => {
    const r = await sincronizarPaseApple(job({ plataforma: "google" }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reintentable).toBe(false);
    expect(vi.mocked(credencialesDelEntorno)).not.toHaveBeenCalled();
    expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled();
  });

  it("el pase ya no existe: DEAD, y entregarApple no se llama", async () => {
    const { db } = armarDb(null);
    vi.mocked(createAdminClient).mockReturnValue(db);

    const r = await sincronizarPaseApple(job());

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reintentable).toBe(false);
      expect(r.motivo).toContain("ya no existe");
    }
    expect(vi.mocked(entregarApple)).not.toHaveBeenCalled();
  });

  it("el pase cambió de plataforma (ya no es de Apple): DEAD", async () => {
    const { db } = armarDb(filaPase({ plataforma: "google" }));
    vi.mocked(createAdminClient).mockReturnValue(db);

    const r = await sincronizarPaseApple(job());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reintentable).toBe(false);
    expect(vi.mocked(entregarApple)).not.toHaveBeenCalled();
  });
});

// ── FALLO TRANSITORIO: red, Supabase ─────────────────────────────────

describe("cuando algo transitorio no contesta", () => {
  it("APNs/entregarApple falla (5xx, timeout, no conecta): reintentable", async () => {
    const { db } = armarDb(filaPase());
    vi.mocked(createAdminClient).mockReturnValue(db);
    vi.mocked(entregarApple).mockResolvedValue({
      ok: false,
      motivo: "Falló el aviso a APNs: 503 Service Unavailable.",
    });

    const r = await sincronizarPaseApple(job());

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reintentable).toBe(true);
      expect(r.motivo).toContain("503");
    }
  });

  it("sin cliente de servicio (Supabase no responde): reintentable", async () => {
    vi.mocked(createAdminClient).mockReturnValue(null);

    const r = await sincronizarPaseApple(job());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reintentable).toBe(true);
    expect(vi.mocked(entregarApple)).not.toHaveBeenCalled();
  });

  it("no se pudo leer pases_wallet: reintentable, no dead", async () => {
    const { db } = armarDb(null, { message: "conexión reiniciada" });
    vi.mocked(createAdminClient).mockReturnValue(db);

    const r = await sincronizarPaseApple(job());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reintentable).toBe(true);
  });
});

// ── LA IDENTIDAD DEL PASE NUNCA SE TOCA ──────────────────────────────

describe("la identidad del pase (serial, authToken) nunca cambia por acá", () => {
  it("ni con éxito ni con fallo se emite un solo update a pases_wallet", async () => {
    const fila = filaPase();
    const copiaOriginal = { ...fila };
    const { db, updateSpy } = armarDb(fila);
    vi.mocked(createAdminClient).mockReturnValue(db);

    vi.mocked(entregarApple).mockResolvedValue({ ok: true });
    await sincronizarPaseApple(job());

    vi.mocked(entregarApple).mockResolvedValue({ ok: false, motivo: "APNs no responde." });
    await sincronizarPaseApple(job());

    expect(updateSpy).not.toHaveBeenCalled();
    // La fila leída tampoco quedó mutada en memoria.
    expect(fila).toEqual(copiaOriginal);
  });
});

// ── EL MOTIVO NUNCA PUEDE LLEVAR UN SECRETO ──────────────────────────

describe("motivoSeguro", () => {
  it("deja pasar un mensaje normal, corto, tal cual", () => {
    expect(motivoSeguro("Falló el aviso a APNs.")).toBe("Falló el aviso a APNs.");
  });

  it("tapa cualquier corrida larga de caracteres — podría ser un token o una llave", () => {
    const posibleToken = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6";
    expect(motivoSeguro(`Rechazado para el token ${posibleToken}`)).toBe(
      "Rechazado para el token [omitido]",
    );
  });

  it("recorta mensajes larguísimos en vez de guardarlos enteros", () => {
    const larguisimo = "error ".repeat(200);
    expect(motivoSeguro(larguisimo).length).toBeLessThanOrEqual(300);
  });
});
