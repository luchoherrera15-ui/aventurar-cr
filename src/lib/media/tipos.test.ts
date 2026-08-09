import { describe, expect, it } from "vitest";
import {
  ENTIDADES,
  ENTREGA,
  VISIBILIDADES,
  VISIBILIDAD_POR_DEFECTO,
  esEntidad,
  esEstado,
  esProvider,
  esVariante,
  esVisibilidad,
  estaListo,
  estaVivo,
  estadoSegunDestinos,
  faltantes,
  ordenarAssets,
  sePuedeReintentar,
  visibilidadDeEntidad,
  type EntidadMedia,
} from "./tipos";

describe("visibilidad", () => {
  it("tiene los tres niveles y no dos", () => {
    expect(VISIBILIDADES).toEqual(["publica", "compartida", "privada"]);
  });

  it("el default es el más restrictivo", () => {
    // Si esto alguna vez pasa a 'publica', cualquier fila insertada por
    // un camino nuevo se publica sola. Que el test lo grite.
    expect(VISIBILIDAD_POR_DEFECTO).toBe("privada");
  });

  it("solo lo público se entrega directo", () => {
    expect(ENTREGA.publica).toBe("directa");
    expect(ENTREGA.compartida).toBe("firmada");
    expect(ENTREGA.privada).toBe("firmada");
  });

  it("le asigna a cada producto la visibilidad que le toca", () => {
    expect(visibilidadDeEntidad("rancho")).toBe("publica");
    expect(visibilidadDeEntidad("rancho_item")).toBe("publica");
    expect(visibilidadDeEntidad("equipo")).toBe("publica");
    expect(visibilidadDeEntidad("invitacion")).toBe("publica");
    // El QR de la mesa, no una cuenta.
    expect(visibilidadDeEntidad("album")).toBe("compartida");
    expect(visibilidadDeEntidad("comprobante")).toBe("privada");
    expect(visibilidadDeEntidad("verificacion")).toBe("privada");
  });

  it("ninguna entidad se queda sin visibilidad declarada", () => {
    for (const e of ENTIDADES) {
      expect(esVisibilidad(visibilidadDeEntidad(e as EntidadMedia))).toBe(true);
    }
  });
});

describe("guardas de tipo", () => {
  it("acepta lo conocido y rechaza lo inventado", () => {
    expect(esVisibilidad("compartida")).toBe(true);
    expect(esVisibilidad("publico")).toBe(false);
    expect(esProvider("supabase_legacy")).toBe(true);
    expect(esProvider("s3")).toBe(false);
    expect(esEstado("parcial_r2")).toBe(true);
    expect(esEstado("casi")).toBe(false);
    expect(esEntidad("album")).toBe(true);
    expect(esEntidad("albumes")).toBe(false);
    expect(esVariante("gallery")).toBe(true);
    expect(esVariante("grande")).toBe(false);
  });

  it("no se cae con null, undefined ni objetos", () => {
    for (const v of [null, undefined, 0, {}, [], true]) {
      expect(esVisibilidad(v)).toBe(false);
      expect(esEstado(v)).toBe(false);
      expect(esVariante(v)).toBe(false);
    }
  });
});

describe("estado del asset", () => {
  it("borrado lógico deja de estar vivo", () => {
    expect(estaVivo({ deleted_at: null })).toBe(true);
    expect(estaVivo({ deleted_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });

  it("un parcial NO es listo, aunque una copia sirva", () => {
    expect(estaListo({ estado: "listo", deleted_at: null })).toBe(true);
    expect(estaListo({ estado: "parcial_cf", deleted_at: null })).toBe(false);
    expect(estaListo({ estado: "parcial_r2", deleted_at: null })).toBe(false);
    // Listo pero borrado sigue sin mostrarse.
    expect(estaListo({ estado: "listo", deleted_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });

  it("solo se reintenta lo que puede avanzar", () => {
    expect(sePuedeReintentar({ estado: "parcial_r2", deleted_at: null })).toBe(true);
    expect(sePuedeReintentar({ estado: "error", deleted_at: null })).toBe(true);
    expect(sePuedeReintentar({ estado: "listo", deleted_at: null })).toBe(false);
    expect(sePuedeReintentar({ estado: "error", deleted_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });
});

describe("estadoSegunDestinos — la subida doble", () => {
  it("solo con los DOS destinos confirmados llega a listo", () => {
    expect(estadoSegunDestinos({ r2: true, cloudflare: true })).toBe("listo");
    expect(estadoSegunDestinos({ r2: true, cloudflare: false })).toBe("parcial_r2");
    expect(estadoSegunDestinos({ r2: false, cloudflare: true })).toBe("parcial_cf");
    expect(estadoSegunDestinos({ r2: false, cloudflare: false })).toBe("subiendo");
  });

  it("dice qué falta para poder cerrar", () => {
    expect(faltantes({ cf_image_id: null, r2_key: null })).toEqual(["cloudflare", "r2"]);
    expect(faltantes({ cf_image_id: "abc", r2_key: null })).toEqual(["r2"]);
    expect(faltantes({ cf_image_id: "abc", r2_key: "originals/x" })).toEqual([]);
  });
});

describe("ordenarAssets", () => {
  it("ordena por posición y desempata por antigüedad", () => {
    const orden = ordenarAssets([
      { posicion: 1, created_at: "2026-01-02T00:00:00Z" },
      { posicion: 0, created_at: "2026-01-03T00:00:00Z" },
      { posicion: 1, created_at: "2026-01-01T00:00:00Z" },
    ]).map((a) => `${a.posicion}@${a.created_at.slice(8, 10)}`);
    expect(orden).toEqual(["0@03", "1@01", "1@02"]);
  });

  it("no muta el arreglo que recibe", () => {
    const original = [
      { posicion: 2, created_at: "2026-01-01T00:00:00Z" },
      { posicion: 1, created_at: "2026-01-01T00:00:00Z" },
    ];
    ordenarAssets(original);
    expect(original[0].posicion).toBe(2);
  });
});
