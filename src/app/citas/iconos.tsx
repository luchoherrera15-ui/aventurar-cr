import {
  IconEsmalte,
  IconEstetoscopio,
  IconLoto,
  IconPosteBarbero,
  IconTijeras,
  IconWand,
} from "@/components/icons";
import { CATEGORIAS_CITAS, type CategoriaCita } from "./tipos";

/**
 * El ícono de cada rubro de Citas, igual que CATEGORIA_ICONO hace con
 * los de Eventos. Vive aparte de tipos.ts porque ese archivo es .ts y
 * no puede llevar JSX.
 */
export const CATEGORIA_CITA_ICONO: Record<CategoriaCita, React.ReactNode> = {
  belleza: <IconTijeras />,
  barberia: <IconPosteBarbero />,
  unas: <IconEsmalte />,
  spa: <IconLoto />,
  consultorio: <IconEstetoscopio />,
  otros: <IconWand />,
};

/** El orden en que salen en la barra: el oficial. */
export const ORDEN_CITAS = CATEGORIAS_CITAS;
