/**
 * Misma paleta de marca que Bookea (mobile/src/constants/theme.ts y
 * /web globals.css): navy para confianza, naranja como acento — acá
 * el naranja es EL color de acción (FOOD no reparte navy/naranja por
 * vertical, es una sola app con un solo trabajo: reservar con
 * descuento). Ver food/directorio-food.tsx en /web para el mismo
 * criterio del lado web.
 *
 * El lienzo NO es blanco: las pantallas van sobre `canvas` y las
 * tarjetas encima en blanco puro, igual que el resto de Bookea.
 */
export const Colors = {
  navy: "#16295e",
  navyDark: "#0f1d45",
  navy2: "#22397c",
  accent: "#ee7420",
  accentDark: "#c96c00",
  accentLight: "#fdeee1",
  green: "#1f7a4d",
  greenLight: "#e1f0e6",
  /** Fondo de placeholder de foto (tarjetas, hero) — mismo azul que
   *  --color-aventurea-blue-light en /web (globals.css). */
  blueLight: "#e8f0f9",
  /** El lienzo de todas las pantallas: gris muy claro, nunca blanco. */
  canvas: "#f4f5f8",
  cream2: "#eceef4",
  /** Las tarjetas y hojas: el único blanco puro del sistema. */
  surface: "#ffffff",
  /** El hero oscuro premium (mismo tono que el hero de /food en web). */
  heroOscuro: "#0b0b0e",
  ink: "#161616",
  inkSoft: "#585858",
  inkMuted: "#8b8f9c",
  line: "#e3e6ee",
  lineFuerte: "#d3d8e4",
  danger: "#b3261e",
  dangerLight: "#fbe9e7",
} as const;

/** Misma tipografía que Bookea: Figtree. */
export const Fonts = {
  regular: "Figtree_400Regular",
  medium: "Figtree_500Medium",
  semiBold: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
  extraBold: "Figtree_800ExtraBold",
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radios = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export const Sombras = {
  tarjeta: {
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  elevada: {
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  flotante: {
    shadowColor: "#101a2c",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 12,
  },
} as const;

export const Tipo = {
  micro: {
    color: Colors.inkMuted,
    fontFamily: Fonts.extraBold,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  meta: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12.5 },
  cuerpo: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13.5, lineHeight: 20 },
  fila: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  titulo3: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15.5, letterSpacing: -0.2 },
  titulo2: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 18, letterSpacing: -0.35 },
  titulo1: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 24, letterSpacing: -0.6 },
  display: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 30, letterSpacing: -0.9 },
} as const;
