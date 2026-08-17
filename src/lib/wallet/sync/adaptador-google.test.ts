import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El adaptador de Google del worker de sincronización, contra una base
 * y una red de mentira — igual que `aviso-de-pausa.test.ts` y
 * `aviso-de-diseno.ts` mockean `../google` para probar el RECORRIDO sin
 * tocar la API real.
 *
 * Tres bloques:
 *   1. Despacho — qué le pasa `sincronizarPaseGoogle` a cada camino
 *      (saldo/diseño/pausa, mensaje promocional, fencing de versión,
 *      plataforma equivocada, sin conexión), con `../google` mockeado
 *      entero.
 *   2. Clasificación — `clasificarMotivoGoogle` es pura: un `motivo`
 *      adentro, una decisión `succeeded`/`retryable`/`dead` afuera. Sin
 *      red, sin base.
 *   3. Fusión — la propiedad central del adaptador ("el PATCH nunca
 *      pisa lo que no manda") probada contra el `contenidoDelObjeto`
 *      REAL de `../google` (sin mockear, vía `importOriginal`): un
 *      objeto remoto de mentira con `textModulesData`/
 *      `imageModulesData`/`linksModuleData`/`barcode` puestos, se
 *      fusiona con el cuerpo real de un PATCH de saldo, y esos cuatro
 *      campos tienen que sobrevivir intactos.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("../google", async (importOriginal) => {
  const real = await importOriginal<typeof import("../google")>();
  return {
    ...real,
    refrescarPaseGoogleDeMiembro: vi.fn(),
    enviarMensajeGoogle: vi.fn(),
  };
});

import { createAdminClient } from "@/lib/supabase/admin";
import { contenidoDelObjeto, enviarMensajeGoogle, refrescarPaseGoogleDeMiembro } from "../google";
import { clasificarMotivoGoogle, sincronizarPaseGoogle } from "./adaptador-google";
import type { TrabajoSync } from "./tipos";

// ── Una base de mentira mínima: solo lo que este adaptador consulta ──

type Fila = Record<string, unknown>;

function dbDeMentira(tablas: { pases_wallet?: Fila[]; programa_lealtad?: Fila[] } = {}) {
  const datos = { pases_wallet: tablas.pases_wallet ?? [], programa_lealtad: tablas.programa_lealtad ?? [] };
  return {
    from(tabla: "pases_wallet" | "programa_lealtad") {
      return {
        select: () => ({
          eq: (campo: string, valor: unknown) => ({
            maybeSingle: async () => {
              const fila = datos[tabla].find((f) => f[campo] === valor) ?? null;
              return { data: fila, error: null };
            },
          }),
        }),
      };
    },
  };
}

const JOB_BASE: TrabajoSync = {
  id: "trabajo-1",
  cuentaId: "cuenta-1",
  programaId: "programa-1",
  miembroId: "miembro-1",
  paseId: "pase-1",
  plataforma: "google",
  operacion: "saldo",
  idempotencyKey: "clave-1",
  correlationId: "correlacion-1",
  versionLocalEsperada: null,
  intentos: 0,
  maxIntentos: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refrescarPaseGoogleDeMiembro).mockResolvedValue({ ok: true });
  vi.mocked(enviarMensajeGoogle).mockResolvedValue({ ok: true });
  vi.mocked(createAdminClient).mockReturnValue(dbDeMentira() as unknown as ReturnType<typeof createAdminClient>);
});

// ── 1. DESPACHO ──────────────────────────────────────────────────────

describe("sincronizarPaseGoogle: despacho por operación", () => {
  it("saldo/diseno/pausa llaman a refrescarPaseGoogleDeMiembro con el miembroId", async () => {
    for (const operacion of ["saldo", "diseno", "pausa"] as const) {
      vi.mocked(refrescarPaseGoogleDeMiembro).mockClear();
      const r = await sincronizarPaseGoogle({ ...JOB_BASE, operacion });
      expect(r).toEqual({ ok: true });
      expect(refrescarPaseGoogleDeMiembro).toHaveBeenCalledWith("miembro-1");
    }
  });

  it("una llamada exitosa (PATCH ok) da succeeded", async () => {
    vi.mocked(refrescarPaseGoogleDeMiembro).mockResolvedValue({ ok: true });
    const r = await sincronizarPaseGoogle(JOB_BASE);
    expect(r).toEqual({ ok: true });
  });

  it("mensaje_promocional lee programa_lealtad.mensaje_promocional y lo manda", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      dbDeMentira({
        programa_lealtad: [{ id: "programa-1", mensaje_promocional: "Miércoles matchas 2x1" }],
      }) as unknown as ReturnType<typeof createAdminClient>,
    );
    const r = await sincronizarPaseGoogle({ ...JOB_BASE, operacion: "mensaje_promocional" });
    expect(r).toEqual({ ok: true });
    expect(enviarMensajeGoogle).toHaveBeenCalledWith("miembro-1", "Miércoles matchas 2x1");
  });

  it("mensaje_promocional sin mensaje guardado no llama a Google (nada que mandar)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      dbDeMentira({ programa_lealtad: [{ id: "programa-1", mensaje_promocional: null }] }) as unknown as ReturnType<
        typeof createAdminClient
      >,
    );
    const r = await sincronizarPaseGoogle({ ...JOB_BASE, operacion: "mensaje_promocional" });
    expect(r).toEqual({ ok: true });
    expect(enviarMensajeGoogle).not.toHaveBeenCalled();
  });

  it("rechaza un trabajo cuya plataforma no es google, sin llamar a nada", async () => {
    const r = await sincronizarPaseGoogle({ ...JOB_BASE, plataforma: "apple" });
    expect(r).toMatchObject({ ok: false, reintentable: false });
    expect(refrescarPaseGoogleDeMiembro).not.toHaveBeenCalled();
  });

  it("sin conexión de servicio, retryable (no dead: puede arreglarse solo)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(null);
    const r = await sincronizarPaseGoogle(JOB_BASE);
    expect(r).toMatchObject({ ok: false, reintentable: true });
    expect(refrescarPaseGoogleDeMiembro).not.toHaveBeenCalled();
  });

  it("nunca lanza: un throw inesperado se convierte en retryable", async () => {
    vi.mocked(refrescarPaseGoogleDeMiembro).mockRejectedValue(new Error("boom"));
    const r = await sincronizarPaseGoogle(JOB_BASE);
    expect(r).toMatchObject({ ok: false, reintentable: true, motivo: expect.stringContaining("boom") });
  });
});

describe("sincronizarPaseGoogle: fencing de versión (update_tag)", () => {
  it("versionLocalEsperada null no consulta el pase, procesa igual", async () => {
    const r = await sincronizarPaseGoogle({ ...JOB_BASE, versionLocalEsperada: null });
    expect(r).toEqual({ ok: true });
    expect(refrescarPaseGoogleDeMiembro).toHaveBeenCalled();
  });

  it("update_tag distinto: el trabajo quedó viejo, se salta sin llamar a Google", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      dbDeMentira({ pases_wallet: [{ id: "pase-1", update_tag: 5 }] }) as unknown as ReturnType<
        typeof createAdminClient
      >,
    );
    const r = await sincronizarPaseGoogle({ ...JOB_BASE, versionLocalEsperada: 3 });
    expect(r).toEqual({ ok: true });
    expect(refrescarPaseGoogleDeMiembro).not.toHaveBeenCalled();
  });

  it("update_tag igual: sigue vigente, se procesa", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      dbDeMentira({ pases_wallet: [{ id: "pase-1", update_tag: 3 }] }) as unknown as ReturnType<
        typeof createAdminClient
      >,
    );
    const r = await sincronizarPaseGoogle({ ...JOB_BASE, versionLocalEsperada: 3 });
    expect(r).toEqual({ ok: true });
    expect(refrescarPaseGoogleDeMiembro).toHaveBeenCalled();
  });

  it("pase inexistente (huérfano): no se descarta por las dudas, se procesa", async () => {
    const r = await sincronizarPaseGoogle({ ...JOB_BASE, versionLocalEsperada: 3 }); // dbDeMentira() vacía
    expect(r).toEqual({ ok: true });
    expect(refrescarPaseGoogleDeMiembro).toHaveBeenCalled();
  });
});

// ── 2. CLASIFICACIÓN, PURA ───────────────────────────────────────────

describe("clasificarMotivoGoogle", () => {
  it("401 es dead: no se arregla solo reintentando", () => {
    const r = clasificarMotivoGoogle("Google respondió 401 al parchar el objeto.");
    expect(r).toEqual({
      ok: false,
      reintentable: false,
      motivo: "Google rechazó la credencial (401): Google respondió 401 al parchar el objeto.",
    });
  });

  it("404 es dead: este worker no crea objetos", () => {
    const r = clasificarMotivoGoogle("Google respondió 404 al parchar el objeto.");
    expect(r).toMatchObject({ ok: false, reintentable: false });
    expect((r as { motivo: string }).motivo).toContain("404");
  });

  it("409 (conflicto) es retryable", () => {
    const r = clasificarMotivoGoogle("Google respondió 409 al parchar el objeto.");
    expect(r).toEqual({ ok: false, reintentable: true, motivo: "Google respondió 409 al parchar el objeto." });
  });

  it("429 (cuota) es retryable", () => {
    const r = clasificarMotivoGoogle("Google respondió 429 al parchar el objeto.");
    expect(r).toMatchObject({ ok: false, reintentable: true });
  });

  it("5xx es retryable", () => {
    expect(clasificarMotivoGoogle("Google respondió 500 al parchar el objeto.")).toMatchObject({
      ok: false,
      reintentable: true,
    });
    expect(clasificarMotivoGoogle("Google respondió 503 al parchar el objeto.")).toMatchObject({
      ok: false,
      reintentable: true,
    });
  });

  it("otro 4xx (400, 403) es dead: el dato que se mandó está mal, reintentar no lo arregla", () => {
    expect(clasificarMotivoGoogle("Google respondió 400 al parchar el objeto.")).toMatchObject({
      ok: false,
      reintentable: false,
    });
    expect(clasificarMotivoGoogle("Google respondió 403 al parchar el objeto.")).toMatchObject({
      ok: false,
      reintentable: false,
    });
  });

  it("sin código HTTP reconocible (red caída, OAuth sin configurar) es retryable", () => {
    expect(clasificarMotivoGoogle("Google Wallet no está configurado en este servidor.")).toMatchObject({
      ok: false,
      reintentable: true,
    });
    expect(clasificarMotivoGoogle("fetch failed")).toMatchObject({ ok: false, reintentable: true });
  });

  it("nunca deja pasar la llave privada de la cuenta de servicio ni un bearer token", () => {
    const conClave = clasificarMotivoGoogle(
      "OAuth de Google respondió 401: -----BEGIN PRIVATE KEY-----\nMIIEv...secreto...\n-----END PRIVATE KEY-----",
    );
    expect((conClave as { motivo: string }).motivo).not.toContain("MIIEv");
    expect((conClave as { motivo: string }).motivo).toContain("[clave omitida]");

    const conBearer = clasificarMotivoGoogle("Google respondió 500: Authorization: Bearer ya29.a0AfH6SMC_secreto");
    expect((conBearer as { motivo: string }).motivo).not.toContain("ya29.a0AfH6SMC_secreto");
  });
});

// ── 3. FUSIÓN: el PATCH nunca pisa lo que no manda ──────────────────

describe("el PATCH de saldo nunca pisa lo que no manda", () => {
  it("un objeto remoto con textModulesData/imageModulesData/linksModuleData/barcode sobrevive intacto a un PATCH de saldo", () => {
    // El objeto tal como YA está guardado en Google — con cosas que
    // `contenidoDelObjeto` (el cuerpo del PATCH) JAMÁS toca.
    const objetoRemotoActual = {
      id: "3388000000023187944.miembro_abc123",
      classId: "3388000000023187944.negocio_def456",
      state: "ACTIVE",
      accountId: "miembro-1",
      accountName: "Luis",
      barcode: { type: "QR_CODE", value: "serial-del-escaner", alternateText: "Tarjeta Bookea" },
      loyaltyPoints: { label: "Puntos", balance: { int: 3 } },
      textModulesData: [{ id: "cupon", header: "Cómo se usa", body: "Presentá este pase en caja." }],
      imageModulesData: [{ mainImage: { sourceUri: { uri: "https://ejemplo.test/promo.png" } } }],
      linksModuleData: { uris: [{ uri: "https://ejemplo.test", description: "Sitio del negocio" }] },
    };

    // El cuerpo REAL de un PATCH de saldo — la misma función que usa
    // `refrescarPaseGoogleDeMiembro` en producción, sin mockear.
    const cuerpoDelPatch = contenidoDelObjeto({
      negocioNombre: "Rancho Las Torres",
      saldo: 10,
      config: {
        modo: "puntos",
        pase_color_fondo: "#9ebdff",
        pase_color_sello: "#f57600",
        pase_logo_url: null,
      },
      meta: null,
      beneficio: null,
      // undefined a propósito: es el camino de un refresco de SALDO
      // sin que cambie el estado de pausa — el mismo que usa
      // `construirObjeto` al crear el pase.
    });

    // Un PATCH real en la API de Google Wallet es un merge: los campos
    // ausentes del cuerpo quedan como estaban. Se simula acá con un
    // spread superficial — es exactamente la semántica que Google
    // documenta para este endpoint.
    const objetoFusionado = { ...objetoRemotoActual, ...cuerpoDelPatch };

    // Lo que cambió: el saldo.
    expect(objetoFusionado.loyaltyPoints).toEqual({ label: "Puntos", balance: { int: 10 } });

    // Lo que NO viajó en el PATCH tiene que seguir ahí, byte a byte.
    expect(objetoFusionado.textModulesData).toEqual(objetoRemotoActual.textModulesData);
    expect(objetoFusionado.imageModulesData).toEqual(objetoRemotoActual.imageModulesData);
    expect(objetoFusionado.linksModuleData).toEqual(objetoRemotoActual.linksModuleData);
    expect(objetoFusionado.barcode).toEqual(objetoRemotoActual.barcode);
    expect(objetoFusionado.classId).toBe(objetoRemotoActual.classId);
    expect(objetoFusionado.accountId).toBe(objetoRemotoActual.accountId);

    // Y la prueba de que esto no es un accidente de este fixture: el
    // cuerpo del PATCH mismo nunca declaró esas cuatro llaves.
    expect(Object.keys(cuerpoDelPatch)).not.toContain("imageModulesData");
    expect(Object.keys(cuerpoDelPatch)).not.toContain("linksModuleData");
    expect(Object.keys(cuerpoDelPatch)).not.toContain("barcode");
  });
});
