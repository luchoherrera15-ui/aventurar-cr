/**
 * Misma paleta que /web (src/app/globals.css): azul navy oscuro como
 * acento de marca sobre fondo claro. Una sola paleta fija — el sitio
 * tampoco tiene modo oscuro — así que no hay light/dark que resolver
 * en cada pantalla.
 */
export const Colors = {
  navy: "#0f2340",
  navyDark: "#122844",
  accent: "#1e3a5f",
  accentLight: "#e6ebf2",
  green: "#1f7a4d",
  greenLight: "#e1f0e6",
  cream: "#f6f7f9",
  cream2: "#eceef2",
  surface: "#ffffff",
  ink: "#101a2c",
  inkSoft: "#5b6472",
  line: "#e2e4ea",
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
