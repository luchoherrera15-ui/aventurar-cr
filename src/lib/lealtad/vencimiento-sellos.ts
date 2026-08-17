import { fechaISOEnZona } from "@/lib/fechas";
import { tipoDe } from "./tipos-tarjeta";

/**
 * CUÁNDO SE LE VENCEN LOS SELLOS A UN CLIENTE (0180).
 *
 * Todo lo de este archivo es PURO: recibe fechas y devuelve fechas. No
 * lee la base, no lee el reloj y no manda correos. Eso está a
 * propósito — la pregunta «¿a quién le toca vencer hoy?» decide que
 * alguien pierda siete sellos, y una función que se prueba de verdad
 * es lo único que separa esa decisión de un reclamo en el mostrador.
 *
 * El barrido que la usa vive en `vencer-sellos.ts`.
 *
 * ------------------------------------------------------------------
 * EL RELOJ ES DE CADA CLIENTE, NO DEL CALENDARIO
 * ------------------------------------------------------------------
 * No hay una fecha en la que «vence la promoción»: eso ya existe y es
 * otra cosa (`vigente_hasta`, 0136, que vence la TARJETA entera del
 * negocio). Acá cada persona tiene su propio plazo, contado desde su
 * último movimiento. El que vuelve, lo renueva sin enterarse.
 *
 * ------------------------------------------------------------------
 * Y NO ARRANCA ANTES DE QUE LA REGLA EXISTA
 * ------------------------------------------------------------------
 * `desde` es cuándo el dueño encendió la regla. El corte sale de
 *
 *     max(último movimiento, desde) + meses
 *
 * o sea que encender «3 meses» un martes no le vacía la tarjeta el
 * miércoles a quien no viene hace medio año: a esa persona le quedan
 * los tres meses completos, y en el medio le llega el aviso. Quitarle
 * los sellos de golpe a alguien por un cambio de configuración que él
 * no hizo es justo lo que este proyecto ya decidió no hacer en otros
 * lados.
 *
 * ------------------------------------------------------------------
 * TODO EN LA ZONA DEL NEGOCIO
 * ------------------------------------------------------------------
 * «Se venció» se calcula en la hora del local (`ranchos.zona_horaria`,
 * 0062/0170), no en UTC. El servidor corre seis horas adelantado de
 * Costa Rica: con UTC, un sello dado a las 7 de la noche contaría como
 * del día siguiente y el corte se adelantaría un día entero. Las
 * fechas se manejan como texto ISO («2026-08-17») por la misma razón
 * que `programas.ts`: construir un `Date` desde una fecha suelta la
 * interpreta como medianoche UTC y el día se corre solo.
 */

/** Los topes que también fija el CHECK de la 0180. */
export const MESES_MIN = 1;
export const MESES_MAX = 60;

/**
 * Cuántos días antes del corte se manda el ÚNICO aviso.
 *
 * Catorce y no tres: el aviso solo sirve si queda tiempo de volver al
 * local, y para la mayoría de los negocios «dos semanas» cubre dos
 * fines de semana. Tampoco cuarenta y cinco — un correo que avisa de
 * algo que pasa dentro de mes y medio se archiva y no se vuelve a
 * mirar.
 */
export const DIAS_DE_AVISO = 14;

/** La regla de una tarjeta, leída de su fila. */
export type ReglaSellos = {
  /** null = los sellos no vencen nunca (el caso de casi todas). */
  meses: number | null;
  /** ISO de cuándo se encendió. null = no hay regla, o es anterior. */
  desde: string | null;
};

/** Ninguna regla: lo que devuelve todo lo que no es una tarjeta de sellos. */
export const SIN_REGLA: ReglaSellos = { meses: null, desde: null };

/**
 * La fila de `programa_lealtad` → la regla.
 *
 * Toma `Record<string, unknown>` y no un tipo cerrado por lo mismo que
 * `tarjetaDesdeFila`: la 0180 la pega el dueño a mano, así que hasta
 * que corra la fila llega SIN estas columnas. Leer de más no rompe;
 * pedirlas por nombre en el `select` sí.
 *
 * El filtro por tipo vive acá y no en cada llamador: es la línea que
 * garantiza que un cashback o una gift card no pierdan saldo nunca,
 * aunque alguien haya escrito la columna a mano en esa fila.
 */
export function reglaDeFila(fila: Record<string, unknown>): ReglaSellos {
  if (tipoDe(typeof fila.modo === "string" ? fila.modo : null) !== "sellos") return SIN_REGLA;

  const meses = fila.sellos_vencen_meses;
  if (typeof meses !== "number" || !Number.isInteger(meses) || meses < MESES_MIN) return SIN_REGLA;

  const desde = fila.sellos_vencen_desde;
  return {
    meses: Math.min(meses, MESES_MAX),
    desde: typeof desde === "string" && desde.trim() ? desde : null,
  };
}

/**
 * QUÉ SE PUEDE GUARDAR en `sellos_vencen_meses`, mirando el tipo.
 *
 * La usan el creador y el editor, los dos, para que no haya dos
 * criterios: en cualquier tipo que no sea `sellos` la respuesta es
 * null, y eso no es una precaución de formulario — es lo que impide
 * que una gift card termine con una regla de vencimiento adentro
 * porque alguien cambió el tipo después de configurarla.
 *
 * El CHECK de la base vuelve a exigir el rango. Esto lo recorta antes
 * para que un dedo que se resbala no devuelva un error de Postgres
 * escrito en inglés.
 */
export function mesesGuardables(
  tipo: string | null | undefined,
  valor: number | null | undefined,
): number | null {
  if (tipoDe(tipo) !== "sellos") return null;
  if (typeof valor !== "number" || !Number.isInteger(valor)) return null;
  if (valor < MESES_MIN) return null;
  return Math.min(valor, MESES_MAX);
}

/**
 * CUÁNDO ARRANCA EL RELOJ DE LA REGLA — la pieza que evita que
 * encenderla le vacíe la tarjeta a media clientela en el acto.
 *
 * El corte de cada cliente sale de `max(su último movimiento, desde) +
 * meses`, así que esta fecha es lo único que separa «de ahora en
 * adelante, si dejás de venir, perdés» de «todo el que no vino en los
 * últimos seis meses pierde esta madrugada, sin un solo aviso».
 *
 *   · apagada           → null (no hay reloj);
 *   · recién encendida  → AHORA, así todos tienen el plazo completo;
 *   · ya estaba puesta  → lo que ya tenía, intacto. Bajar de 12 a 6
 *     meses no puede reiniciar el reloj de todo el mundo, ni tampoco
 *     arrancarlo de nuevo: el que ya venía en camino de vencer sigue
 *     donde estaba, con su aviso ya calculado.
 *
 * Vive acá y no en la acción que guarda porque un módulo `"use server"`
 * solo puede exportar funciones asíncronas — un helper puro exportado
 * de ahí rompe el build (y en este repo ya lo rompió dos veces, en la
 * frontera de al lado).
 */
export function relojDeVencimiento({
  meses,
  previa,
  ahora,
}: {
  meses: number | null;
  /** La regla que la tarjeta tenía ANTES de este guardado. */
  previa: ReglaSellos;
  ahora: Date;
}): string | null {
  if (meses === null) return null;
  if (previa.meses !== null && previa.desde) return previa.desde;
  return ahora.toISOString();
}

/**
 * Suma meses a una fecha ISO, sin pasar por zonas horarias.
 *
 * El 31 de enero más un mes NO es el 3 de marzo. `Date` lo desborda
 * solo (febrero no tiene 31) y el cliente perdería sus sellos tres
 * días antes de lo prometido. Acá se recorta al último día del mes
 * destino, que es lo que cualquiera entiende por «un mes después».
 */
export function sumarMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const totalMeses = (y * 12 + (m - 1)) + meses;
  const anio = Math.floor(totalMeses / 12);
  const mes = totalMeses % 12; // 0..11
  // Día 0 del mes siguiente = último día de ESTE mes.
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimo);
  return `${String(anio).padStart(4, "0")}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Días enteros entre dos fechas ISO. Negativo si `b` ya pasó. */
export function diasEntreISO(a: string, b: string): number {
  const dia = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return dia(b) - dia(a);
}

/**
 * LA FECHA DE CORTE de un cliente, o null si no le vence nada.
 *
 * `ultimoMovimiento` es el instante del último movimiento de su ledger
 * (el último sello, o el propio reinicio anterior). Sin movimientos no
 * hay nada que vencer y no hay reloj que arrancar.
 */
export function fechaDeCorte({
  regla,
  ultimoMovimiento,
  zona,
}: {
  regla: ReglaSellos;
  /** ISO del último movimiento del ledger. null = nunca se movió. */
  ultimoMovimiento: string | null;
  /** `ranchos.zona_horaria`. Vacío o inválido cae a Costa Rica. */
  zona: string | null | undefined;
}): string | null {
  if (regla.meses === null) return null;
  if (!ultimoMovimiento) return null;

  const desdeElSello = fechaISOEnZona(new Date(ultimoMovimiento), zona);
  // El reloj no puede arrancar antes de que la regla exista: ver el
  // encabezado. Si `desde` no está (una fila anterior a la 0180, o
  // escrita a mano), manda el último sello y nada más.
  const desdeLaRegla = regla.desde ? fechaISOEnZona(new Date(regla.desde), zona) : null;
  const base = desdeLaRegla && desdeLaRegla > desdeElSello ? desdeLaRegla : desdeElSello;

  return sumarMesesISO(base, regla.meses);
}

/** Qué le corresponde HOY a un cliente con esta fecha de corte. */
export type Veredicto =
  /** No hay regla, o no tiene sellos que perder. */
  | "sin-regla"
  /** Falta bastante: no se hace nada, ni siquiera avisar. */
  | "vigente"
  /** Entra en la ventana del aviso: se le manda EL correo (uno solo). */
  | "por-vencer"
  /** Se cumplió el plazo: se reinicia. */
  | "vencido";

/**
 * La decisión, en una función que cabe en la cabeza.
 *
 * `hoy` y `venceEl` son fechas ISO YA expresadas en la zona del
 * negocio — se reciben en vez de calcularse acá para que esto se pueda
 * probar contra un martes de 2027 sin tocar el reloj del proceso.
 *
 * Vence EL DÍA del corte, no el siguiente: si el corte es el 17 y hoy
 * es 17, ya pasaron los meses completos. El cliente tuvo el plazo
 * entero y dos semanas de aviso encima.
 */
export function veredicto({
  venceEl,
  hoy,
  saldo,
  diasDeAviso = DIAS_DE_AVISO,
}: {
  venceEl: string | null;
  hoy: string;
  /** Sellos que tiene hoy. Sin saldo no hay nada que vencer ni que avisar. */
  saldo: number;
  diasDeAviso?: number;
}): Veredicto {
  if (!venceEl || saldo <= 0) return "sin-regla";
  const faltan = diasEntreISO(hoy, venceEl);
  if (faltan <= 0) return "vencido";
  return faltan <= diasDeAviso ? "por-vencer" : "vigente";
}

/**
 * LA LLAVE DE IDEMPOTENCIA del reinicio.
 *
 * Va a `transacciones_puntos.referencia`, donde el índice único
 * `(miembro_id, referencia)` de la 0060 la convierte en una garantía
 * de la BASE y no en un `if` del servidor: dos corridas del cron el
 * mismo día calculan la misma llave —porque sale de la fecha de corte,
 * que no depende de cuándo se corrió— y la segunda choca contra el
 * índice sin restar nada.
 *
 * Lleva la fecha de corte y no la de hoy a propósito. Con la de hoy,
 * una corrida atrasada (el cron no corrió el martes y corrió el
 * miércoles) generaría una llave distinta para el MISMO vencimiento, y
 * el cliente perdería sus sellos dos veces — quedando en negativo.
 */
export function referenciaDeCorte(venceEl: string): string {
  return `venc:${venceEl}`;
}

/** El motivo que va escrito en el movimiento del ledger, en palabras. */
export function motivoDeCorte(meses: number): string {
  return meses === 1
    ? "Sellos reiniciados: pasó 1 mes sin visitas"
    : `Sellos reiniciados: pasaron ${meses} meses sin visitas`;
}

/**
 * Cómo se le explica la regla al DUEÑO, en la pantalla donde la
 * enciende. Una línea, con un ejemplo concreto: la diferencia entre
 * «se entiende» y «hay que leer un manual» es que el negocio pueda ver
 * qué le pasa a un cliente que deja de venir, sin abrir otra pestaña.
 */
export function explicarRegla(meses: number | null): string {
  if (meses === null) {
    return "Los sellos no vencen: quien junta 3 y vuelve dentro de dos años, sigue con 3.";
  }
  const cuanto = meses === 1 ? "1 mes" : `${meses} meses`;
  return (
    `Un cliente con 3 sellos que no vuelva en ${cuanto} arranca de cero. ` +
    `Cada visita le renueva el plazo, y le avisamos ${DIAS_DE_AVISO} días antes ` +
    `—en la tarjeta del teléfono y por correo— para que vuelva a tiempo.`
  );
}
