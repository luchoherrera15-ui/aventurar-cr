import { describe, expect, it } from "vitest";
import { validarBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import { estadoInicial, sanearGuardado } from "./respaldo-wizard";

/**
 * Lo que `irAlPlanPago()` (tarjeta-formulario.tsx) deja en sessionStorage
 * antes de mandar a /lealtad/nuevo: la forma de `ValorFormulario` —el
 * tipo se llama `tipo` y el nombre `nombre`— más las tres marcas que
 * agrega. Esta fixture ES el contrato entre las dos pantallas.
 */
const BORRADOR_DEL_CONFIGURADOR = {
  nombre: "Pastelería Toledo",
  tipo: "sellos",
  beneficio: {
    tipo: "sellos",
    requeridos: 8,
    recompensa: "Un queque gratis",
    inicial: 1,
    repetible: true,
    sellosPor: "compra",
    montoPorSello: null,
  },
  colorFondo: "#4a2f1d",
  colorSello: "#ebebeb",
  iconoSello: "cafe",
  logoUrl: "https://x.supabase.co/storage/v1/object/public/comprobantes/logos-negocio/logo-1.jpg",
  bannerUrl: "https://x.supabase.co/storage/v1/object/public/comprobantes/logos-negocio/banda-1.jpg",
  telefono: "8888 8888",
  codigoReferido: "",
  vista: "editor",
  camino: "prellenado",
  tipoNegocio: "citas",
};

describe("sanearGuardado — el borrador del configurador (camino prellenado)", () => {
  /**
   * LA REGRESIÓN DEL 6 SEP 2026. El configurador guarda el tipo como
   * `tipo`; el asistente leía solo `modo`. El beneficio caía al default
   * con regalía vacía, `validarBeneficio` lo rechazaba y el botón
   * «Enviar la solicitud» quedaba apagado sin explicación en la única
   * pantalla del camino. Se perdió un alta con SINPE así.
   */
  it("restaura el tipo aunque venga como `tipo`, y con él el beneficio real", () => {
    const e = sanearGuardado(BORRADOR_DEL_CONFIGURADOR, "arranque", 5);
    expect(e.camino).toBe("prellenado");
    expect(e.modo).toBe("sellos");
    expect(e.beneficio).toMatchObject({ tipo: "sellos", requeridos: 8, recompensa: "Un queque gratis" });
    // Lo que de verdad importa: con esto la pantalla puede publicar.
    expect(e.beneficio && validarBeneficio(e.beneficio)).toBeNull();
  });

  it("conserva nombre, teléfono, colores, ícono e imágenes, y fuerza citas/paso 0", () => {
    const e = sanearGuardado(BORRADOR_DEL_CONFIGURADOR, "arranque", 5);
    expect(e.nombreNegocio).toBe("Pastelería Toledo");
    expect(e.telefono).toBe("8888 8888");
    expect(e.colorFondo).toBe("#4a2f1d");
    expect(e.colorSello).toBe("#ebebeb");
    expect(e.iconoSello).toBe("cafe");
    expect(e.logoUrl).toContain("logo-1.jpg");
    expect(e.bannerUrl).toContain("banda-1.jpg");
    expect(e.tipoNegocio).toBe("citas");
    expect(e.paso).toBe(0);
  });

  it("el respaldo del propio asistente (con `modo`) sigue funcionando igual", () => {
    const propio = { ...estadoInicial(), modo: "sellos", beneficio: { ...BORRADOR_DEL_CONFIGURADOR.beneficio }, nombreNegocio: "Mío", paso: 3 };
    const e = sanearGuardado(propio, "prueba", 5);
    expect(e.modo).toBe("sellos");
    expect(e.beneficio).toMatchObject({ recompensa: "Un queque gratis" });
    expect(e.nombreNegocio).toBe("Mío");
    expect(e.paso).toBe(3);
  });

  it("si vienen los dos nombres, manda `modo` (el del asistente es el más reciente)", () => {
    const e = sanearGuardado({ ...BORRADOR_DEL_CONFIGURADOR, modo: "puntos", beneficio: { tipo: "puntos", nombre: "puntos", porMoneda: 0, porVisita: 1, inicial: 0, minimoCanje: 1, maximo: null } }, "arranque", 5);
    expect(e.modo).toBe("puntos");
  });

  it("un tipo que el paquete NO incluye no se restaura: el candado no salta", () => {
    // `prueba` no trae cupones. Cae al default (sellos), y el beneficio
    // del cupón se descarta con él.
    const e = sanearGuardado({ ...BORRADOR_DEL_CONFIGURADOR, tipo: "cupon" }, "prueba", 5);
    expect(e.modo).toBe("sellos");
    expect(e.beneficio?.tipo).toBe("sellos");
  });

  it("basura o nada: el estado inicial, sin romper", () => {
    expect(sanearGuardado(null, "prueba", 5)).toEqual(estadoInicial());
    expect(sanearGuardado("texto", "prueba", 5)).toEqual(estadoInicial());
    expect(sanearGuardado({ tipo: 42, modo: {} }, "prueba", 5).modo).toBe("sellos");
  });
});
