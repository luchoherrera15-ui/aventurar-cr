import { definicionDeCondicion, ETIQUETA_OP } from "./catalogo";
import type { Condicion, ContextoCliente, OpCondicion } from "./tipos";

/**
 * LAS CONDICIONES DE UN IMPULSO: «solo si el cliente…».
 *
 * Módulo PURO. Se evalúan DOS veces con la misma función: cuando se crea la
 * tarea y otra vez justo antes de mandarla, porque entre una y otra el
 * cliente pudo hacer algo (volver, canjear) que cambia la respuesta.
 *
 * Todas son condiciones Y: se tienen que cumplir las doce para que salga.
 */

type Valor = number | boolean | string | null;

/** El dato del cliente que mira cada condición. null = no se puede saber (y entonces no se cumple). */
export function valorDeCampo(campo: Condicion["campo"], c: ContextoCliente): Valor {
  switch (campo) {
    case "visitas":
      return c.visitas;
    case "saldo":
      return c.saldo;
    case "canjes":
      return c.canjes;
    case "dias_sin_actividad":
      return c.diasSinActividad;
    case "antiguedad_dias":
      return c.antiguedadDias;
    case "cliente":
      return c.visitas <= 1 ? "nuevo" : "recurrente";
    case "recompensa_disponible":
      return c.meta !== null && c.saldo >= c.meta;
    case "tiene_pase":
      return c.plataformas.length > 0;
    default:
      return null;
  }
}

function compara(op: OpCondicion, real: Valor, esperado: Condicion["valor"]): boolean {
  if (real === null) return false;
  if (op === "es") return real === esperado;
  if (typeof real !== "number" || typeof esperado !== "number") return false;
  if (op === "gte") return real >= esperado;
  if (op === "lte") return real <= esperado;
  return real === esperado;
}

export type ResultadoCondiciones = { cumple: true } | { cumple: false; condicion: Condicion; motivo: string };

export function evaluarCondiciones(condiciones: readonly Condicion[], c: ContextoCliente): ResultadoCondiciones {
  for (const cond of condiciones) {
    const real = valorDeCampo(cond.campo, c);
    if (!compara(cond.op, real, cond.valor)) {
      return { cumple: false, condicion: cond, motivo: describirCondicion(cond, c.modo) };
    }
  }
  return { cumple: true };
}

/** «Sellos actuales es al menos 3» — para mostrar por qué un mensaje se omitió. */
export function describirCondicion(cond: Condicion, modo: string): string {
  const def = definicionDeCondicion(cond.campo);
  const nombre = def ? def.etiqueta(modo) : cond.campo;
  const op = ETIQUETA_OP[cond.op] ?? cond.op;
  let valor: string;
  if (typeof cond.valor === "boolean") valor = cond.valor ? "sí" : "no";
  else if (def?.opciones) valor = def.opciones.find((o) => o.valor === cond.valor)?.etiqueta ?? String(cond.valor);
  else valor = String(cond.valor);
  return `${nombre} ${op} ${valor}`;
}

/** Texto del problema de una condición, o null si está bien. */
export function validarCondicion(cond: Condicion, modo: string): string | null {
  const def = definicionDeCondicion(cond.campo);
  if (!def) return "Esa condición no existe.";
  if (def.modos !== "todos" && !def.modos.includes(modo)) {
    return `«${def.etiqueta(modo)}» no se puede usar en este tipo de tarjeta.`;
  }
  if (!def.ops.includes(cond.op)) return `«${def.etiqueta(modo)}» no admite esa comparación.`;

  if (def.tipo === "numero") {
    if (typeof cond.valor !== "number" || !Number.isFinite(cond.valor) || !Number.isInteger(cond.valor)) {
      return `Escribí un número entero para «${def.etiqueta(modo)}».`;
    }
    if (def.min !== undefined && cond.valor < def.min) return `«${def.etiqueta(modo)}» no puede ser menor que ${def.min}.`;
    if (def.max !== undefined && cond.valor > def.max) return `«${def.etiqueta(modo)}» no puede ser mayor que ${def.max}.`;
  } else if (def.tipo === "booleano") {
    if (typeof cond.valor !== "boolean") return `Elegí sí o no para «${def.etiqueta(modo)}».`;
  } else if (def.tipo === "opciones") {
    if (!def.opciones?.some((o) => o.valor === cond.valor)) return `Elegí una opción para «${def.etiqueta(modo)}».`;
  }
  return null;
}
