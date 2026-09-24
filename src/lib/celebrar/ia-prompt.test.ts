import { describe, expect, it } from "vitest";
import { DATOS_IA_VACIOS, armarPedidoIA, normalizarDatosIA } from "./ia-prompt";

describe("armarPedidoIA", () => {
  it("arma el pedido en prosa con todo lo que la persona llenó", () => {
    const p = armarPedidoIA({
      ...DATOS_IA_VACIOS,
      quien: "Mateo",
      edad: "7",
      tipo: "Cumpleaños",
      fecha: "sábado 7 de marzo de 2027",
      hora: "3:00 p. m.",
      lugar: "Rancho Los Pinos, Heredia",
      estilos: ["infantil", "divertido"],
      colores: "verde selva y naranja",
      tono: "divertido",
      secciones: ["countdown", "itinerario", "faq"],
      extra: "Le encantan los dinosaurios.",
    });
    expect(p).toBe(
      "Una invitación de cumpleaños para Mateo (cumple 7 años). Es el sábado 7 de marzo de 2027 a las 3:00 p. m. en Rancho Los Pinos, Heredia. Estilo infantil y divertido. Colores: verde selva y naranja. Textos con tono divertido. Secciones: portada, fecha y lugar, cuenta regresiva, programa del día, preguntas frecuentes, confirmación y mensaje final. Le encantan los dinosaurios.",
    );
  });

  it("con lo mínimo igual sale algo pedible", () => {
    expect(armarPedidoIA({ ...DATOS_IA_VACIOS, tipo: "Boda", quien: "Sofía & Andrés", secciones: [] })).toBe(
      "Una invitación de boda para Sofía & Andrés. Textos con tono cálido y cercano.",
    );
  });

  it("una edad escrita como aniversario no se convierte en «cumple»", () => {
    expect(armarPedidoIA({ ...DATOS_IA_VACIOS, quien: "Ana & Luis", edad: "25 años de casados", secciones: [] })).toContain("(25 años de casados)");
  });
});

describe("normalizarDatosIA", () => {
  it("descarta estilos y secciones desconocidos y recorta los textos", () => {
    const d = normalizarDatosIA({ quien: "  Mateo ", estilos: ["infantil", "hackeo"], secciones: ["faq", "x"], tono: "raro", extra: "a".repeat(1000) });
    expect(d.quien).toBe("Mateo");
    expect(d.estilos).toEqual(["infantil"]);
    expect(d.secciones).toEqual(["faq"]);
    expect(d.tono).toBe("calido");
    expect(d.extra).toHaveLength(800);
  });
  it("con basura devuelve el vacío", () => {
    expect(normalizarDatosIA(null)).toEqual({ ...DATOS_IA_VACIOS, secciones: [] });
  });
});
