import { describe, expect, it } from "vitest";
import { cupoLleno, lasQueOcupanCupo, ocupaCupo, tarjetaDelCupo } from "./cupo-tarjetas";
import type { FilaPrograma } from "@/lib/lealtad/programas";

/**
 * ARCHIVAR TIENE QUE LIBERAR EL CUPO.
 *
 * El bug que esto congela: el panel contaba TODAS las filas —archivadas
 * incluidas— y el servidor contaba con `.neq("estado", "archivado")`.
 * Dos criterios que se parecen no son el mismo criterio, y la diferencia
 * caía justo sobre la única salida que el aviso le ofrecía al dueño:
 * «archivá una o subí de paquete». Archivaba, y el panel seguía diciendo
 * «Llegaste al tope» con el botón de crear reemplazado por el aviso.
 *
 * Por eso lo que se prueba acá no es una función suelta: es que la
 * cuenta del PANEL y la del SERVIDOR den lo mismo sobre las mismas
 * filas, incluidas las dos que antes las separaban (la archivada y la
 * fila sin `estado` de una base anterior a la 0125).
 */

const AHORA = "2026-08-13T14:30";

/** Una fila cruda de `programa_lealtad`, como la entrega `select *`. */
function fila(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    rancho_id: "22222222-2222-2222-2222-222222222222",
    nombre: "Tarjeta de sellos",
    estado: "activo",
    activo: true,
    ...extra,
  };
}

/**
 * LO QUE HACE EL PANEL: cuenta las filas que ya trajo (page.tsx las
 * tiene mapeadas a `ProgramaEnLista`, que es esta forma más el nombre y
 * los colores) y decide si pinta «Crear una tarjeta» o «Llegaste al
 * tope».
 */
function panelDiceQueNoCaben(filas: readonly FilaPrograma[], tope: number | null): boolean {
  return cupoLleno({ ocupadas: lasQueOcupanCupo(filas, AHORA).length, tope });
}

/**
 * LO QUE HACE EL SERVIDOR: lee las filas crudas de la base y decide si
 * deja crear (crear-actions.ts).
 */
function servidorRechaza(filas: readonly Record<string, unknown>[], tope: number | null): boolean {
  const existentes = lasQueOcupanCupo(filas.map(tarjetaDelCupo), AHORA);
  return cupoLleno({ ocupadas: existentes.length, tope });
}

describe("qué ocupa cupo", () => {
  it("una tarjeta activa ocupa", () => {
    expect(ocupaCupo(tarjetaDelCupo(fila()), AHORA)).toBe(true);
  });

  it("una archivada NO ocupa: para volver a emitir se crea otra", () => {
    const archivada = tarjetaDelCupo(fila({ estado: "archivado", activo: false }));
    expect(ocupaCupo(archivada, AHORA)).toBe(false);
  });

  it("borrador, pausada, programada y vencida SÍ ocupan", () => {
    // Todas existen, se editan y se pueden reactivar: el lugar está
    // tomado aunque no estén emitiendo.
    const casos = [
      fila({ estado: "borrador", activo: false }),
      fila({ estado: "pausado", activo: false }),
      fila({ vigente_desde: "2026-12-01" }),
      fila({ vigente_hasta: "2026-01-01" }),
    ];
    for (const c of casos) expect(ocupaCupo(tarjetaDelCupo(c), AHORA)).toBe(true);
  });

  it("una fila sin `estado` (base anterior a la 0125) ocupa si está activa", () => {
    // Este es el caso que el `.neq('estado', 'archivado')` del servidor
    // descartaba en silencio: en SQL, NULL <> 'archivado' no es
    // verdadero, así que esas filas no se contaban y el tope se saltaba.
    const vieja = fila({ estado: null, activo: true });
    expect(ocupaCupo(tarjetaDelCupo(vieja), AHORA)).toBe(true);
    expect(servidorRechaza([vieja], 1)).toBe(true);
  });
});

describe("el tope", () => {
  it("sin tope, nunca se llena", () => {
    expect(cupoLleno({ ocupadas: 99, tope: null })).toBe(false);
  });

  it("se llena al llegar, no al pasarse", () => {
    expect(cupoLleno({ ocupadas: 1, tope: 2 })).toBe(false);
    expect(cupoLleno({ ocupadas: 2, tope: 2 })).toBe(true);
  });

  it("por encima del tope tampoco caben (bajar de paquete)", () => {
    expect(cupoLleno({ ocupadas: 5, tope: 2 })).toBe(true);
  });
});

describe("el panel y el servidor cuentan lo mismo", () => {
  it("archivar libera el cupo EN LAS DOS pantallas", () => {
    const tope = 2;
    const dosVivas = [fila({ id: "a" }), fila({ id: "b" })];

    expect(panelDiceQueNoCaben(dosVivas.map(tarjetaDelCupo), tope)).toBe(true);
    expect(servidorRechaza(dosVivas, tope)).toBe(true);

    // El dueño hace lo que el aviso le pide: archiva una.
    const despues = [fila({ id: "a" }), fila({ id: "b", estado: "archivado", activo: false })];

    expect(panelDiceQueNoCaben(despues.map(tarjetaDelCupo), tope)).toBe(false);
    expect(servidorRechaza(despues, tope)).toBe(false);
  });

  it("coinciden sobre toda la mezcla de estados, tope por tope", () => {
    const escena = [
      fila({ id: "a" }),
      fila({ id: "b", estado: "borrador", activo: false }),
      fila({ id: "c", estado: "archivado", activo: false }),
      fila({ id: "d", estado: null, activo: true }),
      fila({ id: "e", estado: "pausado", activo: false }),
      fila({ id: "f", estado: "archivado", activo: false }),
    ];
    // Cuatro vivas y dos archivadas.
    expect(lasQueOcupanCupo(escena.map(tarjetaDelCupo), AHORA)).toHaveLength(4);

    for (const tope of [null, 1, 2, 3, 4, 5, 6]) {
      expect(servidorRechaza(escena, tope)).toBe(panelDiceQueNoCaben(escena.map(tarjetaDelCupo), tope));
    }
    // Y el número es el de las vivas, no el de todas: con tope 5 hay
    // lugar aunque el negocio tenga seis filas.
    expect(servidorRechaza(escena, 5)).toBe(false);
    expect(servidorRechaza(escena, 4)).toBe(true);
  });
});

describe("tarjetaDelCupo lee filas de cualquier base", () => {
  it("una fila sin las columnas de la 0136 no rompe nada", () => {
    const sinVigencias = tarjetaDelCupo({ id: "x", nombre: "Sellos", estado: "activo", activo: true });
    expect(sinVigencias.vigente_desde).toBeNull();
    expect(ocupaCupo(sinVigencias, AHORA)).toBe(true);
  });

  it("una tarjeta sin nombre se llama «Tarjeta» y no «undefined»", () => {
    // El aviso del tope las lista por nombre: «ya tenés «undefined»» es
    // peor que no decir nada.
    expect(tarjetaDelCupo({ id: "x", activo: true }).nombre).toBe("Tarjeta");
    expect(tarjetaDelCupo({ id: "x", nombre: "   ", activo: true }).nombre).toBe("Tarjeta");
  });
});
