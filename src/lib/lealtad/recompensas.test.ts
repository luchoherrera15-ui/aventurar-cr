import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  borrarRecompensaDe,
  escribirRecompensa,
  filaDeRecompensa,
  validarRecompensa,
  type RecompensaInput,
} from "./recompensas";

/**
 * El núcleo que comparten el panel de Bookea (`guardarRecompensa`,
 * `eliminarRecompensa`) y la API de Foorkie. Lo que se fija acá es que
 * moverlo no cambió nada: las mismas reglas, la misma fila, el mismo
 * reintento sin las columnas de la 0125 — y solo cuando falta una
 * columna, nunca cuando la base rechaza un valor.
 */

const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const RECOMPENSA = "55555555-5555-4555-8555-555555555555";

const base: RecompensaInput = {
  nombre: "  Café gratis ",
  descripcion: "",
  costoPuntos: 10,
  activo: true,
  tipo: "producto",
  valor: 99,
  stockTotal: null,
  limitePorCliente: null,
  sku: " ",
  instrucciones: "",
};

describe("validarRecompensa", () => {
  it("las reglas de siempre", () => {
    expect(validarRecompensa(base)).toBeNull();
    expect(validarRecompensa({ ...base, nombre: "  " })).toBe("El nombre es obligatorio (máximo 120 caracteres).");
    expect(validarRecompensa({ ...base, nombre: "x".repeat(121) })).not.toBeNull();
    expect(validarRecompensa({ ...base, descripcion: "x".repeat(301) })).toBe("La descripción es muy larga.");
    expect(validarRecompensa({ ...base, costoPuntos: 0 })).toBe("La recompensa tiene que costar al menos 1.");
    expect(validarRecompensa({ ...base, costoPuntos: 2.5 })).toBe("La recompensa tiene que costar al menos 1.");
    expect(validarRecompensa({ ...base, tipo: "regalo" as "producto" })).toBe("Ese tipo de recompensa no existe.");
    expect(validarRecompensa({ ...base, tipo: "descuento_porcentaje", valor: 101 })).toBe("El descuento porcentual va de 1 a 100.");
    expect(validarRecompensa({ ...base, tipo: "descuento_fijo", valor: null })).toBe("El descuento fijo va de ₡1 a ₡10.000.000.");
    expect(validarRecompensa({ ...base, stockTotal: 0 })).not.toBeNull();
    expect(validarRecompensa({ ...base, limitePorCliente: 10001 })).not.toBeNull();
    expect(validarRecompensa({ ...base, sku: "x".repeat(61) })).toBe("El SKU es muy largo (máximo 60).");
    expect(validarRecompensa({ ...base, instrucciones: "x".repeat(501) })).toBe("Las instrucciones son muy largas (máximo 500).");
  });
});

describe("la fila que se escribe", () => {
  it("recorta, vacía lo vacío y guarda el valor solo en los descuentos", () => {
    expect(filaDeRecompensa(base)).toEqual({
      nombre: "Café gratis",
      descripcion: null,
      costo_puntos: 10,
      activo: true,
      tipo: "producto",
      valor: null,
      stock_total: null,
      limite_por_cliente: null,
      sku: null,
      instrucciones: null,
    });
    expect(filaDeRecompensa({ ...base, tipo: "descuento_porcentaje", valor: 15 }).valor).toBe(15);
  });
});

type Llamada = { op: string; valores: unknown; filtros: unknown[][] };

function baseFalsa(respuestas: { data?: unknown; error?: unknown }[]) {
  const llamadas: Llamada[] = [];
  const db = {
    from() {
      const l: Llamada = { op: "", valores: null, filtros: [] };
      llamadas.push(l);
      const b: Record<string, unknown> = {};
      for (const op of ["update", "insert", "delete"]) {
        b[op] = (valores?: unknown) => {
          l.op = op;
          l.valores = valores ?? null;
          return b;
        };
      }
      for (const m of ["eq", "select", "single"]) {
        b[m] = (...args: unknown[]) => {
          l.filtros.push([m, ...args]);
          return b;
        };
      }
      b.then = (ok: (r: unknown) => unknown) => {
        const r = respuestas[llamadas.length - 1] ?? {};
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(ok);
      };
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, llamadas };
}

describe("escribirRecompensa y borrarRecompensaDe", () => {
  it("crea en ESTE programa y edita filtrando por el programa", async () => {
    const nueva = baseFalsa([{ data: { id: "r-1" } }]);
    expect(await escribirRecompensa(nueva.db, PROGRAMA, base)).toEqual({ data: { id: "r-1" }, error: null });
    expect(nueva.llamadas[0]).toMatchObject({ op: "insert", valores: { programa_id: PROGRAMA, nombre: "Café gratis" } });

    const editar = baseFalsa([{ data: { id: RECOMPENSA } }]);
    await escribirRecompensa(editar.db, PROGRAMA, base, RECOMPENSA);
    expect(editar.llamadas[0].op).toBe("update");
    expect(editar.llamadas[0].filtros).toContainEqual(["eq", "id", RECOMPENSA]);
    expect(editar.llamadas[0].filtros).toContainEqual(["eq", "programa_id", PROGRAMA]);
  });

  it("sin la 0125 reintenta con lo básico; un valor rechazado NO se reintenta", async () => {
    const sinColumna = baseFalsa([
      { error: { code: "PGRST204", message: "Could not find the 'sku' column of 'recompensas' in the schema cache" } },
      { data: { id: "r-2" } },
    ]);
    expect(await escribirRecompensa(sinColumna.db, PROGRAMA, base)).toEqual({ data: { id: "r-2" }, error: null });
    expect(sinColumna.llamadas[1].valores).toEqual({
      programa_id: PROGRAMA,
      nombre: "Café gratis",
      descripcion: null,
      costo_puntos: 10,
      activo: true,
    });

    const rechazo = { code: "23514", message: 'new row violates check constraint "recompensas_detalle_check"' };
    const conCheck = baseFalsa([{ error: rechazo }]);
    expect(await escribirRecompensa(conCheck.db, PROGRAMA, base)).toEqual({ data: null, error: rechazo });
    expect(conCheck.llamadas).toHaveLength(1);
  });

  it("borrar filtra por el id y por el programa", async () => {
    const { db, llamadas } = baseFalsa([{}]);
    expect(await borrarRecompensaDe(db, PROGRAMA, RECOMPENSA)).toEqual({ error: null });
    expect(llamadas[0].op).toBe("delete");
    expect(llamadas[0].filtros).toEqual([
      ["eq", "id", RECOMPENSA],
      ["eq", "programa_id", PROGRAMA],
    ]);
  });
});
