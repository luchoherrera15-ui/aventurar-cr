import type { TipoCelebracionId } from "../marca";
import type { Paleta } from "../invitacion/esquema";

/**
 * Ocho paletas por tipo de celebración. Cada una es un conjunto
 * completo (fondo, tinta, acento, suave, superficie, escena y su tinta)
 * pensado para ese tipo: las de boda van a marfil, verde botella y
 * marino; las de cumpleaños a colores vivos; las corporativas a grafito
 * y azul.
 *
 * La ESCENA es el segundo color de la invitación: el capítulo en vino
 * de una carta de amor sobre marfil, la noche en marino de una gala.
 * Una paleta clara lleva una escena profunda; una paleta oscura lleva
 * una escena que la contraste (clara o de otro tono hondo).
 *
 * Regla que el test comprueba: `tinta` sobre `fondo` ≥ 4,5:1, `suave`
 * sobre `fondo` ≥ 3:1 y `tintaEscena` sobre `escena` ≥ 4,5:1. El acento
 * es decorativo o va sobre `superficie`.
 */
type PaletaNombrada = Paleta & { nombre: string };

const p = (
  nombre: string,
  fondo: string,
  tinta: string,
  acento: string,
  suave: string,
  superficie: string,
  escena: string,
  tintaEscena: string,
): PaletaNombrada => ({ nombre, fondo, tinta, acento, suave, superficie, escena, tintaEscena });

export const PALETAS: Record<TipoCelebracionId, readonly PaletaNombrada[]> = {
  boda: [
    p("Marfil y oro", "#f7f2ea", "#2b2620", "#b8955a", "#6b6259", "#ffffff", "#6b2233", "#fbf5ee"),
    p("Verde botella", "#12352b", "#f5efe4", "#d9be8c", "#b9c9bf", "#1c4a3c", "#f3ede2", "#12352b"),
    p("Marino y champán", "#0b1e45", "#ffffff", "#e2c391", "#a9b6d3", "#142b5c", "#f6f1e7", "#0b1e45"),
    p("Blush", "#fbe9e4", "#4a2a24", "#c98577", "#8a6a63", "#ffffff", "#7a3b3b", "#fff1ec"),
    p("Salvia", "#e7ede6", "#26362c", "#7f9a85", "#5c6e61", "#ffffff", "#2f4a3c", "#eef4ee"),
    p("Vino", "#4a1424", "#fbeef0", "#e3b7a0", "#d9b3bc", "#5f1f33", "#f7efe6", "#4a1424"),
    p("Arena", "#efe6d8", "#3a3128", "#a67c52", "#75685a", "#fbf7f0", "#3b4a3a", "#f4efe6"),
    p("Noche", "#111318", "#f4f4f4", "#c9a961", "#a5a8b3", "#1d2028", "#1d2028", "#f4f4f4"),
  ],
  cumpleanos: [
    p("Confeti", "#fff7e6", "#2a2016", "#ff6b5a", "#7a6a55", "#ffffff", "#b83a2c", "#fff7e6"),
    p("Cielo", "#e6f2ff", "#12294a", "#2f6df6", "#4d648a", "#ffffff", "#1f3f8f", "#eef4ff"),
    p("Selva", "#123d2e", "#f3fbf5", "#ffd166", "#a8d5b9", "#1b5a43", "#ffd166", "#123d2e"),
    p("Caramelo", "#fde2f0", "#4a1e37", "#e94f9c", "#8b5b78", "#ffffff", "#c2185b", "#fff0f7"),
    p("Neón", "#0f0f1a", "#ffffff", "#39ff88", "#b9b9d1", "#1d1d33", "#1d1d33", "#ffffff"),
    p("Limón", "#fff9c9", "#3a3200", "#ff8a00", "#7a6c1a", "#ffffff", "#ff8a00", "#2a1e00"),
    p("Océano", "#0b3d5c", "#eaf6ff", "#ffb703", "#9cc3d9", "#12557f", "#ffb703", "#0b3d5c"),
    p("Lavanda", "#efe6ff", "#2f1f5a", "#7b4dff", "#6a5a8f", "#ffffff", "#4b2fa8", "#f3edff"),
  ],
  xv: [
    p("Oro rosa", "#fbeaee", "#4a1f2c", "#c98a9a", "#8a5f6b", "#ffffff", "#8a3a4e", "#fff0f3"),
    p("Lila", "#efe4fb", "#33184f", "#9b5de5", "#6d5285", "#ffffff", "#4a2477", "#f5eeff"),
    p("Champán", "#f6efe3", "#3a2c1c", "#c8a15c", "#7c6a54", "#ffffff", "#5a4630", "#f9f3e8"),
    p("Noche de gala", "#17102b", "#fbf7ff", "#e0aaff", "#b8a9d9", "#241a3f", "#241a3f", "#fbf7ff"),
    p("Coral", "#ffe3dd", "#5a2018", "#ff6f61", "#8d5a52", "#ffffff", "#c2453a", "#fff1ee"),
    p("Turquesa", "#e0f7f5", "#0c3b39", "#12a5a0", "#4a7b79", "#ffffff", "#0e6b68", "#e9fbfa"),
    p("Rubí", "#5a0e26", "#fff0f4", "#f5b7c8", "#dba9b8", "#75173a", "#fff0f4", "#5a0e26"),
    p("Perla", "#f4f4f6", "#23232b", "#b39ddb", "#6f6f7d", "#ffffff", "#3d3560", "#f4f2fb"),
  ],
  baby_shower: [
    p("Celeste", "#e8f3fb", "#1e3448", "#6ab4e8", "#5b7386", "#ffffff", "#2f6a9a", "#f0f7fd"),
    p("Rosa bebé", "#fdeaf0", "#4b2a36", "#f2a2bd", "#8b6a76", "#ffffff", "#9c4a68", "#fff2f6"),
    p("Menta", "#e6f6ee", "#1f3d30", "#6cc9a1", "#587a6b", "#ffffff", "#2f7a5c", "#eefaf4"),
    p("Durazno", "#fdece2", "#4a2e20", "#f5a66f", "#8a6a58", "#ffffff", "#9e5426", "#fff3ec"),
    p("Lavanda suave", "#f0ebfa", "#35295a", "#a98be0", "#6d6288", "#ffffff", "#5b4a94", "#f4f0fc"),
    p("Amarillo pastel", "#fff6dc", "#4a3d1a", "#f2c14e", "#857550", "#ffffff", "#8a6a1e", "#fff8e6"),
    p("Gris nube", "#eef0f3", "#2a2f3a", "#8fb3d9", "#666e7d", "#ffffff", "#3a4a66", "#f2f4f8"),
    p("Bosque suave", "#e3efe8", "#22392e", "#7fb59a", "#5a7466", "#ffffff", "#2e5a45", "#eef6f1"),
  ],
  bautizo: [
    p("Blanco puro", "#ffffff", "#2a2a2a", "#c9b27a", "#6f6f6f", "#f6f6f6", "#f4efe4", "#2a2a2a"),
    p("Celeste claro", "#edf5fc", "#1f3347", "#8bbce6", "#5c7286", "#ffffff", "#2d5a85", "#f2f8fd"),
    p("Marfil", "#f8f3ea", "#332c22", "#bfa169", "#77705f", "#ffffff", "#5b4a2f", "#faf6ee"),
    p("Lino", "#f2eee6", "#2e2b26", "#a9a08a", "#6c675c", "#ffffff", "#4a4638", "#f5f2ec"),
    p("Dorado suave", "#fbf6ea", "#3a3120", "#d1b06a", "#7e7256", "#ffffff", "#6b5a2e", "#fcf8ef"),
    p("Rosa suave", "#fcefef", "#4a2c2c", "#e2a9a9", "#8a6767", "#ffffff", "#8f5a5a", "#fff3f3"),
    p("Azul serenidad", "#1d3557", "#f1faee", "#a8dadc", "#c0d3e6", "#2a4a75", "#f1faee", "#1d3557"),
    p("Salvia clara", "#eaf0e8", "#2b3a2f", "#8fae97", "#5f7266", "#ffffff", "#3f5a48", "#eff5ee"),
  ],
  graduacion: [
    p("Marino académico", "#0b1e45", "#ffffff", "#e2b452", "#a9b6d3", "#142b5c", "#f5f1e6", "#0b1e45"),
    p("Grafito", "#1f2328", "#f6f6f6", "#f2a541", "#b4b8bf", "#2c3138", "#f2a541", "#1f2328"),
    p("Vino académico", "#4a1024", "#fbeff2", "#e6b8a2", "#d5aab6", "#5f1a33", "#f8efe4", "#4a1024"),
    p("Verde bosque", "#183a2f", "#f2f8f4", "#c8a951", "#a6c0b3", "#224d3f", "#f2ede0", "#183a2f"),
    p("Blanco y azul", "#f5f8fc", "#132a4a", "#1f4fd8", "#546984", "#ffffff", "#132a4a", "#f5f8fc"),
    p("Arena y negro", "#efe9dd", "#1b1b1b", "#b5893f", "#615a4c", "#faf7f1", "#1b1b1b", "#efe9dd"),
    p("Borgoña", "#5c1b2c", "#fff3f5", "#f0c9a0", "#dcb2bd", "#742538", "#fbf3ea", "#5c1b2c"),
    p("Cielo abierto", "#dfeeff", "#12294a", "#2f6df6", "#4f6588", "#ffffff", "#12294a", "#eaf3ff"),
  ],
  aniversario: [
    p("Plata", "#eeeff2", "#232630", "#8e96a8", "#666b78", "#ffffff", "#2b3040", "#f2f3f6"),
    p("Oro", "#2a2116", "#fbf3e3", "#e0b95c", "#c4b393", "#3a2f22", "#fbf3e3", "#2a2116"),
    p("Rubí", "#5a0e26", "#fff0f4", "#f5b7c8", "#dba9b8", "#75173a", "#fff0f4", "#5a0e26"),
    p("Zafiro", "#0f2a5f", "#eef3ff", "#9db9ff", "#a7b6da", "#183a7a", "#eef3ff", "#0f2a5f"),
    p("Esmeralda", "#0f3d32", "#eefaf4", "#8fd3b3", "#a3c3b5", "#175346", "#eefaf4", "#0f3d32"),
    p("Perla", "#f7f4ef", "#2d2a26", "#b9a48a", "#736c62", "#ffffff", "#4a4036", "#faf7f2"),
    p("Sepia", "#f1e8d8", "#3b2f22", "#9c7a4e", "#7a6a56", "#faf5ec", "#5a4632", "#f6efe3"),
    p("Atardecer", "#3b1f3a", "#fff1e8", "#ff9f68", "#d7b4c6", "#4f2a4d", "#ffe9dc", "#3b1f3a"),
  ],
  despedida: [
    p("Tropical", "#0e3b3a", "#f3fdf9", "#ffcf5c", "#a8d3cf", "#155351", "#ffcf5c", "#0e3b3a"),
    p("Neón rosa", "#1a0f1f", "#ffffff", "#ff4fa3", "#c9b6cf", "#2a1a33", "#ff4fa3", "#1a0f1f"),
    p("Cóctel", "#fff4e0", "#3a2a10", "#ff7a3d", "#7a6a50", "#ffffff", "#b04512", "#fff6ec"),
    p("Playa", "#e8f6fb", "#163a4a", "#2fb5d8", "#557b88", "#ffffff", "#1a6a85", "#eef9fd"),
    p("Champán", "#f6efe3", "#3a2c1c", "#c8a15c", "#7c6a54", "#ffffff", "#5a4630", "#f9f3e8"),
    p("Noche", "#111318", "#f4f4f4", "#ffd166", "#a5a8b3", "#1d2028", "#ffd166", "#111318"),
    p("Menta", "#e6f6ee", "#1f3d30", "#2ec27e", "#587a6b", "#ffffff", "#1f6f4c", "#eefaf4"),
    p("Coral", "#ffe3dd", "#5a2018", "#ff6f61", "#8d5a52", "#ffffff", "#c2453a", "#fff1ee"),
  ],
  fiesta: [
    p("Neón", "#0f0f1a", "#ffffff", "#39ff88", "#b9b9d1", "#1d1d33", "#1d1d33", "#ffffff"),
    p("Disco", "#1c1230", "#fbf7ff", "#ff4fa3", "#c1b3d9", "#2b1c47", "#ff4fa3", "#1c1230"),
    p("Confeti dorado", "#fffaf0", "#2a2216", "#e0b95c", "#7a6f5a", "#ffffff", "#2a2216", "#fffaf0"),
    p("Tropical", "#0e3b3a", "#f3fdf9", "#ffcf5c", "#a8d3cf", "#155351", "#ffcf5c", "#0e3b3a"),
    p("Flúor", "#fdfd96", "#1a1a1a", "#ff3ea5", "#5a5a30", "#ffffff", "#1a1a1a", "#fdfd96"),
    p("Rojo fiesta", "#8b1e2d", "#fff5f5", "#ffd166", "#e6b8bf", "#a52a3b", "#ffd166", "#5a0e18"),
    p("Azul eléctrico", "#0a1f6e", "#ffffff", "#2ce5ff", "#aab6e6", "#12308f", "#2ce5ff", "#0a1f6e"),
    p("Blanco y negro", "#f5f5f5", "#111111", "#ff4f4f", "#5d5d5d", "#ffffff", "#111111", "#f5f5f5"),
  ],
  corporativo: [
    p("Azul corporativo", "#0b1e45", "#ffffff", "#2ce5ff", "#a9b6d3", "#142b5c", "#f4f7fb", "#0b1e45"),
    p("Grafito", "#1f2328", "#f6f6f6", "#4fa3ff", "#b4b8bf", "#2c3138", "#f2f4f7", "#1f2328"),
    p("Blanco y azul", "#f5f8fc", "#132a4a", "#1f4fd8", "#546984", "#ffffff", "#132a4a", "#f5f8fc"),
    p("Pizarra", "#2b3440", "#f2f5f8", "#7fd1b9", "#b6c0cc", "#3a4552", "#f2f5f8", "#2b3440"),
    p("Acero", "#e9edf1", "#1d2430", "#3b6ea5", "#5b6675", "#ffffff", "#1d2430", "#e9edf1"),
    p("Nogal", "#3a2a1e", "#f7f1e8", "#d9a960", "#c8b8a5", "#4b382a", "#f7f1e8", "#3a2a1e"),
    p("Verde institucional", "#123d33", "#f2f8f5", "#8fd3b3", "#a6c4b8", "#1b5347", "#f2f8f5", "#123d33"),
    p("Minimal", "#ffffff", "#111111", "#111111", "#666666", "#f4f4f4", "#111111", "#ffffff"),
  ],
  otro: [
    p("Marino", "#0b1e45", "#ffffff", "#f26b5b", "#a9b6d3", "#142b5c", "#f6f1e7", "#0b1e45"),
    p("Blanco", "#ffffff", "#0f1b33", "#1f4fd8", "#5b6b85", "#f4f7fb", "#0f1b33", "#ffffff"),
    p("Coral suave", "#fdece9", "#5a2018", "#f26b5b", "#8d5a52", "#ffffff", "#b83f33", "#fff1ee"),
    p("Verde", "#12352b", "#f5efe4", "#d9be8c", "#b9c9bf", "#1c4a3c", "#f3ede2", "#12352b"),
    p("Arena", "#efe6d8", "#3a3128", "#a67c52", "#75685a", "#fbf7f0", "#3b4a3a", "#f4efe6"),
    p("Lavanda", "#efe6ff", "#2f1f5a", "#7b4dff", "#6a5a8f", "#ffffff", "#4b2fa8", "#f3edff"),
    p("Noche", "#111318", "#f4f4f4", "#c9a961", "#a5a8b3", "#1d2028", "#1d2028", "#f4f4f4"),
    p("Cielo", "#e6f2ff", "#12294a", "#2f6df6", "#4d648a", "#ffffff", "#1f3f8f", "#eef4ff"),
  ],
};
