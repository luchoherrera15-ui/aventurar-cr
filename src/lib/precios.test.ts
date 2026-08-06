import { describe, expect, it, vi } from "vitest";
import type { GuardarPreciosInput } from "@/app/mi-negocio/types";

/**
 * Guardar precios es BORRAR todo y volver a insertar, sin transacción:
 * si el insert falla después del delete, el lugar queda publicado sin
 * un solo precio. Por eso lo que más se prueba acá no es que guarde
 * bien, sino que ante un dato inválido no llegue nunca a borrar — y que
 * en una base sin la migración 0099 los precios de siempre se salven
 * igual.
 */

type Operacion = {
  tabla: string;
  tipo: "delete" | "insert" | "update";
  payload?: unknown;
};

type ErrorFalso = { code?: string; message: string } | null;

const mocks = vi.hoisted(() => ({
  cliente: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mocks.cliente,
}));

const { guardarPreciosRancho } = await import("@/lib/precios");

/** Un Supabase de mentira que anota todo lo que se le pidió hacer. */
function supabaseFalso(errorPara: (op: Operacion) => ErrorFalso = () => null) {
  const ops: Operacion[] = [];
  const responder = (op: Operacion) => Promise.resolve({ error: errorPara(op) });

  const cliente = {
    from(tabla: string) {
      return {
        delete() {
          const op: Operacion = { tabla, tipo: "delete" };
          ops.push(op);
          return { eq: () => responder(op) };
        },
        insert(payload: unknown) {
          const op: Operacion = { tabla, tipo: "insert", payload };
          ops.push(op);
          return responder(op);
        },
        update(payload: unknown) {
          const op: Operacion = { tabla, tipo: "update", payload };
          ops.push(op);
          return { eq: () => responder(op) };
        },
      };
    },
  };

  mocks.cliente = cliente;
  return ops;
}

function entrada(cambios: Partial<GuardarPreciosInput> = {}): GuardarPreciosInput {
  return {
    tiers: [{ min_invitados: 1, max_invitados: 20, precio: 90000 }],
    tiersDiciembre: [],
    servicios: [],
    tarifaDiciembre: 0,
    depositoReserva: 25000,
    modalidadPrecio: "rango_personas",
    precioHora: null,
    precioFijo: null,
    precioHoraDiciembre: null,
    precioFijoDiciembre: null,
    ...cambios,
  };
}

/** Las filas de precio_tiers que se mandaron a insertar. */
function filasInsertadas(ops: Operacion[]): Record<string, unknown>[] {
  return ops
    .filter((o) => o.tabla === "precio_tiers" && o.tipo === "insert")
    .flatMap((o) => o.payload as Record<string, unknown>[]);
}

describe("guardarPreciosRancho", () => {
  it("no borra nada si un rango viene al revés", async () => {
    const ops = supabaseFalso();
    const res = await guardarPreciosRancho(
      "r1",
      entrada({ tiers: [{ min_invitados: 50, max_invitados: 20, precio: 90000 }] }),
    );

    expect(res.error).toMatch(/Revisá/);
    expect(ops).toHaveLength(0);
  });

  it("no borra nada si un rango de diciembre tiene precio negativo", async () => {
    const ops = supabaseFalso();
    const res = await guardarPreciosRancho(
      "r1",
      entrada({
        tiersDiciembre: [{ min_invitados: 1, max_invitados: 20, precio: -1 }],
      }),
    );

    expect(res.error).toMatch(/diciembre/);
    expect(ops).toHaveLength(0);
  });

  it("no borra nada si un precio quedó vacío (NaN)", async () => {
    const ops = supabaseFalso();
    const res = await guardarPreciosRancho(
      "r1",
      entrada({ tiers: [{ min_invitados: 1, max_invitados: 20, precio: NaN }] }),
    );

    expect(res.error).toMatch(/Revisá/);
    expect(ops).toHaveLength(0);
  });

  it("guarda las dos temporadas en una sola pasada, cada fila marcada", async () => {
    const ops = supabaseFalso();
    const res = await guardarPreciosRancho(
      "r1",
      entrada({
        tiersDiciembre: [{ min_invitados: 1, max_invitados: 20, precio: 150000 }],
      }),
    );

    expect(res.error).toBeNull();
    // Un solo borrado: los rangos de diciembre viven en la misma tabla.
    expect(ops.filter((o) => o.tabla === "precio_tiers" && o.tipo === "delete")).toHaveLength(1);
    expect(filasInsertadas(ops)).toEqual([
      { min_invitados: 1, max_invitados: 20, precio: 90000, rancho_id: "r1", temporada: "normal" },
      { min_invitados: 1, max_invitados: 20, precio: 150000, rancho_id: "r1", temporada: "diciembre" },
    ]);
  });

  it("manda los precios de diciembre de las otras modalidades al rancho", async () => {
    const ops = supabaseFalso();
    await guardarPreciosRancho(
      "r1",
      entrada({
        tiers: [],
        modalidadPrecio: "fijo",
        precioFijo: 300000,
        precioFijoDiciembre: 450000,
      }),
    );

    const update = ops.find((o) => o.tabla === "ranchos" && o.tipo === "update");
    expect(update?.payload).toMatchObject({
      precio_fijo_lugar: 300000,
      precio_fijo_diciembre: 450000,
      precio_hora_diciembre: null,
    });
  });

  it("sin la migración 0099 salva los precios de siempre y avisa", async () => {
    let intentosTiers = 0;
    const ops = supabaseFalso((op) => {
      if (op.tabla === "precio_tiers" && op.tipo === "insert") {
        intentosTiers += 1;
        if (intentosTiers === 1) {
          return {
            code: "PGRST204",
            message:
              "Could not find the 'temporada' column of 'precio_tiers' in the schema cache",
          };
        }
      }
      return null;
    });

    const res = await guardarPreciosRancho(
      "r1",
      entrada({
        tiersDiciembre: [{ min_invitados: 1, max_invitados: 20, precio: 150000 }],
      }),
    );

    // El reintento guarda los rangos de todo el año sin la columna nueva.
    const inserts = ops.filter((o) => o.tabla === "precio_tiers" && o.tipo === "insert");
    expect(inserts).toHaveLength(2);
    expect(inserts[1]?.payload).toEqual([
      { min_invitados: 1, max_invitados: 20, precio: 90000, rancho_id: "r1" },
    ]);

    // Y el rancho se actualiza sin las columnas que todavía no existen.
    const update = ops.find((o) => o.tabla === "ranchos" && o.tipo === "update");
    expect(update?.payload).not.toHaveProperty("precio_fijo_diciembre");
    expect(update?.payload).toMatchObject({ deposito_reserva: 25000 });

    expect(res.error).toMatch(/0099/);
  });

  it("sin las columnas de diciembre en ranchos, reintenta el update sin ellas", async () => {
    let intentosRancho = 0;
    const ops = supabaseFalso((op) => {
      if (op.tabla === "ranchos" && op.tipo === "update") {
        intentosRancho += 1;
        if (intentosRancho === 1) {
          return {
            code: "42703",
            message: 'column "precio_fijo_diciembre" of relation "ranchos" does not exist',
          };
        }
      }
      return null;
    });

    const res = await guardarPreciosRancho("r1", entrada());

    const updates = ops.filter((o) => o.tabla === "ranchos" && o.tipo === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1]?.payload).not.toHaveProperty("precio_hora_diciembre");
    expect(res.error).toMatch(/0099/);
  });

  it("un error real de la base se devuelve tal cual, sin culpar a la migración", async () => {
    supabaseFalso((op) =>
      op.tabla === "precio_tiers" && op.tipo === "insert"
        ? { code: "23505", message: "duplicate key value" }
        : null,
    );

    const res = await guardarPreciosRancho("r1", entrada());
    expect(res.error).toBe("duplicate key value");
  });
});
