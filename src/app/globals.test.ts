import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LA MINA QUE DEJÓ INVISIBLE A LEALTAD (y a siete pantallas más).
 *
 * `globals.css` tenía esto:
 *
 *     @media (prefers-color-scheme: dark) {
 *       html, body, header, main, section {
 *         background-color: #fff !important;
 *       }
 *     }
 *
 * y toda pantalla oscura del sitio se pinta así:
 *
 *     <main style={{ background: "#0a1226" }}>   // /lealtad
 *     <main className="bg-[#16295e]">            // /i/[slug]
 *
 * En la cascada de CSS, una declaración `!important` de la hoja de
 * estilos le gana al atributo `style` en línea; y una regla SIN capa
 * (`main { … }`) le gana a las utilidades de Tailwind v4, que viven en
 * `@layer utilities`. O sea que las dos formas de declarar un fondo
 * oscuro perdían contra esa regla.
 *
 * Con el sistema operativo en modo oscuro —encendido mucho más seguido
 * en una Mac que en Windows, de ahí «desde una Mac no se ve nada»— esas
 * pantallas quedaban con fondo BLANCO y su texto blanco encima. La
 * página cargaba entera y no se veía nada.
 *
 * Estas pruebas no necesitan una Mac ni un navegador: leen el CSS y
 * comprueban la propiedad que tiene que cumplirse siempre.
 */

const RAIZ = process.cwd();
const FUENTE = join(RAIZ, "src/app/globals.css");

/**
 * Fuera los comentarios antes de parsear. Este archivo está MUY
 * comentado y esos comentarios traen comas, llaves y `!important`
 * citados: sin sacarlos, el texto de un comentario se lee como si
 * fuera un selector y la prueba acusa a la documentación.
 */
function sinComentarios(css: string): string {
  // Se reemplaza por espacios del mismo largo para no correr los
  // índices, que es lo que usa el recorte de bloques.
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length));
}

/** Recorta el bloque `{ … }` que arranca en `desde`, contando llaves. */
function bloqueDesde(css: string, desde: number): { cuerpo: string; fin: number } {
  const abre = css.indexOf("{", desde);
  let prof = 0;
  for (let i = abre; i < css.length; i++) {
    if (css[i] === "{") prof++;
    else if (css[i] === "}") {
      prof--;
      if (prof === 0) return { cuerpo: css.slice(abre + 1, i), fin: i };
    }
  }
  return { cuerpo: "", fin: css.length };
}

/** Todos los `@media` cuyo prelude menciona `prefers-color-scheme`. */
function bloquesDeEsquemaOscuro(css: string): string[] {
  const bloques: string[] = [];
  const re = /@media[^{]*prefers-color-scheme[^{]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const { cuerpo, fin } = bloqueDesde(css, m.index);
    bloques.push(cuerpo);
    re.lastIndex = fin;
  }
  return bloques;
}

/** Las reglas `selector { declaraciones }` de primer nivel de un bloque. */
function reglasDe(cuerpo: string): { selector: string; decls: string }[] {
  const reglas: { selector: string; decls: string }[] = [];
  let i = 0;
  let inicio = 0;
  while (i < cuerpo.length) {
    if (cuerpo[i] === "{") {
      const selector = cuerpo.slice(inicio, i).trim();
      const { cuerpo: decls, fin } = bloqueDesde(cuerpo, inicio);
      reglas.push({ selector, decls });
      i = fin + 1;
      inicio = i;
      continue;
    }
    if (cuerpo[i] === ";") inicio = i + 1;
    i++;
  }
  return reglas;
}

/**
 * El LIENZO: los únicos elementos a los que una regla de modo oscuro
 * puede pintarles el fondo. Ninguno de los tres es un contenedor que
 * una pantalla use para declarar su propio color.
 */
const SELECTORES_DE_LIENZO = new Set([":root", "html", "body"]);

const PROPIEDADES_DE_PINTURA = /(^|[;{\s])(background|background-color|color)\s*:/;

/**
 * Las reglas de modo oscuro que le pintan el fondo (o el color) a algo
 * que NO es el lienzo. Devuelve una lista vacía cuando el CSS está bien.
 */
function reglasQuePisanContenedores(css: string): string[] {
  const culpables: string[] = [];
  for (const bloque of bloquesDeEsquemaOscuro(sinComentarios(css))) {
    for (const { selector, decls } of reglasDe(bloque)) {
      if (!PROPIEDADES_DE_PINTURA.test(decls)) continue;
      for (const parte of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (SELECTORES_DE_LIENZO.has(parte)) continue;
        culpables.push(`${parte} { ${decls.trim().replace(/\s+/g, " ")} }`);
      }
    }
  }
  return culpables;
}

/** Igual, pero para cualquier `!important` de modo oscuro fuera del lienzo. */
function importantesFueraDelLienzo(css: string): string[] {
  const culpables: string[] = [];
  for (const bloque of bloquesDeEsquemaOscuro(sinComentarios(css))) {
    for (const { selector, decls } of reglasDe(bloque)) {
      if (!/!important/.test(decls)) continue;
      for (const parte of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (SELECTORES_DE_LIENZO.has(parte)) continue;
        culpables.push(`${parte} { ${decls.trim().replace(/\s+/g, " ")} }`);
      }
    }
  }
  return culpables;
}

/** El CSS exacto que rompió el producto, tal como estaba en el repo. */
const CSS_DEL_BUG = `
@media (prefers-color-scheme: dark) {
  :root {
    --text: #161616;
    --bg: #ffffff;
  }
  html,
  body,
  header,
  main,
  section {
    background-color: #fff !important;
  }
}
`;

describe("el detector agarra el bug que ya pasó", () => {
  // Una prueba que nunca falla no comprueba nada. Estas dos fijan que el
  // detector SÍ reacciona al CSS que dejó Lealtad invisible — si alguien
  // afloja el parser, se entera acá y no en producción.
  it("acusa la regla vieja `html, body, header, main, section`", () => {
    expect(reglasQuePisanContenedores(CSS_DEL_BUG)).toEqual([
      "header { background-color: #fff !important; }",
      "main { background-color: #fff !important; }",
      "section { background-color: #fff !important; }",
    ]);
  });

  it("no acusa al bloque de tokens de :root, que es legítimo", () => {
    expect(reglasQuePisanContenedores(CSS_DEL_BUG)).not.toContain(
      expect.stringContaining(":root"),
    );
  });

  it("acusa también un fondo oscuro puesto SIN !important", () => {
    // Sin `!important` la regla igual gana contra `class="bg-[#16295e]"`,
    // porque las utilidades de Tailwind v4 viven en @layer y esta no.
    const sinImportante = `@media (prefers-color-scheme: dark) { main { background: #fff; } }`;
    expect(reglasQuePisanContenedores(sinImportante)).toHaveLength(1);
    expect(importantesFueraDelLienzo(sinImportante)).toHaveLength(0);
  });
});

describe("globals.css — el modo oscuro del sistema no puede borrar una pantalla oscura", () => {
  const css = readFileSync(FUENTE, "utf8");

  it("existe al menos un bloque @media (prefers-color-scheme) que revisar", () => {
    // Si algún día se borra el bloque entero, esta prueba avisa que las
    // de abajo dejaron de estar comprobando algo.
    expect(bloquesDeEsquemaOscuro(sinComentarios(css)).length).toBeGreaterThan(0);
  });

  it("ninguna regla de modo oscuro le pinta el fondo a un contenedor", () => {
    const culpables = reglasQuePisanContenedores(css);
    expect(
      culpables,
      [
        "Una regla dentro de @media (prefers-color-scheme: …) le está pintando",
        "el fondo o el color a algo que no es el lienzo (:root, html, body).",
        "",
        "Eso es exactamente lo que dejó /lealtad en blanco sobre blanco para",
        "quien tiene el sistema en modo oscuro: la regla le gana al `style=` en",
        "línea (si lleva !important) y a las utilidades de Tailwind (por estar",
        "sin capa), así que la pantalla pierde su fondo navy y conserva su texto",
        "blanco.",
        "",
        "Si hace falta tocar el modo oscuro, hacelo sobre los TOKENS de :root,",
        "no sobre contenedores.",
        "",
        "Reglas encontradas:",
        ...culpables.map((c) => `  · ${c}`),
      ].join("\n"),
    ).toEqual([]);
  });

  it("no queda ningún !important de modo oscuro fuera del lienzo", () => {
    // Cinturón además de los tirantes: aunque la propiedad no sea de
    // pintura, un `!important` de modo oscuro sobre un contenedor es la
    // misma clase de trampa.
    expect(importantesFueraDelLienzo(css)).toEqual([]);
  });
});

/**
 * SEGUNDA PROPIEDAD, INDEPENDIENTE: que el CSS que se sirve traiga un
 * valor plano antes de cada `color-mix()`.
 *
 * Tailwind v4 + Lightning CSS ya lo hacen solos —emiten el hexadecimal
 * y después el `color-mix()` dentro de `@supports (color: color-mix(in
 * lab, red, red))`— así que hoy esto pasa sin que nadie escriba nada.
 * La prueba está para que se entere alguien si un cambio de
 * herramientas (un `browserslist`, otra versión de Next, un plugin de
 * PostCSS) deja de emitir el respaldo: ese día el sitio se rompería
 * SOLO en navegadores viejos, que es justo donde nadie mira.
 *
 * Corre contra el CSS realmente construido. Si no hay build, se salta:
 * no vale la pena pagar un `next build` en cada corrida de tests.
 */
function cssConstruido(): string | null {
  // Next 16 con Turbopack deja el CSS en `static/chunks` (producción) y
  // en `dev/static/chunks` (dev), repartido en un archivo por ruta — NO
  // en `static/css`, que es donde lo dejaba el compilador viejo. Se leen
  // TODOS: la regla peligrosa podría entrar por cualquier hoja, no solo
  // por globals.css (hay `.css` propios en src/app/lealtad/).
  for (const dir of [join(RAIZ, ".next/static/chunks"), join(RAIZ, ".next/dev/static/chunks")]) {
    if (!existsSync(dir)) continue;
    const archivos = readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => join(dir, f));
    if (archivos.length)
      return sinComentarios(archivos.map((f) => readFileSync(f, "utf8")).join("\n"));
  }
  return null;
}

describe("CSS construido — lo que de verdad se le sirve al navegador", () => {
  const css = cssConstruido();

  it.skipIf(!css)("ninguna hoja pisa el fondo de un contenedor en modo oscuro", () => {
    // El mismo invariante que arriba, pero sobre el CSS ya construido:
    // acá se atrapa también la regla que entre por otra hoja (un .css de
    // src/app/lealtad, un CSS module) y no por globals.css.
    expect(reglasQuePisanContenedores(css as string)).toEqual([]);
  });

  it.skipIf(!css)("todo color-mix() viaja dentro de un @supports que lo protege", () => {
    const texto = css as string;
    const pila: string[] = [];
    const sueltos: string[] = [];
    let inicio = 0;
    let i = 0;

    while (i < texto.length) {
      const c = texto[i];
      if (c === "{") {
        pila.push(texto.slice(inicio, i).trim());
        inicio = ++i;
        continue;
      }
      if (c === "}") {
        pila.pop();
        inicio = ++i;
        continue;
      }
      if (c === ";") {
        inicio = ++i;
        continue;
      }
      if (texto.startsWith("color-mix(", i)) {
        // El `color-mix(` que está DENTRO del prelude de un @supports es
        // la prueba de capacidad, no un uso: no cuenta.
        const enPrelude = texto.slice(inicio, i).includes("@supports");
        if (!enPrelude && !pila.some((p) => /@supports[^{]*color-mix/i.test(p))) {
          sueltos.push(
            texto.slice(inicio, Math.min(texto.indexOf(";", i) + 1 || texto.length, inicio + 140)).trim(),
          );
        }
        i += "color-mix(".length;
        continue;
      }
      i++;
    }

    expect(
      sueltos,
      [
        "Hay color-mix() sin un @supports que lo proteja. En un navegador que",
        "no soporte color-mix() (Safari < 16.2) esa declaración se descarta y",
        "el elemento se queda sin fondo o sin color.",
        "",
        ...sueltos.slice(0, 10).map((s) => `  · ${s}`),
      ].join("\n"),
    ).toEqual([]);
  });
});
