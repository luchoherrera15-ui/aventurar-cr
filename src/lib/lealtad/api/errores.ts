import { NextResponse } from "next/server";

/**
 * LOS ERRORES DE LA API — códigos estables, textos en español.
 *
 * El `codigo` es snake_case y no cambia nunca: es lo que un integrador
 * pone en un `switch`. El `mensaje` es para la persona que está leyendo
 * el log a las once de la noche, y puede mejorarse sin romper a nadie.
 *
 * ------------------------------------------------------------------
 * NO HAY CAMPO `ok`
 * ------------------------------------------------------------------
 * El estado HTTP carga el resultado. Un `200 {"ok": false}` obliga a
 * todo cliente a mirar dos cosas, y garantiza que alguna librería mire
 * solo una.
 *
 * ------------------------------------------------------------------
 * EL 401 Y EL 404 SON DELIBERADAMENTE MUDOS
 * ------------------------------------------------------------------
 * · `401 credencial` es idéntico para "esa llave no existe", "el
 *   secreto está mal", "está vencida" y "el negocio la revocó".
 *   Responder distinto convierte al endpoint en un oráculo para
 *   averiguar qué llaves existen (la lección de wallet/servicio.ts:52).
 * · `404 no_encontrado` es idéntico para "esa tarjeta no existe" y
 *   "esa tarjeta no es de su negocio". Si se distinguieran, la llave de
 *   la barbería A podría enumerar los miembros de la barbería B sin
 *   leerles un solo dato.
 *
 * El 403 de scope SÍ es específico: quien llega ahí ya probó ser quien
 * dice, y decirle "te falta el scope `acreditar`" le ahorra una tarde.
 */

export type CodigoError =
  | "credencial"
  | "scope_faltante"
  | "programa_inactivo"
  | "ip_no_autorizada"
  | "entrada_invalida"
  | "no_encontrado"
  | "conflicto"
  | "regla_del_programa"
  | "limite_excedido"
  | "degradado"
  | "metodo_no_permitido";

const ESTADOS: Record<CodigoError, number> = {
  credencial: 401,
  scope_faltante: 403,
  programa_inactivo: 403,
  ip_no_autorizada: 403,
  entrada_invalida: 400,
  no_encontrado: 404,
  conflicto: 409,
  regla_del_programa: 422,
  limite_excedido: 429,
  degradado: 503,
  metodo_no_permitido: 405,
};

/** El texto único del 401. No se personaliza: sería un oráculo. */
export const MENSAJE_CREDENCIAL =
  "Credencial inválida. Revisá la cabecera Authorization: Bearer blk_live_…";

/** El texto único del 404. Tampoco se personaliza, y por lo mismo. */
export const MENSAJE_NO_ENCONTRADO = "No se encontró esa tarjeta.";

/**
 * Las cabeceras que van en TODA respuesta de la API.
 *
 * · `Cache-Control: no-store` — nada de esto se guarda en un
 *   intermediario. Un saldo cacheado es un saldo equivocado, y un
 *   cuerpo cacheado en un CDN es un cuerpo que sobrevive a la
 *   revocación.
 * · SIN CORS, a propósito: no hay `Access-Control-Allow-Origin`. Un
 *   navegador nunca debe tener esta llave, y la documentación lo dice
 *   con todas las letras. Sin la cabecera, un `fetch` desde una página
 *   web falla — que es exactamente lo que tiene que pasar.
 */
export function cabecerasBase(requestId: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Bookea-Request-Id": requestId,
    "X-Content-Type-Options": "nosniff",
  };
}

export type OpcionesError = {
  /** Detalle SEGURO: nunca el cuerpo de la petición, nunca un dato de un tercero. */
  detalle?: string;
  campo?: string;
  cabeceras?: Record<string, string>;
};

export function errorApi(
  codigo: CodigoError,
  mensaje: string,
  requestId: string,
  opciones: OpcionesError = {},
): NextResponse {
  return NextResponse.json(
    {
      error: {
        codigo,
        mensaje,
        ...(opciones.campo ? { campo: opciones.campo } : {}),
        ...(opciones.detalle ? { detalle: opciones.detalle } : {}),
      },
      request_id: requestId,
    },
    {
      status: ESTADOS[codigo],
      headers: { ...cabecerasBase(requestId), ...(opciones.cabeceras ?? {}) },
    },
  );
}

/** Respuesta feliz, con las mismas cabeceras de siempre. */
export function okApi(
  cuerpo: unknown,
  requestId: string,
  estado = 200,
  cabeceras: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(cuerpo, {
    status: estado,
    headers: { ...cabecerasBase(requestId), ...cabeceras },
  });
}
