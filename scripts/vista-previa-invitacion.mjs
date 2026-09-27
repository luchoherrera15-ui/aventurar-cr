// Arma una vista previa AUTÓNOMA de la invitación de Antonella: un
// .html de un solo archivo que se abre con doble clic, sin servidor y
// sin base de datos. La foto va embebida como data-URI y abajo se
// simula el bloque RSVP que /i/{slug} agrega de verdad, para ver que
// el diseño desemboque bien en él.
//
//   node scripts/vista-previa-invitacion.mjs [destino.html]
import { readFileSync, writeFileSync } from "node:fs";
import { DATOS, FILA, PLANTILLA, FOTO_LOCAL, rellenar } from "./datos-invitacion-antonella.mjs";

const destino = process.argv[2] || "vista-previa-antonella.html";

const foto = `data:image/webp;base64,${readFileSync(FOTO_LOCAL).toString("base64")}`;
const fragmento = rellenar(readFileSync(PLANTILLA, "utf8"), { ...DATOS, FOTO: foto });

// El mismo esqueleto que da la página real: sin márgenes y a sangre.
const pagina = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${FILA.titulo} — vista previa</title>
<style>
  html, body { margin: 0; padding: 0; background: #fdf1f5; overflow-x: hidden; }
  /* Remedo del bloque RSVP que agrega /i/{slug}: solo para ver el empate. */
  .previa-rsvp {
    padding: 56px 20px 72px;
    background: #fbe3ec;
    font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif;
    color: #5a3e4d;
    text-align: center;
  }
  .previa-rsvp h2 { margin: 0 0 8px; font-family: Georgia, serif; font-size: 30px; font-style: italic; color: #e2568d; }
  .previa-rsvp p { margin: 0 auto 22px; max-width: 46ch; font-size: 15px; line-height: 1.7; }
  .previa-campo { display: block; width: min(100%, 380px); margin: 0 auto 12px; min-height: 48px; padding: 13px 16px; border: 2px solid #f3a9c4; border-radius: 14px; background: #fff; font: inherit; font-size: 16px; }
  .previa-enviar { min-height: 48px; padding: 13px 34px; border: 0; border-radius: 999px; background: #e2568d; color: #fff; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
  .previa-aviso { padding: 10px 16px; background: #5a3e4d; color: #fff; font: 13px/1.5 "Avenir Next", system-ui, sans-serif; text-align: center; }
</style>
</head>
<body>
<p class="previa-aviso">Vista previa local — el bloque de confirmación de abajo es una maqueta; en /i/{slug} lo pone la página.</p>
${fragmento}
<section class="previa-rsvp">
  <h2>¿Nos acompañás?</h2>
  <p>Confirmanos antes del gran día para apartarte tu campito.</p>
  <input class="previa-campo" placeholder="Tu nombre" aria-label="Tu nombre"/>
  <input class="previa-campo" placeholder="¿Cuántos vienen?" aria-label="Cuántos vienen"/>
  <button class="previa-enviar" type="button">Confirmar asistencia</button>
</section>
</body>
</html>
`;

writeFileSync(destino, pagina);
console.log(`✓ ${destino} — ${(pagina.length / 1024).toFixed(0)} KB`);
