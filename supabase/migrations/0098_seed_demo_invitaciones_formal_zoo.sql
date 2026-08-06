-- ============================================================
-- BOOKEA — Siembra de las demos de invitación formal y zoológico (0098)
--
-- El catálogo de la landing (/invitaciones) linkea /i/demo-formal y
-- /i/demo-zoologico, pero esas filas nunca se sembraron en producción
-- (el script scripts/seed-demo-invitaciones-formal-zoo.mjs no se
-- corrió) y el link daba "no encontrada". Esta migración es la versión
-- pegable en el SQL Editor de ese script: el HTML llega ya rellenado.
--
-- Idempotente: upsert por slug — si la fila existe la deja activa y
-- con el HTML al día. Es seguro correrla varias veces.
-- ============================================================

insert into invitaciones (
  slug, tema, titulo, anfitriones, mensaje, fecha_evento, hora,
  lugar_nombre, direccion, estado, html_personalizado
)
values (
  'demo-formal',
  'formal',
  'Gala 50 aniversario — Elena & Rodrigo',
  'Familia Solano Herrera',
  'Cincuenta años de historia merecen una noche inolvidable.',
  '2026-11-21',
  '7:00 p. m.',
  'Hotel Casa Real',
  'Barrio Otoya, San José',
  'activa',
  $inv_formal$<!--
  Plantilla "Formal" — gala elegante (aniversarios, bodas de plata/oro,
  cenas de etiqueta). Paleta: negro humo, marfil y dorado; serif display,
  ornamentos de línea fina y monograma en sello.

  USO: sustituir los placeholders y guardar el resultado en
  invitaciones.html_personalizado. La página /i/{slug} lo inyecta a
  pantalla completa (el fragmento ocupa todo el ancho del viewport; el
  negro humo ES la página) y agrega ella misma el bloque RSVP
  "¿Nos acompañás?" debajo — por eso la sección 6 llama a confirmar
  "aquí abajo".

  ESTRUCTURA (secciones que se revelan UNA POR UNA al scrollear con
  IntersectionObserver, cada una con su propia escena):
    1. Portada/hero con monograma y cortina de luz
    2. Código de vestimenta (siluetas de esmoquin y vestido en trazo)
    3. Información principal (fecha y hora en grande)
    4. Cuenta regresiva viva
    5. El lugar (Google Maps / Waze)
    6. Llamado "Confirmá tu asistencia ▼" (empata con el RSVP de la página)
    7. Muestras de cariño (regalos + SINPE)

  PLACEHOLDERS:
    Elena & Rodrigo        los festejados            p. ej. Elena & Rodrigo
    E & R      iniciales del sello       p. ej. E · R
    Gala 50 aniversario        la ocasión                p. ej. Gala 50 aniversario
    sábado 21 de noviembre, 2026          fecha en palabras         p. ej. sábado 21 de noviembre
    7:00 p. m.           hora                      p. ej. 7:00 p. m.
    2026-11-21T19:00:00-06:00      fecha-hora ISO con zona   p. ej. 2026-11-21T19:00:00-06:00
    Hotel Casa Real          nombre del lugar          p. ej. Hotel Casa Real
    Barrio Otoya, San José      dirección corta           p. ej. San José, costado norte…
    https://www.google.com/maps/search/?api=1&query=Hotel%20Casa%20Real%2C%20Barrio%20Otoya%2C%20San%20Jos%C3%A9%2C%20Costa%20Rica      URL de Google Maps
    https://waze.com/ul?q=Hotel%20Casa%20Real%2C%20Barrio%20Otoya%2C%20San%20Jos%C3%A9      URL de Waze
    https://bookea.lat  URL lista de regalos
    https://bookea.lat  URL mesa de regalos
    8888-8888          número SINPE Móvil        p. ej. 8888-8888

  NOTAS TÉCNICAS:
  - Autocontenido: CSS en el <style> y JS en el <script> de este mismo
    fragmento; cero librerías, cero recursos remotos (solo SVG inline).
    Estilos namespaced con .fm-/#fm- para no tocar el RSVP ni la página.
  - La intro usa <dialog>.showModal() (top layer: escapa el transform del
    contenedor [data-reveal] de la página). Sin JS o con
    prefers-reduced-motion no hay intro y todo queda visible.
  - Los estados "oculto antes de revelar" solo existen bajo .fm-anima,
    clase que agrega el script: sin JS la invitación se ve completa.
-->
<div class="fm">
  <style>
    /* ============ Tokens del tema ============ */
    .fm {
      --fm-negro: #14120f;
      --fm-negro-2: #1c1915;
      --fm-marfil: #f5f1ea;
      --fm-marfil-suave: rgba(245, 241, 234, 0.72);
      --fm-oro: #c8a878;
      --fm-oro-suave: rgba(200, 168, 120, 0.45);
      --fm-oro-tenue: rgba(200, 168, 120, 0.22);
      --fm-serif: var(--inv3-serif, Georgia), "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif;
      --fm-sans: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      display: block;
      font-family: var(--fm-serif);
      color: var(--fm-marfil);
    }

    /* ============ INTRO (dialog en el top layer) ============ */
    #fm-intro {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background:
        radial-gradient(46rem 34rem at 50% 18%, rgba(200, 168, 120, 0.12), transparent 60%),
        radial-gradient(60rem 44rem at 50% 110%, rgba(200, 168, 120, 0.08), transparent 55%),
        #0d0c0a;
      overflow: hidden;
      z-index: 2147483000;
      cursor: pointer;
      color: var(--fm-marfil);
      opacity: 1;
      transition: opacity 0.8s ease 0.25s;
    }
    #fm-intro:focus { outline: none; }
    #fm-intro::backdrop { background: rgba(6, 5, 3, 0.7); }
    #fm-intro.fm-intro-abierta { opacity: 0; }

    /* La cortina de luz que barre la pantalla al abrir. */
    #fm-intro::before {
      content: "";
      position: absolute;
      inset: -20% -40%;
      background: linear-gradient(105deg, transparent 34%, rgba(200, 168, 120, 0.16) 46%, rgba(245, 241, 234, 0.3) 50%, rgba(200, 168, 120, 0.16) 54%, transparent 66%);
      transform: translateX(-120%);
      pointer-events: none;
    }
    #fm-intro.fm-intro-abierta::before { animation: fm-luz-intro 0.9s ease both; }

    .fm-intro-marco {
      position: absolute;
      inset: 14px;
      border: 1px solid var(--fm-oro-suave);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 22px;
      padding: 24px;
      text-align: center;
      pointer-events: none;
    }
    .fm-intro-marco::before {
      content: "";
      position: absolute;
      inset: 6px;
      border: 1px solid var(--fm-oro-tenue);
    }
    .fm-intro-sello { width: 128px; height: 128px; animation: fm-aparece 1.4s ease 0.2s both; }
    .fm-intro-nombres {
      margin: 0;
      font-size: clamp(26px, 7vw, 64px);
      letter-spacing: 0.06em;
      animation: fm-aparece 1.4s ease 0.5s both;
    }
    .fm-intro-ocasion {
      margin: 0;
      font-family: var(--fm-sans);
      font-size: 11px;
      letter-spacing: 0.42em;
      text-transform: uppercase;
      color: var(--fm-oro);
      animation: fm-aparece 1.4s ease 0.7s both;
    }
    .fm-toca {
      position: absolute;
      left: 0;
      right: 0;
      bottom: max(30px, env(safe-area-inset-bottom));
      margin: 0;
      text-align: center;
      font-family: var(--fm-sans);
      font-size: 12.5px;
      letter-spacing: 0.14em;
      color: rgba(245, 241, 234, 0.55);
      animation: fm-late 2s ease-in-out infinite;
      pointer-events: none;
    }

    /* ============ EL LIENZO ============ */
    /* De borde a borde: el negro humo ES la página; nada de tarjeta
       centrada ni marcos que encierren en pantallas grandes. */
    .fm-lienzo {
      position: relative;
      width: 100%;
      background:
        radial-gradient(42rem 30rem at 50% -6%, rgba(200, 168, 120, 0.1), transparent 60%),
        radial-gradient(38rem 30rem at 50% 106%, rgba(200, 168, 120, 0.07), transparent 60%),
        linear-gradient(var(--fm-negro), var(--fm-negro-2) 55%, var(--fm-negro));
      overflow: hidden;
      text-align: center;
    }
    /* Un filete fino pegado al borde, como tarjetería impresa —
       acompaña sin encerrar. */
    .fm-lienzo::before {
      content: "";
      position: absolute;
      inset: 10px;
      border: 1px solid var(--fm-oro-tenue);
      pointer-events: none;
      z-index: 1;
    }
    .fm-lienzo > * { position: relative; z-index: 2; }

    /* ============ Las escenas ============ */
    .fm-esc {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 64vh;
      min-height: 64svh;
      padding: 64px 26px;
      overflow: hidden;
    }
    .fm-esc-hero { min-height: 100vh; min-height: 100svh; }

    /* Estado previo al reveal: SOLO bajo .fm-anima (la agrega el JS). */
    .fm-anima .fm-esc .fm-rev {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.9s ease var(--fm-d, 0s), transform 0.9s ease var(--fm-d, 0s);
    }
    .fm-anima .fm-esc.fm-vista .fm-rev { opacity: 1; transform: none; }

    /* Las líneas doradas que se dibujan al entrar cada sección. */
    .fm-linea {
      width: min(210px, 58%);
      height: 1px;
      margin: 0 auto;
      background: linear-gradient(90deg, transparent, var(--fm-oro), transparent);
    }
    .fm-anima .fm-esc .fm-linea {
      transform: scaleX(0);
      transition: transform 1.1s cubic-bezier(0.22, 1, 0.36, 1) var(--fm-d, 0.15s);
    }
    .fm-anima .fm-esc.fm-vista .fm-linea { transform: scaleX(1); }

    /* El ornamento línea — rombo — línea. */
    .fm-orna {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--fm-oro);
    }
    .fm-orna::before,
    .fm-orna::after {
      content: "";
      height: 1px;
      width: 56px;
      background: linear-gradient(90deg, transparent, currentColor);
    }
    .fm-orna::after { background: linear-gradient(90deg, currentColor, transparent); }
    .fm-anima .fm-esc .fm-orna::before,
    .fm-anima .fm-esc .fm-orna::after {
      transform: scaleX(0);
      transition: transform 1s ease var(--fm-d, 0.2s);
    }
    .fm-anima .fm-esc.fm-vista .fm-orna::before,
    .fm-anima .fm-esc.fm-vista .fm-orna::after { transform: scaleX(1); }
    .fm-rombo {
      width: 7px;
      height: 7px;
      border: 1px solid currentColor;
      transform: rotate(45deg);
      flex: none;
    }

    /* La cortina de luz que cruza el hero al revelarse. */
    .fm-anima .fm-esc-hero::after {
      content: "";
      position: absolute;
      inset: -10% -30%;
      background: linear-gradient(105deg, transparent 36%, rgba(200, 168, 120, 0.1) 46%, rgba(245, 241, 234, 0.17) 50%, rgba(200, 168, 120, 0.1) 54%, transparent 64%);
      transform: translateX(-130%);
      pointer-events: none;
    }
    .fm-anima .fm-esc-hero.fm-vista::after { animation: fm-luz 1.7s ease 0.35s both; }

    /* Tipos base */
    .fm-etiqueta {
      margin: 0;
      font-family: var(--fm-sans);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.42em;
      text-transform: uppercase;
      color: var(--fm-oro);
    }
    .fm-titulo-seccion {
      margin: 14px 0 0;
      font-weight: 400;
      font-size: clamp(27px, 7.6vw, 60px);
      line-height: 1.12;
      letter-spacing: 0.02em;
      color: var(--fm-marfil);
    }
    .fm-nota {
      margin: 16px auto 0;
      max-width: 46ch;
      font-family: var(--fm-sans);
      font-size: clamp(13.5px, 1.15vw, 16.5px);
      line-height: 1.65;
      color: var(--fm-marfil-suave);
    }

    /* ============ 1 · Hero ============ */
    .fm-sello { width: 132px; height: 132px; margin: 0 auto 26px; }
    .fm-sello-giro {
      transform-box: fill-box;
      transform-origin: center;
      animation: fm-gira 36s linear infinite;
    }
    .fm-sello text {
      font-family: var(--fm-serif);
      font-size: 26px;
      letter-spacing: 0.1em;
      fill: var(--fm-marfil);
    }
    .fm-hero-nombres {
      margin: 22px 0 0;
      font-weight: 400;
      font-size: clamp(40px, 11.5vw, 108px);
      line-height: 1.06;
      letter-spacing: 0.02em;
    }
    .fm-hero-sub {
      margin: 22px auto 0;
      max-width: 44ch;
      font-size: clamp(16.5px, 1.5vw, 21px);
      font-style: italic;
      line-height: 1.6;
      color: var(--fm-marfil-suave);
    }
    .fm-hero-baja {
      margin: 40px auto 0;
      font-family: var(--fm-sans);
      font-size: 11px;
      letter-spacing: 0.34em;
      text-transform: uppercase;
      color: rgba(245, 241, 234, 0.5);
    }
    .fm-hero-baja b {
      display: block;
      margin-top: 8px;
      font-weight: 400;
      color: var(--fm-oro);
      animation: fm-late 1.8s ease-in-out infinite;
    }

    /* ============ 2 · Código de vestimenta ============ */
    .fm-siluetas {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: clamp(26px, 9vw, 54px);
      margin-top: 34px;
    }
    .fm-silueta { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .fm-silueta svg { width: clamp(96px, 27vw, 124px); height: auto; }
    .fm-silueta figcaption {
      font-family: var(--fm-sans);
      font-size: 10.5px;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--fm-marfil-suave);
    }
    /* Los trazos se dibujan al entrar la escena (pathLength="1"). */
    .fm-anima .fm-trazo [pathLength] {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      transition: stroke-dashoffset 1.9s ease var(--fm-d, 0.3s);
    }
    .fm-anima .fm-vista .fm-trazo [pathLength] { stroke-dashoffset: 0; }

    /* ============ 3 · Información principal ============ */
    .fm-fecha-grande {
      margin: 20px 0 0;
      font-weight: 400;
      font-size: clamp(33px, 9vw, 76px);
      line-height: 1.15;
      color: var(--fm-marfil);
    }
    .fm-hora-grande {
      margin: 14px 0 0;
      font-size: clamp(23px, 6.4vw, 46px);
      color: var(--fm-oro);
      letter-spacing: 0.06em;
    }

    /* ============ 4 · Cuenta regresiva ============ */
    .fm-cd {
      display: flex;
      justify-content: center;
      gap: clamp(10px, 3.4vw, 20px);
      margin-top: 30px;
    }
    .fm-cd-c {
      min-width: 64px;
      padding: 14px 6px 12px;
      border-top: 1px solid var(--fm-oro-suave);
      border-bottom: 1px solid var(--fm-oro-suave);
    }
    .fm-cd-c span {
      display: block;
      font-size: clamp(28px, 8vw, 56px);
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--fm-marfil);
    }
    .fm-cd-c small {
      display: block;
      margin-top: 8px;
      font-family: var(--fm-sans);
      font-size: 9.5px;
      letter-spacing: 0.26em;
      text-transform: uppercase;
      color: var(--fm-oro);
    }
    .fm-cd-hoy {
      margin: 26px 0 0;
      font-size: 24px;
      font-style: italic;
      color: var(--fm-oro);
    }
    .fm-cd-hoy[hidden] { display: none; }
    .fm-cd[hidden] { display: none; }

    /* ============ 5 · El lugar ============ */
    .fm-lugar-nombre {
      margin: 18px 0 0;
      font-weight: 400;
      font-size: clamp(28px, 8vw, 68px);
      line-height: 1.15;
    }
    .fm-lugar-dir {
      margin: 12px auto 0;
      max-width: 42ch;
      font-family: var(--fm-sans);
      font-size: clamp(14px, 1.2vw, 17px);
      line-height: 1.6;
      color: var(--fm-marfil-suave);
    }
    .fm-botones {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 26px;
    }
    .fm-boton {
      display: inline-block;
      padding: 12px 26px 13px;
      font-family: var(--fm-sans);
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--fm-negro);
      background: var(--fm-oro);
      border: 1px solid var(--fm-oro);
      transition: background 0.25s ease, color 0.25s ease;
    }
    .fm-boton:hover { background: #d8bc90; }
    .fm-boton-linea {
      background: transparent;
      color: var(--fm-oro);
    }
    .fm-boton-linea:hover { background: var(--fm-oro-tenue); color: var(--fm-marfil); }

    /* ============ 6 · Llamado al RSVP ============ */
    .fm-confirma-titulo {
      margin: 16px 0 0;
      font-weight: 400;
      font-size: clamp(30px, 8.6vw, 66px);
      line-height: 1.15;
    }
    .fm-flecha {
      display: block;
      margin: 26px auto 0;
      font-size: 20px;
      color: var(--fm-oro);
      animation: fm-late 1.6s ease-in-out infinite;
    }

    /* ============ 7 · Muestras de cariño ============ */
    .fm-sinpe {
      margin: 26px auto 0;
      padding: 20px 26px 22px;
      max-width: 320px;
      border: 1px solid var(--fm-oro-suave);
      background: rgba(200, 168, 120, 0.06);
    }
    .fm-sinpe p { margin: 0; }
    .fm-sinpe-tag {
      font-family: var(--fm-sans);
      font-size: 10.5px;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--fm-oro);
    }
    .fm-sinpe-num {
      margin-top: 10px !important;
      font-size: clamp(26px, 7.4vw, 40px);
      letter-spacing: 0.1em;
      color: var(--fm-marfil);
      font-variant-numeric: tabular-nums;
    }
    .fm-cierre {
      padding: 0 26px 46px;
    }

    /* ============ Keyframes ============ */
    @keyframes fm-gira { to { transform: rotate(360deg); } }
    @keyframes fm-luz { to { transform: translateX(130%); } }
    @keyframes fm-luz-intro { to { transform: translateX(120%); } }
    @keyframes fm-aparece {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes fm-late {
      0%, 100% { transform: translateY(0); opacity: 0.7; }
      50% { transform: translateY(4px); opacity: 1; }
    }

    @media (min-width: 480px) {
      .fm-esc { padding: 76px 40px; }
    }

    /* En tablet y desktop la escena aprovecha todo el ancho: líneas
       doradas que cruzan el viewport, sello y contador más grandes. */
    @media (min-width: 768px) {
      .fm-esc { padding: 96px 48px; }
      .fm-linea { width: min(74vw, 940px); }
      .fm-orna::before,
      .fm-orna::after { width: clamp(56px, 16vw, 220px); }
      .fm-sello { width: 168px; height: 168px; }
      .fm-intro-sello { width: 156px; height: 156px; }
      .fm-cd { gap: 22px; }
      .fm-cd-c { min-width: 108px; padding: 20px 12px 16px; }
      .fm-cd-c small { font-size: 10.5px; }
      .fm-siluetas { gap: 72px; }
      .fm-silueta svg { width: 150px; }
      .fm-sinpe { max-width: 380px; padding: 24px 32px 26px; }
      .fm-boton { padding: 14px 32px 15px; font-size: 13.5px; }
    }

    /* Sin movimiento: nada se anima, la intro ni aparece y todo el
       contenido queda visible (el script tampoco agrega .fm-anima). */
    @media (prefers-reduced-motion: reduce) {
      #fm-intro { display: none !important; }
      .fm *, .fm *::before, .fm *::after {
        animation: none !important;
        transition: none !important;
      }
      .fm-anima .fm-esc .fm-rev { opacity: 1; transform: none; }
      .fm-anima .fm-esc .fm-linea,
      .fm-anima .fm-esc .fm-orna::before,
      .fm-anima .fm-esc .fm-orna::after { transform: scaleX(1); }
      .fm-anima .fm-trazo [pathLength] { stroke-dashoffset: 0; }
    }
  </style>

  <!-- ================= INTRO ================= -->
  <dialog id="fm-intro" aria-label="Abrir la invitación">
    <div class="fm-intro-marco">
      <svg class="fm-intro-sello" viewBox="0 0 120 120" aria-hidden="true">
        <g class="fm-sello-giro" fill="none" stroke="#c8a878">
          <circle cx="60" cy="60" r="56" stroke-width="1" opacity="0.7" />
          <circle cx="60" cy="60" r="49" stroke-width="1" stroke-dasharray="2 5" opacity="0.6" />
          <path d="M60 1 l3.4 3.4 -3.4 3.4 -3.4 -3.4 Z" fill="#c8a878" stroke="none" />
          <path d="M60 112.2 l3.4 3.4 -3.4 3.4 -3.4 -3.4 Z" fill="#c8a878" stroke="none" />
          <path d="M1 60 l3.4 -3.4 3.4 3.4 -3.4 3.4 Z" fill="#c8a878" stroke="none" />
          <path d="M112.2 60 l3.4 -3.4 3.4 3.4 -3.4 3.4 Z" fill="#c8a878" stroke="none" />
        </g>
        <circle cx="60" cy="60" r="41" fill="none" stroke="#c8a878" stroke-width="1" opacity="0.9" />
        <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
          style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; letter-spacing: 0.08em; fill: #f5f1ea;">E & R</text>
      </svg>
      <p class="fm-intro-nombres">Elena & Rodrigo</p>
      <p class="fm-intro-ocasion">Gala 50 aniversario</p>
    </div>
    <p class="fm-toca">Tocá para abrir la invitación</p>
  </dialog>

  <!-- ================= LA INVITACIÓN ================= -->
  <div class="fm-lienzo">

    <!-- 1 · Portada -->
    <section class="fm-esc fm-esc-hero" data-fm-escena>
      <div class="fm-rev">
        <svg class="fm-sello" viewBox="0 0 120 120" aria-hidden="true">
          <g class="fm-sello-giro" fill="none" stroke="#c8a878">
            <circle cx="60" cy="60" r="56" stroke-width="1" opacity="0.7" />
            <circle cx="60" cy="60" r="49" stroke-width="1" stroke-dasharray="2 5" opacity="0.6" />
            <path d="M60 1 l3.4 3.4 -3.4 3.4 -3.4 -3.4 Z" fill="#c8a878" stroke="none" />
            <path d="M60 112.2 l3.4 3.4 -3.4 3.4 -3.4 -3.4 Z" fill="#c8a878" stroke="none" />
            <path d="M1 60 l3.4 -3.4 3.4 3.4 -3.4 3.4 Z" fill="#c8a878" stroke="none" />
            <path d="M112.2 60 l3.4 -3.4 3.4 3.4 -3.4 3.4 Z" fill="#c8a878" stroke="none" />
          </g>
          <circle cx="60" cy="60" r="41" fill="none" stroke="#c8a878" stroke-width="1" opacity="0.9" />
          <text x="60" y="60" text-anchor="middle" dominant-baseline="central">E & R</text>
        </svg>
      </div>
      <p class="fm-etiqueta fm-rev" style="--fm-d: 0.15s">Gala 50 aniversario</p>
      <h1 class="fm-hero-nombres fm-rev" style="--fm-d: 0.3s">Elena & Rodrigo</h1>
      <div class="fm-orna fm-rev" style="--fm-d: 0.5s; margin-top: 24px"><span class="fm-rombo"></span></div>
      <p class="fm-hero-sub fm-rev" style="--fm-d: 0.62s">
        Será un honor contar con su presencia
        en esta velada tan especial.
      </p>
      <p class="fm-hero-baja fm-rev" style="--fm-d: 0.8s">La historia continúa<b aria-hidden="true">▼</b></p>
    </section>

    <!-- 2 · Código de vestimenta -->
    <section class="fm-esc" data-fm-escena>
      <p class="fm-etiqueta fm-rev">Código de vestimenta</p>
      <h2 class="fm-titulo-seccion fm-rev" style="--fm-d: 0.12s">Etiqueta rigurosa</h2>
      <div class="fm-linea fm-rev" style="--fm-d: 0.24s; margin-top: 20px"></div>
      <div class="fm-siluetas">
        <figure class="fm-silueta fm-rev" style="--fm-d: 0.3s; margin: 0">
          <svg class="fm-trazo" viewBox="0 0 140 220" fill="none" stroke="#c8a878" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <!-- Esmoquin: saco, solapas, corbatín y botones. -->
            <path pathLength="1" style="--fm-d: 0.35s" d="M56 22 C48 26 38 30 32 34 C24 40 22 52 22 64 L22 196 L118 196 L118 64 C118 52 116 40 108 34 C102 30 92 26 84 22" />
            <path pathLength="1" style="--fm-d: 0.7s" d="M56 22 L54 64 L70 96 L86 64 L84 22" />
            <path pathLength="1" style="--fm-d: 0.95s" d="M56 22 Q70 32 84 22" />
            <path pathLength="1" style="--fm-d: 1.1s" d="M70 96 L70 196" />
            <path pathLength="1" style="--fm-d: 1.2s" d="M58 40 L70 46 L82 40 L82 52 L70 46 L58 52 Z" />
            <circle pathLength="1" style="--fm-d: 1.35s" cx="70" cy="116" r="2.4" />
            <circle pathLength="1" style="--fm-d: 1.45s" cx="70" cy="140" r="2.4" />
            <circle pathLength="1" style="--fm-d: 1.55s" cx="70" cy="164" r="2.4" />
            <path pathLength="1" style="--fm-d: 1.6s" d="M96 104 L110 104 L103 114 Z" />
          </svg>
          <figcaption>Ellos</figcaption>
        </figure>
        <figure class="fm-silueta fm-rev" style="--fm-d: 0.45s; margin: 0">
          <svg class="fm-trazo" viewBox="0 0 140 220" fill="none" stroke="#c8a878" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <!-- Vestido de gala: corpiño, talle y falda con caída. -->
            <path pathLength="1" style="--fm-d: 0.5s" d="M70 22 C63 28 57 32 50 34 L46 62 Q70 74 94 62 L90 34 C83 32 77 28 70 22 Z" />
            <path pathLength="1" style="--fm-d: 0.85s" d="M50 34 L58 16" />
            <path pathLength="1" style="--fm-d: 0.95s" d="M90 34 L82 16" />
            <path pathLength="1" style="--fm-d: 1.05s" d="M46 62 C36 108 26 148 18 194 Q70 210 122 194 C114 148 104 108 94 62" />
            <path pathLength="1" style="--fm-d: 1.35s" d="M60 74 C58 112 52 152 46 190" />
            <path pathLength="1" style="--fm-d: 1.5s" d="M80 74 C82 112 88 152 94 190" />
            <path pathLength="1" style="--fm-d: 1.65s" d="M64 50 l3 3 -3 3 -3 -3 Z" />
          </svg>
          <figcaption>Ellas</figcaption>
        </figure>
      </div>
      <p class="fm-nota fm-rev" style="--fm-d: 0.6s">
        Caballeros: esmoquin o traje oscuro.
        Señoras: vestido de gala largo.
      </p>
    </section>

    <!-- 3 · Información principal -->
    <section class="fm-esc" data-fm-escena>
      <p class="fm-etiqueta fm-rev">La cita</p>
      <p class="fm-fecha-grande fm-rev" style="--fm-d: 0.15s">sábado 21 de noviembre, 2026</p>
      <div class="fm-linea fm-rev" style="--fm-d: 0.3s; margin-top: 22px"></div>
      <p class="fm-hora-grande fm-rev" style="--fm-d: 0.42s">7:00 p. m.</p>
      <p class="fm-nota fm-rev" style="--fm-d: 0.56s">
        Recepción con copa de bienvenida al ingresar.
        Agradecemos su puntualidad.
      </p>
    </section>

    <!-- 4 · Cuenta regresiva -->
    <section class="fm-esc" data-fm-escena>
      <p class="fm-etiqueta fm-rev">Cuenta regresiva</p>
      <h2 class="fm-titulo-seccion fm-rev" style="--fm-d: 0.12s">Cada segundo nos acerca</h2>
      <div class="fm-cd fm-rev" id="fm-cd" data-fecha="2026-11-21T19:00:00-06:00" role="timer" aria-label="Tiempo restante para la gala" style="--fm-d: 0.28s">
        <div class="fm-cd-c"><span id="fm-cd-d">–</span><small>días</small></div>
        <div class="fm-cd-c"><span id="fm-cd-h">–</span><small>horas</small></div>
        <div class="fm-cd-c"><span id="fm-cd-m">–</span><small>min</small></div>
        <div class="fm-cd-c"><span id="fm-cd-s">–</span><small>seg</small></div>
      </div>
      <p class="fm-cd-hoy" id="fm-cd-hoy" hidden>La gran noche es hoy.</p>
      <div class="fm-orna fm-rev" style="--fm-d: 0.5s; margin-top: 30px"><span class="fm-rombo"></span></div>
    </section>

    <!-- 5 · El lugar -->
    <section class="fm-esc" data-fm-escena>
      <p class="fm-etiqueta fm-rev">El lugar</p>
      <h2 class="fm-lugar-nombre fm-rev" style="--fm-d: 0.15s">Hotel Casa Real</h2>
      <p class="fm-lugar-dir fm-rev" style="--fm-d: 0.3s">Barrio Otoya, San José</p>
      <div class="fm-linea fm-rev" style="--fm-d: 0.42s; margin-top: 22px"></div>
      <div class="fm-botones fm-rev" style="--fm-d: 0.54s">
        <a class="fm-boton" href="https://www.google.com/maps/search/?api=1&query=Hotel%20Casa%20Real%2C%20Barrio%20Otoya%2C%20San%20Jos%C3%A9%2C%20Costa%20Rica" target="_blank" rel="noopener noreferrer">Google Maps</a>
        <a class="fm-boton fm-boton-linea" href="https://waze.com/ul?q=Hotel%20Casa%20Real%2C%20Barrio%20Otoya%2C%20San%20Jos%C3%A9" target="_blank" rel="noopener noreferrer">Waze</a>
      </div>
    </section>

    <!-- 6 · Llamado al RSVP (el formulario lo agrega la página, abajo) -->
    <section class="fm-esc" data-fm-escena>
      <div class="fm-orna fm-rev"><span class="fm-rombo"></span></div>
      <h2 class="fm-confirma-titulo fm-rev" style="--fm-d: 0.15s">Confirmá tu asistencia</h2>
      <p class="fm-nota fm-rev" style="--fm-d: 0.3s">
        Al final de esta invitación está el formulario —
        toma menos de un minuto.
      </p>
      <span class="fm-flecha fm-rev" style="--fm-d: 0.45s" aria-hidden="true">▼</span>
    </section>

    <!-- 7 · Muestras de cariño -->
    <section class="fm-esc" data-fm-escena style="min-height: 0; padding-bottom: 30px">
      <p class="fm-etiqueta fm-rev">Muestras de cariño</p>
      <p class="fm-nota fm-rev" style="--fm-d: 0.15s; font-size: 14.5px">
        Su compañía es nuestro mayor regalo. Si además desean
        tener un gesto con nosotros, estas son algunas opciones:
      </p>
      <div class="fm-botones fm-rev" style="--fm-d: 0.3s">
        <a class="fm-boton fm-boton-linea" href="https://bookea.lat" target="_blank" rel="noopener noreferrer">Lista de regalos</a>
        <a class="fm-boton fm-boton-linea" href="https://bookea.lat" target="_blank" rel="noopener noreferrer">Mesa de regalos</a>
      </div>
      <div class="fm-sinpe fm-rev" style="--fm-d: 0.45s">
        <p class="fm-sinpe-tag">SINPE Móvil</p>
        <p class="fm-sinpe-num">8888-8888</p>
      </div>
    </section>

    <div class="fm-cierre">
      <div class="fm-orna" style="color: rgba(200, 168, 120, 0.5)"><span class="fm-rombo"></span></div>
    </div>
  </div>
</div>

<script>
  /* ============ Intro: <dialog> con cortina de luz ============ */
  (function () {
    var dlg = document.getElementById("fm-intro");
    if (!dlg || typeof dlg.showModal !== "function") { if (dlg) dlg.remove(); return; }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dlg.remove();
      return;
    }
    var abierta = false;
    var timer = null;
    function abrir() {
      if (abierta) return;
      abierta = true;
      if (timer) window.clearTimeout(timer);
      dlg.classList.add("fm-intro-abierta");
      window.setTimeout(function () {
        try { dlg.close(); } catch (e) { /* ya cerrado */ }
        dlg.remove();
      }, 1100);
    }
    try { dlg.showModal(); } catch (e) { dlg.remove(); return; }
    dlg.addEventListener("click", abrir);
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); abrir(); });
    timer = window.setTimeout(abrir, 3200);
  })();

  /* ============ Escenas: se revelan una por una al scrollear ========= */
  (function () {
    var raiz = document.querySelector(".fm");
    if (!raiz) return;
    var escenas = raiz.querySelectorAll("[data-fm-escena]");
    var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducido || !("IntersectionObserver" in window)) {
      // Sin movimiento o sin observer: todo visible de una vez.
      for (var i = 0; i < escenas.length; i++) escenas[i].classList.add("fm-vista");
      return;
    }
    raiz.classList.add("fm-anima");
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (ent) {
        if (ent.isIntersecting) {
          ent.target.classList.add("fm-vista");
          io.unobserve(ent.target);
        }
      });
    }, { threshold: 0.22, rootMargin: "0px 0px -8% 0px" });
    escenas.forEach(function (esc) { io.observe(esc); });
  })();

  /* ============ Cuenta regresiva viva ============ */
  (function () {
    var caja = document.getElementById("fm-cd");
    if (!caja) return;
    var objetivo = new Date(caja.getAttribute("data-fecha") || "").getTime();
    if (isNaN(objetivo)) return;
    var d = document.getElementById("fm-cd-d");
    var h = document.getElementById("fm-cd-h");
    var m = document.getElementById("fm-cd-m");
    var s = document.getElementById("fm-cd-s");
    var hoy = document.getElementById("fm-cd-hoy");
    var timer = null;
    function dosDigitos(n) { return n < 10 ? "0" + n : "" + n; }
    function tic() {
      var resto = objetivo - Date.now();
      if (resto <= 0) {
        caja.hidden = true;
        if (hoy) hoy.hidden = false;
        if (timer) window.clearInterval(timer);
        return;
      }
      var seg = Math.floor(resto / 1000);
      if (d) d.textContent = "" + Math.floor(seg / 86400);
      if (h) h.textContent = dosDigitos(Math.floor((seg % 86400) / 3600));
      if (m) m.textContent = dosDigitos(Math.floor((seg % 3600) / 60));
      if (s) s.textContent = dosDigitos(seg % 60);
    }
    tic();
    timer = window.setInterval(tic, 1000);
  })();
</script>
$inv_formal$
)
on conflict (slug) do update set
  tema = excluded.tema,
  titulo = excluded.titulo,
  anfitriones = excluded.anfitriones,
  mensaje = excluded.mensaje,
  fecha_evento = excluded.fecha_evento,
  hora = excluded.hora,
  lugar_nombre = excluded.lugar_nombre,
  direccion = excluded.direccion,
  estado = 'activa',
  html_personalizado = excluded.html_personalizado;

insert into invitaciones (
  slug, tema, titulo, anfitriones, mensaje, fecha_evento, hora,
  lugar_nombre, direccion, estado, html_personalizado
)
values (
  'demo-zoologico',
  'zoologico',
  'El safari de Valentina — ¡cumple 4!',
  'Papá y mamá de Valentina',
  '¡Nuestra exploradora favorita cumple 4 y lo celebramos en grande!',
  '2026-10-10',
  '10:00 a. m.',
  'Salón La Selva',
  'San Francisco de Heredia',
  'activa',
  $inv_zoo$<!--
  Plantilla "Zoológico" — fiesta infantil de safari/zoo. Colores alegres
  (verde selva, amarillo sol, naranja), tipografía redonda gruesa y un
  elenco de animales: la jirafa protagonista cuyo cuello CRECE con el
  scroll del hero, un monito que se columpia en su liana, un elefante que
  saluda con la trompa al entrar "El lugar", huellitas que marcan el
  camino y animalitos tocables que hacen su sonido en una burbujita.

  USO: sustituir los placeholders y guardar el resultado en
  invitaciones.html_personalizado. La página /i/{slug} lo inyecta a
  pantalla completa (el fragmento ocupa todo el ancho del viewport; la
  crema del safari ES la página) y agrega ella misma el bloque RSVP
  "¿Nos acompañás?" debajo — por eso la sección 6 llama a confirmar
  "aquí abajito".

  ESTRUCTURA (escenas que se revelan UNA POR UNA al scrollear con
  IntersectionObserver, cada una con su propia entrada):
    1. Portada/hero (sol, globos y la jirafa que estira el cuello)
    2. Código de vestimenta ("Venite estilo safari 🧢")
    3. Información principal (fecha y hora en grande, cebra que asoma)
    4. Cuenta regresiva viva (con león ¡Rooar!)
    5. El lugar (elefante que saluda + Google Maps / Waze)
    6. Llamado "Confirmá tu asistencia ▼" (empata con el RSVP de la página)
    7. Muestras de cariño (regalos + SINPE, con la vaquita ¡Muu!)

  PLACEHOLDERS:
    Valentina         nombre del festejado      p. ej. Valentina
    4           edad que cumple           p. ej. 4
    sábado 10 de octubre, 2026          fecha en palabras         p. ej. sábado 10 de octubre
    10:00 a. m.           hora                      p. ej. 10:00 a. m.
    2026-10-10T10:00:00-06:00      fecha-hora ISO con zona   p. ej. 2026-10-10T10:00:00-06:00
    Salón La Selva          nombre del lugar          p. ej. Salón La Selva
    San Francisco de Heredia      dirección corta           p. ej. Heredia, 400 m oeste…
    https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20La%20Selva%2C%20San%20Francisco%2C%20Heredia%2C%20Costa%20Rica      URL de Google Maps
    https://waze.com/ul?q=Sal%C3%B3n%20La%20Selva%2C%20San%20Francisco%2C%20Heredia      URL de Waze
    https://bookea.lat  URL lista de regalos
    https://bookea.lat  URL segunda opción de regalo
    8888-8888          número SINPE Móvil        p. ej. 8888-8888

  NOTAS TÉCNICAS:
  - Autocontenido: CSS en el <style> y JS en el <script> de este mismo
    fragmento; cero librerías, cero recursos remotos (solo SVG inline y
    un data-URI de huellita). Estilos namespaced con .zoo-/#zoo-.
  - La intro usa <dialog>.showModal() (top layer: escapa el transform del
    contenedor [data-reveal] de la página). Sin JS o con
    prefers-reduced-motion no hay intro y todo queda visible.
  - Los estados "oculto antes de revelar" solo existen bajo .zoo-anima,
    clase que agrega el script: sin JS la invitación se ve completa.
  - Los animalitos rebotan y "hablan" con onclick inline (funciona aunque
    el <script> principal no corra).
-->
<div class="zoo">
  <style>
    /* ============ Tokens del tema ============ */
    .zoo {
      --zoo-selva: #1e7a3c;
      --zoo-selva-osc: #14522a;
      --zoo-sol: #ffd23f;
      --zoo-naranja: #ff8a3d;
      --zoo-cafe: #7a4a12;
      --zoo-crema: #fff7e0;
      --zoo-cielo: #cdeef9;
      --zoo-tinta: #3a2d1a;
      --zoo-f: "Arial Rounded MT Bold", "Trebuchet MS", "Comic Sans MS", "Chalkboard SE", Verdana, sans-serif;
      display: block;
      font-family: var(--zoo-f);
      color: var(--zoo-tinta);
    }

    /* ============ INTRO (dialog en el top layer) ============ */
    #zoo-intro {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: linear-gradient(#9adcf5, var(--zoo-cielo) 55%, #e9f8d6);
      overflow: hidden;
      z-index: 2147483000;
      cursor: pointer;
      color: var(--zoo-tinta);
    }
    #zoo-intro:focus { outline: none; }
    #zoo-intro::backdrop { background: rgba(10, 40, 20, 0.55); }

    /* Cortinas de selva con borde de hojas mordidas. */
    .zoo-cortina {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 54%;
      background:
        radial-gradient(34rem 26rem at 50% 115%, rgba(20, 82, 42, 0.65), transparent 62%),
        linear-gradient(var(--zoo-selva), var(--zoo-selva-osc));
      transition: transform 0.85s cubic-bezier(0.65, 0, 0.35, 1);
      will-change: transform;
      z-index: 1;
    }
    .zoo-cortina-izq {
      left: 0;
      clip-path: polygon(0 0, 93% 0, 100% 6%, 92% 13%, 99% 21%, 92% 29%, 100% 37%, 93% 46%, 99% 54%, 92% 62%, 100% 70%, 93% 79%, 99% 87%, 92% 94%, 97% 100%, 0 100%);
    }
    .zoo-cortina-der {
      right: 0;
      clip-path: polygon(100% 0, 7% 0, 0 6%, 8% 13%, 1% 21%, 8% 29%, 0 37%, 7% 46%, 1% 54%, 8% 62%, 0 70%, 7% 79%, 1% 87%, 8% 94%, 3% 100%, 100% 100%);
    }
    .zoo-intro-abierta .zoo-cortina-izq { transform: translateX(-105%); }
    .zoo-intro-abierta .zoo-cortina-der { transform: translateX(105%); }
    .zoo-hoja-intro { position: absolute; width: 90px; height: auto; opacity: 0.45; }

    .zoo-intro-nucleo {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      pointer-events: none;
      transition: opacity 0.5s ease;
    }
    .zoo-intro-abierta .zoo-intro-nucleo { opacity: 0; }
    .zoo-intro-sol { width: 120px; height: 120px; animation: zoo-aparece 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }
    .zoo-intro-cartel {
      padding: 12px 22px 14px;
      background: linear-gradient(#b97a3e, #a86b32);
      border: 4px solid var(--zoo-cafe);
      border-radius: 16px;
      box-shadow: 0 6px 0 rgba(58, 45, 26, 0.45);
      color: var(--zoo-crema);
      font-size: 22px;
      font-weight: 800;
      text-shadow: 1px 2px 0 rgba(58, 45, 26, 0.4);
      transform: rotate(-2deg);
      animation: zoo-aparece 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
    }
    .zoo-toca {
      position: absolute;
      left: 0;
      right: 0;
      bottom: max(26px, env(safe-area-inset-bottom));
      z-index: 2;
      margin: 0;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: rgba(58, 45, 26, 0.7);
      animation: zoo-late 1.8s ease-in-out infinite;
      pointer-events: none;
    }
    .zoo-intro-abierta .zoo-toca { opacity: 0; transition: opacity 0.3s; }

    /* ============ EL LIENZO ============ */
    /* De borde a borde: la crema del safari ES la página; nada de
       tarjeta centrada con marco en pantallas grandes. */
    .zoo-lienzo {
      position: relative;
      width: 100%;
      overflow: hidden;
      background: var(--zoo-crema);
      text-align: center;
    }

    /* ============ Las escenas ============ */
    .zoo-esc {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      min-height: 60svh;
      padding: 54px 22px;
      overflow: hidden;
    }
    .zoo-esc:nth-child(odd):not(.zoo-esc-hero) { background: linear-gradient(rgba(216, 240, 197, 0.55), rgba(255, 247, 224, 0)); }
    .zoo-esc-hero {
      min-height: 100vh;
      min-height: 100svh;
      justify-content: flex-start;
      padding-top: 74px;
      padding-bottom: 0;
      background: linear-gradient(#9adcf5, var(--zoo-cielo) 46%, #e9f8d6 84%, #d2ecb4);
    }

    /* Estado previo al reveal: SOLO bajo .zoo-anima (la agrega el JS). */
    .zoo-anima .zoo-esc .zoo-rev {
      opacity: 0;
      transform: translateY(26px) scale(0.94);
      transition: opacity 0.65s ease var(--zoo-d, 0s), transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) var(--zoo-d, 0s);
    }
    .zoo-anima .zoo-esc.zoo-vista .zoo-rev { opacity: 1; transform: none; }

    /* Animalitos que asoman desde los bordes al armarse la escena. */
    .zoo-peek {
      position: absolute;
      z-index: 3;
      line-height: 0;
    }
    .zoo-anima .zoo-esc .zoo-peek-izq { transform: translateX(-120%) rotate(-6deg); transition: transform 0.9s cubic-bezier(0.34, 1.4, 0.5, 1) var(--zoo-d, 0.35s); }
    .zoo-anima .zoo-esc .zoo-peek-der { transform: translateX(120%) rotate(6deg); transition: transform 0.9s cubic-bezier(0.34, 1.4, 0.5, 1) var(--zoo-d, 0.35s); }
    .zoo-anima .zoo-esc.zoo-vista .zoo-peek-izq,
    .zoo-anima .zoo-esc.zoo-vista .zoo-peek-der { transform: none; }

    /* ============ Huellitas: el camino del scroll ============ */
    .zoo-huellas {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 7px;
      margin: 0 0 18px;
    }
    .zoo-huella {
      width: 19px;
      height: 19px;
      opacity: 0.55;
      background: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%3E%3Cg%20fill='%237a4a12'%3E%3Cellipse%20cx='12'%20cy='16'%20rx='6'%20ry='4.6'/%3E%3Ccircle%20cx='4.6'%20cy='10'%20r='2.5'/%3E%3Ccircle%20cx='9.4'%20cy='7'%20r='2.6'/%3E%3Ccircle%20cx='14.8'%20cy='7'%20r='2.6'/%3E%3Ccircle%20cx='19.4'%20cy='10'%20r='2.5'/%3E%3C/g%3E%3C/svg%3E") center / contain no-repeat;
    }
    .zoo-huella:nth-child(odd) { transform: translateX(-11px) rotate(-16deg); }
    .zoo-huella:nth-child(even) { transform: translateX(11px) rotate(14deg); }
    .zoo-anima .zoo-esc .zoo-huella { opacity: 0; transition: opacity 0.45s ease; }
    .zoo-anima .zoo-esc.zoo-vista .zoo-huella:nth-child(1) { opacity: 0.55; transition-delay: 0s; }
    .zoo-anima .zoo-esc.zoo-vista .zoo-huella:nth-child(2) { opacity: 0.55; transition-delay: 0.14s; }
    .zoo-anima .zoo-esc.zoo-vista .zoo-huella:nth-child(3) { opacity: 0.55; transition-delay: 0.28s; }
    .zoo-anima .zoo-esc.zoo-vista .zoo-huella:nth-child(4) { opacity: 0.55; transition-delay: 0.42s; }

    /* ============ Cartel de madera y tipos ============ */
    .zoo-cartel {
      position: relative;
      display: inline-block;
      padding: 10px 20px 12px;
      background: linear-gradient(#b97a3e, #a86b32);
      border: 4px solid var(--zoo-cafe);
      border-radius: 16px;
      box-shadow: 0 5px 0 rgba(58, 45, 26, 0.4);
      color: var(--zoo-crema);
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      text-shadow: 1px 2px 0 rgba(58, 45, 26, 0.4);
      transform: rotate(-1.6deg);
    }
    .zoo-cartel::before,
    .zoo-cartel::after {
      content: "";
      position: absolute;
      top: 7px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #e8d3ae, #7a5a30 70%);
    }
    .zoo-cartel::before { left: 7px; }
    .zoo-cartel::after { right: 7px; }

    .zoo-titulo {
      margin: 16px 0 0;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1;
      color: #ffffff;
      text-shadow:
        -3px -3px 0 var(--zoo-selva-osc), 3px -3px 0 var(--zoo-selva-osc),
        -3px 3px 0 var(--zoo-selva-osc), 3px 3px 0 var(--zoo-selva-osc),
        5px 7px 0 rgba(20, 82, 42, 0.45);
    }
    .zoo-t1 { display: block; font-size: clamp(38px, 11.5vw, 100px); }
    .zoo-t2 { display: block; margin-top: 6px; font-size: clamp(26px, 8vw, 66px); }
    .zoo-edad {
      font-style: normal;
      color: var(--zoo-sol);
      font-size: 1.35em;
      text-shadow:
        -3px -3px 0 var(--zoo-cafe), 3px -3px 0 var(--zoo-cafe),
        -3px 3px 0 var(--zoo-cafe), 3px 3px 0 var(--zoo-cafe),
        5px 7px 0 rgba(122, 74, 18, 0.5);
    }
    .zoo-sub {
      margin: 16px auto 0;
      max-width: 34ch;
      font-size: clamp(16px, 1.5vw, 21px);
      font-weight: 700;
      line-height: 1.5;
      color: #4c5a2e;
    }
    .zoo-titulo-seccion {
      margin: 14px 0 0;
      font-size: clamp(25px, 7.4vw, 52px);
      font-weight: 800;
      line-height: 1.15;
      color: var(--zoo-selva-osc);
    }
    .zoo-nota {
      margin: 14px auto 0;
      max-width: 40ch;
      font-size: clamp(14.5px, 1.25vw, 18px);
      font-weight: 600;
      line-height: 1.6;
      color: #6b5a3a;
    }

    /* ============ Animal tocable + burbuja de sonido ============ */
    .zoo-animal {
      position: relative;
      display: inline-block;
      padding: 0;
      margin: 0;
      background: none;
      border: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      line-height: 0;
    }
    .zoo-animal:focus-visible { outline: 3px dashed var(--zoo-naranja); outline-offset: 4px; border-radius: 12px; }
    .zoo-animal > svg { display: block; }
    .zoo-animal.zoo-toc > svg { animation: zoo-rebote 0.8s cubic-bezier(0.3, 1.8, 0.4, 1) 1; }
    .zoo-grito {
      position: absolute;
      left: 50%;
      top: -16px;
      transform: translate(-50%, 0);
      opacity: 0;
      z-index: 6;
      padding: 5px 12px 6px;
      background: #fff;
      border: 3px solid var(--zoo-tinta);
      border-radius: 999px;
      font-family: var(--zoo-f);
      font-size: 15px;
      font-weight: 800;
      line-height: 1.2;
      color: var(--zoo-tinta);
      white-space: nowrap;
      pointer-events: none;
    }
    .zoo-grito::after {
      content: "";
      position: absolute;
      bottom: -7.5px;
      left: 50%;
      margin-left: -6px;
      width: 11px;
      height: 11px;
      background: #fff;
      border-right: 3px solid var(--zoo-tinta);
      border-bottom: 3px solid var(--zoo-tinta);
      transform: rotate(45deg);
    }
    .zoo-animal.zoo-toc .zoo-grito { animation: zoo-grito 1s ease both; }

    /* ============ 1 · Hero: sol, globos y jirafa ============ */
    .zoo-sol-svg { position: absolute; top: 16px; right: 12px; width: 92px; height: 92px; z-index: 1; }
    .zoo-sol-rayos { transform-box: fill-box; transform-origin: center; animation: zoo-gira 40s linear infinite; }
    .zoo-globo { position: absolute; z-index: 1; width: 44px; animation: zoo-flota 3.6s ease-in-out infinite alternate; }
    .zoo-globo-1 { top: 90px; left: 6%; }
    .zoo-globo-2 { top: 60px; left: 20%; width: 36px; animation-delay: 1.2s; }
    .zoo-globo-3 { top: 150px; right: 5%; width: 38px; animation-delay: 0.6s; }
    .zoo-hero-contenido { position: relative; z-index: 2; }
    .zoo-jirafa {
      position: relative;
      z-index: 2;
      width: min(58vw, 230px);
      margin: 26px auto 0;
      line-height: 0;
    }
    .zoo-jir-cuello {
      transform-box: fill-box;
      transform-origin: 50% 100%;
      transform: scaleY(var(--zoo-cuello, 1));
      transition: transform 0.15s linear;
    }
    .zoo-jir-cabeza {
      transform: translateY(calc((1 - var(--zoo-cuello, 1)) * 150px));
      transition: transform 0.15s linear;
    }
    .zoo-hero-baja {
      position: relative;
      z-index: 2;
      margin: 8px 0 26px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--zoo-selva-osc);
    }
    .zoo-hero-baja b { display: block; margin-top: 4px; animation: zoo-late 1.6s ease-in-out infinite; }

    /* ============ El monito en su liana ============ */
    .zoo-liana {
      position: relative;
      height: 128px;
      margin-top: -6px;
      z-index: 4;
      pointer-events: none;
    }
    .zoo-liana-col {
      position: absolute;
      top: 0;
      left: 50%;
      width: 120px;
      margin-left: -60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform-origin: 50% 0;
      animation: zoo-columpio 3.2s ease-in-out infinite;
      pointer-events: auto;
    }
    .zoo-vid { display: block; width: 26px; height: 48px; }
    .zoo-mono > svg { margin-top: -4px; }

    /* ============ 3 · Fecha y hora en grande ============ */
    .zoo-fecha-grande {
      margin: 18px 0 0;
      font-size: clamp(29px, 8.4vw, 68px);
      font-weight: 800;
      line-height: 1.12;
      color: var(--zoo-selva-osc);
    }
    .zoo-hora-grande {
      display: inline-block;
      margin: 16px 0 0;
      padding: 10px 24px 12px;
      background: var(--zoo-sol);
      border: 4px solid var(--zoo-cafe);
      border-radius: 999px;
      box-shadow: 0 5px 0 rgba(122, 74, 18, 0.45);
      font-size: clamp(21px, 6vw, 40px);
      font-weight: 800;
      color: var(--zoo-cafe);
      transform: rotate(-1.4deg);
    }
    .zoo-cebra { top: 34px; left: -6px; }

    /* ============ 4 · Cuenta regresiva ============ */
    .zoo-cd {
      display: flex;
      justify-content: center;
      gap: 9px;
      margin-top: 26px;
    }
    .zoo-cd-c {
      min-width: 66px;
      padding: 12px 4px 10px;
      background: #fff;
      border: 4px solid var(--zoo-selva-osc);
      border-radius: 18px;
      box-shadow: 0 5px 0 rgba(20, 82, 42, 0.35);
    }
    .zoo-cd-c span {
      display: block;
      font-size: clamp(26px, 7.6vw, 52px);
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--zoo-naranja);
    }
    .zoo-cd-c small {
      display: block;
      margin-top: 6px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--zoo-selva-osc);
    }
    .zoo-cd-hoy {
      margin: 24px 0 0;
      font-size: 24px;
      font-weight: 800;
      color: var(--zoo-naranja);
    }
    .zoo-cd-hoy[hidden] { display: none; }
    .zoo-cd[hidden] { display: none; }
    .zoo-leon { margin-top: 26px; }

    /* ============ 5 · El lugar y el elefante ============ */
    .zoo-lugar-nombre {
      margin: 16px 0 0;
      font-size: clamp(27px, 7.8vw, 62px);
      font-weight: 800;
      line-height: 1.12;
      color: var(--zoo-selva-osc);
    }
    .zoo-lugar-dir {
      margin: 10px auto 0;
      max-width: 38ch;
      font-size: clamp(14.5px, 1.2vw, 17px);
      font-weight: 600;
      line-height: 1.6;
      color: #6b5a3a;
    }
    .zoo-botones {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 22px;
    }
    .zoo-boton {
      display: inline-block;
      padding: 12px 24px 13px;
      background: var(--zoo-naranja);
      border: 4px solid var(--zoo-cafe);
      border-radius: 999px;
      box-shadow: 0 5px 0 var(--zoo-cafe);
      color: #fff;
      font-family: var(--zoo-f);
      font-size: 15px;
      font-weight: 800;
      text-decoration: none;
      text-shadow: 1px 1px 0 rgba(122, 74, 18, 0.5);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .zoo-boton:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--zoo-cafe); }
    .zoo-boton-verde { background: var(--zoo-selva); border-color: var(--zoo-selva-osc); box-shadow: 0 5px 0 var(--zoo-selva-osc); text-shadow: 1px 1px 0 rgba(20, 82, 42, 0.6); }
    .zoo-boton-verde:active { box-shadow: 0 1px 0 var(--zoo-selva-osc); }
    .zoo-elefante { margin-top: 26px; }
    .zoo-ele-trompa { transform-box: fill-box; transform-origin: 20% 8%; }
    /* El saludo: al entrar la escena, la trompa se agita solita. */
    .zoo-anima #zoo-lugar.zoo-vista .zoo-ele-trompa { animation: zoo-saluda 2.4s ease-in-out 0.7s 1; }
    .zoo-animal.zoo-toc .zoo-ele-trompa { animation: zoo-saluda 1.2s ease-in-out 1; }

    /* ============ 6 · Llamado al RSVP ============ */
    .zoo-confirma {
      display: inline-block;
      margin-top: 18px;
      padding: 14px 26px 16px;
      background: var(--zoo-sol);
      border: 4px solid var(--zoo-cafe);
      border-radius: 20px;
      box-shadow: 0 6px 0 rgba(122, 74, 18, 0.5);
      color: var(--zoo-cafe);
      font-size: clamp(20px, 5.8vw, 38px);
      font-weight: 800;
      transform: rotate(-1.4deg);
    }
    .zoo-flecha { display: inline-block; margin-left: 8px; animation: zoo-late 1.4s ease-in-out infinite; }
    .zoo-perico { top: 30px; right: -4px; }

    /* ============ 7 · Muestras de cariño ============ */
    .zoo-sinpe {
      margin: 24px auto 0;
      padding: 16px 24px 18px;
      max-width: 300px;
      background: #fff;
      border: 3px dashed var(--zoo-selva-osc);
      border-radius: 18px;
    }
    .zoo-sinpe p { margin: 0; }
    .zoo-sinpe-tag {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--zoo-selva);
    }
    .zoo-sinpe-num {
      margin-top: 8px !important;
      font-size: clamp(25px, 7vw, 38px);
      font-weight: 800;
      letter-spacing: 0.06em;
      color: var(--zoo-tinta);
      font-variant-numeric: tabular-nums;
    }
    .zoo-vaca { margin-top: 24px; }

    /* El pasto del cierre, para aterrizar suave en el RSVP. */
    .zoo-pasto { display: block; width: 100%; height: 56px; margin-top: -10px; }

    /* ============ Keyframes ============ */
    @keyframes zoo-gira { to { transform: rotate(360deg); } }
    @keyframes zoo-columpio {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(6deg); }
      75% { transform: rotate(-6deg); }
    }
    @keyframes zoo-flota {
      from { transform: translateY(0) rotate(-2deg); }
      to { transform: translateY(-12px) rotate(2deg); }
    }
    @keyframes zoo-late {
      0%, 100% { transform: translateY(0); opacity: 0.75; }
      50% { transform: translateY(4px); opacity: 1; }
    }
    @keyframes zoo-rebote {
      0% { transform: none; }
      30% { transform: translateY(-12px) scale(1.06); }
      55% { transform: translateY(3px) scale(0.97); }
      75% { transform: translateY(-5px); }
      100% { transform: none; }
    }
    @keyframes zoo-grito {
      0% { opacity: 0; transform: translate(-50%, 8px) scale(0.5); }
      18% { opacity: 1; transform: translate(-50%, 0) scale(1.06); }
      30% { transform: translate(-50%, 0) scale(1); }
      78% { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, -6px); }
    }
    @keyframes zoo-saluda {
      0%, 100% { transform: rotate(0deg); }
      20% { transform: rotate(-26deg); }
      40% { transform: rotate(10deg); }
      60% { transform: rotate(-20deg); }
      80% { transform: rotate(6deg); }
    }
    @keyframes zoo-aparece {
      from { opacity: 0; transform: translateY(18px) scale(0.85); }
      to { opacity: 1; transform: none; }
    }

    @media (min-width: 480px) {
      .zoo-esc { padding-left: 36px; padding-right: 36px; }
      .zoo-cd { gap: 14px; }
    }

    /* En tablet y desktop la selva aprovecha todo el ancho: los
       animales se van a los costados (más grandes) y el contador,
       la jirafa y el sol crecen con la pantalla. */
    @media (min-width: 768px) {
      .zoo-esc { padding-left: 48px; padding-right: 48px; }
      .zoo-cd { gap: 18px; }
      .zoo-cd-c { min-width: 100px; padding: 18px 10px 14px; }
      .zoo-cd-c small { font-size: 11px; }
      .zoo-jirafa { width: min(30vw, 320px); }
      .zoo-sol-svg { top: 28px; right: 3vw; width: 132px; height: 132px; }
      .zoo-globo-1 { top: 120px; left: 4vw; width: 56px; }
      .zoo-globo-2 { top: 70px; left: 16%; width: 44px; }
      .zoo-globo-3 { top: 190px; right: 4vw; width: 50px; }
      .zoo-cebra { top: 50%; left: 2.5vw; margin-top: -62px; }
      .zoo-cebra svg { width: 156px; height: auto; }
      .zoo-perico { top: 50%; right: 3vw; margin-top: -62px; }
      .zoo-perico svg { width: 96px; height: auto; }
      .zoo-leon svg { width: 130px; height: auto; }
      .zoo-elefante svg { width: 204px; height: auto; }
      .zoo-vaca svg { width: 142px; height: auto; }
      .zoo-mono svg { width: 96px; height: auto; }
      .zoo-huella { width: 24px; height: 24px; }
      .zoo-boton { font-size: 16.5px; padding: 14px 30px 15px; }
      .zoo-sinpe { max-width: 360px; }
      .zoo-pasto { height: 84px; }
    }

    /* Sin movimiento: nada se anima, la intro ni aparece, el cuello va
       completo y todo el contenido queda visible. */
    @media (prefers-reduced-motion: reduce) {
      #zoo-intro { display: none !important; }
      .zoo *, .zoo *::before, .zoo *::after {
        animation: none !important;
        transition: none !important;
      }
      .zoo-jirafa { --zoo-cuello: 1 !important; }
      .zoo-anima .zoo-esc .zoo-rev { opacity: 1; transform: none; }
      .zoo-anima .zoo-esc .zoo-peek-izq,
      .zoo-anima .zoo-esc .zoo-peek-der { transform: none; }
      .zoo-anima .zoo-esc .zoo-huella { opacity: 0.55; }
    }
  </style>

  <!-- ================= INTRO ================= -->
  <dialog id="zoo-intro" aria-label="Abrir la invitación">
    <div class="zoo-cortina zoo-cortina-izq" aria-hidden="true">
      <svg class="zoo-hoja-intro" style="top: 8%; left: 6%" viewBox="0 0 60 100"><path d="M30 2 C10 30 6 62 30 98 C54 62 50 30 30 2 Z M30 12 L30 88" fill="#2e9e4f" stroke="#14522a" stroke-width="3" /></svg>
      <svg class="zoo-hoja-intro" style="bottom: 10%; left: 22%; transform: rotate(24deg)" viewBox="0 0 60 100"><path d="M30 2 C10 30 6 62 30 98 C54 62 50 30 30 2 Z" fill="#2e9e4f" stroke="#14522a" stroke-width="3" /></svg>
    </div>
    <div class="zoo-cortina zoo-cortina-der" aria-hidden="true">
      <svg class="zoo-hoja-intro" style="top: 12%; right: 8%; transform: rotate(-20deg)" viewBox="0 0 60 100"><path d="M30 2 C10 30 6 62 30 98 C54 62 50 30 30 2 Z" fill="#2e9e4f" stroke="#14522a" stroke-width="3" /></svg>
      <svg class="zoo-hoja-intro" style="bottom: 6%; right: 18%; transform: rotate(14deg)" viewBox="0 0 60 100"><path d="M30 2 C10 30 6 62 30 98 C54 62 50 30 30 2 Z M30 12 L30 88" fill="#2e9e4f" stroke="#14522a" stroke-width="3" /></svg>
    </div>
    <div class="zoo-intro-nucleo" aria-hidden="true">
      <svg class="zoo-intro-sol" viewBox="0 0 120 120">
        <g class="zoo-sol-rayos" fill="#ffd23f" stroke="#f2a71b" stroke-width="2">
          <path d="M60 2 L66 22 L54 22 Z" /><path d="M60 118 L66 98 L54 98 Z" />
          <path d="M2 60 L22 54 L22 66 Z" /><path d="M118 60 L98 54 L98 66 Z" />
          <path d="M19 19 L36 30 L28 38 Z" /><path d="M101 19 L84 30 L92 38 Z" />
          <path d="M19 101 L36 90 L28 82 Z" /><path d="M101 101 L84 90 L92 82 Z" />
        </g>
        <circle cx="60" cy="60" r="34" fill="#ffd23f" stroke="#f2a71b" stroke-width="3" />
        <circle cx="49" cy="55" r="4" fill="#7a4a12" />
        <circle cx="71" cy="55" r="4" fill="#7a4a12" />
        <path d="M48 68 Q60 78 72 68" fill="none" stroke="#7a4a12" stroke-width="4" stroke-linecap="round" />
      </svg>
      <div class="zoo-intro-cartel">¡Estás invitado al safari!</div>
    </div>
    <p class="zoo-toca">Tocá para abrir la invitación</p>
  </dialog>

  <!-- ================= LA INVITACIÓN ================= -->
  <div class="zoo-lienzo">

    <!-- 1 · Portada: sol, globos y la jirafa que estira el cuello -->
    <section class="zoo-esc zoo-esc-hero" data-zoo-escena id="zoo-hero">
      <svg class="zoo-sol-svg" viewBox="0 0 120 120" aria-hidden="true">
        <g class="zoo-sol-rayos" fill="#ffd23f" stroke="#f2a71b" stroke-width="2">
          <path d="M60 2 L66 22 L54 22 Z" /><path d="M60 118 L66 98 L54 98 Z" />
          <path d="M2 60 L22 54 L22 66 Z" /><path d="M118 60 L98 54 L98 66 Z" />
          <path d="M19 19 L36 30 L28 38 Z" /><path d="M101 19 L84 30 L92 38 Z" />
          <path d="M19 101 L36 90 L28 82 Z" /><path d="M101 101 L84 90 L92 82 Z" />
        </g>
        <circle cx="60" cy="60" r="34" fill="#ffd23f" stroke="#f2a71b" stroke-width="3" />
        <circle cx="49" cy="55" r="4" fill="#7a4a12" />
        <circle cx="71" cy="55" r="4" fill="#7a4a12" />
        <path d="M48 68 Q60 78 72 68" fill="none" stroke="#7a4a12" stroke-width="4" stroke-linecap="round" />
      </svg>
      <svg class="zoo-globo zoo-globo-1" viewBox="0 0 44 74" aria-hidden="true">
        <ellipse cx="22" cy="22" rx="18" ry="21" fill="#e84b4b" stroke="#a32121" stroke-width="2.5" />
        <path d="M22 43 L18 49 L26 49 Z" fill="#a32121" />
        <path d="M22 49 C18 58 26 64 22 72" fill="none" stroke="#7a4a12" stroke-width="2" />
        <ellipse cx="15" cy="15" rx="5" ry="7" fill="#ffffff" opacity="0.4" />
      </svg>
      <svg class="zoo-globo zoo-globo-2" viewBox="0 0 44 74" aria-hidden="true">
        <ellipse cx="22" cy="22" rx="18" ry="21" fill="#2e9e4f" stroke="#14522a" stroke-width="2.5" />
        <path d="M22 43 L18 49 L26 49 Z" fill="#14522a" />
        <path d="M22 49 C18 58 26 64 22 72" fill="none" stroke="#7a4a12" stroke-width="2" />
        <ellipse cx="15" cy="15" rx="5" ry="7" fill="#ffffff" opacity="0.4" />
      </svg>
      <svg class="zoo-globo zoo-globo-3" viewBox="0 0 44 74" aria-hidden="true">
        <ellipse cx="22" cy="22" rx="18" ry="21" fill="#ff8a3d" stroke="#b35313" stroke-width="2.5" />
        <path d="M22 43 L18 49 L26 49 Z" fill="#b35313" />
        <path d="M22 49 C18 58 26 64 22 72" fill="none" stroke="#7a4a12" stroke-width="2" />
        <ellipse cx="15" cy="15" rx="5" ry="7" fill="#ffffff" opacity="0.4" />
      </svg>

      <div class="zoo-hero-contenido">
        <span class="zoo-cartel zoo-rev">¡Se abre el zoológico!</span>
        <h1 class="zoo-titulo zoo-rev" style="--zoo-d: 0.15s">
          <span class="zoo-t1">¡Valentina</span>
          <span class="zoo-t2">cumple <b class="zoo-edad">4</b>!</span>
        </h1>
        <p class="zoo-sub zoo-rev" style="--zoo-d: 0.3s">
          Los animales ya están listos para la fiesta…
          ¡solo faltás vos!
        </p>
      </div>

      <!-- La jirafa: su cuello crece conforme scrolleás el hero. -->
      <div class="zoo-jirafa zoo-rev" style="--zoo-d: 0.4s" id="zoo-jirafa" aria-hidden="true">
        <svg viewBox="0 0 220 340">
          <ellipse cx="110" cy="322" rx="78" ry="12" fill="#14522a" opacity="0.14" />
          <!-- Patas -->
          <rect x="72" y="252" width="15" height="70" rx="7" fill="#dd9c3f" stroke="#6b430f" stroke-width="4" />
          <rect x="134" y="252" width="15" height="70" rx="7" fill="#dd9c3f" stroke="#6b430f" stroke-width="4" />
          <rect x="88" y="258" width="16" height="66" rx="7" fill="#f2b559" stroke="#6b430f" stroke-width="4" />
          <rect x="118" y="258" width="16" height="66" rx="7" fill="#f2b559" stroke="#6b430f" stroke-width="4" />
          <!-- Cola -->
          <path d="M160 232 C178 236 186 248 184 262" fill="none" stroke="#6b430f" stroke-width="5" stroke-linecap="round" />
          <circle cx="184" cy="265" r="6" fill="#6b430f" />
          <!-- Cuerpo -->
          <ellipse cx="110" cy="240" rx="53" ry="42" fill="#f2b559" stroke="#6b430f" stroke-width="5" />
          <circle cx="88" cy="230" r="9" fill="#c9822e" />
          <circle cx="122" cy="252" r="11" fill="#c9822e" />
          <circle cx="132" cy="222" r="7" fill="#c9822e" />
          <!-- Cuello (escala con --zoo-cuello, origen abajo) -->
          <g class="zoo-jir-cuello">
            <rect x="94" y="92" width="32" height="152" rx="15" fill="#f2b559" stroke="#6b430f" stroke-width="5" />
            <circle cx="105" cy="130" r="6" fill="#c9822e" />
            <circle cx="116" cy="168" r="7" fill="#c9822e" />
            <circle cx="104" cy="205" r="6" fill="#c9822e" />
          </g>
          <!-- Cabeza (baja cuando el cuello está recogido) -->
          <g class="zoo-jir-cabeza">
            <path d="M98 50 L92 34" stroke="#6b430f" stroke-width="4" stroke-linecap="round" />
            <path d="M122 50 L128 34" stroke="#6b430f" stroke-width="4" stroke-linecap="round" />
            <circle cx="92" cy="31" r="6" fill="#c9822e" stroke="#6b430f" stroke-width="3" />
            <circle cx="128" cy="31" r="6" fill="#c9822e" stroke="#6b430f" stroke-width="3" />
            <ellipse cx="80" cy="62" rx="11" ry="7" fill="#f2b559" stroke="#6b430f" stroke-width="4" transform="rotate(-24 80 62)" />
            <ellipse cx="140" cy="62" rx="11" ry="7" fill="#f2b559" stroke="#6b430f" stroke-width="4" transform="rotate(24 140 62)" />
            <ellipse cx="110" cy="66" rx="27" ry="23" fill="#f2b559" stroke="#6b430f" stroke-width="5" />
            <ellipse cx="110" cy="77" rx="17" ry="11" fill="#f7d9a8" />
            <circle cx="104" cy="79" r="2.2" fill="#6b430f" />
            <circle cx="116" cy="79" r="2.2" fill="#6b430f" />
            <path d="M103 86 Q110 91 117 86" fill="none" stroke="#6b430f" stroke-width="3" stroke-linecap="round" />
            <circle cx="99" cy="58" r="5.5" fill="#ffffff" stroke="#6b430f" stroke-width="2.5" />
            <circle cx="121" cy="58" r="5.5" fill="#ffffff" stroke="#6b430f" stroke-width="2.5" />
            <circle cx="100" cy="59" r="2.4" fill="#3a2d1a" />
            <circle cx="122" cy="59" r="2.4" fill="#3a2d1a" />
          </g>
        </svg>
      </div>
      <p class="zoo-hero-baja zoo-rev" style="--zoo-d: 0.55s">Seguí las huellitas<b aria-hidden="true">▼</b></p>
    </section>

    <!-- El monito que se columpia entre escenas -->
    <div class="zoo-liana">
      <div class="zoo-liana-col">
        <svg class="zoo-vid" viewBox="0 0 26 48" aria-hidden="true">
          <path d="M13 0 C9 12 17 22 13 34 C11 40 13 44 13 48" fill="none" stroke="#2e9e4f" stroke-width="5" stroke-linecap="round" />
          <path d="M13 14 C7 12 4 8 3 4 C9 5 12 9 13 14 Z" fill="#2e9e4f" stroke="#14522a" stroke-width="2" />
        </svg>
        <button type="button" class="zoo-animal zoo-mono" aria-label="Monito columpiándose (tocalo y hace ¡Ii-ii!)"
          onclick="this.classList.remove('zoo-toc');void this.offsetWidth;this.classList.add('zoo-toc')">
          <span class="zoo-grito" aria-hidden="true">¡Ii-ii-ii!</span>
          <svg width="82" height="86" viewBox="0 0 120 126" aria-hidden="true">
            <!-- Brazo agarrado a la liana -->
            <path d="M60 6 C52 16 50 26 54 38" fill="none" stroke="#8a5a33" stroke-width="9" stroke-linecap="round" />
            <!-- Cola -->
            <path d="M76 96 C96 100 104 88 98 76 C94 68 84 70 84 78" fill="none" stroke="#8a5a33" stroke-width="7" stroke-linecap="round" />
            <!-- Cuerpo -->
            <ellipse cx="60" cy="82" rx="24" ry="26" fill="#8a5a33" stroke="#5c3a1e" stroke-width="4" />
            <ellipse cx="60" cy="88" rx="13" ry="15" fill="#d9a86c" />
            <!-- Piernas -->
            <path d="M44 100 C38 110 40 118 46 122" fill="none" stroke="#8a5a33" stroke-width="8" stroke-linecap="round" />
            <path d="M76 100 C82 110 80 118 74 122" fill="none" stroke="#8a5a33" stroke-width="8" stroke-linecap="round" />
            <!-- Orejas y cabeza -->
            <circle cx="38" cy="44" r="9" fill="#d9a86c" stroke="#5c3a1e" stroke-width="3.5" />
            <circle cx="82" cy="44" r="9" fill="#d9a86c" stroke="#5c3a1e" stroke-width="3.5" />
            <circle cx="60" cy="46" r="20" fill="#8a5a33" stroke="#5c3a1e" stroke-width="4" />
            <path d="M46 44 A9 9 0 0 1 60 38 A9 9 0 0 1 74 44 A14 12 0 0 1 60 60 A14 12 0 0 1 46 44 Z" fill="#d9a86c" />
            <circle cx="53" cy="44" r="2.6" fill="#3a2d1a" />
            <circle cx="67" cy="44" r="2.6" fill="#3a2d1a" />
            <path d="M54 53 Q60 58 66 53" fill="none" stroke="#3a2d1a" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 2 · Código de vestimenta -->
    <section class="zoo-esc" data-zoo-escena>
      <div class="zoo-huellas" aria-hidden="true">
        <span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span>
      </div>
      <span class="zoo-cartel zoo-rev">Código de vestimenta</span>
      <h2 class="zoo-titulo-seccion zoo-rev" style="--zoo-d: 0.15s">Venite estilo safari 🧢</h2>
      <div class="zoo-rev" style="--zoo-d: 0.3s; margin-top: 22px; line-height: 0">
        <svg width="130" height="86" viewBox="0 0 160 106" aria-hidden="true">
          <!-- Sombrero de explorador -->
          <ellipse cx="80" cy="78" rx="72" ry="18" fill="#c9a35c" stroke="#7a4a12" stroke-width="5" />
          <path d="M34 74 C34 40 52 18 80 18 C108 18 126 40 126 74 Q80 88 34 74 Z" fill="#e0b76b" stroke="#7a4a12" stroke-width="5" />
          <path d="M36 62 Q80 74 124 62" fill="none" stroke="#7a4a12" stroke-width="5" />
          <path d="M36 62 Q80 74 124 62 L124 70 Q80 82 36 70 Z" fill="#a86b32" />
        </svg>
      </div>
      <p class="zoo-nota zoo-rev" style="--zoo-d: 0.45s">
        Ropita cómoda, tenis y gorra o sombrero de explorador:
        ¡vamos a recorrer la selva entera!
      </p>
    </section>

    <!-- 3 · Información principal: fecha y hora en grande -->
    <section class="zoo-esc" data-zoo-escena>
      <!-- La cebra asoma desde el borde al armarse la escena. -->
      <div class="zoo-peek zoo-peek-izq zoo-cebra">
        <button type="button" class="zoo-animal" aria-label="Cebra curiosa (tocala y hace ¡Hiii!)"
          onclick="this.classList.remove('zoo-toc');void this.offsetWidth;this.classList.add('zoo-toc')">
          <span class="zoo-grito" aria-hidden="true">¡Hiii-hiii!</span>
          <svg width="92" height="74" viewBox="0 0 150 120" aria-hidden="true">
            <path d="M28 34 L20 8 L44 22" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="4" stroke-linejoin="round" />
            <path d="M74 30 L86 6 L96 30" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="4" stroke-linejoin="round" />
            <path d="M40 24 C34 30 30 40 32 52 L120 96 C132 88 134 72 126 60 C112 38 82 20 56 20 C50 20 44 21 40 24 Z" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="4" />
            <path d="M52 22 C56 32 54 42 48 50 M72 26 C76 36 74 48 68 56 M92 36 C96 46 94 58 88 66 M110 50 C114 58 113 68 108 76" fill="none" stroke="#2b2b2b" stroke-width="7" stroke-linecap="round" />
            <ellipse cx="118" cy="86" rx="22" ry="16" fill="#6d6d6d" stroke="#2b2b2b" stroke-width="4" transform="rotate(26 118 86)" />
            <circle cx="112" cy="80" r="2.6" fill="#1c1c1c" />
            <circle cx="124" cy="88" r="2.6" fill="#1c1c1c" />
            <circle cx="60" cy="38" r="6" fill="#ffffff" stroke="#2b2b2b" stroke-width="3" />
            <circle cx="61" cy="39" r="2.4" fill="#1c1c1c" />
          </svg>
        </button>
      </div>
      <div class="zoo-huellas" aria-hidden="true">
        <span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span>
      </div>
      <span class="zoo-cartel zoo-rev">La expedición sale el…</span>
      <p class="zoo-fecha-grande zoo-rev" style="--zoo-d: 0.15s">sábado 10 de octubre, 2026</p>
      <p class="zoo-hora-grande zoo-rev" style="--zoo-d: 0.3s">a las 10:00 a. m.</p>
      <p class="zoo-nota zoo-rev" style="--zoo-d: 0.45s">
        Habrá queque, juegos y muchas sorpresas salvajes.
      </p>
    </section>

    <!-- 4 · Cuenta regresiva -->
    <section class="zoo-esc" data-zoo-escena>
      <div class="zoo-huellas" aria-hidden="true">
        <span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span>
      </div>
      <span class="zoo-cartel zoo-rev">Cuenta regresiva</span>
      <h2 class="zoo-titulo-seccion zoo-rev" style="--zoo-d: 0.15s">¿Cuánto falta para el safari?</h2>
      <div class="zoo-cd zoo-rev" id="zoo-cd" data-fecha="2026-10-10T10:00:00-06:00" role="timer" aria-label="Tiempo restante para la fiesta" style="--zoo-d: 0.3s">
        <div class="zoo-cd-c"><span id="zoo-cd-d">–</span><small>días</small></div>
        <div class="zoo-cd-c"><span id="zoo-cd-h">–</span><small>horas</small></div>
        <div class="zoo-cd-c"><span id="zoo-cd-m">–</span><small>min</small></div>
        <div class="zoo-cd-c"><span id="zoo-cd-s">–</span><small>seg</small></div>
      </div>
      <p class="zoo-cd-hoy" id="zoo-cd-hoy" hidden>¡El safari es HOY! 🎉</p>
      <div class="zoo-leon zoo-rev" style="--zoo-d: 0.45s">
        <button type="button" class="zoo-animal" aria-label="León amistoso (tocalo y ruge)"
          onclick="this.classList.remove('zoo-toc');void this.offsetWidth;this.classList.add('zoo-toc')">
          <span class="zoo-grito" aria-hidden="true">¡Rooar!</span>
          <svg width="96" height="96" viewBox="0 0 130 130" aria-hidden="true">
            <g fill="#f28c28" stroke="#b35313" stroke-width="3">
              <path d="M65 3 L74 20 L56 20 Z" /><path d="M65 127 L74 110 L56 110 Z" />
              <path d="M3 65 L20 56 L20 74 Z" /><path d="M127 65 L110 56 L110 74 Z" />
              <path d="M21 21 L38 28 L28 38 Z" /><path d="M109 21 L92 28 L102 38 Z" />
              <path d="M21 109 L38 102 L28 92 Z" /><path d="M109 109 L92 102 L102 92 Z" />
            </g>
            <circle cx="65" cy="65" r="44" fill="#f28c28" stroke="#b35313" stroke-width="4" />
            <circle cx="65" cy="67" r="33" fill="#ffc457" stroke="#b35313" stroke-width="3.5" />
            <circle cx="44" cy="46" r="8" fill="#ffc457" stroke="#b35313" stroke-width="3" />
            <circle cx="86" cy="46" r="8" fill="#ffc457" stroke="#b35313" stroke-width="3" />
            <circle cx="53" cy="62" r="4" fill="#3a2d1a" />
            <circle cx="77" cy="62" r="4" fill="#3a2d1a" />
            <ellipse cx="65" cy="78" rx="13" ry="10" fill="#ffffff" />
            <path d="M60 74 L70 74 L65 80 Z" fill="#7a4a12" />
            <path d="M65 80 L65 85 M65 85 Q58 90 53 86 M65 85 Q72 90 77 86" fill="none" stroke="#7a4a12" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </section>

    <!-- 5 · El lugar (el elefante saluda con la trompa al entrar) -->
    <section class="zoo-esc" data-zoo-escena id="zoo-lugar">
      <div class="zoo-huellas" aria-hidden="true">
        <span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span>
      </div>
      <span class="zoo-cartel zoo-rev">El lugar</span>
      <h2 class="zoo-lugar-nombre zoo-rev" style="--zoo-d: 0.15s">Salón La Selva</h2>
      <p class="zoo-lugar-dir zoo-rev" style="--zoo-d: 0.3s">San Francisco de Heredia</p>
      <div class="zoo-botones zoo-rev" style="--zoo-d: 0.45s">
        <a class="zoo-boton" href="https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20La%20Selva%2C%20San%20Francisco%2C%20Heredia%2C%20Costa%20Rica" target="_blank" rel="noopener noreferrer">Google Maps</a>
        <a class="zoo-boton zoo-boton-verde" href="https://waze.com/ul?q=Sal%C3%B3n%20La%20Selva%2C%20San%20Francisco%2C%20Heredia" target="_blank" rel="noopener noreferrer">Waze</a>
      </div>
      <div class="zoo-elefante zoo-rev" style="--zoo-d: 0.55s">
        <button type="button" class="zoo-animal" aria-label="Elefante saludando (tocalo y barrita)"
          onclick="this.classList.remove('zoo-toc');void this.offsetWidth;this.classList.add('zoo-toc')">
          <span class="zoo-grito" aria-hidden="true">¡Prrrr!</span>
          <svg width="150" height="112" viewBox="0 0 200 150" aria-hidden="true">
            <ellipse cx="100" cy="141" rx="72" ry="8" fill="#14522a" opacity="0.12" />
            <!-- Patas -->
            <rect x="48" y="106" width="22" height="36" rx="10" fill="#9fb4c8" stroke="#4f6377" stroke-width="4" />
            <rect x="92" y="106" width="22" height="36" rx="10" fill="#9fb4c8" stroke="#4f6377" stroke-width="4" />
            <!-- Cuerpo -->
            <ellipse cx="82" cy="82" rx="58" ry="46" fill="#9fb4c8" stroke="#4f6377" stroke-width="4.5" />
            <!-- Cabeza -->
            <circle cx="142" cy="62" r="36" fill="#9fb4c8" stroke="#4f6377" stroke-width="4.5" />
            <!-- Oreja -->
            <ellipse cx="122" cy="62" rx="21" ry="28" fill="#8ca2b8" stroke="#4f6377" stroke-width="4" />
            <ellipse cx="124" cy="62" rx="12" ry="18" fill="#b9c9d8" />
            <!-- Ojo -->
            <circle cx="154" cy="52" r="6.5" fill="#ffffff" stroke="#4f6377" stroke-width="3" />
            <circle cx="155" cy="53" r="2.8" fill="#20303f" />
            <!-- Colmillo -->
            <path d="M150 90 C154 96 160 98 166 96" fill="none" stroke="#f5f1ea" stroke-width="6" stroke-linecap="round" />
            <!-- La trompa que saluda -->
            <g class="zoo-ele-trompa">
              <path d="M164 74 C186 82 194 102 188 122 C185 132 176 136 169 132" fill="none" stroke="#4f6377" stroke-width="17" stroke-linecap="round" />
              <path d="M164 74 C186 82 194 102 188 122 C185 132 176 136 169 132" fill="none" stroke="#9fb4c8" stroke-width="11" stroke-linecap="round" />
            </g>
          </svg>
        </button>
      </div>
    </section>

    <!-- 6 · Llamado al RSVP (el formulario lo agrega la página, abajo) -->
    <section class="zoo-esc" data-zoo-escena>
      <!-- El perico asoma para recordarte confirmar. -->
      <div class="zoo-peek zoo-peek-der zoo-perico">
        <button type="button" class="zoo-animal" aria-label="Perico mensajero (tocalo y grita)"
          onclick="this.classList.remove('zoo-toc');void this.offsetWidth;this.classList.add('zoo-toc')">
          <span class="zoo-grito" aria-hidden="true">¡Cua-cuá!</span>
          <svg width="66" height="86" viewBox="0 0 100 130" aria-hidden="true">
            <path d="M50 118 L42 128 M58 118 L62 128" stroke="#7a4a12" stroke-width="4" stroke-linecap="round" />
            <path d="M50 14 C28 14 18 34 20 58 C22 84 34 104 50 118 C66 104 78 84 80 58 C82 34 72 14 50 14 Z" fill="#e84b4b" stroke="#a32121" stroke-width="4" />
            <path d="M50 62 C40 74 40 92 50 106 C60 92 60 74 50 62 Z" fill="#ffd23f" stroke="#b35313" stroke-width="3" />
            <path d="M28 52 C20 62 20 80 30 92 C40 84 42 66 36 54 Z" fill="#2e9e4f" stroke="#14522a" stroke-width="3.5" />
            <circle cx="58" cy="38" r="10" fill="#ffffff" stroke="#a32121" stroke-width="3" />
            <circle cx="60" cy="39" r="3.6" fill="#1c1c1c" />
            <path d="M70 44 C82 44 86 52 82 58 C78 63 70 62 66 56 Z" fill="#f2a71b" stroke="#b35313" stroke-width="3" />
          </svg>
        </button>
      </div>
      <div class="zoo-huellas" aria-hidden="true">
        <span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span>
      </div>
      <span class="zoo-cartel zoo-rev">¿Venís al safari?</span>
      <div class="zoo-rev" style="--zoo-d: 0.15s">
        <span class="zoo-confirma">Confirmá tu asistencia<span class="zoo-flecha" aria-hidden="true">▼</span></span>
      </div>
      <p class="zoo-nota zoo-rev" style="--zoo-d: 0.3s">
        Decinos si venís en el formulario aquí abajito —
        toma menos de un minuto.
      </p>
    </section>

    <!-- 7 · Muestras de cariño -->
    <section class="zoo-esc" data-zoo-escena style="min-height: 0">
      <div class="zoo-huellas" aria-hidden="true">
        <span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span><span class="zoo-huella"></span>
      </div>
      <span class="zoo-cartel zoo-rev">Muestras de cariño</span>
      <p class="zoo-nota zoo-rev" style="--zoo-d: 0.15s; font-size: 15px">
        Tu compañía es el mejor regalo para Valentina.
        Si además querés traerle un detallito, acá van ideas:
      </p>
      <div class="zoo-botones zoo-rev" style="--zoo-d: 0.3s">
        <a class="zoo-boton" href="https://bookea.lat" target="_blank" rel="noopener noreferrer">Lista de juguetes</a>
        <a class="zoo-boton zoo-boton-verde" href="https://bookea.lat" target="_blank" rel="noopener noreferrer">Más ideas</a>
      </div>
      <div class="zoo-sinpe zoo-rev" style="--zoo-d: 0.45s">
        <p class="zoo-sinpe-tag">SINPE Móvil</p>
        <p class="zoo-sinpe-num">8888-8888</p>
      </div>
      <div class="zoo-vaca zoo-rev" style="--zoo-d: 0.55s">
        <button type="button" class="zoo-animal" aria-label="Vaquita de la granjita (tocala y muge)"
          onclick="this.classList.remove('zoo-toc');void this.offsetWidth;this.classList.add('zoo-toc')">
          <span class="zoo-grito" aria-hidden="true">¡Muu!</span>
          <svg width="104" height="84" viewBox="0 0 150 122" aria-hidden="true">
            <path d="M34 26 C22 20 16 24 14 34 C22 38 30 36 36 30 Z" fill="#e8d3ae" stroke="#7a5a30" stroke-width="3.5" />
            <path d="M116 26 C128 20 134 24 136 34 C128 38 120 36 114 30 Z" fill="#e8d3ae" stroke="#7a5a30" stroke-width="3.5" />
            <ellipse cx="30" cy="52" rx="14" ry="9" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="3.5" transform="rotate(-18 30 52)" />
            <ellipse cx="120" cy="52" rx="14" ry="9" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="3.5" transform="rotate(18 120 52)" />
            <ellipse cx="75" cy="62" rx="46" ry="40" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="4" />
            <path d="M48 34 C42 44 44 54 52 58 C60 54 60 42 56 34 Z" fill="#2b2b2b" />
            <path d="M104 76 C112 74 116 66 112 58 C104 60 100 68 100 76 Z" fill="#2b2b2b" />
            <circle cx="60" cy="54" r="4.4" fill="#1c1c1c" />
            <circle cx="90" cy="54" r="4.4" fill="#1c1c1c" />
            <ellipse cx="75" cy="82" rx="26" ry="16" fill="#f4b8c1" stroke="#c26879" stroke-width="3.5" />
            <ellipse cx="66" cy="82" rx="4" ry="5.5" fill="#a94a5c" />
            <ellipse cx="84" cy="82" rx="4" ry="5.5" fill="#a94a5c" />
          </svg>
        </button>
      </div>
    </section>

    <!-- El pasto del cierre -->
    <svg class="zoo-pasto" viewBox="0 0 390 56" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 56 L0 30 Q10 12 18 30 Q24 8 32 28 Q40 14 46 30 Q56 6 64 28 Q72 16 78 30 Q88 10 96 28 Q104 14 110 30 Q120 6 128 28 Q136 16 142 30 Q152 10 160 28 Q168 14 174 30 Q184 6 192 28 Q200 16 206 30 Q216 10 224 28 Q232 14 238 30 Q248 6 256 28 Q264 16 270 30 Q280 10 288 28 Q296 14 302 30 Q312 6 320 28 Q328 16 334 30 Q344 10 352 28 Q360 14 366 30 Q376 8 382 28 Q386 18 390 28 L390 56 Z" fill="#2e9e4f" />
      <path d="M0 56 L0 40 Q14 26 24 40 Q34 22 44 40 Q54 26 64 40 Q74 22 84 40 Q94 26 104 40 Q114 22 124 40 Q134 26 144 40 Q154 22 164 40 Q174 26 184 40 Q194 22 204 40 Q214 26 224 40 Q234 22 244 40 Q254 26 264 40 Q274 22 284 40 Q294 26 304 40 Q314 22 324 40 Q334 26 344 40 Q354 22 364 40 Q374 26 384 40 L390 40 L390 56 Z" fill="#14522a" />
    </svg>
  </div>
</div>

<script>
  /* ============ Intro: <dialog> con cortinas de selva ============ */
  (function () {
    var dlg = document.getElementById("zoo-intro");
    if (!dlg || typeof dlg.showModal !== "function") { if (dlg) dlg.remove(); return; }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dlg.remove();
      return;
    }
    var abierta = false;
    var timer = null;
    function abrir() {
      if (abierta) return;
      abierta = true;
      if (timer) window.clearTimeout(timer);
      dlg.classList.add("zoo-intro-abierta");
      window.setTimeout(function () {
        try { dlg.close(); } catch (e) { /* ya cerrado */ }
        dlg.remove();
      }, 950);
    }
    try { dlg.showModal(); } catch (e) { dlg.remove(); return; }
    dlg.addEventListener("click", abrir);
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); abrir(); });
    timer = window.setTimeout(abrir, 3000);
  })();

  /* ============ Escenas: se revelan una por una al scrollear ========= */
  (function () {
    var raiz = document.querySelector(".zoo");
    if (!raiz) return;
    var escenas = raiz.querySelectorAll("[data-zoo-escena]");
    var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducido || !("IntersectionObserver" in window)) {
      for (var i = 0; i < escenas.length; i++) escenas[i].classList.add("zoo-vista");
      return;
    }
    raiz.classList.add("zoo-anima");
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (ent) {
        if (ent.isIntersecting) {
          ent.target.classList.add("zoo-vista");
          io.unobserve(ent.target);
        }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    escenas.forEach(function (esc) { io.observe(esc); });
  })();

  /* ============ La jirafa: el cuello crece con el scroll ============ */
  (function () {
    var jirafa = document.getElementById("zoo-jirafa");
    var hero = document.getElementById("zoo-hero");
    if (!jirafa || !hero) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var topInicial = null;
    var pedida = false;
    function medir() {
      pedida = false;
      var r = hero.getBoundingClientRect();
      if (topInicial === null) topInicial = r.top;
      // 0 = sin scrollear; 1 = tras ~320px de scroll del hero.
      var avance = Math.min(1, Math.max(0, (topInicial - r.top) / 320));
      jirafa.style.setProperty("--zoo-cuello", (0.45 + 0.55 * avance).toFixed(3));
    }
    function alScroll() {
      if (pedida) return;
      pedida = true;
      window.requestAnimationFrame(medir);
    }
    medir();
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alScroll);
  })();

  /* ============ Cuenta regresiva viva ============ */
  (function () {
    var caja = document.getElementById("zoo-cd");
    if (!caja) return;
    var objetivo = new Date(caja.getAttribute("data-fecha") || "").getTime();
    if (isNaN(objetivo)) return;
    var d = document.getElementById("zoo-cd-d");
    var h = document.getElementById("zoo-cd-h");
    var m = document.getElementById("zoo-cd-m");
    var s = document.getElementById("zoo-cd-s");
    var hoy = document.getElementById("zoo-cd-hoy");
    var timer = null;
    function dosDigitos(n) { return n < 10 ? "0" + n : "" + n; }
    function tic() {
      var resto = objetivo - Date.now();
      if (resto <= 0) {
        caja.hidden = true;
        if (hoy) hoy.hidden = false;
        if (timer) window.clearInterval(timer);
        return;
      }
      var seg = Math.floor(resto / 1000);
      if (d) d.textContent = "" + Math.floor(seg / 86400);
      if (h) h.textContent = dosDigitos(Math.floor((seg % 86400) / 3600));
      if (m) m.textContent = dosDigitos(Math.floor((seg % 3600) / 60));
      if (s) s.textContent = dosDigitos(seg % 60);
    }
    tic();
    timer = window.setInterval(tic, 1000);
  })();
</script>
$inv_zoo$
)
on conflict (slug) do update set
  tema = excluded.tema,
  titulo = excluded.titulo,
  anfitriones = excluded.anfitriones,
  mensaje = excluded.mensaje,
  fecha_evento = excluded.fecha_evento,
  hora = excluded.hora,
  lugar_nombre = excluded.lugar_nombre,
  direccion = excluded.direccion,
  estado = 'activa',
  html_personalizado = excluded.html_personalizado;

