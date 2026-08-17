/**
 * EL AISLAMIENTO ENTRE NEGOCIOS — la única barrera que hay.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTE ARCHIVO EXISTE, Y POR QUÉ SU TEST SE ESCRIBIÓ PRIMERO
 * ------------------------------------------------------------------
 * `acreditar_lealtad` (0125:300-410) NO comprueba a qué negocio
 * pertenece el miembro. Resuelve `miembros → programa_lealtad`, valida
 * estado, vigencia, compra mínima y topes — y nunca compara contra un
 * `rancho_id`. El grant de la propia migración lo dice explícito
 * (0125:601-606): «el acceso al negocio los comprueba el servidor ANTES
 * de invocar».
 *
 * Cuando quien invoca es el panel, eso es cierto: la sesión del dueño
 * ya pasó por `gestiona_rancho`. Cuando quien invoca es una API que
 * recibe un identificador de afuera, esa frase es una BOMBA: sin esta
 * comprobación, la llave de la barbería A le suma sellos —o le lee el
 * saldo— a un miembro de la barbería B con solo tener su identificador.
 *
 * O sea: **el aislamiento multi-negocio de esta API vive entero en la
 * capa HTTP, y empieza acá.** No es una validación más de la lista. Es
 * LA validación.
 *
 * Lógica pura para poder probarla sin base: si esta función se rompe,
 * el test falla en dos milisegundos en vez de fallar en producción con
 * los sellos de otro negocio.
 */

export type AlcanceLlave = {
  /** El negocio al que la autorización le abrió la puerta. */
  ranchoId: string;
  /** Y la ÚNICA tarjeta de ese negocio que la llave puede tocar. */
  programaId: string;
};

export type OrigenDelMiembro = {
  /** El programa al que pertenece el miembro que llegó por el identificador. */
  programaId: string;
  /** Y el negocio de ese programa. */
  ranchoId: string;
};

/**
 * ¿Este miembro es alcanzable por esta llave?
 *
 * Se comprueban LAS DOS cosas, no una:
 *
 * · el PROGRAMA, porque desde la 0134 un negocio puede tener varias
 *   tarjetas y la llave del club de cortes no tiene por qué tocar la
 *   gift card;
 * · el NEGOCIO, porque el programa podría haber cambiado de dueño, o
 *   porque un día alguien podría dejar de pasar el programa correcto y
 *   la segunda comparación seguiría atajando el caso grave.
 *
 * Cualquier valor vacío o nulo es NO. Nunca "en la duda, pasá": la
 * duda acá se paga con los datos de un tercero.
 */
export function miembroAlcanzable(
  alcance: AlcanceLlave | null | undefined,
  origen: OrigenDelMiembro | null | undefined,
): boolean {
  if (!alcance || !origen) return false;
  if (!alcance.ranchoId || !alcance.programaId) return false;
  if (!origen.ranchoId || !origen.programaId) return false;
  return alcance.programaId === origen.programaId && alcance.ranchoId === origen.ranchoId;
}

/**
 * ¿Tiene la llave este permiso?
 *
 * Los scopes llegan de la base como `text[]`. Un array vacío, nulo o
 * con cualquier cosa adentro es NO — la lista blanca de verdad vive en
 * el `check` de `autorizaciones_api` (0176), y esto es la segunda
 * puerta del mismo pasillo.
 */
export function tieneScope(scopes: readonly string[] | null | undefined, pedido: string): boolean {
  if (!Array.isArray(scopes) || !pedido) return false;
  return scopes.includes(pedido);
}

/**
 * ¿Viene de una IP declarada?
 *
 * Lista vacía o nula = el integrador no declaró IPs y no se filtra por
 * eso (es opcional, sube la nota en la cola de admisión). Lista con
 * valores y una IP que no está = NO, aunque la credencial sea perfecta.
 *
 * La comparación es exacta y en texto: acá no se resuelven rangos CIDR
 * a mano. Un integrador que necesite un bloque declara sus salidas una
 * por una, que es lo que un POS tiene de verdad.
 */
export function ipPermitida(
  permitidas: readonly string[] | null | undefined,
  ip: string | null,
): boolean {
  if (!Array.isArray(permitidas) || permitidas.length === 0) return true;
  if (!ip) return false;
  return permitidas.some((p) => p.trim() === ip.trim());
}
