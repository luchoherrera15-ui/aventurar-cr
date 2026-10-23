import { describe, expect, it } from "vitest";
import {
  contextoDeEjemplo,
  extraerTokens,
  formatearNumero,
  largo,
  limpiarTexto,
  nombreDePila,
  recortar,
  renderizar,
  validarVariables,
  variablesParaModo,
  variablesSinAlternativo,
  vistaPrevia,
} from "./mensaje";
import type { ContextoCliente } from "./tipos";

const sellos = (extra: Partial<ContextoCliente> = {}): ContextoCliente => ({
  ...contextoDeEjemplo("sellos", "Café del Parque", "Tarjeta de sellos"),
  ...extra,
});

describe("renderizar", () => {
  it("reemplaza las variables con datos reales", () => {
    const r = renderizar("Vas {{sellos_actuales}} de {{meta_sellos}} en {{nombre_negocio}}", sellos());
    expect(r.texto).toBe("Vas 4 de 5 en Café del Parque");
    expect(r.faltantes).toEqual([]);
  });

  it("tolera espacios dentro de las llaves", () => {
    expect(renderizar("Hola {{ nombre_cliente }}", sellos()).texto).toBe("Hola María");
  });

  it("sin dato y sin alternativo, NO inventa: marca la variable como faltante", () => {
    const r = renderizar("Hola {{nombre_cliente}}, vas {{sellos_actuales}}", sellos({ nombre: null }));
    expect(r.faltantes).toEqual(["nombre_cliente"]);
  });

  it("con alternativo, lo usa", () => {
    const r = renderizar("Hola {{nombre_cliente|amigo}}!", sellos({ nombre: null }));
    expect(r.texto).toBe("Hola amigo!");
    expect(r.faltantes).toEqual([]);
  });

  it("un alternativo vacío hace desaparecer la variable y arregla el espacio que deja", () => {
    expect(renderizar("Hola {{nombre_cliente|}}, gracias por unirte", sellos({ nombre: null })).texto).toBe("Hola, gracias por unirte");
    expect(renderizar("¡Hola {{nombre_cliente|}}!", sellos({ nombre: null })).texto).toBe("¡Hola!");
    expect(renderizar("Hola {{nombre_cliente|}}, gracias", sellos()).texto).toBe("Hola María, gracias");
  });

  it("el dato real gana sobre el alternativo", () => {
    expect(renderizar("{{nombre_cliente|amigo}}", sellos()).texto).toBe("María");
  });

  it("una variable que no existe cuenta como faltante (nunca sale con llaves)", () => {
    const r = renderizar("Hola {{inventada}}", sellos());
    expect(r.texto).not.toContain("{{");
    expect(r.faltantes).toEqual(["inventada"]);
  });

  it("el saldo de cashback lleva su símbolo", () => {
    const cb = contextoDeEjemplo("cashback");
    expect(renderizar("Tenés {{puntos_disponibles}}", cb).texto).toBe("Tenés ₡1 250");
    expect(renderizar("Te faltan {{puntos_faltantes}}", cb).texto).toBe("Te faltan ₡750");
  });

  it("sin recompensa, las variables de la meta quedan faltantes", () => {
    const r = renderizar("Vas {{sellos_actuales}} de {{meta_sellos}}", sellos({ meta: null, recompensa: null }));
    expect(r.faltantes).toEqual(["meta_sellos"]);
  });

  it("los sellos que faltan nunca son negativos", () => {
    expect(renderizar("{{sellos_faltantes}}", sellos({ saldo: 9, meta: 5 })).texto).toBe("0");
  });

  it("no ejecuta ni interpreta el valor de un dato (un nombre con llaves queda como texto)", () => {
    const r = renderizar("Hola {{nombre_cliente}}", sellos({ nombre: "{{nombre_negocio}}" }));
    expect(r.texto).toBe("Hola {{nombre_negocio}}");
  });
});

describe("extraerTokens", () => {
  it("distingue sin alternativo, con alternativo y con alternativo vacío", () => {
    const t = extraerTokens("{{a}} {{b|x}} {{c|}}");
    expect(t.map((x) => [x.nombre, x.alternativo])).toEqual([
      ["a", null],
      ["b", "x"],
      ["c", ""],
    ]);
  });
});

describe("validarVariables", () => {
  const sel = { modo: "sellos", tieneRecompensa: true };
  it("acepta variables válidas", () => {
    expect(validarVariables("{{nombre_cliente}} {{sellos_actuales}}/{{meta_sellos}}", sel)).toEqual([]);
  });
  it("rechaza las que no existen", () => {
    expect(validarVariables("{{foo}}", sel)[0]).toMatch(/no existe/);
  });
  it("rechaza las de otro tipo de tarjeta", () => {
    expect(validarVariables("{{sellos_actuales}}", { modo: "puntos", tieneRecompensa: true })[0]).toMatch(/no se puede usar/);
    expect(validarVariables("{{puntos_disponibles}}", sel)[0]).toMatch(/no se puede usar/);
  });
  it("rechaza las de la recompensa si la tarjeta no tiene", () => {
    expect(validarVariables("{{nombre_recompensa}}", { modo: "sellos", tieneRecompensa: false })[0]).toMatch(/recompensa/);
  });
  it("con alternativo, la falta de recompensa no es error", () => {
    expect(validarVariables("{{nombre_recompensa|tu premio}}", { modo: "sellos", tieneRecompensa: false })).toEqual([]);
  });
  it("detecta llaves sueltas que saldrían tal cual al cliente", () => {
    expect(validarVariables("Hola {{nombre_cliente", sel)[0]).toMatch(/mal escrita/);
    expect(validarVariables("Hola nombre_cliente}}", sel)[0]).toMatch(/mal escrita/);
  });
});

describe("variablesSinAlternativo", () => {
  it("avisa de las que pueden faltar", () => {
    expect(variablesSinAlternativo("Hola {{nombre_cliente}} en {{nombre_negocio}}")).toEqual(["nombre_cliente"]);
    expect(variablesSinAlternativo("Hola {{nombre_cliente|amigo}}")).toEqual([]);
  });
});

describe("variablesParaModo", () => {
  it("cada tipo de tarjeta ve solo las suyas", () => {
    const ids = (m: string) => variablesParaModo(m).map((v) => v.id);
    expect(ids("sellos")).toContain("sellos_actuales");
    expect(ids("sellos")).not.toContain("puntos_disponibles");
    expect(ids("puntos")).toContain("puntos_disponibles");
    expect(ids("puntos")).not.toContain("sellos_actuales");
    expect(ids("cashback")).toContain("puntos_faltantes");
  });
});

describe("limpiarTexto / recortar / largo", () => {
  it("quita los marcadores de ancho cero y controla los espacios", () => {
    expect(limpiarTexto("  hola​   mundo \t ", { unaLinea: true })).toBe("hola mundo");
  });
  it("una sola línea junta los saltos", () => {
    expect(limpiarTexto("uno\ndos\r\ntres", { unaLinea: true })).toBe("uno dos tres");
  });
  it("varias líneas conserva los saltos pero no más de uno en blanco", () => {
    expect(limpiarTexto("uno\n\n\n\ndos", { unaLinea: false })).toBe("uno\n\ndos");
  });
  it("elimina caracteres de control", () => {
    expect(limpiarTexto("a\u0007b\u0000c", { unaLinea: true })).toBe("a b c");
  });
  it("recortar no parte palabras cuando puede y marca el corte", () => {
    expect(recortar("hola mundo cruel", 12)).toBe("hola mundo…");
    expect(recortar("corto", 12)).toBe("corto");
  });
  it("cuenta un emoji como un solo carácter (igual que la base)", () => {
    expect(largo("🎂")).toBe(1);
    expect(largo("Hola 🎂")).toBe(6);
  });
});

describe("vistaPrevia", () => {
  const wallet = { tituloMax: 40, cuerpoMax: 120, unaLinea: true };
  it("arma el título y el cuerpo con los datos del ejemplo", () => {
    const v = vistaPrevia({ titulo: "¡Bienvenido a {{nombre_negocio}}!", cuerpo: "Hola {{nombre_cliente|}}" }, wallet, sellos());
    expect(v.titulo).toBe("¡Bienvenido a Café del Parque!");
    expect(v.cuerpo).toBe("Hola María");
    expect(v.recortado).toBe(false);
  });
  it("avisa si hubo que acortar", () => {
    const v = vistaPrevia({ titulo: "x", cuerpo: "palabra ".repeat(40) }, wallet, sellos());
    expect(v.recortado).toBe(true);
    expect(largo(v.cuerpo)).toBeLessThanOrEqual(120);
  });
  it("devuelve las variables que faltan", () => {
    expect(vistaPrevia({ titulo: "{{nombre_cliente}}", cuerpo: "hola" }, wallet, sellos({ nombre: null })).faltantes).toEqual(["nombre_cliente"]);
  });
});

describe("nombreDePila", () => {
  it("toma solo el primer nombre", () => {
    expect(nombreDePila("María Fernanda López")).toBe("María");
  });
  it("arregla mayúsculas y minúsculas", () => {
    expect(nombreDePila("MARÍA")).toBe("María");
    expect(nombreDePila("maría")).toBe("María");
    expect(nombreDePila("DeAnna")).toBe("DeAnna");
  });
  it("no usa un correo, un número ni vacío como nombre", () => {
    expect(nombreDePila("ana@correo.com")).toBeNull();
    expect(nombreDePila("88887777")).toBeNull();
    expect(nombreDePila("")).toBeNull();
    expect(nombreDePila(null)).toBeNull();
    expect(nombreDePila("A")).toBeNull();
  });
});

describe("formatearNumero", () => {
  it("separa los miles con un espacio normal", () => {
    expect(formatearNumero(1250)).toBe("1 250");
    expect(formatearNumero(1250)).not.toMatch(/ | /);
    expect(formatearNumero(5)).toBe("5");
  });
});
