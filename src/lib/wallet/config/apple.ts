import forge from "node-forge";
import { diagnosticarBase64, validarEstructuraPem, type DiagnosticoBase64 } from "./base64";
import { certificadoVigente, construirManifest, firmarManifest, type CredencialesPase } from "../firma";

/**
 * VALIDACIÓN PROFUNDA DE CREDENCIALES DE APPLE — la pieza que
 * `wallet:doctor` y (más adelante) el panel de diagnóstico comparten,
 * para que las dos superficies digan siempre lo mismo.
 *
 * La auditoría de Fase 0 encontró que el panel actual
 * (`lealtad-secciones.tsx`) revisa 3 de las 5 variables de Apple y por
 * eso puede mostrar "OK" con la configuración incompleta. La causa raíz
 * no era un typo: era que no existía UNA función que las dos pantallas
 * pudieran compartir. Esta es esa función.
 *
 * REGLA DE SEGURIDAD: nada de lo que devuelve este archivo incluye el
 * contenido de un certificado o una llave — solo metadatos derivados
 * (huella, emisor, vigencia, longitudes, coincidencias booleanas).
 */

export type ResultadoVariableApple = {
  nombre:
    | "APPLE_PASS_CERT_B64"
    | "APPLE_PASS_KEY_B64"
    | "APPLE_WWDR_CERT_B64"
    | "APPLE_PASS_TYPE_ID"
    | "APPLE_TEAM_ID";
  presente: boolean;
  formatoOk: boolean;
  motivoError: string | null;
  longitud: number | null;
  advertencias: string[];
};

export type ResultadoApple = {
  estado: "ok" | "incompleto" | "error_formato";
  variables: ResultadoVariableApple[];
  /** Solo se completa si las 5 variables pasaron el chequeo de formato. */
  profundidad: {
    certificadoVsLlave: { ok: boolean; motivo: string | null };
    certificadoVsPassTypeId: { ok: boolean | "no_verificable"; motivo: string | null };
    certificadoVsTeamId: { ok: boolean | "no_verificable"; motivo: string | null };
    cadenaCertificadoWwdr: { ok: boolean; motivo: string | null };
    vigencia: { ok: boolean; motivo: string | null; venceEl: string | null };
    huellaCertificadoSha256: string | null;
    huellaLlaveSha256: string | null;
    emisorCertificado: string | null;
    firmaDePrueba: { ok: boolean; motivo: string | null };
  } | null;
  accionesHumanas: string[];
};

function huellaSha256(pem: string): string {
  const md = forge.md.sha256.create();
  md.update(pem, "utf8");
  const hex = md.digest().toHex();
  return hex.slice(0, 12) + "…" + hex.slice(-8);
}

/**
 * Extrae un campo del subject/issuer de un certificado por shortName
 * (ej. "CN", "OU") o por OID crudo (ej. el UID de RFC 1274,
 * "0.9.2342.19200300.100.1.1", que node-forge no siempre resuelve por
 * `getField("UID")` porque depende de si esa attribute type está
 * registrada con ese shortName exacto en la versión de forge instalada).
 *
 * Esto NO expone información sensible: el subject de un certificado
 * X.509 es, por diseño, público — es lo que el propio .pkpass ya
 * publica dentro de su firma.
 */
function campoDn(cert: forge.pki.Certificate, tipo: "subject" | "issuer", claveOShortName: string): string | null {
  const dn = cert[tipo];
  const porShortName = dn.getField(claveOShortName);
  if (typeof porShortName?.value === "string") return porShortName.value;
  const porTipo = dn.attributes.find((a) => a.type === claveOShortName || a.shortName === claveOShortName);
  return typeof porTipo?.value === "string" ? porTipo.value : null;
}

/** El UID (RFC 1274) donde Apple graba el Pass Type ID dentro del certificado. */
const OID_UID_RFC1274 = "0.9.2342.19200300.100.1.1";

function validarVariableApple(
  nombre: ResultadoVariableApple["nombre"],
  valor: string | undefined,
  esperaBase64: boolean,
): { resultado: ResultadoVariableApple; diagnostico: DiagnosticoBase64 | null } {
  if (!valor) {
    return {
      resultado: {
        nombre,
        presente: false,
        formatoOk: false,
        motivoError: "no está definida",
        longitud: null,
        advertencias: [],
      },
      diagnostico: null,
    };
  }

  if (!esperaBase64) {
    // APPLE_PASS_TYPE_ID / APPLE_TEAM_ID: texto plano, sin decodificar.
    const limpio = valor.trim();
    const advertencias: string[] = [];
    if (limpio !== valor) advertencias.push("espacios_o_saltos_de_linea");
    return {
      resultado: {
        nombre,
        presente: true,
        formatoOk: limpio.length > 0,
        motivoError: limpio.length === 0 ? "queda vacía tras recortar espacios" : null,
        longitud: limpio.length,
        advertencias,
      },
      diagnostico: null,
    };
  }

  const diag = diagnosticarBase64(valor);
  if (!diag.ok) {
    return {
      resultado: {
        nombre,
        presente: true,
        formatoOk: false,
        motivoError: diag.motivo,
        longitud: null,
        advertencias: diag.advertencias,
      },
      diagnostico: diag,
    };
  }

  const pem = validarEstructuraPem(diag.decodificado.toString("utf8"));
  if (!pem.ok) {
    return {
      resultado: {
        nombre,
        presente: true,
        formatoOk: false,
        motivoError: `decodifica Base64 correctamente, pero el PEM resultante es inválido: ${pem.motivo}`,
        longitud: diag.longitudDecodificada,
        advertencias: diag.advertencias,
      },
      diagnostico: diag,
    };
  }

  return {
    resultado: {
      nombre,
      presente: true,
      formatoOk: true,
      motivoError: null,
      longitud: diag.longitudDecodificada,
      advertencias: diag.advertencias,
    },
    diagnostico: diag,
  };
}

/**
 * Valida las 5 variables de Apple. Sin argumentos, offline: no hace
 * ninguna llamada de red. Todo lo que verifica sale de leer y parsear
 * lo que ya está en el proceso.
 */
export function validarApple(env: Record<string, string | undefined> = process.env): ResultadoApple {
  const accionesHumanas: string[] = [];

  const certR = validarVariableApple("APPLE_PASS_CERT_B64", env.APPLE_PASS_CERT_B64, true);
  const llaveR = validarVariableApple("APPLE_PASS_KEY_B64", env.APPLE_PASS_KEY_B64, true);
  const wwdrR = validarVariableApple("APPLE_WWDR_CERT_B64", env.APPLE_WWDR_CERT_B64, true);
  const passTypeR = validarVariableApple("APPLE_PASS_TYPE_ID", env.APPLE_PASS_TYPE_ID, false);
  const teamR = validarVariableApple("APPLE_TEAM_ID", env.APPLE_TEAM_ID, false);

  const variables = [certR.resultado, llaveR.resultado, wwdrR.resultado, passTypeR.resultado, teamR.resultado];

  for (const v of variables) {
    if (!v.presente) accionesHumanas.push(`Definir ${v.nombre} (falta por completo).`);
    else if (!v.formatoOk) accionesHumanas.push(`Revisar el formato de ${v.nombre}: ${v.motivoError}`);
  }

  const faltanVariables = variables.some((v) => !v.presente);
  const formatoInvalido = variables.some((v) => v.presente && !v.formatoOk);

  if (faltanVariables) {
    return { estado: "incompleto", variables, profundidad: null, accionesHumanas };
  }
  if (formatoInvalido) {
    return { estado: "error_formato", variables, profundidad: null, accionesHumanas };
  }

  // Las 5 pasaron el chequeo de formato: se puede ir un nivel más profundo.
  const diagCert = certR.diagnostico;
  const diagLlave = llaveR.diagnostico;
  const diagWwdr = wwdrR.diagnostico;
  const certPem = diagCert?.ok ? diagCert.decodificado.toString("utf8") : "";
  const llavePem = diagLlave?.ok ? diagLlave.decodificado.toString("utf8") : "";
  const wwdrPem = diagWwdr?.ok ? diagWwdr.decodificado.toString("utf8") : "";
  const passTypeIdentifier = env.APPLE_PASS_TYPE_ID!.trim();
  const teamIdentifier = env.APPLE_TEAM_ID!.trim();

  let cert: forge.pki.Certificate;
  let llave: forge.pki.PrivateKey;
  let wwdr: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(certPem);
    llave = forge.pki.privateKeyFromPem(llavePem) as forge.pki.rsa.PrivateKey;
    wwdr = forge.pki.certificateFromPem(wwdrPem);
  } catch (e) {
    accionesHumanas.push(
      "No se pudo parsear uno de los tres PEM de Apple con node-forge — probablemente el contenido decodificado no es un certificado/llave X.509 válido. Regenerar el .p12/.pem desde el portal de Apple Developer.",
    );
    return {
      estado: "error_formato",
      variables,
      profundidad: {
        certificadoVsLlave: { ok: false, motivo: `no parseable: ${(e as Error).message}` },
        certificadoVsPassTypeId: { ok: "no_verificable", motivo: null },
        certificadoVsTeamId: { ok: "no_verificable", motivo: null },
        cadenaCertificadoWwdr: { ok: false, motivo: "no verificable, el certificado no parseó" },
        vigencia: { ok: false, motivo: "no verificable, el certificado no parseó", venceEl: null },
        huellaCertificadoSha256: null,
        huellaLlaveSha256: null,
        emisorCertificado: null,
        firmaDePrueba: { ok: false, motivo: "no intentado, el certificado no parseó" },
      },
      accionesHumanas,
    };
  }

  // Certificado ↔ llave: comparan el módulo RSA. Si no coinciden, la
  // llave no le pertenece a este certificado — el pase firmaría pero el
  // iPhone rechazaría la firma sin decir por qué.
  const certPublicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  const llaveRsa = llave as forge.pki.rsa.PrivateKey;
  const certVsLlaveOk =
    certPublicKey.n?.toString(16) === llaveRsa.n?.toString(16) &&
    certPublicKey.e?.toString(16) === llaveRsa.e?.toString(16);
  if (!certVsLlaveOk) {
    accionesHumanas.push(
      "APPLE_PASS_CERT_B64 y APPLE_PASS_KEY_B64 no corresponden entre sí (el módulo RSA no coincide). Verificar que ambos vengan del mismo .p12 exportado desde el llavero.",
    );
  }

  // Certificado ↔ passTypeIdentifier: verificado contra el certificado
  // real emitido por Apple — el Pass Type ID vive en el atributo UID
  // (RFC 1274, OID 0.9.2342.19200300.100.1.1) del subject, y se repite
  // dentro del CN como "Pass Type ID: <id>". Se exige coincidencia
  // exacta en el UID; el CN se usa solo como corroboración adicional.
  const uid = campoDn(cert, "subject", OID_UID_RFC1274) ?? campoDn(cert, "subject", "UID");
  let certVsPassType: { ok: boolean | "no_verificable"; motivo: string | null };
  if (!uid) {
    certVsPassType = { ok: "no_verificable", motivo: "el certificado no tiene el atributo UID del subject para comparar" };
  } else if (uid === passTypeIdentifier) {
    certVsPassType = { ok: true, motivo: null };
  } else {
    certVsPassType = {
      ok: false,
      motivo: `el certificado fue emitido para "${uid}", pero APPLE_PASS_TYPE_ID dice "${passTypeIdentifier}"`,
    };
    accionesHumanas.push(
      `APPLE_PASS_CERT_B64 corresponde al Pass Type ID "${uid}", no a APPLE_PASS_TYPE_ID ("${passTypeIdentifier}"). Corregir la variable que esté desactualizada.`,
    );
  }

  // Certificado ↔ teamIdentifier: Apple lo graba en el OU del subject.
  const ou = campoDn(cert, "subject", "OU");
  let certVsTeamId: { ok: boolean | "no_verificable"; motivo: string | null };
  if (!ou) {
    certVsTeamId = { ok: "no_verificable", motivo: "el certificado no tiene el atributo OU del subject para comparar" };
  } else if (ou === teamIdentifier) {
    certVsTeamId = { ok: true, motivo: null };
  } else {
    certVsTeamId = { ok: false, motivo: `el certificado fue emitido para el Team ID "${ou}", pero APPLE_TEAM_ID dice "${teamIdentifier}"` };
    accionesHumanas.push(`APPLE_PASS_CERT_B64 corresponde al Team ID "${ou}", no a APPLE_TEAM_ID ("${teamIdentifier}"). Corregir la variable que esté desactualizada.`);
  }

  // Cadena: ¿el WWDR firmó este certificado? Apple emite el cert del
  // Pass Type ID directamente bajo el intermedio WWDR (no hay más
  // eslabones intermedios en este caso).
  let cadenaOk = false;
  let cadenaMotivo: string | null = null;
  try {
    cadenaOk = wwdr.verify(cert);
    if (!cadenaOk) cadenaMotivo = "el WWDR provisto no firmó este certificado";
  } catch (e) {
    cadenaMotivo = `no se pudo verificar la cadena: ${(e as Error).message}`;
  }
  if (!cadenaOk) {
    accionesHumanas.push(
      "APPLE_WWDR_CERT_B64 no corresponde a la autoridad que firmó APPLE_PASS_CERT_B64 — es probable que sea un WWDR de otra generación (G4 vs G6). Bajar el WWDR vigente desde https://www.apple.com/certificateauthority/.",
    );
  }

  const vigencia = certificadoVigente({ certificado: certPem, llave: llavePem, wwdr: wwdrPem, passTypeIdentifier, teamIdentifier }, new Date());
  if (!vigencia.vigente) accionesHumanas.push(vigencia.motivo);

  // Firma de prueba: confirma que la MECÁNICA de firmar no lanza, sin
  // exponer nada. La verificación externa completa (openssl smime
  // -verify) la ejerce firma.test.ts en cada corrida de `npm test`.
  let firmaOk = true;
  let firmaMotivo: string | null = null;
  try {
    const manifestPrueba = construirManifest({ "wallet-doctor.txt": Buffer.from("prueba de firma, no forma parte de ningún pase real") });
    firmarManifest(manifestPrueba, { certificado: certPem, llave: llavePem, wwdr: wwdrPem, passTypeIdentifier, teamIdentifier });
  } catch (e) {
    firmaOk = false;
    firmaMotivo = (e as Error).message;
    accionesHumanas.push(`La firma de prueba falló: ${firmaMotivo}`);
  }

  return {
    estado:
      certVsLlaveOk && cadenaOk && vigencia.vigente && certVsPassType.ok !== false && certVsTeamId.ok !== false && firmaOk
        ? "ok"
        : "error_formato",
    variables,
    profundidad: {
      certificadoVsLlave: { ok: certVsLlaveOk, motivo: certVsLlaveOk ? null : "el módulo RSA del certificado y de la llave no coinciden" },
      certificadoVsPassTypeId: certVsPassType,
      certificadoVsTeamId: certVsTeamId,
      cadenaCertificadoWwdr: { ok: cadenaOk, motivo: cadenaMotivo },
      vigencia: {
        ok: vigencia.vigente,
        motivo: vigencia.vigente ? null : vigencia.motivo,
        venceEl: cert.validity.notAfter.toISOString().slice(0, 10),
      },
      huellaCertificadoSha256: huellaSha256(certPem),
      huellaLlaveSha256: huellaSha256(llavePem),
      emisorCertificado: campoDn(cert, "issuer", "CN"),
      firmaDePrueba: { ok: firmaOk, motivo: firmaMotivo },
    },
    accionesHumanas,
  };
}

export type { CredencialesPase };

/**
 * Chequeo BARATO (sin decodificar Base64 ni tocar node-forge) de que
 * las 5 variables de Apple están presentes. Para superficies que se
 * renderizan seguido (el panel) y no necesitan la validación profunda
 * en cada render — esa la hace `wallet:doctor`.
 *
 * Es exactamente lo que arregla el hallazgo de la auditoría: el chequeo
 * viejo del panel solo miraba 3 de estas 5.
 */
export function hayCredencialesApple(env: Record<string, string | undefined> = process.env): boolean {
  return !!(
    env.APPLE_PASS_CERT_B64 &&
    env.APPLE_PASS_KEY_B64 &&
    env.APPLE_WWDR_CERT_B64 &&
    env.APPLE_PASS_TYPE_ID &&
    env.APPLE_TEAM_ID
  );
}
