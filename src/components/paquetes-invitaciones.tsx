import Link from "next/link";
import { IconCheck, IconChevronDown } from "@/components/icons";
import InvitacionesComparador from "@/components/invitaciones-comparador";
import {
  PAQUETE_BASE,
  PAQUETES_INVITACIONES,
  PAQUETES_PRINCIPALES,
  precioPaquete,
  resolverPaquete,
  montoEnColones,
  type PaqueteInvitacion,
  type PaquetePrincipal,
} from "@/lib/paquetes-invitaciones";

/** "≈₡10.400" — SINPE y transferencia cobran en colones. */
function equivalenteColones(id: string): string | null {
  const p = resolverPaquete(id);
  if (!p || p.precioUSD === null) return null;
  return "≈" + precioPaquete(montoEnColones(p));
}

/**
 * Los paquetes de Invitaciones Digitales:
 * - Los tres PRINCIPALES (Básico / Intermedio / Plus) siempre a la
 *   vista, compactos, con "Ver más" para extender cada card.
 * - Los packs con álbumes digitales (Destello / Celebración / Legado)
 *   plegados tras "Ver packs con álbumes digitales".
 * - Una nota compacta del paquete Base (₡12 500 con reserva).
 * Todo con <details> nativo: cero JavaScript, funciona en el server.
 */
export default function PaquetesInvitaciones({
  titulo = "Elegí tu invitación",
  intro = "Precio único por evento, sin mensualidades: elegís, nos contás los datos de tu fiesta y te la entregamos lista para compartir.",
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
          Precios
        </p>
        <h2 className="titulo mx-auto mt-2 max-w-[24ch] text-[clamp(22px,3.5vw,30px)] text-aventurea-ink">
          {titulo}
        </h2>
        <p className="mx-auto mt-2.5 max-w-[52ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          {intro}
        </p>
      </div>

      {/* Los tres principales, siempre visibles */}
      <div
        className={
          disposicion === "fila"
            ? "mt-7 grid items-start gap-4 md:grid-cols-3"
            : "mt-7 grid gap-4"
        }
      >
        {PAQUETES_PRINCIPALES.map((p) => (
          <CardPrincipal key={p.id} paquete={p} />
        ))}
      </div>

      {/* El comparador interactivo: qué cambia entre paquete y paquete,
          contado con un mockup en vez de con letra. */}
      <InvitacionesComparador />

      {/* La nota del Base: compacta, sin robar protagonismo */}
      <p className="mx-auto mt-4 max-w-[64ch] rounded-xl border border-aventurea-sky/25 bg-aventurea-sky/5 px-4 py-2.5 text-center text-[12.5px] leading-relaxed text-aventurea-ink">
        ¿Reservaste tu salón o servicio en Bookea? Tenés la invitación{" "}
        <strong className="font-extrabold">{PAQUETE_BASE.nombre}</strong>{" "}
        generada con IA por{" "}
        <strong className="font-extrabold">{precioPaquete(PAQUETE_BASE.precio)}</strong>{" "}
        — la oferta aparece al completar tu reserva.
      </p>

      {/* Los packs con álbumes digitales, plegados */}
      <details className="group mt-6">
        <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-xl border border-aventurea-line bg-white px-6 py-3 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy [&::-webkit-details-marker]:hidden">
          Ver packs con álbumes digitales
          <IconChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div
          className={
            disposicion === "fila"
              ? "mt-5 grid items-stretch gap-4 md:grid-cols-3"
              : "mt-5 grid gap-4"
          }
        >
          {PAQUETES_INVITACIONES.map((p) => (
            <CardPaquete key={p.id} paquete={p} />
          ))}
        </div>
      </details>
    </section>
  );
}

/** Una card principal compacta: 3 líneas a la vista y "Ver más". */
function CardPrincipal({ paquete }: { paquete: PaquetePrincipal }) {
  const { destacado } = paquete;
  return (
    <div
      className={
        destacado
          ? "relative flex flex-col rounded-2xl bg-aventurea-navy p-6 text-white shadow-[0_24px_60px_-24px_rgba(16,26,44,0.55)]"
          : "relative flex flex-col rounded-2xl border border-aventurea-line bg-white p-6 shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)]"
      }
    >
      <span
        className={
          destacado
            ? "inline-flex w-fit items-center rounded-lg bg-aventurea-sky px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white"
            : "inline-flex w-fit items-center rounded-lg bg-aventurea-sky/10 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange"
        }
      >
        {paquete.badge}
      </span>

      <h3
        className={`titulo mt-3.5 text-[20px] ${destacado ? "text-white" : "text-aventurea-ink"}`}
      >
        {paquete.nombre}
        <span className="ml-2 text-[22px] font-extrabold tracking-[-0.5px]">
          {paquete.precioEtiqueta}
        </span>
        {paquete.precioEtiqueta.startsWith("$") && (
          <span
            className={`ml-1.5 text-[12px] font-semibold ${
              destacado ? "text-white/60" : "text-aventurea-ink-soft"
            }`}
          >
            por evento
          </span>
        )}
      </h3>
      {equivalenteColones(paquete.id) && (
        <p
          className={`mt-0.5 text-[11.5px] font-semibold ${
            destacado ? "text-white/55" : "text-aventurea-ink-soft"
          }`}
        >
          {equivalenteColones(paquete.id)} · pagás en colones por SINPE o
          transferencia
        </p>
      )}
      <p
        className={`mt-1.5 text-[12.5px] leading-relaxed ${
          destacado ? "text-white/75" : "text-aventurea-ink-soft"
        }`}
      >
        {paquete.lema}
      </p>

      <ul className="mt-3.5 grid gap-2">
        {paquete.incluye.map((linea) => (
          <li
            key={linea}
            className={`flex items-start gap-2 text-[13px] leading-snug ${
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

      {/* "Ver más": extiende el rectángulo con el resto del detalle */}
      <details className="group/mas mt-2.5">
        <summary
          className={`flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-bold [&::-webkit-details-marker]:hidden ${
            destacado
              ? "text-[#f5b98a] hover:text-white"
              : "text-aventurea-navy hover:text-aventurea-orange"
          }`}
        >
          Ver más
          <IconChevronDown className="h-3.5 w-3.5 transition-transform group-open/mas:rotate-180" />
        </summary>
        <ul className="mt-2.5 grid gap-2">
          {paquete.detalle.map((linea) => (
            <li
              key={linea}
              className={`flex items-start gap-2 text-[13px] leading-snug ${
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
      </details>

      <div className="mt-5 flex flex-1 items-end">
        <Link
          href={`/invitaciones/pedido/${paquete.id}`}
          className={
            destacado
              ? "w-full rounded-xl bg-aventurea-sky px-6 py-2.5 text-center text-[14px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark"
              : "w-full rounded-xl bg-aventurea-navy px-6 py-2.5 text-center text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
          }
        >
          Quiero este paquete
        </Link>
      </div>
    </div>
  );
}

/** Una price card de los packs con álbumes; la destacada vive en navy. */
function CardPaquete({ paquete }: { paquete: PaqueteInvitacion }) {
  const { destacado } = paquete;
  return (
    <div
      className={
        destacado
          ? "relative flex flex-col rounded-2xl bg-aventurea-navy p-6 text-white shadow-[0_24px_60px_-24px_rgba(16,26,44,0.55)]"
          : "relative flex flex-col rounded-2xl border border-aventurea-line bg-white p-6 shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)]"
      }
    >
      <span
        className={
          destacado
            ? "inline-flex w-fit items-center rounded-lg bg-aventurea-sky px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-white"
            : "inline-flex w-fit items-center rounded-lg bg-aventurea-sky/10 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange"
        }
      >
        {paquete.badge}
      </span>

      <h3
        className={`titulo mt-3.5 text-[20px] ${
          destacado ? "text-white" : "text-aventurea-ink"
        }`}
      >
        {paquete.nombre}
      </h3>
      <p
        className={`mt-1 text-[24px] font-extrabold tracking-[-0.5px] ${
          destacado ? "text-white" : "text-aventurea-ink"
        }`}
      >
        {precioPaquete(paquete.precio)}
        <span
          className={`ml-1.5 text-[12px] font-semibold ${
            destacado ? "text-white/60" : "text-aventurea-ink-soft"
          }`}
        >
          por evento
        </span>
      </p>
      <p
        className={`mt-1.5 text-[12.5px] leading-relaxed ${
          destacado ? "text-white/75" : "text-aventurea-ink-soft"
        }`}
      >
        {paquete.lema}
      </p>

      <ul className="mt-3.5 grid gap-2">
        {paquete.incluye.map((linea) => (
          <li
            key={linea}
            className={`flex items-start gap-2 text-[13px] leading-snug ${
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

      <div className="mt-5 flex flex-1 items-end">
        <Link
          href={`/invitaciones/pedido/${paquete.id}`}
          className={
            destacado
              ? "w-full rounded-xl bg-aventurea-sky px-6 py-2.5 text-center text-[14px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark"
              : "w-full rounded-xl bg-aventurea-navy px-6 py-2.5 text-center text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
          }
        >
          Quiero este paquete
        </Link>
      </div>
    </div>
  );
}
