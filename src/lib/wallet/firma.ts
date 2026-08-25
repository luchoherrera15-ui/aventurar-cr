import forge from "node-forge";

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
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID;
  const teamIdentifier = process.env.APPLE_TEAM_ID;

  if (!cert || !llave || !wwdr || !passTypeIdentifier || !teamIdentifier) return null;

  const desdeBase64 = (v: string) => Buffer.from(v, "base64").toString("utf8");

  return {
    certificado: desdeBase64(cert),
    llave: desdeBase64(llave),
    wwdr: desdeBase64(wwdr),
    passTypeIdentifier,
    teamIdentifier,
  };
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
/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS CERTIFICADOS SE PARSEAN UNA VEZ, NO EN CADA PASE
 * ════════════════════════════════════════════════════════════════════
 *
 * ⚠️ ESTE CACHÉ ES UN ARREGLO DE COSTO REAL, MEDIDO.
 *
 * `firmarManifest` corre una vez por cada `.pkpass` que se genera, y
 * hacía esto adentro:
 *
 *     forge.pki.certificateFromPem(cred.certificado)
 *     forge.pki.certificateFromPem(cred.wwdr)
 *     forge.pki.privateKeyFromPem(cred.llave)      ← el caro
 *
 * `node-forge` es JavaScript PURO: parsear una llave RSA de 2048 bits
 * significa decodificar ASN.1 y construir BigIntegers a mano, sin
 * ayuda del runtime. Es de las cosas más caras que hace esta ruta.
 *
 * Y los tres objetos son IDÉNTICOS para todos los pases: salen de
 * variables de entorno que no cambian mientras el proceso viva.
 *
 * Panel de Vercel, 12 horas: 53 invocaciones de la ruta del pase a
 * ~358 ms de CPU activa cada una, con el proyecto al 75 % del límite
 * mensual del plan.
 *
 * ── POR QUÉ LA CLAVE ES EL PEM Y NO UN BOOLEANO ────────────────────
 * Si algún día rotan el certificado (vence, o se cambia el emisor), el
 * PEM cambia y el caché falla solo — se vuelve a parsear con el nuevo.
 * Un `let yaParseado = true` habría dejado el certificado VIEJO en
 * memoria hasta que el contenedor muriera, firmando pases con una
 * credencial revocada.
 *
 * ── LO QUE ESTO NO CAMBIA ──────────────────────────────────────────
 * Ni un byte del `.pkpass`. `p7.sign()`, la firma y el manifest se
 * siguen calculando por pase, que es lo único que de verdad es único.
 */
type CredencialesParseadas = {
  certificado: forge.pki.Certificate;
  wwdr: forge.pki.Certificate;
  /* El tipo sale de la propia función: `forge.pki.PrivateKey` es más
     ancho de lo que devuelve `privateKeyFromPem` y no encaja en
     `addSigner`. */
  llave: ReturnType<typeof forge.pki.privateKeyFromPem>;
};

let cacheCredenciales: { clave: string; valor: CredencialesParseadas } | null = null;

function parsearCredenciales(cred: CredencialesPase): CredencialesParseadas {
  // El PEM entero como clave: si rota el certificado, el caché falla solo.
  const clave = `${cred.certificado}|${cred.wwdr}|${cred.llave}`;
  if (cacheCredenciales?.clave === clave) return cacheCredenciales.valor;

  const valor: CredencialesParseadas = {
    certificado: forge.pki.certificateFromPem(cred.certificado),
    wwdr: forge.pki.certificateFromPem(cred.wwdr),
    llave: forge.pki.privateKeyFromPem(cred.llave),
  };
  cacheCredenciales = { clave, valor };
  return valor;
}

export function firmarManifest(manifest: string, cred: CredencialesPase): Buffer {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest, "utf8");

  const { certificado, wwdr, llave } = parsearCredenciales(cred);

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
  /* Reusa el MISMO caché que la firma. Esta función se llama justo
     antes de `firmarManifest` en cada pase, así que sin esto el
     certificado se parseaba DOS VECES por pase en vez de cero. */
  const { certificado: cert } = parsearCredenciales(cred);
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
