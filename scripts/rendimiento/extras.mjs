import { spawn } from 'node:child_process';
const correr = (script, args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], { stdio: 'inherit' });
    p.on('exit', () => resolve());
    p.on('error', () => resolve());
  });

const entorno = process.argv[2] || 'prod';
const BASE = entorno === 'local' ? 'http://localhost:3000' : 'https://www.bookea.lat';
const albumGrande = BASE + '/a/fotos-revelacion-maria-jesus-y-luis';

// la galería de verdad: 164 fotos, originales de ~780 KB de media
for (const preset of ['mobile', 'desktop']) {
  const et = `${entorno}-album-grande-${preset === 'mobile' ? 'movil' : 'escritorio'}`;
  console.log(`\n>>> ${et}`);
  await correr('medir.mjs', [albumGrande, preset, et]);
  await correr('rastrear.mjs', [albumGrande, preset, et]);
}

// INP de laboratorio en las tres pantallas donde la gente toca cosas
console.log('\n>>> INP de laboratorio (móvil, CPU 4x)');
await correr('interaccion.mjs', [BASE + '/eventos', 'mobile', `${entorno}-eventos-movil`]);
await correr('interaccion.mjs', [BASE + '/rancholastorres', 'mobile', `${entorno}-ficha-negocio-movil`]);
await correr('interaccion.mjs', [albumGrande, 'mobile', `${entorno}-album-grande-movil`]);

console.log('\n>>> TTFB por ruta');
await correr('ttfb-servidor.mjs', [BASE]);
console.log('\n=== extras ' + entorno + ' terminados ===');
