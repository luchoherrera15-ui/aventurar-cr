import { describe, expect, it } from "vitest";
import {
  DIAS_DE_AVISO,
  diasEntreISO,
  fechaDeCorte,
  mesesGuardables,
  motivoDeCorte,
  referenciaDeCorte,
  reglaDeFila,
  relojDeVencimiento,
  sumarMesesISO,
  veredicto,
  SIN_REGLA,
} from "./vencimiento-sellos";

/**
 * LA REGLA QUE LE QUITA SELLOS A ALGUIEN, PROBADA SIN BASE DE DATOS.
 *
 * Cada uno de estos casos es un reclamo en un mostrador que no va a
 * pasar: el que sigue viniendo, el que se afilió ayer, el que vive en
 * otro país, el negocio que acaba de encender la regla, y el que nunca
 * la encendió.
 */

describe("reglaDeFila — de qué tarjetas hablamos", () => {
  it("una tarjeta de sellos con la regla puesta la trae", () => {
    expect(
      reglaDeFila({ modo: "sellos", sellos_vencen_meses: 6, sellos_vencen_desde: "2026-01-01T00:00:00Z" }),
    ).toEqual({ meses: 6, desde: "2026-01-01T00:00:00Z" });
  });

  it("SIN la regla no vence nada — el caso de casi todas", () => {
    expect(reglaDeFila({ modo: "sellos" })).toEqual(SIN_REGLA);
    expect(reglaDeFila({ modo: "sellos", sellos_vencen_meses: null })).toEqual(SIN_REGLA);
  });

  it("la fila SIN las columnas (0180 sin pegar) tampoco vence nada", () => {
    expect(reglaDeFila({ modo: "sellos", nombre: "Café" })).toEqual(SIN_REGLA);
  });

  it("los otros siete tipos NO vencen, aunque la columna diga otra cosa", () => {
    for (const modo of ["puntos", "cashback", "giftcard", "cupon", "descuento", "membresia", "evento"]) {
      expect(reglaDeFila({ modo, sellos_vencen_meses: 3 })).toEqual(SIN_REGLA);
    }
  });

  it("recorta un valor absurdo en vez de creerle", () => {
    expect(reglaDeFila({ modo: "sellos", sellos_vencen_meses: 9999 }).meses).toBe(60);
    expect(reglaDeFila({ modo: "sellos", sellos_vencen_meses: 0 })).toEqual(SIN_REGLA);
    expect(reglaDeFila({ modo: "sellos", sellos_vencen_meses: 3.5 })).toEqual(SIN_REGLA);
  });
});

describe("sumarMesesISO — el 31 de enero más un mes", () => {
  it("no se desborda al mes siguiente", () => {
    // Con `Date` puro esto daría el 3 de marzo, y el cliente perdería
    // sus sellos tres días antes de lo prometido.
    expect(sumarMesesISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMesesISO("2028-01-31", 1)).toBe("2028-02-29"); // bisiesto
  });

  it("cruza el año", () => {
    expect(sumarMesesISO("2026-11-15", 3)).toBe("2027-02-15");
    expect(sumarMesesISO("2026-08-17", 12)).toBe("2027-08-17");
  });

  it("el día normal se conserva", () => {
    expect(sumarMesesISO("2026-03-03", 6)).toBe("2026-09-03");
  });
});

describe("diasEntreISO", () => {
  it("cuenta días enteros, y negativo si ya pasó", () => {
    expect(diasEntreISO("2026-08-17", "2026-08-31")).toBe(14);
    expect(diasEntreISO("2026-08-17", "2026-08-17")).toBe(0);
    expect(diasEntreISO("2026-08-31", "2026-08-17")).toBe(-14);
  });
});

describe("fechaDeCorte — el reloj de cada cliente", () => {
  const regla = { meses: 6, desde: "2026-01-01T00:00:00.000Z" };

  it("cuenta desde el ÚLTIMO movimiento, no desde una fecha fija", () => {
    expect(
      fechaDeCorte({
        regla,
        ultimoMovimiento: "2026-03-03T15:00:00.000Z",
        zona: "America/Costa_Rica",
      }),
    ).toBe("2026-09-03");
  });

  it("sin regla no hay corte", () => {
    expect(
      fechaDeCorte({ regla: SIN_REGLA, ultimoMovimiento: "2026-03-03T15:00:00.000Z", zona: null }),
    ).toBeNull();
  });

  it("sin movimientos no hay nada que vencer", () => {
    expect(fechaDeCorte({ regla, ultimoMovimiento: null, zona: null })).toBeNull();
  });

  // ── ZONA HORARIA ─────────────────────────────────────────────────
  // El servidor corre en UTC, seis horas adelantado de Costa Rica. Un
  // sello dado a las 7 de la noche del 3 es, en UTC, del día 4 — y el
  // corte se correría un día entero.
  it("un sello de las 7 p. m. en Costa Rica cuenta como del MISMO día", () => {
    const sello = "2026-03-04T01:00:00.000Z"; // 3 de marzo, 7 p. m. en CR
    expect(fechaDeCorte({ regla, ultimoMovimiento: sello, zona: "America/Costa_Rica" })).toBe(
      "2026-09-03",
    );
  });

  it("y el mismo instante en Madrid cae al día siguiente, que es lo correcto allá", () => {
    const sello = "2026-03-04T01:00:00.000Z"; // 4 de marzo, 2 a. m. en España
    expect(fechaDeCorte({ regla, ultimoMovimiento: sello, zona: "Europe/Madrid" })).toBe(
      "2026-09-04",
    );
  });

  it("una zona inválida cae a Costa Rica en vez de reventar el barrido", () => {
    const sello = "2026-03-04T01:00:00.000Z";
    expect(fechaDeCorte({ regla, ultimoMovimiento: sello, zona: "Marte/Olympus" })).toBe(
      "2026-09-03",
    );
  });

  // ── LA REGLA RECIÉN ENCENDIDA ────────────────────────────────────
  it("NO es retroactiva: quien no viene hace un año no vence mañana", () => {
    // Regla de 3 meses encendida el 1 de agosto de 2026. Esta clienta
    // no viene desde agosto de 2025.
    const recien = { meses: 3, desde: "2026-08-01T18:00:00.000Z" };
    const corte = fechaDeCorte({
      regla: recien,
      ultimoMovimiento: "2025-08-10T15:00:00.000Z",
      zona: "America/Costa_Rica",
    });
    // Tres meses COMPLETOS desde que la regla existe, no desde su
    // última visita: el 1 de noviembre, con su aviso dos semanas antes.
    expect(corte).toBe("2026-11-01");
  });

  it("al que sí viene seguido, encender la regla no le cambia nada", () => {
    const recien = { meses: 3, desde: "2026-08-01T18:00:00.000Z" };
    const corte = fechaDeCorte({
      regla: recien,
      ultimoMovimiento: "2026-08-15T15:00:00.000Z",
      zona: "America/Costa_Rica",
    });
    // Manda su último sello, que es más reciente que el encendido.
    expect(corte).toBe("2026-11-15");
  });
});

describe("veredicto — a quién le toca hoy", () => {
  const hoy = "2026-08-17";

  it("sin fecha de corte, nada", () => {
    expect(veredicto({ venceEl: null, hoy, saldo: 5 })).toBe("sin-regla");
  });

  it("sin sellos no hay nada que vencer ni que avisar", () => {
    expect(veredicto({ venceEl: "2026-08-17", hoy, saldo: 0 })).toBe("sin-regla");
  });

  it("falta mucho: no se toca ni se avisa", () => {
    expect(veredicto({ venceEl: "2026-12-01", hoy, saldo: 5 })).toBe("vigente");
  });

  it("justo al borde de la ventana de aviso", () => {
    const enVentana = "2026-08-31"; // 14 días
    const unDiaMas = "2026-09-01"; // 15 días
    expect(veredicto({ venceEl: enVentana, hoy, saldo: 5 })).toBe("por-vencer");
    expect(veredicto({ venceEl: unDiaMas, hoy, saldo: 5 })).toBe("vigente");
    expect(diasEntreISO(hoy, enVentana)).toBe(DIAS_DE_AVISO);
  });

  it("el día del corte YA vence: el plazo se cumplió entero", () => {
    expect(veredicto({ venceEl: "2026-08-17", hoy, saldo: 5 })).toBe("vencido");
  });

  it("y un corte atrasado (el cron no corrió el martes) también", () => {
    expect(veredicto({ venceEl: "2026-08-10", hoy, saldo: 5 })).toBe("vencido");
  });
});

describe("referenciaDeCorte — la idempotencia vive en la BASE", () => {
  it("sale de la fecha de CORTE, así que no depende de cuándo corrió el cron", () => {
    // Las dos corridas —la del día del corte y la atrasada de tres días
    // después— calculan la MISMA llave, y el índice único
    // (miembro_id, referencia) rechaza la segunda. Sin esto el cliente
    // quedaría con saldo negativo.
    expect(referenciaDeCorte("2026-09-03")).toBe("venc:2026-09-03");
    expect(referenciaDeCorte("2026-09-03")).toBe(referenciaDeCorte("2026-09-03"));
  });

  it("dos vueltas distintas del mismo cliente son movimientos distintos", () => {
    expect(referenciaDeCorte("2026-09-03")).not.toBe(referenciaDeCorte("2027-03-03"));
  });
});

describe("motivoDeCorte — queda escrito por qué", () => {
  it("habla en singular y en plural", () => {
    expect(motivoDeCorte(1)).toContain("1 mes");
    expect(motivoDeCorte(6)).toContain("6 meses");
  });
});

describe("mesesGuardables — qué se deja guardar", () => {
  it("solo en tarjetas de sellos", () => {
    expect(mesesGuardables("sellos", 6)).toBe(6);
    expect(mesesGuardables("giftcard", 6)).toBeNull();
    expect(mesesGuardables("cashback", 6)).toBeNull();
  });

  it("recorta el rango del CHECK y descarta la basura", () => {
    expect(mesesGuardables("sellos", 999)).toBe(60);
    expect(mesesGuardables("sellos", 0)).toBeNull();
    expect(mesesGuardables("sellos", null)).toBeNull();
    expect(mesesGuardables("sellos", undefined)).toBeNull();
  });
});

describe("relojDeVencimiento — encender la regla no vacía tarjetas", () => {
  const ahora = new Date("2026-08-17T12:00:00.000Z");

  it("apagada, no hay reloj", () => {
    expect(relojDeVencimiento({ meses: null, previa: SIN_REGLA, ahora })).toBeNull();
  });

  it("recién encendida, el reloj arranca AHORA", () => {
    expect(relojDeVencimiento({ meses: 3, previa: SIN_REGLA, ahora })).toBe(ahora.toISOString());
  });

  it("cambiar los meses NO reinicia el reloj de todo el mundo", () => {
    const previa = { meses: 12, desde: "2026-01-01T00:00:00.000Z" };
    expect(relojDeVencimiento({ meses: 6, previa, ahora })).toBe("2026-01-01T00:00:00.000Z");
  });

  it("apagarla y volver a encenderla sí lo reinicia — y eso es lo correcto", () => {
    // El que estuvo meses sin la regla no puede volver con el reloj
    // corriendo desde antes: sería retroactivo por la puerta de atrás.
    expect(relojDeVencimiento({ meses: 6, previa: { meses: null, desde: null }, ahora })).toBe(
      ahora.toISOString(),
    );
  });
});
