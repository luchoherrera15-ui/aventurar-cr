import "./mockup-recorrido.css";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * MOCKUP 2 — cómo se registra una visita, en tres estaciones.
 *
 * Server Component: no hace falta estado ni interacción, así que no
 * hay razón para pagar el JavaScript de un Client Component. Toda la
 * animación es CSS (ver mockup-recorrido.css), incluida la parte que
 * la vuelve responsive: hay DOS trazados —uno horizontal para
 * escritorio, uno vertical para el teléfono— y `hidden md:flex` /
 * `md:hidden` deciden cuál se pinta, no JavaScript.
 */

/* Dos papeles, y ahí está toda la idea del acento: el RECORRIDO —los
   tres aros, que son el elemento dominante de la sección— va en azul,
   y el naranja queda para el punto que dice DÓNDE VA LA ACCIÓN ahora.
   Con los dos naranjas la sección entera se leía naranja.
   La sección es clara, así que el acento usa su gemelo oscuro: el del
   logo da 2,35:1 sobre blanco. */
const ACCION = "var(--accion)";
const ACENTO = "var(--orange-acento-claro)";
/* El halo del punto sale del MISMO token y no de un rgba copiado: el
   día que el acento cambie, el halo lo sigue solo. */
const HALO = `color-mix(in srgb, ${ACENTO} 18%, transparent)`;

const ESTACIONES: { icono: NombreIcono; titulo: string; texto: string }[] = [
  { icono: "escanear", titulo: "Escaneás", texto: "El código del cliente, desde el panel." },
  { icono: "listo", titulo: "Se confirma", texto: "El servidor valida el canje al instante." },
  { icono: "movil", titulo: "Su pase se actualiza", texto: "El sello o el saldo quedan puestos." },
];

export default function MockupRecorrido() {
  return (
    <div
      className="rounded-3xl border p-6 sm:p-9"
      style={{ background: "rgba(6,38,83,.03)", borderColor: "rgba(6,38,83,.1)" }}
    >
      {/* ── Trazado horizontal (md+) ─────────────────────────────── */}
      <div className="relative hidden md:flex md:items-start md:justify-between">
        <span
          aria-hidden
          className="absolute left-0 right-0 top-6 h-[2px]"
          style={{ background: "rgba(6,38,83,.12)" }}
        />
        <span
          aria-hidden
          className="mr-anim-punto-h absolute top-[19px] h-3 w-3 -translate-x-1/2 rounded-full"
          style={{ background: ACENTO, boxShadow: `0 0 0 4px ${HALO}` }}
        />
        {ESTACIONES.map((e, i) => (
          <Estacion key={e.titulo} {...e} delay={i * (7 / 3)} />
        ))}
      </div>

      {/* ── Trazado vertical (móvil) ─────────────────────────────── */}
      <div className="relative flex flex-col gap-8 md:hidden">
        <span
          aria-hidden
          className="absolute bottom-6 left-6 top-6 w-[2px]"
          style={{ background: "rgba(6,38,83,.12)" }}
        />
        <span
          aria-hidden
          className="mr-anim-punto-v absolute left-[19px] h-3 w-3 -translate-y-1/2 rounded-full"
          style={{ background: ACENTO, boxShadow: `0 0 0 4px ${HALO}` }}
        />
        {ESTACIONES.map((e, i) => (
          <Estacion key={e.titulo} {...e} delay={i * (7 / 3)} vertical />
        ))}
      </div>
    </div>
  );
}

function Estacion({
  icono,
  titulo,
  texto,
  delay,
  vertical = false,
}: {
  icono: NombreIcono;
  titulo: string;
  texto: string;
  delay: number;
  vertical?: boolean;
}) {
  return (
    <div className={vertical ? "relative flex items-start gap-4 pl-0" : "relative w-[30%] text-center"}>
      <span
        aria-hidden
        className="mr-anim-estacion relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 bg-white"
        style={{ borderColor: ACCION, color: ACCION, "--mr-delay": `${delay}s` } as React.CSSProperties}
      >
        <Icono nombre={icono} className="h-5 w-5" />
      </span>
      <div className={vertical ? "pt-1.5" : "mt-3"}>
        <p className="text-[13.5px] font-extrabold text-aventurea-navy">{titulo}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">{texto}</p>
      </div>
    </div>
  );
}
