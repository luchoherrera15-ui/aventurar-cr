// Aísla el tiempo de servidor: compara rutas con y sin consultas a la base.
// La diferencia entre una página estática y una que consulta Supabase es,
// con buena aproximación, lo que cuestan las consultas dentro del render.
// uso: node ttfb-servidor.mjs <base>
import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';

const base = process.argv[2] || 'https://www.bookea.lat';
const rutas = [
  ['/terminos', 'estática, sin base'],
  ['/politicas', 'estática, sin base'],
  // La portada: armazón sin base + dos límites de Suspense sobre una
  // sola tanda de consultas (ver src/app/home-datos.ts). Lo que se
  // mide acá es el ARMAZÓN, que es lo que define el primer byte.
  ['/', 'portada (armazón sin base, datos en streaming)'],
  ['/eventos', '4 consultas en paralelo + auth'],
  ['/rancholastorres', 'ficha de negocio'],
  ['/citas', 'directorio de citas'],
  ['/a/fotos-revelacion-maria-jesus-y-luis', 'álbum de 164 fotos'],
  ['/i/demo-boda-premium', 'invitación'],
];

// TTFB puro a nivel de socket: separa conexión de espera del servidor
async function ttfbCrudo(url) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    let tConectado, tPrimerByte;
    const socket = tls.connect({ host: u.hostname, port: 443, servername: u.hostname, ALPNProtocols: ['http/1.1'] }, () => {
      tConectado = process.hrtime.bigint();
      socket.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.hostname}\r\nUser-Agent: auditoria-bookea\r\nAccept-Encoding: br, gzip\r\nConnection: close\r\n\r\n`,
      );
    });
    let bytes = 0;
    let cabeceras = '';
    socket.on('data', (d) => {
      if (!tPrimerByte) tPrimerByte = process.hrtime.bigint();
      if (cabeceras.length < 4000) cabeceras += d.toString('latin1').slice(0, 4000);
      bytes += d.length;
    });
    socket.on('end', () => {
      const fin = process.hrtime.bigint();
      resolve({
        conexionMs: Number(tConectado - t0) / 1e6,
        ttfbMs: Number(tPrimerByte - tConectado) / 1e6,
        totalMs: Number(fin - t0) / 1e6,
        bytes,
        cache: (cabeceras.match(/x-vercel-cache: (\w+)/i) || [])[1] || '-',
        edge: (cabeceras.match(/x-vercel-id: ([^\r\n]+)/i) || [])[1] || '-',
        status: (cabeceras.match(/HTTP\/1\.1 (\d+)/) || [])[1] || '?',
      });
    });
    socket.on('error', reject);
    socket.setTimeout(30000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
  });
}

console.log(`\nTTFB por ruta contra ${base} (7 medidas, se reporta la mediana)\n`);
console.log('| Ruta | Qué hace | Conexión | TTFB | Total | Bytes | Caché |');
console.log('|---|---|---:|---:|---:|---:|---|');
const salida = [];
for (const [ruta, desc] of rutas) {
  const ms = [];
  let ultimo = null;
  for (let i = 0; i < 7; i++) {
    try {
      const r = await ttfbCrudo(base + ruta);
      ms.push(r.ttfbMs);
      ultimo = r;
    } catch (e) {
      /* reintento implícito */
    }
  }
  if (!ultimo) {
    console.log(`| ${ruta} | ${desc} | — | ERROR | — | — | — |`);
    continue;
  }
  ms.sort((a, b) => a - b);
  const med = ms[Math.floor(ms.length / 2)];
  salida.push({ ruta, desc, ttfbMediana: +med.toFixed(0), min: +ms[0].toFixed(0), max: +ms.at(-1).toFixed(0), bytes: ultimo.bytes, cache: ultimo.cache });
  console.log(
    `| \`${ruta}\` | ${desc} | ${ultimo.conexionMs.toFixed(0)} ms | **${med.toFixed(0)} ms** (min ${ms[0].toFixed(0)} / max ${ms.at(-1).toFixed(0)}) | ${ultimo.totalMs.toFixed(0)} ms | ${(ultimo.bytes / 1024).toFixed(1)} KB | ${ultimo.cache} |`,
  );
}
fs.mkdirSync('resultados', { recursive: true });
fs.writeFileSync('resultados/ttfb-servidor.json', JSON.stringify(salida, null, 2));

const estatica = salida.filter((s) => s.desc.startsWith('estática')).map((s) => s.ttfbMediana);
const baseEst = estatica.length ? Math.min(...estatica) : null;
if (baseEst != null) {
  console.log(`\nBase estática (sin consultas): ${baseEst} ms. Sobrecosto atribuible al render con datos:`);
  for (const s of salida.filter((x) => !x.desc.startsWith('estática'))) {
    console.log(`  ${s.ruta.padEnd(46)} +${(s.ttfbMediana - baseEst).toFixed(0)} ms`);
  }
}
