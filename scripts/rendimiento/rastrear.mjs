// Traza de red completa vía CDP: cada solicitud con tiempos y bytes,
// más el inventario de imágenes (pedidas vs. visibles en pantalla).
// uso: node rastrear.mjs "<url>" <mobile|desktop> <etiqueta> [--rapido]
import fs from 'node:fs';
import path from 'node:path';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
const preset = process.argv[3] || 'mobile';
const label = process.argv[4] || 'traza';
const sinThrottle = process.argv.includes('--rapido');

const OUT = path.join(process.cwd(), 'resultados');
fs.mkdirSync(OUT, { recursive: true });

const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--ignore-certificate-errors'],
});

const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${chrome.port}`,
  defaultViewport: null,
});

try {
  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Page.enable');

  if (preset === 'mobile') {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    );
    if (!sinThrottle) {
      // mismas condiciones que Lighthouse móvil: 4G lento + CPU 4x
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
  } else {
    await page.setViewport({ width: 1350, height: 940, deviceScaleFactor: 1 });
  }

  const reqs = new Map();
  const orden = [];

  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.redirectResponse) {
      const previo = reqs.get(e.requestId);
      if (previo) {
        previo.redirecciones.push({
          url: e.redirectResponse.url,
          status: e.redirectResponse.status,
          location: e.redirectResponse.headers?.location || e.redirectResponse.headers?.Location || null,
        });
      }
    }
    if (!reqs.has(e.requestId)) {
      reqs.set(e.requestId, {
        id: e.requestId,
        url: e.request.url,
        metodo: e.request.method,
        tipo: e.type,
        iniciador: e.initiator?.type,
        iniciadorUrl: e.initiator?.url || e.initiator?.stack?.callFrames?.[0]?.url || null,
        inicio: e.timestamp,
        wallTime: e.wallTime,
        redirecciones: [],
        bytes: 0,
        status: null,
        mime: null,
        protocolo: null,
        desdeCache: false,
        fin: null,
        ttfb: null,
      });
      orden.push(e.requestId);
    } else {
      // tras un redirect, la petición sigue con el mismo id
      const r = reqs.get(e.requestId);
      r.url = e.request.url;
    }
  });

  cdp.on('Network.responseReceived', (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.status = e.response.status;
    r.mime = e.response.mimeType;
    r.protocolo = e.response.protocol;
    r.desdeCache = e.response.fromDiskCache || e.response.fromServiceWorker || false;
    r.tipo = e.type || r.tipo;
    const t = e.response.timing;
    if (t) {
      r.ttfb = Math.round(t.receiveHeadersEnd - t.sendEnd);
      r.esperaCola = Math.round(t.sendStart);
      r.dns = t.dnsEnd > 0 ? Math.round(t.dnsEnd - t.dnsStart) : 0;
      r.conexion = t.connectEnd > 0 ? Math.round(t.connectEnd - t.connectStart) : 0;
      r.tls = t.sslEnd > 0 ? Math.round(t.sslEnd - t.sslStart) : 0;
      r.requestTime = t.requestTime;
    }
    const cabecerasInteresantes = ['content-encoding', 'cache-control', 'x-vercel-cache', 'age', 'content-type'];
    r.cabeceras = {};
    for (const [k, v] of Object.entries(e.response.headers || {})) {
      if (cabecerasInteresantes.includes(k.toLowerCase())) r.cabeceras[k.toLowerCase()] = v;
    }
  });

  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.bytes = e.encodedDataLength;
    r.fin = e.timestamp;
  });

  cdp.on('Network.loadingFailed', (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.fallo = e.errorText;
    r.fin = e.timestamp;
  });

  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  const tLoad = Date.now() - t0;

  // dejamos correr la hidratación y lo que dispare después
  await new Promise((r) => setTimeout(r, sinThrottle ? 3000 : 6000));
  const tTotal = Date.now() - t0;

  const metricas = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = {};
    for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime);
    return {
      ttfbNav: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
      respuestaCompleta: nav ? Math.round(nav.responseEnd - nav.requestStart) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      redirecciones: nav ? { cantidad: nav.redirectCount, ms: Math.round(nav.redirectEnd - nav.redirectStart) } : null,
      transferSizeDoc: nav ? nav.transferSize : null,
      paints,
    };
  });

  // inventario de imágenes: cuáles se pidieron y cuáles se ven de verdad
  const imagenes = await page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const salida = [];
    for (const img of Array.from(document.images)) {
      const r = img.getBoundingClientRect();
      const visible =
        r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      salida.push({
        src: img.currentSrc || img.src,
        cargada: img.complete && img.naturalWidth > 0,
        natural: [img.naturalWidth, img.naturalHeight],
        mostrada: [Math.round(r.width), Math.round(r.height)],
        dpr: window.devicePixelRatio,
        loading: img.loading,
        fetchpriority: img.getAttribute('fetchpriority'),
        sizes: img.getAttribute('sizes'),
        enPantalla: visible,
        topAbsoluto: Math.round(r.top + window.scrollY),
      });
    }
    // fondos CSS que también pesan
    const fondos = [];
    for (const el of Array.from(document.querySelectorAll('*')).slice(0, 3000)) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && bg.includes('url(')) {
        const r = el.getBoundingClientRect();
        fondos.push({ bg: bg.slice(0, 200), enPantalla: r.top < vh && r.bottom > 0 });
      }
    }
    return { imgs: salida, fondos: fondos.slice(0, 30), viewport: [vw, vh] };
  });

  const enlaces = await page.evaluate(() =>
    Array.from(new Set(Array.from(document.querySelectorAll('a[href^="/"]')).map((a) => a.getAttribute('href')))).slice(
      0,
      60,
    ),
  );

  const lista = orden.map((id) => reqs.get(id)).filter(Boolean);
  const base = lista.length ? Math.min(...lista.map((r) => r.inicio)) : 0;
  for (const r of lista) {
    r.inicioMs = Math.round((r.inicio - base) * 1000);
    r.finMs = r.fin ? Math.round((r.fin - base) * 1000) : null;
    r.duracionMs = r.finMs != null ? r.finMs - r.inicioMs : null;
    delete r.inicio;
    delete r.fin;
    delete r.requestTime;
    delete r.wallTime;
  }

  const datos = {
    label,
    url,
    urlFinal: page.url(),
    preset,
    throttling: sinThrottle ? 'ninguno' : preset === 'mobile' ? '4G lento + CPU 4x' : 'ninguno',
    statusDocumento: resp?.status(),
    tLoadMs: tLoad,
    tTotalMs: tTotal,
    metricas,
    solicitudes: lista,
    imagenes,
    enlaces,
  };

  fs.writeFileSync(path.join(OUT, `${label}.traza.json`), JSON.stringify(datos));
  console.log(
    `${label}: ${lista.length} solicitudes, ${(lista.reduce((s, r) => s + (r.bytes || 0), 0) / 1048576).toFixed(2)} MB, load ${tLoad} ms`,
  );
  console.log('enlaces:', enlaces.slice(0, 25).join(' '));
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
