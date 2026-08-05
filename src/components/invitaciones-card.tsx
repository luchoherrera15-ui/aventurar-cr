import Link from "next/link";
import { IconMail } from "@/components/icons";

/**
 * La tarjeta propia de Invitaciones Digitales, sembrada a mano en la
 * categoría "Otros servicios" del directorio. A propósito NO parece un
 * negocio más: es navy de marca, con el sobre en marca de agua
 * sangrando por la esquina — es el producto de Bookea, no un
 * proveedor.
 */
export default function InvitacionesCard({ ancho }: { ancho?: string }) {
  return (
    <article
      className="h-full"
      style={ancho ? { width: ancho, flex: `0 0 ${ancho}` } : undefined}
    >
      <Link
        href="/invitaciones"
        className="relative flex h-full min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl bg-aventurea-navy p-5 shadow-sm transition-shadow hover:shadow-[0_10px_30px_rgba(16,26,44,0.35)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 -top-6 rotate-[14deg] text-white/[0.08]"
        >
          <IconMail className="h-36 w-36" />
        </span>

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-aventurea-sky px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">
            De Bookea
          </span>
          <h3 className="mt-3 text-[19px] font-bold leading-tight text-white">
            Invitaciones Digitales
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">
            La invitación de tu evento, animada y lista para compartir por
            WhatsApp — con confirmación de asistencia incluida.
          </p>
        </div>

        <span className="relative z-10 mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-aventurea-orange">
          Crear mi invitación →
        </span>
      </Link>
    </article>
  );
}
