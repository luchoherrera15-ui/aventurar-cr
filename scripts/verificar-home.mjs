/**
 * ════════════════════════════════════════════════════════════════════
 *  VERIFICAR EL HOME — el arnés del rediseño de bookea.lat
 * ════════════════════════════════════════════════════════════════════
 *
 * El home tiene DOS MODOS en una sola ruta (ver docs/home-plan.md):
 *
 *   `/` sin parámetros          → MODO PLATAFORMA (el nuevo, B2B)
 *   `/` con q/lugar/rubro/sub   → MODO DESCUBRIR  (el de siempre)
 *
 * El modo Descubrir NO es una pantalla más: es a donde caen los 301 de
 * los directorios borrados (`/citas`, `/eventos`, `/ranchos-eventos`)
 * con el query intacto, y eso incluye links compartidos por WhatsApp,
 * favoritos y resultados de Google todavía indexados.
 *
 * Por eso existe este script: se corre ANTES de tocar el home para
 * tomar la línea base, y DESPUÉS DE CADA PASO para probar que no se
 * rompió. Es la red de seguridad del rediseño.
 *
 * Uso:
 *   node scripts/verificar-home.mjs                    (localhost:3100)
 *   node scripts/verificar-home.mjs https://www.bookea.lat
 *
 * Sale con código 1 si algo falla, para poder encadenarlo.
 */

const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/+$/, "");

let fallos = 0;
let pruebas = 0;

const verde = (t) => `\x1b[32m${t}\x1b[0m`;
const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
const gris = (t) => `\x1b[90m${t}\x1b[0m`;

function marcar(ok, etiqueta, detalle) {
  pruebas++;
  if (!ok) fallos++;
  const icono = ok ? verde("OK  ") : rojo("FALLA");
  console.log(`  ${icono} ${etiqueta.padEnd(38)} ${gris(detalle)}`);
}

/**
 * Cómo se reconoce cada modo desde afuera: por su H1, que es lo que
 * de verdad ve quien llega (y lo que lee Google).
 *
 * Están acá y no en el código del sitio a propósito: si alguien cambia
 * el titular, este arnés tiene que CHILLAR y obligar a decidir si el
 * cambio fue deliberado. Un arnés que se adapta solo no protege nada.
 */
const H1 = {
  plataforma: "Aumentá tus ventas con Bookea.",
  descubrir: "¿Qué querés reservar?",
};

/** Una página del home: responde 200 y la contesta el modo correcto. */
async function pagina(ruta, etiqueta, { modo = null, esperaFichas = null } = {}) {
  let res, html;
  try {
    res = await fetch(BASE + ruta, { redirect: "follow" });
    html = await res.text();
  } catch (e) {
    marcar(false, etiqueta, `no respondió: ${e.message}`);
    return null;
  }

  // Las fichas de negocio que la página enlaza. Es la señal de que el
  // catálogo se renderizó en el servidor (o sea: rastreable por Google).
  const fichas = new Set(
    [...html.matchAll(/href="(\/(?:citas|eventos|hospedajes|restaurantes)\/[^"]+)"/g)].map(
      (m) => m[1],
    ),
  );
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1]
    ?.replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 48);

  const modoOk = modo === null || h1 === H1[modo];
  const ok =
    res.status === 200 &&
    modoOk &&
    (esperaFichas === null || fichas.size >= esperaFichas);
  const nota = modoOk ? "" : rojo(` ← esperaba modo ${modo}`);
  marcar(ok, etiqueta, `${res.status} · fichas:${fichas.size} · h1:"${h1 ?? "—"}"${nota}`);
  return { status: res.status, fichas: fichas.size, h1, html };
}

/** Un 301/308 que TIENE que conservar el query tal cual llegó. */
async function redirige(ruta, destinoEsperado, etiqueta) {
  let res;
  try {
    res = await fetch(BASE + ruta, { redirect: "manual" });
  } catch (e) {
    marcar(false, etiqueta, `no respondió: ${e.message}`);
    return;
  }
  const destino = res.headers.get("location") ?? "";
  const soloRuta = destino.replace(/^https?:\/\/[^/]+/, "") || "/";
  const esRedirect = res.status === 301 || res.status === 308;
  marcar(
    esRedirect && soloRuta === destinoEsperado,
    etiqueta,
    `${res.status} -> ${soloRuta}  ${gris(`(esperado ${destinoEsperado})`)}`,
  );
}

/** Una ficha que NO debe redirigir jamás: su link vive en correos y QR. */
async function fichaViva(ruta, etiqueta) {
  let res;
  try {
    res = await fetch(BASE + ruta, { redirect: "manual" });
  } catch (e) {
    marcar(false, etiqueta, `no respondió: ${e.message}`);
    return;
  }
  // 404 es correcto para un slug inventado; lo que NO puede pasar es un
  // 301/308, que se llevaría puestas TODAS las fichas reales.
  const redirigio = res.status === 301 || res.status === 308;
  marcar(!redirigio, etiqueta, `${res.status} ${redirigio ? "← REDIRIGIÓ" : "(no redirige)"}`);
}

console.log(`\n${"=".repeat(68)}`);
console.log(` VERIFICAR EL HOME   ${BASE}`);
console.log(`${"=".repeat(68)}\n`);

const M = { modo: "descubrir" };

console.log("MODO PLATAFORMA — la portada limpia");
await pagina("/", "/ (sin parámetros)", { modo: "plataforma" });
await pagina("/?utm_source=instagram", "?utm_source= (una campaña)", {
  modo: "plataforma",
});

console.log("\nMODO DESCUBRIR — cualquier parámetro de búsqueda");
await pagina("/?q=barberia", "?q=barberia", M);
await pagina("/?lugar=San%20Jose", "?lugar=San Jose", M);
await pagina("/?provincia=San%20Jose", "?provincia= (sinónimo de lugar)", M);
await pagina("/?rubro=citas", "?rubro=citas", M);
await pagina("/?rubro=citas&sub=citas-cat-barberia", "?rubro= + ?sub=", M);
await pagina("/?q=spa&lugar=Heredia", "?q= + ?lugar= (combinado)", M);
await pagina("/?q=", "?q= vacío (la presencia manda)", M);
await pagina("/?categoria=barberia", "?categoria= (lo emite el buscador)", M);

console.log("\n/all ES LA DIRECCIÓN FIJA DEL MARKETPLACE");
// Pedido del dueño (24 sep 2026). A diferencia de `/`, acá el catálogo
// sale SIN que haya que traer un parámetro — y eso es todo el punto de
// que esta dirección exista. Si algún día vuelve a caer en la landing
// de producto, este bloque chilla.
await pagina("/all", "/all (sin parámetros)", M);
await pagina("/all?rubro=citas", "/all?rubro= (los filtros siguen)", M);
await pagina("/all?q=barberia", "/all?q= (la búsqueda sigue)", M);
await fichaViva("/all", "/all nunca redirige");

console.log("\n/demo-bookea ES SIEMPRE DESCUBRIR");
// Existe para enseñar el catálogo lleno de negocios de muestra: en el
// modo Plataforma dejaría de mostrar lo único que la hace existir.
await pagina("/demo-bookea", "/demo-bookea (sin parámetros)", M);

console.log("\nEL ANCLA #catalogo EXISTE EN LOS DOS MODOS");
{
  const plataforma = await pagina("/", "/ tiene id=catalogo", { modo: "plataforma" });
  marcar(
    Boolean(plataforma?.html.includes('id="catalogo"')),
    "  el ancla del buscador",
    plataforma?.html.includes('id="catalogo"') ? "presente" : "FALTA",
  );
}

console.log("\nLOS 301 DE LOS DIRECTORIOS BORRADOS — con el query intacto");
await redirige("/citas", "/", "/citas");
await redirige("/eventos", "/", "/eventos");
await redirige("/ranchos-eventos", "/", "/ranchos-eventos");
await redirige("/citas?q=barberia", "/?q=barberia", "/citas + query");
await redirige(
  "/eventos?q=spa&lugar=Heredia",
  "/?q=spa&lugar=Heredia",
  "/eventos + query doble",
);

console.log("\nLAS FICHAS SIGUEN VIVAS — nunca redirigen");
await fichaViva("/citas/no-existe-a-proposito", "/citas/:slug");
await fichaViva("/eventos/no-existe-a-proposito", "/eventos/:id");

console.log(`\n${"=".repeat(68)}`);
if (fallos === 0) {
  console.log(verde(` TODO BIEN — ${pruebas} comprobaciones`));
} else {
  console.log(rojo(` ${fallos} FALLA(S) de ${pruebas} comprobaciones`));
}
console.log(`${"=".repeat(68)}\n`);

process.exit(fallos === 0 ? 0 : 1);
