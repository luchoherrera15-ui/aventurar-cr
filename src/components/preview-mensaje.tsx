"use client";

import { PREFIJO_ASISTENTE } from "@/lib/asistente-prefijo";
import { IconSparkles } from "@/components/icons";

/**
 * El último mensaje de una conversación, en las listas de chat.
 *
 * Los mensajes del asistente vienen marcados con `PREFIJO_ASISTENTE`
 * en la base (una sola fuente para web y app). En la burbuja del hilo
 * ese marcador ya se muestra como ícono; acá se hace lo mismo, para
 * que la vista previa no delate el emoji crudo.
 *
 * Solo se reemplaza el marcador cuando abre el texto — con o sin el
 * "Vos: " que anteponen las listas. Un 💎 que la persona haya escrito
 * a mitad de su mensaje se respeta tal cual.
 */
export default function PreviewMensaje({
  texto,
  className,
}: {
  texto: string;
  className?: string;
}) {
  for (const antes of ["", "Vos: "]) {
    const marca = antes + PREFIJO_ASISTENTE;
    if (!texto.startsWith(marca)) continue;
    return (
      <span className={className}>
        {antes}
        <IconSparkles className="inline h-3.5 w-3.5 shrink-0 align-[-2px] text-aventurea-orange" />{" "}
        {texto.slice(marca.length)}
      </span>
    );
  }
  return <span className={className}>{texto}</span>;
}
