import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS ÍCONOS DE RUBRO — LOS MISMOS TRAZOS QUE LA WEB
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): «la misma sintonía de íconos en el
 * app, que se sincronice con la web».
 *
 * La app usaba Ionicons genéricos (cut-outline, man-outline…) y la web
 * dibujos propios: el poste de barbero, el frasco de esmalte, la bola
 * disco. Dos personas mirando el mismo rubro en el sitio y en la app
 * veían dibujos distintos — y la silueta del ícono es lo primero que se
 * reconoce de un producto.
 *
 * ── SON LOS MISMOS PATHS, COPIADOS NÚMERO POR NÚMERO ────────────────
 *
 * Cada figura de acá abajo es la de `src/components/icons.tsx` de la
 * web, con el mismo viewBox 24×24 y el mismo strokeWidth. NO se
 * redibujaron «parecidos»: se copiaron. Si la web cambia un trazo, el
 * cambio se copia acá igual de literal — dos fuentes que se editan por
 * separado se van despegando sin que nadie lo decida.
 *
 * ── POR QUÉ NO SE COMPARTE EL ARCHIVO CON LA WEB ────────────────────
 *
 * Porque el runtime es otro: la web emite `<svg>` del DOM y esto emite
 * componentes de `react-native-svg`. Un archivo único necesitaría un
 * adaptador por plataforma que costaría más que las once figuras.
 */

export type IconoRubroProps = {
  size?: number;
  color?: string;
};

const BASE = { fill: "none" as const };

/** Uñas: el frasco de esmalte con su pincel. */
export function IconoEsmalte({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Path strokeLinejoin="round" d="M7.5 11h9v8.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V11Z" />
      <Path strokeLinecap="round" d="M7.5 14.5h9" />
      <Path strokeLinejoin="round" d="M9.8 11V8.2a1 1 0 0 1 1-1h2.4a1 1 0 0 1 1 1V11" />
      <Path strokeLinecap="round" d="M12 7.2V3.5" />
    </Svg>
  );
}

/** Barbería: el poste rayado de la puerta. */
export function IconoPosteBarbero({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Rect x={8} y={6} width={8} height={12} rx={4} />
      <Path strokeLinecap="round" d="M8.4 10.5 15.6 8M8.4 14.5 15.6 12" />
      <Path strokeLinecap="round" d="M7 4.5h10M7 19.5h10M12 19.5V22" />
    </Svg>
  );
}

/** Belleza: las tijeras abiertas. */
export function IconoTijeras({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Circle cx={6.5} cy={18} r={2.6} />
      <Circle cx={17.5} cy={18} r={2.6} />
      <Path strokeLinecap="round" d="M8.4 16.1 18.5 3.5M15.6 16.1 5.5 3.5" />
    </Svg>
  );
}

/** Spa y bienestar: la flor de loto. */
export function IconoLoto({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.6} {...BASE}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5c-2.6 0-4.8-1.7-5.7-4.2 1.9-1.1 4-1 5.7.4 1.7-1.4 3.8-1.5 5.7-.4-.9 2.5-3.1 4.2-5.7 4.2Z" />
      <Path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5c-1.9-2-2.4-4.9-1.2-7.4.5-1 1.2-1.9 1.2-1.9s.7.9 1.2 1.9c1.2 2.5.7 5.4-1.2 7.4Z" />
      <Path strokeLinecap="round" strokeLinejoin="round" d="M6.3 15.3c-1.4-.6-2.4-1.9-2.6-3.4 1.6-.6 3.2-.2 4.3 1M17.7 15.3c1.4-.6 2.4-1.9 2.6-3.4-1.6-.6-3.2-.2-4.3 1" />
    </Svg>
  );
}

/** Consultorios: el estetoscopio. */
export function IconoEstetoscopio({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Path strokeLinecap="round" d="M6 3v4.5a4 4 0 0 0 8 0V3" />
      <Path strokeLinecap="round" d="M4.5 3H6M12.5 3H14" />
      <Path strokeLinecap="round" d="M10 11.5v2.2a4.8 4.8 0 0 0 9.6 0v-1" />
      <Circle cx={19.6} cy={10.5} r={2.1} />
    </Svg>
  );
}

/** Otros servicios: la varita. */
export function IconoVarita({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="m3.5 20.5 11.2-11.2 1.7 1.7L5.2 22.2l-1.7-1.7Z" />
      <Path strokeLinecap="round" d="M17.5 3v3.4M15.8 4.7h3.4" />
      <Circle cx={20.8} cy={10.3} r={0.8} fill={color} stroke="none" />
      <Circle cx={12.5} cy={3.8} r={0.8} fill={color} stroke="none" />
    </Svg>
  );
}

/** Lugares: el rancho de fiestas. */
export function IconoRancho({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M2.5 10.5 12 3l9.5 7.5" />
      <Path strokeLinecap="round" d="M5.5 13.5h13" />
      <Path strokeLinecap="round" d="M6.5 13.5V20M17.5 13.5V20M12 13.5V20" />
      <Path strokeLinecap="round" d="M3.5 20.5h17" />
    </Svg>
  );
}

/** Alimentación: la campana de catering sobre su bandeja. */
export function IconoCloche({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Path strokeLinecap="round" strokeLinejoin="round" d="M4.5 16a7.5 7.5 0 0 1 15 0" />
      <Path strokeLinecap="round" d="M2.5 16.5h19M12 8.5V7" />
      <Circle cx={12} cy={5.5} r={1.2} />
      <Path strokeLinecap="round" d="M5.5 20h13" />
    </Svg>
  );
}

/** Animación: la bola disco con su brillo. */
export function IconoDisco({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.6} {...BASE}>
      <Path strokeLinecap="round" d="M12 2.5V5" />
      <Circle cx={12} cy={12.5} r={7} />
      <Path strokeLinecap="round" d="M5.5 10.3h13M5.5 14.7h13" />
      <Path d="M9.6 6c-1.5 4.2-1.5 8.8 0 13M14.4 6c1.5 4.2 1.5 8.8 0 13" />
      <Circle cx={4} cy={4.5} r={0.8} fill={color} stroke="none" />
      <Circle cx={20.5} cy={6} r={0.8} fill={color} stroke="none" />
    </Svg>
  );
}

/** Organización: el calendario con el evento ya resuelto. */
export function IconoPlannerCheck({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Rect x={3} y={5} width={18} height={16} rx={2.5} />
      <Path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
      <Path strokeLinecap="round" strokeLinejoin="round" d="m8.5 15.3 2.4 2.4 4.6-4.9" />
    </Svg>
  );
}

/** Decoración: los dos globos amarrados. */
export function IconoGlobos({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.6} {...BASE}>
      <Ellipse cx={15.5} cy={8.5} rx={3.4} ry={4} />
      <Path strokeLinecap="round" d="M15.5 12.5c.6 2.6-.7 4.2-.2 6.5" />
      <Ellipse cx={8.3} cy={7.5} rx={3.9} ry={4.6} />
      <Path strokeLinecap="round" d="M8.3 12.1c-.6 3 .9 4.7.3 7.9" />
      <Path strokeLinecap="round" d="M7.5 12.3h1.6" />
    </Svg>
  );
}

/* ── Los siete del segundo nivel de Citas (28 ago 2026) ──────────────
   Copiados número por número de src/components/icons.tsx de la web,
   como el resto de la familia: viewBox 24, trazo 1.7, puntas redondas. */

/** Cejas y pestañas: el ojo cerrado con sus pestañas y la ceja. */
export function IconoOjoPestanas({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Path strokeLinecap="round" d="M4.5 11c2.4 2.9 5 4.3 7.5 4.3s5.1-1.4 7.5-4.3" />
      <Path strokeLinecap="round" d="m7.4 14.6-1.3 1.9M12 15.7v2.3M16.6 14.6l1.3 1.9" />
      <Path strokeLinecap="round" d="M7 6.8c1.6-1.1 3.3-1.6 5-1.6s3.4.5 5 1.6" />
    </Svg>
  );
}

/** Peinados: el peine de mano. */
export function IconoPeine({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Rect x={5.5} y={4.5} width={13} height={4} rx={1.6} />
      <Path strokeLinecap="round" d="M7.6 8.5v10M10.5 8.5v10M13.5 8.5v10M16.4 8.5v10" />
    </Svg>
  );
}

/** Maquillaje: el labial abierto. */
export function IconoLabial({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Rect x={8.5} y={13.5} width={7} height={6.5} rx={1.2} />
      <Path strokeLinecap="round" strokeLinejoin="round" d="M10.3 13.5v-2.4h3.4v2.4" />
      <Path strokeLinecap="round" strokeLinejoin="round" d="M10.3 11.1V5.6c0-.5.3-.9.8-1l2.6-.7v7.2" />
    </Svg>
  );
}

/** Depilación: la banda de cera y la gota. */
export function IconoCera({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Rect x={3.6} y={7.6} width={12.6} height={4.6} rx={2.3} transform="rotate(-16 9.9 9.9)" />
      <Path strokeLinejoin="round" d="M18.3 13.4s-2 2.3-2 3.7a2 2 0 0 0 4 0c0-1.4-2-3.7-2-3.7Z" />
      <Path strokeLinecap="round" d="M5.5 15.5 4 17M8.8 16.8l-.8 2" />
    </Svg>
  );
}

/** Masajes: las piedras calientes apiladas, con su vapor. */
export function IconoPiedras({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Ellipse cx={12} cy={17.8} rx={6.2} ry={2.6} />
      <Ellipse cx={12} cy={13.3} rx={4.6} ry={2.1} />
      <Ellipse cx={12} cy={9.6} rx={3.1} ry={1.7} />
      <Path strokeLinecap="round" d="M10 5.4c.5-.7.5-1.4 0-2.1M14 5.4c.5-.7.5-1.4 0-2.1" />
    </Svg>
  );
}

/** Sauna y jacuzzi: el vapor subiendo de la banca. */
export function IconoVapor({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Path strokeLinecap="round" d="M8 4.5c-1.1 1.5-1.1 3 0 4.5 1.1 1.5 1.1 3 0 4.5M12 4.5c-1.1 1.5-1.1 3 0 4.5 1.1 1.5 1.1 3 0 4.5M16 4.5c-1.1 1.5-1.1 3 0 4.5 1.1 1.5 1.1 3 0 4.5" />
      <Path strokeLinecap="round" d="M5 18h14M7.2 18v2.5M16.8 18v2.5" />
    </Svg>
  );
}

/** Estética (tratamientos faciales): el frasco de crema y el destello. */
export function IconoCrema({ size = 22, color = "#16295e" }: IconoRubroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} stroke={color} strokeWidth={1.7} {...BASE}>
      <Rect x={6} y={10} width={12} height={9.5} rx={2} />
      <Path strokeLinecap="round" d="M7 10V8.9a1.4 1.4 0 0 1 1.4-1.4h7.2A1.4 1.4 0 0 1 17 8.9V10" />
      <Path strokeLinecap="round" d="M6 14.8h12" />
      <Path strokeLinecap="round" d="M19.6 3.2v3.2M18 4.8h3.2" />
    </Svg>
  );
}

/**
 * El ícono de un rubro, con el MISMO reparto que la web
 * (`categoriaIcono` en `src/lib/categorias-vertical.ts` +
 * `CATEGORIA_CITA_ICONO` en `src/app/citas/iconos.tsx`). Una categoría
 * desconocida cae en la varita, igual que allá.
 */
export function IconoRubro({
  vertical,
  categoria,
  subcategoria,
  size,
  color,
}: IconoRubroProps & {
  vertical: "citas" | "eventos";
  categoria: string;
  /** Subcategoría de Citas con trazo propio (la grilla de dos
   *  carriles). Una desconocida cae en el ícono de su CATEGORÍA, no en
   *  la varita: es lo más cierto que queda. */
  subcategoria?: string;
}) {
  const props = { size, color };
  if (vertical === "citas") {
    switch (subcategoria) {
      case "cejas_pestanas": return <IconoOjoPestanas {...props} />;
      case "peinados": return <IconoPeine {...props} />;
      case "maquillaje": return <IconoLabial {...props} />;
      case "depilacion": return <IconoCera {...props} />;
      case "tratamientos_faciales": return <IconoCrema {...props} />;
      case "masajes": return <IconoPiedras {...props} />;
      case "sauna_jacuzzi": return <IconoVapor {...props} />;
    }
    switch (categoria) {
      case "unas": return <IconoEsmalte {...props} />;
      case "barberia": return <IconoPosteBarbero {...props} />;
      case "belleza": return <IconoTijeras {...props} />;
      case "spa": return <IconoLoto {...props} />;
      case "consultorio": return <IconoEstetoscopio {...props} />;
      default: return <IconoVarita {...props} />;
    }
  }
  switch (categoria) {
    case "lugares": return <IconoRancho {...props} />;
    case "alimentacion": return <IconoCloche {...props} />;
    case "animacion": return <IconoDisco {...props} />;
    case "organizacion": return <IconoPlannerCheck {...props} />;
    case "decoracion": return <IconoGlobos {...props} />;
    default: return <IconoVarita {...props} />;
  }
}
