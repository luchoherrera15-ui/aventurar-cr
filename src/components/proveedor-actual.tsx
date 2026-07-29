"use client";

import { useEffect } from "react";
import { fijarProveedorActual } from "@/lib/proveedor-actual";

/**
 * No pinta nada: le avisa a la burbuja de chat flotante qué proveedor
 * está viendo la persona, para que el botón abra el chat con ESE
 * negocio y no la bandeja general. Se monta en el portal del
 * proveedor y se limpia solo al salir de la página.
 */
export default function ProveedorActual({
  ranchoId,
  nombre,
}: {
  ranchoId: string;
  nombre: string;
}) {
  useEffect(() => {
    fijarProveedorActual({ ranchoId, nombre });
    return () => fijarProveedorActual(null);
  }, [ranchoId, nombre]);

  return null;
}
