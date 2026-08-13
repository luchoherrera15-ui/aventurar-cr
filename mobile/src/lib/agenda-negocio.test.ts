import { describe, expect, it } from "vitest";
import {
  agendaPorHoras,
  esCitas,
  esLugarPorDia,
  esProveedorDeEventos,
  fechaLarga,
  HORARIO_EVENTOS_DEFAULT,
  mensajePrimeraConsulta,
  minutosDeServicio,
  tocarHoraAbreChat,
  verticalDe,
} from "./agenda-negocio";

describe("verticalDe", () => {
  it("una fila vieja sin vertical es de eventos", () => {
    // En la base `vertical` es anulable: las filas anteriores a la
    // 0055 la traen en null y todo el app las lee como eventos.
    expect(verticalDe({ vertical: null })).toBe("eventos");
    expect(verticalDe({})).toBe("eventos");
    expect(verticalDe({ vertical: "   " })).toBe("eventos");
  });

  it("respeta la vertical cuando viene puesta", () => {
    expect(verticalDe({ vertical: "citas" })).toBe("citas");
    expect(verticalDe({ vertical: "restaurantes" })).toBe("restaurantes");
  });
});

describe("esLugarPorDia", () => {
  it("solo la categoría lugares", () => {
    expect(esLugarPorDia({ vertical: "eventos", categoria: "lugares" })).toBe(true);
    expect(esLugarPorDia({ vertical: "eventos", categoria: "animacion" })).toBe(false);
    expect(esLugarPorDia({ categoria: null })).toBe(false);
  });
});

describe("esProveedorDeEventos", () => {
  it("son todos los de eventos MENOS los lugares", () => {
    for (const categoria of [
      "alimentacion",
      "animacion",
      "organizacion",
      "decoracion",
      "otros",
    ]) {
      expect(esProveedorDeEventos({ vertical: "eventos", categoria })).toBe(true);
    }
    expect(esProveedorDeEventos({ vertical: "eventos", categoria: "lugares" })).toBe(false);
  });

  it("una fila sin vertical cuenta como eventos", () => {
    expect(esProveedorDeEventos({ vertical: null, categoria: "animacion" })).toBe(true);
    expect(esProveedorDeEventos({ vertical: null, categoria: "lugares" })).toBe(false);
  });

  it("las otras verticales no entran", () => {
    for (const vertical of ["citas", "restaurantes", "hospedajes"]) {
      expect(esProveedorDeEventos({ vertical, categoria: "otros" })).toBe(false);
    }
  });
});

describe("agendaPorHoras", () => {
  it("citas y proveedores de eventos, sí", () => {
    expect(agendaPorHoras({ vertical: "citas", categoria: "belleza" })).toBe(true);
    expect(agendaPorHoras({ vertical: "eventos", categoria: "animacion" })).toBe(true);
  });

  it("lugares, restaurantes y hospedajes, no", () => {
    // El flujo que cobra dinero real hoy: no lo toca nadie.
    expect(agendaPorHoras({ vertical: "eventos", categoria: "lugares" })).toBe(false);
    expect(agendaPorHoras({ vertical: "restaurantes", categoria: "soda" })).toBe(false);
    expect(agendaPorHoras({ vertical: "hospedajes", categoria: "cabaña" })).toBe(false);
  });
});

describe("tocarHoraAbreChat", () => {
  it("solo en eventos: la hora de una cita SÍ se reserva", () => {
    expect(tocarHoraAbreChat({ vertical: "eventos", categoria: "animacion" })).toBe(true);
    expect(tocarHoraAbreChat({ vertical: "citas", categoria: "belleza" })).toBe(false);
    expect(tocarHoraAbreChat({ vertical: "eventos", categoria: "lugares" })).toBe(false);
  });
});

describe("minutosDeServicio", () => {
  it("los minutos de Citas mandan", () => {
    expect(minutosDeServicio({ duracion_minutos: 45 })).toBe(45);
    // Con las dos puestas gana la de Citas: es la unidad del motor.
    expect(minutosDeServicio({ duracion_minutos: 45, duracion_horas: 4 })).toBe(45);
  });

  it("las horas de Eventos se traducen a minutos", () => {
    expect(minutosDeServicio({ duracion_horas: 4 })).toBe(240);
    // Media hora suelta: 2,5 h = 150 min, sin decimales sueltos.
    expect(minutosDeServicio({ duracion_horas: 2.5 })).toBe(150);
  });

  it("sin duración declarada devuelve null", () => {
    expect(minutosDeServicio({})).toBeNull();
    expect(minutosDeServicio({ duracion_minutos: null, duracion_horas: null })).toBeNull();
    // El 0 y los negativos no son duraciones: valen lo mismo que nada.
    expect(minutosDeServicio({ duracion_minutos: 0 })).toBeNull();
    expect(minutosDeServicio({ duracion_horas: -3 })).toBeNull();
  });
});

describe("HORARIO_EVENTOS_DEFAULT", () => {
  it("cubre los siete días, de 8 a 22", () => {
    // Un DJ trabaja de noche y fines de semana: ofrecer de más no
    // cuesta nada porque tocar una hora NO reserva.
    expect(Object.keys(HORARIO_EVENTOS_DEFAULT).sort()).toEqual([
      "0", "1", "2", "3", "4", "5", "6",
    ]);
    expect(HORARIO_EVENTOS_DEFAULT["6"]).toEqual({ abre: "08:00", cierra: "22:00" });
  });
});

describe("fechaLarga", () => {
  it("escribe la fecha como se habla en Costa Rica", () => {
    expect(fechaLarga("2026-03-21")).toBe("sábado 21 de marzo");
    // "setiembre", no "septiembre": es la forma de acá.
    expect(fechaLarga("2026-09-01")).toBe("martes 1 de setiembre");
  });

  it("no se corre un día por la zona horaria", () => {
    // Pasada por `new Date(iso)` esta fecha sería medianoche UTC, o sea
    // las 6 p. m. del día ANTERIOR en Costa Rica.
    expect(fechaLarga("2026-01-01")).toBe("jueves 1 de enero");
  });

  it("una fecha ilegible se devuelve tal cual, sin romper el mensaje", () => {
    expect(fechaLarga("")).toBe("");
    expect(fechaLarga("mañana")).toBe("mañana");
  });
});

describe("mensajePrimeraConsulta", () => {
  it("dice cuándo, qué servicio y que NO hay nada reservado", () => {
    const texto = mensajePrimeraConsulta({
      fechaLarga: "sábado 12 de julio",
      hora: "3:00 p. m.",
      horaFin: "7:00 p. m.",
      servicio: "DJ para fiesta",
      precio: "₡120.000",
    });
    expect(texto).toContain("sábado 12 de julio");
    expect(texto).toContain("3:00 p. m. a 7:00 p. m.");
    expect(texto).toContain("Servicio: DJ para fiesta — ₡120.000.");
    // La línea que sostiene toda la regla de producto.
    expect(texto).toContain("Todavía no hay nada reservado");
  });

  it("sin servicio ni hora de fin, sigue siendo una consulta completa", () => {
    const texto = mensajePrimeraConsulta({
      fechaLarga: "viernes 3 de octubre",
      hora: "9:00 a. m.",
    });
    expect(texto).toContain("de 9:00 a. m..");
    expect(texto).not.toContain("Servicio:");
    expect(texto).toContain("Todavía no hay nada reservado");
  });

  it("los campos en blanco no dejan líneas vacías", () => {
    const texto = mensajePrimeraConsulta({
      fechaLarga: "lunes 1 de junio",
      hora: "2:00 p. m.",
      servicio: "   ",
      notas: "   ",
    });
    expect(texto.split("\n")).toHaveLength(2);
  });

  it("nunca pasa del tope de la columna de mensajes", () => {
    const texto = mensajePrimeraConsulta({
      fechaLarga: "lunes 1 de junio",
      hora: "2:00 p. m.",
      notas: "x".repeat(5000),
    });
    expect(texto.length).toBe(2000);
  });
});

describe("esCitas", () => {
  it("distingue la vertical de citas de todo lo demás", () => {
    expect(esCitas({ vertical: "citas" })).toBe(true);
    expect(esCitas({ vertical: "eventos" })).toBe(false);
    expect(esCitas({})).toBe(false);
  });
});
