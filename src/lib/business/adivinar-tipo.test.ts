import { describe, expect, it } from "vitest";
import {
  SENALES_TIPO,
  adivinarTipoNegocio,
  normalizarTexto,
  type TipoSugerible,
} from "./adivinar-tipo";
import { TIPOS_NEGOCIO, esTipoNegocio, type TipoNegocioId } from "./modulos";

/** Solo el nombre: es el caso del registro antes de elegir vertical. */
function porNombre(nombre: string): TipoNegocioId | null {
  return adivinarTipoNegocio({ nombre });
}

describe("normalizarTexto", () => {
  it("baja las tildes y la ñ, y parte por palabras", () => {
    expect(normalizarTexto("Estética Unisex")).toEqual(["estetica", "unisex"]);
    expect(normalizarTexto("UÑAS")).toEqual(["unas"]);
    expect(normalizarTexto("Hotel & Spa  Tabacón")).toEqual(["hotel", "spa", "tabacon"]);
    expect(normalizarTexto("Nails/Beauty")).toEqual(["nails", "beauty"]);
  });

  it("no devuelve palabras vacías ni con espacios de sobra", () => {
    expect(normalizarTexto("   ")).toEqual([]);
    expect(normalizarTexto("")).toEqual([]);
    expect(normalizarTexto("  ¡Soda La Casona!  ")).toEqual(["soda", "la", "casona"]);
  });
});

describe("el catálogo de señales", () => {
  it("todas las señales están ya normalizadas", () => {
    // Una señal con tilde o mayúscula no matchea NUNCA, y falla en
    // silencio: el adivinador simplemente deja de sugerir ese rubro.
    for (const tipo of Object.keys(SENALES_TIPO) as TipoSugerible[]) {
      for (const senal of SENALES_TIPO[tipo]) {
        expect(normalizarTexto(senal).join(" "), `${tipo}: "${senal}"`).toBe(senal);
      }
    }
  });

  it("ninguna señal pertenece a dos tipos", () => {
    // Una palabra repetida sería un empate permanente, o sea un null
    // garantizado cada vez que aparece.
    const duenio = new Map<string, TipoSugerible>();
    for (const tipo of Object.keys(SENALES_TIPO) as TipoSugerible[]) {
      for (const senal of SENALES_TIPO[tipo]) {
        expect(duenio.get(senal), `"${senal}" ya es de ${duenio.get(senal)}`).toBeUndefined();
        duenio.set(senal, tipo);
      }
    }
  });

  it("cubre todos los tipos del catálogo menos 'otro'", () => {
    const conSenales = Object.keys(SENALES_TIPO).sort();
    const esperados = TIPOS_NEGOCIO.map((t) => t.id as string)
      .filter((id) => id !== "otro")
      .sort();
    expect(conSenales).toEqual(esperados);
  });
});

describe("adivinarTipoNegocio — el nombre nombra el rubro", () => {
  const rotulos: [string, TipoNegocioId][] = [
    // El primero es un negocio de verdad de la base.
    ["SILENCE BARBER SHOP", "barberia"],
    ["Barbería El Bigote", "barberia"],
    ["Salón de Belleza Marbella", "salon_belleza"],
    ["Peluquería Unisex La Moda", "salon_belleza"],
    ["Nails Studio CR", "unas"],
    ["Uñas y Más", "unas"],
    ["Spa Aguas Claras", "spa"],
    ["Masajes Pura Vida", "masajes"],
    ["Clínica Dental Sonrisa", "consultorio"],
    ["Consultorio Médico Dr. Vargas", "consultorio"],
    ["Veterinaria Huellitas", "consultorio"],
    ["Nutrición Integral CR", "profesional"],
    ["Bufete Solano y Asociados", "profesional"],
    ["Gimnasio Olimpo", "gimnasio"],
    ["CrossFit Escazú", "crossfit"],
    ["Pilates Studio Santa Ana", "pilates"],
    ["Yoga Shala Nosara", "yoga"],
    ["Entrenador Personal Diego Mora", "entrenador"],
    ["Academia de Manejo San José", "academia"],
    ["Salón de Eventos La Quinta", "eventos_lugar"],
    ["Catering Doña Flor", "eventos_proveedor"],
    ["Hotel Villa Blanca", "hospedaje"],
    ["Soda La Casona", "restaurante"],
  ];

  for (const [nombre, esperado] of rotulos) {
    it(`"${nombre}" → ${esperado}`, () => {
      expect(porNombre(nombre)).toBe(esperado);
    });
  }

  it("da igual con tildes, sin tildes o en mayúsculas", () => {
    expect(porNombre("Estética Unisex")).toBe("salon_belleza");
    expect(porNombre("Estetica Unisex")).toBe("salon_belleza");
    expect(porNombre("ESTÉTICA UNISEX")).toBe("salon_belleza");
    expect(porNombre("BARBERÍA CLÁSICA")).toBe("barberia");
    expect(porNombre("barberia clasica")).toBe("barberia");
  });
});

describe("adivinarTipoNegocio — compara por palabra completa", () => {
  it("'spa' no está adentro de 'ESPACIO'", () => {
    expect(porNombre("ESPACIO Urbano")).toBeNull();
    expect(porNombre("Espacio Creativo Alajuela")).toBeNull();
  });

  it("'bar' no está adentro de 'Barbería'", () => {
    // Si esto se comparara por substring, toda barbería del país
    // quedaría empatada con "restaurante" y devolvería null.
    expect(porNombre("Barbería Clásica")).toBe("barberia");
    expect(porNombre("Barber Shop El Bigote")).toBe("barberia");
  });

  it("una señal en singular no matchea el plural, por eso están las dos", () => {
    expect(porNombre("Nail Lounge")).toBe("unas");
    expect(porNombre("Nails Lounge")).toBe("unas");
  });
});

describe("adivinarTipoNegocio — ante la duda, null", () => {
  it("dos rubros en el mismo rótulo no se desempatan", () => {
    expect(porNombre("Spa & Barbería El Rey")).toBeNull();
    expect(porNombre("Gimnasio y Spa Olimpo")).toBeNull();
    expect(porNombre("Hair & Nails Studio")).toBeNull();
    expect(porNombre("Escuela de Yoga La Luz")).toBeNull();
  });

  it("ni siquiera con la categoría de por medio: el empate es del nombre", () => {
    expect(
      adivinarTipoNegocio({
        nombre: "Spa & Barbería El Rey",
        vertical: "citas",
        categoria: "barberia",
      }),
    ).toBeNull();
  });

  it("un nombre que no dice nada no sugiere nada", () => {
    expect(porNombre("Rancho Las Torres")).toBeNull();
    expect(porNombre("Estudio Marbella")).toBeNull();
    expect(porNombre("Grupo Empresarial Jiménez")).toBeNull();
    expect(porNombre("Pura Vida CR")).toBeNull();
    expect(porNombre("")).toBeNull();
    expect(porNombre("   ")).toBeNull();
  });

  it("nunca sugiere 'otro': eso no es una sugerencia", () => {
    for (const vertical of ["citas", "eventos", "hospedajes", "restaurantes"]) {
      for (const categoria of ["otros", "belleza", "lugares", "casa", "pizza"]) {
        const adivinado = adivinarTipoNegocio({ nombre: "Estudio Marbella", vertical, categoria });
        expect(adivinado, `${vertical}/${categoria}`).not.toBe("otro");
        if (adivinado !== null) expect(esTipoNegocio(adivinado)).toBe(true);
      }
    }
  });
});

describe("adivinarTipoNegocio — la vertical acota", () => {
  it("en eventos ningún tipo de citas aplica", () => {
    expect(porNombre("Spa Marbella")).toBe("spa");
    expect(adivinarTipoNegocio({ nombre: "Spa Marbella", vertical: "eventos" })).toBeNull();
  });

  it("descartada la señal ajena, contesta la categoría", () => {
    expect(
      adivinarTipoNegocio({ nombre: "Spa Marbella", vertical: "eventos", categoria: "lugares" }),
    ).toBe("eventos_lugar");
    // El spa del hotel no convierte al hotel en un spa.
    expect(
      adivinarTipoNegocio({
        nombre: "Hotel & Spa Tabacón",
        vertical: "hospedajes",
        categoria: "hotel",
      }),
    ).toBe("hospedaje");
  });

  it("el tipo sugerido siempre es uno que la vertical ofrece", () => {
    const sugerido = adivinarTipoNegocio({
      nombre: "Gimnasio Olimpo",
      vertical: "citas",
      categoria: "otros",
    });
    expect(sugerido).toBe("gimnasio");
  });
});

describe("adivinarTipoNegocio — la categoría es el plan B", () => {
  it("cuando el nombre no dice nada, contesta la categoría", () => {
    expect(
      adivinarTipoNegocio({ nombre: "Estudio Marbella", vertical: "citas", categoria: "barberia" }),
    ).toBe("barberia");
    expect(
      adivinarTipoNegocio({ nombre: "Casa Verde", vertical: "hospedajes", categoria: "casa" }),
    ).toBe("hospedaje");
    expect(
      adivinarTipoNegocio({ nombre: "La Terraza", vertical: "restaurantes", categoria: "italiana" }),
    ).toBe("restaurante");
  });

  it("la categoría 'otros' de Citas no alcanza para sugerir nada", () => {
    // Es el caso más común de la base: el gimnasio que se publica en
    // 'otros'. Sin señal en el nombre, mejor que el dueño elija.
    expect(
      adivinarTipoNegocio({ nombre: "Estudio Marbella", vertical: "citas", categoria: "otros" }),
    ).toBeNull();
  });

  it("el nombre le gana a la categoría", () => {
    expect(
      adivinarTipoNegocio({ nombre: "CrossFit Escazú", vertical: "citas", categoria: "otros" }),
    ).toBe("crossfit");
    expect(
      adivinarTipoNegocio({ nombre: "Yoga Shala", vertical: "citas", categoria: "belleza" }),
    ).toBe("yoga");
  });

  it("sin categoría no hay plan B: la vertical sola no decide", () => {
    // "eventos" a secas derivaría 'eventos_proveedor' por descarte, y
    // entre un salón y un DJ eso es una moneda al aire.
    expect(adivinarTipoNegocio({ nombre: "Villa Antigua", vertical: "eventos" })).toBeNull();
    expect(adivinarTipoNegocio({ nombre: "Villa Antigua", vertical: "citas" })).toBeNull();
  });

  it("una vertical que este deploy no conoce no deriva nada", () => {
    expect(
      adivinarTipoNegocio({
        nombre: "Rancho Las Torres",
        vertical: "vertical_futura",
        categoria: "lugares",
      }),
    ).toBeNull();
  });
});
