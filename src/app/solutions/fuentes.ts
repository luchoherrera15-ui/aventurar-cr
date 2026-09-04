import { Playfair_Display, Poppins, Oswald, Lora, Space_Grotesk } from "next/font/google";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS CARAS DE SOLUTIONS — cargadas una vez, usadas en tres lugares
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (4 sep 2026): «poné más opciones de modificar, tipo
 * fuentes».
 *
 * ── POR QUÉ next/font Y NO UN <link> A GOOGLE ───────────────────────
 * `next/font` descarga la fuente en el BUILD y la sirve desde nuestro
 * propio dominio. Eso da tres cosas que un <link> no da: cero pedidos
 * a un tercero en tiempo de ejecución (la página del negocio no le
 * cuenta a Google quién la visita), cero salto de texto al cargar
 * (Next calcula la métrica de respaldo y ajusta la fuente del sistema
 * para que ocupe lo mismo), y una cara menos que pueda desaparecer si
 * el CDN de un tercero se cae. Es el patrón que ya usa el sitio para
 * Figtree y Cormorant.
 *
 * ── POR QUÉ SE CARGAN LAS SEIS SIEMPRE ──────────────────────────────
 * `next/font` es de build, no de tiempo de ejecución: no se puede
 * "cargar la que eligió este negocio". Así que se declaran todas y el
 * negocio elige cuál APLICA con una variable CSS. El costo real es
 * cero para el visitante: una `@font-face` que ningún elemento usa no
 * se descarga nunca — el navegador solo baja la cara cuando algo la
 * pide. Lo único que viaja siempre son unas líneas de CSS.
 *
 * Cada una trae los pesos que el renderizador usa de verdad (400 para
 * el cuerpo, 700/800 para los titulares). Pedir toda la familia sería
 * multiplicar los archivos por siete sin que nada los use.
 *
 * ── EL CONTRATO CON temas.ts ────────────────────────────────────────
 * Acá se DEFINEN las variables; en `FUENTE[...].cssVar` (temas.ts) se
 * las NOMBRA. Los dos archivos y el CHECK de la 0232 tienen que decir
 * lo mismo — si se agrega una cara, va en los tres lados.
 *
 * ⚠️ Este módulo lo importan solo Server Components (las páginas). No
 * lo importes desde un `"use client"`: `temas.ts` existe justamente
 * para que el lado cliente pueda nombrar las variables sin cargarlas.
 */

const elegante = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--fuente-elegante",
  display: "swap",
});

const redonda = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--fuente-redonda",
  display: "swap",
});

const condensada = Oswald({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--fuente-condensada",
  display: "swap",
});

const editorial = Lora({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--fuente-editorial",
  display: "swap",
});

const tecnica = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--fuente-tecnica",
  display: "swap",
});

/**
 * Las cinco clases juntas, para el envoltorio de la página.
 *
 * Va en UN wrapper y no repartida: cada clase de `next/font` solo
 * DECLARA su variable CSS en el elemento que la lleva, y las variables
 * heredan hacia abajo. Poniéndolas todas en el mismo contenedor, todo
 * lo de adentro puede pedir cualquiera de las seis — que es
 * exactamente lo que necesita la vista previa del panel, donde el
 * negocio cambia de cara y la página se repinta sin recargar.
 *
 * La sexta —«Del sitio»— no está acá porque no hace falta:
 * `--font-figtree` la declara el layout raíz para todo el sitio.
 */
export const CLASES_FUENTES = [
  elegante.variable,
  redonda.variable,
  condensada.variable,
  editorial.variable,
  tecnica.variable,
].join(" ");
