import { FUNCIONES, MARCA, TIPOS_EN_PORTADA } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";
import { SITIO } from "@/lib/sitio";
import MarcaCelebrar from "./marca-celebrar";
import { EnlaceCelebrar } from "./rutas-cliente";

const enlace =
  "text-[14px] text-(--c-sobre-marino-suave) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) hover:text-(--c-blanco)";

/**
 * El pie: marino profundo, la marca y el lema a la izquierda, tres
 * columnas de links. Términos, privacidad y ayuda son del operador y
 * viven en Bookea: van con URL absoluta para que funcionen también
 * desde celebrar.lat, donde `/terminos` no existe.
 */
export default function PieCelebrar() {
  const anio = new Date().getFullYear();
  return (
    <footer className="sobre-oscuro mt-auto bg-(--c-marino-profundo) text-(--c-blanco)">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-8 lg:px-8 lg:py-20">
        <div className="max-w-sm">
          <MarcaCelebrar tono="claro" tamano="lg" />
          <p className="c-montserrat mt-6 text-lg font-semibold leading-snug text-(--c-blanco)">
            {MARCA.lema}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">
            Invitaciones digitales, confirmación de asistencia, álbum compartido, video y una
            página de recuerdos. Hecho en Costa Rica.
          </p>
        </div>

        <ColumnaPie titulo="Producto">
          {FUNCIONES.map((f) => (
            <li key={f.id}>
              <EnlaceCelebrar a={`/#${f.id}`} className={enlace}>
                {f.nombre}
              </EnlaceCelebrar>
            </li>
          ))}
        </ColumnaPie>

        <ColumnaPie titulo="Celebraciones">
          {TIPOS_EN_PORTADA.map((t) => (
            <li key={t.id}>
              <EnlaceCelebrar a={`${RUTA.appCrear}?tipo=${t.id}`} className={enlace}>
                {t.plural}
              </EnlaceCelebrar>
            </li>
          ))}
        </ColumnaPie>

        <ColumnaPie titulo="Cuenta">
          <li>
            <EnlaceCelebrar a={RUTA.entrar} className={enlace}>
              Entrar
            </EnlaceCelebrar>
          </li>
          <li>
            <EnlaceCelebrar a={RUTA.appCrear} className={enlace}>
              Crear mi invitación
            </EnlaceCelebrar>
          </li>
          <li>
            <EnlaceCelebrar a={RUTA.app} className={enlace}>
              Mi panel
            </EnlaceCelebrar>
          </li>
          <li>
            <EnlaceCelebrar a={RUTA.appCreditos} className={enlace}>
              Precios y pagos
            </EnlaceCelebrar>
          </li>
          <li>
            <EnlaceCelebrar a={RUTA.plantillas} className={enlace}>
              Plantillas
            </EnlaceCelebrar>
          </li>
        </ColumnaPie>
      </div>

      <div className="border-t border-(--c-marino-medio)">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-[13px] text-(--c-sobre-marino-suave) sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {anio} {MARCA.dominio}. Un producto de {MARCA.operador}.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <a href={`${SITIO}/terminos`} className={enlace}>
                Términos
              </a>
            </li>
            <li>
              <a href={`${SITIO}/privacidad`} className={enlace}>
                Privacidad
              </a>
            </li>
            <li>
              <a href={`${SITIO}/ayuda`} className={enlace}>
                Ayuda
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function ColumnaPie({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-5 text-[13px] font-bold uppercase tracking-[0.08em] text-(--c-blanco)">
        {titulo}
      </h2>
      <ul className="grid gap-3">{children}</ul>
    </div>
  );
}
