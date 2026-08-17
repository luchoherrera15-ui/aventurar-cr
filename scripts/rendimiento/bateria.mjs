// Corre Lighthouse + traza CDP para un juego de páginas, en móvil y escritorio.
// uso: node bateria.mjs <prod|local> [solo-movil]
import { spawn } from 'node:child_process';

const entorno = process.argv[2] || 'prod';
const soloMovil = process.argv.includes('solo-movil');

const BASE = entorno === 'local' ? 'http://localhost:3000' : 'https://www.bookea.lat';

const paginas = [
  // la entrada real que teclea la gente (en prod arrastra 2 redirecciones)
  { slug: 'entrada', url: entorno === 'local' ? 'http://localhost:3000/' : 'https://bookea.lat/' },
  // la portada YA SERVIDA, sin las redirecciones del apex: es la página
  // que Google mide para calificar el sitio y la más visitada. Estaba
  // fuera del arnés porque `/` era el directorio de eventos y medirla
  // habría sido medir dos veces lo mismo; con el home nuevo son dos
  // páginas distintas y cada una necesita su línea base.
  { slug: 'portada', url: BASE + '/' },
  { slug: 'eventos', url: BASE + '/eventos' },
  { slug: 'ficha-negocio', url: BASE + '/rancholastorres' },
  { slug: 'album', url: BASE + '/a/fotos-ejemplo-cumpleanos-star-wars-de-luis-herrera' },
  { slug: 'invitacion', url: BASE + '/i/demo-boda-premium' },
  { slug: 'catalogo-invitaciones', url: BASE + '/invitaciones' },
];

const correr = (script, args) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], { stdio: 'inherit' });
    p.on('exit', () => resolve());
    p.on('error', () => resolve());
  });

const presets = soloMovil ? ['mobile'] : ['mobile', 'desktop'];

for (const pag of paginas) {
  for (const preset of presets) {
    const etiqueta = `${entorno}-${pag.slug}-${preset === 'mobile' ? 'movil' : 'escritorio'}`;
    console.log(`\n>>> ${etiqueta}  ${pag.url}`);
    await correr('medir.mjs', [pag.url, preset, etiqueta]);
    await correr('rastrear.mjs', [pag.url, preset, etiqueta]);
  }
}
console.log('\n=== batería ' + entorno + ' terminada ===');
