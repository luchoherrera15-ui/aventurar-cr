import type { Metadata } from "next";
import PaginaMantenimiento from "@/components/pagina-mantenimiento";
import { IconClock } from "@/components/icons";

export const metadata: Metadata = {
  title: "Citas y Reservas",
  description:
    "Reservá tu cita en salones de belleza, barberías, spas y consultorios: elegí el servicio, la hora y con quién. Muy pronto en Bookea.",
};

export default function CitasPage() {
  return (
    <PaginaMantenimiento
      breadcrumb="Citas y Reservas"
      icono={<IconClock />}
      titulo="Citas y Reservas"
      descripcion="La sección para reservar hora en salones de belleza, barberías, spas y consultorios — elegís el servicio, la hora y con quién, sin llamar a preguntar si hay campo."
      categorias={["Belleza", "Barbería", "Uñas", "Spa y bienestar", "Consultorios"]}
    />
  );
}
