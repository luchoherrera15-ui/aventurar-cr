// Convierte traza CDP + informe Lighthouse en la línea base pedida.
// uso: node analizar.mjs <etiqueta>
import fs from 'node:fs';
import path from 'node:path';

const label = process.argv[2];
const OUT = path.join(process.cwd(), 'resultados');
const kb = (b) => (b / 1024).toFixed(1) + ' KB';
const mb = (b) => (b / 1048576).toFixed(2) + ' MB';

const trazaFile = path.join(OUT, `${label}.traza.json`);
const lhFile = path.join(OUT, `${label}.json`);
const traza = fs.existsSync(trazaFile) ? JSON.parse(fs.readFileSync(trazaFile, 'utf8')) : null;
const lh = fs.existsSync(lhFile) ? JSON.parse(fs.readFileSync(lhFile, 'utf8')) : null;

console.log('='.repeat(78));
console.log('  ' + label + (traza ? '   ' + traza.urlFinal : ''));
console.log('='.repeat(78));

// ---------- 1. métricas ----------
if (lh) {
  const a = lh.audits;
  const n = (id) => (a[id] && typeof a[id].numericValue === 'number' ? a[id].numericValue : null);
  console.log('\n## Métricas Lighthouse (' + lh.configSettings.formFactor + ')');
  console.log('  Puntaje rendimiento : ' + Math.round((lh.categories.performance.score || 0) * 100));
  console.log('  FCP  : ' + Math.round(n('first-contentful-paint')) + ' ms');
  console.log('  LCP  : ' + Math.round(n('largest-contentful-paint')) + ' ms');
  console.log('  TTFB : ' + Math.round(n('server-response-time')) + ' ms  (audit server-response-time)');
  console.log('  CLS  : ' + n('cumulative-layout-shift').toFixed(3));
  console.log('  TBT  : ' + Math.round(n('total-blocking-time')) + ' ms');
  console.log('  Speed Index : ' + Math.round(n('speed-index')) + ' ms');
  console.log('  TTI  : ' + Math.round(n('interactive')) + ' ms');

  // Lighthouse 13 mueve esto a "insights"
  const desc = a['lcp-discovery-insight'];
  const nodo = desc?.details?.items?.find((i) => i.type === 'node');
  if (nodo) {
    console.log('\n## Elemento LCP exacto');
    console.log('  selector : ' + (nodo.selector || '?'));
    console.log('  etiqueta : ' + (nodo.nodeLabel || '?'));
    console.log('  caja     : ' + Math.round(nodo.boundingRect?.width) + 'x' + Math.round(nodo.boundingRect?.height) + ' en y=' + Math.round(nodo.boundingRect?.top));
    console.log('  html     : ' + (nodo.snippet || '?').slice(0, 300));
    const chk = desc.details.items.find((i) => i.type === 'checklist');
    if (chk?.items) for (const [k, v] of Object.entries(chk.items)) console.log('    ' + (v.value ? '✓' : '✗') + ' ' + v.label);
  }
  const fases = a['lcp-breakdown-insight']?.details?.items?.find((i) => i.type === 'table');
  if (fases?.items) {
    console.log('\n## Fases del LCP (dónde se van esos milisegundos)');
    const tot = fases.items.reduce((s, f) => s + f.duration, 0);
    for (const f of fases.items)
      console.log('    ' + f.label.padEnd(24) + String(Math.round(f.duration)).padStart(5) + ' ms   ' + ((f.duration / tot) * 100).toFixed(0) + '%');
    console.log('    ' + 'TOTAL'.padEnd(24) + String(Math.round(tot)).padStart(5) + ' ms');
  }
  const rb = a['render-blocking-insight']?.details?.items;
  if (rb?.length) {
    console.log('\n## Recursos que bloquean el pintado');
    for (const r of rb) console.log('    ' + kb(r.totalBytes).padStart(10) + '  ' + r.url.split('/').pop());
  }
  const idi = a['image-delivery-insight'];
  console.log('\n## Veredicto de Lighthouse sobre la entrega de imágenes');
  console.log('    ahorro estimado: ' + kb(idi?.details?.debugData?.wastedBytes || 0) + (idi?.details?.items?.length ? '' : '  (no encuentra nada que recortar)'));
  for (const it of idi?.details?.items || []) console.log('    - ' + (it.url || '').slice(0, 100) + '  ahorro ' + kb(it.wastedBytes || 0));
}

if (!traza) {
  console.log('\n(sin traza de red para esta etiqueta)');
  process.exit(0);
}

// ---------- 2. inventario de red ----------
const req = traza.solicitudes;
const bytesTotal = req.reduce((s, r) => s + (r.bytes || 0), 0);
console.log('\n## Red (traza CDP, throttling: ' + traza.throttling + ')');
console.log('  Solicitudes totales : ' + req.length);
console.log('  Bytes transferidos  : ' + mb(bytesTotal));
console.log('  load event          : ' + traza.metricas.load + ' ms');
console.log('  TTFB navegación     : ' + traza.metricas.ttfbNav + ' ms');
console.log('  Respuesta doc completa: ' + traza.metricas.respuestaCompleta + ' ms');
console.log('  FCP (paint API)     : ' + (traza.metricas.paints['first-contentful-paint'] ?? '?') + ' ms');

const porTipo = {};
for (const r of req) {
  const t = r.tipo || 'Otro';
  porTipo[t] = porTipo[t] || { n: 0, bytes: 0 };
  porTipo[t].n++;
  porTipo[t].bytes += r.bytes || 0;
}
console.log('\n  Por tipo de recurso:');
for (const [t, v] of Object.entries(porTipo).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log('    ' + t.padEnd(14) + String(v.n).padStart(3) + ' req   ' + kb(v.bytes).padStart(11));
}

// JS inicial
const js = req.filter((r) => r.tipo === 'Script');
const jsBytes = js.reduce((s, r) => s + (r.bytes || 0), 0);
console.log('\n  JavaScript inicial  : ' + kb(jsBytes) + ' en ' + js.length + ' archivos (transferido/comprimido)');

// ---------- 3. redirecciones ----------
console.log('\n## Redirecciones');
let hayRedir = false;
for (const r of req) {
  if (r.redirecciones?.length) {
    hayRedir = true;
    for (const rd of r.redirecciones)
      console.log('  ' + rd.status + '  ' + rd.url.slice(0, 90) + '  ->  ' + (rd.location || '?'));
  }
}
if (traza.metricas.redirecciones) {
  console.log('  navigation API: ' + traza.metricas.redirecciones.cantidad + ' redirecciones, ' + traza.metricas.redirecciones.ms + ' ms');
}
if (!hayRedir) console.log('  (ninguna en esta URL — ojo: medir también la URL de entrada real)');

// ---------- 4. 20 recursos más pesados ----------
console.log('\n## 20 recursos más pesados');
const pesados = [...req].sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 20);
pesados.forEach((r, i) => {
  const u = new URL(r.url.startsWith('data:') ? 'https://data.local/inline' : r.url);
  const nombre = r.url.startsWith('data:') ? '(data URI)' : u.pathname.split('/').pop() || u.pathname;
  console.log(
    '  ' +
      String(i + 1).padStart(2) +
      '. ' +
      kb(r.bytes || 0).padStart(10) +
      '  ' +
      String(r.duracionMs ?? '?').padStart(5) +
      ' ms  ' +
      (r.tipo || '').padEnd(10) +
      '  ' +
      u.hostname +
      '  ' +
      decodeURIComponent(nombre).slice(0, 70),
  );
});

// ---------- 5. imágenes ----------
const imgReq = req.filter((r) => r.tipo === 'Image');
const imgBytes = imgReq.reduce((s, r) => s + (r.bytes || 0), 0);
console.log('\n## Imágenes');
console.log('  Solicitadas en red : ' + imgReq.length + '   (' + kb(imgBytes) + ')');
const inv = traza.imagenes;
const enPantalla = inv.imgs.filter((i) => i.enPantalla);
console.log('  <img> en el DOM    : ' + inv.imgs.length);
console.log('  visibles en pantalla al cargar : ' + enPantalla.length);
console.log('  DESCARGADAS SIN APARECER EN PANTALLA : ' + inv.imgs.filter((i) => !i.enPantalla && i.cargada).length);
console.log('  viewport: ' + inv.viewport.join('x') + ' @' + (inv.imgs[0]?.dpr ?? '?') + 'x');

const sobredimension = inv.imgs
  .filter((i) => i.cargada && i.mostrada[0] > 0)
  .map((i) => ({ ...i, factor: i.natural[0] / (i.mostrada[0] * i.dpr) }))
  .filter((i) => i.factor > 1.3)
  .sort((a, b) => b.factor - a.factor);
if (sobredimension.length) {
  console.log('\n  Imágenes servidas más grandes de lo que se muestran (>1.3x incluso contando DPR):');
  sobredimension.slice(0, 12).forEach((i) => {
    console.log(
      '    ' +
        i.factor.toFixed(1) +
        'x  natural ' +
        i.natural.join('x') +
        ' -> mostrada ' +
        i.mostrada.join('x') +
        '  ' +
        (i.enPantalla ? '[en pantalla] ' : '[fuera] ') +
        decodeURIComponent(i.src).slice(0, 110),
    );
  });
}

const originales = imgReq.filter((r) => !r.url.includes('/_next/image') && !r.url.startsWith('data:'));
if (originales.length) {
  console.log('\n  Imágenes servidas SIN el optimizador (/_next/image):');
  originales.slice(0, 15).forEach((r) => console.log('    ' + kb(r.bytes || 0).padStart(10) + '  ' + r.url.slice(0, 120)));
}

// ---------- 6. terceros ----------
console.log('\n## Recursos externos (terceros)');
const propio = new URL(traza.urlFinal).hostname;
const porHost = {};
for (const r of req) {
  if (r.url.startsWith('data:') || r.url.startsWith('blob:')) continue;
  const h = new URL(r.url).hostname;
  porHost[h] = porHost[h] || { n: 0, bytes: 0, ms: 0 };
  porHost[h].n++;
  porHost[h].bytes += r.bytes || 0;
  porHost[h].ms += r.duracionMs || 0;
}
for (const [h, v] of Object.entries(porHost).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(
    '  ' + (h === propio ? '[propio] ' : '[3ro]    ') + h.padEnd(38) + String(v.n).padStart(3) + ' req  ' + kb(v.bytes).padStart(11),
  );
}

// ---------- 7. fuentes y video ----------
const fuentes = req.filter((r) => r.tipo === 'Font' || /\.(woff2?|ttf|otf)(\?|$)/i.test(r.url));
console.log('\n## Fuentes: ' + fuentes.length + ' (' + kb(fuentes.reduce((s, r) => s + (r.bytes || 0), 0)) + ')');
fuentes.forEach((r) => console.log('  ' + kb(r.bytes || 0).padStart(10) + '  ' + r.url.split('/').pop().slice(0, 80)));
const media = req.filter((r) => r.tipo === 'Media' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(r.url));
console.log('\n## Video/media: ' + media.length + ' (' + kb(media.reduce((s, r) => s + (r.bytes || 0), 0)) + ')');
media.forEach((r) => console.log('  ' + kb(r.bytes || 0).padStart(10) + '  ' + r.url.split('/').pop().slice(0, 80)));

// ---------- 8. supabase / datos ----------
const datos = req.filter((r) => /supabase|\/api\//i.test(r.url));
console.log('\n## Consultas de datos desde el navegador (Supabase / API): ' + datos.length);
datos.forEach((r) =>
  console.log(
    '  ' +
      String(r.inicioMs).padStart(5) +
      '→' +
      String(r.finMs ?? '?').padStart(5) +
      ' ms  ttfb ' +
      String(r.ttfb ?? '?').padStart(5) +
      ' ms  ' +
      kb(r.bytes || 0).padStart(9) +
      '  ' +
      decodeURIComponent(r.url).slice(0, 130),
  ),
);

// ---------- 9. waterfall / secuencialidad ----------
console.log('\n## Waterfall (orden real; cadenas secuenciales)');
const ordenados = [...req].filter((r) => r.finMs != null).sort((a, b) => a.inicioMs - b.inicioMs);
const escala = Math.max(...ordenados.map((r) => r.finMs), 1);
ordenados.slice(0, 40).forEach((r) => {
  const ancho = 52;
  const ini = Math.round((r.inicioMs / escala) * ancho);
  const dur = Math.max(1, Math.round(((r.duracionMs || 0) / escala) * ancho));
  const barra = ' '.repeat(ini) + '#'.repeat(Math.min(dur, ancho - ini));
  const u = r.url.startsWith('data:') ? '(data URI)' : new URL(r.url).pathname.split('/').pop() || '/';
  console.log(
    '  ' + barra.padEnd(ancho) + ' ' + String(r.inicioMs).padStart(5) + '→' + String(r.finMs).padStart(5) + '  ' + (r.tipo || '').slice(0, 8).padEnd(8) + ' ' + decodeURIComponent(u).slice(0, 46),
  );
});

// cadenas: recursos que arrancan después de que terminó su iniciador
const porUrl = new Map(req.map((r) => [r.url, r]));
const cadenas = [];
for (const r of req) {
  if (!r.iniciadorUrl) continue;
  const padre = porUrl.get(r.iniciadorUrl);
  if (padre && padre.finMs != null && r.inicioMs >= padre.finMs - 5) {
    cadenas.push({ padre: padre.url, hijo: r.url, esperaMs: r.inicioMs - padre.finMs, hijoFin: r.finMs });
  }
}
if (cadenas.length) {
  console.log('\n  Cadenas encadenadas (el hijo no puede empezar hasta que el padre termina):');
  cadenas
    .sort((a, b) => (b.hijoFin || 0) - (a.hijoFin || 0))
    .slice(0, 12)
    .forEach((c) =>
      console.log(
        '    ' +
          new URL(c.padre).pathname.split('/').pop().slice(0, 40) +
          '  →  ' +
          decodeURIComponent(new URL(c.hijo).pathname.split('/').pop()).slice(0, 40) +
          '   (+' +
          c.esperaMs +
          ' ms, termina en ' +
          c.hijoFin +
          ' ms)',
      ),
    );
}

// ---------- 10. reparto del tiempo ----------
if (lh) {
  const a = lh.audits;
  console.log('\n## Reparto del tiempo (dónde se va)');
  const doc = req.find((r) => r.tipo === 'Document');
  const redirMs = traza.metricas.redirecciones?.ms || 0;
  console.log('  1. Servidor y TTFB      : ' + (traza.metricas.ttfbNav ?? '?') + ' ms de TTFB' + (redirMs ? ' + ' + redirMs + ' ms de redirecciones' : '') + (doc ? '  (doc: ' + kb(doc.bytes || 0) + ')' : ''));
  const bytesEstaticos = req.filter((r) => ['Image', 'Font', 'Media', 'Stylesheet'].includes(r.tipo)).reduce((s, r) => s + (r.bytes || 0), 0);
  console.log('  2. Imágenes y archivos  : ' + kb(bytesEstaticos) + ' (' + req.filter((r) => ['Image', 'Font', 'Media', 'Stylesheet'].includes(r.tipo)).length + ' solicitudes)');
  const boot = a['bootup-time'];
  const mt = a['mainthread-work-breakdown'];
  const evalMs = boot?.details?.items?.reduce((s, i) => s + (i.scripting || 0) + (i.scriptParseCompile || 0), 0) || 0;
  console.log('  3. JavaScript e hidratación: ' + Math.round(evalMs) + ' ms de CPU en scripts, TBT ' + Math.round(a['total-blocking-time'].numericValue) + ' ms, ' + kb(jsBytes) + ' descargados');
  if (mt?.details?.items) {
    for (const i of mt.details.items.slice(0, 6)) console.log('       · ' + i.group.padEnd(24) + Math.round(i.duration) + ' ms');
  }
  console.log('  4. Consultas de datos   : ' + datos.length + ' desde el navegador' + (datos.length ? ', ' + Math.max(...datos.map((d) => d.duracionMs || 0)) + ' ms la más lenta' : '') + ' (el resto va dentro del TTFB, ver medición aparte)');
  const terceros = Object.entries(porHost).filter(([h]) => h !== propio);
  console.log('  5. Recursos externos    : ' + terceros.length + ' dominios, ' + kb(terceros.reduce((s, [, v]) => s + v.bytes, 0)));
  for (const [h, v] of terceros.sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 6)) console.log('       · ' + h.padEnd(34) + v.n + ' req  ' + kb(v.bytes));
}
console.log('');
