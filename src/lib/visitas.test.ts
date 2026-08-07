import { describe, expect, it, vi } from "vitest";

/**
 * Lo que se prueba acá es la regla que evita que el contador juegue en
 * contra: un número bajo vende MENOS que ningún número. Y lo otro
 * delicado: que el hash del visitante no deje pasar la IP en claro y
 * cambie de un día para otro.
 */

// El módulo importa el cliente de Supabase (que arrastra next/headers);
// nada de esto lo necesita.
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => null }));

const {
  MINIMO_VISITAS,
  esFuncionInexistente,
  fraseVisitas,
  hashVisitante,
  ipDeCabeceras,
  textoVisitas,
} = await import("@/lib/visitas");

describe("fraseVisitas — la regla del número que sí se muestra", () => {
  it("con 3 o más visitas hoy, habla de hoy", () => {
    expect(fraseVisitas({ hoy: 12, semana: 40 })).toEqual({
      numero: 12,
      periodo: "hoy",
    });
    expect(fraseVisitas({ hoy: MINIMO_VISITAS, semana: 9 })).toEqual({
      numero: 3,
      periodo: "hoy",
    });
  });

  it("con poco hoy pero la semana llegando a 3, cae a la semana", () => {
    expect(fraseVisitas({ hoy: 1, semana: 8 })).toEqual({
      numero: 8,
      periodo: "semana",
    });
    expect(fraseVisitas({ hoy: 0, semana: 3 })).toEqual({
      numero: 3,
      periodo: "semana",
    });
  });

  it("no muestra nada cuando ni hoy ni la semana llegan al mínimo", () => {
    expect(fraseVisitas({ hoy: 2, semana: 2 })).toBeNull();
    expect(fraseVisitas({ hoy: 0, semana: 0 })).toBeNull();
    expect(fraseVisitas({ hoy: 1, semana: 1 })).toBeNull();
  });

  it("sin resumen (base sin la 0107) tampoco muestra nada", () => {
    expect(fraseVisitas(null)).toBeNull();
  });

  it("nunca infla: el número que muestra es el que le dieron", () => {
    for (const hoy of [3, 4, 17, 240]) {
      expect(fraseVisitas({ hoy, semana: hoy * 3 })?.numero).toBe(hoy);
    }
  });

  it("el texto dice el período correcto", () => {
    expect(textoVisitas({ numero: 12, periodo: "hoy" })).toBe(
      "visitaron este sitio hoy",
    );
    expect(textoVisitas({ numero: 12, periodo: "semana" })).toBe(
      "visitaron este sitio esta semana",
    );
  });
});

describe("hashVisitante — la privacidad", () => {
  const ip = "190.24.11.7";
  const ua = "Mozilla/5.0 (iPhone)";

  it("es hexadecimal de 64 caracteres", () => {
    expect(hashVisitante(ip, ua, "2026-08-07")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("no deja rastro de la IP ni del navegador", () => {
    const hash = hashVisitante(ip, ua, "2026-08-07");
    expect(hash).not.toContain("190");
    expect(hash.toLowerCase()).not.toContain("iphone");
  });

  it("el mismo aparato el mismo día da el mismo hash (por eso cuenta una vez)", () => {
    expect(hashVisitante(ip, ua, "2026-08-07")).toBe(
      hashVisitante(ip, ua, "2026-08-07"),
    );
  });

  it("cambia al día siguiente: no se puede seguir a nadie entre días", () => {
    expect(hashVisitante(ip, ua, "2026-08-07")).not.toBe(
      hashVisitante(ip, ua, "2026-08-08"),
    );
  });

  it("dos visitantes distintos no se confunden", () => {
    expect(hashVisitante(ip, ua, "2026-08-07")).not.toBe(
      hashVisitante("190.24.11.8", ua, "2026-08-07"),
    );
  });
});

describe("ipDeCabeceras", () => {
  it("se queda con la primera de x-forwarded-for (la del visitante)", () => {
    const h = new Headers({ "x-forwarded-for": "190.24.11.7, 10.0.0.1, 10.0.0.2" });
    expect(ipDeCabeceras(h)).toBe("190.24.11.7");
  });

  it("cae a x-real-ip y después a un centinela, sin reventar", () => {
    expect(ipDeCabeceras(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(ipDeCabeceras(new Headers())).toBe("sin-ip");
  });
});

describe("esFuncionInexistente — la base sin la 0107", () => {
  it("reconoce el 42883 de Postgres y el PGRST202 de PostgREST", () => {
    expect(
      esFuncionInexistente({
        code: "42883",
        message: "function public.visitas_pagina_resumen(uuid) does not exist",
      }),
    ).toBe(true);
    expect(
      esFuncionInexistente({
        code: "PGRST202",
        message:
          "Could not find the function public.registrar_visita(p_rancho, p_visitante) in the schema cache",
      }),
    ).toBe(true);
  });

  it("no se traga un error de verdad", () => {
    expect(
      esFuncionInexistente({ code: "42501", message: "permission denied" }),
    ).toBe(false);
  });
});
