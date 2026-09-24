import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { PRECIO_A_MEDIDA_CRC, PRECIO_PLANTILLA_CRC, colones } from "@/lib/celebrar/creditos";
import { RUTA } from "@/lib/celebrar/rutas";

const INCLUYE_PLANTILLA = [
  "Todas las plantillas, editables a tu gusto",
  "Tu propio link para compartir por WhatsApp",
  "Confirmación de asistencia y panel de invitados",
  "Animaciones, música, fotos y cuenta regresiva",
  "Crear y probar gratis: pagás solo al publicar",
];

const INCLUYE_PERSONALIZADO = [
  "Nuestro equipo la diseña con tus ideas",
  "Todo lo de la invitación de plantilla",
  "Publicación incluida, sin otro pago",
  "Te escribimos en menos de 24 horas",
];

/**
 * Dos tarjetas de precio: la invitación de plantilla (destacada) y la
 * diseñada a medida (marina). Desde el 24 sep 2026 con la cifra en
 * colones y por invitación (lib/celebrar/creditos.ts): los créditos
 * confundían a la gente y quedaron por dentro.
 */
export default function Precios() {
  return (
    <section
      id="precios"
      aria-labelledby="precios-titulo"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="c-pastilla">Precios</p>
        <h2 id="precios-titulo" className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.1] text-(--c-tinta)">
          Dos formas de empezar
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-(--c-tinta-suave)">
          Editala vos desde una plantilla, o dejá que nuestro equipo la diseñe a tu medida. Un solo pago por invitación.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
        <article className="c-tarjeta relative flex flex-col p-7 lg:p-9" style={{ borderColor: "var(--c-marino)" }}>
          <span className="c-pastilla absolute -top-3 left-7">Más elegido</span>
          <h3 className="text-2xl leading-tight text-(--c-tinta)">Invitación de plantilla</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-(--c-tinta-suave)">
            Elegís una plantilla y la dejás como querés: textos, fotos, colores y música, viendo el
            resultado en vivo. Pagás una sola vez, al publicarla.
          </p>
          <p className="c-montserrat mt-6 text-4xl font-extrabold leading-none text-(--c-tinta)">
            {colones(PRECIO_PLANTILLA_CRC)} <span className="text-[15px] font-semibold text-(--c-tinta-suave)">por invitación</span>
          </p>
          <ul className="mt-6 grid gap-3">
            {INCLUYE_PLANTILLA.map((item) => (
              <Punto key={item}>{item}</Punto>
            ))}
          </ul>
          <div className="mt-auto pt-8">
            <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario w-full">
              Crear mi invitación
            </EnlaceCelebrar>
          </div>
        </article>

        <article className="sobre-oscuro flex flex-col rounded-[var(--c-radio-tarjeta)] bg-(--c-marino) p-7 text-(--c-blanco) lg:p-9">
          <h3 className="text-2xl leading-tight text-(--c-blanco)">Diseñada a medida</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-(--c-sobre-marino-suave)">
            Para la boda o el evento que pide algo único: nuestro equipo arma la invitación con
            ustedes y la deja lista para publicar. Se paga al pedirla.
          </p>
          <p className="c-montserrat mt-6 text-4xl font-extrabold leading-none text-(--c-blanco)">
            {colones(PRECIO_A_MEDIDA_CRC)} <span className="text-[15px] font-semibold text-(--c-sobre-marino-suave)">por invitación</span>
          </p>
          <ul className="mt-6 grid gap-3">
            {INCLUYE_PERSONALIZADO.map((item) => (
              <Punto key={item} claro>
                {item}
              </Punto>
            ))}
          </ul>
          <div className="mt-auto pt-8">
            <EnlaceCelebrar a={`${RUTA.appCrear}?modo=personalizado`} className="c-boton c-boton-claro w-full">
              Pedirla a medida
            </EnlaceCelebrar>
          </div>
        </article>
      </div>
    </section>
  );
}

function Punto({ children, claro = false }: { children: React.ReactNode; claro?: boolean }) {
  return (
    <li className={`flex items-start gap-3 text-[15px] ${claro ? "text-(--c-blanco)" : "text-(--c-tinta)"}`}>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          claro ? "bg-(--c-marino-medio) text-(--c-blanco)" : "bg-(--c-celeste) text-(--c-azul-tinta)"
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="m3.5 8.5 2.8 2.8L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </li>
  );
}
