import Link from "next/link";
import AccionesSesion from "@/components/acciones-sesion";
import FondoPortada from "@/components/fondo-portada";
import PopupInvitaciones from "@/components/popup-invitaciones";
import { IconClock, IconHouse, IconRancho } from "@/components/icons";

/**
 * La portada de Bookea: una foto a pantalla completa — evento, spa o
 * playa, sorteada en cada recarga — con un velo navy para que el texto
 * blanco respire, y tres tarjetas compactas de vidrio (fondo
 * translúcido + blur) para elegir qué se quiere reservar: Eventos,
 * Citas y Reservas, Hospedajes.
 *
 * El texto no se ancla a Costa Rica: la plataforma apunta a LATAM,
 * USA y Europa, así que la portada habla de reservar, no de un país.
 */

export default function PortadaPage() {
  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-aventurea-navy">
      <FondoPortada />
      <PopupInvitaciones />

      {/* Velo navy sobre la foto: más denso arriba y abajo, donde vive
          el texto, y más abierto al centro para que la foto se luzca. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,18,42,0.66)_0%,rgba(10,18,42,0.34)_44%,rgba(10,18,42,0.7)_100%)]"
      />

      {/* ---------- Header ---------- */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático */}
          <img src="/logo-bookea-blanco.png" alt="Bookea" className="h-8 w-auto sm:h-9" />
        </Link>
        <div className="flex items-center gap-3.5">
          {/* Directo al formulario de alta — la página informativa
              queda en /publicar para quien quiera conocer más. */}
          <Link
            href="/mi-rancho/nuevo"
            className="hidden whitespace-nowrap text-[13.5px] font-bold text-white/90 hover:text-white sm:block"
          >
            Publicá tu negocio
          </Link>
          <AccionesSesion />
        </div>
      </header>

      {/* ---------- Centro ---------- */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-6 text-center sm:px-10">
        <p className="mb-4 flex items-center gap-3 text-[12px] font-extrabold uppercase tracking-[0.22em] text-white/85 before:block before:h-0.5 before:w-6 before:rounded before:bg-aventurea-orange after:block after:h-0.5 after:w-6 after:rounded after:bg-aventurea-orange">
          Reservas en línea
        </p>
        <h1 className="max-w-[18ch] text-[clamp(30px,4.6vw,50px)] font-black leading-[1.06] tracking-[-1.2px] text-white [text-shadow:0_2px_24px_rgba(6,12,32,0.45)]">
          Todo lo que se reserva, en un solo lugar
        </h1>
        <p className="mt-4 max-w-[52ch] text-[clamp(14px,1.4vw,16.5px)] font-medium leading-relaxed text-white/85 [text-shadow:0_1px_14px_rgba(6,12,32,0.4)]">
          Un evento, una cita o una escapada: elegí lo que necesitás y
          reservalo directo, con confirmación y chat incluidos.
        </p>

        {/* ---------- Las tres tarjetas ---------- */}
        <div className="mt-8 grid w-full max-w-[860px] gap-3.5 sm:grid-cols-3">
          <TarjetaSeccion
            href="/eventos"
            activa
            icono={<IconRancho />}
            titulo="Eventos"
            descripcion="Salones y fincas, catering, música y decoración para armar tu evento completo."
            cta="Planear mi evento"
          />
          <TarjetaSeccion
            href="/citas"
            activa
            icono={<IconClock />}
            titulo="Citas y Reservas"
            descripcion="Belleza, barbería, uñas y spa — elegí el servicio, la hora y con quién."
            cta="Reservar una cita"
          />
          <TarjetaSeccion
            href="/booking"
            icono={<IconHouse />}
            titulo="Hospedajes"
            descripcion="Casas, villas y hoteles para reservar tu próxima escapada directo."
            cta="Ver hospedajes"
          />
        </div>
      </div>

      {/* ---------- Pie sereno ---------- */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 px-5 pb-7 pt-2 sm:px-10">
        {[
          "Reservá directo con cada negocio",
          "Confirmación y chat en el mismo lugar",
          "Publicá tu negocio gratis",
        ].map((t) => (
          <span
            key={t}
            className="flex items-center gap-2 text-[12.5px] font-bold text-white/80 before:block before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-aventurea-orange"
          >
            {t}
          </span>
        ))}
      </div>
    </main>
  );
}

/**
 * Una de las tres tarjetas de la portada, en versión compacta de
 * vidrio: fondo translúcido con blur para que la foto se adivine
 * detrás. La activa lleva la flecha naranja; las que están en
 * preparación llevan la insignia "Muy pronto" pero igual entran a su
 * página (nunca un callejón sin salida).
 */
function TarjetaSeccion({
  href,
  activa,
  icono,
  titulo,
  descripcion,
  cta,
}: {
  href: string;
  activa?: boolean;
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-2.5 rounded-2xl border border-white/25 bg-white/10 p-5 text-left shadow-[0_18px_44px_-24px_rgba(4,10,28,0.7)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-white/45 hover:bg-white/15 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-aventurea-orange"
    >
      {!activa && (
        <span className="absolute right-4 top-4 rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white/90">
          Muy pronto
        </span>
      )}
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white [&_svg]:h-5 [&_svg]:w-5">
        {icono}
      </span>
      <h2 className="text-[17px] font-extrabold tracking-[-0.3px] text-white">
        {titulo}
      </h2>
      <p className="text-[12.5px] font-medium leading-relaxed text-white/80">
        {descripcion}
      </p>
      <div className="mt-auto flex items-center justify-between border-t border-white/15 pt-3">
        <span
          className={`text-[12.5px] font-extrabold ${activa ? "text-white" : "text-white/80"}`}
        >
          {cta}
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-1 ${
            activa ? "bg-aventurea-orange text-white" : "bg-white/15 text-white"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
