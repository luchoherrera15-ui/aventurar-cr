/**
 * Misma paleta que /web (src/app/globals.css): los dos colores del
 * logo se reparten los roles — navy para confianza (reservar, chat,
 * seleccionado) y naranja como acento de descubrimiento (búsqueda,
 * favoritos, estados pendientes). Una sola paleta fija — el sitio
 * tampoco tiene modo oscuro — así que no hay light/dark que resolver.
 */
export const Colors = {
  navy: "#16295e",
  navyDark: "#0f1d45",
  // Los dos escalones intermedios del navy y el azul claro: los mismos
  // --color-aventurea-navy-2/-3 y -blue/-blue-light de globals.css. Se
  // usan donde la web pide una escala de azules (los lienzos del
  // catálogo de invitaciones) en vez de un solo navy plano.
  navy2: "#22397c",
  navy3: "#2f4a94",
  blue: "#3b7fc4",
  blueLight: "#e8f0f9",
  accent: "#ee7420",
  accentLight: "#fdeee1",
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
 * Misma tipografía que /web: Figtree (la fuente de la marca en
 * globals.css/layout.tsx). Cada peso es una familia de fuente aparte
 * (así carga expo-font) — por eso los estilos usan `fontFamily` en vez
 * de `fontWeight`. Los títulos van en ExtraBold con tracking cerrado,
 * igual que la clase `titulo` de globals.css en /web.
 */
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
