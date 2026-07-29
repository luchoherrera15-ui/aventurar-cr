import type { Metadata } from "next";
import PaginaMantenimiento from "@/components/pagina-mantenimiento";
import { IconHouse } from "@/components/icons";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "Casas, villas, hoteles, restaurantes y aventuras en todo Costa Rica. Muy pronto en Bookea.",
};

export default function BookingPage() {
  return (
    <PaginaMantenimiento
      breadcrumb="Booking"
      icono={<IconHouse />}
      titulo="Alojamiento y experiencias"
      descripcion="Dónde quedarte, dónde comer y qué vivir en todo el país — la sección de escapadas y experiencias de Bookea, para reservar directo con quien te recibe."
      categorias={["Casas y villas", "Hoteles", "Restaurantes", "Aventuras"]}
    />
  );
}
