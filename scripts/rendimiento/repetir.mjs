// La misma página medida N veces: una sola corrida de Lighthouse varía
// mucho (se vieron 2185 y 2915 ms de LCP en la MISMA URL). La línea base
// se reporta con la mediana de 3.
// uso: node repetir.mjs <prod|local> <n>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const entorno = process.argv[2] || 'prod';
const veces = +(process.argv[3] || 3);
const BASE = entorno === 'local' ? 'http://localhost:3000' : 'https://www.bookea.lat';

const paginas = [
  ['entrada', entorno === 'local' ? 'http://localhost:3000/' : 'https://bookea.lat/'],
  ['eventos', BASE + '/eventos'],
  ['ficha-negocio', BASE + '/rancholastorres'],
  ['album-grande', BASE + '/a/fotos-revelacion-maria-jesus-y-luis'],
];

const correr = (script, args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], { stdio: 'ignore' });
    p.on('exit', () => resolve());
    p.on('error', () => resolve());
  });

const OUT = path.join(process.cwd(), 'resultados');
const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const tabla = [];
for (const [slug, url] of paginas) {
  for (const preset of ['mobile', 'desktop']) {
    const corridas = [];
    for (let i = 0; i < veces; i++) {
      const et = `${entorno}-${slug}-${preset === 'mobile' ? 'movil' : 'escritorio'}-r${i}`;
      await correr('medir.mjs', [url, preset, et]);
      const f = path.join(OUT, `${et}.json`);
      if (!fs.existsSync(f)) continue;
      const lh = JSON.parse(fs.readFileSync(f, 'utf8'));
      const a = lh.audits;
      corridas.push({
        LCP: a['largest-contentful-paint'].numericValue,
        FCP: a['first-contentful-paint'].numericValue,
        TBT: a['total-blocking-time'].numericValue,
        CLS: a['cumulative-layout-shift'].numericValue,
        TTFB: a['server-response-time'].numericValue,
        SI: a['speed-index'].numericValue,
        score: (lh.categories.performance.score || 0) * 100,
      });
      fs.unlinkSync(f); // solo interesan los números, no 350 KB por corrida
    }
    if (!corridas.length) continue;
    const fila = {
      pagina: slug,
      dispositivo: preset === 'mobile' ? 'móvil' : 'escritorio',
      n: corridas.length,
      LCP: Math.round(mediana(corridas.map((c) => c.LCP))),
      LCPmin: Math.round(Math.min(...corridas.map((c) => c.LCP))),
      LCPmax: Math.round(Math.max(...corridas.map((c) => c.LCP))),
      FCP: Math.round(mediana(corridas.map((c) => c.FCP))),
      TBT: Math.round(mediana(corridas.map((c) => c.TBT))),
      CLS: +mediana(corridas.map((c) => c.CLS)).toFixed(3),
      TTFB: Math.round(mediana(corridas.map((c) => c.TTFB))),
      SI: Math.round(mediana(corridas.map((c) => c.SI))),
      score: Math.round(mediana(corridas.map((c) => c.score))),
    };
    tabla.push(fila);
    console.log(
      `${fila.pagina.padEnd(14)} ${fila.dispositivo.padEnd(11)} LCP ${String(fila.LCP).padStart(5)} ms (min ${fila.LCPmin} / max ${fila.LCPmax})  FCP ${fila.FCP}  TBT ${fila.TBT}  CLS ${fila.CLS}  puntaje ${fila.score}`,
    );
  }
}
fs.writeFileSync(path.join(OUT, `mediana-${entorno}.json`), JSON.stringify(tabla, null, 2));

console.log('\n| Página | Dispositivo | LCP (mediana de ' + veces + ') | rango | FCP | TBT | CLS | TTFB | Speed Index | Puntaje |');
console.log('|---|---|---:|---|---:|---:|---:|---:|---:|---:|');
for (const f of tabla)
  console.log(
    `| ${f.pagina} | ${f.dispositivo} | **${f.LCP} ms** | ${f.LCPmin}–${f.LCPmax} | ${f.FCP} | ${f.TBT} | ${f.CLS} | ${f.TTFB} | ${f.SI} | ${f.score} |`,
  );
