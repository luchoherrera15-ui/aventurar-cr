import Link from "next/link";
import { PUERTAS } from "@/components/nav/taxonomia-navegacion";
import { leerCenso, puertaConInventario } from "@/lib/censo-rubros";
import type { Puerta } from "@/components/nav/taxonomia-navegacion";

/**
 * ════════════════════════════════════════════════════════════════════
 *  «EXPLORÁ BOOKEA» — las cinco puertas, en grande
 * ════════════════════════════════════════════════════════════════════
 *
 * Es la versión respirada del mega menú: quien no tocó el header se
 * encuentra las mismas cinco puertas al bajar, con espacio y una frase
 * que dice qué hay detrás de cada una.
 *
 * ── SE MUESTRAN LAS CINCO, SIEMPRE ──────────────────────────────────
 *
 * A diferencia del mega menú —que esconde la puerta sin negocios porque
 * ahí cada línea es un enlace que promete una lista— acá las cinco se
 * quedan. Son dos preguntas distintas:
 *
 *   · el menú contesta «¿a dónde puedo ir AHORA?»;
 *   · esta sección contesta «¿qué ES Bookea?».
 *
 * Y la respuesta a la segunda no cambia porque todavía no haya entrado
 * la primera villa. Lo que sí cambia es el pie de cada card: con
 * negocios dice cuántos, y sin negocios invita a publicar en vez de
 * prometer un catálogo que no está. Nunca inventa una cifra.
 */

/** Qué hay detrás de cada puerta, en una línea. */
const BAJADA: Record<string, string> = {
  citas: "Belleza, bienestar, salud y fitness",
  eventos: "Bodas, fiestas y celebraciones",
  hospedaje: "Hoteles, villas, cabinas y glamping",
  experiencias: "Tours, aventura y naturaleza",
  servicios: "Mascotas, hogar, automotriz y más",
};

/**
 * El acento de cada card. Naranja de marca con transparencia, no siete
 * colores nuevos: el pedido fue que el naranja apareciera en los
 * detalles y que el fondo respirara.
 */
const TINTE: Record<string, string> = {
  citas: "rgba(238,116,32,0.10)",
  eventos: "rgba(22,41,94,0.08)",
  hospedaje: "rgba(250,200,112,0.16)",
  experiencias: "rgba(255,150,80,0.12)",
  servicios: "rgba(22,41,94,0.06)",
};

export default async function ExploraBookea() {
  const censo = await leerCenso();

  /**
   * ── POR QUÉ ACÁ NO SE CUENTAN NEGOCIOS ──────────────────────────
   *
   * La primera versión de esta card decía «3 negocios», sumando lo que
   * el censo tiene detrás de cada columna. Estaba MAL, y de un modo que
   * solo se ve mirando cómo se arma el censo: ahí un mismo negocio suma
   * en las TRES claves que lo contienen —su vertical, su categoría y su
   * rubro exacto—, así que sumar columnas cuenta a la misma barbería dos
   * y hasta tres veces. Y una puerta como SERVICIOS, que es una lente
   * sobre dos verticales, no se puede contar por vertical tampoco.
   *
   * Contar bien pediría los ids de los negocios, o sea otra consulta,
   * para una cifra que en esta card no decide nada. Así que la card
   * contesta la pregunta que sí le toca —¿hay algo detrás de esta
   * puerta?— con la MISMA función que decide el mega menú del header.
   * Una sola fuente de verdad: es imposible que el menú muestre Citas y
   * esta card diga que está vacía.
   */
  const tieneAlgo = (puerta: Puerta) => puertaConInventario(puerta, censo) !== null;

  return (
    <section>
      <div className="mb-7">
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-bookea-naranja-fuerte">
          Explorá Bookea
        </p>
        <h2 className="titulo mt-1.5 text-[clamp(24px,3.2vw,34px)] leading-tight text-[color:var(--navy)]">
          Todo lo que se puede reservar
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PUERTAS.map((puerta) => {
          const disponible = tieneAlgo(puerta);
          return (
            <Link
              key={puerta.id}
              href={puerta.ruta}
              className="elevar group flex flex-col justify-between overflow-hidden rounded-3xl border border-aventurea-line bg-white p-6"
            >
              <div>
                <span
                  aria-hidden
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: TINTE[puerta.id] }}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--orange)]" />
                </span>
                <h3 className="titulo text-[20px] text-[color:var(--navy)]">{puerta.label}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-aventurea-ink-soft">
                  {BAJADA[puerta.id] ?? ""}
                </p>
              </div>

              <p
                className={`mt-6 flex items-center gap-1.5 text-[13.5px] font-extrabold ${
                  disponible ? "text-[color:var(--navy)]" : "text-bookea-naranja-fuerte"
                }`}
              >
                {/* Vacío NO se escribe «0 negocios»: se invita. Con el
                    directorio recién arrancando, una puerta sin oferta
                    es una oportunidad de captarla, no una decepción. */}
                {disponible ? "Explorar" : "Sé el primero acá"}
                <span
                  aria-hidden
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
