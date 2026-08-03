import { describe, expect, it } from "vitest";
import {
  agruparClientes,
  claveCliente,
  correosSegmento,
  esInactivo,
  esReincidente,
  type ReservaCliente,
} from "./crm-citas";

const HOY = "2026-08-03";

let secuencia = 0;
function cita(extra: Partial<ReservaCliente>): ReservaCliente {
  secuencia++;
  return {
    id: `r${secuencia}`,
    fecha: "2026-07-01",
    hora_inicio: "10:00",
    estado: "cumplida",
    nombre: "Ana Mora",
    correo: "ana@correo.com",
    whatsapp: null,
    cliente_id: null,
    monto_total: 10000,
    ...extra,
  };
}

describe("claveCliente", () => {
  it("prefiere la cuenta, después el correo, el teléfono y el nombre", () => {
    expect(
      claveCliente({ cliente_id: "u1", correo: "a@b.com", whatsapp: null, nombre: "Ana" }),
    ).toBe("id:u1");
    expect(
      claveCliente({ cliente_id: null, correo: " Ana@B.com ", whatsapp: null, nombre: "Ana" }),
    ).toBe("correo:ana@b.com");
    expect(
      claveCliente({ cliente_id: null, correo: null, whatsapp: "+506 8888-1234", nombre: "Ana" }),
    ).toBe("tel:88881234");
    expect(
      claveCliente({ cliente_id: null, correo: null, whatsapp: null, nombre: "  Ana  Mora " }),
    ).toBe("nombre:ana mora");
    expect(
      claveCliente({ cliente_id: null, correo: null, whatsapp: null, nombre: " " }),
    ).toBeNull();
  });

  it("agrupa el mismo teléfono escrito distinto", () => {
    const a = claveCliente({ cliente_id: null, correo: null, whatsapp: "8888-1234", nombre: null });
    const b = claveCliente({ cliente_id: null, correo: null, whatsapp: "+50688881234", nombre: null });
    expect(a).toBe(b);
  });
});

describe("agruparClientes", () => {
  it("junta las citas de la misma persona y calcula su ficha", () => {
    const clientes = agruparClientes(
      [
        cita({ fecha: "2026-06-01", estado: "cumplida", monto_total: 12000 }),
        cita({ fecha: "2026-07-01", estado: "cumplida", monto_total: 8000 }),
        cita({ fecha: "2026-07-15", estado: "cancelada", monto_total: 8000 }),
        cita({ fecha: "2026-08-10", estado: "confirmada", monto_total: 8000 }),
      ],
      HOY,
    );
    expect(clientes).toHaveLength(1);
    const c = clientes[0];
    expect(c.totalCitas).toBe(4);
    expect(c.cumplidas).toBe(2);
    expect(c.canceladas).toBe(1);
    expect(c.gastoTotal).toBe(20000);
    expect(c.ultimaVisita).toBe("2026-07-01");
    expect(c.proximaCita).toBe("2026-08-10");
    expect(c.diasSinVenir).toBe(33);
  });

  it("no cuenta bloqueos de agenda ni holds como clientes", () => {
    const clientes = agruparClientes(
      [
        cita({ estado: "bloqueada", nombre: "Google Calendar", correo: null }),
        cita({ estado: "temporal" }),
      ],
      HOY,
    );
    // El hold temporal trae correo pero no es una cita real.
    expect(clientes).toHaveLength(0);
  });

  it("detecta al cliente que faltó a sus últimas dos citas", () => {
    const clientes = agruparClientes(
      [
        cita({ fecha: "2026-05-01", estado: "cumplida" }),
        cita({ fecha: "2026-06-01", estado: "no_asistio" }),
        // Canceló en el medio: no corta la racha de fallos.
        cita({ fecha: "2026-06-15", estado: "cancelada" }),
        cita({ fecha: "2026-07-01", estado: "no_asistio" }),
      ],
      HOY,
    );
    expect(clientes[0].fallosSeguidos).toBe(2);
    expect(esReincidente(clientes[0])).toBe(true);
  });

  it("una visita cumplida reinicia la racha de fallos", () => {
    const clientes = agruparClientes(
      [
        cita({ fecha: "2026-06-01", estado: "no_asistio" }),
        cita({ fecha: "2026-06-10", estado: "no_asistio" }),
        cita({ fecha: "2026-07-01", estado: "cumplida" }),
      ],
      HOY,
    );
    expect(clientes[0].fallosSeguidos).toBe(0);
    expect(esReincidente(clientes[0])).toBe(false);
  });

  it("separa clientes distintos y ordena a los reincidentes primero", () => {
    const clientes = agruparClientes(
      [
        cita({ fecha: "2026-07-20", estado: "cumplida" }),
        cita({
          nombre: "Beto Solís",
          correo: "beto@correo.com",
          fecha: "2026-06-01",
          estado: "no_asistio",
        }),
        cita({
          nombre: "Beto Solís",
          correo: "beto@correo.com",
          fecha: "2026-07-01",
          estado: "no_asistio",
        }),
      ],
      HOY,
    );
    expect(clientes).toHaveLength(2);
    expect(clientes[0].correo).toBe("beto@correo.com");
    expect(clientes[0].fallosSeguidos).toBe(2);
  });

  it("une la cuenta con las citas manuales del mismo correo o teléfono", () => {
    const clientes = agruparClientes(
      [
        // Reservó con su cuenta (trae cliente_id + correo).
        cita({ cliente_id: "u1", correo: "ana@correo.com", fecha: "2026-06-01" }),
        // El dueño la anotó a mano: solo correo.
        cita({ cliente_id: null, correo: "ana@correo.com", fecha: "2026-07-01" }),
        // Y otra vez solo con el teléfono que dejó al reservar.
        cita({ cliente_id: "u1", correo: null, whatsapp: "8888-1234", fecha: "2026-07-10" }),
        cita({ cliente_id: null, correo: null, whatsapp: "+506 8888 1234", fecha: "2026-07-20" }),
      ],
      HOY,
    );
    expect(clientes).toHaveLength(1);
    expect(clientes[0].clave).toBe("id:u1");
    expect(clientes[0].totalCitas).toBe(4);
    expect(clientes[0].citaIds).toHaveLength(4);
  });

  it("usa el dato de contacto más reciente que no venga vacío", () => {
    const clientes = agruparClientes(
      [
        cita({ cliente_id: "u1", fecha: "2026-06-01", whatsapp: "8888-0000" }),
        cita({ cliente_id: "u1", fecha: "2026-07-01", whatsapp: null, nombre: "Ana M." }),
      ],
      HOY,
    );
    expect(clientes[0].whatsapp).toBe("8888-0000");
    expect(clientes[0].nombre).toBe("Ana M.");
  });
});

describe("segmentos de campaña", () => {
  it("arma la lista de inactivos y de no-shows solo con correo", () => {
    const clientes = agruparClientes(
      [
        // Inactiva: vino hace 60 días y no tiene nada agendado.
        cita({ fecha: "2026-06-04", estado: "cumplida" }),
        // Reincidente sin correo: no puede entrar a una campaña.
        cita({
          nombre: "Sin Correo",
          correo: null,
          whatsapp: "7777-1234",
          fecha: "2026-06-01",
          estado: "no_asistio",
        }),
        cita({
          nombre: "Sin Correo",
          correo: null,
          whatsapp: "7777-1234",
          fecha: "2026-07-01",
          estado: "no_asistio",
        }),
      ],
      HOY,
    );

    const ana = clientes.find((c) => c.correo === "ana@correo.com")!;
    expect(esInactivo(ana)).toBe(true);
    expect(correosSegmento(clientes, "inactivos")).toEqual(["ana@correo.com"]);
    expect(correosSegmento(clientes, "no_show")).toEqual([]);
    expect(correosSegmento(clientes, "todos")).toEqual(["ana@correo.com"]);
  });

  it("un cliente con cita futura no cuenta como inactivo", () => {
    const clientes = agruparClientes(
      [
        cita({ fecha: "2026-06-01", estado: "cumplida" }),
        cita({ fecha: "2026-08-20", estado: "confirmada" }),
      ],
      HOY,
    );
    expect(esInactivo(clientes[0])).toBe(false);
  });
});
