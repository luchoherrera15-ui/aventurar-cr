import type { Metadata } from "next";
import { EncabezadoPanel, EstadoVacio } from "@/components/celebrar/panel/piezas";

export const metadata: Metadata = { title: "Álbumes" };

export default function AlbumesPage() {
  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Álbumes"
        descripcion="Las fotos y videos que suben tus invitados con el QR de la mesa. Vos decidís qué se publica y al final te llevás todo en alta calidad."
      />
      <EstadoVacio
        titulo="Cada celebración trae su álbum"
        texto="Cuando creés una celebración, acá vas a ver su álbum: lo pendiente de aprobar, lo publicado y el espacio que va usando."
      />
    </div>
  );
}
