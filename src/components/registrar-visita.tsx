"use client";

import { useEffect } from "react";

/**
 * No pinta nada: después de que la página del negocio cargó, le avisa a
 * /api/visitas que alguien la está viendo. Se cuenta desde el navegador
 * y no al renderizar en el servidor para dejar afuera a los robots y a
 * las precargas — si no, el número se inflaría solo.
 *
 * Es a prueba de todo: si la ruta falla, si no hay red, si el navegador
 * no soporta `keepalive`, no pasa nada. Un contador no puede romperle
 * la página a nadie.
 */

/**
 * Los negocios que ya se avisaron en esta pestaña. Al navegar dentro
 * del sitio (sin recargar) el efecto se vuelve a montar, y sin esto la
 * misma persona mandaría el aviso varias veces. La base igual cuenta
 * una sola visita por día, pero no hay por qué gastar los pedidos.
 */
const yaAvisados = new Set<string>();

export default function RegistrarVisita({ ranchoId }: { ranchoId: string }) {
  useEffect(() => {
    if (yaAvisados.has(ranchoId)) return;
    yaAvisados.add(ranchoId);

    // `keepalive`: el aviso sobrevive aunque la persona se vaya de la
    // página en el mismo instante. No se espera la respuesta: no hay
    // nada que hacer con ella.
    void fetch("/api/visitas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ranchoId }),
      keepalive: true,
    }).catch(() => {
      // En silencio, a propósito.
    });
  }, [ranchoId]);

  return null;
}
