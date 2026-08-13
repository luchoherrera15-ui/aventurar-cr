import { describe, expect, it } from "vitest";
import {
  configPorDefecto,
  esTipoTarjeta,
  metaDe,
  tipoDe,
  validarBeneficio,
  TIPOS_HEREDADOS,
  TIPOS_TARJETA,
  TIPOS_TARJETA_ID,
  TIPOS_TARJETA_LISTA,
  type ConfigBeneficio,
} from "./tipos-tarjeta";

describe("el catálogo de tipos", () => {
  it("son ocho y no se repiten", () => {
    expect(TIPOS_TARJETA_ID).toHaveLength(8);
    expect(new Set(TIPOS_TARJETA_ID).size).toBe(8);
  });

  it("cada tipo tiene nombre, descripción e icono", () => {
    for (const def of TIPOS_TARJETA_LISTA) {
      expect(def.nombre.trim()).not.toBe("");
      expect(def.descripcion.trim()).not.toBe("");
      expect(def.icono.trim()).not.toBe("");
    }
  });

  it("los tres valores viejos de la base siguen siendo tipos válidos", () => {
    // Si esto se rompe, TODOS los programas que existen quedan con un
    // `modo` que el código no reconoce.
    for (const viejo of TIPOS_HEREDADOS) {
      expect(esTipoTarjeta(viejo)).toBe(true);
    }
    expect(TIPOS_HEREDADOS).toEqual(["sellos", "puntos", "cashback"]);
  });
});

describe("tipoDe", () => {
  it("reconoce los ocho", () => {
    for (const id of TIPOS_TARJETA_ID) expect(tipoDe(id)).toBe(id);
  });

  it("lo desconocido se degrada a puntos, no rompe", () => {
    // Un `modo` que el código no conoce (dato viejo, typo, o un tipo
    // que todavía no se desplegó) NO puede dejar de emitir el pase.
    expect(tipoDe(null)).toBe("puntos");
    expect(tipoDe(undefined)).toBe("puntos");
    expect(tipoDe("")).toBe("puntos");
    expect(tipoDe("loteria")).toBe("puntos");
  });
});

describe("configPorDefecto", () => {
  it("cada tipo arranca con algo publicable, no con ceros", () => {
    for (const id of TIPOS_TARJETA_ID) {
      const c = configPorDefecto(id);
      expect(c.tipo).toBe(id);
    }
  });

  it("sellos arranca en el caso real más común del país", () => {
    const c = configPorDefecto("sellos");
    expect(c).toMatchObject({ requeridos: 10, inicial: 0, repetible: true });
  });

  it("los defaults de sellos, puntos y cashback ya son válidos salvo el texto", () => {
    // Lo único que debe faltar es lo que solo el negocio sabe.
    expect(validarBeneficio(configPorDefecto("puntos"))).toBeNull();
    expect(validarBeneficio(configPorDefecto("cashback"))).toBeNull();
    expect(validarBeneficio(configPorDefecto("cupon"))).toBeNull();
    // Sellos pide la recompensa, que es texto del negocio.
    expect(validarBeneficio(configPorDefecto("sellos"))).toMatch(/qué se gana/i);
  });
});

describe("validarBeneficio · sellos", () => {
  const base: ConfigBeneficio = {
    tipo: "sellos",
    requeridos: 10,
    recompensa: "Un café",
    inicial: 0,
    repetible: true,
  };

  it("acepta lo válido", () => {
    expect(validarBeneficio(base)).toBeNull();
  });

  it("rechaza metas fuera de rango", () => {
    expect(validarBeneficio({ ...base, requeridos: 0 })).not.toBeNull();
    expect(validarBeneficio({ ...base, requeridos: 101 })).not.toBeNull();
    expect(validarBeneficio({ ...base, requeridos: 2.5 })).not.toBeNull();
  });

  it("exige decir qué se gana", () => {
    expect(validarBeneficio({ ...base, recompensa: "   " })).toMatch(/qué se gana/i);
  });

  it("no deja regalar la tarjeta entera", () => {
    // Regalar tantos sellos como pide la meta la vuelve un cupón
    // disfrazado: el cliente la abre ya ganada.
    expect(validarBeneficio({ ...base, inicial: 10 })).toMatch(/menos que la meta/i);
    expect(validarBeneficio({ ...base, inicial: 11 })).toMatch(/menos que la meta/i);
    expect(validarBeneficio({ ...base, inicial: 9 })).toBeNull();
  });
});

describe("validarBeneficio · puntos", () => {
  const base: ConfigBeneficio = {
    tipo: "puntos",
    nombre: "puntos",
    porMoneda: 0,
    porVisita: 1,
    inicial: 0,
    minimoCanje: 10,
    maximo: null,
  };

  it("un programa que no otorga nada no se publica", () => {
    // Una tarjeta que nunca avanza se ve bien, no funciona, y nadie
    // entiende por qué.
    expect(validarBeneficio({ ...base, porMoneda: 0, porVisita: 0 })).toMatch(/tiene que dar algo/i);
  });

  it("el tope no puede ser menor que el mínimo para canjear", () => {
    // Si no, el cliente llega al techo sin poder canjear nunca.
    expect(validarBeneficio({ ...base, maximo: 5 })).toMatch(/tope/i);
    expect(validarBeneficio({ ...base, maximo: 10 })).toBeNull();
  });

  it("exige nombre y no acepta negativos", () => {
    expect(validarBeneficio({ ...base, nombre: "" })).not.toBeNull();
    expect(validarBeneficio({ ...base, porVisita: -1 })).not.toBeNull();
  });
});

describe("validarBeneficio · cupón y descuento", () => {
  const base: ConfigBeneficio = {
    tipo: "cupon",
    beneficio: { forma: "porcentaje", valor: 30 },
    compraMinima: 0,
    descuentoMaximo: null,
    usosPorCliente: 1,
  };

  it("acepta el caso del documento: 30% de descuento", () => {
    expect(validarBeneficio(base)).toBeNull();
  });

  it("un porcentaje fuera de 1..100 es un error de digitación", () => {
    expect(validarBeneficio({ ...base, beneficio: { forma: "porcentaje", valor: 150 } })).not.toBeNull();
    expect(validarBeneficio({ ...base, beneficio: { forma: "porcentaje", valor: 0 } })).not.toBeNull();
  });

  it("un producto gratis sin nombre no se puede entregar en el mostrador", () => {
    expect(validarBeneficio({ ...base, beneficio: { forma: "gratis", que: " " } })).not.toBeNull();
    expect(validarBeneficio({ ...base, beneficio: { forma: "gratis", que: "Postre" } })).toBeNull();
  });

  it("descuento comparte las mismas reglas que cupón", () => {
    expect(validarBeneficio({ ...base, tipo: "descuento" })).toBeNull();
    expect(
      validarBeneficio({ ...base, tipo: "descuento", usosPorCliente: 0 }),
    ).not.toBeNull();
  });
});

describe("validarBeneficio · el resto", () => {
  it("membresía necesita nivel, beneficios y vigencia", () => {
    const base: ConfigBeneficio = {
      tipo: "membresia",
      nivel: "Gold",
      beneficios: ["10% siempre"],
      vigenciaMeses: 12,
      renovacionAutomatica: false,
    };
    expect(validarBeneficio(base)).toBeNull();
    expect(validarBeneficio({ ...base, nivel: "" })).not.toBeNull();
    expect(validarBeneficio({ ...base, beneficios: [] })).toMatch(/beneficios/i);
    expect(validarBeneficio({ ...base, vigenciaMeses: 0 })).not.toBeNull();
  });

  it("gift card necesita valor", () => {
    const base: ConfigBeneficio = {
      tipo: "giftcard",
      valor: 10_000,
      moneda: "CRC",
      canjeParcial: true,
      transferible: true,
    };
    expect(validarBeneficio(base)).toBeNull();
    expect(validarBeneficio({ ...base, valor: 0 })).not.toBeNull();
  });

  it("evento necesita cuándo y dónde", () => {
    const base: ConfigBeneficio = {
      tipo: "evento",
      fecha: "2026-09-01",
      hora: "19:00",
      ubicacion: "Rancho Las Torres",
      capacidad: 100,
    };
    expect(validarBeneficio(base)).toBeNull();
    expect(validarBeneficio({ ...base, fecha: "" })).not.toBeNull();
    expect(validarBeneficio({ ...base, ubicacion: " " })).not.toBeNull();
    expect(validarBeneficio({ ...base, capacidad: 0 })).not.toBeNull();
    // Sin tope es válido: no toda entrada tiene aforo.
    expect(validarBeneficio({ ...base, capacidad: null })).toBeNull();
  });

  it("cashback va de 1 a 100 por ciento", () => {
    const base: ConfigBeneficio = {
      tipo: "cashback",
      porcentaje: 5,
      compraMinima: 0,
      topePorCompra: null,
    };
    expect(validarBeneficio(base)).toBeNull();
    expect(validarBeneficio({ ...base, porcentaje: 0 })).not.toBeNull();
    expect(validarBeneficio({ ...base, porcentaje: 101 })).not.toBeNull();
  });
});

describe("metaDe", () => {
  it("las acumulativas tienen meta", () => {
    expect(metaDe(configPorDefecto("sellos"))).toBe(10);
    expect(metaDe({ ...configPorDefecto("puntos"), tipo: "puntos", minimoCanje: 50 } as ConfigBeneficio)).toBe(50);
  });

  it("las de un solo uso no", () => {
    expect(metaDe(configPorDefecto("cupon"))).toBeNull();
    expect(metaDe(configPorDefecto("evento"))).toBeNull();
    expect(metaDe(configPorDefecto("membresia"))).toBeNull();
  });

  it("acumula y venceNaturalmente describen bien cada tipo", () => {
    expect(TIPOS_TARJETA.sellos.acumula).toBe(true);
    expect(TIPOS_TARJETA.cupon.acumula).toBe(false);
    expect(TIPOS_TARJETA.evento.venceNaturalmente).toBe(true);
    expect(TIPOS_TARJETA.sellos.venceNaturalmente).toBe(false);
  });
});
