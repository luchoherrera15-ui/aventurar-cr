import type { Ornamento as TipoOrnamento, Transicion } from "@/lib/celebrar/invitacion/esquema";

/**
 * Los adornos vectoriales de la invitación: el ornamento bajo los
 * títulos (línea con diamante, floritura, estrella…) y los bordes
 * entre escenas (ondas, festón, diagonal, curva). Todo SVG inline en
 * `currentColor`, sin recursos externos.
 */

export function Ornamento({ tipo, className = "inv-orn" }: { tipo: TipoOrnamento; className?: string }) {
  if (tipo === "ninguno") return null;
  const comun = { className, viewBox: "0 0 240 24", fill: "none", stroke: "currentColor", strokeWidth: 1.2, "aria-hidden": true as const };
  switch (tipo) {
    case "linea":
      return (
        <svg {...comun} viewBox="0 0 240 8">
          <path d="M60 4h120" strokeLinecap="round" />
        </svg>
      );
    case "diamante":
      return (
        <svg {...comun}>
          <path d="M8 12h96M136 12h96" strokeLinecap="round" />
          <path d="M120 4l8 8-8 8-8-8z" />
        </svg>
      );
    case "floral":
      return (
        <svg {...comun} viewBox="0 0 240 30">
          <path d="M20 15c30-14 60 14 90 0M130 15c30-14 60 14 90 0" strokeLinecap="round" />
          <path d="M110 15c0-6 5-10 10-10s10 4 10 10-5 10-10 10-10-4-10-10z" />
          <circle cx="120" cy="15" r="2" fill="currentColor" stroke="none" />
          <path d="M40 15c4-6 10-6 14 0M186 15c4-6 10-6 14 0" strokeLinecap="round" />
        </svg>
      );
    case "estrella":
      return (
        <svg {...comun}>
          <path d="M10 12h90M140 12h90" strokeLinecap="round" />
          <path d="M120 3l2.6 6.4 6.9.5-5.3 4.5 1.7 6.7-5.9-3.6-5.9 3.6 1.7-6.7-5.3-4.5 6.9-.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "corazon":
      return (
        <svg {...comun}>
          <path d="M12 12h92M136 12h92" strokeLinecap="round" />
          <path d="M120 20s-9-5.6-9-11.2c0-2.9 2.3-4.8 4.6-4.8 1.9 0 3.4 1 4.4 2.6 1-1.6 2.5-2.6 4.4-2.6 2.3 0 4.6 1.9 4.6 4.8C129 14.4 120 20 120 20z" />
        </svg>
      );
    case "anillos":
      return (
        <svg {...comun}>
          <path d="M10 12h86M144 12h86" strokeLinecap="round" />
          <circle cx="114" cy="12" r="7.5" />
          <circle cx="126" cy="12" r="7.5" />
        </svg>
      );
    case "hoja":
      return (
        <svg {...comun} viewBox="0 0 240 28">
          <path d="M16 14h72M152 14h72" strokeLinecap="round" />
          <path d="M96 14c8-10 20-12 30-8-4 10-16 14-30 8zM144 14c-8-10-20-12-30-8 4 10 16 14 30 8z" />
          <path d="M100 13l20-5M140 13l-20-5" strokeLinecap="round" />
        </svg>
      );
    case "huella":
      return (
        <svg {...comun} viewBox="0 0 240 28">
          <path d="M14 14h82M144 14h82" strokeLinecap="round" />
          <g fill="currentColor" stroke="none">
            <ellipse cx="120" cy="17" rx="5" ry="6" />
            <ellipse cx="113.4" cy="8.6" rx="2.3" ry="5" transform="rotate(-28 113.4 8.6)" />
            <ellipse cx="120" cy="6" rx="2.3" ry="5.4" />
            <ellipse cx="126.6" cy="8.6" rx="2.3" ry="5" transform="rotate(28 126.6 8.6)" />
          </g>
        </svg>
      );
    case "varita":
      // La varita en diagonal con su estrella y la estela de chispas.
      return (
        <svg {...comun} viewBox="0 0 240 30">
          <path d="M10 15h78M162 15h68" strokeLinecap="round" />
          <path d="M100 24l34-16" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M100 24l6-2.8" strokeWidth="3.6" strokeLinecap="round" />
          <path d="M140 2l1.7 3.9 4.2.4-3.2 2.8 1 4.1-3.7-2.2-3.7 2.2 1-4.1-3.2-2.8 4.2-.4z" fill="currentColor" stroke="none" />
          <path d="M150 12l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9zM130 3l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "banderas": {
      // Dos banderas a cuadros cruzadas, como en la meta.
      const cuadros = (x0: number, y0: number) =>
        [0, 1, 2, 3].flatMap((c) => [0, 1, 2].map((f) => ((c + f) % 2 === 0 ? <rect key={`${x0}-${c}-${f}`} x={x0 + c * 4} y={y0 + f * 4} width="4" height="4" fill="currentColor" stroke="none" /> : null)));
      return (
        <svg {...comun} viewBox="0 0 240 32">
          <path d="M10 18h86M144 18h86" strokeLinecap="round" />
          <path d="M108 30l18-26M132 30l-18-26" strokeLinecap="round" strokeWidth="1.6" />
          <g transform="rotate(-34 126 4)">{cuadros(126, 4)}<rect x="126" y="4" width="16" height="12" /></g>
          <g transform="rotate(34 114 4) translate(-16 0)">{cuadros(114, 4)}<rect x="114" y="4" width="16" height="12" /></g>
        </svg>
      );
    }
    case "corona":
      return (
        <svg {...comun} viewBox="0 0 240 30">
          <path d="M10 17h88M142 17h88" strokeLinecap="round" />
          <path d="M106 23l-3-14 8 6 9-11 9 11 8-6-3 14z" strokeLinejoin="round" />
          <path d="M106 26h28" strokeLinecap="round" />
          <circle cx="120" cy="3.5" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="103" cy="8" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="137" cy="8" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

/** Las almenas: bloques que cuelgan del borde, como la muralla de un castillo. */
const ALMENAS = (() => {
  const partes = ["M0 0h1440v26"];
  for (let x = 1440; x > 0; x -= 90) partes.push(`H${x - 10}v24h-40v-24`);
  return partes.join("") + "H0z";
})();

/** Nubes: bultos de radios distintos, para que no se lea como un festón. */
const NUBES = (() => {
  const radios = [34, 22, 40, 26, 30, 44, 24, 36, 28, 42, 26, 32];
  let x = 0;
  const partes = ["M0 0h1440v16H1440"];
  const arcos: string[] = [];
  let i = 0;
  while (x < 1440) {
    const r = radios[i % radios.length];
    arcos.push(`a${r} ${Math.round(r * 0.8)} 0 0 1 ${-r * 2} 0`);
    x += r * 2;
    i += 1;
  }
  return partes.join("") + arcos.join("") + "V0z";
})();

/**
 * El borde entre dos escenas: se pinta arriba de la escena nueva con el
 * color de la escena anterior (`color`), como si esta bajara sobre la
 * siguiente.
 */
export function BordeEscena({ tipo, color }: { tipo: Transicion; color: string }) {
  if (tipo === "recta") return null;
  // La bandera a cuadros no se estira: va en CSS, con cuadros siempre cuadrados.
  if (tipo === "bandera") return <span className="inv-borde inv-borde-bandera" style={{ "--borde-color": color } as React.CSSProperties} aria-hidden="true" />;
  const d =
    tipo === "ondas"
      ? "M0 0h1440v22c-120 26-240 26-360 0s-240-26-360 0-240 26-360 0S120 -4 0 22z"
      : tipo === "feston"
        ? "M0 0h1440v14c-30 0-30 26-60 26s-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26-30-26-60-26-30 26-60 26z"
        : tipo === "diagonal"
          ? "M0 0h1440v6L0 60z"
          : tipo === "almenas"
            ? ALMENAS
            : tipo === "nubes"
              ? NUBES
              : "M0 0h1440v10C1100 70 340 70 0 10z";
  return (
    <svg className="inv-borde" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill={color} />
    </svg>
  );
}

/* Íconos chicos de línea que usan las secciones. */
export const Icono = {
  reloj: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  waze: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 12a8 8 0 1 1 16 0c0 3.5-2.6 6.4-6 7.6L11 21l-1-1.5C6.7 18.3 4 15.4 4 12z" strokeLinejoin="round" />
      <circle cx="9.5" cy="11" r="1" fill="currentColor" />
      <circle cx="14.5" cy="11" r="1" fill="currentColor" />
      <path d="M9 14c1.5 1.5 4.5 1.5 6 0" strokeLinecap="round" />
    </svg>
  ),
  calendario: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20l1.3-3.8A8.5 8.5 0 1 1 8.4 19L4 20z" strokeLinejoin="round" />
      <path d="M9.5 9.5c.3 2.5 2.5 4.7 5 5l1.2-1.2-1.8-1-1 .7c-.8-.4-1.5-1.1-1.9-1.9l.7-1-1-1.8L9.5 9.5z" strokeLinejoin="round" />
    </svg>
  ),
  corbata: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M9.5 3h5l-1 3.5h-3z" strokeLinejoin="round" />
      <path d="M10.5 6.5h3l2 10-3.5 4.5-3.5-4.5z" strokeLinejoin="round" />
    </svg>
  ),
  vestido: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M9 3l3 3 3-3v4l-1.5 3L18 21H6l4.5-11L9 7z" strokeLinejoin="round" />
    </svg>
  ),
  casco: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3.5 15.5C3.5 9.5 7.5 5 13 5c4.4 0 7.5 3.4 7.5 7.8V17H6.5A3 3 0 0 1 3.5 15.5z" strokeLinejoin="round" />
      <path d="M12 9.5h8.4V13H12.8A.8.8 0 0 1 12 12.2z" strokeLinejoin="round" />
      <path d="M6 17v2h14.5v-2M8 7.2l3 3.8" strokeLinecap="round" />
    </svg>
  ),
  llave: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M14.5 4.2a4.6 4.6 0 0 0-4.4 6L3.8 16.5a1.8 1.8 0 0 0 2.6 2.6l6.3-6.3a4.6 4.6 0 0 0 6-4.4l-2.8 2.8-2.6-.6-.6-2.6z" strokeLinejoin="round" />
    </svg>
  ),
  sombreroMago: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 19.5c3 1.4 15 1.4 18 0M6 18.8L11.6 3.5c.3-.7 1-.6 1.2.1l1 3.4-1.2.8 1.6.4L17.8 18.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.4 15.4c3 .9 6.8.9 9.4 0" strokeLinecap="round" />
      <path d="M11 10.5l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z" fill="currentColor" stroke="none" />
    </svg>
  ),
  libro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M12 6.5C10 5 6.5 4.5 3.5 5v13c3-.5 6.5 0 8.5 1.5 2-1.5 5.5-2 8.5-1.5V5c-3-.5-6.5 0-8.5 1.5zM12 6.5v13" strokeLinejoin="round" />
    </svg>
  ),
  corona: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4.5 17L3 7.5l5 4 4-6.5 4 6.5 5-4L19.5 17z" strokeLinejoin="round" />
      <path d="M4.5 20h15" strokeLinecap="round" />
      <circle cx="12" cy="3.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  sombreroExplorador: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2.5 16c2 1.6 17 1.6 19 0-1.5-.8-3.3-1.2-4.6-1.3L16 8.5C15.6 6.4 14 5.5 12 5.5S8.4 6.4 8 8.5l-.9 6.2c-1.3.1-3.1.5-4.6 1.3z" strokeLinejoin="round" />
      <path d="M7.4 12.6c3 .8 6.2.8 9.2 0" strokeLinecap="round" />
    </svg>
  ),
  camiseta: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M9 3.5c.6 1.4 1.6 2 3 2s2.4-.6 3-2l5 2.5-1.8 4-2.2-1V20.5H8V9l-2.2 1L4 6z" strokeLinejoin="round" />
    </svg>
  ),
  camisa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M9 3.5L4 6l1.8 4L8 9v11.5h8V9l2.2 1L20 6l-5-2.5-3 3.5z" strokeLinejoin="round" />
      <path d="M12 7v13M9 3.5l3 3.5 3-3.5" strokeLinejoin="round" />
    </svg>
  ),
  gancho: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M10 6.5a2 2 0 1 1 2.6 1.9c-.4.1-.6.4-.6.8V10L3.5 16.2c-.8.6-.4 1.8.6 1.8h15.8c1 0 1.4-1.2.6-1.8L12 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  regalo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
      <path d="M3.5 13h17M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  enlace: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" strokeLinecap="round" />
    </svg>
  ),
};
