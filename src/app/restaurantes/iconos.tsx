import {
  IconCafe,
  IconCajaComida,
  IconCuencoPalillos,
  IconGorroChef,
  IconHamburguesa,
  IconHelado,
  IconHoja,
  IconJarraCerveza,
  IconLimon,
  IconOliva,
  IconOlla,
  IconParrilla,
  IconPasta,
  IconPez,
  IconPizza,
  IconSushi,
  IconTaco,
  IconUtensils,
} from "@/components/icons";
import type { CategoriaRestaurante } from "./tipos";

/**
 * El ícono de cada tipo de comida, igual que CATEGORIA_ICONO hace con
 * los de Eventos. Vive aparte de tipos.ts porque ese archivo es .ts y
 * no puede llevar JSX.
 */
export const CATEGORIA_RESTAURANTE_ICONO: Record<
  CategoriaRestaurante,
  React.ReactNode
> = {
  tipica: <IconOlla />,
  carnes: <IconParrilla />,
  mariscos: <IconPez />,
  pastas: <IconPasta />,
  pizza: <IconPizza />,
  hamburguesas: <IconHamburguesa />,
  china: <IconCajaComida />,
  japonesa: <IconSushi />,
  coreana: <IconCuencoPalillos />,
  mexicana: <IconTaco />,
  peruana: <IconLimon />,
  mediterranea: <IconOliva />,
  vegetariana: <IconHoja />,
  cafeteria: <IconCafe />,
  postres: <IconHelado />,
  bar: <IconJarraCerveza />,
  fusion: <IconGorroChef />,
  otros: <IconUtensils />,
};
