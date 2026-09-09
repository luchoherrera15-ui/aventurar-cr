/**
 * ════════════════════════════════════════════════════════════════════
 *  ARMAR EL PLATO — quitar ingredientes, sumar extras, dejar una nota
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (9 sep 2026): «que la gente pueda ordenar tipo Uber
 * Eats: personalizar la hamburguesa, qué ingredientes tiene para poder
 * quitárselos, y que quien pide pueda agregar notas».
 *
 * ── LAS DOS LISTAS, Y POR QUÉ NO ES UNA SOLA ────────────────────────
 * Son dos preguntas distintas y el cliente las contesta distinto:
 *
 *   INGREDIENTES  lo que el plato YA TRAE. Vienen marcados; el cliente
 *                 desmarca lo que no quiere. Nunca cambian el precio —
 *                 quitar cebolla no abarata la hamburguesa, y cobrar de
 *                 menos por quitar algo es una discusión en la caja.
 *   EXTRAS        lo que el plato NO trae. Vienen desmarcados; el
 *                 cliente suma lo que quiera y CADA UNO tiene precio.
 *
 * ── EL PRECIO LO DECIDE EL SERVIDOR, SIEMPRE ────────────────────────
 * `precioDeLinea` es puro y lo usan las dos puntas: la pantalla, para
 * mostrar el total mientras se arma, y el servidor, para cobrar. El
 * navegador manda QUÉ eligió (ids), nunca cuánto cuesta — un extra con
 * precio negociado desde el teléfono sería un menú gratis.
 *
 * ── LOS IDS ─────────────────────────────────────────────────────────
 * Cada ingrediente y cada extra llevan un id corto propio del plato, y
 * es lo único que viaja en el pedido. Si el negocio renombra «Cebolla»
 * a «Cebolla morada», los pedidos viejos siguen apuntando bien.
 */

/** Cuánto se acepta de cada cosa. Lo fija el servidor, no la pantalla. */
export const TOPES_PERSONALIZACION = {
  ingredientes: 15,
  extras: 15,
  nombre: 40,
  /** La nota que escribe el CLIENTE para ese plato. */
  nota: 140,
  /** Un extra no puede costar más que una cena entera. */
  precioExtra: 1_000_000,
} as const;

export type Ingrediente = { id: string; nombre: string };
export type Extra = { id: string; nombre: string; precio: number };

export type Personalizacion = {
  /** Lo que el plato trae y el cliente puede quitar. */
  ingredientes: Ingrediente[];
  /** Lo que puede agregar, con su precio. */
  extras: Extra[];
};

export const SIN_PERSONALIZAR: Personalizacion = { ingredientes: [], extras: [] };

/** Lo que el CLIENTE eligió para un renglón del carrito. */
export type Eleccion = {
  /** Ids de ingredientes que pidió SIN. */
  sin: string[];
  /** Ids de extras que agregó. */
  extras: string[];
  /** Su nota para ese plato («bien cocida», «sin sal»). */
  nota: string;
};

export const SIN_ELECCION: Eleccion = { sin: [], extras: [], nota: "" };

const texto = (v: unknown, tope: number) => (typeof v === "string" ? v.trim().slice(0, tope) : "");

/** Un id corto y estable, derivado del nombre. Sin depender del reloj. */
export function idDeOpcion(nombre: string, usados: Set<string>): string {
  const base =
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 18) || "op";
  let id = base;
  let n = 2;
  while (usados.has(id)) id = `${base}-${n++}`;
  usados.add(id);
  return id;
}

/**
 * Lo guardado → dos listas que se pueden pintar sin miedo.
 *
 * Tolera lo que sea: la columna es jsonb y puede traer una forma vieja,
 * un objeto vacío o basura. Sin listas, el plato se pide de un toque,
 * exactamente como antes de la 0241.
 */
export function personalizacionDe(v: unknown): Personalizacion {
  const d = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const usados = new Set<string>();

  const ingredientes: Ingrediente[] = (Array.isArray(d.ingredientes) ? d.ingredientes : [])
    .map((x) => {
      const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
      const nombre = texto(o.nombre, TOPES_PERSONALIZACION.nombre);
      if (!nombre) return null;
      const id = texto(o.id, 24) || idDeOpcion(nombre, usados);
      usados.add(id);
      return { id, nombre };
    })
    .filter((x): x is Ingrediente => x !== null)
    .slice(0, TOPES_PERSONALIZACION.ingredientes);

  const extras: Extra[] = (Array.isArray(d.extras) ? d.extras : [])
    .map((x) => {
      const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
      const nombre = texto(o.nombre, TOPES_PERSONALIZACION.nombre);
      if (!nombre) return null;
      const id = texto(o.id, 24) || idDeOpcion(nombre, usados);
      usados.add(id);
      const bruto = Number(o.precio);
      const precio = Number.isFinite(bruto)
        ? Math.min(TOPES_PERSONALIZACION.precioExtra, Math.max(0, Math.round(bruto * 100) / 100))
        : 0;
      return { id, nombre, precio };
    })
    .filter((x): x is Extra => x !== null)
    .slice(0, TOPES_PERSONALIZACION.extras);

  return { ingredientes, extras };
}

/** ¿Este plato se puede armar, o se agrega de un toque? */
export function seArma(p: Personalizacion): boolean {
  return p.ingredientes.length > 0 || p.extras.length > 0;
}

/**
 * Lo elegido, limpio: solo ids que EXISTEN en este plato.
 *
 * Es la puerta del servidor. Un id inventado desde el teléfono se cae
 * acá y no llega ni al precio ni al mensaje.
 */
export function eleccionDe(v: unknown, p: Personalizacion): Eleccion {
  const d = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const ids = (lista: unknown, validos: Set<string>) =>
    [...new Set((Array.isArray(lista) ? lista : []).map((x) => String(x)))].filter((x) => validos.has(x));

  return {
    sin: ids(d.sin, new Set(p.ingredientes.map((i) => i.id))),
    extras: ids(d.extras, new Set(p.extras.map((e) => e.id))),
    nota: texto(d.nota, TOPES_PERSONALIZACION.nota),
  };
}

/** El precio de UNA unidad: el plato más sus extras. */
export function precioDeLinea(base: number, p: Personalizacion, e: Eleccion): number {
  const suma = p.extras.filter((x) => e.extras.includes(x.id)).reduce((t, x) => t + x.precio, 0);
  return Math.round((base + suma) * 100) / 100;
}

/**
 * Lo elegido, en palabras, para el carrito y para el WhatsApp.
 *
 * Devuelve renglones sueltos («Sin cebolla», «+ Queso», «Nota: …») en
 * vez de una frase armada: cada punta los junta como le sirve —la
 * pantalla con saltos de línea, el mensaje con guiones—, y así no hay
 * dos formatos que se contradigan.
 */
export function detalleDeLinea(p: Personalizacion, e: Eleccion): string[] {
  const lineas: string[] = [];

  const quitados = p.ingredientes.filter((i) => e.sin.includes(i.id));
  if (quitados.length) lineas.push(`Sin ${quitados.map((i) => i.nombre.toLowerCase()).join(", ")}`);

  for (const x of p.extras.filter((x) => e.extras.includes(x.id))) lineas.push(`+ ${x.nombre}`);

  if (e.nota) lineas.push(`Nota: ${e.nota}`);
  return lineas;
}

/**
 * La FIRMA de un renglón del carrito.
 *
 * Dos hamburguesas idénticas son un renglón de dos, no dos renglones; y
 * una con queso y otra sin cebolla son dos renglones distintos. Ordena
 * los ids para que el orden en que se tocaron las casillas no invente
 * un renglón nuevo.
 */
export function firmaDeLinea(itemId: string, e: Eleccion): string {
  const orden = (v: string[]) => [...v].sort().join(",");
  return `${itemId}|${orden(e.sin)}|${orden(e.extras)}|${e.nota}`;
}
