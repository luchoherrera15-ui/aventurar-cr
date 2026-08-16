import forge from "node-forge";
import { diagnosticarBase64, validarEstructuraPem } from "./base64";
import { firmarJwt, type CredencialesGoogle } from "../google";

/**
 * VALIDACIÓN PROFUNDA DE CREDENCIALES DE GOOGLE WALLET.
 *
 * La auditoría de Fase 0 encontró que HOY no existe ningún indicador de
 * Google en el panel (a diferencia de Apple, que al menos tiene uno,
 * aunque incompleto). Esta es la pieza que un futuro indicador —y
 * `wallet:doctor`— pueden compartir.
 *
 * REGLA DE SEGURIDAD: nada de lo que devuelve este archivo incluye la
 * llave privada ni el JSON completo de la cuenta de servicio — solo
 * campos públicos (issuer, client_email, project_id) y metadatos.
 */

export type ResultadoVariableGoogle = {
  nombre: "GOOGLE_WALLET_ISSUER_ID" | "GOOGLE_WALLET_SA_KEY_B64";
  presente: boolean;
  formatoOk: boolean;
  motivoError: string | null;
  advertencias: string[];
};

export type ResultadoGoogleOffline = {
  estado: "ok" | "incompleto" | "error_formato";
  variables: ResultadoVariableGoogle[];
  cuentaDeServicio: {
    projectId: string | null;
    clientEmail: string | null;
    clientEmailPareceValido: boolean;
    privateKeyIdPresente: boolean;
    privateKeyEsPemValido: boolean;
    tokenUri: string | null;
  } | null;
  accionesHumanas: string[];
};

export type ResultadoGoogleRemoto = {
  /** ¿Se pudo obtener un access_token vía OAuth JWT-bearer? */
  autenticacion: { ok: boolean; status: number | null; motivo: string | null };
  /**
   * ¿La cuenta de servicio está autorizada como Developer del Issuer?
   * Se infiere de si una llamada de LECTURA (listar clases del issuer)
   * devuelve 200/404-de-lista-vacía (autorizado) vs 403 (no autorizado).
   * Best-effort — Google no expone un endpoint dedicado a "¿esta cuenta
   * de servicio es developer de este issuer?".
   */
  autorizacionIssuer: { ok: boolean | "no_verificable"; status: number | null; motivo: string | null };
  accionesHumanas: string[];
};

function pareceEmailDeServicio(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(email);
}

/**
 * Chequeo BARATO (sin decodificar Base64 ni parsear JSON) de que las 2
 * variables de Google están presentes — el equivalente de
 * `hayCredencialesApple` para que el panel pueda mostrar un indicador
 * de Google que hoy no existe (hallazgo de la auditoría, sección 6).
 */
export function hayCredencialesGoogle(env: Record<string, string | undefined> = process.env): boolean {
  return !!(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SA_KEY_B64);
}

/**
 * Validación SIN red: formato de las 2 variables + estructura del JSON
 * de la cuenta de servicio. Seguro de correr en cualquier entorno.
 */
export function validarGoogleOffline(env: Record<string, string | undefined> = process.env): ResultadoGoogleOffline {
  const accionesHumanas: string[] = [];
  const variables: ResultadoVariableGoogle[] = [];

  const issuerId = env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId) {
    variables.push({ nombre: "GOOGLE_WALLET_ISSUER_ID", presente: false, formatoOk: false, motivoError: "no está definida", advertencias: [] });
    accionesHumanas.push("Definir GOOGLE_WALLET_ISSUER_ID (falta por completo).");
  } else {
    const limpio = issuerId.trim();
    const formatoOk = /^\d+$/.test(limpio);
    variables.push({
      nombre: "GOOGLE_WALLET_ISSUER_ID",
      presente: true,
      formatoOk,
      motivoError: formatoOk ? null : "el Issuer ID de Google Wallet es siempre numérico — este valor no lo es",
      advertencias: limpio !== issuerId ? ["espacios_o_saltos_de_linea"] : [],
    });
    if (!formatoOk) accionesHumanas.push("Revisar GOOGLE_WALLET_ISSUER_ID: debería ser solo dígitos (lo asigna Google al crear el Issuer).");
  }

  const saB64 = env.GOOGLE_WALLET_SA_KEY_B64;
  if (!saB64) {
    variables.push({ nombre: "GOOGLE_WALLET_SA_KEY_B64", presente: false, formatoOk: false, motivoError: "no está definida", advertencias: [] });
    accionesHumanas.push("Definir GOOGLE_WALLET_SA_KEY_B64 (falta por completo).");
    return { estado: "incompleto", variables, cuentaDeServicio: null, accionesHumanas };
  }

  const diag = diagnosticarBase64(saB64);
  if (!diag.ok) {
    variables.push({ nombre: "GOOGLE_WALLET_SA_KEY_B64", presente: true, formatoOk: false, motivoError: diag.motivo, advertencias: diag.advertencias });
    accionesHumanas.push(`Revisar el formato de GOOGLE_WALLET_SA_KEY_B64: ${diag.motivo}`);
    return { estado: "error_formato", variables, cuentaDeServicio: null, accionesHumanas };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(diag.decodificado.toString("utf8")) as Record<string, unknown>;
  } catch {
    variables.push({
      nombre: "GOOGLE_WALLET_SA_KEY_B64",
      presente: true,
      formatoOk: false,
      motivoError: "decodifica Base64 correctamente, pero el contenido no es JSON válido",
      advertencias: diag.advertencias,
    });
    accionesHumanas.push("GOOGLE_WALLET_SA_KEY_B64 debe ser el JSON completo de la cuenta de servicio, codificado en Base64 — el contenido decodificado no parseó como JSON.");
    return { estado: "error_formato", variables, cuentaDeServicio: null, accionesHumanas };
  }

  const projectId = typeof json.project_id === "string" ? json.project_id : null;
  const clientEmail = typeof json.client_email === "string" ? json.client_email : null;
  const privateKey = typeof json.private_key === "string" ? json.private_key : null;
  const privateKeyId = typeof json.private_key_id === "string" ? json.private_key_id : null;
  const tokenUri = typeof json.token_uri === "string" ? json.token_uri : null;
  const tipo = typeof json.type === "string" ? json.type : null;

  const faltantes: string[] = [];
  if (tipo !== "service_account") faltantes.push('"type" no es "service_account"');
  if (!projectId) faltantes.push('falta "project_id"');
  if (!clientEmail) faltantes.push('falta "client_email"');
  if (!privateKey) faltantes.push('falta "private_key"');

  let privateKeyEsPemValido = false;
  if (privateKey) {
    const pem = validarEstructuraPem(privateKey);
    privateKeyEsPemValido = pem.ok;
    if (!pem.ok) faltantes.push(`"private_key" no tiene forma de PEM válido: ${pem.motivo}`);
    else {
      try {
        forge.pki.privateKeyFromPem(privateKey);
      } catch (e) {
        privateKeyEsPemValido = false;
        faltantes.push(`"private_key" tiene forma de PEM pero node-forge no pudo parsearla: ${(e as Error).message}`);
      }
    }
  }

  const clientEmailPareceValido = clientEmail ? pareceEmailDeServicio(clientEmail) : false;
  if (clientEmail && !clientEmailPareceValido) {
    faltantes.push('"client_email" no tiene la forma esperada (...@...iam.gserviceaccount.com)');
  }

  const formatoOk = faltantes.length === 0;
  variables.push({
    nombre: "GOOGLE_WALLET_SA_KEY_B64",
    presente: true,
    formatoOk,
    motivoError: formatoOk ? null : faltantes.join("; "),
    advertencias: diag.advertencias,
  });
  if (!formatoOk) {
    accionesHumanas.push(`Revisar el JSON de la cuenta de servicio en GOOGLE_WALLET_SA_KEY_B64: ${faltantes.join("; ")}.`);
  }

  const issuerVar = variables.find((v) => v.nombre === "GOOGLE_WALLET_ISSUER_ID")!;
  const estado: ResultadoGoogleOffline["estado"] =
    !issuerVar.presente || !variables.find((v) => v.nombre === "GOOGLE_WALLET_SA_KEY_B64")!.presente
      ? "incompleto"
      : issuerVar.formatoOk && formatoOk
        ? "ok"
        : "error_formato";

  return {
    estado,
    variables,
    cuentaDeServicio: {
      projectId,
      clientEmail,
      clientEmailPareceValido,
      privateKeyIdPresente: !!privateKeyId,
      privateKeyEsPemValido,
      tokenUri,
    },
    accionesHumanas,
  };
}

const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

/**
 * Validación CON red: confirma que las credenciales realmente autentican
 * contra Google y que la cuenta de servicio puede LEER recursos del
 * Issuer indicado. Nunca crea, modifica ni borra nada — solo GET/list.
 *
 * Requiere que `validarGoogleOffline` ya haya devuelto "ok" para las
 * credenciales que se le pasan.
 */
export async function validarGoogleRemoto(cred: CredencialesGoogle): Promise<ResultadoGoogleRemoto> {
  const accionesHumanas: string[] = [];
  const ahora = Math.floor(Date.now() / 1000);
  const assertion = firmarJwt(
    {
      iss: cred.clientEmail,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 300,
    },
    cred.privateKey,
  );

  let accessToken: string;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const cuerpo = await res.text();
      accionesHumanas.push(
        `Google rechazó la autenticación (HTTP ${res.status}). Motivo típico: la cuenta de servicio fue borrada/deshabilitada, o la llave privada fue rotada en Google Cloud sin actualizar GOOGLE_WALLET_SA_KEY_B64.`,
      );
      return {
        autenticacion: { ok: false, status: res.status, motivo: cuerpo.slice(0, 300) },
        autorizacionIssuer: { ok: "no_verificable", status: null, motivo: "no se pudo autenticar" },
        accionesHumanas,
      };
    }
    const json = (await res.json()) as { access_token: string };
    accessToken = json.access_token;
  } catch (e) {
    accionesHumanas.push("No se pudo contactar a Google (oauth2.googleapis.com) — revisar conectividad de red del entorno donde corre wallet:doctor.");
    return {
      autenticacion: { ok: false, status: null, motivo: (e as Error).message },
      autorizacionIssuer: { ok: "no_verificable", status: null, motivo: "no se pudo autenticar" },
      accionesHumanas,
    };
  }

  // Lectura de solo-lectura real: listar (máximo 1) las clases del
  // issuer. Un issuer sin ninguna clase todavía responde 200 con lista
  // vacía — igual de válido como evidencia de autorización que una lista
  // no vacía. Un 403 significa que la cuenta de servicio no es
  // Developer del Issuer (o el Issuer no existe).
  try {
    const res = await fetch(
      `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass?issuerId=${encodeURIComponent(cred.issuerId)}&maxResults=1`,
      { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (res.ok) {
      return {
        autenticacion: { ok: true, status: 200, motivo: null },
        autorizacionIssuer: { ok: true, status: res.status, motivo: null },
        accionesHumanas,
      };
    }
    const cuerpo = await res.text();
    if (res.status === 403) {
      accionesHumanas.push(
        `La cuenta de servicio (${cred.clientEmail}) no está autorizada como Developer del Issuer ${cred.issuerId}. Acción humana: en Google Pay & Wallet Console → Google Wallet API → Issuers, agregar ese client_email como Developer del Issuer.`,
      );
    } else {
      accionesHumanas.push(`Google respondió HTTP ${res.status} al listar clases del Issuer — revisar el mensaje: ${cuerpo.slice(0, 300)}`);
    }
    return {
      autenticacion: { ok: true, status: 200, motivo: null },
      autorizacionIssuer: { ok: false, status: res.status, motivo: cuerpo.slice(0, 300) },
      accionesHumanas,
    };
  } catch (e) {
    accionesHumanas.push("Se autenticó correctamente, pero no se pudo contactar a walletobjects.googleapis.com para confirmar la autorización del Issuer.");
    return {
      autenticacion: { ok: true, status: 200, motivo: null },
      autorizacionIssuer: { ok: "no_verificable", status: null, motivo: (e as Error).message },
      accionesHumanas,
    };
  }
}
