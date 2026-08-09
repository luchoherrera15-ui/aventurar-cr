// INP de laboratorio: carga la página, hace interacciones reales y mide
// la latencia de cada una con PerformanceObserver('event' + 'first-input').
// INP de campo necesita usuarios reales; esto es el proxy honesto en lab.
// uso: node interaccion.mjs "<url>" <mobile|desktop> <etiqueta>
import fs from 'node:fs';
import path from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
const preset = process.argv[3] || 'mobile';
const label = process.argv[4] || 'inp';

const OUT = path.join(process.cwd(), 'resultados');
fs.mkdirSync(OUT, { recursive: true });

const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}`, defaultViewport: null });

try {
  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();
  if (preset === 'mobile') {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // CPU de gama media
  } else {
    await page.setViewport({ width: 1350, height: 940, deviceScaleFactor: 1 });
  }

  await page.evaluateOnNewDocument(() => {
    window.__eventos = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__eventos.push({
          nombre: e.name,
          duracion: Math.round(e.duration),
          procesamiento: Math.round(e.processingEnd - e.processingStart),
          retraso: Math.round(e.processingStart - e.startTime),
          presentacion: Math.round(e.startTime + e.duration - e.processingEnd),
        });
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    window.__shifts = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 3000));

  const acciones = [];
  // 1) tocar los botones/chips visibles de la parte de arriba
  const clicables = await page.$$('button, [role="button"], a[href^="/"], [role="tab"]');
  for (const el of clicables.slice(0, 8)) {
    try {
      const caja = await el.boundingBox();
      if (!caja || caja.width < 8 || caja.height < 8 || caja.y > 800) continue;
      const texto = (await page.evaluate((e) => (e.textContent || '').trim().slice(0, 30), el)) || '(sin texto)';
      const href = await page.evaluate((e) => e.getAttribute('href'), el);
      if (href && !href.startsWith('#')) continue; // no navegar fuera
      await el.click({ delay: 20 });
      acciones.push(texto);
      await new Promise((r) => setTimeout(r, 700));
    } catch {
      /* elemento que se fue del DOM */
    }
  }
  // 2) desplazamiento largo (dispara lazy-loading y reflows)
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) {
      window.scrollBy(0, window.innerHeight * 0.9);
      await new Promise((r) => setTimeout(r, 220));
    }
  });
  await new Promise((r) => setTimeout(r, 2500));

  const datos = await page.evaluate(() => ({ eventos: window.__eventos, cls: window.__shifts }));
  const dur = datos.eventos.map((e) => e.duracion).sort((a, b) => a - b);
  const p98 = dur.length ? dur[Math.min(dur.length - 1, Math.floor(dur.length * 0.98))] : 0;

  const salida = {
    label,
    url,
    preset,
    interacciones: datos.eventos.length,
    acciones,
    inpAprox: dur.at(-1) || 0,
    p98,
    clsTrasInteraccion: +datos.cls.toFixed(3),
    peores: datos.eventos.sort((a, b) => b.duracion - a.duracion).slice(0, 10),
  };
  fs.writeFileSync(path.join(OUT, `${label}.inp.json`), JSON.stringify(salida, null, 2));
  console.log(
    `${label}: ${salida.interacciones} interacciones medidas | INP lab (peor) ${salida.inpAprox} ms | p98 ${p98} ms | CLS acumulado ${salida.clsTrasInteraccion}`,
  );
  salida.peores.slice(0, 5).forEach((e) =>
    console.log(`   ${String(e.duracion).padStart(4)} ms  ${e.nombre.padEnd(12)} (espera ${e.retraso} / handler ${e.procesamiento} / pintado ${e.presentacion})`),
  );
} catch (e) {
  console.error('FALLO', label, e.message);
  process.exitCode = 1;
} finally {
  try {
    await browser.disconnect();
  } catch {
    /* ignorado */
  }
  try {
    await chrome.kill();
  } catch {
    /* ignorado */
  }
}
