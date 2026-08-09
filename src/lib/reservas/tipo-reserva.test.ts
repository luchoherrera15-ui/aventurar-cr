import { describe, expect, it } from "vitest";
import { esTipoReserva, tipoReservaEfectivo } from "./tipo-reserva";

describe("tipoReservaEfectivo — derivación por vertical", () => {
  it("cada vertical deriva su tipo", () => {
    expect(tipoReservaEfectivo({ vertical: "citas" })).toBe("cita");
    expect(tipoReservaEfectivo({ vertical: "eventos" })).toBe("evento");
    expect(tipoReservaEfectivo({ vertical: "hospedajes" })).toBe("estadia");
    expect(tipoReservaEfectivo({ vertical: "restaurantes" })).toBe("mesa");
  });

  it("una vertical desconocida o ausente cae en evento", () => {
    expect(tipoReservaEfectivo({})).toBe("evento");
    expect(tipoReservaEfectivo({ vertical: null })).toBe("evento");
    expect(tipoReservaEfectivo({ vertical: "vertical_futura" })).toBe("evento");
  });

  it("el valor guardado le gana a la derivación", () => {
    expect(tipoReservaEfectivo({ vertical: "citas", tipo_reserva: "clase" })).toBe("clase");
    expect(tipoReservaEfectivo({ vertical: "eventos", tipo_reserva: "cita" })).toBe("cita");
  });

  it("ignora un tipo guardado que el código no conoce", () => {
    expect(tipoReservaEfectivo({ vertical: "citas", tipo_reserva: "inventado" })).toBe("cita");
  });
});

describe("las reservas de eventos CON hora siguen siendo eventos", () => {
  /**
   * Es el caso que justifica derivar por vertical y no por
   * `hora_inicio`: la 0067 le dio hora a los servicios de eventos (el
   * DJ de las 18:00). Mirar la hora los tiparía como citas, que es
   * justo lo contrario de lo que son — y contaminaría los reportes de
   * citas con eventos de proveedores.
   */
  it("un DJ contratado para las 18:00 es un evento, no una cita", () => {
    expect(
      tipoReservaEfectivo({ vertical: "eventos", estado: "confirmada", origen: "web" }),
    ).toBe("evento");
  });

  it("un lugar de eventos sin hora también es un evento", () => {
    expect(tipoReservaEfectivo({ vertical: "eventos", estado: "pendiente" })).toBe("evento");
  });

  it("una estadía de hospedaje no se confunde con un evento", () => {
    expect(tipoReservaEfectivo({ vertical: "hospedajes", estado: "confirmada" })).toBe(
      "estadia",
    );
  });
});

describe("lo que NO es una reserva de un cliente devuelve null", () => {
  it("un compromiso traído del calendario del dueño no se tipifica", () => {
    // El sync de la 0072 guarda estas filas como reservas 'bloqueada'
    // con origen 'sync', y en citas hasta les pone hora. Contarlas
    // como citas metería la cita al dentista del dueño entre las de
    // sus clientes.
    expect(
      tipoReservaEfectivo({ vertical: "citas", estado: "bloqueada", origen: "sync" }),
    ).toBeNull();
  });

  it("basta el estado bloqueada, venga de donde venga", () => {
    expect(tipoReservaEfectivo({ vertical: "citas", estado: "bloqueada" })).toBeNull();
    expect(tipoReservaEfectivo({ vertical: "eventos", estado: "bloqueada" })).toBeNull();
  });

  it("y basta el origen sync", () => {
    expect(tipoReservaEfectivo({ vertical: "citas", origen: "sync" })).toBeNull();
  });

  it("un bloqueo con tipo guardado sigue sin tipificarse", () => {
    expect(
      tipoReservaEfectivo({ vertical: "citas", estado: "bloqueada", tipo_reserva: "cita" }),
    ).toBeNull();
  });
});

describe("los estados normales de una cita no la desclasifican", () => {
  for (const estado of [
    "pendiente",
    "confirmada",
    "cumplida",
    "no_asistio",
    "cancelada",
    "rechazada",
    "temporal",
  ]) {
    it(`estado ${estado} sigue siendo una cita`, () => {
      expect(tipoReservaEfectivo({ vertical: "citas", estado })).toBe("cita");
    });
  }
});

describe("esTipoReserva", () => {
  it("acepta solo los cinco valores del CHECK de la base", () => {
    for (const t of ["cita", "clase", "evento", "estadia", "mesa"]) {
      expect(esTipoReserva(t)).toBe(true);
    }
    expect(esTipoReserva("bloqueo")).toBe(false);
    expect(esTipoReserva("")).toBe(false);
  });
});
