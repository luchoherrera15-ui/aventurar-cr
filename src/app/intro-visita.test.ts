import { describe, expect, it } from "vitest";
import { ATRIBUTO_INTRO, GUION_INTRO, LLAVE_INTRO } from "./intro-visita";

/**
 * Estas pruebas corren EL MISMO TEXTO que va inline en el HTML de `/`
 * —no una reimplementación en TypeScript de lo que hace—, contra un
 * navegador de mentira. Si alguien cambia el guion, cambia lo que se
 * prueba acá; no hay forma de que las dos versiones se desfasen.
 *
 * Se ejecuta con `new Function` pasándole `window`, `document` y
 * `localStorage` como PARÁMETROS: adentro del guion esos nombres son
 * variables libres, así que los parámetros los tapan y el guion no
 * toca nada real (vitest corre en Node, donde ni siquiera existen).
 */

type AlmacenFalso = {
  getItem(llave: string): string | null;
  setItem(llave: string, valor: string): void;
};

type DocumentoFalso = {
  documentElement: { setAttribute(nombre: string, valor: string): void };
};

type VentanaFalsa = { matchMedia(consulta: string): { matches: boolean } };

const ejecutarGuion = new Function(
  "window",
  "document",
  "localStorage",
  GUION_INTRO,
) as (
  ventana: VentanaFalsa,
  documento: DocumentoFalso,
  almacen: AlmacenFalso,
) => void;

/**
 * Un dispositivo: conserva su `localStorage` entre visitas, que es
 * justamente lo que hace distinta a la segunda.
 */
function crearDispositivo(
  opciones: {
    movimientoReducido?: boolean;
    almacenamientoBloqueado?: boolean;
  } = {},
) {
  const guardado = new Map<string, string>();
  const atributos = new Map<string, string>();

  const almacen: AlmacenFalso = {
    getItem(llave) {
      if (opciones.almacenamientoBloqueado) throw new Error("bloqueado");
      return guardado.get(llave) ?? null;
    },
    setItem(llave, valor) {
      if (opciones.almacenamientoBloqueado) throw new Error("bloqueado");
      guardado.set(llave, valor);
    },
  };

  const documento: DocumentoFalso = {
    documentElement: {
      setAttribute(nombre, valor) {
        atributos.set(nombre, valor);
      },
    },
  };

  const ventana: VentanaFalsa = {
    matchMedia: (consulta) => ({
      matches:
        consulta.includes("prefers-reduced-motion: reduce") &&
        opciones.movimientoReducido === true,
    }),
  };

  return {
    /** Una carga de `/`. Devuelve si le tocó ver la bienvenida. */
    visitar() {
      atributos.clear();
      ejecutarGuion(ventana, documento, almacen);
      return atributos.get(ATRIBUTO_INTRO) === "1";
    },
    quedoAnotada: () => guardado.get(LLAVE_INTRO) === "1",
  };
}

describe("¿le toca ver la bienvenida?", () => {
  it("la primera visita del dispositivo la ve", () => {
    const telefono = crearDispositivo();
    expect(telefono.visitar()).toBe(true);
  });

  it("la segunda visita ya no la ve", () => {
    const telefono = crearDispositivo();
    telefono.visitar();
    expect(telefono.visitar()).toBe(false);
    // Y la tercera, y la de la semana que viene.
    expect(telefono.visitar()).toBe(false);
  });

  it("se anota al EMPEZAR, así que cerrar a la mitad no la devuelve", () => {
    const telefono = crearDispositivo();
    telefono.visitar();
    expect(telefono.quedoAnotada()).toBe(true);
  });

  it("con movimiento reducido no se muestra ninguna animación", () => {
    const telefono = crearDispositivo({ movimientoReducido: true });
    expect(telefono.visitar()).toBe(false);
  });

  it("con movimiento reducido tampoco gasta la anotación", () => {
    // Si un día apaga esa preferencia, la bienvenida le sigue debiendo
    // su primera vez — no se la comió una visita que nunca la vio.
    const telefono = crearDispositivo({ movimientoReducido: true });
    telefono.visitar();
    expect(telefono.quedoAnotada()).toBe(false);
  });

  it("con el almacenamiento bloqueado no se muestra, y no revienta", () => {
    // Sin dónde anotar, mostrarla sería mostrarla en CADA visita. Ante
    // la duda gana el contenido.
    const telefono = crearDispositivo({ almacenamientoBloqueado: true });
    expect(() => telefono.visitar()).not.toThrow();
    expect(telefono.visitar()).toBe(false);
  });
});
