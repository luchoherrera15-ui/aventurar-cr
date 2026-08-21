import type { ComponentType } from "react";
import PaseBelleza, { COPY as COPY_BELLEZA } from "./pases/pase-belleza";
import PaseLavacar, { COPY as COPY_LAVACAR } from "./pases/pase-lavacar";
import PaseCourier, { COPY as COPY_COURIER } from "./pases/pase-courier";
import PaseCafeteria, { COPY as COPY_CAFETERIA } from "./pases/pase-cafeteria";

/**
 * EL CATÁLOGO DE LOS CUATRO PASES DEMO — la fuente única de /demo.
 *
 * Junta las dos mitades que hoy viven separadas: el COMPONENTE del pase
 * (lo que se ve, en `./pases/pase-*.tsx`) y los DATOS con los que ese
 * mismo programa está sembrado en la base (`scripts/sembrar-pases-demo.mjs`).
 * Si las dos mitades se desincronizan, el QR lleva a una tarjeta que
 * promete otra regalía que la del dibujo — que es exactamente el
 * ridículo que no se puede hacer en una demo de venta.
 *
 * ⚠️ ESPEJO: `scripts/sembrar-pases-demo.mjs` repite `slug`, `regalia`,
 * `meta`, `colorFondo` y `colorSello` de esta tabla porque un `.mjs`
 * no puede importar TypeScript. Al tocar cualquiera de esos cinco
 * campos hay que tocar los dos archivos y volver a correr el seed.
 *
 * Los cuatro negocios son FICTICIOS y están declarados como tales en la
 * página: nombres, rubros y regalías son utilería de demostración.
 */

/**
 * La forma que tienen los cuatro `COPY`. Los pases la declararon cada
 * uno a su manera (uno con tipo propio, otro con `as const satisfies`),
 * así que acá se pide el mínimo común: `readonly string[]` para las
 * viñetas acepta tanto un `string[]` como la tupla literal del `as const`.
 */
export type CopyPaseDemo = {
  negocio: string;
  rubro: string;
  regalia: string;
  mecanica: string;
  titulo: string;
  parrafo: string;
  bullets: readonly string[];
};

/** El componente de un pase: los cuatro reciben lo mismo. */
export type ComponentePase = ComponentType<{ sellos?: number; meta?: number }>;

export type PaseDemo = {
  id: "belleza" | "lavacar" | "courier" | "cafeteria";
  /** El slug del negocio sembrado: /tarjeta/{slug} instala este pase. */
  slug: string;
  /** Cómo se rotula la industria arriba del box. */
  industria: string;
  copy: CopyPaseDemo;
  Pase: ComponentePase;
  /** Con cuántos sellos se dibuja el pase en la página. */
  sellos: number;
  meta: number;
  /** El color con el que respira el box: sale de la paleta del pase. */
  acento: string;
  /** El fondo del pase, para teñir el panel sin repintar la página. */
  fondo: string;
  /** Lo que se guarda en `programa_lealtad` (espejo del seed). */
  colorFondo: string;
  colorSello: string;
};

export const PASES_DEMO: readonly PaseDemo[] = [
  {
    id: "cafeteria",
    slug: "demo-cafeteria",
    industria: "Cafetería",
    copy: COPY_CAFETERIA,
    Pase: PaseCafeteria,
    sellos: 7,
    meta: 10,
    acento: "#E3B04B",
    fondo: "#24120B",
    colorFondo: "#24120B",
    colorSello: "#E3B04B",
  },
  {
    id: "belleza",
    slug: "demo-belleza",
    industria: "Sala de belleza",
    copy: COPY_BELLEZA,
    Pase: PaseBelleza,
    sellos: 6,
    meta: 10,
    acento: "#FF7FB8",
    fondo: "#4A0E39",
    colorFondo: "#4A0E39",
    colorSello: "#FF4F97",
  },
  {
    id: "lavacar",
    slug: "demo-lavacar",
    industria: "Lavacar",
    copy: COPY_LAVACAR,
    Pase: PaseLavacar,
    sellos: 8,
    meta: 10,
    acento: "#7FF2D8",
    fondo: "#07425F",
    colorFondo: "#07425F",
    colorSello: "#7FF2D8",
  },
  {
    id: "courier",
    slug: "demo-courier",
    industria: "Courier y paquetería",
    copy: COPY_COURIER,
    Pase: PaseCourier,
    sellos: 5,
    meta: 10,
    acento: "#22D3EE",
    fondo: "#0B1526",
    colorFondo: "#0B1526",
    colorSello: "#F7A827",
  },
];
