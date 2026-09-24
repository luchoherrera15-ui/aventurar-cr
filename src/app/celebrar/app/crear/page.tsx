import type { Metadata } from "next";
import { EncabezadoPanel } from "@/components/celebrar/panel/piezas";
import AsistenteCrear from "./asistente-crear";

export const metadata: Metadata = { title: "Crear celebración" };

/**
 * El asistente de creación (pasos 1 y 2 acá; 3 a 7 en la ficha de la
 * celebración). `?tipo=boda` llega desde las tarjetas de la portada;
 * `?modo=personalizado` desde «Pedir una propuesta» en Precios.
 */
export default async function CrearPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; modo?: string; plantilla?: string }>;
}) {
  const { tipo, modo, plantilla } = await searchParams;
  const personalizado = modo === "personalizado";

  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo={personalizado ? "Pedir un diseño personalizado" : "Crear celebración"}
        descripcion={
          personalizado
            ? "Contanos qué celebran y un diseñador arma la invitación con ustedes. Empezamos igual: el tipo de celebración y los datos básicos."
            : "Siete pasos cortos. Podés guardar a medias y seguir después; nada se publica hasta que lo decidás."
        }
      />
      <AsistenteCrear tipoInicial={tipo} personalizado={personalizado} plantilla={plantilla} />
    </div>
  );
}
