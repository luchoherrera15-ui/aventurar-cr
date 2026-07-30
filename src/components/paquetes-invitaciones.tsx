import { IconCheck } from "@/components/icons";
import { pedirPaquete } from "@/app/invitaciones/actions";
import {
  PAQUETES_INVITACIONES,
  precioPaquete,
  type PaqueteInvitacion,
} from "@/lib/paquetes-invitaciones";

/**
 * Las tres price cards de Invitaciones Digitales, en el bento de la
 * marca: la del medio ("El favorito") va en navy sólido y las otras en
 * blanco con borde. Cada botón dispara la server action que abre el
 * pedido por chat con el negocio de Invitaciones de Bookea.
 *
 * `disposicion`: "fila" (3 columnas en pantallas anchas — la landing)
 * o "pila" (una debajo de otra — el espacio angosto de /cuenta).
 */
export default function PaquetesInvitaciones({
  titulo = "Elegí tu paquete",
  intro = "Precio único por evento, sin mensualidades: nos contás tu idea por el chat y te la entregamos lista para compartir.",
  disposicion = "fila",
}: {
  titulo?: string;
  intro?: string;
  disposicion?: "fila" | "pila";
}) {
  return (
    <section>
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-orange">
          Paquetes
        </p>
        <h2 className="titulo mx-auto mt-2 max-w-[24ch] text-[clamp(22px,3.5vw,30px)] text-aventurea-ink">
          {titulo}
        </h2>
        <p className="mx-auto mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
          {intro}
        </p>
      </div>

      <div
        className={
          disposicion === "fila"
            ? "mt-8 grid items-stretch gap-5 md:grid-cols-3"
            : "mt-8 grid gap-5"
        }
      >
        {PAQUETES_INVITACIONES.map((p) => (
          <CardPaquete key={p.id} paquete={p} />
        ))}
      </div>
    </section>
  );
}

/** Una price card; la destacada vive en navy y las demás en blanco. */
function CardPaquete({ paquete }: { paquete: PaqueteInvitacion }) {
  const { destacado } = paquete;
  return (
    <div
      className={
        destacado
          ? "relative flex flex-col rounded-[24px] bg-aventurea-navy p-7 text-white shadow-[0_24px_60px_-24px_rgba(16,26,44,0.55)] md:-translate-y-2"
          : "relative flex flex-col rounded-[24px] border border-aventurea-line bg-white p-7 shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)]"
      }
    >
      <span
        className={
          destacado
            ? "inline-flex w-fit items-center rounded-full bg-aventurea-orange px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white"
            : "inline-flex w-fit items-center rounded-full bg-aventurea-orange/10 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange"
        }
      >
        {paquete.badge}
      </span>

      <h3
        className={`titulo mt-4 text-[22px] ${
          destacado ? "text-white" : "text-aventurea-ink"
        }`}
      >
        {paquete.nombre}
      </h3>
      <p
        className={`mt-1 text-[26px] font-extrabold tracking-[-0.5px] ${
          destacado ? "text-white" : "text-aventurea-ink"
        }`}
      >
        {precioPaquete(paquete.precio)}
        <span
          className={`ml-1.5 text-[12.5px] font-semibold ${
            destacado ? "text-white/60" : "text-aventurea-ink-soft"
          }`}
        >
          por evento
        </span>
      </p>
      <p
        className={`mt-2 text-[13px] leading-relaxed ${
          destacado ? "text-white/75" : "text-aventurea-ink-soft"
        }`}
      >
        {paquete.lema}
      </p>

      <ul className="mt-4 grid gap-2.5">
        {paquete.incluye.map((linea) => (
          <li
            key={linea}
            className={`flex items-start gap-2 text-[13.5px] leading-snug ${
              destacado ? "text-white/90" : "text-aventurea-ink"
            }`}
          >
            <IconCheck
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                destacado ? "text-[#f5b98a]" : "text-aventurea-green"
              }`}
            />
            {linea}
          </li>
        ))}
      </ul>

      <form action={pedirPaquete.bind(null, paquete.id)} className="mt-6 flex flex-1 items-end">
        <button
          type="submit"
          className={
            destacado
              ? "w-full rounded-xl bg-aventurea-orange px-6 py-3 text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
              : "w-full rounded-xl bg-aventurea-navy px-6 py-3 text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
          }
        >
          Quiero este paquete
        </button>
      </form>
    </div>
  );
}
