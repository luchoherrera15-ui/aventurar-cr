/**
 * QUÉ SIGNIFICA CADA ERROR QUE DEVUELVE LA BASE, Y QUÉ SE HACE CON ÉL.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO MERECE UN ARCHIVO Y UNA PRUEBA
 * ------------------------------------------------------------------
 * El panel de lealtad guarda contra una base que puede ir una
 * migración atrás —las pega el dueño a mano— así que cada `update`
 * tiene un reintento «sin las columnas nuevas»: el negocio pierde el
 * campo nuevo hasta que la migración corra, pero no pierde el poder
 * cambiar un color.
 *
 * Ese reintento se decidía preguntando si el mensaje de error
 * MENCIONABA el nombre de la columna. Y desde la 0132/0145 los nombres
 * de las columnas también aparecen en los nombres de los CHECK que las
 * cuidan (`programa_lealtad_pase_sello_icono_check`). O sea que un
 * valor RECHAZADO por un CHECK se leía como «esa columna no existe»,
 * se reintentaba sin ella, el reintento funcionaba… y la pantalla
 * contestaba «Guardado» después de tirar a la basura la banda, el
 * icono y los textos que el dueño acababa de elegir.
 *
 * La diferencia no está en el texto: está en el CÓDIGO.
 *
 *   · `PGRST204` / `42703` — la columna no existe. Reintentar sin ella
 *     es lo correcto: es lo único que la base sabe guardar hoy.
 *   · `23514` — la columna existe y el valor viola su CHECK. Acá
 *     reintentar es MENTIR: hay que fallar, y hay que decir qué pasó
 *     en palabras que el dueño pueda obedecer.
 *
 * Nada de esto toca Supabase: es clasificación pura sobre el objeto de
 * error, para que se pueda probar sin base y para que las dos reglas
 * —degradar y traducir— vivan en un solo lugar.
 */

/**
 * Lo poquito que hace falta de un `PostgrestError`.
 *
 * No se importa el tipo de `@supabase/supabase-js` a propósito: esto
 * también clasifica errores de un RPC o de un cliente viejo que no
 * mandaba `code`, y un tipo prestado obligaría a inventar campos.
 */
export type ErrorBase = {
  message: string;
  code?: string | null;
};

/** PostgREST: «no encontré esa columna en el schema cache». */
const PGRST_SIN_COLUMNA = "PGRST204";
/** Postgres: `undefined_column`. */
const PG_SIN_COLUMNA = "42703";
/** Postgres: `check_violation`. */
const PG_CHECK = "23514";

/**
 * ¿La base está diciendo que ALGUNA de estas columnas no existe?
 *
 * Se piden las columnas del reintento y no solo el error: un
 * `PGRST204` por una columna que nadie iba a degradar no debería
 * disparar un reintento que guarda de menos.
 */
export function esColumnaAusente(error: ErrorBase, columnas: readonly string[]): boolean {
  const codigo = (error.code ?? "").trim();

  // Un CHECK violado NUNCA es una columna ausente, mencione lo que
  // mencione su nombre. Es la línea que arregla el bug.
  if (codigo === PG_CHECK) return false;

  const porCodigo = codigo === PGRST_SIN_COLUMNA || codigo === PG_SIN_COLUMNA;
  // Sin `code` (clientes viejos, errores envueltos a mano) queda la
  // frase — que es lo único que había antes. Se acepta solo la forma
  // exacta con la que PostgREST y Postgres anuncian una columna que
  // falta, no cualquier mensaje que nombre la columna.
  const porTexto =
    !codigo &&
    (/could not find the .* column/i.test(error.message) ||
      /column .* does not exist/i.test(error.message));

  if (!porCodigo && !porTexto) return false;
  return columnas.some((c) => error.message.includes(c));
}

/** El nombre del CHECK que se violó, o null si el error es otra cosa. */
export function nombreDelCheck(error: ErrorBase): string | null {
  if ((error.code ?? "").trim() !== PG_CHECK) return null;
  const m = /violates check constraint "([^"]+)"/i.exec(error.message);
  return m ? m[1] : null;
}

/**
 * Qué le decimos al dueño cuando la base rechaza un valor.
 *
 * El mensaje de Postgres —«new row for relation "programa_lealtad"
 * violates check constraint "programa_lealtad_dias_check"»— no está
 * escrito para nadie. Cada CHECK que este panel puede violar tiene acá
 * su frase, en palabras del negocio y diciendo qué corregir.
 */
const MENSAJE_DE_CHECK: Record<string, string> = {
  programa_lealtad_modo_check: "Ese tipo de tarjeta no existe.",
  programa_lealtad_estado_check: "Ese estado de la tarjeta no existe.",
  programa_lealtad_beneficio_check:
    "La configuración del beneficio no tiene la forma que espera la base.",
  programa_lealtad_pase_sello_icono_check:
    "Ese icono de sello no existe. Elegí uno de la lista o dejá «Mi logo».",
  programa_lealtad_codigo_formato_check: "Ese formato de código no existe.",
  programa_lealtad_texto_reverso_check:
    "El texto del reverso no puede pasar de 500 caracteres.",
  programa_lealtad_vigencia_check:
    "La fecha de vencimiento no puede ser anterior a la de inicio.",
  programa_lealtad_topes_check:
    "Los topes de canje están fuera de rango: por cliente van de 1 a 100.000 y en total de 1 a 10.000.000.",
  programa_lealtad_dias_check: "Esos días de la semana no existen (0 = domingo, 6 = sábado).",
  programa_lealtad_reglas_check:
    "Alguna regla quedó fuera de rango: revisá la compra mínima y los topes.",
  recompensas_detalle_check:
    "Esa recompensa tiene un valor fuera de rango: el descuento porcentual va de 1 a 100 y el fijo de ₡1 a ₡10.000.000.",
};

export function mensajeDeCheck(nombre: string): string | null {
  return MENSAJE_DE_CHECK[nombre] ?? null;
}

/**
 * ¿Falta la migración entera? (No una columna: la TABLA.)
 *
 * Se conserva el criterio de siempre, con el nombre de la tabla
 * adentro para no confundir un «no existe» de otra parte del sistema.
 */
export function faltaLaTabla(mensaje: string): boolean {
  if (!/programa_lealtad|recompensas/.test(mensaje)) return false;
  return (
    mensaje.includes("does not exist") ||
    mensaje.includes("schema cache") ||
    mensaje.includes("Could not find")
  );
}

/**
 * El error, en español y accionable.
 *
 * El orden importa: primero el CHECK —que es un valor que el dueño
 * puede corregir— y recién después el «faltan migraciones», porque el
 * texto de un CHECK también nombra la tabla y caería en `faltaLaTabla`
 * dando un consejo que no arregla nada.
 */
export function traducirError(error: ErrorBase, accion: string): string {
  const check = nombreDelCheck(error);
  if (check) {
    return (
      mensajeDeCheck(check) ??
      `No se pudo ${accion}: la base rechazó uno de los valores (${check}).`
    );
  }
  if (faltaLaTabla(error.message)) {
    return "Faltan migraciones de lealtad en Supabase (0060/0121/0122).";
  }
  return `No se pudo ${accion}: ${error.message}`;
}
