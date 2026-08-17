import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * LAS LLAVES DE LA API DE LEALTAD — cómo nacen, cómo se leen y cómo se
 * guardan.
 *
 * Lógica pura sobre `node:crypto`, sin base y sin red, para poder
 * probar cada propiedad contra un caso concreto en vez de confiar en
 * que "se ve bien".
 *
 * ------------------------------------------------------------------
 * EL FORMATO, Y POR QUÉ TIENE DOS PARTES
 * ------------------------------------------------------------------
 *
 *   blk_live_7f3kq9x2m4dp.k3Jd9_xQ2pLmN8vRtY4wZbC6hF1sA5gE0nU7iO
 *            └── kid (12) ──┘ └──── secreto: 32 bytes b64url ─────┘
 *
 * · El PREFIJO (`blk_live_` / `blk_test_`) es para que un secreto
 *   pegado por error en un repo se reconozca a simple vista, y para que
 *   nadie confunda la llave del sandbox con la de producción.
 * · El `kid` NO es secreto: es el índice. Permite ir a buscar UNA fila
 *   por índice único en vez de traer todas las llaves y comparar en
 *   bucle.
 * · El SECRETO son 32 bytes de `crypto.randomBytes` — 256 bits. Nunca
 *   `Math.random`, que además de no ser criptográfico está prohibido en
 *   este repo.
 *
 * ------------------------------------------------------------------
 * SE GUARDA HASHEADA, COMO UNA CONTRASEÑA
 * ------------------------------------------------------------------
 * En la base vive `HMAC-SHA256(secreto, LEALTAD_API_PEPPER)` en hex, y
 * nada más. Ni una columna con la llave en claro: un volcado de la
 * tabla no le sirve a nadie ni siquiera para verificar candidatos,
 * porque el pepper no está en la base sino en el entorno.
 *
 * SHA-256 y no argon2/bcrypt A PROPÓSITO. Un KDF lento protege contra
 * diccionarios, y acá no hay diccionario que probar: son 256 bits
 * aleatorios. Lo que sí habría es ~100 ms de CPU en cada cobro en caja,
 * con un cliente esperando enfrente.
 *
 * ------------------------------------------------------------------
 * FALLA CERRADO
 * ------------------------------------------------------------------
 * Sin `LEALTAD_API_PEPPER` configurada, `pepperDeLlaves()` devuelve
 * null y la API entera responde 503. Mismo criterio que
 * `src/lib/cron-auth.ts`: sin secreto configurado no entra nadie, y el
 * problema se ve en el log de una vez en vez de quedar mudo.
 */

export const PREFIJOS = { live: "blk_live_", test: "blk_test_" } as const;

export type EntornoLlave = keyof typeof PREFIJOS;

/** Largo del identificador público de la llave. */
const LARGO_KID = 12;
const ALFABETO_KID = "abcdefghijklmnopqrstuvwxyz0123456789"; // 36

/** Bytes del secreto. 32 = 256 bits = 43 caracteres en base64url. */
const BYTES_SECRETO = 32;

export type LlaveGenerada = {
  entorno: EntornoLlave;
  kid: string;
  /** El secreto en claro. Se muestra UNA vez y no se guarda nunca. */
  secreto: string;
  /** Lo que se le entrega al integrador, completo. */
  completa: string;
  /** Los últimos 4 del secreto, para reconocer cuál llave es después. */
  sufijoVisible: string;
};

/**
 * Un `kid` aleatorio SIN SESGO.
 *
 * `byte % 36` parece inofensivo y no lo es: 256 no es múltiplo de 36,
 * así que las primeras 4 letras salen ~14 % más seguido que las demás.
 * Acá se descartan los bytes que caen en la cola incompleta (>= 252) y
 * se pide otro. El costo esperado es ~1,6 % de bytes de más.
 */
export function generarKid(): string {
  const techo = Math.floor(256 / ALFABETO_KID.length) * ALFABETO_KID.length; // 252
  let salida = "";
  while (salida.length < LARGO_KID) {
    for (const byte of randomBytes(LARGO_KID * 2)) {
      if (byte >= techo) continue;
      salida += ALFABETO_KID[byte % ALFABETO_KID.length];
      if (salida.length === LARGO_KID) break;
    }
  }
  return salida;
}

/** 32 bytes de aleatoriedad criptográfica en base64url (43 caracteres). */
export function generarSecreto(): string {
  return randomBytes(BYTES_SECRETO).toString("base64url");
}

/** Una llave nueva, completa, lista para mostrarse UNA sola vez. */
export function generarLlave(entorno: EntornoLlave): LlaveGenerada {
  const kid = generarKid();
  const secreto = generarSecreto();
  return {
    entorno,
    kid,
    secreto,
    completa: `${PREFIJOS[entorno]}${kid}.${secreto}`,
    sufijoVisible: secreto.slice(-4),
  };
}

export type LlavePartida = { entorno: EntornoLlave; kid: string; secreto: string };

/**
 * Parte una llave presentada. Devuelve null ante CUALQUIER cosa que no
 * sea exactamente el formato: prefijo conocido, kid de 12 en su
 * alfabeto, un solo punto, y un secreto base64url de largo plausible.
 *
 * Todo lo que viene de afuera es hostil hasta que se demuestre lo
 * contrario, y "casi bien" no existe.
 */
export function partirLlave(bruta: string | null | undefined): LlavePartida | null {
  if (typeof bruta !== "string") return null;
  const texto = bruta.trim();
  // Un secreto larguísimo no debería llegar ni a la expresión regular.
  if (texto.length < 20 || texto.length > 200) return null;

  const entorno = (Object.keys(PREFIJOS) as EntornoLlave[]).find((e) =>
    texto.startsWith(PREFIJOS[e]),
  );
  if (!entorno) return null;

  const resto = texto.slice(PREFIJOS[entorno].length);
  const punto = resto.indexOf(".");
  if (punto < 0) return null;

  const kid = resto.slice(0, punto);
  const secreto = resto.slice(punto + 1);

  if (!/^[a-z0-9]{12}$/.test(kid)) return null;
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(secreto)) return null;

  return { entorno, kid, secreto };
}

/** Lee `Authorization: Bearer <llave>` y la parte. */
export function llaveDeCabecera(pedido: {
  headers: { get(nombre: string): string | null };
}): LlavePartida | null {
  const cabecera = pedido.headers.get("authorization") ?? "";
  const m = cabecera.match(/^Bearer\s+(.+)$/i);
  return m ? partirLlave(m[1]) : null;
}

/**
 * El HMAC que SÍ se guarda. Hex de 64 caracteres — el mismo formato que
 * el `check (~'^[0-9a-f]{64}$')` de la 0113 y de la 0178.
 */
export function hashDeSecreto(secreto: string, pepper: string): string {
  return createHmac("sha256", pepper).update(secreto, "utf8").digest("hex");
}

/**
 * Compara dos hashes en TIEMPO CONSTANTE.
 *
 * En el camino caliente la comparación la hace Postgres dentro de
 * `api_lealtad_autenticar` (un solo round trip), pero esta función es
 * el contrato de la propiedad y la usa todo lo que compare secretos del
 * lado de Node — por ejemplo la firma de un webhook en la entrega 3.
 * Copia el patrón de `igualSeguro()` de src/lib/wallet/servicio.ts,
 * incluida la comparación contra sí mismo cuando los largos difieren
 * para no delatar el largo.
 */
export function hashesIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * El pepper del servidor, o null si no está configurado.
 *
 * Se exige un largo mínimo: un pepper de tres letras puesto "para
 * probar" da la misma sensación de seguridad y ninguna de sus
 * propiedades.
 */
export function pepperDeLlaves(): string | null {
  const valor = process.env.LEALTAD_API_PEPPER?.trim();
  if (!valor || valor.length < 32) return null;
  return valor;
}

/**
 * La huella de una IP: `HMAC-SHA256(ip, pepper)` en hex.
 *
 * Nunca se guarda la IP en claro — ni en la bitácora, ni en la llave,
 * ni en el contador de fallos. Con la huella se puede contar y comparar
 * ("esta llave nunca se había usado desde acá") sin tener el dato.
 * Mismo precedente ya probado en src/lib/wallet (servicio.test.ts:710).
 */
export function huellaDeIp(ip: string | null, pepper: string): string | null {
  const limpia = (ip ?? "").trim();
  if (!limpia) return null;
  return createHmac("sha256", pepper).update(limpia, "utf8").digest("hex");
}
