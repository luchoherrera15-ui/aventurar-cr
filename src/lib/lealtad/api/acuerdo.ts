import { createHash } from "node:crypto";

/**
 * EL ACUERDO DE TRATAMIENTO DE DATOS.
 *
 * Se guarda su VERSIÓN y su HASH junto a la solicitud, no un booleano
 * «aceptó». La diferencia importa el día que alguien pregunte qué
 * aceptó exactamente: un `true` no prueba nada si el texto cambió
 * después.
 *
 * ------------------------------------------------------------------
 * QUIÉN ES QUIÉN BAJO LA LEY 8968
 * ------------------------------------------------------------------
 * El NEGOCIO es el responsable de la base de datos: sus clientes le
 * dieron los datos a él. Bookea es ENCARGADO del tratamiento, y el
 * integrador es un SUB-ENCARGADO al que el negocio —no Bookea— le abre
 * la puerta. Por eso hacen falta las dos firmas: Bookea admite al
 * integrador una vez, y cada negocio lo autoriza en su panel.
 *
 * (Esta caracterización es la recomendada y está pendiente de
 * confirmación legal; cambia el texto del contrato, no el código.)
 *
 * El texto vive en código y no en la base a propósito: así queda en el
 * historial de git, versionado, revisable en un diff, y su hash se
 * calcula solo.
 */

/**
 * v1.1 (agosto 2026): la API se acotó a un solo caso de uso —que la
 * caja le sume un sello al cliente y el pase del teléfono se actualice
 * solo— y con eso desaparecieron el catálogo de recompensas y sus dos
 * endpoints. El punto 2 del acuerdo prometía «el catálogo del
 * programa»: se corrigió, porque un acuerdo que describe una API que ya
 * no existe no describe nada. Nadie había firmado la 1.0 todavía (las
 * migraciones 0176/0177/0178 siguen sin pegarse), así que no hay
 * consentimientos viejos atados al texto anterior.
 */
export const ACUERDO_VERSION = "1.1";

export const ACUERDO_TEXTO = `ACUERDO DE TRATAMIENTO DE DATOS — API DE LEALTAD DE BOOKEA (v1.1)

1. QUIÉN ES QUIÉN
   El negocio que autoriza el acceso es el RESPONSABLE de los datos de
   sus clientes. Bookea es ENCARGADO del tratamiento. El desarrollador
   que firma este acuerdo es SUB-ENCARGADO y trata los datos únicamente
   por cuenta del negocio que lo autorizó, para la finalidad declarada
   en su solicitud, y para ninguna otra.

2. QUÉ ENTREGA LA API, Y QUÉ NO
   La API no entrega nombre completo, teléfono, correo, cédula,
   dirección, notas ni etiquetas de ningún cliente, con ningún permiso.
   Tampoco entrega listados de clientes ni permite buscarlos por ningún
   dato personal. Lo que entrega es: el saldo y la meta de una tarjeta
   que se le presente, y un seudónimo por autorización ("ref") que solo
   tiene sentido dentro de esa autorización. Lo que permite hacer es
   sumar sellos o puntos según las reglas que el negocio configuró.

3. LO QUE EL DESARROLLADOR SE COMPROMETE A HACER
   a) Guardar la llave únicamente del lado del servidor. La llave no va
      en una aplicación móvil, en un navegador, en un repositorio ni en
      un archivo de configuración compartido.
   b) No intentar reidentificar a las personas detrás de un "ref", ni
      cruzarlo con otras fuentes con ese fin.
   c) No guardar el "serial" de las tarjetas presentadas.
   d) Avisar a Bookea y al negocio, al correo de seguridad declarado,
      dentro de las 72 horas de detectado cualquier acceso indebido,
      pérdida o filtración.
   e) Borrar los datos derivados de la API cuando el negocio revoque la
      autorización, y confirmarlo por escrito si se le pide.
   f) Someterse a la suspensión inmediata del acceso si Bookea detecta
      un patrón de uso anómalo, sin perjuicio de reclamar después.

4. LO QUE BOOKEA SE COMPROMETE A HACER
   a) Registrar cada llamada, sin guardar la llave, el cuerpo de la
      petición ni datos personales, y conservar ese registro a
      disposición del negocio.
   b) Revocar el acceso en la petición siguiente cuando el negocio lo
      pida, sin demoras de caché.
   c) Avisar al negocio ante cualquier anomalía detectada.

5. VIGENCIA
   Este acuerdo rige mientras exista al menos una autorización activa,
   y sus obligaciones de confidencialidad y borrado sobreviven a su
   terminación.`;

/** El hash del texto exacto que la persona aceptó. */
export function hashDelAcuerdo(texto: string = ACUERDO_TEXTO): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/**
 * LOS DOS PERMISOS QUE EXISTEN, con su explicación en una línea.
 *
 * Eran tres. `catalogo` («Ver el programa y sus recompensas») se fue
 * junto con los endpoints que servía —`GET /programa` y
 * `GET /recompensas`— cuando la API se acotó a su único caso de uso:
 * que la caja le sume un sello al cliente y el pase del teléfono se
 * actualice solo. Las reglas del programa y el catálogo de premios no
 * hacen falta para eso, y un permiso que no protege nada es un permiso
 * que le miente al dueño en la pantalla de autorización.
 *
 * Estos DOS textos son literalmente lo que el dueño lee antes de decir
 * que sí, así que son el contrato de lo que puede salir por la API. Si
 * una respuesta va a traer algo que estas dos líneas no nombran, se
 * cambia primero la línea Y se vuelve a pedir autorización: cambiar la
 * pantalla no re-pregunta a los negocios que ya dijeron que sí.
 */
export const SCOPES_ENTREGA_1 = [
  {
    id: "saldo",
    nombre: "Consultar la tarjeta que le presenten",
    detalle: "Saldo, meta y dos letras del nombre. Solo con el código de la tarjeta a la vista.",
  },
  {
    id: "acreditar",
    nombre: "Dar sellos o puntos al cobrar",
    detalle: "Suma según las reglas del programa. Nunca decide cuántos puntos vale una compra.",
  },
] as const;

export type ScopeEntrega1 = (typeof SCOPES_ENTREGA_1)[number]["id"];

/** Solo estos dos. La base tiene el mismo `check`, y ahí es donde manda. */
export function esScopeValido(valor: string): valor is ScopeEntrega1 {
  return SCOPES_ENTREGA_1.some((s) => s.id === valor);
}

export const SISTEMAS = [
  { id: "pos", nombre: "Punto de venta / caja" },
  { id: "totem", nombre: "Tótem o kiosco de autoservicio" },
  { id: "crm", nombre: "CRM o sistema de clientes" },
  { id: "ecommerce", nombre: "Tienda en línea" },
  { id: "otro", nombre: "Otro" },
] as const;

export function esSistemaValido(valor: string): boolean {
  return SISTEMAS.some((s) => s.id === valor);
}
