import type { TipoCelebracionId } from "@/lib/celebrar/marca";
import {
  IconoAniversario,
  IconoBaby,
  IconoBautizo,
  IconoBoda,
  IconoCorporativo,
  IconoCumple,
  IconoDespedida,
  IconoFiesta,
  IconoGraduacion,
  IconoOtro,
  IconoXv,
} from "./iconos-celebrar";

type Icono = (p: { className?: string }) => React.JSX.Element;

/** El ícono de cada tipo de celebración, para la portada y el asistente. */
export const ICONO_TIPO: Record<TipoCelebracionId, Icono> = {
  boda: IconoBoda,
  cumpleanos: IconoCumple,
  xv: IconoXv,
  baby_shower: IconoBaby,
  bautizo: IconoBautizo,
  graduacion: IconoGraduacion,
  aniversario: IconoAniversario,
  despedida: IconoDespedida,
  fiesta: IconoFiesta,
  corporativo: IconoCorporativo,
  otro: IconoOtro,
};
