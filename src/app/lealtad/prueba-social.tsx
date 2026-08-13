/**
 * LA FRANJA DE PRUEBA SOCIAL, debajo del mockup.
 *
 * ------------------------------------------------------------------
 * POR QUÉ LOS AVATARES SON DIBUJADOS Y NO FOTOS
 * ------------------------------------------------------------------
 * La referencia que se copió usa fotos de personas. Acá no, por dos
 * razones que pesan más que el parecido:
 *
 *   · Fotos de gente real bajadas de internet para dar a entender que
 *     son clientes es usar la imagen de alguien sin su permiso. Es un
 *     problema legal, no un detalle.
 *   · Y son reconocibles. El día que un visitante encuentre esa misma
 *     cara en un banco de imágenes, la franja deja de sumar confianza
 *     y pasa a restarla — junto con todo lo demás que diga la página.
 *
 * Dibujados no engañan a nadie: se leen como lo que son, un símbolo de
 * "gente", igual que un icono. Y pesan cero bytes de red.
 *
 * ------------------------------------------------------------------
 * EL NÚMERO TIENE QUE SER VERDAD
 * ------------------------------------------------------------------
 * `cantidad` entra por props y la página lo saca de la base. No hay un
 * número escrito acá adentro a propósito: una cifra inventada en la
 * portada es la clase de cosa que nadie audita hasta que un cliente
 * pregunta «¿cuáles 25?» y no hay respuesta.
 *
 * Si todavía no hay suficientes negocios como para que el número
 * impresione, la salida honesta es cambiar el TEXTO —hablar de lo que
 * el producto hace en vez de a cuántos— y no inflar la cifra.
 */

const NARANJA = "#ee7420";

/**
 * Seis siluetas con distinto tono y forma. No representan a nadie:
 * son el equivalente visual de «varias personas».
 *
 * Los tonos salen de una lista fija y no de un azar, para que el
 * servidor y el cliente pinten lo mismo y React no tire hydration
 * mismatch.
 */
const CARAS = [
  { fondo: "#8a5a33", tono: "#e8c9a8" },
  { fondo: "#1f6b4a", tono: "#cfe8d8" },
  { fondo: "#2c4a80", tono: "#cddcf5" },
  { fondo: "#a8321f", tono: "#f3cdc3" },
  { fondo: "#5b3a7a", tono: "#ded0ee" },
] as const;

function Silueta({ i }: { i: number }) {
  const c = CARAS[i % CARAS.length];
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full ring-2"
      style={{ background: c.fondo, boxShadow: "0 0 0 2px #0a1226" }}
    >
      <svg viewBox="0 0 36 36" className="h-full w-full">
        {/* Cabeza y hombros. Las proporciones cambian un poco con el
            índice para que las cinco no se lean como la misma persona
            repetida cinco veces. */}
        <circle cx="18" cy={13 + (i % 3)} r={6.5 - (i % 2) * 0.6} fill={c.tono} />
        <path
          d={`M4 36 C4 ${27 - (i % 3)} 10 23 18 23 C26 23 32 ${27 - (i % 3)} 32 36 Z`}
          fill={c.tono}
        />
      </svg>
    </span>
  );
}

export default function PruebaSocial({
  cantidad,
  /** Qué se dice del número. Cambia según cuántos haya de verdad. */
  titulo,
  bajada,
}: {
  cantidad: number;
  titulo: string;
  bajada: string;
}) {
  // Nunca más caras que negocios: cinco siluetas sobre «3 negocios» se
  // lee como que sobran dos, y es lo primero que delata un adorno.
  const caras = Math.max(1, Math.min(CARAS.length, cantidad));

  return (
    <div
      data-reveal
      className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 lg:justify-start"
    >
      <span className="flex -space-x-2.5">
        {Array.from({ length: caras }, (_, i) => (
          <Silueta key={i} i={i} />
        ))}
      </span>

      <span className="min-w-0">
        <span className="block text-[14px] font-extrabold leading-snug text-white">
          {titulo}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-white/55">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" style={{ color: NARANJA }} aria-hidden>
            <path
              fill="currentColor"
              d="M3 7l4.5 3L12 4l4.5 6L21 7l-1.8 10H4.8L3 7zm2.4 12h13.2v2H5.4v-2z"
            />
          </svg>
          {bajada}
        </span>
      </span>
    </div>
  );
}
