// Tabla resumen de todas las mediciones, en Markdown.
// uso: node resumen.mjs [prefijoAntes prefijoDespues]
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'resultados');
const auxiliares = ['supabase-tiempos.json', 'resumen.json', 'ttfb-servidor.json'];
const archivos = fs
  .readdirSync(OUT)
  .filter((f) => f.endsWith('.json') && !f.includes('.traza') && !f.includes('.inp') && !auxiliares.includes(f));

function leer(label) {
  const lhFile = path.join(OUT, `${label}.json`);
  const trFile = path.join(OUT, `${label}.traza.json`);
  if (!fs.existsSync(lhFile)) return null;
  const lh = JSON.parse(fs.readFileSync(lhFile, 'utf8'));
  const tr = fs.existsSync(trFile) ? JSON.parse(fs.readFileSync(trFile, 'utf8')) : null;
  const a = lh.audits;
  const num = (id) => (a[id] && typeof a[id].numericValue === 'number' ? a[id].numericValue : null);
  const req = tr ? tr.solicitudes : [];
  const bytes = req.reduce((s, r) => s + (r.bytes || 0), 0);
  const js = req.filter((r) => r.tipo === 'Script').reduce((s, r) => s + (r.bytes || 0), 0);
  const imgs = req.filter((r) => r.tipo === 'Image');
  const inv = tr?.imagenes;
  const nodo = a['lcp-discovery-insight']?.details?.items?.find((i) => i.type === 'node');
  const fases = a['lcp-breakdown-insight']?.details?.items?.find((i) => i.type === 'table')?.items || [];
  const fase = (k) => Math.round(fases.find((f) => f.subpart === k)?.duration || 0);
  return {
    label,
    url: lh.finalDisplayedUrl,
    formFactor: lh.configSettings.formFactor,
    score: Math.round((lh.categories.performance.score || 0) * 100),
    FCP: Math.round(num('first-contentful-paint')),
    LCP: Math.round(num('largest-contentful-paint')),
    TTFB: Math.round(num('server-response-time')),
    CLS: +num('cumulative-layout-shift').toFixed(3),
    TBT: Math.round(num('total-blocking-time')),
    SI: Math.round(num('speed-index')),
    peticiones: req.length,
    MB: +(bytes / 1048576).toFixed(2),
    jsKB: Math.round(js / 1024),
    imgs: imgs.length,
    imgsKB: Math.round(imgs.reduce((s, r) => s + (r.bytes || 0), 0) / 1024),
    imgsFuera: inv ? inv.imgs.filter((i) => !i.enPantalla && i.cargada).length : null,
    lcpElemento: nodo ? (nodo.nodeLabel || nodo.selector || '').slice(0, 48) : '?',
    lcpSelector: nodo ? (nodo.selector || '').slice(0, 60) : '?',
    lcpTTFB: fase('timeToFirstByte'),
    lcpEsperaRecurso: fase('resourceLoadDelay'),
    lcpDescargaRecurso: fase('resourceLoadDuration'),
    lcpEsperaPintado: fase('elementRenderDelay'),
  };
}

const filas = archivos.map((f) => leer(f.replace(/\.json$/, ''))).filter(Boolean);

const [antes, despues] = process.argv.slice(2);

if (antes && despues) {
  console.log(`\n### Antes (\`${antes}\`) vs. después (\`${despues}\`)\n`);
  console.log('| Página | Métrica | Antes | Después | Cambio |');
  console.log('|---|---|---:|---:|---:|');
  const claves = ['LCP', 'FCP', 'TTFB', 'CLS', 'TBT', 'peticiones', 'MB', 'jsKB', 'imgs', 'imgsFuera', 'score'];
  for (const fa of filas.filter((f) => f.label.startsWith(antes))) {
    const resto = fa.label.slice(antes.length);
    const fd = filas.find((f) => f.label === despues + resto);
    if (!fd) continue;
    for (const k of claves) {
      const va = fa[k];
      const vd = fd[k];
      if (va == null || vd == null) continue;
      const mejor = k === 'score' ? vd - va : va - vd;
      const pct = va !== 0 ? ((mejor / Math.abs(va)) * 100).toFixed(0) : '—';
      const signo = mejor > 0 ? '✅' : mejor < 0 ? '⚠️' : '=';
      console.log(`| ${resto.replace(/^-/, '')} | ${k} | ${va} | ${vd} | ${signo} ${pct}% |`);
    }
  }
} else {
  console.log('\n| Medición | LCP | FCP | TTFB | CLS | TBT | SI | Req | MB | JS KB | Imgs | Img fuera de pantalla | Puntaje |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const f of filas.sort((a, b) => a.label.localeCompare(b.label))) {
    console.log(
      `| ${f.label} | ${f.LCP} | ${f.FCP} | ${f.TTFB} | ${f.CLS} | ${f.TBT} | ${f.SI} | ${f.peticiones} | ${f.MB} | ${f.jsKB} | ${f.imgs} | ${f.imgsFuera ?? '—'} | ${f.score} |`,
    );
  }
  console.log('\n**Elemento LCP y en qué se va el LCP (ms)**\n');
  console.log('| Medición | Elemento LCP | TTFB | Espera del recurso | Descarga | Espera de pintado |');
  console.log('|---|---|---:|---:|---:|---:|');
  for (const f of filas.sort((a, b) => a.label.localeCompare(b.label))) {
    console.log(
      `| ${f.label} | ${f.lcpElemento} \`${f.lcpSelector}\` | ${f.lcpTTFB} | ${f.lcpEsperaRecurso} | ${f.lcpDescargaRecurso} | ${f.lcpEsperaPintado} |`,
    );
  }
}
fs.writeFileSync(path.join(OUT, 'resumen.json'), JSON.stringify(filas, null, 2));
