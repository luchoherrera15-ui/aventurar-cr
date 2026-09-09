// Recorre el paso nuevo de /lealtad/crear en Chrome: elige «Necesito
// ayuda», un día, una hora, llena el formulario y envía. Sin sesión.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dir = fs
  .readdirSync("C:/Users/luis h/AppData/Local/npm-cache/_npx")
  .map((d) => `C:/Users/luis h/AppData/Local/npm-cache/_npx/${d}/node_modules/playwright-core`)
  .find((d) => fs.existsSync(d));
const { chromium } = require(dir);
const salida = process.argv[2] ?? "c:/Users/luis h/aventurar-cr";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errores = [];
page.on("pageerror", (e) => errores.push(e.message));
await page.goto("http://localhost:3100/lealtad/crear", { waitUntil: "networkidle", timeout: 120000 });
await page.evaluate(() => sessionStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.screenshot({ path: path.join(salida, "lealtad-camino.png") });

await page.locator("button", { hasText: "ayuda para configurar" }).first().click({ timeout: 60000 });
await page.getByText("Elegí día y hora").waitFor({ timeout: 60000 });
await page.getByRole("group", { name: "Día de la reunión" }).getByRole("button").first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(salida, "lealtad-agenda-debug.png") });
console.log("grupos hora:", await page.getByRole("group", { name: "Hora de la reunión" }).count(), "· botones 10:00:", await page.locator("button", { hasText: "10:00" }).count(), "· errores:", errores);
const hora = page.getByRole("group", { name: "Hora de la reunión" }).getByRole("button", { name: "10:00" });
await hora.click();
await page.fill("#reu-nombre", "Prueba Agenda");
await page.fill("#reu-correo", "prueba.agenda@bookea.lat");
await page.fill("#reu-telefono", "88887777");
await page.fill("#reu-negocio", "Café de prueba");
await page.screenshot({ path: path.join(salida, "lealtad-agenda.png") });
await page.getByRole("button", { name: /Programar la reunión/ }).click();
await page.waitForTimeout(3000);
const texto = (await page.locator("main").textContent()) ?? "";
const ok = texto.includes("Reunión programada");
const motivo = texto.match(/Falta aplicar la migración 0240[^.]*\.|Ese horario[^.]*\.|No se pudo[^.]*\./)?.[0] ?? null;
console.log("resultado:", ok ? "programada" : (motivo ?? "sin confirmación"), "· errores de página:", errores.length ? errores : "ninguno");
await page.screenshot({ path: path.join(salida, "lealtad-agenda-resultado.png") });
await browser.close();
