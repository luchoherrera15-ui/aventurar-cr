import type { Metadata } from "next";
import { EncabezadoPanel, EstadoVacio } from "@/components/celebrar/panel/piezas";

export const metadata: Metadata = { title: "Videos" };

export default function VideosPage() {
  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Videos"
        descripcion="Un video corto con sus fotos para anunciar la fecha o abrir la invitación. Primero con plantilla; después, con movimiento generado por IA."
      />
      <EstadoVacio
        titulo="Los videos se arman desde una celebración"
        texto="Elegís las fotos y la música, ves cuántos créditos cuesta, y el video se genera en segundo plano. Acá vas a seguir cada uno: en cola, listo o con algún problema."
      />
    </div>
  );
}
