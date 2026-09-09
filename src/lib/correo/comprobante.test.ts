import { describe, expect, it } from "vitest";
import {
  fechaLarga,
  htmlComprobante,
  numeroDeComprobante,
  subtotalDe,
  totalDe,
  type Comprobante,
} from "./comprobante";

const BASE: Comprobante = {
  numero: "BK-2026-09-1A2B3C",
  fechaISO: "2026-09-09T15:04:00.000Z",
  cliente: { nombre: "Luis Herrera", correo: "luis@ejemplo.com" },
  producto: "Linksy Pro",
  periodo: "9 de septiembre al 8 de octubre de 2026",
  metodoPago: "Tarjeta terminada en 4242",
  renglones: [
    { concepto: "Linksy Pro · mensual", detalle: "Tu página, sin límites", monto: 9 },
    { concepto: "Add-on: Instagram Auto Reply", monto: 3 },
  ],
  moneda: "USD",
  proximoCobroISO: "2026-10-09",
  urlPanel: "https://bookea.lat/solutions/panel/abc",
};

describe("numeroDeComprobante", () => {
  it("lleva el año y el mes del cobro, y la cola del id", () => {
    expect(numeroDeComprobante("tx_9f8e7d6c5b4a3210", "2026-09-09")).toBe("BK-2026-09-4A3210");
  });

  it("el MISMO cobro da SIEMPRE el mismo número: reenviar no inventa otro", () => {
    const a = numeroDeComprobante("tx_abc123", "2026-09-09T10:00:00Z");
    const b = numeroDeComprobante("tx_abc123", "2026-09-09T23:59:00Z");
    expect(a).toBe(b);
  });

  it("dos cobros distintos no chocan", () => {
    expect(numeroDeComprobante("tx_aaa111", "2026-09-09")).not.toBe(numeroDeComprobante("tx_bbb222", "2026-09-09"));
  });

  it("aguanta un id vacío o con símbolos", () => {
    expect(numeroDeComprobante("", "2026-09-09")).toMatch(/^BK-2026-09-\d{6}$/);
    expect(numeroDeComprobante("pi_3Q-x/y", "2026-01-02")).toMatch(/^BK-2026-01-/);
  });
});

describe("las cuentas", () => {
  it("el subtotal suma los renglones", () => {
    expect(subtotalDe(BASE)).toBe(12);
  });

  it("sin impuesto, el total ES el subtotal", () => {
    expect(totalDe(BASE)).toBe(12);
  });

  it("con impuesto, lo suma", () => {
    expect(totalDe({ ...BASE, impuesto: { etiqueta: "IVA 13%", monto: 1.56 } })).toBe(13.56);
  });

  it("no arrastra centavos fantasma", () => {
    const c = { ...BASE, renglones: [{ concepto: "a", monto: 0.1 }, { concepto: "b", monto: 0.2 }] };
    expect(subtotalDe(c)).toBe(0.3);
  });
});

describe("fechaLarga", () => {
  it("escribe el mes con letras", () => {
    expect(fechaLarga("2026-09-09T15:04:00Z")).toBe("9 de septiembre de 2026");
  });

  it("una fecha rota no revienta el correo", () => {
    expect(fechaLarga("no-es-fecha")).toBe("no-es-fech");
  });
});

describe("htmlComprobante", () => {
  const html = htmlComprobante(BASE);

  it("dice qué documento es, y NO se hace pasar por una factura de Hacienda", () => {
    expect(html).toContain("Comprobante de pago");
    expect(html).toContain("No es una factura electrónica autorizada por Hacienda");
    expect(html.toLowerCase()).not.toContain("clave numérica");
  });

  it("muestra el total, el producto y el número", () => {
    expect(html).toContain("$12.00");
    expect(html).toContain("Linksy Pro");
    expect(html).toContain("BK-2026-09-1A2B3C");
  });

  it("pinta un renglón por concepto, con su detalle", () => {
    expect(html).toContain("Add-on: Instagram Auto Reply");
    expect(html).toContain("Tu página, sin límites");
  });

  it("anuncia el próximo cobro cuando la suscripción sigue", () => {
    expect(html).toContain("9 de octubre de 2026");
    expect(htmlComprobante({ ...BASE, proximoCobroISO: undefined })).not.toContain("próximo cobro");
  });

  it("respeta la moneda del cobro: un cliente en Lima no ve colones", () => {
    const soles = htmlComprobante({ ...BASE, moneda: "PEN" });
    expect(soles).toContain("S/");
    expect(soles).not.toContain("₡");
  });

  it("ESCAPA lo que escribió una persona: un nombre con < no puede inyectar HTML", () => {
    const malo = htmlComprobante({
      ...BASE,
      cliente: { nombre: '<script>alert("x")</script>', correo: "a@b.com" },
      renglones: [{ concepto: "<b>Plan</b>", monto: 1 }],
    });
    expect(malo).not.toContain("<script>");
    expect(malo).toContain("&lt;script&gt;");
    expect(malo).toContain("&lt;b&gt;Plan&lt;/b&gt;");
  });

  it("es HTML de correo: sin <style>, sin flexbox y sin JavaScript", () => {
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("position:absolute");
    expect(html).not.toMatch(/<script/i);
  });

  it("todo texto lleva su color declarado: en modo oscuro no desaparece", () => {
    // Cada bloque de texto del cuerpo declara `color:`; el riesgo real
    // es un <div> con font-size y sin color, que Gmail invierte solo.
    const sinColor = html.match(/<div style="(?![^"]*color:)[^"]*font-size:[^"]*"/g);
    expect(sinColor).toBeNull();
  });
});
