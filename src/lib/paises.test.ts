import { describe, expect, it } from "vitest";
import { PROVINCIAS } from "@/app/mi-negocio/types";
import {
  CODIGOS_PAIS,
  PAISES,
  PAIS_POR_DEFECTO,
  esPais,
  esRegionDe,
  etiquetaRegion,
  etiquetaRegionPlural,
  paisDe,
  regionesDe,
} from "./paises";

/**
 * EL CANDADO DE COSTA RICA.
 *
 * Estas 7 provincias no son "datos de ejemplo": son las que están
 * guardadas en la columna `ranchos.provincia` de producción y las únicas
 * que acepta el CHECK de 0008_marketplace_fase1.sql. Si alguien las
 * reordena, les quita una tilde o "arregla" Limón, los negocios vivos
 * dejan de matchear su propia provincia y el filtro por zona se vacía en
 * silencio — sin ningún error visible.
 *
 * Por eso el valor esperado está escrito a mano acá y NO derivado del
 * catálogo: un test que se calcula del código que prueba no protege nada.
 */
const PROVINCIAS_CR_HOY = [
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limón",
];

describe("Costa Rica no se puede mover", () => {
  it("tiene exactamente las 7 provincias de hoy, en el mismo orden y con las mismas tildes", () => {
    expect(regionesDe("cr")).toEqual(PROVINCIAS_CR_HOY);
  });

  it("no se despega de PROVINCIAS, la lista que hoy usa el formulario", () => {
    // Mientras las dos listas convivan (la fase siguiente unifica), tienen
    // que decir lo mismo: si una se edita sin la otra, el negocio se
    // guarda con una provincia que la otra pantalla no reconoce.
    expect(regionesDe("cr")).toEqual([...PROVINCIAS]);
  });

  it("es el país por defecto y usa la palabra «Provincia»", () => {
    expect(PAIS_POR_DEFECTO).toBe("cr");
    expect(paisDe("cr").nombre).toBe("Costa Rica");
    expect(etiquetaRegion("cr")).toBe("Provincia");
    expect(etiquetaRegionPlural("cr")).toBe("Provincias");
  });
});

describe("integridad del catálogo", () => {
  it("no repite códigos", () => {
    const codigos = PAISES.map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("todo código es ISO 3166-1 alfa-2 en minúscula", () => {
    // El código va en la URL (/cr, /pa): una mayúscula suelta abriría dos
    // rutas para el mismo país y dos escrituras del dato en la base.
    for (const p of PAISES) {
      expect(p.codigo).toMatch(/^[a-z]{2}$/);
    }
  });

  it("CODIGOS_PAIS es el espejo exacto del catálogo", () => {
    expect([...CODIGOS_PAIS]).toEqual(PAISES.map((p) => p.codigo));
  });

  it("todo país trae los datos completos (nada a medias)", () => {
    // Un catálogo corto y correcto es la regla; este test es lo que
    // impide que entre un país nuevo con la moneda o las regiones vacías.
    for (const p of PAISES) {
      expect(p.nombre.length, p.codigo).toBeGreaterThan(0);
      expect(p.gentilicio.length, p.codigo).toBeGreaterThan(0);
      expect(p.bandera.length, p.codigo).toBeGreaterThan(0);
      expect(p.prefijoTelefono, p.codigo).toMatch(/^\+\d{1,4}$/);
      expect(p.region.singular.length, p.codigo).toBeGreaterThan(0);
      expect(p.region.plural.length, p.codigo).toBeGreaterThan(0);
      expect(p.regiones.length, p.codigo).toBeGreaterThan(0);
      expect(new Set(p.regiones).size, p.codigo).toBe(p.regiones.length);
      expect(p.regiones.every((r) => r.trim().length > 0), p.codigo).toBe(true);
    }
  });

  /**
   * La moneda está DECLARADA pero todavía no la usa nadie: la fase de
   * moneda por país llega después. Igual se valida ahora, porque el
   * momento de meter un código inventado es cuando nada lo lee.
   */
  it("declara la moneda con código ISO 4217 y símbolo, lista para la fase de moneda", () => {
    for (const p of PAISES) {
      expect(p.moneda.codigo, p.codigo).toMatch(/^[A-Z]{3}$/);
      expect(p.moneda.simbolo.length, p.codigo).toBeGreaterThan(0);
      expect(p.locale, p.codigo).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
    // El colón sigue siendo el de siempre: nada de esto cambió un precio.
    expect(paisDe("cr").moneda).toEqual({ codigo: "CRC", simbolo: "₡" });
  });
});

describe("esPais", () => {
  it("reconoce los países del catálogo", () => {
    expect(esPais("cr")).toBe(true);
    expect(esPais("pa")).toBe(true);
  });

  it("rechaza lo que no es un código conocido", () => {
    expect(esPais("ar")).toBe(false);
    expect(esPais("")).toBe(false);
    expect(esPais(null)).toBe(false);
    expect(esPais(undefined)).toBe(false);
    expect(esPais(506)).toBe(false);
    expect(esPais({ codigo: "cr" })).toBe(false);
  });

  it("es estricto con las mayúsculas: el código canónico es minúscula", () => {
    expect(esPais("CR")).toBe(false);
  });
});

describe("paisDe siempre devuelve algo", () => {
  /**
   * Esta es la garantía que sostiene toda la migración: hoy ninguna fila
   * de la base tiene país. Si `paisDe` pudiera devolver null, cada
   * publicación vieja rompería la página que la muestra.
   */
  it("cae en Costa Rica ante null, undefined, vacío o basura", () => {
    for (const entrada of [null, undefined, "", "   ", "xx", "zzz", "1", "cr!"]) {
      expect(paisDe(entrada).codigo, JSON.stringify(entrada)).toBe("cr");
    }
  });

  it("normaliza mayúsculas y espacios de una URL escrita a mano", () => {
    expect(paisDe("CR").codigo).toBe("cr");
    expect(paisDe(" pa ").codigo).toBe("pa");
    expect(paisDe("MX").codigo).toBe("mx");
  });

  it("devuelve el país real cuando el código es válido", () => {
    expect(paisDe("pa").nombre).toBe("Panamá");
    expect(paisDe("mx").prefijoTelefono).toBe("+52");
  });
});

describe("la UI usa la palabra de cada país", () => {
  it("dice Provincia, Estado o Departamento según corresponda", () => {
    expect(etiquetaRegion("cr")).toBe("Provincia");
    expect(etiquetaRegion("pa")).toBe("Provincia");
    expect(etiquetaRegion("mx")).toBe("Estado");
    expect(etiquetaRegion("co")).toBe("Departamento");
  });

  it("un país desconocido no deja el label vacío: habla como Costa Rica", () => {
    expect(etiquetaRegion("zz")).toBe("Provincia");
    expect(etiquetaRegionPlural(null)).toBe("Provincias");
    expect(regionesDe(undefined)).toEqual(PROVINCIAS_CR_HOY);
  });
});

describe("esRegionDe", () => {
  it("acepta una región del país y rechaza la de otro", () => {
    expect(esRegionDe("cr", "Guanacaste")).toBe(true);
    expect(esRegionDe("pa", "Chiriquí")).toBe(true);
    expect(esRegionDe("cr", "Chiriquí")).toBe(false);
    expect(esRegionDe("mx", "Jalisco")).toBe(true);
    expect(esRegionDe("co", "Antioquia")).toBe(true);
  });

  it("compara exacto: sin tilde NO es la misma provincia", () => {
    // Aceptar "Limon" metería dos escrituras del mismo lugar en la
    // columna y partiría en dos el filtro por zona.
    expect(esRegionDe("cr", "Limón")).toBe(true);
    expect(esRegionDe("cr", "Limon")).toBe(false);
    expect(esRegionDe("cr", "limón")).toBe(false);
    expect(esRegionDe("cr", " Limón ")).toBe(false);
  });

  it("tolera null y undefined sin reventar", () => {
    expect(esRegionDe("cr", null)).toBe(false);
    expect(esRegionDe("cr", undefined)).toBe(false);
    expect(esRegionDe(null, "San José")).toBe(true); // sin país = Costa Rica
  });
});
