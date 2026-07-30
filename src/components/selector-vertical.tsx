import Link from "next/link";
import { IconClock, IconHome, IconSparkles } from "./icons";

/**
 * El conmutador de las tres verticales, arriba de cada directorio:
 * tres cards chiquitas (ícono + nombre) para saltar entre Citas,
 * Eventos y Hospedajes sin robarle espacio a las cards de abajo.
 */
const VERTICALES = [
  { id: "citas", href: "/citas", label: "Citas y Agendas", Icono: IconClock },
  { id: "eventos", href: "/eventos", label: "Eventos", Icono: IconSparkles },
  { id: "hospedajes", href: "/hospedajes", label: "Booking Hospedajes", Icono: IconHome },
] as const;

export type VerticalActiva = (typeof VERTICALES)[number]["id"];

export default function SelectorVertical({
  activo,
  accesosALaDerecha = false,
}: {
  activo: VerticalActiva;
  /** Muestra "Publicá tu negocio" y "Lealtad" a la derecha. Solo para
   *  páginas de contenedor ancho (1600px): en /citas (1100px) los
   *  botones chocaban con la tarjeta de Hospedajes. */
  accesosALaDerecha?: boolean;
}) {
  return (
    <div className="relative">
      <nav
        aria-label="Tipo de reserva"
        className="mx-auto grid w-full max-w-[640px] grid-cols-3 gap-2"
      >
        {VERTICALES.map(({ id, href, label, Icono }) => {
          const esActivo = id === activo;
          return (
            <Link
              key={id}
              href={href}
              aria-current={esActivo ? "page" : undefined}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-2 py-2.5 text-center text-[12px] font-bold transition-all sm:text-[13px] ${
                esActivo
                  ? "border-aventurea-navy bg-aventurea-navy text-white shadow-[0_10px_24px_-12px_rgba(22,41,94,0.5)]"
                  : "border-aventurea-line bg-white text-aventurea-ink-soft hover:-translate-y-0.5 hover:border-aventurea-navy/40 hover:text-aventurea-ink"
              }`}
            >
              <Icono
                className={`h-4 w-4 shrink-0 ${esActivo ? "text-aventurea-orange" : "text-aventurea-navy/60"}`}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Accesos directos en el espacio libre a la derecha del
          conmutador; en pantallas chicas no hay espacio y el header
          ya trae "Publicá tu espacio". */}
      {accesosALaDerecha && (
      <div className="absolute inset-y-0 right-0 hidden items-center gap-2 xl:flex">
        <Link
          href="/publicar"
          className="rounded-full bg-aventurea-navy px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
        >
          Publicá tu negocio
        </Link>
        <Link
          href="/lealtad"
          className="rounded-full border border-aventurea-line bg-white px-4 py-2 text-[12.5px] font-bold text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
        >
          Lealtad
        </Link>
      </div>
      )}
    </div>
  );
}
