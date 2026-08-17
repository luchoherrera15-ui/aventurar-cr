import { describe, expect, it } from "vitest";
import {
  MIN_CARRIL,
  MIN_PARA_CARRILES,
  TOPE_CARRIL,
  TOPE_CARRILES,
  agruparEnCarriles,
} from "./carriles-home";
import type { Rancho } from "@/app/mi-negocio/types";

/**
 * ============================================================
 * EL REPARTO DE LOS CARRILES DE LA PORTADA
 * ============================================================
 *
 * `agruparEnCarriles` es pura —no toca red ni la fecha del sistema— así
 * que se puede probar entera con filas de mentira. Lo que estas pruebas
 * fijan es exactamente lo que la portada no puede permitirse:
 *
 *  · que un carril salga con una sola tarjeta (grita «esto está vacío»);
 *  · que una pestaña sin negocios desaparezca sin aviso;
 *  · que el negocio que ya se está viendo QUIETO en la vitrina de arriba
 *    aparezca repetido tres centímetros más abajo;
 *  · que un negocio publicado quede invisible porque su rubro no llegó
 *    al mínimo;
 *  · que «Ranchos para fiestas» necesite una línea de código el día que
 *    haya tres publicados.
 */

/** Fecha de alta: más chico = más viejo. Sirve para el desempate. */
function fecha(dia: number): string {
  return new Date(Date.UTC(2026, 0, dia)).toISOString();
}

let contador = 0;

/**
 * Una fila de `ranchos` con lo mínimo que mira el agrupador. El resto
 * de las ~60 columnas no se toca acá: el cast es a propósito y está
 * acotado a esta fábrica.
 */
function negocio(campos: {
  id?: string;
  vertical?: string;
  categoria: string;
  subcategoria?: string | null;
  destacadoOrden?: number | null;
  dia?: number;
}): Rancho {
  contador += 1;
  return {
    id: campos.id ?? `n${contador}`,
    nombre: `Negocio ${contador}`,
    slug: `negocio-${contador}`,
    vertical: campos.vertical ?? "eventos",
    categoria: campos.categoria,
    subcategoria: campos.subcategoria ?? null,
    destacado_orden: campos.destacadoOrden ?? null,
    created_at: fecha(campos.dia ?? 1),
    detalles: {},
  } as unknown as Rancho;
}

/** Tres negocios de la misma categoría, sin subcategoría. */
function tres(categoria: string, vertical = "eventos"): Rancho[] {
  return [
    negocio({ categoria, vertical }),
    negocio({ categoria, vertical }),
    negocio({ categoria, vertical }),
  ];
}

describe("la escalera de estados", () => {
  it("NIVEL C · cero negocios en la vertical: la pestaña existe igual, vacía", () => {
    const panel = agruparEnCarriles([], "eventos");
    expect(panel.nivel).toBe("C");
    expect(panel.carriles).toEqual([]);
    expect(panel.sueltos).toEqual([]);
  });

  it("NIVEL C · hay negocios, pero todos son de la OTRA vertical", () => {
    const soloCitas = [...tres("belleza", "citas"), ...tres("unas", "citas")];
    expect(agruparEnCarriles(soloCitas, "eventos").nivel).toBe("C");
    // La misma lista, del lado que sí le corresponde.
    expect(agruparEnCarriles(soloCitas, "citas").nivel).toBe("A");
  });

  it("NIVEL B · un solo negocio: una tarjeta y CERO carriles", () => {
    const panel = agruparEnCarriles([negocio({ categoria: "lugares" })], "eventos");
    expect(panel.nivel).toBe("B");
    expect(panel.carriles).toHaveLength(0);
    expect(panel.sueltos).toHaveLength(1);
  });

  it("NIVEL B · tres en UNA sola categoría: llega al mínimo del carril pero no al de la pestaña", () => {
    const panel = agruparEnCarriles(tres("lugares"), "eventos");
    // El grupo sí junta MIN_CARRIL; lo que falta es el segundo grupo.
    expect(MIN_PARA_CARRILES).toBe(2);
    expect(panel.nivel).toBe("B");
    expect(panel.carriles).toHaveLength(0);
    expect(panel.sueltos).toHaveLength(3);
  });

  it("NIVEL A · 3 + 3 en dos categorías: dos carriles, en el orden oficial", () => {
    const panel = agruparEnCarriles(
      [...tres("alimentacion"), ...tres("lugares")],
      "eventos",
    );
    expect(panel.nivel).toBe("A");
    expect(panel.carriles.map((c) => c.titulo)).toEqual(["Lugares", "Alimentación"]);
    expect(panel.carriles.every((c) => c.items.length === 3)).toBe(true);
    expect(panel.sueltos).toEqual([]);
  });

  it("NIVEL A en Citas usa los títulos vendedores, no el label corto del chip", () => {
    const panel = agruparEnCarriles(
      [...tres("belleza", "citas"), ...tres("unas", "citas")],
      "citas",
    );
    expect(panel.carriles.map((c) => c.titulo)).toEqual(["Salones de belleza", "Uñas"]);
    expect(panel.carriles[0].verTodoHref).toBe("/citas?categoria=belleza");
  });
});

describe("la regla de dos niveles: la subcategoría abre carril sola", () => {
  it("tres de la misma subcategoría abren «Ranchos para fiestas», sin hardcodear nada", () => {
    const ranchos = [
      negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
      negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
      negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
    ];
    const panel = agruparEnCarriles([...ranchos, ...tres("alimentacion")], "eventos");

    expect(panel.nivel).toBe("A");
    expect(panel.carriles.map((c) => c.titulo)).toEqual([
      "Ranchos para fiestas",
      "Alimentación",
    ]);
    const rancheado = panel.carriles[0];
    expect(rancheado.eje).toBe("subcategoria");
    // El directorio no filtra por subcategoría: el «Ver todo» manda a
    // la categoría padre, que sí existe como filtro.
    expect(rancheado.verTodoHref).toBe("/eventos?categoria=lugares");
  });

  it("DOS de la misma subcategoría NO abren carril: se quedan con su categoría padre", () => {
    const panel = agruparEnCarriles(
      [
        negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
        negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
        negocio({ categoria: "lugares", subcategoria: "sala_eventos" }),
        ...tres("alimentacion"),
      ],
      "eventos",
    );
    expect(panel.carriles.map((c) => c.titulo)).toEqual(["Lugares", "Alimentación"]);
    expect(panel.carriles[0].items).toHaveLength(3);
  });

  it("la subcategoría se lleva SOLO los suyos; el padre sigue con el resto", () => {
    const panel = agruparEnCarriles(
      [
        negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
        negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
        negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
        negocio({ categoria: "lugares", subcategoria: "finca_fiestas" }),
        negocio({ categoria: "lugares", subcategoria: "hotel_eventos" }),
        negocio({ categoria: "lugares", subcategoria: null }),
      ],
      "eventos",
    );
    expect(panel.nivel).toBe("A");
    // La fila específica va antes que su padre, y los tres que no
    // llegaron a subcategoría propia siguen dentro de «Lugares».
    expect(panel.carriles.map((c) => c.titulo)).toEqual([
      "Ranchos para fiestas",
      "Lugares",
    ]);
    expect(panel.carriles[1].items).toHaveLength(3);
  });

  it("una subcategoría que la taxonomía no conoce no inventa una fila con título crudo", () => {
    const panel = agruparEnCarriles(
      [
        negocio({ categoria: "lugares", subcategoria: "rancho_de_1998" }),
        negocio({ categoria: "lugares", subcategoria: "rancho_de_1998" }),
        negocio({ categoria: "lugares", subcategoria: "rancho_de_1998" }),
        ...tres("alimentacion"),
      ],
      "eventos",
    );
    expect(panel.carriles.map((c) => c.titulo)).toEqual(["Lugares", "Alimentación"]);
  });
});

describe("ningún negocio publicado queda invisible", () => {
  it("lo que no llega al mínimo se junta en el carril de cierre «Más en …»", () => {
    const panel = agruparEnCarriles(
      [
        ...tres("lugares"),
        ...tres("alimentacion"),
        negocio({ categoria: "decoracion" }),
        negocio({ categoria: "otros" }),
      ],
      "eventos",
    );
    expect(panel.carriles.map((c) => c.titulo)).toEqual([
      "Lugares",
      "Alimentación",
      "Más en Eventos",
    ]);
    const cierre = panel.carriles[2];
    expect(cierre.eje).toBe("resto");
    expect(cierre.items).toHaveLength(2);
    expect(cierre.verTodoHref).toBe("/eventos");
  });

  it("el carril de cierre CUENTA para el tope: nunca salen más de TOPE_CARRILES filas", () => {
    // Las seis categorías de Eventos con tres cada una, MÁS la fila de
    // subcategoría que abre «Ranchos para fiestas»: siete candidatas
    // llenas. Salen seis filas, y la séptima no se evapora — cae en el
    // carril de cierre.
    const siete = [
      negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
      negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
      negocio({ categoria: "lugares", subcategoria: "rancho_fiestas" }),
      ...tres("lugares"),
      ...tres("alimentacion"),
      ...tres("animacion"),
      ...tres("organizacion"),
      ...tres("decoracion"),
      ...tres("otros"),
    ];
    const panel = agruparEnCarriles(siete, "eventos");
    expect(panel.carriles).toHaveLength(TOPE_CARRILES);
    expect(panel.carriles[TOPE_CARRILES - 1].titulo).toBe("Más en Eventos");
    // Las dos categorías que se quedaron sin fila propia siguen visibles.
    expect(panel.carriles[TOPE_CARRILES - 1].items).toHaveLength(6);
  });

  it("un carril no crece sin fin: se corta en TOPE_CARRIL y el resto queda a un clic", () => {
    const muchos = Array.from({ length: TOPE_CARRIL + 5 }, (_, i) =>
      negocio({ categoria: "lugares", dia: i + 1 }),
    );
    const panel = agruparEnCarriles([...muchos, ...tres("alimentacion")], "eventos");
    expect(panel.carriles[0].items).toHaveLength(TOPE_CARRIL);
  });
});

describe("la vitrina de arriba no se repite abajo", () => {
  const quieto = negocio({ id: "banner", categoria: "lugares", dia: 9 });
  const acompanantes = [...tres("lugares"), ...tres("alimentacion")];

  it("el banner QUIETO se saca de los carriles", () => {
    const panel = agruparEnCarriles(
      [quieto, ...acompanantes],
      "eventos",
      [],
      ["banner"],
    );
    const ids = panel.carriles.flatMap((c) => c.items.map((i) => i.id));
    expect(ids).not.toContain("banner");
  });

  it("un súper destacado que SÍ rota puede aparecer abajo, y va primero en su fila", () => {
    const panel = agruparEnCarriles(
      [quieto, ...acompanantes],
      "eventos",
      ["banner"],
      [],
    );
    expect(panel.carriles[0].items[0].id).toBe("banner");
  });

  it("con la vitrina escondida, el nivel puede caer de A a B", () => {
    const lista = [
      negocio({ id: "banner", categoria: "lugares" }),
      negocio({ categoria: "lugares" }),
      negocio({ categoria: "lugares" }),
      ...tres("alimentacion"),
    ];
    // Con el banner adentro son 3 + 3: dos carriles.
    expect(agruparEnCarriles(lista, "eventos").nivel).toBe("A");
    // Sacándolo, Lugares se queda en dos y la pestaña entera baja a
    // grilla centrada — que es exactamente lo que la escalera existe
    // para evitar: un carril de dos tarjetas.
    const panel = agruparEnCarriles(lista, "eventos", [], ["banner"]);
    expect(panel.nivel).toBe("B");
    expect(panel.sueltos).toHaveLength(5);
  });
});

describe("el orden dentro de un carril", () => {
  it("súper destacado → destacado_orden ascendente → created_at descendente", () => {
    const items = [
      negocio({ id: "viejo", categoria: "lugares", dia: 1 }),
      negocio({ id: "nuevo", categoria: "lugares", dia: 20 }),
      negocio({ id: "destacado-2", categoria: "lugares", destacadoOrden: 2, dia: 2 }),
      negocio({ id: "destacado-1", categoria: "lugares", destacadoOrden: 1, dia: 2 }),
      negocio({ id: "super", categoria: "lugares", dia: 1 }),
    ];
    const panel = agruparEnCarriles(
      [...items, ...tres("alimentacion")],
      "eventos",
      ["super"],
    );
    expect(panel.carriles[0].items.map((i) => i.id)).toEqual([
      "super",
      "destacado-1",
      "destacado-2",
      "nuevo",
      "viejo",
    ]);
  });

  it("un súper destacado le gana a un destacado_orden bajo", () => {
    const panel = agruparEnCarriles(
      [
        negocio({ id: "orden-1", categoria: "lugares", destacadoOrden: 1 }),
        negocio({ id: "super", categoria: "lugares", destacadoOrden: null }),
        negocio({ id: "suelto", categoria: "lugares" }),
        ...tres("alimentacion"),
      ],
      "eventos",
      ["super"],
    );
    expect(panel.carriles[0].items[0].id).toBe("super");
    expect(panel.carriles[0].items[1].id).toBe("orden-1");
  });

  it("`destacado_orden` en null es «no destacado», no «cero»", () => {
    const panel = agruparEnCarriles(
      [
        negocio({ id: "sin-marca", categoria: "lugares", dia: 30 }),
        negocio({ id: "orden-5", categoria: "lugares", destacadoOrden: 5, dia: 1 }),
        negocio({ id: "otro-sin-marca", categoria: "lugares", dia: 29 }),
        ...tres("alimentacion"),
      ],
      "eventos",
    );
    expect(panel.carriles[0].items.map((i) => i.id)).toEqual([
      "orden-5",
      "sin-marca",
      "otro-sin-marca",
    ]);
  });

  it("el nivel B también respeta ese orden", () => {
    const panel = agruparEnCarriles(
      [
        negocio({ id: "b", categoria: "lugares", dia: 3 }),
        negocio({ id: "a", categoria: "lugares", destacadoOrden: 1, dia: 1 }),
      ],
      "eventos",
    );
    expect(panel.nivel).toBe("B");
    expect(panel.sueltos.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("la función es pura", () => {
  it("no toca el arreglo que recibe", () => {
    const entrada = [...tres("alimentacion"), ...tres("lugares")];
    const copia = [...entrada];
    agruparEnCarriles(entrada, "eventos", [], []);
    expect(entrada).toEqual(copia);
  });

  it("dos llamadas con la misma entrada dan el mismo reparto", () => {
    const entrada = [...tres("lugares"), ...tres("alimentacion")];
    expect(agruparEnCarriles(entrada, "eventos")).toEqual(
      agruparEnCarriles(entrada, "eventos"),
    );
  });

  it("el mínimo del carril es el mismo que la portada ya aplicaba", () => {
    expect(MIN_CARRIL).toBe(3);
  });
});
