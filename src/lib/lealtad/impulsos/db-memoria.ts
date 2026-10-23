import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Una base de datos que vive en memoria, SOLO PARA LAS PRUEBAS del servicio de impulsos y de las rutas de Foorkie.
 *
 * Imita la parte de PostgREST que ese código usa —`select` (con `count` y `head`), `insert`, `update`, `delete`,
 * `eq`, `neq`, `in`, `is`, `order`, `range`, `limit`, `single`, `maybeSingle` y el `impulsos_lealtad(nombre)` incrustado
 * del historial— y deja un registro de TODO lo que se le pidió, para poder afirmar «no se leyó ni se escribió nada».
 * No valida nada de lo que la base de verdad valida (CHECKs, triggers, llaves): eso está probado aparte.
 * Nada de producción importa este archivo.
 */

export type Fila = Record<string, unknown>;
export type ErrorDeBase = { code?: string; message: string };
export type Operacion = "select" | "insert" | "update" | "delete";

export type Anotacion = {
  tabla: string;
  operacion: Operacion;
  valores: Fila | null;
  /** Lo que se pidió en el `select` (o "*"). */
  columnas: string;
  filtros: [columna: string, operador: string, valor: unknown][];
};

export class BaseEnMemoria {
  tablas: Record<string, Fila[]>;
  /** Todo lo que se le pidió, en orden. */
  anotaciones: Anotacion[] = [];
  /**
   * Un error para `tabla` o para `tabla:operacion` (la operación gana). Puede ser una función que mira el pedido y
   * devuelve el error, o null para dejarlo pasar (para fallar una consulta y no otra de la misma tabla).
   */
  errores: Record<string, ErrorDeBase | ((pedido: Anotacion) => ErrorDeBase | null)> = {};

  constructor(tablas: Record<string, Fila[]> = {}) {
    this.tablas = tablas;
  }

  /** El cliente con la forma que el código espera. */
  get cliente(): SupabaseClient {
    return { from: (tabla: string) => this.consulta(tabla) } as unknown as SupabaseClient;
  }

  filas(tabla: string): Fila[] {
    return (this.tablas[tabla] ??= []);
  }

  /** Lo que se pidió a una tabla (con la operación, si se da). */
  pedidos(tabla: string, operacion?: Operacion): Anotacion[] {
    return this.anotaciones.filter((a) => a.tabla === tabla && (!operacion || a.operacion === operacion));
  }

  /** Todo lo que NO fue leer. */
  escrituras(): Anotacion[] {
    return this.anotaciones.filter((a) => a.operacion !== "select");
  }

  /** Lo que se le pidió a las tablas de los impulsos (para afirmar que no se tocaron). */
  tocoImpulsos(): Anotacion[] {
    return this.anotaciones.filter((a) => a.tabla.startsWith("impulsos_"));
  }

  private defectosAlInsertar(tabla: string): Fila {
    const ahora = new Date().toISOString();
    const base: Fila = { id: randomUUID(), created_at: ahora, updated_at: ahora };
    if (tabla === "impulsos_lealtad") return { ...base, version: 1, activado_en: null, ultimo_escaneo_en: null };
    return base;
  }

  private consulta(tabla: string) {
    const pruebas: ((f: Fila) => boolean)[] = [];
    const filtros: Anotacion["filtros"] = [];
    let operacion: Operacion = "select";
    let valores: Fila | null = null;
    let columnas = "*";
    let contar = false;
    let soloContar = false;
    let devolver = false;
    let unico: "single" | "maybe" | null = null;
    let orden: { columna: string; asc: boolean } | null = null;
    let rango: [number, number] | null = null;
    let tope: number | null = null;

    const filtrar = (columna: string, operador: string, valor: unknown, prueba: (f: Fila) => boolean) => {
      filtros.push([columna, operador, valor]);
      pruebas.push(prueba);
      return b;
    };

    const ejecutar = (): { data: unknown; error: ErrorDeBase | null; count: number | null } => {
      const pedido: Anotacion = { tabla, operacion, valores, columnas, filtros };
      this.anotaciones.push(pedido);
      const configurado = this.errores[`${tabla}:${operacion}`] ?? this.errores[tabla];
      const error = typeof configurado === "function" ? configurado(pedido) : (configurado ?? null);
      if (error) return { data: null, error, count: null };

      const todas = this.filas(tabla);
      const coinciden = todas.filter((f) => pruebas.every((p) => p(f)));

      if (operacion === "insert") {
        const nueva: Fila = { ...this.defectosAlInsertar(tabla), ...structuredClone(valores ?? {}) };
        todas.push(nueva);
        return resultado([nueva], null);
      }
      if (operacion === "update") {
        for (const f of coinciden) Object.assign(f, structuredClone(valores ?? {}));
        return resultado(coinciden, null);
      }
      if (operacion === "delete") {
        for (const f of coinciden) todas.splice(todas.indexOf(f), 1);
        return resultado(coinciden, null);
      }

      let filas = [...coinciden];
      if (orden) {
        const { columna, asc } = orden;
        filas.sort((x, y) => {
          const a = String(x[columna] ?? "");
          const z = String(y[columna] ?? "");
          return (a < z ? -1 : a > z ? 1 : 0) * (asc ? 1 : -1);
        });
      }
      const total = filas.length;
      if (rango) filas = filas.slice(rango[0], rango[1] + 1);
      if (tope !== null) filas = filas.slice(0, tope);
      if (soloContar) return { data: null, error: null, count: total };
      return resultado(filas, contar ? total : null);
    };

    /** Lo que devuelve una operación: las filas (copias) cuando se pidieron, y la forma de `single`/`maybeSingle`. */
    const resultado = (filas: Fila[], count: number | null) => {
      const pidioFilas = operacion === "select" || devolver;
      if (!pidioFilas) return { data: null, error: null, count };
      let copias = filas.map((f) => structuredClone(f));
      if (operacion === "select" && tabla === "impulsos_tareas" && /impulsos_lealtad\(/.test(columnas)) {
        copias = copias.map((f) => {
          const imp = this.filas("impulsos_lealtad").find((i) => i.id === f.impulso_id);
          return { ...f, impulsos_lealtad: imp ? { nombre: imp.nombre } : null };
        });
      }
      if (unico === "maybe") return { data: copias[0] ?? null, error: null, count };
      if (unico === "single") {
        return copias.length === 1
          ? { data: copias[0], error: null, count }
          : { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, count };
      }
      return { data: copias, error: null, count };
    };

    const b = {
      select(cols?: string, o?: { count?: string; head?: boolean }) {
        if (operacion === "select") {
          columnas = cols ?? "*";
          contar = Boolean(o?.count);
          soloContar = Boolean(o?.head);
        } else {
          devolver = true;
        }
        return b;
      },
      insert(v: Fila) {
        operacion = "insert";
        valores = v;
        return b;
      },
      update(v: Fila) {
        operacion = "update";
        valores = v;
        return b;
      },
      delete() {
        operacion = "delete";
        return b;
      },
      eq: (c: string, v: unknown) => filtrar(c, "eq", v, (f) => f[c] === v),
      neq: (c: string, v: unknown) => filtrar(c, "neq", v, (f) => f[c] !== v),
      in: (c: string, v: unknown[]) => filtrar(c, "in", v, (f) => v.includes(f[c])),
      is: (c: string, v: unknown) => filtrar(c, "is", v, (f) => (v === null ? f[c] === null || f[c] === undefined : f[c] === v)),
      order(columna: string, o?: { ascending?: boolean }) {
        orden = { columna, asc: o?.ascending !== false };
        return b;
      },
      range(desde: number, hasta: number) {
        rango = [desde, hasta];
        return b;
      },
      limit(n: number) {
        tope = n;
        return b;
      },
      single() {
        unico = "single";
        return b;
      },
      maybeSingle() {
        unico = "maybe";
        return b;
      },
      then(ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) {
        return Promise.resolve().then(ejecutar).then(ok, mal);
      },
    };
    return b;
  }
}
