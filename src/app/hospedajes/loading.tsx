import { Bloque, EsqueletoGrilla, EsqueletoHeader } from "../esqueleto";

/**
 * Pantalla de carga de /hospedajes. Mismo motivo que los otros
 * directorios: adelantar el armazón y los preloads de CSS/JS en vez de
 * esperar a que la base conteste para recién empezar a pintar.
 */
export default function CargandoHospedajes() {
  return (
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
      <EsqueletoHeader />
      <section className="pb-16 pt-4">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
          <div className="mb-4 flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Bloque key={i} className="h-10 w-[124px] rounded-xl" />
            ))}
          </div>
          <EsqueletoGrilla cantidad={6} />
        </div>
      </section>
    </div>
  );
}
