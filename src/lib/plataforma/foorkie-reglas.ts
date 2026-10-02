import type { SupabaseClient } from "@supabase/supabase-js";
import { leerVinculo, type Lectura, type Vinculo } from "@/lib/plataforma/foorkie-caja";
import { localDeFoorkieDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";
import { canjeLibreDe, TOPE_CANJE_LIBRE } from "@/lib/lealtad/canje-libre";
import { puedeEditarse } from "@/lib/lealtad/editable";
import { esColumnaAusente, traducirError } from "@/lib/lealtad/errores-base";
import { reglaDeSellos } from "@/lib/lealtad/mostrador";
import { estadoDelPrograma } from "@/lib/lealtad/reglas";
import {
  configPorDefecto,
  leerBeneficio,
  tipoDe,
  validarBeneficio,
  type ConfigBeneficio,
  type ConfigCashback,
  type ConfigSellos,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import {
  DIAS_DE_AVISO,
  MESES_MAX,
  MESES_MIN,
  mesesGuardables,
  reglaDeFila,
  relojDeVencimiento,
} from "@/lib/lealtad/vencimiento-sellos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS REGLAS DE UNA TARJETA DE FOORKIE — lo que el motor ya sabe hacer
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (2 oct 2026, desde Foorkie): «colocar más
 * configuraciones en la tarjeta, tipo poder setear de cuándo a cuándo
 * vencen los puntos». Foorkie las muestra en su panel («Reglas de la
 * tarjeta», debajo del diseño) y las cambia por `programa/reglas` y
 * `programa/reglas/guardar`. El diseño (colores, logo, banda, % o meta)
 * sigue por `programa/guardar`: son dos puertas a propósito, para que
 * cambiar una regla nunca pise un color ni al revés.
 *
 * ── SOLO LO QUE EL MOTOR HACE CUMPLIR ───────────────────────────────
 *   Cashback · la compra mínima para sumar (`compra_minima`, la lee
 *              `acreditar_lealtad`) · el tope de cashback por compra
 *              (`max_por_transaccion`, lo mismo) · lo mínimo que se usa de
 *              una vez (`beneficio.minimoCanje`, lo hace cumplir
 *              `canjear_monto_lealtad`, 0253) · y el canje libre, que en
 *              una tarjeta de Foorkie va siempre prendido.
 *   Sellos   · los sellos de regalo al unirse (`inicial`: los da el alta de
 *              Foorkie, 0253) · si arranca otra vuelta al completarla
 *              (`repetible`: lo hace cumplir el `limite_por_cliente` del
 *              premio de la meta, que acá se sincroniza) · cómo se gana un
 *              sello (`sellosPor` / `montoPorSello`: `sellosPorCompra`).
 *   Todas    · el vencimiento por inactividad (`sellos_vencen_meses` y su
 *   (menos     reloj, 0180; desde la 0253 también cashback y puntos en las
 *   gift card) tarjetas de Foorkie).
 *
 * En el cashback, la compra mínima y el tope se guardan en DOS lados a la
 * vez —el `beneficio` y las columnas del motor— y se LEEN de las columnas:
 * lo que Foorkie muestra es lo que de verdad se aplica.
 *
 * Las validaciones son las MISMAS funciones del panel de Bookea
 * (`validarBeneficio`, `mesesGuardables`, `relojDeVencimiento`,
 * `puedeEditarse`) más los topes de los CHECK de la base (`max_por_
 * transaccion` 1..100.000), para que el error salga en palabras y no en
 * el inglés de Postgres.
 *
 * ── SOLO TARJETAS DE FOORKIE ────────────────────────────────────────
 * Con la marca `lealtad_por_foorkie` (`localDeFoorkieDeLaTarjeta`, la
 * misma guardia de los mensajes y las ubicaciones). Pura Matcha contesta
 * `no_es_de_foorkie` y no se lee ni se toca nada.
 */

type Db = SupabaseClient;

/** El techo del CHECK de la 0125 para `max_por_transaccion`. */
export const TOPE_POR_COMPRA_MAXIMO = 100_000;
/** El techo del CHECK de la 0125 para `compra_minima`. */
export const COMPRA_MINIMA_MAXIMA = 10_000_000;
/** Lo que valida `validarBeneficio` para el monto por sello. */
export const MONTO_POR_SELLO_MINIMO = 100;
export const MONTO_POR_SELLO_MAXIMO = 10_000_000;

export type TipoConReglas = "cashback" | "sellos" | "puntos";

export type ReglasCashback = {
  /** El % de vuelta: se cambia en el diseño, acá solo se muestra. */
  porcentaje: number;
  /** Compra mínima para sumar, en colones. null = sin mínimo. */
  compraMinima: number | null;
  /** Lo más que una compra le puede dar de cashback, en colones. null = sin tope. */
  topePorCompra: number | null;
  /** Lo mínimo que se usa de una vez, en colones. null = desde ₡1. */
  minimoCanje: number | null;
  /** El cliente usa el monto que quiera (0253). En las tarjetas de Foorkie, siempre. */
  canjeLibre: boolean;
};

export type ReglasSellos = {
  /** La meta: se cambia en el diseño, acá solo se muestra. */
  requeridos: number;
  /** Sellos de regalo al unirse (0 = ninguno). Siempre menos que la meta. */
  inicial: number;
  /** Al completarla, arranca otra vuelta. false = una sola vuelta. */
  repetible: boolean;
  /** Cómo se gana un sello: uno por compra, o uno por cada `montoPorSello`. */
  sellosPor: "compra" | "monto";
  montoPorSello: number | null;
};

export type ReglasVencimiento = {
  /** null = no vence nunca. */
  meses: number | null;
  /** ISO de cuándo se encendió. null = apagado. */
  desde: string | null;
  /** Cuántos días antes le llega el aviso al cliente. */
  diasDeAviso: number;
};

export type ReglasDeLaTarjeta = {
  tipo: TipoConReglas;
  cashback: ReglasCashback | null;
  sellos: ReglasSellos | null;
  vencimiento: ReglasVencimiento;
};

/** Lo que cambia. Lo que no viene se queda como estaba. */
export type CambiosDeReglas = {
  cashback?: { compraMinima?: number | null; topePorCompra?: number | null; minimoCanje?: number | null };
  sellos?: { inicial?: number; repetible?: boolean; sellosPor?: "compra" | "monto"; montoPorSello?: number | null };
  vencimiento?: { meses: number | null };
};

/** Un rechazo con su código, el motivo listo para mostrar y el status (la forma de `FalloDelPanel`). */
export type FalloDeReglas = { ok: false; codigo: string; motivo: string; status: number };

export const MOTIVO_NO_ES_DE_FOORKIE =
  "Esta tarjeta no tiene la marca de Foorkie Lealtad (lealtad_por_foorkie): sus reglas no se cambian desde Foorkie.";

const esTipoConReglas = (t: TipoTarjeta): t is TipoConReglas => t === "cashback" || t === "sellos" || t === "puntos";

// ════════════════════════════════════════════════════════════════════
//  1. Lo que manda Foorkie
// ════════════════════════════════════════════════════════════════════

/** Un entero en [min, max], o null si viene null. `undefined` = no vino. */
function enteroOpcional(
  v: unknown,
  min: number,
  max: number,
  motivo: string,
): { ok: true; valor: number | null | undefined } | { ok: false; motivo: string } {
  if (v === undefined) return { ok: true, valor: undefined };
  if (v === null) return { ok: true, valor: null };
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) return { ok: false, motivo };
  return { ok: true, valor: v };
}

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * La forma de `reglas` en `programa/reglas/guardar`:
 *
 *   { cashback?:    { compraMinima?, topePorCompra?, minimoCanje? },
 *     sellos?:      { inicial?, repetible?, sellosPor?, montoPorSello? },
 *     vencimiento?: { meses } }
 *
 * Montos en colones enteros (null = sin mínimo / sin tope); `meses` de 1 a
 * 60 o null (= nunca). Una compra mínima o un mínimo de canje de 0 o 1 es
 * lo mismo que no tenerlo. Que se puedan cumplir JUNTAS (los sellos de
 * regalo contra la meta, el monto por sello contra la regla) se mira
 * después, con la tarjeta enfrente.
 */
export function leerCambiosDeReglas(v: unknown): Lectura<CambiosDeReglas> {
  const r = objeto(v);
  if (!r) return { ok: false, motivo: "Mandá las reglas que cambian (cashback, sellos o vencimiento)." };
  for (const clave of Object.keys(r)) {
    if (clave !== "cashback" && clave !== "sellos" && clave !== "vencimiento") {
      return { ok: false, motivo: `«${clave}» no es una regla: son cashback, sellos y vencimiento.` };
    }
  }
  const cambios: CambiosDeReglas = {};

  if (r.cashback !== undefined) {
    const c = objeto(r.cashback);
    if (!c) return { ok: false, motivo: "Las reglas del cashback vienen como un objeto." };
    const minima = enteroOpcional(c.compraMinima, 0, COMPRA_MINIMA_MAXIMA, "La compra mínima va en colones enteros, de ₡0 a ₡10.000.000.");
    if (!minima.ok) return minima;
    const tope = enteroOpcional(
      c.topePorCompra,
      1,
      TOPE_POR_COMPRA_MAXIMO,
      "El tope de cashback por compra va en colones enteros, de ₡1 a ₡100.000.",
    );
    if (!tope.ok) return tope;
    const minimo = enteroOpcional(c.minimoCanje, 0, TOPE_CANJE_LIBRE, "El mínimo para usar el saldo va en colones enteros, de ₡1 a ₡10.000.000.");
    if (!minimo.ok) return minimo;
    const cashback: NonNullable<CambiosDeReglas["cashback"]> = {};
    if (minima.valor !== undefined) cashback.compraMinima = minima.valor && minima.valor > 0 ? minima.valor : null;
    if (tope.valor !== undefined) cashback.topePorCompra = tope.valor;
    if (minimo.valor !== undefined) cashback.minimoCanje = minimo.valor && minimo.valor > 1 ? minimo.valor : null;
    if (Object.keys(cashback).length > 0) cambios.cashback = cashback;
  }

  if (r.sellos !== undefined) {
    const s = objeto(r.sellos);
    if (!s) return { ok: false, motivo: "Las reglas de los sellos vienen como un objeto." };
    const sellos: NonNullable<CambiosDeReglas["sellos"]> = {};
    if (s.inicial !== undefined) {
      if (typeof s.inicial !== "number" || !Number.isInteger(s.inicial) || s.inicial < 0 || s.inicial > 14) {
        return { ok: false, motivo: "Los sellos de regalo van de 0 a 14 (siempre menos que la meta)." };
      }
      sellos.inicial = s.inicial;
    }
    if (s.repetible !== undefined) {
      if (typeof s.repetible !== "boolean") return { ok: false, motivo: "«repetible» tiene que ser true o false." };
      sellos.repetible = s.repetible;
    }
    if (s.sellosPor !== undefined) {
      if (s.sellosPor !== "compra" && s.sellosPor !== "monto") {
        return { ok: false, motivo: "Un sello se gana por compra o por monto." };
      }
      sellos.sellosPor = s.sellosPor;
    }
    const monto = enteroOpcional(
      s.montoPorSello,
      MONTO_POR_SELLO_MINIMO,
      MONTO_POR_SELLO_MAXIMO,
      "El monto por sello va en colones enteros, de ₡100 a ₡10.000.000.",
    );
    if (!monto.ok) return monto;
    if (monto.valor !== undefined) sellos.montoPorSello = monto.valor;
    if (Object.keys(sellos).length > 0) cambios.sellos = sellos;
  }

  if (r.vencimiento !== undefined) {
    const v2 = objeto(r.vencimiento);
    if (!v2 || !("meses" in v2)) return { ok: false, motivo: "El vencimiento trae «meses» (de 1 a 60, o null para que no venza)." };
    const meses = enteroOpcional(v2.meses, MESES_MIN, MESES_MAX, `El vencimiento va de ${MESES_MIN} a ${MESES_MAX} meses, o nunca.`);
    if (!meses.ok) return meses;
    cambios.vencimiento = { meses: meses.valor ?? null };
  }

  if (Object.keys(cambios).length === 0) return { ok: false, motivo: "No vino ninguna regla para cambiar." };
  return { ok: true, valor: cambios };
}

// ════════════════════════════════════════════════════════════════════
//  2. Lo guardado
// ════════════════════════════════════════════════════════════════════

/** El premio que marca la meta (el activo más barato), con su límite por cliente. */
export type PremioDeLaMeta = { id: string; nombre: string; costo: number; limitePorCliente: number | null };

/** Un entero positivo de una columna del motor, o null. */
function enteroPositivo(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

/** El beneficio de cashback de la fila, o uno armado desde las columnas si la fila es de antes de la 0135. */
function cashbackDeFila(fila: Record<string, unknown>): { tipo: "cashback" } & ConfigCashback {
  const b = leerBeneficio(fila.beneficio, "cashback");
  if (b?.tipo === "cashback") return b;
  const porColon = Number(fila.puntos_por_colon);
  const porcentaje = Number.isFinite(porColon) && porColon > 0 ? Math.round(porColon * 10_000) / 100 : 5;
  return { ...(configPorDefecto("cashback") as { tipo: "cashback" } & ConfigCashback), porcentaje };
}

/** El beneficio de sellos de la fila; sin él (fila vieja), el de fábrica con la meta del premio. null si no hay de dónde sacar la meta. */
function sellosDeFila(fila: Record<string, unknown>, meta: PremioDeLaMeta | null): ({ tipo: "sellos" } & ConfigSellos) | null {
  const b = leerBeneficio(fila.beneficio, "sellos");
  if (b?.tipo === "sellos") return b;
  if (!meta) return null;
  return {
    ...(configPorDefecto("sellos") as { tipo: "sellos" } & ConfigSellos),
    requeridos: meta.costo,
    recompensa: meta.nombre,
  };
}

/**
 * Las reglas como las ve Foorkie, leídas de la fila (`select *`) y del
 * premio de la meta. Pura. En el cashback, la compra mínima y el tope
 * salen de las COLUMNAS que lee el motor; el canje libre y su mínimo, del
 * beneficio. En los sellos, «repetible» sale del premio de la meta (su
 * límite por cliente es lo que lo hace cumplir); sin premio, del beneficio.
 */
export function reglasDeFila(fila: Record<string, unknown>, meta: PremioDeLaMeta | null): ReglasDeLaTarjeta | null {
  const tipo = tipoDe(typeof fila.modo === "string" ? fila.modo : null);
  if (!esTipoConReglas(tipo)) return null;
  const regla = reglaDeFila(fila, { saldoTambien: true });
  const vencimiento: ReglasVencimiento = { meses: regla.meses, desde: regla.meses === null ? null : regla.desde, diasDeAviso: DIAS_DE_AVISO };

  if (tipo === "cashback") {
    const b = cashbackDeFila(fila);
    const libre = canjeLibreDe(b);
    return {
      tipo,
      cashback: {
        porcentaje: b.porcentaje,
        compraMinima: enteroPositivo(fila.compra_minima),
        topePorCompra: enteroPositivo(fila.max_por_transaccion),
        minimoCanje: libre?.minimo ?? null,
        canjeLibre: libre !== null,
      },
      sellos: null,
      vencimiento,
    };
  }
  if (tipo === "sellos") {
    const b = sellosDeFila(fila, meta);
    const r = reglaDeSellos(b);
    return {
      tipo,
      cashback: null,
      sellos: {
        requeridos: meta?.costo ?? b?.requeridos ?? 10,
        inicial: b && Number.isInteger(b.inicial) && b.inicial > 0 ? b.inicial : 0,
        repetible: meta ? meta.limitePorCliente !== 1 : (b?.repetible ?? true),
        sellosPor: r.por,
        montoPorSello: r.por === "monto" ? r.montoPorSello : null,
      },
      vencimiento,
    };
  }
  return { tipo, cashback: null, sellos: null, vencimiento };
}

// ════════════════════════════════════════════════════════════════════
//  3. Lo que se escribe
// ════════════════════════════════════════════════════════════════════

export type PlanDeReglas = {
  /** Las columnas de `programa_lealtad` que cambian (vacío = nada). */
  columnas: Record<string, unknown>;
  /** El límite por cliente que tiene que tener el premio de la meta (sellos), si cambia. */
  premio: { id: string; limitePorCliente: number | null } | null;
};

/**
 * Lo que hay que escribir para dejar la tarjeta con los cambios: SOLO lo
 * que cambia (cada cambio le llega a todos los pases). Pura: recibe la
 * fila, el premio de la meta, los cambios y la hora.
 */
export function planDeReglas(d: {
  fila: Record<string, unknown>;
  meta: PremioDeLaMeta | null;
  cambios: CambiosDeReglas;
  ahora: Date;
}): { ok: true; plan: PlanDeReglas } | { ok: false; motivo: string } {
  const { fila, meta, cambios, ahora } = d;
  const tipo = tipoDe(typeof fila.modo === "string" ? fila.modo : null);
  if (!esTipoConReglas(tipo)) return { ok: false, motivo: "Esta tarjeta no tiene reglas que se cambien desde Foorkie." };
  if (cambios.cashback && tipo !== "cashback") return { ok: false, motivo: "Esta tarjeta no es de cashback: esas reglas no le aplican." };
  if (cambios.sellos && tipo !== "sellos") return { ok: false, motivo: "Esta tarjeta no es de sellos: esas reglas no le aplican." };

  const columnas: Record<string, unknown> = {};
  let premio: PlanDeReglas["premio"] = null;

  if (tipo === "cashback") {
    const actual = cashbackDeFila(fila);
    const libre = canjeLibreDe(actual);
    const c = cambios.cashback ?? {};
    const compraMinima = c.compraMinima !== undefined ? c.compraMinima : enteroPositivo(fila.compra_minima);
    const topePorCompra = c.topePorCompra !== undefined ? c.topePorCompra : enteroPositivo(fila.max_por_transaccion);
    const minimoCanje = c.minimoCanje !== undefined ? c.minimoCanje : (libre?.minimo ?? null);
    // En una tarjeta de Foorkie el canje es siempre libre: guardar las
    // reglas lo deja prendido aunque la 0253 no lo hubiera marcado.
    const nuevo: ConfigBeneficio = {
      ...actual,
      compraMinima: compraMinima ?? 0,
      topePorCompra,
      minimoCanje,
      canjeLibre: true,
    };
    const invalido = validarBeneficio(nuevo);
    if (invalido) return { ok: false, motivo: invalido };
    const cambiaBeneficio =
      actual.compraMinima !== nuevo.compraMinima ||
      actual.topePorCompra !== nuevo.topePorCompra ||
      (actual.minimoCanje ?? null) !== nuevo.minimoCanje ||
      actual.canjeLibre !== true ||
      leerBeneficio(fila.beneficio, "cashback") === null;
    if (cambiaBeneficio) columnas.beneficio = nuevo;
    // Las columnas que lee `acreditar_lealtad`: lo que el motor de verdad aplica.
    if (enteroPositivo(fila.compra_minima) !== compraMinima) columnas.compra_minima = compraMinima;
    if (enteroPositivo(fila.max_por_transaccion) !== topePorCompra) columnas.max_por_transaccion = topePorCompra;
  }

  if (tipo === "sellos" && cambios.sellos) {
    const actual = sellosDeFila(fila, meta);
    if (!actual) return { ok: false, motivo: "Primero armá el premio de la tarjeta: sin meta no hay reglas de sellos." };
    const s = cambios.sellos;
    const sellosPor = s.sellosPor ?? reglaDeSellos(actual).por;
    const montoPorSello =
      sellosPor === "monto" ? (s.montoPorSello !== undefined ? s.montoPorSello : (actual.montoPorSello ?? null)) : null;
    if (sellosPor === "monto" && montoPorSello === null) return { ok: false, motivo: "Contá cada cuántos colones se gana un sello." };
    const repetible = s.repetible ?? (meta ? meta.limitePorCliente !== 1 : actual.repetible);
    const nuevo: ConfigBeneficio = {
      ...actual,
      // La meta vive en el premio (el pase la saca de ahí): se confirma con él.
      requeridos: meta?.costo ?? actual.requeridos,
      inicial: s.inicial ?? (Number.isInteger(actual.inicial) && actual.inicial > 0 ? actual.inicial : 0),
      repetible,
      sellosPor,
      montoPorSello,
    };
    const invalido = validarBeneficio(nuevo);
    if (invalido) return { ok: false, motivo: invalido };
    const cambiaBeneficio =
      leerBeneficio(fila.beneficio, "sellos") === null ||
      actual.inicial !== nuevo.inicial ||
      actual.repetible !== nuevo.repetible ||
      reglaDeSellos(actual).por !== sellosPor ||
      (actual.montoPorSello ?? null) !== montoPorSello;
    if (cambiaBeneficio) columnas.beneficio = nuevo;
    // «Una sola vuelta» lo hace cumplir el premio de la meta: canjearlo una vez.
    const limite = repetible ? null : 1;
    if (meta && meta.limitePorCliente !== limite) premio = { id: meta.id, limitePorCliente: limite };
  }

  if (cambios.vencimiento) {
    const previa = reglaDeFila(fila, { saldoTambien: true });
    const meses = mesesGuardables(tipo, cambios.vencimiento.meses, { saldoTambien: true });
    const desde = relojDeVencimiento({ meses, previa, ahora });
    if (previa.meses !== meses) columnas.sellos_vencen_meses = meses;
    if ((previa.meses === null ? null : previa.desde) !== desde) columnas.sellos_vencen_desde = desde;
  }

  return { ok: true, plan: { columnas, premio } };
}

// ════════════════════════════════════════════════════════════════════
//  4. Las rutas
// ════════════════════════════════════════════════════════════════════

/** `programa/reglas`: solo la tarjeta. */
export function leerPedidoReglas(d: Record<string, unknown>): Lectura<Vinculo> {
  return leerVinculo(d);
}

export type PedidoGuardarReglas = Vinculo & { cambios: CambiosDeReglas };

/** `programa/reglas/guardar`: la tarjeta y `reglas`, con lo que cambia. */
export function leerPedidoGuardarReglas(d: Record<string, unknown>): Lectura<PedidoGuardarReglas> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const cambios = leerCambiosDeReglas(d.reglas);
  if (!cambios.ok) return cambios;
  return { ok: true, valor: { ...v.valor, cambios: cambios.valor } };
}

/** La fila de la tarjeta y su premio de la meta, si existe y es de Foorkie. */
async function tarjetaDeFoorkie(
  db: Db,
  p: Vinculo,
): Promise<{ ok: true; fila: Record<string, unknown>; meta: PremioDeLaMeta | null } | FalloDeReglas> {
  const [{ data, error }, { data: premio }] = await Promise.all([
    // `select *`: las columnas de la 0136/0180 pueden no existir todavía.
    db.from("programa_lealtad").select("*").eq("id", p.programaId).eq("rancho_id", p.ranchoId).maybeSingle(),
    db
      .from("recompensas")
      .select("id, nombre, costo_puntos, limite_por_cliente")
      .eq("programa_id", p.programaId)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) return { ok: false, codigo: "error_base", motivo: "No pudimos leer la tarjeta. Probá de nuevo.", status: 500 };
  if (!data) return { ok: false, codigo: "sin_programa", motivo: "Esa tarjeta no existe.", status: 404 };
  const local = await localDeFoorkieDeLaTarjeta(db, { programaId: p.programaId, ranchoId: p.ranchoId });
  if (!local) return { ok: false, codigo: "no_es_de_foorkie", motivo: MOTIVO_NO_ES_DE_FOORKIE, status: 403 };
  const f = (premio ?? null) as Record<string, unknown> | null;
  const costo = Number(f?.costo_puntos);
  const meta =
    f && typeof f.id === "string" && Number.isFinite(costo) && costo > 0
      ? {
          id: f.id,
          nombre: typeof f.nombre === "string" ? f.nombre : "",
          costo: Math.round(costo),
          limitePorCliente: enteroPositivo(f.limite_por_cliente),
        }
      : null;
  return { ok: true, fila: data as Record<string, unknown>, meta };
}

export type ReglasLeidas = { ok: true; reglas: ReglasDeLaTarjeta };

const SIN_REGLAS: FalloDeReglas = {
  ok: false,
  codigo: "tipo_sin_reglas",
  motivo: "Esta tarjeta no tiene reglas que se cambien desde Foorkie (son de cashback, sellos y puntos).",
  status: 409,
};

/** `programa/reglas`: las reglas de la tarjeta, como se aplican hoy. */
export async function reglasDeLaTarjeta(db: Db, p: Vinculo): Promise<ReglasLeidas | FalloDeReglas> {
  const t = await tarjetaDeFoorkie(db, p);
  if (!t.ok) return t;
  const reglas = reglasDeFila(t.fila, t.meta);
  return reglas ? { ok: true, reglas } : SIN_REGLAS;
}

/** `cambio`: si se escribió algo (la ruta avisa entonces a los pases instalados). */
export type ReglasGuardadas = ReglasLeidas & { cambio: boolean };

const MOTIVO_SIN_MIGRACION =
  "Todavía no se pueden guardar estas reglas: falta una migración de lealtad en la base (0180).";

/**
 * `programa/reglas/guardar`: aplica los cambios y deja las reglas como se
 * pidieron. Sin cambios de verdad no escribe nada. El candado del panel de
 * Bookea vale igual: una tarjeta archivada no se edita.
 */
export async function guardarReglasDeLaTarjeta(
  db: Db,
  p: PedidoGuardarReglas,
  ahora: Date = new Date(),
): Promise<ReglasGuardadas | FalloDeReglas> {
  const t = await tarjetaDeFoorkie(db, p);
  if (!t.ok) return t;
  const tipo = tipoDe(typeof t.fila.modo === "string" ? t.fila.modo : null);
  if (!esTipoConReglas(tipo)) return SIN_REGLAS;

  const { count: miembros } = await db
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("programa_id", p.programaId);
  const editable = puedeEditarse({
    miembros: miembros ?? 0,
    estado: estadoDelPrograma({ estado: typeof t.fila.estado === "string" ? t.fila.estado : null, activo: t.fila.activo === true }),
    tipo,
  });
  if (!editable.puede) return { ok: false, codigo: "no_editable", motivo: editable.motivo, status: 409 };

  const r = planDeReglas({ fila: t.fila, meta: t.meta, cambios: p.cambios, ahora });
  if (!r.ok) return { ok: false, codigo: "datos", motivo: r.motivo, status: 400 };
  const { columnas, premio } = r.plan;

  if (Object.keys(columnas).length > 0) {
    const { error } = await db.from("programa_lealtad").update(columnas).eq("id", p.programaId).eq("rancho_id", p.ranchoId);
    if (error) {
      if (esColumnaAusente(error, ["sellos_vencen_meses", "sellos_vencen_desde", "beneficio", "compra_minima", "max_por_transaccion"])) {
        return { ok: false, codigo: "sin_migracion", motivo: MOTIVO_SIN_MIGRACION, status: 503 };
      }
      return { ok: false, codigo: "rechazado", motivo: traducirError(error, "guardar las reglas"), status: 400 };
    }
  }
  if (premio) {
    const { error } = await db
      .from("recompensas")
      .update({ limite_por_cliente: premio.limitePorCliente })
      .eq("id", premio.id)
      .eq("programa_id", p.programaId);
    if (error) return { ok: false, codigo: "rechazado", motivo: traducirError(error, "guardar si la tarjeta se repite"), status: 400 };
  }

  const cambio = Object.keys(columnas).length > 0 || premio !== null;
  const meta = premio && t.meta ? { ...t.meta, limitePorCliente: premio.limitePorCliente } : t.meta;
  const reglas = reglasDeFila({ ...t.fila, ...columnas }, meta);
  return reglas ? { ok: true, reglas, cambio } : SIN_REGLAS;
}
