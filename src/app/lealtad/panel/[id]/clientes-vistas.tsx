"use client";

import { useState, type ReactNode } from "react";

/**
 * EL TOGGLE «MOSTRADOR / AUDITORÍA» dentro de la sección Clientes.
 *
 * Dos formas de mirar a la misma gente, y las dos hacían falta:
 * MOSTRADOR (`LealtadEstado`, ya existía) es la lista rápida para
 * atender a alguien parado enfrente — dar el sello, canjear. AUDITORÍA
 * (`ClientesAuditoria`, nueva) es la vista a fondo que pidió el dueño:
 * filtros a detalle, gasto por persona, tramo del ciclo, y el rescate
 * de quienes dejaron de venir.
 *
 * Van en la MISMA sección y no en dos pestañas del menú porque son la
 * misma pregunta —"¿quiénes son mis clientes?"— con dos respuestas
 * distintas, y separarlas en el menú lateral las alejaría sin motivo.
 *
 * No reusa `TabsLealtad` (el que ya existe en este panel) porque ese
 * está pensado para la franja NAVY oscura del cierre de la página, con
 * fondo blanco/10 y texto blanco — acá el fondo es claro, como el
 * resto de Clientes, y un toggle oscuro se leería como un error de
 * tema, no como una pestaña.
 *
 * `children` llega YA renderizado por el servidor —las dos vistas
 * completas, con sus datos ya resueltos— y este componente solo
 * decide cuál mostrar. Ambas quedan MONTADAS con `hidden`: cambiar de
 * vista no repite ninguna consulta ni pierde el estado de los
 * filtros si la persona vuelve.
 */

export default function ClientesVistas({
  mostrador,
  auditoria,
}: {
  mostrador: ReactNode;
  auditoria: ReactNode;
}) {
  const [vista, setVista] = useState<"mostrador" | "auditoria">("mostrador");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Cómo ver a tus clientes"
        className="inline-flex w-fit gap-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
      >
        <BotonVista
          activo={vista === "mostrador"}
          onClick={() => setVista("mostrador")}
        >
          Mostrador
        </BotonVista>
        <BotonVista
          activo={vista === "auditoria"}
          onClick={() => setVista("auditoria")}
        >
          Auditoría
        </BotonVista>
      </div>

      <div hidden={vista !== "mostrador"}>{mostrador}</div>
      <div hidden={vista !== "auditoria"}>{auditoria}</div>
    </div>
  );
}

function BotonVista({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${
        activo
          ? "bg-white text-aventurea-navy shadow-sm"
          : "text-aventurea-ink-soft hover:text-aventurea-navy"
      }`}
    >
      {children}
    </button>
  );
}
