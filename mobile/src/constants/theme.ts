/**
 * Misma paleta que /web (src/app/globals.css): navy como único
 * acento de marca sobre fondo blanco, sin tinte crema. Una sola
 * paleta fija — el sitio tampoco tiene modo oscuro — así que no hay
 * light/dark que resolver en cada pantalla.
 */
export const Colors = {
  navy: "#1b2a4a",
  navyDark: "#142038",
  accent: "#1b2a4a",
  accentLight: "#f6f6f6",
  green: "#1f7a4d",
  greenLight: "#e1f0e6",
  cream: "#ffffff",
  cream2: "#f6f6f6",
  surface: "#ffffff",
  ink: "#161616",
  inkSoft: "#585858",
  line: "#e2e2e2",
  danger: "#b3261e",
  dangerLight: "#fbe9e7",
} as const;

/**
 * Misma tipografía que /web: Montserrat. Cada peso es una familia de
 * fuente aparte (así carga expo-font) — por eso los estilos usan
 * `fontFamily` en vez de `fontWeight` para el texto en Montserrat.
 * Los títulos van en ExtraBold con tracking cerrado, igual que la
 * clase `titulo` de globals.css en /web.
 */
export const Fonts = {
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semiBold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
  extraBold: "Montserrat_800ExtraBold",
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
