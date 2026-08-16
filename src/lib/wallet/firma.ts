import forge from "node-forge";
import { diagnosticarBase64 } from "./config/base64";

/**
 * Firma de un pase de Apple Wallet.
 *
 * Un .pkpass es un zip con `pass.json`, sus imágenes, un
 * `manifest.json` con el SHA-1 de cada archivo, y un `signature` que
 * es una firma PKCS#7 SEPARADA (detached) del manifest. El iPhone
 * recalcula los hashes y verifica la firma: si algo no cuadra rechaza
 * el pase sin decir por qué, así que acá no hay margen para
 * aproximaciones.
 *
 * En el borrador esto lo hacía `openssl smime -sign`. En Vercel no hay
 * openssl, de ahí node-forge — que produce exactamente la misma
 * estructura CMS.
 */

export type CredencialesPase = {
  /** Certificado del Pass Type ID, en PEM. */
  certificado: string;
  /** Llave privada que le corresponde, en PEM. */
  llave: string;
  /** Intermedio WWDR de Apple, en PEM. Sin él el iPhone no encadena. */
  wwdr: string;
  passTypeIdentifier: string;
  teamIdentifier: string;
};

/**
 * Lee las credenciales de las variables de entorno. Van en base64
 * porque un .env no admite saltos de línea y un PEM está lleno.
 *
 * Devuelve null en vez de tirar: así el resto del panel sigue
 * funcionando en un entorno donde el pase no está configurado, y la
 * pantalla puede decirlo en vez de romperse.
 */
export function credencialesDelEntorno(): CredencialesPase | null {
  const cert = process.env.APPLE_PASS_CERT_B64;
  const llave = process.env.APPLE_PASS_KEY_B64;
  const wwdr = process.env.APPLE_WWDR_CERT_B64;
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID?.trim();
  const teamIdentifier = process.env.APPLE_TEAM_ID?.trim();

  if (!cert || !llave || !wwdr || !passTypeIdentifier || !teamIdentifier) return null;

  // El decodificador robusto (config/base64.ts) tolera espacios,
  // comillas y \r accidentales que el `.env.local` de un desarrollador
  // puede traer — antes esto se decodificaba con Buffer.from directo,
  // que los ignora en silencio y a veces produce un PEM roto sin decir
  // por qué. Si algo no decodifica limpio, se trata como "sin
  // credenciales" (null) en vez de intentar firmar con un PEM inválido.
  const desdeBase64 = (v: string): string | null => {
    const diag = diagnosticarBase64(v);
    return diag.ok ? diag.decodificado.toString("utf8") : null;
  };

  const certificado = desdeBase64(cert);
  const llavePem = desdeBase64(llave);
  const wwdrPem = desdeBase64(wwdr);
  if (!certificado || !llavePem || !wwdrPem) return null;

  return { certificado, llave: llavePem, wwdr: wwdrPem, passTypeIdentifier, teamIdentifier };
}

/**
 * El SHA-1 de cada archivo del pase. Apple todavía usa SHA-1 acá — no
 * es una elección nuestra ni se puede cambiar por SHA-256: el iPhone
 * compara contra este algoritmo y nada más.
 */
export function construirManifest(archivos: Record<string, Buffer>): string {
  const manifest: Record<string, string> = {};
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const md = forge.md.sha1.create();
    md.update(contenido.toString("binary"));
    manifest[nombre] = md.digest().toHex();
  }
  // Con sangría para que sea legible al depurar un pase que no abre.
  return JSON.stringify(manifest, null, 2);
}

/**
 * Firma PKCS#7 separada del manifest, en DER.
 *
 * `detached` es obligatorio: el contenido firmado NO va dentro de la
 * firma, porque el manifest ya viaja como archivo propio del zip.
 * Adjuntarlo produce un archivo que openssl valida igual pero que el
 * iPhone rechaza.
 */
export function firmarManifest(manifest: string, cred: CredencialesPase): Buffer {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest, "utf8");

  const certificado = forge.pki.certificateFromPem(cred.certificado);
  const wwdr = forge.pki.certificateFromPem(cred.wwdr);
  const llave = forge.pki.privateKeyFromPem(cred.llave);

  // Los DOS certificados van adentro: el del pase y el intermedio. Con
  // uno solo la cadena queda cortada y el pase no abre.
  p7.addCertificate(certificado);
  p7.addCertificate(wwdr);

  p7.addSigner({
    key: llave,
    certificate: certificado,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      // messageDigest y signingTime los calcula forge; declararlos sin
      // valor es lo que le pide que los complete.
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime },
    ],
  });

  p7.sign({ detached: true });

  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

/**
 * Comprueba que el certificado siga vigente. Se llama antes de firmar
 * para que el fallo diga "venció el 11-9-2027" y no "el pase no abre",
 * que es lo que vería el cliente final.
 */
export function certificadoVigente(
  cred: CredencialesPase,
  ahora: Date,
): { vigente: true } | { vigente: false; motivo: string } {
  const cert = forge.pki.certificateFromPem(cred.certificado);
  const { notBefore, notAfter } = cert.validity;

  if (ahora < notBefore) {
    return { vigente: false, motivo: `El certificado no vale hasta ${notBefore.toISOString().slice(0, 10)}.` };
  }
  if (ahora > notAfter) {
    return {
      vigente: false,
      motivo: `El certificado del pase venció el ${notAfter.toISOString().slice(0, 10)} — hay que renovarlo en el portal de Apple.`,
    };
  }
  return { vigente: true };
}
