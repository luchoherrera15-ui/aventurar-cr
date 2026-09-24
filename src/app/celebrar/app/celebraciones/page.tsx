import type { Metadata } from "next";
import { EncabezadoPanel, EstadoVacio } from "@/components/celebrar/panel/piezas";
import TarjetaCelebracion from "@/components/celebrar/panel/tarjeta-celebracion";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { misCelebraciones } from "@/lib/celebrar/datos";
import { RUTA } from "@/lib/celebrar/rutas";

export const metadata: Metadata = { title: "Mis celebraciones" };

/**
 * La lista de celebraciones de la persona (RLS: solo las suyas). Las
 * archivadas van al final, apagadas; el resto en orden de creación.
 */
export default async function CelebracionesPage() {
  const todas = await misCelebraciones();
  const activas = todas.filter((c) => c.estado !== "archivada");
  const archivadas = todas.filter((c) => c.estado === "archivada");

  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Mis celebraciones"
        descripcion="Cada celebración es una página propia: su invitación, sus invitados, su álbum y, después, sus recuerdos."
        accion={
          <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario">
            Crear celebración
          </EnlaceCelebrar>
        }
      />

      {todas.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no tenés celebraciones"
          texto="Empezá con lo básico: qué celebran, cuándo y dónde. El diseño, los invitados y el álbum se van sumando a esa misma celebración."
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activas.map((c) => (
              <TarjetaCelebracion key={c.id} c={c} />
            ))}
          </ul>
          {archivadas.length > 0 && (
            <section>
              <h2 className="c-montserrat text-[13px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">
                Archivadas
              </h2>
              <ul className="mt-4 grid gap-4 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
                {archivadas.map((c) => (
                  <TarjetaCelebracion key={c.id} c={c} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
