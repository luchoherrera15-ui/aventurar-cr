import type { ReactNode } from "react";
import {
  IconCalendarLine,
  IconChair,
  IconChartBars,
  IconChatBubble,
  IconCheck,
  IconClipboard,
  IconClock,
  IconCompass,
  IconEdit,
  IconFrame,
  IconHeart,
  IconHome,
  IconPlannerCheck,
  IconSearch,
  IconSparkles,
  IconStar,
  IconStore,
  IconTagLine,
  IconUnlock,
  IconUserCircle,
  IconUsers,
  IconWand,
} from "@/components/icons";

/**
 * UN ÍCONO POR MÓDULO, en un solo lugar.
 *
 * El menú lateral y las tarjetas de acceso del tablero pintan la misma
 * lista de módulos: si cada uno eligiera su ícono, el mismo "Equipo"
 * tendría dos caras distintas en la misma pantalla.
 *
 * Todos salen de `src/components/icons.tsx` y ninguno se repite: con el
 * menú completo de un tipo a la vista (doce ítems para un consultorio),
 * dos módulos con el mismo dibujo se leen como el mismo módulo. Cuando
 * no había un ícono obvio se prefirió uno honesto y neutro antes que
 * traer una dependencia de íconos nueva.
 *
 * `inicio` y `config` están acá aunque no sean módulos: son los dos
 * ítems del caparazón y viajan por el mismo camino.
 */
const ICONOS: Record<string, ReactNode> = {
  inicio: <IconHome />,
  agenda: <IconClock />,
  clientes: <IconUsers />,
  servicios: <IconTagLine />,
  equipo: <IconUserCircle />,
  recursos: <IconChair />,
  fichas: <IconPlannerCheck />,
  inventario: <IconStore />,
  expediente: <IconFrame />,
  formularios: <IconCheck />,
  teleconsulta: <IconChatBubble />,
  recetas: <IconClipboard />,
  laboratorio: <IconSearch />,
  pagos: <IconChartBars />,
  comisiones: <IconStar />,
  reportes: <IconCompass />,
  membresias: <IconHeart />,
  clases: <IconCalendarLine />,
  paquetes: <IconWand />,
  checkin: <IconUnlock />,
  marketing: <IconSparkles />,
  config: <IconEdit />,
};

/**
 * El ícono de un ítem del menú. Cae a la brújula de "Reportes" si
 * llegara un id que este deploy no conoce: un hueco en el menú se ve
 * roto, y un ícono genérico no engaña a nadie.
 */
export function iconoModulo(id: string): ReactNode {
  return ICONOS[id] ?? <IconCompass />;
}
