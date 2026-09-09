// Prueba el recortador del editor con sesión real: elige un PNG en el
// uploader del logo y comprueba que el diálogo muestre la imagen y
// habilite «Recortar y subir». Mismo armado de sesión que captura-panel.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const raiz = "c:/Users/luis h/aventurar-cr";
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()];
    }),
);
const email = process.argv[2] ?? "luchoherrera15@gmail.com";
const negocio = process.argv[3] ?? "b1288b5e-d2d5-48b8-b044-475540af8d11";
const salida = process.argv[4] ?? raiz;
const imagen = process.argv[5] ?? path.join(raiz, "referencia/imagenes/ChatGPT Image 7 sept 2026, 09_21_11.png");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: v, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (error) throw error;
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const valor = "base64-" + Buffer.from(JSON.stringify(v.session)).toString("base64url");
const trozos = [];
for (let i = 0; i * 3180 < valor.length; i++) trozos.push(valor.slice(i * 3180, (i + 1) * 3180));

const require = createRequire(import.meta.url);
const dir = fs
  .readdirSync("C:/Users/luis h/AppData/Local/npm-cache/_npx")
  .map((d) => `C:/Users/luis h/AppData/Local/npm-cache/_npx/${d}/node_modules/playwright-core`)
  .find((d) => fs.existsSync(d));
const { chromium } = require(dir);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies(trozos.map((t, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: t, url: "http://localhost:3100" })));
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.goto(`http://localhost:3100/solutions/panel/${negocio}?tab=pagina`, { waitUntil: "networkidle", timeout: 120000 });

// El primer input de archivo de la página es el del logo (card «El encabezado»).
const input = page.locator("input[type=file]").first();
await input.setInputFiles(imagen);
const dialogo = page.locator("[role=dialog]");
await dialogo.waitFor({ timeout: 15000 });
await page.waitForTimeout(1500);
const img = dialogo.locator("img").first();
const natural = await img.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight, visible: getComputedStyle(el).opacity }));
const boton = dialogo.getByRole("button", { name: "Recortar y subir" });
const habilitado = await boton.isEnabled();
const texto = (await dialogo.textContent()) ?? "";
console.log("imagen:", natural, "· botón habilitado:", habilitado, "· cargando visible:", texto.includes("Cargando la imagen"));
console.log("errores de página:", errores.length ? errores : "ninguno");
await page.screenshot({ path: path.join(salida, "recorte-dialogo.png") });
await browser.close();
if (!habilitado || natural.w === 0) process.exit(1);
