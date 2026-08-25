import { describe, expect, it } from "vitest";
import { mockupPaseHtml, PASE_DE_MUESTRA } from "./mockup-pase";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MOCKUP DEL PASE, DENTRO DE UN CORREO
 * ════════════════════════════════════════════════════════════════════
 *
 * Un correo no se puede corregir después de mandarlo, y este HTML lo va
 * a leer Outlook — que ignora la mitad del CSS moderno. Estos tests
 * cuidan las tres cosas que romperían el mockup en silencio: un color
 * que se escapa del atributo `style`, un CSS que Outlook no entiende, y
 * una cuenta de sellos que no coincide con lo que dice el número.
 */

describe("el color de marca no puede escaparse del atributo", () => {
  it("acepta un hex de seis dígitos", () => {
    expect(mockupPaseHtml({ ...PASE_DE_MUESTRA, color: "#ff8800" })).toContain(
      "background:#ff8800",
    );
  });

  it("rechaza cualquier otra cosa y cae al navy", () => {
    // Este color puede venir de la tarjeta que configuró un negocio, y
    // va DIRECTO a un `style=""`. Un `;` o unas comillas ahí adentro
    // reescriben el resto del estilo — o cierran la etiqueta.
    const veneno = '#fff;"><script>alert(1)</script>';
    const html = mockupPaseHtml({ ...PASE_DE_MUESTRA, color: veneno });

    expect(html).not.toContain("<script>");
    expect(html).toContain("background:#16295e");
  });

  it("rechaza un hex de tres dígitos, aunque sea válido en CSS", () => {
    // `#f80` es CSS legítimo, pero aceptar largos variables abre la
    // puerta a validar con una expresión más laxa. Mejor un solo formato.
    expect(mockupPaseHtml({ ...PASE_DE_MUESTRA, color: "#f80" })).toContain(
      "background:#16295e",
    );
  });
});

describe("el nombre del negocio se escapa", () => {
  it("no deja pasar etiquetas", () => {
    const html = mockupPaseHtml({
      ...PASE_DE_MUESTRA,
      negocio: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("tampoco en el premio", () => {
    const html = mockupPaseHtml({ ...PASE_DE_MUESTRA, premio: "<b>gratis</b>" });
    expect(html).not.toContain("<b>gratis</b>");
  });
});

describe("los sellos cuentan lo que dice el número", () => {
  /** Los sellos ganados llevan el naranja; los que faltan van opacos. */
  const ganados = (html: string) =>
    (html.match(/color:#f39200/g) ?? []).length;

  it("dibuja exactamente los que se ganaron", () => {
    expect(ganados(mockupPaseHtml({ ...PASE_DE_MUESTRA, saldo: 6, meta: 8 }))).toBe(6);
    expect(ganados(mockupPaseHtml({ ...PASE_DE_MUESTRA, saldo: 0, meta: 8 }))).toBe(0);
    expect(ganados(mockupPaseHtml({ ...PASE_DE_MUESTRA, saldo: 8, meta: 8 }))).toBe(8);
  });

  it("un saldo mayor que la meta no dibuja sellos de más", () => {
    const html = mockupPaseHtml({ ...PASE_DE_MUESTRA, saldo: 99, meta: 8 });
    expect(ganados(html)).toBe(8);
    expect(html).toContain("8 / 8");
  });

  it("una meta enorme se corta y lo dice, en vez de mentir", () => {
    const html = mockupPaseHtml({ ...PASE_DE_MUESTRA, saldo: 3, meta: 30 });
    // 12 dibujados + «+18», y el encabezado sigue diciendo la meta real.
    expect(html).toContain("+18");
    expect(html).toContain("3 / 30");
  });
});

describe("lo que Outlook no entiende no puede estar acá", () => {
  const html = mockupPaseHtml();

  it("nada de variables CSS", () => {
    // Ningún cliente de correo las soporta: se renderizarían como
    // transparente o negro. Es la misma regla escrita en
    // sello-acreditado.ts.
    expect(html).not.toContain("var(--");
  });

  it("nada de flexbox ni grid", () => {
    expect(html).not.toMatch(/display:\s*(flex|grid)/);
  });

  it("los sellos son un glifo, no un div redondeado", () => {
    // `border-radius:50%` se ve cuadrado en Outlook. El carácter ●
    // (&#9679;) sale igual en todos lados.
    expect(html).toContain("&#9679;");
  });

  it("se dice que es un ejemplo", () => {
    // Regla dura del repo: nada inventado presentado como real.
    expect(html.toLowerCase()).toContain("ejemplo ilustrativo");
  });
});
