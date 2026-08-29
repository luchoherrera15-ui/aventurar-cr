/**
 * Saneador conservador de HTML para las invitaciones digitales.
 *
 * EL PROBLEMA
 * -----------
 * `html_personalizado` (y su hermana de papel `html_impresion`) se
 * inyectan con `dangerouslySetInnerHTML`. Ese HTML lo genera la IA o lo
 * edita el cliente, y cuando llega por SSR sus `<script>` SÍ corren al
 * parsear el documento (no es el caso de un `.innerHTML` en caliente).
 * O sea: un `<script>` o un `onerror=` metido ahí es XSS real. No se
 * puede distinguir en la base el HTML del equipo del HTML de un atacante,
 * así que se filtra SIEMPRE, al servir.
 *
 * QUÉ SE QUITA
 * ------------
 *  · `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>` — enteros,
 *    con su contenido. Ejecutan código o cargan recursos que lo ejecutan.
 *  · `<meta>`, `<base>`, `<link>`, `<frame>`, `<frameset>` — redirigen la
 *    página (meta refresh), secuestran la base de las URLs relativas o
 *    cargan recursos externos.
 *  · Todos los atributos manejadores de eventos `on*` (`onclick`,
 *    `onerror`, `onload`, `onmouseover`, …), estén pegados a un espacio o
 *    a una comilla (`href="x"onerror=…`).
 *  · Atributos de URL (`href`, `src`, `xlink:href`, `action`,
 *    `formaction`, `poster`, `background`, `srcdoc`, `data`, `ping`) cuyo
 *    valor —ya decodificadas las entidades y quitados los controles— use
 *    un esquema peligroso: `javascript:`, `vbscript:`, `livescript:`,
 *    `data:text/html`, `data:image/svg`, etc. El atributo se borra.
 *
 * QUÉ SE CONSERVA (a propósito)
 * -----------------------------
 *  · Estilos: `<style>` y el atributo `style` quedan intactos — el CSS no
 *    ejecuta JavaScript en los navegadores modernos (`expression()` murió
 *    con IE y `url(javascript:)` no corre), y es TODO el diseño.
 *  · Imágenes (`<img>`, incluidas `data:image/...` rasterizadas), audio y
 *    video, y la estructura completa (secciones, textos, botones).
 *  · Los ganchos de React de las plantillas: `data-bookea="cuenta-regresiva"`
 *    y `data-bookea="abrir-rsvp"` sobreviven, así que la cuenta regresiva
 *    viva y el RSVP siguen funcionando (los monta React, no un `<script>`).
 *
 * CONSECUENCIA CONOCIDA
 * ---------------------
 * Las plantillas sembradas (docs/plantillas-invitaciones) movían con
 * `<script>` sus adornos: la música al abrir el sobre, los pétalos, la
 * apertura del sobre. Al sacar los scripts esos gestos dejan de correr;
 * el `<audio>` y el botón quedan pintados pero mudos. Es el costo aceptado
 * del arreglo: lo interactivo que valga la pena se reimplementa como la
 * cuenta regresiva y el RSVP, con un gancho `data-bookea` que monta React.
 *
 * Es una allowlist de esquemas + denylist de elementos/atributos hecha con
 * regex, a propósito sin dependencias. Es conservadora: ante la duda, saca.
 */

// Elementos que se borran ENTEROS (apertura, contenido y cierre).
const ELEMENTOS_CON_CONTENIDO = ["script", "iframe", "object", "embed", "applet"];

// Elementos vacíos (sin cierre) que redirigen o cambian el contexto.
const ELEMENTOS_VACIOS = ["meta", "base", "link", "frame", "frameset"];

// Atributos cuyo valor es una URL y por lo tanto puede llevar un esquema.
const ATRIBUTOS_URL =
  "href|src|xlink:href|action|formaction|poster|background|srcdoc|data|ping";

/**
 * Decodifica las entidades que un atacante puede usar para esconder el
 * esquema: numéricas (`&#106;` = "j", `&#x6a;`), y las nombradas que
 * importan para colar un `javascript:` (`&colon;`, tab, salto). Alcanza
 * con estas: el resto no cambia el esquema.
 */
function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex: string) =>
      cadenaDeCodigo(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);?/g, (_m, dec: string) => cadenaDeCodigo(parseInt(dec, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&amp;/gi, "&");
}

/** parseInt puede dar NaN o un código inválido; ahí no se agrega nada. */
function cadenaDeCodigo(codigo: number): string {
  if (!Number.isFinite(codigo) || codigo < 0 || codigo > 0x10ffff) return "";
  try {
    return String.fromCodePoint(codigo);
  } catch {
    return "";
  }
}

/**
 * true si el valor de un atributo de URL usa un esquema que puede ejecutar
 * código. Antes de mirar decodifica las entidades y saca los caracteres de
 * control/espacios que el navegador ignora dentro del esquema.
 */
function esquemaPeligroso(valor: string): boolean {
  const decodificado = decodificarEntidades(valor);
  let limpio = "";
  for (const ch of decodificado) {
    const c = ch.charCodeAt(0);
    // Controles C0, espacio, DEL, controles C1 y NBSP: fuera.
    if (c <= 0x20 || (c >= 0x7f && c <= 0xa0)) continue;
    limpio += ch;
  }
  limpio = limpio.toLowerCase();

  if (/^(javascript|vbscript|livescript|mocha):/.test(limpio)) return true;
  if (/^data:/.test(limpio)) {
    // De los `data:` solo se dejan pasar las imágenes rasterizadas; el
    // text/html y el svg pueden traer script adentro.
    return !/^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)\b/.test(
      limpio,
    );
  }
  return false;
}

/** Borra los elementos peligrosos, repitiendo hasta que no cambie más
 *  (así se deshacen ofuscaciones tipo `<scr<script>ipt>`). */
function quitarElementos(html: string): string {
  let actual = html;
  let anterior: string;
  let vueltas = 0;
  do {
    anterior = actual;
    for (const tag of ELEMENTOS_CON_CONTENIDO) {
      // Par completo con su contenido…
      actual = actual.replace(
        new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"),
        "",
      );
      // …y cualquier apertura o cierre huérfano (script sin cerrar, etc.).
      actual = actual.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
    }
    for (const tag of ELEMENTOS_VACIOS) {
      actual = actual.replace(new RegExp(`<${tag}\\b[^>]*>`, "gi"), "");
    }
    vueltas += 1;
  } while (actual !== anterior && vueltas < 5);
  return actual;
}

/**
 * Saca los atributos manejadores de eventos `on*`. El primer grupo captura
 * el carácter que separa el atributo (espacio o comilla de cierre del
 * anterior) y se conserva, para no pegar dos atributos que no lo estaban.
 */
function quitarManejadores(html: string): string {
  return html.replace(
    /([\s"'/`])on[a-z][a-z0-9-]*\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    "$1",
  );
}

/** Borra los atributos de URL cuyo valor use un esquema peligroso. */
function quitarEsquemasPeligrosos(html: string): string {
  return html.replace(
    new RegExp(`\\b(${ATRIBUTOS_URL})\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "gi"),
    (match: string, _attr: string, valor: string) => {
      const sinComillas = valor.replace(/^["']|["']$/g, "");
      return esquemaPeligroso(sinComillas) ? "" : match;
    },
  );
}

/**
 * Punto de entrada. Devuelve el HTML sin lo que pueda ejecutar código,
 * listo para `dangerouslySetInnerHTML`. Idempotente: correrlo sobre HTML
 * ya saneado no cambia nada.
 */
export function sanearHtmlInvitacion(html: string | null | undefined): string {
  if (typeof html !== "string" || !html) return "";
  let salida = quitarElementos(html);
  salida = quitarManejadores(salida);
  salida = quitarEsquemasPeligrosos(salida);
  return salida;
}
