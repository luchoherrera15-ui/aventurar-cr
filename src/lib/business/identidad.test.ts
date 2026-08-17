import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ACENTOS,
  ACENTOS_ID,
  FONDOS_PANEL,
  ICONOS_IDENTIDAD,
  IDENTIDADES,
  identidadDe,
  ratioContraste,
  variablesAcento,
  type AcentoId,
} from "./identidad";
import { TIPOS_NEGOCIO, type TipoNegocioId } from "./modulos";
import { palabraReserva } from "./widgets";

// ------------------------------------------------------------
// Cobertura: ningún tipo sin identidad
// ------------------------------------------------------------

describe("cobertura del catálogo", () => {
  // TypeScript ya lo obliga (IDENTIDADES es Record<TipoNegocioId, …>),
  // pero la prueba lo dice en voz alta: si alguien agrega un tipo en
  // modulos.ts y lo tipa a la ligera, acá se cae igual.
  it("todo id de TIPOS_NEGOCIO tiene identidad", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      expect(IDENTIDADES[tipo.id], tipo.id).toBeDefined();
    }
  });

  it("no sobra ninguna identidad de un tipo que ya no existe", () => {
    const ids = new Set<string>(TIPOS_NEGOCIO.map((t) => t.id));
    for (const id of Object.keys(IDENTIDADES)) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("cada tipo declara un acento y un ícono del catálogo cerrado", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const entrada = IDENTIDADES[tipo.id];
      expect(ACENTOS_ID as readonly string[], tipo.id).toContain(entrada.acento);
      expect(ICONOS_IDENTIDAD as readonly string[], tipo.id).toContain(entrada.icono);
    }
  });

  it("la descripción es una línea de verdad: existe, es corta y no tiene saltos", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const { descripcion } = IDENTIDADES[tipo.id];
      expect(descripcion.trim(), tipo.id).not.toBe("");
      expect(descripcion, tipo.id).not.toContain("\n");
      expect(descripcion.length, tipo.id).toBeLessThanOrEqual(110);
    }
  });

  // El ícono viaja como NOMBRE, así que el único que puede garantizar
  // que existe es este test: se lee icons.tsx como texto para no
  // depender de que vitest sepa transformar JSX.
  it("todo ícono declarado existe de verdad en src/components/icons.tsx", () => {
    const ruta = fileURLToPath(new URL("../../components/icons.tsx", import.meta.url));
    const fuente = readFileSync(ruta, "utf8");
    const exportados = new Set(
      [...fuente.matchAll(/export function (Icon[A-Za-z0-9]*)/g)].map((m) => m[1]),
    );

    expect(exportados.size).toBeGreaterThan(0);
    for (const icono of ICONOS_IDENTIDAD) {
      expect(exportados.has(icono), icono).toBe(true);
    }
  });
});

// ------------------------------------------------------------
// Contraste
// ------------------------------------------------------------

describe("ratioContraste", () => {
  // Antes de usarla para juzgar la paleta, se comprueba la fórmula
  // contra valores publicados: si el medidor está mal calibrado, las
  // pruebas de abajo aprueban colores ilegibles.
  it("reproduce los ratios conocidos de la especificación WCAG", () => {
    expect(ratioContraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(ratioContraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // #767676 sobre blanco es el gris canónico que apenas pasa AA.
    expect(ratioContraste("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(ratioContraste("#0f4c9e", "#ffffff")).toBeCloseTo(8.24, 2);
  });

  it("es simétrica y entiende la forma corta", () => {
    expect(ratioContraste("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(ratioContraste("#fff", "#000")).toBeCloseTo(21, 5);
    expect(ratioContraste("fff", "#000000")).toBeCloseTo(21, 5);
  });

  it("se queja si le pasan algo que no es un color hex", () => {
    expect(() => ratioContraste("var(--acento)", "#ffffff")).toThrow();
    expect(() => ratioContraste("#zzzzzz", "#ffffff")).toThrow();
  });
});

describe("contraste de los acentos", () => {
  const AA_TEXTO = 4.5;
  const AA_GRAFICO = 3; // superficies y bordes, no letras (WCAG 1.4.11)

  it("la tinta se lee sobre TODOS los fondos del panel", () => {
    for (const id of ACENTOS_ID) {
      for (const fondo of FONDOS_PANEL) {
        const ratio = ratioContraste(ACENTOS[id].tinta, fondo);
        expect(ratio, `${id} tinta sobre ${fondo} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
          AA_TEXTO,
        );
      }
    }
  });

  it("la tinta se lee sobre su propio fondo suave (chips y avisos)", () => {
    for (const id of ACENTOS_ID) {
      const { tinta, suave } = ACENTOS[id];
      const ratio = ratioContraste(tinta, suave);
      expect(ratio, `${id} tinta sobre suave = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        AA_TEXTO,
      );
    }
  });

  it("la letra se lee sobre el relleno sólido (botón primario)", () => {
    for (const id of ACENTOS_ID) {
      const { solido, sobreSolido } = ACENTOS[id];
      const ratio = ratioContraste(sobreSolido, solido);
      expect(ratio, `${id} letra sobre sólido = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        AA_TEXTO,
      );
    }
  });

  it("el relleno sólido se distingue del fondo del panel", () => {
    for (const id of ACENTOS_ID) {
      for (const fondo of FONDOS_PANEL) {
        const ratio = ratioContraste(ACENTOS[id].solido, fondo);
        expect(ratio, `${id} sólido sobre ${fondo} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
          AA_GRAFICO,
        );
      }
    }
  });

  it("el fondo suave es suave: casi el papel, para que no compita con el contenido", () => {
    for (const id of ACENTOS_ID) {
      const ratio = ratioContraste(ACENTOS[id].suave, "#ffffff");
      expect(ratio, `${id} suave sobre blanco = ${ratio.toFixed(2)}`).toBeLessThan(1.3);
    }
  });

  it("todos los valores del catálogo son hex de seis dígitos", () => {
    for (const id of ACENTOS_ID) {
      for (const [papel, valor] of Object.entries(ACENTOS[id])) {
        expect(valor, `${id}.${papel}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("los ocho acentos son distintos entre sí", () => {
    const tintas = new Set(ACENTOS_ID.map((id) => ACENTOS[id].tinta));
    expect(tintas.size).toBe(ACENTOS_ID.length);
  });
});

// ------------------------------------------------------------
// Vocabulario
// ------------------------------------------------------------

describe("vocabulario", () => {
  it("una barbería tiene clientes y citas; un consultorio, pacientes y consultas", () => {
    const barberia = identidadDe("barberia").vocabulario;
    expect(barberia.persona.singular).toBe("cliente");
    expect(barberia.persona.plural).toBe("clientes");
    expect(barberia.visita.singular).toBe("cita");
    expect(barberia.visita.plural).toBe("citas");

    const consultorio = identidadDe("consultorio").vocabulario;
    expect(consultorio.persona.singular).toBe("paciente");
    expect(consultorio.persona.plural).toBe("pacientes");
    expect(consultorio.visita.singular).toBe("consulta");
    expect(consultorio.visita.plural).toBe("consultas");
  });

  it("nadie tiene la palabra del otro", () => {
    // El corazón del encargo: estas dos afirmaciones no pueden cruzarse.
    for (const tipo of ["barberia", "salon_belleza", "unas", "spa", "masajes"] as const) {
      expect(identidadDe(tipo).vocabulario.persona.plural, tipo).not.toContain("paciente");
    }
    expect(identidadDe("consultorio").vocabulario.persona.plural).not.toContain("cliente");
  });

  it("el gimnasio tiene miembros y sesiones; la academia, alumnos y clases", () => {
    const gimnasio = identidadDe("gimnasio").vocabulario;
    expect(gimnasio.persona.plural).toBe("miembros");
    expect(gimnasio.visita.plural).toBe("sesiones");

    const academia = identidadDe("academia").vocabulario;
    expect(academia.persona.plural).toBe("alumnos");
    expect(academia.visita.plural).toBe("clases");
  });

  it("los plurales irregulares están declarados a mano, no derivados", () => {
    // "huésped" pierde la tilde en plural y "comensal" gana sílaba:
    // cualquier pluralizador automático los rompe.
    expect(identidadDe("hospedaje").vocabulario.persona.plural).toBe("huéspedes");
    expect(identidadDe("restaurante").vocabulario.persona.plural).toBe("comensales");
  });

  it("toda palabra trae sus cuatro formas, no vacías y bien capitalizadas", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const { persona, visita } = identidadDe(tipo.id).vocabulario;
      for (const [nombre, t] of [
        ["persona", persona],
        ["visita", visita],
      ] as const) {
        const donde = `${tipo.id}.${nombre}`;
        expect(t.singular.trim(), donde).not.toBe("");
        expect(t.plural.trim(), donde).not.toBe("");
        expect(t.Singular, donde).toBe(t.singular.charAt(0).toUpperCase() + t.singular.slice(1));
        expect(t.Plural, donde).toBe(t.plural.charAt(0).toUpperCase() + t.plural.slice(1));
        // Minúsculas en la forma base: los títulos capitalizan, el copy
        // en medio de una frase no.
        expect(t.singular[0], donde).toBe(t.singular[0].toLowerCase());
        expect(t.plural, donde).not.toBe(t.singular);
      }
    }
  });

  it("sin género gramatical: no hay 'clientas' ni 'pacientas'", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const persona = identidadDe(tipo.id).vocabulario.persona;
      expect(persona.plural, tipo.id).not.toMatch(/(clienta|pacienta|alumna|miembra)/);
    }
  });

  // La palabra de la agenda tiene UNA fuente (`palabraReserva`); acá
  // solo se refina. Este test es el que impide que las dos se separen:
  // si mañana `palabraReserva` cambia "cita" por otra cosa, el tipo que
  // no refina tiene que seguirla sin que nadie edite este archivo.
  it("hereda la palabra de la agenda de palabraReserva cuando no la refina", () => {
    const refinan = new Set<TipoNegocioId>(
      TIPOS_NEGOCIO.filter((t) => IDENTIDADES[t.id].visita !== undefined).map((t) => t.id),
    );

    for (const tipo of TIPOS_NEGOCIO) {
      if (refinan.has(tipo.id)) continue;
      const heredada = palabraReserva(tipo.id);
      const visita = identidadDe(tipo.id).vocabulario.visita;
      expect(visita.singular, tipo.id).toBe(heredada.singular);
      expect(visita.plural, tipo.id).toBe(heredada.plural);
      expect(visita.Plural, tipo.id).toBe(heredada.Plural);
    }

    // Y que el mecanismo esté vivo de los dos lados: alguien refina y
    // alguien hereda.
    expect(refinan.size).toBeGreaterThan(0);
    expect(refinan.size).toBeLessThan(TIPOS_NEGOCIO.length);
  });
});

// ------------------------------------------------------------
// identidadDe: nunca se cae
// ------------------------------------------------------------

describe("identidadDe", () => {
  it("devuelve la identidad completa de un tipo conocido", () => {
    const identidad = identidadDe("barberia");
    expect(identidad.tipo).toBe("barberia");
    expect(identidad.reconocido).toBe(true);
    expect(identidad.acentoId).toBe("naranja");
    expect(identidad.acento).toBe(ACENTOS.naranja);
    expect(identidad.icono).toBe("IconPosteBarbero");
    expect(identidad.descripcion.length).toBeGreaterThan(0);
  });

  it("cae en el neutro con null, undefined y basura — sin lanzar", () => {
    const basura: (string | null | undefined)[] = [
      null,
      undefined,
      "",
      "   ",
      "tipo_inventado",
      "BARBERIA",
      "barberia ",
      "__proto__",
      "constructor",
      "toString",
      "0",
    ];

    for (const valor of basura) {
      const identidad = identidadDe(valor);
      expect(identidad.tipo, String(valor)).toBe("otro");
      expect(identidad.reconocido, String(valor)).toBe(false);
      expect(identidad.acento, String(valor)).toBe(ACENTOS.navy);
      expect(identidad.vocabulario.persona.plural, String(valor)).toBe("clientes");
      expect(identidad.descripcion, String(valor)).not.toBe("");
    }
  });

  it("distingue el 'otro' elegido a propósito del tipo que no supimos leer", () => {
    expect(identidadDe("otro").reconocido).toBe(true);
    expect(identidadDe("no_existe").reconocido).toBe(false);
    // Misma pinta, distinta procedencia: el color y las palabras son
    // los mismos, lo que cambia es si el panel puede decir "esto es tuyo".
    expect(identidadDe("otro").acento).toBe(identidadDe("no_existe").acento);
  });

  it("devuelve el MISMO objeto en llamadas repetidas", () => {
    // Lo consumen memos y dependencias de efectos: un objeto nuevo por
    // render volvería inútil cualquier comparación por referencia.
    expect(identidadDe("spa")).toBe(identidadDe("spa"));
    expect(identidadDe(null)).toBe(identidadDe("basura"));
    expect(identidadDe("otro")).not.toBe(identidadDe(null));
  });

  it("todo tipo real se resuelve a sí mismo", () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const identidad = identidadDe(tipo.id);
      expect(identidad.tipo, tipo.id).toBe(tipo.id);
      expect(identidad.reconocido, tipo.id).toBe(true);
      expect(identidad.acento, tipo.id).toBe(ACENTOS[identidad.acentoId as AcentoId]);
    }
  });
});

describe("variablesAcento", () => {
  it("entrega las cuatro variables listas para el contenedor del panel", () => {
    expect(variablesAcento(identidadDe("consultorio"))).toEqual({
      "--acento": ACENTOS.verde.tinta,
      "--acento-solido": ACENTOS.verde.solido,
      "--acento-sobre": ACENTOS.verde.sobreSolido,
      "--acento-suave": ACENTOS.verde.suave,
    });
  });

  it("un tipo desconocido igual pinta: variables completas con el neutro", () => {
    const vars = variablesAcento(identidadDe(null));
    expect(Object.values(vars).every((v) => /^#[0-9a-f]{6}$/.test(v))).toBe(true);
  });
});
