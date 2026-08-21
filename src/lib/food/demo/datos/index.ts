/**
 * EL SET COMPLETO DE LA DEMO — 45 restaurantes ficticios repartidos en
 * 10 cocinas. Cada archivo de cocina es autocontenido; este índice solo
 * agrega y expone búsquedas simples. Los datos son código versionado:
 * el "seed" es este import (idempotente por definición) y el "reset"
 * de una sesión es borrar el localStorage (ver ../estado.ts).
 */
import type { RestauranteDemo } from "../tipos";
import { ITALIANA } from "./italiana";
import { SUSHI } from "./sushi";
import { HAMBURGUESAS } from "./hamburguesas";
import { CARNES } from "./carnes";
import { MEXICANA } from "./mexicana";
import { ASIATICA } from "./asiatica";
import { MEDITERRANEA } from "./mediterranea";
import { CAFE } from "./cafe";
import { INTERNACIONAL } from "./internacional";
import { PIZZA } from "./pizza";

export const RESTAURANTES_DEMO: RestauranteDemo[] = [
  ...ITALIANA,
  ...SUSHI,
  ...HAMBURGUESAS,
  ...CARNES,
  ...MEXICANA,
  ...ASIATICA,
  ...MEDITERRANEA,
  ...CAFE,
  ...INTERNACIONAL,
  ...PIZZA,
];

const POR_SLUG = new Map(RESTAURANTES_DEMO.map((r) => [r.slug, r]));

export function restauranteDemoPorSlug(slug: string): RestauranteDemo | null {
  return POR_SLUG.get(slug) ?? null;
}
