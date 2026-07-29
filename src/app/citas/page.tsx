import type { Metadata } from "next";
import PaginaMantenimiento from "@/components/pagina-mantenimiento";
import { IconClock } from "@/components/icons";

export const metadata: Metadata = {
  title: "Citas",
  description:
    "Reservá tu turno en peluquerías, spas, consultorios y talleres de Costa Rica. Muy pronto en Bookea.",
};

export default function CitasPage() {
  return (
    <PaginaMantenimiento
      breadcrumb="Citas"
      icono={<IconClock />}
      titulo="Citas y turnos"
      descripcion="La sección para reservar hora en peluquerías, spas, consultorios y talleres — elegís el día, la hora y listo, sin llamar a preguntar si hay campo."
      categorias={["Peluquería y belleza", "Spas y bienestar", "Consultorios", "Talleres y clases"]}
    />
  );
}
