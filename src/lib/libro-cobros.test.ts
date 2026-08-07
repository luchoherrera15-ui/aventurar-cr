import { describe, expect, it } from "vitest";
import {
  agruparCobros,
  esTablaCobrosInexistente,
  etiquetaSemana,
  explicarCobro,
  idsPagados,
  idsPendientes,
  resumenLibro,
  semanaDe,
  type CobroPlataforma,
} from "./libro-cobros";

// "Hoy" fijo: jueves 6 de agosto de 2026 → la semana de corte es el
// lunes 3 de agosto.
const HOY = new Date(2026, 7, 6);
const SEMANA = "2026-08-03";
const SEMANA_ANTERIOR = "2026-07-27";

const NOMBRES = { r1: "Rancho El Guayabo", r2: "Salón Los Almendros" };

function cobro(over: Partial<CobroPlataforma> = {}): CobroPlataforma {
  return {
    id: over.id ?? "c1",
    reserva_id: "res1",
    rancho_id: "r1",
    concepto: "reserva",
    personas: 100,
    tarifa: 150,
    modelo: "comision_por_persona",
    monto: 15000,
    estado: "pendiente",
    semana: SEMANA,
    cliente: "María",
    fecha_evento: "2026-08-23",
    devengado_en: "2026-08-06T10:00:00.000Z",
    pagado_en: null,
    notas: null,
    ...over,
  };
}

describe("etiquetaSemana", () => {
  it("dice la semana como la dice el dueño", () => {
    expect(etiquetaSemana("2026-08-03")).toBe("Lunes 3 → domingo 9 de agosto");
  });

  it("nombra los dos meses cuando la semana se parte", () => {
    expect(etiquetaSemana("2026-07-27")).toBe(
      "Lunes 27 de julio → domingo 2 de agosto",
    );
  });

  it("nombra los dos años en el cambio de año", () => {
    expect(etiquetaSemana("2026-12-28")).toBe(
      "Lunes 28 de diciembre 2026 → domingo 3 de enero 2027",
    );
  });
});

describe("semanaDe", () => {
  it("un jueves cae en el lunes de su semana", () => {
    expect(semanaDe(HOY)).toBe(SEMANA);
  });

  it("el domingo todavía es de la semana que arrancó el lunes", () => {
    expect(semanaDe(new Date(2026, 7, 9))).toBe(SEMANA);
  });

  it("el lunes siguiente ya es otra semana", () => {
    expect(semanaDe(new Date(2026, 7, 10))).toBe("2026-08-10");
  });
});

describe("agruparCobros", () => {
  it("junta semana × negocio en un solo renglón de cuenta", () => {
    const { porCobrar } = agruparCobros(
      [
        cobro({ id: "a", monto: 15000, personas: 100 }),
        cobro({ id: "b", reserva_id: "res2", monto: 6000, personas: 40 }),
      ],
      NOMBRES,
    );
    expect(porCobrar).toHaveLength(1);
    expect(porCobrar[0].negocio).toBe("Rancho El Guayabo");
    expect(porCobrar[0].reservas).toBe(2);
    expect(porCobrar[0].personas).toBe(140);
    expect(porCobrar[0].total).toBe(21000);
    expect(porCobrar[0].semanaEtiqueta).toBe("Lunes 3 → domingo 9 de agosto");
  });

  it("no mezcla dos negocios de la misma semana", () => {
    const { porCobrar } = agruparCobros(
      [cobro({ id: "a" }), cobro({ id: "b", rancho_id: "r2" })],
      NOMBRES,
    );
    expect(porCobrar).toHaveLength(2);
    expect(porCobrar.map((g) => g.negocio)).toEqual([
      "Rancho El Guayabo",
      "Salón Los Almendros",
    ]);
  });

  it("lo pagado se va al histórico y lo pendiente se queda, aunque sea la misma semana y el mismo negocio", () => {
    const { porCobrar, pagados } = agruparCobros(
      [
        cobro({ id: "a", monto: 15000 }),
        cobro({
          id: "b",
          monto: 6000,
          estado: "pagado",
          pagado_en: "2026-08-05T09:00:00.000Z",
        }),
      ],
      NOMBRES,
    );
    expect(porCobrar).toHaveLength(1);
    expect(porCobrar[0].total).toBe(15000);
    expect(pagados).toHaveLength(1);
    expect(pagados[0].total).toBe(6000);
    expect(pagados[0].pagadoEn).toBe("2026-08-05T09:00:00.000Z");
  });

  it("los anulados salen aparte y nunca suman", () => {
    const { porCobrar, anulados } = agruparCobros(
      [
        cobro({ id: "a", monto: 15000 }),
        cobro({
          id: "b",
          monto: 9000,
          estado: "anulado",
          notas: "anulado al cancelarse la reserva",
        }),
      ],
      NOMBRES,
    );
    expect(porCobrar[0].total).toBe(15000);
    expect(anulados).toHaveLength(1);
    expect(anulados[0].notas).toContain("anulado");
  });

  it("la deuda más vieja va primero", () => {
    const { porCobrar } = agruparCobros(
      [
        cobro({ id: "a", semana: SEMANA }),
        cobro({ id: "b", semana: SEMANA_ANTERIOR }),
      ],
      NOMBRES,
    );
    expect(porCobrar.map((g) => g.semana)).toEqual([SEMANA_ANTERIOR, SEMANA]);
  });

  it("el histórico muestra lo cobrado más reciente arriba", () => {
    const { pagados } = agruparCobros(
      [
        cobro({
          id: "a",
          semana: SEMANA_ANTERIOR,
          estado: "pagado",
          pagado_en: "2026-08-01T09:00:00.000Z",
        }),
        cobro({
          id: "b",
          semana: SEMANA,
          estado: "pagado",
          pagado_en: "2026-08-06T09:00:00.000Z",
        }),
      ],
      NOMBRES,
    );
    expect(pagados.map((g) => g.semana)).toEqual([SEMANA, SEMANA_ANTERIOR]);
  });

  it("un cobro de una reserva de un negocio borrado no se pierde", () => {
    const { porCobrar } = agruparCobros([cobro({ rancho_id: null })], NOMBRES);
    expect(porCobrar[0].negocio).toBe("Negocio dado de baja");
  });

  it("el 10 % de una cancelación suma plata pero no cuenta como reserva", () => {
    const { porCobrar } = agruparCobros(
      [
        cobro({ id: "a", monto: 15000 }),
        cobro({
          id: "b",
          concepto: "cancelacion",
          personas: 0,
          tarifa: 10,
          modelo: "porcentaje_deposito",
          monto: 5000,
        }),
      ],
      NOMBRES,
    );
    expect(porCobrar[0].reservas).toBe(1);
    expect(porCobrar[0].cancelaciones).toBe(1);
    expect(porCobrar[0].total).toBe(20000);
  });
});

describe("resumenLibro", () => {
  it("separa la semana en curso, lo pendiente total y lo cobrado del mes", () => {
    const r = resumenLibro(
      [
        cobro({ id: "a", monto: 15000 }),
        cobro({ id: "b", semana: SEMANA_ANTERIOR, monto: 6000 }),
        cobro({
          id: "c",
          semana: SEMANA_ANTERIOR,
          monto: 9000,
          estado: "pagado",
          pagado_en: "2026-08-03T09:00:00.000Z",
        }),
        cobro({
          id: "d",
          semana: "2026-06-29",
          monto: 4000,
          estado: "pagado",
          pagado_en: "2026-07-02T09:00:00.000Z",
        }),
      ],
      HOY,
    );
    expect(r.devengadoSemana).toBe(15000);
    expect(r.reservasSemana).toBe(1);
    expect(r.pendienteTotal).toBe(21000);
    // Solo el pago del 3 de agosto cae en el mes en curso.
    expect(r.cobradoMes).toBe(9000);
    expect(r.semanaActual).toBe(SEMANA);
    expect(r.semanaActualEtiqueta).toBe("Lunes 3 → domingo 9 de agosto");
  });

  it("lo devengado de la semana incluye lo que ya se cobró de esa semana", () => {
    const r = resumenLibro(
      [
        cobro({ id: "a", monto: 15000 }),
        cobro({
          id: "b",
          monto: 5000,
          estado: "pagado",
          pagado_en: "2026-08-06T09:00:00.000Z",
        }),
      ],
      HOY,
    );
    expect(r.devengadoSemana).toBe(20000);
    expect(r.pendienteTotal).toBe(15000);
  });

  it("un cobro anulado no suma en ningún lado", () => {
    const r = resumenLibro(
      [cobro({ id: "a", monto: 15000, estado: "anulado" })],
      HOY,
    );
    expect(r.devengadoSemana).toBe(0);
    expect(r.pendienteTotal).toBe(0);
    expect(r.gruposPendientes).toBe(0);
  });

  it("cuenta los grupos y las semanas que quedan por cobrar", () => {
    const r = resumenLibro(
      [
        cobro({ id: "a" }),
        cobro({ id: "b", rancho_id: "r2" }),
        cobro({ id: "c", semana: SEMANA_ANTERIOR }),
      ],
      HOY,
    );
    expect(r.gruposPendientes).toBe(3);
    expect(r.semanasPendientes).toBe(2);
  });
});

describe("explicarCobro", () => {
  it("explica de dónde salió el monto congelado", () => {
    expect(explicarCobro(cobro())).toBe("100 personas × ₡150");
    expect(explicarCobro(cobro({ personas: 1 }))).toBe("1 persona × ₡150");
    expect(
      explicarCobro(cobro({ modelo: "porcentaje_deposito", tarifa: 10 })),
    ).toBe("10% del depósito retenido");
    // El separador de miles depende del ICU del entorno (punto o
    // espacio fino): lo que se prueba es la forma, no el separador.
    expect(
      explicarCobro(cobro({ modelo: "comision_fija_reserva", tarifa: 5000 })),
    ).toMatch(/^₡5.000 fijos por reserva$/);
  });
});

describe("esTablaCobrosInexistente", () => {
  // Los dos primeros son respuestas REALES del proyecto de Supabase,
  // copiadas tal cual: así se sabe que la pantalla distingue "falta la
  // migración" de "el permiso está mal", que se ven parecido y se
  // arreglan distinto.
  it("reconoce el PGRST205 de PostgREST (la tabla no está)", () => {
    expect(
      esTablaCobrosInexistente({
        code: "PGRST205",
        message:
          "Could not find the table 'public.cobros_plataforma' in the schema cache",
      }),
    ).toBe(true);
  });

  it("NO confunde un permiso denegado con una migración faltante", () => {
    expect(
      esTablaCobrosInexistente({
        code: "42501",
        message: "permission denied for table cobros_plataforma",
      }),
    ).toBe(false);
  });

  it("reconoce el 42P01 de Postgres", () => {
    expect(
      esTablaCobrosInexistente({
        code: "42P01",
        message: 'relation "public.cobros_plataforma" does not exist',
      }),
    ).toBe(true);
  });

  it("un error cualquiera no es una migración faltante", () => {
    expect(esTablaCobrosInexistente({ message: "network error" })).toBe(false);
    expect(esTablaCobrosInexistente({})).toBe(false);
  });
});

describe("ids de un grupo", () => {
  it("cobrar toca solo los pendientes; deshacer, solo los pagados", () => {
    const { porCobrar, pagados } = agruparCobros(
      [
        cobro({ id: "a" }),
        cobro({ id: "b" }),
        cobro({
          id: "c",
          estado: "pagado",
          pagado_en: "2026-08-05T09:00:00.000Z",
        }),
      ],
      NOMBRES,
    );
    expect(idsPendientes(porCobrar[0])).toEqual(["a", "b"]);
    expect(idsPagados(pagados[0])).toEqual(["c"]);
  });
});
