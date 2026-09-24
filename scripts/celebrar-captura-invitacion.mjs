/**
 * Captura una invitación pública de CELEBRAR en escritorio y en teléfono
 * (varias escenas), con CDP directo: el screenshot normal de Playwright
 * se queda esperando `document.fonts` (Chrome deja `status: loading`
 * con los <link> de Google Fonts), y CDP no espera nada.
 *
 *   node scripts/celebrar-captura-invitacion.mjs <slug> [carpeta] [ancho,ancho…]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const BASE = process.env.BASE ?? "http://localhost:3100";
const slug = process.argv[2] ?? "sofia-y-andres";
const salida = process.argv[3] ?? ".";
const anchos = (process.argv[4] ?? "1500,390").split(",").map(Number);

const require = createRequire(import.meta.url);
const candidatos = fs
  .readdirSync("C:/Users/luis h/AppData/Local/npm-cache/_npx")
  .map((d) => `C:/Users/luis h/AppData/Local/npm-cache/_npx/${d}/node_modules/playwright-core`)
  .filter((d) => fs.existsSync(d));
const { chromium } = require(candidatos[0]);
console.log("playwright-core:", candidatos[0]);
const browser = await chromium.launch({ channel: "chrome", headless: true });
console.log("chrome listo");

for (const ancho of anchos) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho < 700 ? 844 : 940 }, deviceScaleFactor: 1, isMobile: ancho < 700 });
  const page = await ctx.newPage();
  await page.route("**/google.com/maps**", (r) => r.abort());
  console.log("abriendo", ancho);
  await page.goto(`${BASE}/celebrar/${slug}`, { waitUntil: "commit", timeout: 60000 });
  console.log("commit");
  await page.waitForSelector(".inv-esc", { timeout: 60000, state: "attached" });
  console.log("escenas listas");
  await page.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(page);
  const total = await page.evaluate(() => document.querySelectorAll(".inv-esc").length);
  for (let i = 0; i < total; i++) {
    await page.evaluate((k) => document.querySelectorAll(".inv-esc")[k]?.scrollIntoView({ block: "start" }), i);
    await page.waitForTimeout(1300);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 72 });
    const f = path.join(salida, `inv-${slug}-${ancho}-${String(i + 1).padStart(2, "0")}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, "base64"));
    console.log("→", f);
  }
  await cdp.detach();
  await ctx.close();
}
await browser.close();
