import type { Metadata } from "next";
import PaginaMantenimiento from "@/components/pagina-mantenimiento";
import { IconHouse } from "@/components/icons";

export const metadata: Metadata = {
  title: "Hospedajes",
  description:
    "Casas, villas, hoteles y experiencias para tu próxima escapada. Muy pronto en Bookea.",
};

export default function BookingPage() {
  return (
    <PaginaMantenimiento
      breadcrumb="Hospedajes"
      icono={<IconHouse />}
      titulo="Hospedajes y experiencias"
      descripcion="Dónde quedarte, dónde comer y qué vivir en tu próxima escapada — reservá directo con quien te recibe, sin intermediarios."
      categorias={["Casas y villas", "Hoteles", "Restaurantes", "Experiencias"]}
    />
  );
}
