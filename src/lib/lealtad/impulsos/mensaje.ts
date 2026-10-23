import type { ContextoCliente } from "./tipos";

/**
 * EL MENSAJE DE UN IMPULSO: variables, vista previa y limpieza del texto.
 *
 * Módulo PURO (sin servidor): lo usa la pantalla para la vista previa en vivo
 * y el motor para armar el mensaje que sale. La MISMA función en los dos
 * lados es lo que garantiza que lo que el negocio ve en la previa es lo que
 * el cliente recibe.
 *
 * ── LAS VARIABLES ───────────────────────────────────────────────────
 *   {{nombre_cliente}}     se escribe entre llaves dobles
 *   {{nombre_cliente|amigo}}  y, después de la barra, lo que va si el dato no existe
 *
 * Cada variable sale de un dato REAL del cliente. Si el dato no existe y no
 * hay alternativo, el mensaje NO se manda: un «Hola , ya vas por  de 5» es
 * peor que no mandar nada. (Con alternativo vacío —{{nombre_cliente|}}— la
 * variable simplemente desaparece, y se arregla el espacio que queda.)
 */

export type DefinicionVariable = {
  id: string;
  etiqueta: string;
  descripcion: string;
  ejemplo: string;
  /** Tipos de tarjeta donde tiene sentido. */
  modos: "todos" | readonly string[];
  /** Necesita una recompensa activa en la tarjeta. */
  requiereRecompensa?: boolean;
  valor: (c: ContextoCliente) => string | null;
};

const SIN_ESPACIOS_DUROS = /[  ]/g;

/** 1250 → «1 250» (separador de miles, sin los espacios duros que mete Intl). */
export function formatearNumero(n: number): string {
  return new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 }).format(Math.round(n)).replace(SIN_ESPACIOS_DUROS, " ");
}

function saldoTexto(c: ContextoCliente): string {
  return c.modo === "cashback" ? `₡${formatearNumero(c.saldo)}` : formatearNumero(c.saldo);
}

function faltantes(c: ContextoCliente): number | null {
  return c.meta === null ? null : Math.max(0, c.meta - c.saldo);
}

const POR_SALDO = ["puntos", "cashback"] as const;

export const VARIABLES: readonly DefinicionVariable[] = [
  {
    id: "nombre_cliente",
    etiqueta: "Nombre del cliente",
    descripcion: "El nombre de pila. No todos los clientes lo dejaron: poné un alternativo.",
    ejemplo: "María",
    modos: "todos",
    valor: (c) => c.nombre,
  },
  {
    id: "nombre_negocio",
    etiqueta: "Nombre del negocio",
    descripcion: "El nombre de tu negocio.",
    ejemplo: "Café del Parque",
    modos: "todos",
    valor: (c) => c.nombreNegocio || null,
  },
  {
    id: "nombre_programa",
    etiqueta: "Nombre de la tarjeta",
    descripcion: "El nombre del programa de lealtad.",
    ejemplo: "Tarjeta de sellos",
    modos: "todos",
    valor: (c) => c.nombrePrograma || null,
  },
  {
    id: "sellos_actuales",
    etiqueta: "Sellos actuales",
    descripcion: "Los sellos que lleva el cliente.",
    ejemplo: "4",
    modos: ["sellos"],
    valor: (c) => formatearNumero(c.saldo),
  },
  {
    id: "meta_sellos",
    etiqueta: "Sellos de la meta",
    descripcion: "Cuántos sellos pide la recompensa.",
    ejemplo: "5",
    modos: ["sellos"],
    requiereRecompensa: true,
    valor: (c) => (c.meta === null ? null : formatearNumero(c.meta)),
  },
  {
    id: "sellos_faltantes",
    etiqueta: "Sellos que le faltan",
    descripcion: "Cuántos sellos le faltan para el premio.",
    ejemplo: "1",
    modos: ["sellos"],
    requiereRecompensa: true,
    valor: (c) => {
      const f = faltantes(c);
      return f === null ? null : formatearNumero(f);
    },
  },
  {
    id: "puntos_disponibles",
    etiqueta: "Puntos o saldo",
    descripcion: "Lo que tiene acumulado. En cashback incluye el símbolo ₡.",
    ejemplo: "180",
    modos: POR_SALDO,
    valor: (c) => saldoTexto(c),
  },
  {
    id: "meta_puntos",
    etiqueta: "Puntos de la meta",
    descripcion: "Lo que cuesta la recompensa. En cashback incluye el símbolo ₡.",
    ejemplo: "200",
    modos: POR_SALDO,
    requiereRecompensa: true,
    valor: (c) => (c.meta === null ? null : c.modo === "cashback" ? `₡${formatearNumero(c.meta)}` : formatearNumero(c.meta)),
  },
  {
    id: "puntos_faltantes",
    etiqueta: "Puntos que le faltan",
    descripcion: "Lo que le falta para el premio. En cashback incluye el símbolo ₡.",
    ejemplo: "20",
    modos: POR_SALDO,
    requiereRecompensa: true,
    valor: (c) => {
      const f = faltantes(c);
      if (f === null) return null;
      return c.modo === "cashback" ? `₡${formatearNumero(f)}` : formatearNumero(f);
    },
  },
  {
    id: "nombre_recompensa",
    etiqueta: "Nombre del premio",
    descripcion: "La recompensa que está persiguiendo el cliente.",
    ejemplo: "Café gratis",
    modos: "todos",
    requiereRecompensa: true,
    valor: (c) => c.recompensa,
  },
  {
    id: "dias_sin_actividad",
    etiqueta: "Días sin venir",
    descripcion: "Cuántos días pasaron desde su última visita.",
    ejemplo: "32",
    modos: "todos",
    valor: (c) => (c.diasSinActividad === null ? null : formatearNumero(c.diasSinActividad)),
  },
];

const VARIABLES_POR_ID = new Map<string, DefinicionVariable>(VARIABLES.map((v) => [v.id, v]));

export function definicionDeVariable(id: string): DefinicionVariable | null {
  return VARIABLES_POR_ID.get(id) ?? null;
}

export function variablesParaModo(modo: string): DefinicionVariable[] {
  return VARIABLES.filter((v) => v.modos === "todos" || v.modos.includes(modo));
}

// ═══════════════════════════════════════════════════════════════════
//  TOKENS
// ═══════════════════════════════════════════════════════════════════

export type Token = {
  /** El texto tal como está escrito, con las llaves. */
  token: string;
  nombre: string;
  /** null = no se escribió alternativo; "" = alternativo vacío a propósito. */
  alternativo: string | null;
};

const TOKEN = /\{\{\s*([a-z][a-z0-9_]*)\s*(?:\|([^{}]*))?\}\}/g;

export function extraerTokens(texto: string): Token[] {
  const tokens: Token[] = [];
  for (const m of texto.matchAll(TOKEN)) {
    tokens.push({ token: m[0], nombre: m[1], alternativo: m[2] === undefined ? null : m[2].trim() });
  }
  return tokens;
}

export type ContextoPlantilla = { modo: string; tieneRecompensa: boolean };

/** Qué está mal con las variables de un texto, en español. Vacío = todo bien. */
export function validarVariables(texto: string, ctx: ContextoPlantilla): string[] {
  const errores: string[] = [];
  for (const t of extraerTokens(texto)) {
    const def = definicionDeVariable(t.nombre);
    if (!def) {
      errores.push(`La variable «{{${t.nombre}}}» no existe. Elegí una de la lista.`);
      continue;
    }
    if (def.modos !== "todos" && !def.modos.includes(ctx.modo)) {
      errores.push(`«{{${t.nombre}}}» no se puede usar en este tipo de tarjeta.`);
      continue;
    }
    if (def.requiereRecompensa && !ctx.tieneRecompensa && t.alternativo === null) {
      errores.push(`«{{${t.nombre}}}» necesita que la tarjeta tenga una recompensa activa.`);
    }
  }
  // Llaves sueltas o variables mal escritas: sin esto saldrían tal cual en el mensaje del cliente.
  const sinTokens = texto.replace(TOKEN, "");
  if (/\{\{|\}\}/.test(sinTokens)) {
    errores.push("Hay una variable mal escrita (le falta cerrar o abrir las llaves dobles).");
  }
  return errores;
}

/** Variables que pueden quedar sin dato y no tienen alternativo: ahí el mensaje se omite. */
export function variablesSinAlternativo(texto: string): string[] {
  const lista = new Set<string>();
  for (const t of extraerTokens(texto)) {
    const def = definicionDeVariable(t.nombre);
    if (def && t.alternativo === null && (def.id === "nombre_cliente" || def.id === "dias_sin_actividad" || def.requiereRecompensa)) {
      lista.add(t.nombre);
    }
  }
  return [...lista];
}

// ═══════════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════════

export type TextoRenderizado = {
  texto: string;
  /** Variables que no tenían dato ni alternativo: si hay alguna, NO se manda. */
  faltantes: string[];
};

/** Arregla lo que deja una variable vacía: espacios dobles y un espacio antes de la coma o el signo. */
function acomodar(texto: string): string {
  return texto
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/(¡|¿)[ \t]+/g, "$1")
    .replace(/^[ \t,;:]+/, "")
    .trim();
}

export function renderizar(plantilla: string, ctx: ContextoCliente): TextoRenderizado {
  const faltantes: string[] = [];
  const texto = plantilla.replace(TOKEN, (_todo, nombre: string, alternativo: string | undefined) => {
    const def = definicionDeVariable(nombre);
    const valor = def ? def.valor(ctx) : null;
    if (valor !== null && valor !== undefined && String(valor).trim() !== "") return String(valor).trim();
    if (alternativo !== undefined) return alternativo.trim();
    faltantes.push(nombre);
    return "";
  });
  return { texto: acomodar(texto), faltantes: [...new Set(faltantes)] };
}

// ═══════════════════════════════════════════════════════════════════
//  LIMPIEZA Y LARGO
// ═══════════════════════════════════════════════════════════════════

/** Largo en caracteres que ve la persona (un emoji cuenta uno, como lo cuenta la base). */
export function largo(texto: string): number {
  return Array.from(texto).length;
}

/**
 * Deja el texto como se puede mandar: sin caracteres de control, sin los marcadores de ancho cero que
 * el pase de Apple usa para forzar un aviso, y con los espacios en orden. `unaLinea` junta los saltos
 * de línea (el reverso del pase de Apple no admite más de una).
 */
export function limpiarTexto(crudo: string, { unaLinea }: { unaLinea: boolean }): string {
  let t = crudo.replace(/[​⁠﻿]/g, "").replace(/\r\n?/g, "\n");
  if (unaLinea) {
    t = t.replace(/\s+/g, " ");
  } else {
    t = t
      .split("\n")
      .map((l) => l.replace(/[^\S\n]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }
  // Fuera lo que no se ve (control), conservando el salto de línea cuando se permite.
  t = t.replace(unaLinea ? /\p{Cc}/gu : /[^\P{Cc}\n]/gu, " ");
  if (unaLinea) t = t.replace(/ {2,}/g, " ");
  return t.trim();
}

/** Recorta sin partir una palabra a la mitad cuando se puede. */
export function recortar(texto: string, max: number): string {
  const chars = Array.from(texto);
  if (chars.length <= max) return texto;
  const corte = chars.slice(0, Math.max(1, max - 1)).join("");
  const ultimoEspacio = corte.lastIndexOf(" ");
  const base = ultimoEspacio >= corte.length * 0.6 ? corte.slice(0, ultimoEspacio) : corte;
  return `${base.replace(/[\s,.;:]+$/, "")}…`;
}

// ═══════════════════════════════════════════════════════════════════
//  VISTA PREVIA
// ═══════════════════════════════════════════════════════════════════

/** Un cliente de mentira, con datos que lucen como los de verdad, para la vista previa. */
export function contextoDeEjemplo(modo: string, nombreNegocio = "Tu negocio", nombrePrograma = "Tu tarjeta"): ContextoCliente {
  const base = {
    nombre: "María",
    nombreNegocio,
    nombrePrograma,
    modo,
    visitas: 6,
    canjes: 1,
    ultimaActividad: null,
    diasSinActividad: 32,
    antiguedadDias: 45,
    plataformas: ["google"] as const,
  };
  if (modo === "sellos") return { ...base, saldo: 4, meta: 5, recompensa: "Café gratis" };
  if (modo === "cashback") return { ...base, saldo: 1250, meta: 2000, recompensa: "₡2 000 de descuento" };
  return { ...base, saldo: 180, meta: 200, recompensa: "Postre gratis" };
}

export type VistaPreviaMensaje = {
  titulo: string;
  cuerpo: string;
  /** Variables sin dato y sin alternativo en este ejemplo. */
  faltantes: string[];
  /** true = el texto se acortó para que entre en el canal. */
  recortado: boolean;
};

export function vistaPrevia(
  { titulo, cuerpo }: { titulo: string; cuerpo: string },
  canal: { tituloMax: number; cuerpoMax: number; unaLinea: boolean },
  ctx: ContextoCliente,
): VistaPreviaMensaje {
  const t = renderizar(titulo, ctx);
  const c = renderizar(cuerpo, ctx);
  const tituloFinal = limpiarTexto(t.texto, { unaLinea: true });
  const cuerpoFinal = limpiarTexto(c.texto, { unaLinea: canal.unaLinea });
  const tituloCorto = canal.tituloMax > 0 ? recortar(tituloFinal, canal.tituloMax) : tituloFinal;
  const cuerpoCorto = canal.cuerpoMax > 0 ? recortar(cuerpoFinal, canal.cuerpoMax) : cuerpoFinal;
  return {
    titulo: tituloCorto,
    cuerpo: cuerpoCorto,
    faltantes: [...new Set([...t.faltantes, ...c.faltantes])],
    recortado: tituloCorto !== tituloFinal || cuerpoCorto !== cuerpoFinal,
  };
}

/** «María Fernanda López» → «María». Null si no hay un nombre que sirva (un correo, un número, nada). */
export function nombreDePila(completo: string | null | undefined): string | null {
  if (!completo) return null;
  const primero = completo.trim().split(/\s+/)[0] ?? "";
  const limpio = primero.replace(/[^\p{L}'’-]/gu, "");
  if (limpio.length < 2 || limpio.length > 30 || primero.includes("@")) return null;
  // «MARÍA» o «maría» → «María»; «DeAnna» se respeta.
  const soloMayus = limpio === limpio.toUpperCase();
  const soloMinus = limpio === limpio.toLowerCase();
  if (!soloMayus && !soloMinus) return limpio;
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}
