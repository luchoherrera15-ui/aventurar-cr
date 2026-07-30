import Link from "next/link";
import { IconMail } from "@/components/icons";

/**
 * La card de venta cruzada post-reserva: quien acaba de reservar un
 * salón/rancho de eventos recibe la oferta de la invitación digital
 * base a precio especial. Aparece en el final feliz del flujo de
 * reserva (web) — la app móvil tiene su gemela en RN.
 */
export default function OfertaInvitacionCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#16295e] p-6 text-white ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(24rem 14rem at 90% -20%, rgba(238,116,32,0.28), transparent 60%)",
        }}
      />
      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#f5b98a]">
          <IconMail className="h-3.5 w-3.5" /> Oferta por tu reserva
        </p>
        <h3 className="mt-3 text-[20px] font-black leading-tight">
          ¡Creá tu invitación digital!
        </h3>
        <p className="mt-1 text-[14px] text-white/85">
          Por tan solo{" "}
          <span className="text-[18px] font-black text-[#f5b98a]">
            ₡{(12500).toLocaleString("es-CR")}
          </span>
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/75">
          Un link precioso para compartir con tus invitados: confirman ahí
          mismo y vos ves la lista en tiempo real.
        </p>
        <Link
          href="/invitaciones"
          className="mt-4 inline-block rounded-xl bg-aventurea-orange px-6 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
        >
          Crear mi invitación →
        </Link>
        <p className="mt-3 text-[10.5px] leading-relaxed text-white/50">
          * Aplica a la versión base de nuestras invitaciones digitales.
          Precio especial por haber reservado tu espacio en Bookea.
        </p>
      </div>
    </div>
  );
}
