"use client";

import type { ReactNode } from "react";
import { abrirChatConNegocio } from "@/lib/chat-panel";

/**
 * "Consultar", "Escribinos", "Reservar mesa"... — todo lo que antes
 * mandaba a /mensajes/consulta/{id} (una pantalla de chat aparte).
 * Ahora abre la burbuja de chat de la propia página, ya parada en el
 * hilo con ESE negocio: no se pierde dónde estaba la persona.
 *
 * Es un <button> y no un <Link> a propósito: no hay navegación. La
 * ruta /mensajes/consulta/{id} sigue viva para los links viejos
 * (correos ya mandados, la app) — solo que ya nadie del sitio la usa.
 *
 * Quien no tiene cuenta también puede escribir: el panel abre una
 * sesión anónima al vuelo, igual que la burbuja de siempre.
 */
export default function BotonConsultar({
  ranchoId,
  nombre,
  className,
  children,
}: {
  ranchoId: string;
  nombre: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => abrirChatConNegocio({ ranchoId, nombre })}
      className={className}
    >
      {children}
    </button>
  );
}
