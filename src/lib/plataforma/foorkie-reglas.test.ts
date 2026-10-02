import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  guardarReglasDeLaTarjeta,
  leerCambiosDeReglas,
  leerPedidoGuardarReglas,
  planDeReglas,
  reglasDeFila,
  reglasDeLaTarjeta,
  type PremioDeLaMeta,
} from "./foorkie-reglas";

/**
 * Las reglas de una tarjeta de Foorkie (`programa/reglas` y
 * `programa/reglas/guardar`). Lo que se fija: que se valida con las
 * mismas reglas que el panel de Bookea, que se escribe SOLO lo que
 * cambia, que lo que se muestra es lo que el motor aplica (las columnas),
 * y que Pura Matcha —sin la marca— no se lee ni se toca.
 */

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const AHORA = new Date("2026-10-02T15:00:00.000Z");

const filaCashback = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: PROGRAMA,
  rancho_id: RANCHO,
  modo: "cashback",
  estado: "activo",
  activo: true,
  puntos_por_colon: 0.05,
  compra_minima: null,
  max_por_transaccion: null,
  sellos_vencen_meses: null,
  sellos_vencen_desde: null,
  beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true },
  ...extra,
});

const filaSellos = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: PROGRAMA,
  rancho_id: RANCHO,
  modo: "sellos",
  estado: "activo",
  activo: true,
  sellos_vencen_meses: null,
  sellos_vencen_desde: null,
  beneficio: { tipo: "sellos", requeridos: 10, recompensa: "Un matcha", inicial: 0, repetible: true, sellosPor: "compra", montoPorSello: null },
  ...extra,
});

const META: PremioDeLaMeta = { id: "r-meta", nombre: "Un matcha", costo: 10, limitePorCliente: null };

describe("leerCambiosDeReglas — la forma de lo que manda Foorkie", () => {
  it("cashback: montos enteros, null = sin mínimo/sin tope; 0 y 1 = sin mínimo", () => {
    expect(leerCambiosDeReglas({ cashback: { compraMinima: 2000, topePorCompra: 500, minimoCanje: 1000 } })).toEqual({
      ok: true,
      valor: { cashback: { compraMinima: 2000, topePorCompra: 500, minimoCanje: 1000 } },
    });
    expect(leerCambiosDeReglas({ cashback: { compraMinima: 0, minimoCanje: 1, topePorCompra: null } })).toEqual({
      ok: true,
      valor: { cashback: { compraMinima: null, minimoCanje: null, topePorCompra: null } },
    });
  });

  it("el tope por compra respeta el CHECK de la base (₡1 a ₡100.000)", () => {
    expect(leerCambiosDeReglas({ cashback: { topePorCompra: 100_001 } })).toMatchObject({ ok: false, motivo: expect.stringMatching(/100\.000/) });
    expect(leerCambiosDeReglas({ cashback: { topePorCompra: 0 } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ cashback: { compraMinima: 12.5 } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ cashback: { compraMinima: "2000" } })).toMatchObject({ ok: false });
  });

  it("sellos: regalo 0..14, repetible booleano, por compra o por monto (₡100..)", () => {
    expect(leerCambiosDeReglas({ sellos: { inicial: 2, repetible: false, sellosPor: "monto", montoPorSello: 4500 } })).toEqual({
      ok: true,
      valor: { sellos: { inicial: 2, repetible: false, sellosPor: "monto", montoPorSello: 4500 } },
    });
    expect(leerCambiosDeReglas({ sellos: { inicial: -1 } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ sellos: { inicial: 15 } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ sellos: { repetible: "no" } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ sellos: { sellosPor: "visita" } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ sellos: { montoPorSello: 99 } })).toMatchObject({ ok: false });
  });

  it("vencimiento: de 1 a 60 meses o null (nunca); tiene que traer «meses»", () => {
    expect(leerCambiosDeReglas({ vencimiento: { meses: 6 } })).toEqual({ ok: true, valor: { vencimiento: { meses: 6 } } });
    expect(leerCambiosDeReglas({ vencimiento: { meses: null } })).toEqual({ ok: true, valor: { vencimiento: { meses: null } } });
    expect(leerCambiosDeReglas({ vencimiento: { meses: 0 } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ vencimiento: { meses: 61 } })).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ vencimiento: {} })).toMatchObject({ ok: false });
  });

  it("una regla que no existe rebota; vacío también", () => {
    expect(leerCambiosDeReglas({ puntos: { maximo: 3 } })).toMatchObject({ ok: false, motivo: expect.stringMatching(/no es una regla/) });
    expect(leerCambiosDeReglas({})).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas(null)).toMatchObject({ ok: false });
    expect(leerCambiosDeReglas({ cashback: {} })).toMatchObject({ ok: false });
  });

  it("el pedido de la ruta: tarjeta + reglas", () => {
    expect(leerPedidoGuardarReglas({ rancho_id: RANCHO, programa_id: PROGRAMA, reglas: { vencimiento: { meses: 3 } } })).toEqual({
      ok: true,
      valor: { ranchoId: RANCHO, programaId: PROGRAMA, cambios: { vencimiento: { meses: 3 } } },
    });
    expect(leerPedidoGuardarReglas({ rancho_id: RANCHO, reglas: { vencimiento: { meses: 3 } } })).toMatchObject({ ok: false });
  });
});

describe("reglasDeFila — lo que el motor aplica hoy", () => {
  it("cashback: la compra mínima y el tope salen de las COLUMNAS del motor", () => {
    const r = reglasDeFila(
      filaCashback({
        compra_minima: 2000,
        max_por_transaccion: 300,
        // El beneficio dice otra cosa: manda lo que el motor aplica.
        beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null, canjeLibre: true, minimoCanje: 1000 },
      }),
      null,
    );
    expect(r).toEqual({
      tipo: "cashback",
      cashback: { porcentaje: 5, compraMinima: 2000, topePorCompra: 300, minimoCanje: 1000, canjeLibre: true },
      sellos: null,
      vencimiento: { meses: null, desde: null, diasDeAviso: 14 },
    });
  });

  it("cashback de antes de la 0135 (sin beneficio): el % sale de puntos_por_colon", () => {
    expect(reglasDeFila(filaCashback({ beneficio: null, puntos_por_colon: 0.07 }), null)?.cashback).toMatchObject({ porcentaje: 7, canjeLibre: false });
  });

  it("sellos: «repetible» lo dice el premio de la meta (su límite por cliente)", () => {
    expect(reglasDeFila(filaSellos(), META)?.sellos).toEqual({ requeridos: 10, inicial: 0, repetible: true, sellosPor: "compra", montoPorSello: null });
    expect(reglasDeFila(filaSellos(), { ...META, limitePorCliente: 1 })?.sellos?.repetible).toBe(false);
  });

  it("el vencimiento de un cashback se LEE (es una tarjeta de Foorkie)", () => {
    const r = reglasDeFila(filaCashback({ sellos_vencen_meses: 6, sellos_vencen_desde: "2026-09-01T00:00:00.000Z" }), null);
    expect(r?.vencimiento).toEqual({ meses: 6, desde: "2026-09-01T00:00:00.000Z", diasDeAviso: 14 });
  });

  it("una gift card o un cupón no tienen reglas acá", () => {
    expect(reglasDeFila({ ...filaCashback(), modo: "giftcard" }, null)).toBeNull();
    expect(reglasDeFila({ ...filaCashback(), modo: "cupon" }, null)).toBeNull();
  });
});

describe("planDeReglas — se escribe SOLO lo que cambia", () => {
  it("cashback: el beneficio y las columnas del motor, juntos", () => {
    const r = planDeReglas({
      fila: filaCashback(),
      meta: null,
      cambios: { cashback: { compraMinima: 2000, topePorCompra: 500, minimoCanje: 1000 } },
      ahora: AHORA,
    });
    expect(r).toEqual({
      ok: true,
      plan: {
        columnas: {
          beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 2000, topePorCompra: 500, minimoCanje: 1000, canjeLibre: true },
          compra_minima: 2000,
          max_por_transaccion: 500,
        },
        premio: null,
      },
    });
  });

  it("cashback sin cambios de verdad: nada que escribir", () => {
    const fila = filaCashback({
      compra_minima: 2000,
      beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 2000, topePorCompra: null, canjeLibre: true, minimoCanje: null },
    });
    expect(planDeReglas({ fila, meta: null, cambios: { cashback: { compraMinima: 2000 } }, ahora: AHORA })).toEqual({
      ok: true,
      plan: { columnas: {}, premio: null },
    });
  });

  it("una tarjeta de Foorkie que todavía no tenía el canje libre lo recibe al guardar", () => {
    const fila = filaCashback({ beneficio: { tipo: "cashback", porcentaje: 5, compraMinima: 0, topePorCompra: null } });
    const r = planDeReglas({ fila, meta: null, cambios: { vencimiento: { meses: 6 } }, ahora: AHORA });
    expect(r.ok && r.plan.columnas.beneficio).toMatchObject({ canjeLibre: true });
  });

  it("vencimiento: encenderlo arranca el reloj HOY; cambiar los meses no lo reinicia; apagarlo lo borra", () => {
    const encender = planDeReglas({ fila: filaCashback(), meta: null, cambios: { vencimiento: { meses: 6 } }, ahora: AHORA });
    expect(encender).toEqual({
      ok: true,
      plan: { columnas: { sellos_vencen_meses: 6, sellos_vencen_desde: AHORA.toISOString() }, premio: null },
    });

    const prendida = filaCashback({ sellos_vencen_meses: 6, sellos_vencen_desde: "2026-09-01T00:00:00.000Z" });
    expect(planDeReglas({ fila: prendida, meta: null, cambios: { vencimiento: { meses: 3 } }, ahora: AHORA })).toEqual({
      ok: true,
      plan: { columnas: { sellos_vencen_meses: 3 }, premio: null },
    });
    expect(planDeReglas({ fila: prendida, meta: null, cambios: { vencimiento: { meses: null } }, ahora: AHORA })).toEqual({
      ok: true,
      plan: { columnas: { sellos_vencen_meses: null, sellos_vencen_desde: null }, premio: null },
    });
  });

  it("sellos: «una sola vuelta» pone el límite del premio de la meta en 1 (y «otra vuelta» lo saca)", () => {
    const r = planDeReglas({ fila: filaSellos(), meta: META, cambios: { sellos: { repetible: false } }, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, plan: { premio: { id: "r-meta", limitePorCliente: 1 } } });
    expect(r.ok && r.plan.columnas.beneficio).toMatchObject({ repetible: false });

    const vuelta = planDeReglas({
      fila: filaSellos({ beneficio: { tipo: "sellos", requeridos: 10, recompensa: "Un matcha", inicial: 0, repetible: false } }),
      meta: { ...META, limitePorCliente: 1 },
      cambios: { sellos: { repetible: true } },
      ahora: AHORA,
    });
    expect(vuelta).toMatchObject({ ok: true, plan: { premio: { id: "r-meta", limitePorCliente: null } } });
  });

  it("sellos: las MISMAS reglas que el panel de Bookea (regalo < meta, monto por sello)", () => {
    expect(planDeReglas({ fila: filaSellos(), meta: META, cambios: { sellos: { inicial: 10 } }, ahora: AHORA })).toMatchObject({
      ok: false,
      motivo: "Los sellos de regalo tienen que ser menos que la meta.",
    });
    expect(planDeReglas({ fila: filaSellos(), meta: META, cambios: { sellos: { sellosPor: "monto" } }, ahora: AHORA })).toMatchObject({
      ok: false,
      motivo: expect.stringMatching(/cada cuántos colones/),
    });
    const porMonto = planDeReglas({ fila: filaSellos(), meta: META, cambios: { sellos: { sellosPor: "monto", montoPorSello: 4500, inicial: 2 } }, ahora: AHORA });
    expect(porMonto.ok && porMonto.plan.columnas.beneficio).toMatchObject({ sellosPor: "monto", montoPorSello: 4500, inicial: 2 });
    // Volver a «por compra» borra el monto.
    const volver = planDeReglas({
      fila: filaSellos({ beneficio: { tipo: "sellos", requeridos: 10, recompensa: "Un matcha", inicial: 0, repetible: true, sellosPor: "monto", montoPorSello: 4500 } }),
      meta: META,
      cambios: { sellos: { sellosPor: "compra" } },
      ahora: AHORA,
    });
    expect(volver.ok && volver.plan.columnas.beneficio).toMatchObject({ sellosPor: "compra", montoPorSello: null });
  });

  it("una regla de otro tipo de tarjeta rebota", () => {
    expect(planDeReglas({ fila: filaSellos(), meta: META, cambios: { cashback: { compraMinima: 1000 } }, ahora: AHORA })).toMatchObject({ ok: false });
    expect(planDeReglas({ fila: filaCashback(), meta: null, cambios: { sellos: { inicial: 1 } }, ahora: AHORA })).toMatchObject({ ok: false });
  });

  it("puntos: solo el vencimiento", () => {
    const fila = { ...filaCashback(), modo: "puntos", beneficio: null };
    expect(planDeReglas({ fila, meta: null, cambios: { vencimiento: { meses: 12 } }, ahora: AHORA })).toEqual({
      ok: true,
      plan: { columnas: { sellos_vencen_meses: 12, sellos_vencen_desde: AHORA.toISOString() }, premio: null },
    });
  });
});

// ── De punta a punta, contra una base de mentira ────────────────────

type Fila = Record<string, unknown>;

function baseDeMentira(tablas: Record<string, Fila[]>) {
  const escrituras: { tabla: string; valores: Fila; filtros: [string, unknown][] }[] = [];
  const db = {
    from(tabla: string) {
      const eqs: [string, unknown][] = [];
      let unico = false;
      let limite: number | null = null;
      let contar = false;
      let actualizar: Fila | null = null;
      const b = {
        select: (_c?: string, o?: { count?: string; head?: boolean }) => {
          if (o?.count) contar = true;
          return b;
        },
        update: (valores: Fila) => {
          actualizar = valores;
          return b;
        },
        eq: (c: string, v: unknown) => {
          eqs.push([c, v]);
          return b;
        },
        in: () => b,
        order: () => b,
        limit: (n: number) => {
          limite = n;
          return b;
        },
        maybeSingle: () => {
          unico = true;
          return b;
        },
        then: (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
          Promise.resolve()
            .then(() => {
              const filas = (tablas[tabla] ?? []).filter((f) => eqs.every(([c, v]) => f[c] === v));
              if (actualizar) {
                escrituras.push({ tabla, valores: actualizar, filtros: [...eqs] });
                for (const f of filas) Object.assign(f, actualizar);
                return { data: null, error: null };
              }
              if (contar) return { count: filas.length, data: null, error: null };
              const vistas = (limite === null ? filas : filas.slice(0, limite)).map((f) => ({ ...f }));
              return { data: unico ? (vistas[0] ?? null) : vistas, error: null };
            })
            .then(ok, mal),
      };
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, escrituras };
}

const deFoorkie = { id: "local-dg", bookea_programa_id: PROGRAMA, bookea_rancho_id: RANCHO, lealtad_por_foorkie: true, slug: "donde-george", activo: true, estado_publicacion: "aprobado" };

describe("de punta a punta", () => {
  it("una tarjeta sin la marca de Foorkie (Pura Matcha) no se lee ni se toca", async () => {
    const { db, escrituras } = baseDeMentira({
      programa_lealtad: [filaCashback()],
      recompensas: [],
      foorkie_restaurantes: [{ ...deFoorkie, lealtad_por_foorkie: false }],
    });
    const leer = await reglasDeLaTarjeta(db, { ranchoId: RANCHO, programaId: PROGRAMA });
    expect(leer).toMatchObject({ ok: false, codigo: "no_es_de_foorkie", status: 403 });
    const guardar = await guardarReglasDeLaTarjeta(db, { ranchoId: RANCHO, programaId: PROGRAMA, cambios: { vencimiento: { meses: 6 } } }, AHORA);
    expect(guardar).toMatchObject({ ok: false, codigo: "no_es_de_foorkie" });
    expect(escrituras).toEqual([]);
  });

  it("guarda el cashback y el vencimiento, y devuelve cómo quedó", async () => {
    const { db, escrituras } = baseDeMentira({
      programa_lealtad: [filaCashback()],
      recompensas: [],
      miembros: [{ id: "m1", programa_id: PROGRAMA }],
      foorkie_restaurantes: [deFoorkie],
    });
    const r = await guardarReglasDeLaTarjeta(
      db,
      { ranchoId: RANCHO, programaId: PROGRAMA, cambios: { cashback: { compraMinima: 2000, minimoCanje: 1000 }, vencimiento: { meses: 6 } } },
      AHORA,
    );
    expect(r).toMatchObject({
      ok: true,
      cambio: true,
      reglas: {
        tipo: "cashback",
        cashback: { compraMinima: 2000, minimoCanje: 1000, canjeLibre: true, topePorCompra: null },
        vencimiento: { meses: 6, desde: AHORA.toISOString() },
      },
    });
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]).toMatchObject({ tabla: "programa_lealtad", valores: { compra_minima: 2000, sellos_vencen_meses: 6 } });
    expect(escrituras[0].filtros).toEqual([
      ["id", PROGRAMA],
      ["rancho_id", RANCHO],
    ]);

    // Mandar lo mismo otra vez no escribe nada (ni refresca pases).
    const otra = await guardarReglasDeLaTarjeta(
      db,
      { ranchoId: RANCHO, programaId: PROGRAMA, cambios: { cashback: { compraMinima: 2000, minimoCanje: 1000 }, vencimiento: { meses: 6 } } },
      AHORA,
    );
    expect(otra).toMatchObject({ ok: true, cambio: false });
    expect(escrituras).toHaveLength(1);
  });

  it("una tarjeta archivada no se edita (el candado del panel de Bookea)", async () => {
    const { db, escrituras } = baseDeMentira({
      programa_lealtad: [filaCashback({ estado: "archivado" })],
      recompensas: [],
      miembros: [],
      foorkie_restaurantes: [deFoorkie],
    });
    const r = await guardarReglasDeLaTarjeta(db, { ranchoId: RANCHO, programaId: PROGRAMA, cambios: { vencimiento: { meses: 6 } } }, AHORA);
    expect(r).toMatchObject({ ok: false, codigo: "no_editable", status: 409 });
    expect(escrituras).toEqual([]);
  });

  it("sellos de una sola vuelta: el límite va en el premio de la meta", async () => {
    const { db, escrituras } = baseDeMentira({
      programa_lealtad: [filaSellos()],
      recompensas: [{ id: "r-meta", programa_id: PROGRAMA, nombre: "Un matcha", costo_puntos: 10, limite_por_cliente: null, activo: true }],
      miembros: [],
      foorkie_restaurantes: [deFoorkie],
    });
    const r = await guardarReglasDeLaTarjeta(db, { ranchoId: RANCHO, programaId: PROGRAMA, cambios: { sellos: { repetible: false, inicial: 2 } } }, AHORA);
    expect(r).toMatchObject({ ok: true, cambio: true, reglas: { sellos: { repetible: false, inicial: 2 } } });
    expect(escrituras.map((e) => e.tabla)).toEqual(["programa_lealtad", "recompensas"]);
    expect(escrituras[1]).toMatchObject({ valores: { limite_por_cliente: 1 } });
  });
});
