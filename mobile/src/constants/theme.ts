/**
 * Misma paleta que /web (src/app/globals.css): los dos colores del
 * logo se reparten los roles — navy para confianza (seleccionado,
 * confirmado, panel del negocio) y naranja como el color de la acción
 * de reservar. Una sola paleta fija — el sitio tampoco tiene modo
 * oscuro — así que no hay light/dark que resolver.
 *
 * El lienzo NO es blanco: las pantallas van sobre `canvas` (un gris
 * muy claro) y las tarjetas encima en blanco puro. Ese contraste es lo
 * que hace que las piezas floten, en vez del blanco-sobre-blanco que
 * aplanaba todo.
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
  /** El acento de RELLENO: botones, chips y tarjetas (espejo de
   *  `--color-aventurea-sky` en la web). El naranja quedó solo para
   *  TEXTO — como fondo competía con el navy de marca. */
  sky: "#2f7cbe",
  skyDark: "#24638f",
  skyLight: "#e8f2fb",
  /** Tinta legible sobre `skyLight` (reemplaza al "#a2490c" naranja). */
  skyInk: "#1d5b8f",
  green: "#1f7a4d",
  greenLight: "#e1f0e6",
  /** El lienzo de todas las pantallas: gris muy claro, nunca blanco. */
  canvas: "#f4f5f8",
  /** Alias histórico de `canvas` — las pantallas lo usan como fondo. */
  cream: "#f4f5f8",
  /** Superficie hundida sobre blanco: buscadores, chips en reposo. */
  cream2: "#eceef4",
  /** Las tarjetas y hojas: el único blanco puro del sistema. */
  surface: "#ffffff",
  ink: "#161616",
  inkSoft: "#585858",
  /** El gris de las micro-etiquetas en mayúsculas. */
  inkMuted: "#8b8f9c",
  line: "#e3e6ee",
  /** Borde de un elemento en reposo que sí debe notarse (inputs). */
  lineFuerte: "#d3d8e4",
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

/**
 * Un solo juego de radios para toda la app. El diseño es de esquinas
 * CERRADAS: `sm` es el de los botones y las filas seleccionables,
 * `md` el de las tarjetas, `lg` los bloques grandes y `xl` las hojas
 * inferiores. Nada de píldoras salvo los chips y las etiquetas.
 */
export const Radios = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

/**
 * Sombras muy tenues: la profundidad la da el contraste tarjeta/lienzo,
 * no la sombra. `flotante` es solo para los docks despegados.
 */
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

/**
 * La escala tipográfica del sistema. `micro` es la firma del diseño:
 * la etiqueta en mayúsculas con tracking abierto que rotula cada
 * bloque ("ELEGÍ TU SERVICIO", "AGOSTO", "EVENTOS").
 */
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

/**
 * Las cuatro verticales que ofrece Bookea, con su rótulo, su ícono y
 * el color de su botón de reservar.
 *
 * El acento NO es el mismo en todas: en el diseño de referencia el
 * "Reservar" de un salón de eventos va naranja y el de una cita va
 * navy. Los dos colores del logo se reparten por lo que se está
 * haciendo — naranja para lo que se celebra y se sale a consumir
 * (eventos, restaurantes), navy para lo que se agenda con alguien
 * (citas, hospedajes). Cambiar una vertical de bando es cambiar una
 * línea acá y se propaga a toda la app.
 */
export const VERTICALES = {
  eventos: { kicker: "Eventos", icono: "sparkles-outline", acento: "reservar" },
  citas: { kicker: "Servicios", icono: "time-outline", acento: "navy" },
  restaurantes: { kicker: "Restaurantes", icono: "restaurant-outline", acento: "reservar" },
  hospedajes: { kicker: "Hospedajes", icono: "home-outline", acento: "navy" },
} as const;

export type Vertical = keyof typeof VERTICALES;

/** El tono del botón principal de cada vertical (ver `VERTICALES`). */
export type TonoAccion = "reservar" | "navy";

export function acentoDe(vertical: Vertical): TonoAccion {
  return VERTICALES[vertical].acento;
}

/** El color crudo del acento, para bordes y textos que no son botón. */
export function colorAcentoDe(vertical: Vertical): string {
  return VERTICALES[vertical].acento === "navy" ? Colors.navy : Colors.accent;
}
