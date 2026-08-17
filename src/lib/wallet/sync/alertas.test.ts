import { describe, expect, it } from "vitest";
import type { EstadoPresencia } from "../config/inventario";
import {
  chequearApnsRechazados,
  chequearCertificadoProximoAVencer,
  chequearGoogleAuthError,
  chequearJobsMuertos,
  chequearJobsRetryablesAcumulados,
  chequearPayloadGoogleDivergente,
  chequearRegistroAppleSinActividad,
  chequearSecretoHmacFaltante,
  chequearVersionPaseDivergente,
  evaluarAlertasWalletV2,
  MUESTRA_MINIMA_APNS,
  UMBRAL_DIAS_CERTIFICADO_PROXIMO_A_VENCER,
  UMBRAL_DIAS_REGISTRO_APPLE_SIN_ACTIVIDAD,
  UMBRAL_JOBS_DEAD,
  UMBRAL_JOBS_RETRYABLE_ACUMULADOS,
  UMBRAL_TASA_APNS_RECHAZADOS,
} from "./alertas";

/**
 * ETAPA 17 (Wallet V2) — las 9 comprobaciones de `alertas.ts`, cada una
 * con un caso que SÍ dispara y uno que NO. Todo puro: ningún test de
 * este archivo toca Supabase, APNs ni Google — son fixtures de estado
 * ya "consultado" a mano, exactamente lo que las funciones reciben en
 * producción.
 */

function isoHaceDias(dias: number, ahora: Date): string {
  return new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();
}

describe("chequearJobsRetryablesAcumulados()", () => {
  it("no alerta por debajo del umbral", () => {
    expect(chequearJobsRetryablesAcumulados(UMBRAL_JOBS_RETRYABLE_ACUMULADOS - 1)).toBeNull();
  });

  it("alerta (advertencia) al llegar al umbral", () => {
    const a = chequearJobsRetryablesAcumulados(UMBRAL_JOBS_RETRYABLE_ACUMULADOS);
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("advertencia");
    expect(a!.tipo).toBe("jobs_retryable_acumulados");
    expect(a!.contexto.cantidad).toBe(UMBRAL_JOBS_RETRYABLE_ACUMULADOS);
  });

  it("respeta un umbral custom", () => {
    expect(chequearJobsRetryablesAcumulados(5, 10)).toBeNull();
    expect(chequearJobsRetryablesAcumulados(10, 10)).not.toBeNull();
  });
});

describe("chequearJobsMuertos()", () => {
  it("cero jobs muertos: sin alerta", () => {
    expect(chequearJobsMuertos(0)).toBeNull();
  });

  it("un solo job dead ya alerta (severidad crítica) — umbral por defecto es 1", () => {
    expect(UMBRAL_JOBS_DEAD).toBe(1);
    const a = chequearJobsMuertos(1);
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("critica");
    expect(a!.tipo).toBe("jobs_dead");
  });
});

describe("chequearApnsRechazados()", () => {
  it("no alerta con una muestra menor a la mínima, aunque la tasa sea 100%", () => {
    expect(MUESTRA_MINIMA_APNS).toBeGreaterThan(1);
    const a = chequearApnsRechazados({ intentos: 1, rechazados: 1, ventanaMinutos: 15 });
    expect(a).toBeNull();
  });

  it("no alerta con muestra suficiente pero tasa baja", () => {
    const a = chequearApnsRechazados({ intentos: 20, rechazados: 1, ventanaMinutos: 15 });
    expect(a).toBeNull();
  });

  it("alerta (crítica) con muestra suficiente y tasa sobre el umbral", () => {
    const a = chequearApnsRechazados({ intentos: 10, rechazados: 3, ventanaMinutos: 15 });
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("critica");
    expect(a!.contexto.tasa).toBeCloseTo(0.3);
  });

  it("respeta umbralTasa/muestraMinima custom", () => {
    expect(chequearApnsRechazados({ intentos: 3, rechazados: 3, ventanaMinutos: 5 }, { muestraMinima: 2 })).not.toBeNull();
    expect(
      chequearApnsRechazados({ intentos: 10, rechazados: 1, ventanaMinutos: 5 }, { umbralTasa: 0.5 }),
    ).toBeNull();
  });

  it("el umbral de tasa por defecto documentado sigue siendo 20%", () => {
    expect(UMBRAL_TASA_APNS_RECHAZADOS).toBe(0.2);
  });
});

describe("chequearGoogleAuthError()", () => {
  it("sin 401: sin alerta", () => {
    expect(chequearGoogleAuthError({ hubo401: false })).toBeNull();
  });

  it("con 401: alerta crítica, cualquier cantidad (any)", () => {
    const a = chequearGoogleAuthError({ hubo401: true });
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("critica");
    expect(a!.tipo).toBe("google_auth_error");
  });

  it("sanea un detalle con pinta de secreto antes de ponerlo en el mensaje", () => {
    const secreto = "A".repeat(40);
    const a = chequearGoogleAuthError({ hubo401: true, detalle: `Google respondió 401: token=${secreto}` });
    expect(a).not.toBeNull();
    expect(a!.mensaje).not.toContain(secreto);
    expect(JSON.stringify(a!.contexto)).not.toContain(secreto);
  });
});

describe("chequearCertificadoProximoAVencer()", () => {
  const ahora = new Date("2026-08-16T12:00:00Z");

  it("sin venceEl: no hay dato, no se inventa una alerta", () => {
    expect(chequearCertificadoProximoAVencer({ venceEl: null }, undefined, ahora)).toBeNull();
  });

  it("vence lejos (más allá del umbral): sin alerta", () => {
    const lejos = new Date(ahora.getTime() + (UMBRAL_DIAS_CERTIFICADO_PROXIMO_A_VENCER + 10) * 24 * 60 * 60 * 1000);
    const a = chequearCertificadoProximoAVencer({ venceEl: lejos.toISOString().slice(0, 10) }, undefined, ahora);
    expect(a).toBeNull();
  });

  it("vence dentro del umbral: advertencia", () => {
    const cerca = new Date(ahora.getTime() + (UMBRAL_DIAS_CERTIFICADO_PROXIMO_A_VENCER - 5) * 24 * 60 * 60 * 1000);
    const a = chequearCertificadoProximoAVencer({ venceEl: cerca.toISOString().slice(0, 10) }, undefined, ahora);
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("advertencia");
  });

  it("ya venció: crítica, con días negativos en el contexto", () => {
    const pasado = new Date(ahora.getTime() - 3 * 24 * 60 * 60 * 1000);
    const a = chequearCertificadoProximoAVencer({ venceEl: pasado.toISOString().slice(0, 10) }, undefined, ahora);
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("critica");
    expect((a!.contexto.diasRestantes as number)).toBeLessThan(0);
  });
});

describe("chequearSecretoHmacFaltante()", () => {
  const presenteFaltando: EstadoPresencia[] = [
    { variable: "APPLE_PASS_CERT_B64", presente: true, obligatoria: true },
    { variable: "APPLE_PASS_AUTH_SECRET_V1", presente: false, obligatoria: false },
  ];
  const presenteOk: EstadoPresencia[] = [
    { variable: "APPLE_PASS_CERT_B64", presente: true, obligatoria: true },
    { variable: "APPLE_PASS_AUTH_SECRET_V1", presente: true, obligatoria: false },
  ];

  it("falta el secreto pero NINGÚN pase lo necesita todavía: sin alerta (ausencia válida, Fase 2C)", () => {
    expect(chequearSecretoHmacFaltante(presenteFaltando, false)).toBeNull();
  });

  it("el secreto está presente, aunque haya pases HMAC: sin alerta", () => {
    expect(chequearSecretoHmacFaltante(presenteOk, true)).toBeNull();
  });

  it("falta el secreto Y YA hay pases con auth_token_version >= 1: alerta crítica", () => {
    const a = chequearSecretoHmacFaltante(presenteFaltando, true);
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("critica");
    expect(a!.tipo).toBe("secreto_hmac_faltante");
  });

  it("variable ausente del propio inventario (no solo presente:false): se trata igual que 'falta'", () => {
    const a = chequearSecretoHmacFaltante([{ variable: "APPLE_PASS_CERT_B64", presente: true, obligatoria: true }], true);
    expect(a).not.toBeNull();
  });
});

describe("chequearRegistroAppleSinActividad()", () => {
  const ahora = new Date("2026-08-16T12:00:00Z");

  it("sin dispositivos registrados: la alerta no aplica", () => {
    const a = chequearRegistroAppleSinActividad(
      { dispositivosRegistrados: 0, dispositivoUltimoRegistroEn: null, paseUltimaDescargaEn: null },
      undefined,
      ahora,
    );
    expect(a).toBeNull();
  });

  it("registrado con actividad reciente (dentro del umbral): sin alerta", () => {
    const a = chequearRegistroAppleSinActividad(
      {
        dispositivosRegistrados: 1,
        dispositivoUltimoRegistroEn: isoHaceDias(2, ahora),
        paseUltimaDescargaEn: isoHaceDias(1, ahora),
      },
      undefined,
      ahora,
    );
    expect(a).toBeNull();
  });

  it("registrado pero sin actividad hace más del umbral: advertencia", () => {
    const a = chequearRegistroAppleSinActividad(
      {
        dispositivosRegistrados: 1,
        dispositivoUltimoRegistroEn: isoHaceDias(UMBRAL_DIAS_REGISTRO_APPLE_SIN_ACTIVIDAD + 5, ahora),
        paseUltimaDescargaEn: null,
      },
      undefined,
      ahora,
    );
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("advertencia");
  });

  it("usa la señal MÁS RECIENTE entre registro y descarga para decidir", () => {
    // El registro es viejo, pero la descarga es reciente: no debería alertar.
    const a = chequearRegistroAppleSinActividad(
      {
        dispositivosRegistrados: 1,
        dispositivoUltimoRegistroEn: isoHaceDias(UMBRAL_DIAS_REGISTRO_APPLE_SIN_ACTIVIDAD + 100, ahora),
        paseUltimaDescargaEn: isoHaceDias(1, ahora),
      },
      undefined,
      ahora,
    );
    expect(a).toBeNull();
  });

  it("registrado sin NINGUNA fecha de actividad utilizable: se trata como sin actividad desde siempre", () => {
    const a = chequearRegistroAppleSinActividad(
      { dispositivosRegistrados: 2, dispositivoUltimoRegistroEn: null, paseUltimaDescargaEn: null },
      undefined,
      ahora,
    );
    expect(a).not.toBeNull();
    expect(a!.contexto.diasSinActividad).toBeNull();
  });
});

describe("chequearVersionPaseDivergente()", () => {
  it("sin ningún envío confirmado todavía (null): no es divergencia", () => {
    const a = chequearVersionPaseDivergente({ paseId: "pase-1", updateTagActual: 3, versionUltimoJobExitoso: null });
    expect(a).toBeNull();
  });

  it("coinciden: sin alerta", () => {
    const a = chequearVersionPaseDivergente({ paseId: "pase-1", updateTagActual: 3, versionUltimoJobExitoso: 3 });
    expect(a).toBeNull();
  });

  it("divergen: advertencia con ambas versiones en el contexto", () => {
    const a = chequearVersionPaseDivergente({ paseId: "pase-1", updateTagActual: 5, versionUltimoJobExitoso: 3 });
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("advertencia");
    expect(a!.contexto).toEqual({ paseId: "pase-1", updateTagActual: 5, versionUltimoJobExitoso: 3 });
  });
});

describe("chequearPayloadGoogleDivergente()", () => {
  it("sin hash local: no hay base para comparar, sin alerta", () => {
    expect(chequearPayloadGoogleDivergente({ paseId: "p1", hashLocal: null, hashRemoto: "abc" })).toBeNull();
  });

  it("sin hash remoto: no hay base para comparar, sin alerta", () => {
    expect(chequearPayloadGoogleDivergente({ paseId: "p1", hashLocal: "abc", hashRemoto: null })).toBeNull();
  });

  it("los dos hashes coinciden: sin alerta", () => {
    expect(chequearPayloadGoogleDivergente({ paseId: "p1", hashLocal: "abc", hashRemoto: "abc" })).toBeNull();
  });

  it("los hashes difieren: advertencia", () => {
    const a = chequearPayloadGoogleDivergente({ paseId: "p1", hashLocal: "abc", hashRemoto: "xyz" });
    expect(a).not.toBeNull();
    expect(a!.severidad).toBe("advertencia");
    expect(a!.tipo).toBe("payload_google_divergente");
  });
});

describe("evaluarAlertasWalletV2() — el agregador, sigue sin mandar nada", () => {
  it("estado vacío: ninguna alerta", () => {
    expect(evaluarAlertasWalletV2({})).toEqual([]);
  });

  it("campos omitidos se saltan (no revientan)", () => {
    expect(() => evaluarAlertasWalletV2({ jobsMuertos: 0 })).not.toThrow();
    expect(evaluarAlertasWalletV2({ jobsMuertos: 0 })).toEqual([]);
  });

  it("junta alertas de varias comprobaciones a la vez, en cualquier combinación", () => {
    const ahora = new Date("2026-08-16T12:00:00Z");
    const alertas = evaluarAlertasWalletV2(
      {
        jobsRetryablesAcumulados: UMBRAL_JOBS_RETRYABLE_ACUMULADOS,
        jobsMuertos: 2,
        googleAuthError: { hubo401: true },
        apns: { intentos: 1, rechazados: 1, ventanaMinutos: 5 }, // bajo la muestra mínima: no debería alertar
        pasesConVersionDivergente: [{ paseId: "p1", updateTagActual: 4, versionUltimoJobExitoso: 3 }],
      },
      ahora,
    );

    const tipos = alertas.map((a) => a.tipo).sort();
    expect(tipos).toEqual(["google_auth_error", "jobs_dead", "jobs_retryable_acumulados", "version_pase_divergente"].sort());
  });

  it("evalúa una LISTA de registros/pases divergentes, una alerta por cada uno que dispare", () => {
    const alertas = evaluarAlertasWalletV2({
      pasesConVersionDivergente: [
        { paseId: "ok", updateTagActual: 1, versionUltimoJobExitoso: 1 },
        { paseId: "diverge-1", updateTagActual: 2, versionUltimoJobExitoso: 1 },
        { paseId: "diverge-2", updateTagActual: 5, versionUltimoJobExitoso: 4 },
      ],
    });
    expect(alertas).toHaveLength(2);
    expect(alertas.map((a) => a.contexto.paseId).sort()).toEqual(["diverge-1", "diverge-2"]);
  });

  it("ninguna alerta generada por el agregador incluye nunca la palabra 'token' seguida de un valor largo (chequeo de forma, no de contenido real)", () => {
    const alertas = evaluarAlertasWalletV2({
      googleAuthError: { hubo401: true, detalle: `Bearer ${"x".repeat(50)}` },
    });
    for (const a of alertas) {
      expect(JSON.stringify(a)).not.toMatch(/x{40,}/);
    }
  });
});
