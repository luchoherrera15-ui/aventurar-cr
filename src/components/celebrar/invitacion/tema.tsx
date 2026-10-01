import type { Tema } from "@/lib/celebrar/invitacion/esquema";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LOS TEMAS — escenografía de portada y personaje que cruza
 * ══════════════════════════════════════════════════════════════════
 *
 * Lo que convierte una invitación «con colores de magia» en una
 * invitación DE magia: la portada tiene un escenario dibujado (el
 * castillo con las ventanas encendidas, la pista con su meta, el castillo
 * de cuento con su arcoíris) y, al pasar de una sección a otra, un
 * personaje la cruza (la lechuza con la carta, el auto de carreras, la
 * estrella fugaz del hada).
 *
 * Todo es SVG inline y CSS (transform/opacity), sin JS: el cruce se
 * dispara con el `data-vista` que la escena ya pone al entrar. Los
 * colores entran por variables (`--tema-*`) que calcula el renderizador
 * con la paleta, así el mismo dibujo sirve para cualquier combinación.
 * Siluetas genéricas: el tema, nunca la marca de una saga o película.
 */

export default function Escenografia({ tema }: { tema: Exclude<Tema, "ninguno"> }) {
  if (tema === "magia") return <EscenografiaMagia />;
  if (tema === "carreras") return <EscenografiaCarreras />;
  if (tema === "conejos") return <EscenografiaConejos />;
  return <EscenografiaCuento />;
}

/* ── Colegio de magia ──────────────────────────────────────────── */

/** Las ventanas encendidas del castillo: [x, y, ancho, alto]. */
const VENTANAS: readonly (readonly [number, number, number, number])[] = [
  [606, 248, 8, 14], [646, 262, 8, 14], [700, 200, 9, 16], [700, 236, 9, 16], [736, 214, 9, 16],
  [778, 250, 8, 14], [822, 238, 8, 14], [852, 276, 8, 12], [566, 292, 7, 11], [880, 300, 7, 11],
  [720, 150, 7, 12], [668, 300, 8, 12], [760, 300, 8, 12], [616, 318, 7, 10], [806, 318, 7, 10],
];

function EscenografiaMagia() {
  return (
    <div className="inv-tema-escena inv-tema-magia" aria-hidden="true">
      <div className="inv-tema-luna" />
      <svg className="inv-tema-silueta" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
        {/* Montañas lejanas, más claras */}
        <path className="inv-tema-lejos" d="M0 330L120 280L230 318L360 250L470 300L560 262L640 300L800 290L900 250L1020 300L1140 256L1260 306L1360 270L1440 300V420H0Z" />
        {/* El castillo sobre la colina */}
        <g className="inv-tema-cerca">
          <path d="M0 380Q240 350 460 352Q600 330 720 334Q860 330 980 352Q1200 350 1440 376V420H0Z" />
          {/* muralla */}
          <path d="M540 340V296h14v-8h10v8h14v-8h10v8h14v-8h10v8h14V340Z" />
          <path d="M830 340V300h14v-8h10v8h14v-8h10v8h14v-8h10v8h14V340Z" />
          {/* torres */}
          <path d="M556 300V244h24v56Z" />
          <path d="M552 246L568 196L584 246Z" />
          <path d="M594 330V232h34v98Z" />
          <path d="M588 234L611 168L634 234Z" />
          <path d="M636 330V250h28v80Z" />
          <path d="M632 252L650 206L668 252Z" />
          <path d="M684 336V186h46v150Z" />
          <path d="M678 188L707 96L736 188Z" />
          <path d="M706 170V126h22v44Z" />
          <path d="M702 128L717 70L732 128Z" />
          <path d="M730 336V200h36v136Z" />
          <path d="M724 202L748 140L772 202Z" />
          <path d="M766 336V238h30v98Z" />
          <path d="M762 240L781 190L800 240Z" />
          <path d="M808 330V226h32v104Z" />
          <path d="M802 228L824 164L846 228Z" />
          <path d="M846 320V262h24v58Z" />
          <path d="M842 264L858 222L874 264Z" />
          {/* puente al costado */}
          <path d="M880 330h120v8H880ZM896 338v14M928 338v12M960 338v12M992 338v14" strokeWidth="3" />
          {/* banderines en las puntas */}
          <path d="M717 70V56l12 5-12 5" />
          <path d="M611 168V156l10 4-10 4" />
          <path d="M824 164V152l10 4-10 4" />
        </g>
        <g className="inv-tema-ventanas">
          {VENTANAS.map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx={w / 2} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </g>
      </svg>
      <div className="inv-tema-vuela">
        <Lechuza />
      </div>
    </div>
  );
}

/** La lechuza de perfil, volando hacia la derecha, con la carta en las patas. */
function Lechuza({ carta = false }: { carta?: boolean }) {
  return (
    <svg className="inv-lechuza" viewBox="0 0 120 90">
      <g className="inv-lechuza-ala-atras">
        <path d="M52 40Q40 8 12 4Q30 22 30 34Q40 42 52 44Z" />
      </g>
      <ellipse cx="60" cy="48" rx="24" ry="17" className="inv-lechuza-cuerpo" />
      <path d="M40 52Q28 58 20 56Q30 50 38 46Z" className="inv-lechuza-cuerpo" />
      <circle cx="82" cy="38" r="15" className="inv-lechuza-cuerpo" />
      <path d="M72 26L70 16L78 24ZM90 25L96 16L94 28Z" className="inv-lechuza-cuerpo" />
      <circle cx="78" cy="37" r="5.5" className="inv-lechuza-ojo" />
      <circle cx="90" cy="37" r="5.5" className="inv-lechuza-ojo" />
      <circle cx="79" cy="37" r="2.4" className="inv-lechuza-pupila" />
      <circle cx="91" cy="37" r="2.4" className="inv-lechuza-pupila" />
      <path d="M84 42L88 48L81 45Z" className="inv-lechuza-pico" />
      <path d="M52 56Q60 60 70 56M50 50Q60 54 72 50" className="inv-lechuza-pluma" />
      <g className="inv-lechuza-ala">
        <path d="M54 42Q44 76 16 84Q34 66 34 52Q44 46 54 44Z" />
      </g>
      {carta && (
        <g className="inv-lechuza-carta">
          <path d="M62 62l-4 10M70 62l2 10" className="inv-lechuza-pluma" />
          <rect x="50" y="70" width="30" height="19" rx="2" />
          <path d="M50 70l15 10 15-10" fill="none" />
          <circle cx="65" cy="80" r="3.4" className="inv-lechuza-lacre" />
        </g>
      )}
    </svg>
  );
}

/* ── Gran premio ───────────────────────────────────────────────── */

/** La cuerda de la guirnalda: dos comberas de 720 px. */
const caida = (x: number) => Math.round((6 + 30 * Math.sin((Math.PI * (x % 720)) / 720)) * 10) / 10;
const CUERDA = "M" + Array.from({ length: 49 }, (_, i) => `${i * 30} ${caida(i * 30 === 1440 ? 1439.9 : i * 30)}`).join("L");

function EscenografiaCarreras() {
  return (
    <div className="inv-tema-escena inv-tema-carreras" aria-hidden="true">
      {/* La guirnalda de banderines a lo ancho, arriba */}
      <svg className="inv-tema-guirnalda" viewBox="0 0 1440 70" preserveAspectRatio="none">
        <path d={CUERDA} fill="none" className="inv-tema-cuerda" />
        {Array.from({ length: 24 }, (_, i) => {
          const x = 30 + i * 60;
          const y = caida(x);
          return <path key={i} d={`M${x - 16} ${y}L${x + 16} ${y}L${x} ${y + 30}Z`} className={i % 2 ? "inv-tema-pena-b" : "inv-tema-pena-a"} style={{ "--i": i } as React.CSSProperties} />;
        })}
      </svg>
      <svg className="inv-tema-silueta" viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice">
        {/* Graderías con público (puntitos) al fondo */}
        <path className="inv-tema-lejos" d="M0 150L0 110L360 96L720 104L1080 94L1440 108V150Z" />
        {Array.from({ length: 60 }, (_, i) => (
          <circle key={i} cx={12 + i * 24} cy={112 + ((i * 7) % 5) * 5} r="4" className="inv-tema-publico" style={{ "--i": i } as React.CSSProperties} />
        ))}
        {/* Pianito (bordillo) a franjas: el acento y blanco */}
        <defs>
          <pattern id="inv-pianito" width="48" height="14" patternUnits="userSpaceOnUse">
            <rect width="24" height="14" className="inv-tema-pianito-a" />
            <rect x="24" width="24" height="14" fill="#ffffff" />
          </pattern>
        </defs>
        <rect x="0" y="150" width="1440" height="14" fill="url(#inv-pianito)" />
        {/* El asfalto */}
        <rect x="0" y="164" width="1440" height="136" className="inv-tema-asfalto" />
        <path d="M0 232H1440" className="inv-tema-linea" />
        {/* La meta a cuadros */}
        <g className="inv-tema-meta">
          {Array.from({ length: 17 }, (_, f) =>
            [0, 1].map((c) => ((f + c) % 2 === 0 ? <rect key={`${f}-${c}`} x={1040 + c * 8} y={164 + f * 8} width="8" height="8" /> : null)),
          )}
        </g>
      </svg>
      <div className="inv-tema-corre">
        <AutoCarrera />
      </div>
    </div>
  );
}

/** Un fórmula de perfil mirando a la derecha, con número y estela de velocidad. */
function AutoCarrera() {
  return (
    <svg className="inv-auto" viewBox="0 0 200 70">
      <g className="inv-auto-estela">
        <path d="M0 30H40M8 40H52M16 50H44" />
      </g>
      <path className="inv-auto-cuerpo" d="M48 50L50 40L70 36L96 24L122 24L132 34L164 38L190 44L192 52Z" />
      <path className="inv-auto-cuerpo" d="M44 22H64V28H56L58 40H52L50 28H44Z" />
      <path className="inv-auto-cuerpo" d="M180 50H198V56H176Z" />
      <path className="inv-auto-casco" d="M104 24Q108 12 118 14Q124 16 124 24Z" />
      <path className="inv-auto-franja" d="M70 44H176" />
      <circle cx="148" cy="42" r="7" className="inv-auto-numero" />
      <text x="148" y="45.5" textAnchor="middle" className="inv-auto-numero-txt">
        7
      </text>
      <g className="inv-auto-rueda" style={{ transformOrigin: "74px 52px" }}>
        <circle cx="74" cy="52" r="14" className="inv-auto-llanta" />
        <circle cx="74" cy="52" r="6" className="inv-auto-rin" />
        <path d="M74 42V62M64 52H84" className="inv-auto-rayo" />
      </g>
      <g className="inv-auto-rueda" style={{ transformOrigin: "166px 54px" }}>
        <circle cx="166" cy="54" r="12" className="inv-auto-llanta" />
        <circle cx="166" cy="54" r="5" className="inv-auto-rin" />
        <path d="M166 45V63M157 54H175" className="inv-auto-rayo" />
      </g>
    </svg>
  );
}

/* ── Cuento de hadas ───────────────────────────────────────────── */

function EscenografiaCuento() {
  const torre = (x: number, base: number, ancho: number, alto: number, techo: number, i: number) => (
    <g key={i}>
      <rect x={x} y={base - alto} width={ancho} height={alto} className="inv-tema-muro" />
      <path d={`M${x - 6} ${base - alto}L${x + ancho / 2} ${base - alto - techo}L${x + ancho + 6} ${base - alto}Z`} className="inv-tema-techo" />
      <path d={`M${x + ancho / 2} ${base - alto - techo}v-22`} className="inv-tema-asta" />
      <path d={`M${x + ancho / 2} ${base - alto - techo - 22}l20 6-20 6z`} className="inv-tema-banderin" style={{ "--i": i } as React.CSSProperties} />
      <rect x={x + ancho / 2 - 5} y={base - alto + 18} width="10" height="16" rx="5" className="inv-tema-ventana" />
    </g>
  );
  return (
    <div className="inv-tema-escena inv-tema-cuento" aria-hidden="true">
      <div className="inv-tema-nube inv-tema-nube-a" />
      <div className="inv-tema-nube inv-tema-nube-b" />
      <div className="inv-tema-nube inv-tema-nube-c" />
      <svg className="inv-tema-silueta" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
        {/* El arcoíris detrás del castillo */}
        <g className="inv-tema-arcoiris" fill="none" strokeWidth="14">
          <path d="M470 380A250 250 0 0 1 970 380" stroke="#f7a8b8" />
          <path d="M484 380A236 236 0 0 1 956 380" stroke="#fbd38d" />
          <path d="M498 380A222 222 0 0 1 942 380" stroke="#fff3b0" />
          <path d="M512 380A208 208 0 0 1 928 380" stroke="#b8e6c9" />
          <path d="M526 380A194 194 0 0 1 914 380" stroke="#b8d8f7" />
          <path d="M540 380A180 180 0 0 1 900 380" stroke="#d6c2f2" />
        </g>
        <path className="inv-tema-colina-lejos" d="M0 360Q300 300 560 336Q720 290 900 334Q1180 300 1440 350V420H0Z" />
        <g>
          <rect x="600" y="270" width="240" height="84" className="inv-tema-muro" />
          <path d="M600 270h240v-12h-16v6h-16v-6h-16v6h-16v-6h-16v6h-16v-6h-16v6h-16v-6h-16v6h-16v-6h-16v6h-16v-6h-16v6h-16v-6h-16Z" className="inv-tema-muro" />
          {torre(570, 354, 40, 130, 70, 0)}
          {torre(830, 354, 40, 130, 70, 1)}
          {torre(640, 290, 34, 60, 56, 2)}
          {torre(766, 290, 34, 60, 56, 3)}
          {torre(694, 290, 52, 110, 96, 4)}
          <path d="M700 354V318Q720 296 740 318V354Z" className="inv-tema-puerta" />
          <circle cx="660" cy="312" r="7" className="inv-tema-ventana" />
          <circle cx="780" cy="312" r="7" className="inv-tema-ventana" />
        </g>
        <path className="inv-tema-colina" d="M0 392Q360 344 720 368Q1080 344 1440 390V420H0Z" />
      </svg>
    </div>
  );
}

/* ── Mundo de conejitos ────────────────────────────────────────── */

/** Una nube redondeada de tres bultos, para el cielo del prado. */
function nubeSvg(x: number, y: number, s: number, i: number) {
  return (
    <g key={i} className="inv-tema-nubecita" style={{ "--i": i } as React.CSSProperties} transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="26" ry="15" />
      <ellipse cx="20" cy="4" rx="18" ry="12" />
      <ellipse cx="-20" cy="5" rx="16" ry="11" />
    </g>
  );
}

function EscenografiaConejos() {
  // Madrigueras (montículos) con su entrada, repartidas en el prado.
  const madriguera = (x: number, r: number, i: number) => (
    <g key={i}>
      <ellipse cx={x} cy={340} rx={r} ry={r * 0.42} className="inv-tema-monticulo" />
      <ellipse cx={x} cy={340} rx={r * 0.4} ry={r * 0.28} className="inv-tema-madriguera" />
    </g>
  );
  return (
    <div className="inv-tema-escena inv-tema-conejos" aria-hidden="true">
      {/* El sol, tibio y redondo */}
      <div className="inv-tema-sol" />
      {nubeSvg(220, 60, 1, 0)}
      {nubeSvg(1180, 90, 0.8, 1)}
      {nubeSvg(760, 40, 0.6, 2)}
      <svg className="inv-tema-silueta" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
        {/* Colinas lejanas, más claras */}
        <path className="inv-tema-lejos" d="M0 300Q220 260 460 288Q760 240 1020 284Q1260 250 1440 290V420H0Z" />
        {/* El prado: pasto ondulado con florecitas sueltas */}
        <path className="inv-tema-colina" d="M0 340Q240 300 500 322Q780 292 1040 320Q1280 296 1440 328V420H0Z" />
        {madriguera(230, 46, 0)}
        {madriguera(980, 58, 1)}
        {madriguera(1240, 38, 2)}
        {/* Una cerquita de estacas, como de huerto de cuento */}
        <g className="inv-tema-cerca">
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={520 + i * 26} y={296} width="8" height="34" rx="2" />
          ))}
          <rect x="518" y="300" width="372" height="7" />
          <rect x="518" y="316" width="372" height="7" />
        </g>
        {/* Florecitas del prado */}
        {[
          [80, 360], [160, 380], [340, 372], [420, 350], [620, 386], [900, 360],
          [1100, 380], [1180, 350], [1320, 372], [1400, 356], [60, 400], [1400, 400],
        ].map(([x, y], i) => (
          <g key={i} className="inv-tema-florecita" transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-4.5" rx="2.6" ry="4.5" transform={`rotate(${a})`} />
            ))}
            <circle r="1.6" className="inv-tema-florecita-centro" />
          </g>
        ))}
      </svg>
      <ConejoQuieto />
    </div>
  );
}

/** El conejito sentado, mirando al frente, con las orejas erguidas — para la portada. */
function ConejoQuieto() {
  return (
    <div className="inv-tema-conejo-quieto">
      <svg viewBox="0 0 140 130">
        <g className="inv-conejo-oreja-i">
          <path d="M46 60C34 30 36 6 48 2S64 20 58 58Z" />
          <path d="M47 52C40 32 41 14 49 12" className="inv-conejo-oreja-interior" />
        </g>
        <g className="inv-conejo-oreja-d">
          <path d="M82 60C90 28 86 4 74 2S60 22 68 58Z" />
          <path d="M79 50C84 32 82 16 74 12" className="inv-conejo-oreja-interior" />
        </g>
        <ellipse cx="70" cy="76" rx="34" ry="30" className="inv-conejo-cuerpo" />
        <ellipse cx="70" cy="84" rx="15" ry="13" className="inv-conejo-panza" />
        <circle cx="60" cy="66" r="3" className="inv-conejo-ojo" />
        <circle cx="80" cy="66" r="3" className="inv-conejo-ojo" />
        <path d="M66 76c2 2.6 6 2.6 8 0" className="inv-conejo-hocico" strokeLinecap="round" />
        <circle cx="70" cy="72" r="2.2" className="inv-conejo-nariz" />
        <ellipse cx="38" cy="96" rx="8" ry="6" className="inv-conejo-pata" />
        <ellipse cx="102" cy="96" rx="8" ry="6" className="inv-conejo-pata" />
      </svg>
    </div>
  );
}

/**
 * El conejito saltando de perfil — el que cruza cada sección. Un solo
 * cuerpo ovalado (como el conejo sentado: nada de cabeza y cuerpo como
 * dos óvalos separados, que es lo que lo hacía ver deforme), mirando y
 * moviéndose hacia la derecha, con la cara en el borde de adelante y
 * las orejas cayendo hacia atrás por el salto. Todas las piezas son
 * óvalos o curvas CERRADAS (con «Z»): una curva abierta con relleno se
 * cierra sola con una línea recta y deja una astilla — así se rompió
 * la pata delantera de la versión anterior.
 */
function ConejoSalta() {
  return (
    <svg className="inv-conejo-salta" viewBox="0 0 160 110">
      <ellipse className="inv-conejo-sombra" cx="82" cy="97" rx="30" ry="6" />
      <g className="inv-conejo-cuerpo-grupo">
        <ellipse cx="46" cy="80" rx="12" ry="9" className="inv-conejo-pata" transform="rotate(-18 46 80)" />
        <ellipse cx="76" cy="60" rx="36" ry="27" className="inv-conejo-cuerpo" transform="rotate(-10 76 60)" />
        <path className="inv-conejo-oreja-i" d="M90 34C82 6 84-14 94-16S106-2 100 32Z" />
        <path className="inv-conejo-oreja-d" d="M104 32C110 4 106-16 96-17S86 0 92 30Z" />
        <ellipse cx="106" cy="76" rx="11" ry="8" className="inv-conejo-pata" transform="rotate(14 106 76)" />
        <ellipse cx="70" cy="70" rx="15" ry="11" className="inv-conejo-panza" />
        <circle cx="100" cy="44" r="3" className="inv-conejo-ojo" />
        <circle cx="109" cy="49" r="2.2" className="inv-conejo-nariz" />
        <path d="M105 53c1.6 2 4.8 2 6.4 0" className="inv-conejo-hocico" strokeLinecap="round" />
        <ellipse cx="42" cy="56" rx="7" ry="6" className="inv-conejo-panza" />
      </g>
    </svg>
  );
}

/** El personaje que cruza cada escena al llegar a ella. */
export function Cruce({ tema }: { tema: Exclude<Tema, "ninguno"> }) {
  return (
    <div className={`inv-cruce inv-cruce-${tema}`} aria-hidden="true">
      {tema === "magia" && <Lechuza carta />}
      {tema === "carreras" && <AutoCarrera />}
      {tema === "conejos" && <ConejoSalta />}
      {tema === "cuento" && (
        <svg className="inv-fugaz" viewBox="0 0 220 60">
          <path className="inv-fugaz-estela" d="M4 50Q90 44 176 22" />
          <path className="inv-fugaz-estrella" d="M190 6l4.6 10.4 11.4 1.2-8.6 7.6 2.6 11.2-10-6-10 6 2.6-11.2-8.6-7.6 11.4-1.2z" />
        </svg>
      )}
    </div>
  );
}
