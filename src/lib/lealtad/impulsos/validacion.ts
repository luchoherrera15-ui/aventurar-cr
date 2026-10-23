import { activadorAplicaAlModo, definicionDeActivador, type DefinicionActivador } from "./catalogo";
import { validarCondicion } from "./condiciones";
import { impulsoReemplazaAlHito, type HitoDeCorreoAntiguo } from "./cobertura";
import { contextoDeEjemplo, largo, limpiarTexto, renderizar, validarVariables, variablesSinAlternativo } from "./mensaje";
import { validarHorario } from "./programacion";
import { definicionDeActivadorEnVoz, definicionDeCanalEnVoz, textosDe, type Voz } from "./voz-foorkie";
import type { Condicion, ConfigActivador, EntradaImpulso, Horario } from "./tipos";

/**
 * VALIDAR Y LIMPIAR UN IMPULSO.
 *
 * Dos funciones, para dos momentos distintos:
 *
 *   normalizarEntrada(crudo)         SERVIDOR. Lo que llega del navegador no es de fiar: se
 *                                    reconstruye campo por campo con los tipos y rangos forzados.
 *                                    Nada de lo que no esté en la lista pasa.
 *   validarImpulso(entrada, ctx)     SERVIDOR Y NAVEGADOR. Dice qué está mal, en español, y si
 *                                    el impulso se puede guardar y si se puede ACTIVAR.
 *
 * Guardar y activar no exigen lo mismo: un borrador puede estar a medias (sin recompensa
 * todavía, con una variable por arreglar), pero un impulso ACTIVO sale a clientes de verdad
 * y tiene que estar impecable. Cada problema dice cuál de las dos cosas bloquea.
 */

export type Problema = {
  campo: string;
  mensaje: string;
  bloquea: "guardar" | "activar";
};

export type ResultadoValidacion = {
  problemas: Problema[];
  /** Cosas que no impiden nada pero conviene saber. */
  avisos: string[];
  puedeGuardar: boolean;
  puedeActivar: boolean;
};

export type ContextoValidacion = {
  modo: string;
  /** Tarjeta de Foorkie: los correos los manda Foorkie. */
  esFoorkie: boolean;
  tieneRecompensa: boolean;
  /** AAAA-MM-DD de hoy en la zona del negocio. */
  hoy: string;
  /**
   * Quién mira: el panel de Bookea (por defecto) o el de Foorkie Lealtad. Solo cambia los TEXTOS que
   * nombran a Bookea, a «Recompensas» o al correo de Foorkie (ver `voz-foorkie.ts`); las reglas son las mismas.
   */
  voz?: Voz;
};

// ═══════════════════════════════════════════════════════════════════
//  NORMALIZAR (servidor)
// ═══════════════════════════════════════════════════════════════════

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ID_SIMPLE = /^[a-z][a-z0-9_]{2,39}$/;

function texto(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return Array.from(v).slice(0, max).join("");
}

function entero(v: unknown, min: number, max: number, defecto: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return defecto;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Un entero dentro del rango, o null. A diferencia de `entero`, NO recorta: un 9 no se vuelve un 6. */
function enteroEstricto(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) return null;
  return v;
}

function fechaOpcional(v: unknown): string | null {
  if (typeof v !== "string" || !FECHA.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v ? null : v;
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function configDelActivador(activador: string, crudo: unknown): ConfigActivador {
  const c = objeto(crudo);
  const def = definicionDeActivador(activador);
  const salida: ConfigActivador = {};
  for (const p of def?.parametros ?? []) {
    salida[p.campo] = entero(c[p.campo], p.min, p.max, p.defecto);
  }
  if (activador === "sello_registrado" && Array.isArray(c.sellos)) {
    const sellos = [...new Set(c.sellos.map((s) => enteroEstricto(s, 1, 1000)).filter((s): s is number => s !== null))]
      .sort((a, b) => a - b)
      .slice(0, 20);
    if (sellos.length > 0) salida.sellos = sellos;
  }
  return salida;
}

function horarioNormalizado(crudo: unknown): Horario {
  const h = objeto(crudo);
  const modo = h.modo === "hora_exacta" || h.modo === "ventana" ? h.modo : "inmediato";
  const hora = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 5) : undefined);
  const dias = Array.isArray(h.dias)
    ? [...new Set(h.dias.map((d) => enteroEstricto(d, 0, 6)).filter((d): d is number => d !== null))].sort((a, b) => a - b)
    : undefined;
  const salida: Horario = { modo };
  if (modo === "hora_exacta") salida.hora = hora(h.hora);
  if (modo === "ventana") {
    salida.desde = hora(h.desde);
    salida.hasta = hora(h.hasta);
    salida.siguiente_ventana = h.siguiente_ventana !== false;
  }
  if (modo !== "inmediato" && dias && dias.length > 0 && dias.length < 7) salida.dias = dias;
  return salida;
}

function condicionesNormalizadas(crudo: unknown): Condicion[] {
  if (!Array.isArray(crudo)) return [];
  const salida: Condicion[] = [];
  for (const item of crudo.slice(0, 12)) {
    const c = objeto(item);
    const campo = typeof c.campo === "string" ? c.campo : "";
    const op = typeof c.op === "string" ? c.op : "";
    let valor: Condicion["valor"];
    if (typeof c.valor === "boolean") valor = c.valor;
    else if (typeof c.valor === "number" && Number.isFinite(c.valor)) valor = Math.trunc(c.valor);
    else if (typeof c.valor === "string") valor = c.valor.trim().slice(0, 40);
    else continue;
    salida.push({ campo: campo as Condicion["campo"], op: op as Condicion["op"], valor });
  }
  return salida;
}

/** Reconstruye la entrada desde lo que mandó el navegador. Nunca lanza. */
export function normalizarEntrada(crudo: unknown): EntradaImpulso {
  const e = objeto(crudo);
  const activador = texto(e.activador, 40).trim().toLowerCase();
  const descripcion = limpiarTexto(texto(e.descripcion, 240), { unaLinea: true });
  const plantilla = typeof e.plantilla === "string" && ID_SIMPLE.test(e.plantilla) ? e.plantilla : null;
  return {
    nombre: limpiarTexto(texto(e.nombre, 80), { unaLinea: true }),
    descripcion: descripcion || null,
    activador,
    activador_config: configDelActivador(activador, e.activador_config),
    condiciones: condicionesNormalizadas(e.condiciones),
    canal: texto(e.canal, 20).trim().toLowerCase(),
    titulo: limpiarTexto(texto(e.titulo, 200), { unaLinea: true }),
    cuerpo: limpiarTexto(texto(e.cuerpo, 2000), { unaLinea: false }),
    retraso_minutos: entero(e.retraso_minutos, 0, 525_600, 0),
    horario: horarioNormalizado(e.horario),
    vigente_desde: fechaOpcional(e.vigente_desde),
    vigente_hasta: fechaOpcional(e.vigente_hasta),
    espera_minima_horas: entero(e.espera_minima_horas, 0, 8760, 0),
    plantilla,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  VALIDAR
// ═══════════════════════════════════════════════════════════════════

export function validarImpulso(e: EntradaImpulso, ctx: ContextoValidacion): ResultadoValidacion {
  const problemas: Problema[] = [];
  const avisos: string[] = [];
  const voz = ctx.voz ?? "bookea";
  const textos = textosDe(voz);
  const guardar = (campo: string, mensaje: string) => problemas.push({ campo, mensaje, bloquea: "guardar" });
  const activar = (campo: string, mensaje: string) => problemas.push({ campo, mensaje, bloquea: "activar" });

  // ── Identidad ──
  const nombreLargo = largo(e.nombre.trim());
  if (nombreLargo < 3) guardar("nombre", "Ponele un nombre de al menos 3 letras, para reconocerlo en la lista.");
  else if (nombreLargo > 80) guardar("nombre", "El nombre puede tener hasta 80 caracteres.");
  if (e.descripcion && largo(e.descripcion) > 240) guardar("descripcion", "La descripción puede tener hasta 240 caracteres.");

  // ── Activador ──
  const act = definicionDeActivadorEnVoz(e.activador, voz);
  if (!act) {
    guardar("activador", "Elegí qué dispara este impulso.");
  } else if (!act.disponible) {
    guardar("activador", act.noDisponible ?? "Ese activador todavía no está disponible.");
  } else {
    if (!activadorAplicaAlModo(act, ctx.modo)) {
      guardar("activador", `«${act.etiqueta}» no se puede usar en este tipo de tarjeta.`);
    }
    validarParametros(act, e, guardar);
    if (act.requiereRecompensa && !ctx.tieneRecompensa) {
      activar("activador", textos.sinRecompensa);
    }
  }

  // ── Canal ──
  const canal = definicionDeCanalEnVoz(e.canal, voz);
  if (!canal) {
    guardar("canal", "Elegí por dónde va a salir el mensaje.");
  } else if (!canal.disponible) {
    guardar("canal", canal.falta ?? "Ese canal todavía no está disponible.");
  } else if (canal.id === "correo" && ctx.esFoorkie) {
    guardar("canal", textos.correoDeFoorkie);
  }

  // Si este correo toma el relevo de uno de los correos automáticos que Bookea ya mandaba, se avisa.
  if (canal?.id === "correo" && !ctx.esFoorkie) {
    const reemplaza = (["bienvenida", "falta_uno", "premio"] as HitoDeCorreoAntiguo[]).some((h) =>
      impulsoReemplazaAlHito({ activador: e.activador, activador_config: e.activador_config, canal: e.canal, estado: "activo" }, h),
    );
    if (reemplaza) avisos.push(textos.reemplazaCorreo);
  }

  // ── Mensaje ──
  const titulo = e.titulo.trim();
  const cuerpo = e.cuerpo.trim();
  if (largo(titulo) < 1) guardar("titulo", "Escribí el título del mensaje.");
  else if (largo(titulo) > 60) guardar("titulo", "El título puede tener hasta 60 caracteres.");
  if (largo(cuerpo) < 3) guardar("cuerpo", "Escribí el mensaje (al menos 3 caracteres).");
  else if (largo(cuerpo) > 600) guardar("cuerpo", "El mensaje puede tener hasta 600 caracteres.");

  const plantilla = { modo: ctx.modo, tieneRecompensa: ctx.tieneRecompensa };
  for (const m of validarVariables(titulo, plantilla)) activar("titulo", m);
  for (const m of validarVariables(cuerpo, plantilla)) activar("cuerpo", m);

  if (canal?.disponible) {
    const ejemplo = contextoDeEjemplo(ctx.modo);
    const tituloMostrado = limpiarTexto(renderizar(titulo, ejemplo).texto, { unaLinea: true });
    const cuerpoMostrado = limpiarTexto(renderizar(cuerpo, ejemplo).texto, { unaLinea: canal.unaLinea });
    if (canal.tituloMax > 0 && largo(tituloMostrado) > canal.tituloMax) {
      activar("titulo", `En este canal el título puede tener hasta ${canal.tituloMax} caracteres (con tu ejemplo tiene ${largo(tituloMostrado)}).`);
    }
    if (canal.cuerpoMax > 0 && largo(cuerpoMostrado) > canal.cuerpoMax) {
      activar("cuerpo", `En este canal el mensaje puede tener hasta ${canal.cuerpoMax} caracteres (con tu ejemplo tiene ${largo(cuerpoMostrado)}).`);
    }
    if (canal.unaLinea && /\n/.test(cuerpo)) {
      avisos.push("En el Wallet el mensaje va en una sola línea: los saltos de línea se convierten en espacios.");
    }
  }
  const sinAlternativo = variablesSinAlternativo(`${titulo} ${cuerpo}`);
  if (sinAlternativo.length > 0) {
    avisos.push(
      `Si a un cliente le falta ${sinAlternativo.map((v) => `«${v}»`).join(", ")}, ese mensaje no se manda. ` +
        "Para que salga igual, escribí un alternativo: {{nombre_cliente|amigo}}.",
    );
  }

  // ── Cuándo ──
  if (!Number.isInteger(e.retraso_minutos) || e.retraso_minutos < 0 || e.retraso_minutos > 525_600) {
    guardar("retraso_minutos", "El retraso tiene que estar entre 0 minutos y 365 días.");
  }
  const errorHorario = validarHorario(e.horario);
  if (errorHorario) guardar("horario", errorHorario);
  if (e.vigente_desde && e.vigente_hasta && e.vigente_hasta < e.vigente_desde) {
    guardar("vigente_hasta", "La fecha de fin no puede ser anterior a la de inicio.");
  }
  if (e.vigente_hasta && e.vigente_hasta < ctx.hoy) {
    activar("vigente_hasta", "La campaña ya terminó: cambiá la fecha de fin para activarla.");
  }
  if (!Number.isInteger(e.espera_minima_horas) || e.espera_minima_horas < 0 || e.espera_minima_horas > 8760) {
    guardar("espera_minima_horas", "La espera mínima tiene que estar entre 0 horas y 1 año.");
  }

  // ── Condiciones ──
  if (e.condiciones.length > 12) guardar("condiciones", "Podés poner hasta 12 condiciones.");
  e.condiciones.forEach((c, i) => {
    const problema = validarCondicion(c, ctx.modo);
    if (problema) guardar(`condiciones.${i}`, problema);
  });

  return {
    problemas,
    avisos,
    puedeGuardar: !problemas.some((p) => p.bloquea === "guardar"),
    puedeActivar: problemas.length === 0,
  };
}

function validarParametros(act: DefinicionActivador, e: EntradaImpulso, guardar: (campo: string, mensaje: string) => void) {
  for (const p of act.parametros ?? []) {
    const v = e.activador_config[p.campo];
    if (typeof v !== "number" || !Number.isInteger(v) || v < p.min || v > p.max) {
      guardar(`activador_config.${p.campo}`, `«${p.etiqueta}» tiene que ser un número entre ${p.min} y ${p.max}.`);
    }
  }
  if (act.id === "sello_registrado" && e.activador_config.sellos) {
    const s = e.activador_config.sellos;
    if (!Array.isArray(s) || s.length > 20 || s.some((n) => !Number.isInteger(n) || n < 1 || n > 1000)) {
      guardar("activador_config.sellos", "Los sellos tienen que ser números enteros (hasta 20).");
    }
  }
}
