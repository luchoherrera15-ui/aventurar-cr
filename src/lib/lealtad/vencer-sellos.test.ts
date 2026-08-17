import { describe, expect, it } from "vitest";
import { atenderMiembro, type AccionesVencimiento, type MiembroConSellos } from "./vencer-sellos";
import { referenciaDeCorte, SIN_REGLA } from "./vencimiento-sellos";

/**
 * LA PRUEBA QUE FALLA SI ALGUIEN SALTEA EL PASE.
 *
 * Este repo ya tuvo DOS bugs de la misma familia: `entregarApple`
 * empujaba a Apple sin marcar `pases_wallet.actualizado_en` (el
 * teléfono preguntaba «¿qué cambió?» y se llevaba un 204), y la ruta
 * de la API marcaba sin empujar. Las dos mitades tienen que estar, y
 * en ese orden.
 *
 * Un reinicio de sellos que no llega al teléfono es peor que los dos
 * anteriores: el cliente se para en el mostrador con una tarjeta que
 * dice «5 de 10» y el negocio tiene que explicarle que no.
 */

/** Un espía que anota, en orden, todo lo que se le pidió. */
function espia(
  respuestas: {
    ledger?: { ok: true } | { ok: false; duplicado: boolean; motivo: string };
    marcaPase?: boolean;
    reclamaAviso?: boolean;
  } = {},
): { acciones: AccionesVencimiento; pasos: string[] } {
  const pasos: string[] = [];
  const acciones: AccionesVencimiento = {
    async registrarReinicio({ referencia, sellos }) {
      pasos.push(`ledger:${sellos}:${referencia}`);
      return respuestas.ledger ?? { ok: true };
    },
    async marcarPase({ saldo }) {
      pasos.push(`marcar:${saldo}`);
      return respuestas.marcaPase ?? true;
    },
    async avisarPase() {
      pasos.push("avisar");
    },
    async reclamarAviso({ venceEl }) {
      pasos.push(`reclamar:${venceEl}`);
      return respuestas.reclamaAviso ?? true;
    },
    async enviarAviso({ venceEl }) {
      pasos.push(`correo:${venceEl}`);
    },
  };
  return { acciones, pasos };
}

const zona = "America/Costa_Rica";
/** Regla de 6 meses, encendida hace mucho: no interfiere con el caso. */
const regla = { meses: 6, desde: "2025-01-01T00:00:00.000Z" };

/** Una clienta con 5 sellos cuyo último sello fue el 3 de marzo de 2026. */
function clienta(cambios: Partial<MiembroConSellos> = {}): MiembroConSellos {
  return {
    id: "m-1",
    saldo: 5,
    ultimoMovimiento: "2026-03-03T15:00:00.000Z",
    saldoCache: 5,
    ...cambios,
  };
}

describe("atenderMiembro — el que sigue viniendo no pierde nada", () => {
  it("con el corte lejos, no se toca nada", async () => {
    const { acciones, pasos } = espia();
    const res = await atenderMiembro({
      miembro: clienta(),
      regla,
      hoy: "2026-04-01",
      zona,
      acciones,
    });
    expect(res).toBe("nada");
    expect(pasos).toEqual([]);
  });

  it("una tarjeta SIN la regla no vence nada nunca", async () => {
    const { acciones, pasos } = espia();
    const res = await atenderMiembro({
      miembro: clienta(),
      regla: SIN_REGLA,
      // Diez años después de su último sello.
      hoy: "2036-04-01",
      zona,
      acciones,
    });
    expect(res).toBe("nada");
    expect(pasos).toEqual([]);
  });

  it("sin sellos no hay nada que reiniciar (ni correo que mandar)", async () => {
    const { acciones, pasos } = espia();
    const res = await atenderMiembro({
      miembro: clienta({ saldo: 0, saldoCache: 0 }),
      regla,
      hoy: "2026-09-03",
      zona,
      acciones,
    });
    expect(res).toBe("nada");
    expect(pasos).toEqual([]);
  });
});

describe("atenderMiembro — el reinicio", () => {
  it("el día del corte: ledger, después el pase MARCADO, después el aviso", async () => {
    const { acciones, pasos } = espia();
    const res = await atenderMiembro({
      miembro: clienta(),
      regla,
      hoy: "2026-09-03",
      zona,
      acciones,
    });
    expect(res).toBe("reiniciado");
    // El orden es el contrato: marcar ANTES de empujar, o el teléfono
    // pregunta y se lleva un «no cambió nada».
    expect(pasos).toEqual([`ledger:5:${referenciaDeCorte("2026-09-03")}`, "marcar:0", "avisar"]);
  });

  it("el pase NUNCA se saltea: el reinicio siempre lo toca", async () => {
    const { acciones, pasos } = espia();
    await atenderMiembro({ miembro: clienta(), regla, hoy: "2026-11-30", zona, acciones });
    expect(pasos).toContain("marcar:0");
    expect(pasos).toContain("avisar");
  });

  it("si no se pudo marcar el pase, NO se gasta el push y se reporta", async () => {
    const { acciones, pasos } = espia({ marcaPase: false });
    const res = await atenderMiembro({
      miembro: clienta(),
      regla,
      hoy: "2026-09-03",
      zona,
      acciones,
    });
    expect(res).toBe("pase-fallido");
    expect(pasos).not.toContain("avisar");
  });

  it("un fallo del ledger no toca el pase: el saldo no se movió", async () => {
    const { acciones, pasos } = espia({
      ledger: { ok: false, duplicado: false, motivo: "se cayó la base" },
    });
    const res = await atenderMiembro({
      miembro: clienta(),
      regla,
      hoy: "2026-09-03",
      zona,
      acciones,
    });
    expect(res).toBe("fallo");
    expect(pasos).toEqual([`ledger:5:${referenciaDeCorte("2026-09-03")}`]);
  });
});

describe("atenderMiembro — idempotencia", () => {
  it("la segunda corrida choca contra el índice único y NO resta de nuevo", async () => {
    const { acciones, pasos } = espia({
      // Lo que devuelve Postgres cuando (miembro_id, referencia) ya existe.
      ledger: { ok: false, duplicado: true, motivo: "duplicate key value" },
    });
    const res = await atenderMiembro({
      miembro: clienta(),
      regla,
      hoy: "2026-09-03",
      zona,
      acciones,
    });
    expect(res).toBe("reinicio-repetido");
    // Pero el pase SÍ se vuelve a tocar: si la corrida anterior se cayó
    // justo después del ledger, esta es la única que cura el teléfono.
    expect(pasos).toEqual([`ledger:5:${referenciaDeCorte("2026-09-03")}`, "marcar:0", "avisar"]);
  });

  it("una corrida ATRASADA usa la misma llave que la del día", async () => {
    const { acciones: a1, pasos: p1 } = espia();
    const { acciones: a2, pasos: p2 } = espia();
    await atenderMiembro({ miembro: clienta(), regla, hoy: "2026-09-03", zona, acciones: a1 });
    await atenderMiembro({ miembro: clienta(), regla, hoy: "2026-09-06", zona, acciones: a2 });
    expect(p1[0]).toBe(p2[0]);
  });
});

describe("atenderMiembro — el aviso, uno solo", () => {
  it("dentro de la ventana: se reclama y recién ahí se manda", async () => {
    const { acciones, pasos } = espia();
    const res = await atenderMiembro({
      miembro: clienta(),
      regla,
      hoy: "2026-08-25", // 9 días antes del 3 de setiembre
      zona,
      acciones,
    });
    expect(res).toBe("avisado");
    // Reclamar ANTES de mandar: un «¿ya se avisó?» tiene una ventana
    // por la que pasan dos corridas y el cliente recibe dos correos.
    expect(pasos).toEqual(["reclamar:2026-09-03", "correo:2026-09-03"]);
  });

  it("si otra corrida ya lo reclamó, no sale un segundo correo", async () => {
    const { acciones, pasos } = espia({ reclamaAviso: false });
    const res = await atenderMiembro({
      miembro: clienta(),
      regla,
      hoy: "2026-08-25",
      zona,
      acciones,
    });
    expect(res).toBe("aviso-repetido");
    expect(pasos).toEqual(["reclamar:2026-09-03"]);
  });

  it("y al día siguiente TAMPOCO, aunque el cron vuelva a correr", async () => {
    // La llave del aviso es (miembro, fecha de corte) y la fecha de
    // corte no cambia si el cliente no vuelve: los catorce días de la
    // ventana producen el mismo reclamo, que la base rechaza.
    const { pasos: p1, acciones: a1 } = espia();
    const { pasos: p2, acciones: a2 } = espia({ reclamaAviso: false });
    await atenderMiembro({ miembro: clienta(), regla, hoy: "2026-08-25", zona, acciones: a1 });
    await atenderMiembro({ miembro: clienta(), regla, hoy: "2026-08-26", zona, acciones: a2 });
    expect(p1[0]).toBe("reclamar:2026-09-03");
    expect(p2).toEqual(["reclamar:2026-09-03"]);
  });
});

describe("atenderMiembro — el espejo torcido se realinea", () => {
  it("un pase que quedó mostrando el saldo viejo se vuelve a marcar", async () => {
    const { acciones, pasos } = espia();
    const res = await atenderMiembro({
      // El ledger dice 0 (ya se reinició) pero el pase muestra 5: es lo
      // que queda si una corrida anterior se cayó entre el ledger y el
      // teléfono. Sin esta red, ese pase miente para siempre.
      miembro: clienta({ saldo: 0, saldoCache: 5 }),
      regla,
      hoy: "2026-04-01",
      zona,
      acciones,
    });
    expect(res).toBe("pase-realineado");
    expect(pasos).toEqual(["marcar:0", "avisar"]);
  });

  it("si el espejo ya coincide, no se le empuja nada a Apple", async () => {
    const { acciones, pasos } = espia();
    await atenderMiembro({
      miembro: clienta({ saldo: 5, saldoCache: 5 }),
      regla,
      hoy: "2026-04-01",
      zona,
      acciones,
    });
    expect(pasos).toEqual([]);
  });

  it("sin pase de Apple no hay nada que realinear", async () => {
    const { acciones, pasos } = espia();
    await atenderMiembro({
      miembro: clienta({ saldo: 5, saldoCache: null }),
      regla,
      hoy: "2026-04-01",
      zona,
      acciones,
    });
    expect(pasos).toEqual([]);
  });
});
