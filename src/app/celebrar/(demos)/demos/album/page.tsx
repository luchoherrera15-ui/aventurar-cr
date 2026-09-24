import type { Metadata } from "next";
import BarraDemo from "@/components/celebrar/barra-demo";
import AlbumDemo from "@/components/celebrar/demo/album-demo";

export const metadata: Metadata = { title: "Demo · Álbum de la fiesta" };

/** El álbum colaborativo de una celebración, como lo ven los invitados. */
export default function DemoAlbumPage() {
  return (
    <>
      <AlbumDemo />
      <BarraDemo texto="Demo · el álbum de la fiesta" cta="Crear mi celebración" />
    </>
  );
}
