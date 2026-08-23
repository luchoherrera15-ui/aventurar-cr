import type { ReactNode } from "react";
import TabsContenido from "./tabs-contenido";

/**
 * EL TOGGLE «MOSTRADOR / AUDITORÍA / ACTIVIDAD» dentro de la sección
 * Clientes.
 *
 * Tres formas de mirar a la misma gente, y las tres hacían falta:
 * MOSTRADOR (`LealtadEstado`) es la lista rápida para atender a alguien
 * parado enfrente — dar el sello, canjear. AUDITORÍA (`ClientesAuditoria`)
 * es la vista a fondo que pidió el dueño: filtros a detalle, gasto por
 * persona, tramo del ciclo, y el rescate de quienes dejaron de venir.
 * ACTIVIDAD (0163) es el libro de movimientos — quién hizo qué y
 * cuándo, movimiento por movimiento — que antes vivía como su propio
 * ítem del menú lateral; se mudó acá porque es la MISMA pregunta que
 * Auditoría («¿qué pasó con mis clientes?»), solo que respondida como
 * bitácora en vez de como segmento.
 *
 * Van en la MISMA sección y no en tres pestañas del menú porque
 * separarlas alejaría preguntas que son, en el fondo, una sola.
 *
 * `children` llega YA renderizado por el servidor — las tres vistas
 * completas, con sus datos ya resueltos. Por dentro usa `TabsContenido`,
 * el switcher genérico del panel (Métricas y Configuración lo comparten).
 */

export default function ClientesVistas({
  mostrador,
  auditoria,
  actividad,
}: {
  mostrador: ReactNode;
  auditoria: ReactNode;
  /** El libro de movimientos. `null` = quien mira no tiene ese permiso —
   *  la pestaña ni se ofrece, en vez de mostrarse y fallar adentro. */
  actividad: ReactNode | null;
}) {
  return (
    <TabsContenido
      etiquetaGrupo="Cómo ver a tus clientes"
      pestanas={[
        { id: "mostrador", etiqueta: "Mostrador", contenido: mostrador },
        { id: "auditoria", etiqueta: "Auditoría", contenido: auditoria },
        ...(actividad ? [{ id: "actividad", etiqueta: "Actividad", contenido: actividad }] : []),
      ]}
    />
  );
}
