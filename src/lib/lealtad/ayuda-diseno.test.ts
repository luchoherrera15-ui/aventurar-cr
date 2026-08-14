import { describe, expect, it } from "vitest";
import {
  armarContextoDeDiseno,
  contextoDelAlta,
  CIERRE_AYUDA,
  TOPE_CONTEXTO,
  type ContextoDiseno,
} from "./ayuda-diseno";
import { coloresDePaleta, PALETAS } from "./paletas";

/**
 * Esto es lo que el admin lee ANTES de contestarle a un negocio que no
 * conoce. Cada caso de acá es una respuesta que, sin este resumen, se
 * gastaría en preguntar qué estaba mirando el dueño.
 */

const CAFE = coloresDePaleta(PALETAS.sellos);

function ctx(extra: Partial<ContextoDiseno> = {}): ContextoDiseno {
  return {
    negocioNombre: "Barbería Silence",
    tarjetaNombre: "Sellos de Silence",
    tipo: "sellos",
    colorFondo: CAFE.fondo,
    colorSello: CAFE.sello,
    iconoSello: "tijera",
    tieneLogo: true,
    tieneBanda: false,
    ...extra,
  };
}

describe("armarContextoDeDiseno", () => {
  it("dice de quién es el pedido y sobre qué tarjeta", () => {
    const texto = armarContextoDeDiseno(ctx());
    expect(texto).toContain("Negocio: Barbería Silence");
    expect(texto).toContain("Tarjeta: «Sellos de Silence» (ya publicada)");
  });

  it("avisa cuando la tarjeta todavía no existe", () => {
    // Es el caso del creador: no hay ninguna fila que abrir en el panel,
    // y el equipo tiene que saberlo antes de ir a buscarla.
    const texto = armarContextoDeDiseno(ctx({ tarjetaNombre: null }));
    expect(texto).toContain("todavía NO existe");
    expect(texto).not.toContain("ya publicada");
  });

  it("un nombre en blanco no deja la línea colgando", () => {
    const texto = armarContextoDeDiseno(ctx({ tarjetaNombre: "   " }));
    expect(texto).toContain("todavía NO existe");
  });

  it("nombra el tipo con el nombre que el dueño vio, no con el id", () => {
    expect(armarContextoDeDiseno(ctx({ tipo: "sellos" }))).toContain("Tipo: Sellos");
    const gift = armarContextoDeDiseno(ctx({ tipo: "giftcard", iconoSello: null }));
    expect(gift).toContain("Tipo: Gift card");
  });

  it("nombra la plantilla cuando los colores son de una", () => {
    const texto = armarContextoDeDiseno(ctx());
    expect(texto).toContain(`fondo ${CAFE.fondo}`);
    expect(texto).toContain(`acento ${CAFE.sello}`);
    expect(texto).toContain("plantilla «Café tostado»");
  });

  it("avisa cuando los colores los eligió a mano", () => {
    // Es la señal más útil del resumen: dos ruedas sueltas son la causa
    // habitual de una tarjeta ilegible, y el equipo lo sabe de una.
    const texto = armarContextoDeDiseno(
      ctx({ colorFondo: "#ffffff", colorSello: "#fefefe" }),
    );
    expect(texto).toContain("elegidos a mano");
    expect(texto).not.toContain("plantilla");
  });

  it("nombra el icono del sello, y dice cuándo va el logo adentro", () => {
    expect(armarContextoDeDiseno(ctx({ iconoSello: "tijera" }))).toContain(
      "Icono del sello: Barbería",
    );
    expect(armarContextoDeDiseno(ctx({ iconoSello: null }))).toContain(
      "Icono del sello: el logo del negocio",
    );
  });

  it("no habla del icono en un tipo que no tiene sellos", () => {
    // Una gift card no tiene círculos que llenar: nombrarle un icono
    // sería inventarle al equipo un dato que no existe.
    const texto = armarContextoDeDiseno(ctx({ tipo: "giftcard", iconoSello: "cafe" }));
    expect(texto).not.toContain("Icono del sello");
  });

  it("dice qué imágenes subió y cuáles no", () => {
    expect(armarContextoDeDiseno(ctx({ tieneLogo: true, tieneBanda: false }))).toContain(
      "Imágenes: logo sí · banda no",
    );
    expect(armarContextoDeDiseno(ctx({ tieneLogo: false, tieneBanda: true }))).toContain(
      "Imágenes: logo no · banda sí",
    );
  });

  it("siempre cierra con el aviso de que esto no cambia nada", () => {
    expect(armarContextoDeDiseno(ctx()).endsWith(CIERRE_AYUDA)).toBe(true);
  });

  it("entra en la columna aunque le manden un nombre absurdo", () => {
    // El recorte NO se puede comer el cierre: sin esa línea, el resumen
    // diría lo contrario de lo que pasó.
    const texto = armarContextoDeDiseno(
      ctx({ negocioNombre: "N".repeat(5000), tarjetaNombre: "T".repeat(5000) }),
    );
    expect(texto.length).toBeLessThanOrEqual(TOPE_CONTEXTO);
    expect(texto.endsWith(CIERRE_AYUDA)).toBe(true);
  });

  it("el hilo que abre un alta personalizada no inventa colores ni tipo", () => {
    // En /lealtad/nuevo la persona describe lo que sueña sin pasar por
    // el creador: no eligió tipo ni colores. Llenar el formato con
    // valores de fábrica le mostraría al equipo una tarjeta que nadie
    // armó, y sobre esa mentira se diseñaría.
    const texto = contextoDelAlta("Barbería Silence");
    expect(texto).toContain("Negocio: Barbería Silence");
    expect(texto).toContain("todavía NO existe");
    expect(texto).not.toContain("Tipo:");
    expect(texto).not.toContain("Colores:");
    expect(texto).not.toContain("Icono del sello");
    expect(texto.endsWith(CIERRE_AYUDA)).toBe(true);
    expect(texto.length).toBeLessThanOrEqual(TOPE_CONTEXTO);
  });

  it("aplasta los saltos de línea que vengan en un nombre", () => {
    // El resumen se lee por líneas; un nombre con enters las partiría y
    // el «Tipo:» siguiente parecería parte del nombre.
    const texto = armarContextoDeDiseno(ctx({ negocioNombre: "Barbería\n\nSilence" }));
    expect(texto).toContain("Negocio: Barbería Silence");
  });
});
