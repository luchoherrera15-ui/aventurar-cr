/**
 * Helpers de seguridad para URLs que nacen de datos de negocio o del
 * usuario y terminan pintadas en un enlace, o usadas como destino de una
 * redireccion.
 *
 * El PORQUE de que vivan aca y no en la capa de guardado: la
 * normalizacion que hace la server action al escribir (por ejemplo,
 * forzar `https://` en el sitio web de un negocio) se puede SALTAR
 * escribiendo directo contra la API de Supabase con la anon key. O sea
 * que limpiar al guardar no alcanza: el unico momento en que la URL de
 * verdad se interpreta es al RENDERIZAR el href o al REDIRIGIR, y es ahi
 * donde hay que volver a filtrar. Este modulo es puro (sin DOM), asi que
 * corre igual en el servidor y en el cliente.
 */

/** Esquemas que se pueden pintar en un href/src sin ejecutar codigo. */
const ESQUEMAS_SEGUROS = ["http:", "https:", "mailto:", "tel:"] as const;

/**
 * true si el codigo de caracter es de los que el navegador ignora o
 * limpia al parsear una URL: controles C0 (0x00-0x1f, que incluyen el tab
 * 0x09 y los saltos 0x0a / 0x0d), el espacio (0x20), DEL (0x7f), los
 * controles C1 (0x80-0x9f) y el espacio duro/NBSP (0xa0). Metidos DENTRO
 * del esquema, un "java<tab>script:" igual ejecuta, asi que hay que
 * ignorarlos para decidir el esquema. Se comparan por codigo y no con una
 * clase de regex para no depender de escapes fragiles.
 */
function esRuidoDeUrl(codigo: number): boolean {
  return codigo <= 0x20 || (codigo >= 0x7f && codigo <= 0xa0);
}

/**
 * Devuelve la URL si su esquema es seguro para pintarla como enlace; si
 * no, `null` (y quien llama simplemente no pinta el enlace).
 *
 * Bloquea `javascript:`, `data:`, `vbscript:` y cualquier otro esquema
 * fuera de la lista, incluidas las variantes ofuscadas que el navegador
 * igual interpreta:
 *  - mayusculas: `JavaScript:`
 *  - espacios, tabs y saltos: ` javascript:`, `java<tab>script:`
 *  - caracteres de control metidos dentro del esquema
 *
 * Las URLs SIN esquema (relativas `/algo`, anclas `#x`, o un
 * `www.instagram.com/foo` pegado tal cual) pasan: no pueden ejecutar
 * codigo, a lo sumo navegan.
 */
export function urlSegura(
  bruta: string | null | undefined,
  esquemas: readonly string[] = ESQUEMAS_SEGUROS,
): string | null {
  if (typeof bruta !== "string") return null;
  const valor = bruta.trim();
  if (!valor) return null;

  // Para DECIDIR el esquema se mira una copia sin el ruido; el valor que
  // se DEVUELVE es el original: si el esquema es peligroso ni siquiera se
  // llega a devolver.
  let paraEsquema = "";
  for (const ch of valor) {
    if (!esRuidoDeUrl(ch.charCodeAt(0))) paraEsquema += ch;
  }
  paraEsquema = paraEsquema.toLowerCase();

  const conEsquema = /^([a-z][a-z0-9+.-]*):/.exec(paraEsquema);
  if (conEsquema && !esquemas.includes(`${conEsquema[1]}:`)) {
    return null;
  }
  return valor;
}

/**
 * Valida un destino de redireccion que vino de la URL (`?next=...`,
 * `?volver=...`). Solo deja pasar rutas INTERNAS del propio sitio; ante
 * cualquier duda devuelve `null`, y quien llama cae al destino por
 * defecto (nunca a un dominio ajeno).
 *
 * Cierra el open redirect en todas sus formas conocidas:
 *  - `//otro.com`   -> el navegador lo trata como URL absoluta de otro host
 *  - `/\otro.com`   -> el parser de URL (WHATWG) convierte "\" en "/", o
 *                      sea que termina siendo `//otro.com`
 *  - `/<tab>otro`   -> tabs/saltos/controles que el navegador limpia y que
 *                      colapsan la ruta en `//`
 *  - `/%5cotro`     -> ya llega decodificado por URLSearchParams, pero el
 *                      chequeo de resolucion final lo atrapa igual
 *
 * `origin` es el del propio request (`new URL(request.url).origin`): se
 * usa para resolver la ruta y confirmar que sigue apuntando al mismo
 * sitio.
 */
export function rutaInternaSegura(
  bruto: string | null | undefined,
  origin: string,
): string | null {
  if (typeof bruto !== "string" || !bruto) return null;

  // Un backslash o un caracter de control en CUALQUIER parte descalifica:
  // el "\" lo vuelve "/" el parser (-> "//"), y tabs/saltos los limpia el
  // navegador antes de resolver, colapsando la ruta. Se escanea por codigo
  // para no pelear con el escape del backslash.
  const BACKSLASH = 0x5c;
  for (const ch of bruto) {
    const codigo = ch.charCodeAt(0);
    if (codigo === BACKSLASH || codigo <= 0x1f || codigo === 0x7f) return null;
  }

  // Tiene que ser una ruta absoluta del sitio, y NO empezar con `//`.
  if (!bruto.startsWith("/") || bruto.startsWith("//")) return null;

  // Cinturon y tirantes: al resolver contra el origen real tiene que
  // seguir siendo el MISMO origen. Si el parser saca cualquier otra cosa,
  // es externa y se descarta. Se devuelve la ruta ya normalizada.
  try {
    const resuelta = new URL(bruto, origin);
    if (resuelta.origin !== origin) return null;
    return resuelta.pathname + resuelta.search + resuelta.hash;
  } catch {
    return null;
  }
}
