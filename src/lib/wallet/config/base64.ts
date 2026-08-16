/**
 * DECODIFICADOR DE BASE64 PARA CREDENCIALES — a mano, sin regex mágica
 * que "arregle" todo en silencio.
 *
 * La auditoría de Fase 0 (docs/wallet-v2/auditoria-inicial.md) no
 * encontró ningún bug de Base64 en producción — pero tampoco había
 * ninguna función que lo pudiera detectar si aparece. Esta existe para
 * que un `.env.local` mal pegado (un espacio de más, una comilla que
 * quedó pegada, un `\r` de Windows) se diagnostique con una frase
 * exacta en vez de un error críptico de `openssl` o de `node-forge`
 * tres capas más abajo.
 *
 * REGLA DE SEGURIDAD: ninguna función de este archivo devuelve ni
 * imprime el valor decodificado completo en un log. `decodificarBase64`
 * devuelve el Buffer para que el LLAMADOR lo use (para firmar, por
 * ejemplo) — pero el resultado de diagnóstico (`DiagnosticoBase64`)
 * solo lleva metadatos: longitud, tipo aparente, advertencias.
 */

export type AdvertenciaBase64 =
  | "espacios_o_saltos_de_linea"
  | "retorno_de_carro"
  | "comillas_envolventes"
  | "caracteres_inesperados"
  | "base64_url_safe"
  | "longitud_no_multiplo_de_4"
  | "posible_doble_codificacion"
  | "recodificacion_no_coincide";

export type DiagnosticoBase64 =
  | {
      ok: true;
      /** El valor decodificado — el llamador decide qué hacer con él. Nunca lo loguees entero. */
      decodificado: Buffer;
      /** Longitud del valor tal como vino en la variable de entorno. */
      longitudOriginal: number;
      /** Longitud tras recortar espacios/comillas/\r, antes de decodificar. */
      longitudNormalizada: number;
      /** Longitud del contenido ya decodificado, en bytes. */
      longitudDecodificada: number;
      tipoContenido: "PEM" | "JSON" | "desconocido";
      advertencias: AdvertenciaBase64[];
    }
  | {
      ok: false;
      motivo: string;
      advertencias: AdvertenciaBase64[];
    };

const CHARSET_ESTANDAR = /^[A-Za-z0-9+/]+={0,2}$/;
const CHARSET_URL_SAFE = /^[A-Za-z0-9_-]+={0,2}$/;

/**
 * Decodifica un valor de variable de entorno codificado en Base64,
 * detectando y reportando (sin corregir en silencio) los problemas de
 * formato más comunes al pegar un secreto en `.env.local` o en el
 * panel de un proveedor de hosting.
 *
 * OJO CON EL RELLENO: `=` y `==` al final son relleno Base64 VÁLIDO.
 * Esta función nunca los recorta antes de decodificar — solo los
 * cuenta para el diagnóstico de longitud.
 */
export function diagnosticarBase64(valorCrudo: string | undefined | null): DiagnosticoBase64 {
  const advertencias: AdvertenciaBase64[] = [];

  if (valorCrudo == null || valorCrudo === "") {
    return { ok: false, motivo: "la variable está vacía o no está definida", advertencias };
  }

  const longitudOriginal = valorCrudo.length;

  // 1) Comillas envolventes — quien pega un valor en algunos paneles de
  //    hosting a veces deja las comillas del ejemplo.
  let v = valorCrudo;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
    advertencias.push("comillas_envolventes");
  }

  // 2) Retornos de carro de Windows.
  if (v.includes("\r")) {
    v = v.replace(/\r/g, "");
    advertencias.push("retorno_de_carro");
  }

  // 3) Espacios y saltos de línea accidentales (un base64 real nunca
  //    los necesita: se pueden recortar sin ambigüedad).
  if (/\s/.test(v)) {
    v = v.replace(/\s+/g, "");
    advertencias.push("espacios_o_saltos_de_linea");
  }

  const longitudNormalizada = v.length;
  if (longitudNormalizada === 0) {
    return { ok: false, motivo: "después de limpiar espacios y comillas no queda contenido", advertencias };
  }

  // 4) Base64 URL-safe (RFC 4648 §5, usa `-`/`_` en vez de `+`/`/`) vs
  //    estándar. Se detecta el charset y se normaliza a estándar para
  //    decodificar — Buffer.from acepta ambos con encoding "base64url"
  //    / "base64", pero mezclar silenciosamente los dos formatos en un
  //    mismo valor es indicio real de corrupción, no algo a tolerar.
  const esUrlSafe = /[-_]/.test(v);
  const esEstandar = /[+/]/.test(v);
  if (esUrlSafe && esEstandar) {
    return {
      ok: false,
      motivo: "el valor mezcla caracteres de Base64 estándar (+ o /) con Base64 URL-safe (- o _) — no es ninguno de los dos formatos válidos",
      advertencias,
    };
  }
  const encoding: BufferEncoding = esUrlSafe ? "base64url" : "base64";
  if (esUrlSafe) advertencias.push("base64_url_safe");

  // 5) Caracteres fuera del charset (prefijo/sufijo pegado por error,
  //    texto de más). Se reporta la POSICIÓN, nunca el carácter ni el
  //    contenido alrededor.
  const charsetOk = esUrlSafe ? CHARSET_URL_SAFE : CHARSET_ESTANDAR;
  if (!charsetOk.test(v)) {
    const match = [...v].findIndex((c) => !new RegExp(`[${esUrlSafe ? "A-Za-z0-9_=-" : "A-Za-z0-9+/="}]`).test(c));
    advertencias.push("caracteres_inesperados");
    return {
      ok: false,
      motivo:
        match >= 0
          ? `carácter fuera del alfabeto Base64 en la posición ${match} (de ${longitudNormalizada})`
          : "el valor contiene caracteres fuera del alfabeto Base64",
      advertencias,
    };
  }

  // 6) Longitud múltiplo de 4 — indicio de truncamiento. Base64 estándar
  //    CON padding siempre lo es; URL-safe sin padding no tiene por qué
  //    serlo, así que esto es advertencia (no error) en ese caso.
  if (longitudNormalizada % 4 !== 0) {
    advertencias.push("longitud_no_multiplo_de_4");
    if (!esUrlSafe) {
      return {
        ok: false,
        motivo: `longitud ${longitudNormalizada} no es múltiplo de 4 — el valor parece truncado (falta padding o se cortó al copiar)`,
        advertencias,
      };
    }
  }

  let decodificado: Buffer;
  try {
    decodificado = Buffer.from(v, encoding);
  } catch {
    return { ok: false, motivo: "Buffer.from no pudo decodificar el valor", advertencias };
  }
  if (decodificado.length === 0) {
    return { ok: false, motivo: "la decodificación produjo contenido vacío", advertencias };
  }

  // 7) Re-codificación equivalente: Buffer.from en Node es TOLERANTE —
  //    ignora caracteres inválidos en vez de fallar. Si al volver a
  //    codificar el resultado no coincide con lo normalizado (salvo
  //    diferencias de padding), algo se perdió en la decodificación.
  const reencodado = decodificado.toString(encoding).replace(/=+$/, "");
  const normalizadoSinPadding = v.replace(/=+$/, "");
  if (reencodado !== normalizadoSinPadding) {
    advertencias.push("recodificacion_no_coincide");
  }

  const tipoContenido = detectarTipoContenido(decodificado);

  // 8) Doble codificación: si lo decodificado, en vez de parecer PEM o
  //    JSON, es EN SÍ MISMO una cadena que solo contiene caracteres de
  //    Base64 y de longitud razonable, es probable que el valor se haya
  //    codificado dos veces por error.
  if (tipoContenido === "desconocido") {
    const comoTexto = decodificado.toString("utf8");
    if (comoTexto.length > 16 && CHARSET_ESTANDAR.test(comoTexto.replace(/\s/g, ""))) {
      advertencias.push("posible_doble_codificacion");
    }
  }

  return {
    ok: true,
    decodificado,
    longitudOriginal,
    longitudNormalizada,
    longitudDecodificada: decodificado.length,
    tipoContenido,
    advertencias,
  };
}

/** ¿El contenido decodificado es un PEM, un JSON, o ninguno de los dos reconocibles? */
export function detectarTipoContenido(decodificado: Buffer): "PEM" | "JSON" | "desconocido" {
  const texto = decodificado.toString("utf8");
  if (/-----BEGIN [A-Z0-9 ]+-----/.test(texto)) return "PEM";
  try {
    const parsed: unknown = JSON.parse(texto);
    if (parsed !== null && typeof parsed === "object") return "JSON";
  } catch {
    // no es JSON
  }
  return "desconocido";
}

export type DiagnosticoPem =
  | { ok: true; tipo: string; bloques: number }
  | { ok: false; motivo: string };

/**
 * Valida la ESTRUCTURA de un PEM (encabezados, pares BEGIN/END, que no
 * esté vacío entre ellos) sin interpretar criptográficamente el
 * contenido — eso lo hace `apple.ts` con node-forge, que ya sabe leer
 * certificados y llaves de verdad.
 */
export function validarEstructuraPem(pem: string): DiagnosticoPem {
  const inicios = [...pem.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----/g)];
  const fines = [...pem.matchAll(/-----END ([A-Z0-9 ]+)-----/g)];

  if (inicios.length === 0) {
    return { ok: false, motivo: "no se encontró ningún encabezado -----BEGIN...-----" };
  }
  if (inicios.length !== fines.length) {
    return {
      ok: false,
      motivo: `${inicios.length} encabezado(s) BEGIN pero ${fines.length} encabezado(s) END — el PEM está incompleto o truncado`,
    };
  }
  for (let i = 0; i < inicios.length; i++) {
    if (inicios[i][1].trim() !== fines[i][1].trim()) {
      return {
        ok: false,
        motivo: `el bloque ${i + 1} abre como "${inicios[i][1].trim()}" pero cierra como "${fines[i][1].trim()}"`,
      };
    }
  }

  return { ok: true, tipo: inicios[0][1].trim(), bloques: inicios.length };
}

/**
 * Normaliza saltos de línea LITERALES (`\n` de dos caracteres, el
 * backslash seguido de la letra n — lo que queda si alguien pegó un PEM
 * con los saltos "escapados" a mano) a saltos de línea reales.
 *
 * A propósito NO toca nada si el valor YA tiene saltos de línea reales:
 * la regla explícita es normalizar "únicamente cuando corresponda", no
 * reescribir cualquier cadena que contenga la subsecuencia `\n`. Un PEM
 * bien decodificado desde Base64 no debería necesitar esto nunca — esta
 * función existe para el caso de un PEM pegado directo (sin Base64) con
 * los saltos escapados por el editor de variables de algún proveedor.
 */
export function normalizarSaltosDeLineaLiterales(valor: string): string {
  const tieneSaltosReales = valor.includes("\n");
  const tieneSaltosLiterales = valor.includes("\\n");
  if (tieneSaltosReales || !tieneSaltosLiterales) return valor;
  return valor.replace(/\\n/g, "\n");
}
