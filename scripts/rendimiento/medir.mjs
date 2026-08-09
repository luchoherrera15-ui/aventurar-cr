// Corre Lighthouse contra una URL y guarda el JSON completo.
// uso: node medir.mjs "<url>" <mobile|desktop> <etiqueta>
import fs from 'node:fs';
import path from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const url = process.argv[2];
const preset = process.argv[3] || 'mobile';
const label = process.argv[4] || 'sin-etiqueta';

const OUT = path.join(process.cwd(), 'resultados');
fs.mkdirSync(OUT, { recursive: true });

const desktopConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    emulatedUserAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    throttling: {
      rttMs: 40,
      throughputKbps: 10 * 1024,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
  },
};

const mobileConfig = {
  extends: 'lighthouse:default',
  settings: { formFactor: 'mobile' }, // por defecto: Moto G Power, 4G lento, CPU 4x
};

const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--ignore-certificate-errors'],
});

try {
  const runnerResult = await lighthouse(
    url,
    { logLevel: 'error', output: 'json', port: chrome.port, onlyCategories: ['performance'] },
    preset === 'desktop' ? desktopConfig : mobileConfig,
  );

  const lhr = runnerResult.lhr;
  const file = path.join(OUT, `${label}.json`);
  fs.writeFileSync(file, JSON.stringify(lhr));

  const a = lhr.audits;
  const n = (id) => (a[id] && typeof a[id].numericValue === 'number' ? Math.round(a[id].numericValue) : null);
  console.log(
    JSON.stringify(
      {
        label,
        url: lhr.finalDisplayedUrl,
        preset,
        score: Math.round((lhr.categories.performance.score || 0) * 100),
        FCP: n('first-contentful-paint'),
        LCP: n('largest-contentful-paint'),
        TTFB: n('server-response-time'),
        CLS: a['cumulative-layout-shift'] ? +a['cumulative-layout-shift'].numericValue.toFixed(3) : null,
        TBT: n('total-blocking-time'),
        SI: n('speed-index'),
        TTI: n('interactive'),
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error('FALLO', label, e.message);
  process.exitCode = 1;
} finally {
  // en Windows el borrado del perfil temporal tira EPERM; no invalida la medición
  try {
    await chrome.kill();
  } catch {
    /* ignorado a propósito */
  }
}
