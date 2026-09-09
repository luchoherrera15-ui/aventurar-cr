import { describe, expect, it } from "vitest";
import { DIAS_ADELANTE, HORAS_REUNION, diaDeSemana, diasDisponibles, fechaLargaReunion, horaCorta, horarioValido } from "./reuniones";

describe("la agenda chica", () => {
  it("ofrece medias horas de 9:00 a 16:30", () => {
    expect(HORAS_REUNION[0]).toBe("09:00");
    expect(HORAS_REUNION[HORAS_REUNION.length - 1]).toBe("16:30");
    expect(HORAS_REUNION).toHaveLength(16);
  });

  it("los días arrancan mañana, saltan los domingos y llegan a 14 adelante", () => {
    // 2026-09-08 es martes.
    const dias = diasDisponibles("2026-09-08");
    expect(dias[0].iso).toBe("2026-09-09");
    expect(dias.some((d) => d.diaCorto === "dom")).toBe(false);
    expect(dias[dias.length - 1].iso).toBe("2026-09-22");
    // 14 días naturales menos los dos domingos (13 y 20).
    expect(dias).toHaveLength(DIAS_ADELANTE - 2);
    expect(dias[0].largo).toBe("miércoles 9 de septiembre");
  });

  it("valida solo lo que el formulario ofrece", () => {
    const hoy = "2026-09-08";
    expect(horarioValido(hoy, "2026-09-09", "10:00")).toBe(true);
    expect(horarioValido(hoy, "2026-09-08", "10:00")).toBe(false); // hoy no
    expect(horarioValido(hoy, "2026-09-13", "10:00")).toBe(false); // domingo
    expect(horarioValido(hoy, "2026-09-09", "17:00")).toBe(false); // fuera de horario
    expect(horarioValido(hoy, "2026-10-09", "10:00")).toBe(false); // muy lejos
    expect(horarioValido(hoy, "no-es-fecha", "10:00")).toBe(false);
  });

  it("día de la semana y formato", () => {
    expect(diaDeSemana("2026-09-13")).toBe(0);
    expect(fechaLargaReunion("2026-09-13")).toBe("domingo 13 de septiembre");
    expect(horaCorta("10:30:00")).toBe("10:30");
  });
});
