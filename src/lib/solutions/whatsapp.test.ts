import { describe, expect, it } from "vitest";
import { codigoDePedido, enlaceDeWhatsapp, numeroParaWhatsapp, textoDelPedido } from "./whatsapp";

const base = {
  negocio: "Casa Nostra",
  slug: "casa-nostra",
  codigo: "A1B2",
  renglones: [
    { nombre: "Tagliatelle al ragú", cantidad: 2, precio: 8900 },
    { nombre: "Burrata con tomate", cantidad: 1, precio: 6400 },
  ],
  cliente: {
    nombre: "Luis",
    telefono: "88887777",
    cedula: "1-2345-6789",
    direccion: "Escazú, 200 m sur del parque",
    metodoPago: "efectivo" as const,
    nota: "sin cebolla",
  },
};

describe("textoDelPedido", () => {
  it("para llevar: sin envío ni dirección, con los campos en orden fijo", () => {
    const t = textoDelPedido({ ...base, modalidad: "llevar", costoEnvio: 0, total: 24200 });
    const lineas = t.split("\n");
    expect(lineas[0]).toBe("*Pedido #A1B2 · Casa Nostra*");
    expect(lineas[1]).toBe("Para llevar");
    expect(t).toContain("2× Tagliatelle al ragú — ₡17");
    expect(t).toContain("*Total: ₡24");
    expect(t).not.toContain("Envío");
    expect(t).not.toContain("Dirección");
    // El orden de los datos del cliente es el contrato: la cocina lo
    // lee de un vistazo porque siempre está igual.
    const iNombre = lineas.findIndex((l) => l.startsWith("Nombre:"));
    const iTel = lineas.findIndex((l) => l.startsWith("Teléfono:"));
    const iCed = lineas.findIndex((l) => l.startsWith("Cédula:"));
    const iPago = lineas.findIndex((l) => l.startsWith("Pago:"));
    const iNota = lineas.findIndex((l) => l.startsWith("Nota:"));
    expect([iNombre, iTel, iCed, iPago, iNota]).toEqual([...[iNombre, iTel, iCed, iPago, iNota]].sort((a, b) => a - b));
    expect(lineas.at(-1)).toBe("Enviado desde bookea.lat/s/casa-nostra");
  });

  it("exprés: suma la línea de envío y la dirección", () => {
    const t = textoDelPedido({ ...base, modalidad: "express", costoEnvio: 1500, total: 25700 });
    expect(t.split("\n")[1]).toBe("Exprés");
    expect(t).toContain("Envío — ₡1");
    expect(t).toContain("Dirección: Escazú, 200 m sur del parque");
    expect(t).toContain("Pago: Efectivo");
  });

  it("exprés con envío gratis lo dice, en vez de poner ₡0", () => {
    const t = textoDelPedido({ ...base, modalidad: "express", costoEnvio: 0, total: 24200 });
    expect(t).toContain("Envío — gratis");
  });

  it("omite cédula y nota cuando vienen vacías", () => {
    const t = textoDelPedido({
      ...base,
      modalidad: "llevar",
      costoEnvio: 0,
      total: 24200,
      cliente: { ...base.cliente, cedula: "", nota: "" },
    });
    expect(t).not.toContain("Cédula:");
    expect(t).not.toContain("Nota:");
  });

  it("no usa emojis", () => {
    const t = textoDelPedido({ ...base, modalidad: "express", costoEnvio: 1500, total: 25700 });
    expect(/\p{Extended_Pictographic}/u.test(t)).toBe(false);
  });
});

describe("numeroParaWhatsapp / enlaceDeWhatsapp", () => {
  it("a un número de Costa Rica le antepone 506", () => {
    expect(numeroParaWhatsapp("8888-7777")).toBe("50688887777");
  });
  it("uno que ya trae país queda igual", () => {
    expect(numeroParaWhatsapp("+506 8888 7777")).toBe("50688887777");
    expect(numeroParaWhatsapp("5215512345678")).toBe("5215512345678");
  });
  it("arma el wa.me con el texto codificado, saltos de línea incluidos", () => {
    const u = enlaceDeWhatsapp("88887777", "hola\nmundo ₡");
    expect(u.startsWith("https://wa.me/50688887777?text=")).toBe(true);
    expect(u).toContain("%0A");
    expect(decodeURIComponent(u.split("text=")[1])).toBe("hola\nmundo ₡");
  });
});

describe("codigoDePedido", () => {
  it("son los primeros cuatro del uuid, en mayúsculas", () => {
    expect(codigoDePedido("a1b2c3d4-0000-0000-0000-000000000000")).toBe("A1B2");
  });
});
