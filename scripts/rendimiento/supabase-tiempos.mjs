// Mide el tiempo de respuesta de Supabase replicando las consultas que
// hacen las páginas en el servidor. OJO: se mide desde esta máquina, no
// desde Vercel — el número absoluto incluye la latencia de casa; lo que
// vale es la comparación relativa entre consultas y el conteo de idas y vueltas.
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function medir(nombre, ruta, veces = 5) {
  const tiempos = [];
  let bytes = 0;
  let filas = 0;
  for (let i = 0; i < veces; i++) {
    const t = process.hrtime.bigint();
    const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, { headers: h });
    const txt = await r.text();
    tiempos.push(Number(process.hrtime.bigint() - t) / 1e6);
    bytes = txt.length;
    try {
      filas = JSON.parse(txt).length;
    } catch {
      filas = -1;
    }
    if (!r.ok) {
      console.log(`  ${nombre.padEnd(38)} ERROR ${r.status} ${txt.slice(0, 120)}`);
      return null;
    }
  }
  tiempos.sort((a, b) => a - b);
  const mediana = tiempos[Math.floor(tiempos.length / 2)];
  console.log(
    `  ${nombre.padEnd(38)} mediana ${mediana.toFixed(0).padStart(5)} ms   min ${tiempos[0].toFixed(0).padStart(4)}  max ${tiempos.at(-1).toFixed(0).padStart(5)}   ${filas} filas   ${(bytes / 1024).toFixed(1)} KB`,
  );
  return { nombre, mediana, min: tiempos[0], max: tiempos.at(-1), filas, bytes };
}

console.log('== Latencia base a Supabase (desde esta máquina) ==');
const t0 = process.hrtime.bigint();
await fetch(`${URL_SB}/rest/v1/`, { headers: h });
console.log(`  handshake + ruta raíz: ${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms\n`);

console.log('== Consultas de /eventos (las 4 en paralelo del server component) ==');
const COLUMNAS_CARD =
  'id,nombre,slug,categoria,provincia,precio_desde,fotos,destacado_orden,created_at,vertical,estado';
const res = [];
res.push(await medir('ranchos (COLUMNAS_CARD, aprobados)', `ranchos?select=${COLUMNAS_CARD}&estado=eq.aprobado&order=created_at.desc`));
res.push(await medir('disponibilidad_rancho (confirmadas)', 'disponibilidad_rancho?select=rancho_id,fecha&estado=eq.confirmada'));
res.push(await medir('calificaciones_rancho', 'calificaciones_rancho?select=rancho_id,promedio,total'));
res.push(await medir('resenas (limit 300)', 'resenas?select=rancho_id,comentario&comentario=not.is.null&order=created_at.desc&limit=300'));

console.log('\n== Tamaño real de lo que viaja ==');
const r = await fetch(`${URL_SB}/rest/v1/ranchos?select=${COLUMNAS_CARD}&estado=eq.aprobado`, { headers: h });
const ranchos = await r.json();
console.log(`  ranchos aprobados: ${ranchos.length}`);
let totalFotos = 0;
for (const x of ranchos) {
  const n = Array.isArray(x.fotos) ? x.fotos.length : 0;
  totalFotos += n;
  console.log(`    ${(x.slug || x.id).padEnd(28)} ${String(n).padStart(3)} fotos   vertical=${x.vertical || '-'}  cat=${x.categoria || '-'}`);
}
console.log(`  TOTAL de fotos referenciadas en el directorio: ${totalFotos}`);

console.log('\n== Álbumes públicos (/a/[slug]) ==');
try {
  const ra = await fetch(`${URL_SB}/rest/v1/albumes?select=slug,titulo&limit=10`, { headers: h });
  const al = await ra.json();
  if (Array.isArray(al)) al.forEach((a) => console.log(`    /a/${a.slug}  ${a.titulo || ''}`));
  else console.log('    ' + JSON.stringify(al).slice(0, 200));
} catch (e) {
  console.log('    ' + e.message);
}

console.log('\n== Invitaciones publicadas (/i/[slug]) ==');
try {
  const ri = await fetch(`${URL_SB}/rest/v1/invitaciones?select=slug,titulo&limit=10`, { headers: h });
  const iv = await ri.json();
  if (Array.isArray(iv)) iv.forEach((a) => console.log(`    /i/${a.slug}  ${a.titulo || ''}`));
  else console.log('    ' + JSON.stringify(iv).slice(0, 200));
} catch (e) {
  console.log('    ' + e.message);
}

fs.mkdirSync('resultados', { recursive: true });
fs.writeFileSync('resultados/supabase-tiempos.json', JSON.stringify(res.filter(Boolean), null, 2));
