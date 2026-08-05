import { describe, expect, it } from "vitest";
import { categorizarConversacion } from "./chat-categorias";
import { SLUG_NEGOCIO_INVITACIONES } from "./paquetes-invitaciones";

const MI_ID = "yo-123";

function fila(overrides: Partial<Parameters<typeof categorizarConversacion>[0]>) {
  return {
    proveedorId: "otro-456",
    miId: MI_ID,
    ranchoSlug: "un-rancho-cualquiera",
    vertical: "eventos",
    categoria: "alimentacion",
    ...overrides,
  };
}

describe("categorizarConversacion", () => {
  it("soy el proveedor -> negocio, sin importar la vertical", () => {
    expect(categorizarConversacion(fila({ proveedorId: MI_ID, vertical: "citas" }))).toBe(
      "negocio",
    );
  });

  it("rancho de invitaciones -> invitaciones", () => {
    expect(
      categorizarConversacion(fila({ ranchoSlug: SLUG_NEGOCIO_INVITACIONES })),
    ).toBe("invitaciones");
  });

  it("caso real del seed: invitaciones tiene categoria 'otros', igual cae en invitaciones por el slug", () => {
    expect(
      categorizarConversacion(
        fila({ ranchoSlug: SLUG_NEGOCIO_INVITACIONES, vertical: "eventos", categoria: "otros" }),
      ),
    ).toBe("invitaciones");
  });

  it("ser proveedor le gana a ser el rancho de invitaciones", () => {
    expect(
      categorizarConversacion(
        fila({ proveedorId: MI_ID, ranchoSlug: SLUG_NEGOCIO_INVITACIONES }),
      ),
    ).toBe("negocio");
  });

  it("vertical eventos + categoria lugares -> salones", () => {
    expect(categorizarConversacion(fila({ vertical: "eventos", categoria: "lugares" }))).toBe(
      "salones",
    );
  });

  it("vertical eventos SIN categoria lugares -> no es salones", () => {
    expect(
      categorizarConversacion(fila({ vertical: "eventos", categoria: "decoracion" })),
    ).not.toBe("salones");
  });

  it("vertical citas -> citas", () => {
    expect(categorizarConversacion(fila({ vertical: "citas", categoria: "otros" }))).toBe(
      "citas",
    );
  });

  it("hospedajes -> otros", () => {
    expect(categorizarConversacion(fila({ vertical: "hospedajes" }))).toBe("otros");
  });

  it("restaurantes -> otros", () => {
    expect(categorizarConversacion(fila({ vertical: "restaurantes" }))).toBe("otros");
  });

  it("servicio de eventos que no es lugar (catering, decoración, etc.) -> otros", () => {
    expect(
      categorizarConversacion(fila({ vertical: "eventos", categoria: "animacion" })),
    ).toBe("otros");
  });
});
