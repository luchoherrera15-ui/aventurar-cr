import Link from "next/link";
import AccionesSesion from "@/components/acciones-sesion";
import { IconClock, IconHouse, IconRancho } from "@/components/icons";

/**
 * La portada de Bookea: una página serena — sin foto de fondo — con un
 * degradado celeste muy suave y tres tarjetas para elegir qué se quiere
 * reservar: Eventos, Citas y Reservas, Hospedajes. La persona escoge y
 * listo; el detalle vive adentro de cada sección.
 *
 * El texto ya no se ancla a Costa Rica: la plataforma apunta a LATAM,
 * USA y Europa, así que la portada habla de reservar, no de un país.
 */

export default function PortadaPage() {
  return (
    <main className="relative flex min-h-svh flex-col bg-[linear-gradient(175deg,#ffffff_0%,#f3fbfa_42%,#e7f5f4_100%)]">
      {/* Un brillo celeste apenas perceptible detrás del centro, para
          que el fondo no sea plano sin volverse ruidoso. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[min(90vw,900px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(93,196,190,0.14),transparent)]"
      />

      {/* ---------- Header ---------- */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático */}
          <img src="/logo-bookea.png" alt="Bookea" className="h-8 w-auto sm:h-9" />
        </Link>
        <div className="flex items-center gap-3.5">
          {/* Directo al formulario de alta — la página informativa
              queda en /publicar para quien quiera conocer más. */}
          <Link
            href="/mi-rancho/nuevo"
            className="hidden whitespace-nowrap text-[13.5px] font-bold text-aventurea-ink hover:text-aventurea-navy sm:block"
          >
            Publicá tu negocio
          </Link>
          <AccionesSesion />
        </div>
      </header>

      {/* ---------- Centro ---------- */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-12 pt-8 text-center sm:px-10">
        <p className="mb-4 flex items-center gap-3 text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#2b8a84] before:block before:h-0.5 before:w-6 before:rounded before:bg-[#5dc4be] after:block after:h-0.5 after:w-6 after:rounded after:bg-[#5dc4be]">
          Reservas en línea
        </p>
        <h1 className="max-w-[18ch] text-[clamp(32px,5vw,54px)] font-black leading-[1.06] tracking-[-1.2px] text-aventurea-ink">
          Todo lo que se reserva, en un solo lugar
        </h1>
        <p className="mt-4 max-w-[54ch] text-[clamp(14.5px,1.5vw,17px)] font-medium leading-relaxed text-aventurea-ink-soft">
          Un evento, una cita o una escapada: elegí lo que necesitás y
          reservalo directo, con confirmación y chat incluidos — sin salir
          del sitio.
        </p>

        {/* ---------- Las tres tarjetas ---------- */}
        <div className="mt-10 grid w-full max-w-[1060px] gap-5 md:grid-cols-3">
          <TarjetaSeccion
            href="/eventos"
            activa
            icono={<IconRancho />}
            titulo="Eventos"
            descripcion="Salones y fincas, catering, música y decoración — todos los proveedores para armar tu evento completo."
            contiene={["Lugares", "Alimentación", "Animación", "Decoración"]}
            cta="Planear mi evento"
          />
          <TarjetaSeccion
            href="/citas"
            icono={<IconClock />}
            titulo="Citas y Reservas"
            descripcion="Belleza, barbería, uñas, spa y bienestar — elegí el servicio, la hora y con quién, y llegá directo a tu cita."
            contiene={["Belleza", "Barbería", "Uñas", "Spa"]}
            cta="Reservar una cita"
          />
          <TarjetaSeccion
            href="/booking"
            icono={<IconHouse />}
            titulo="Hospedajes"
            descripcion="Casas, villas, hoteles y experiencias — reservá tu próxima escapada directo con quien te recibe."
            contiene={["Casas y villas", "Hoteles", "Experiencias"]}
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
            className="flex items-center gap-2 text-[12.5px] font-bold text-aventurea-ink-soft before:block before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-[#5dc4be]"
          >
            {t}
          </span>
        ))}
      </div>
    </main>
  );
}

/**
 * Una de las tres tarjetas de la portada. Blanca sobre el degradado,
 * con el ícono en su burbuja celeste; la activa lleva la flecha
 * naranja, las que están en preparación llevan la insignia "Muy
 * pronto" pero igual entran a su página (nunca un callejón sin
 * salida).
 */
function TarjetaSeccion({
  href,
  activa,
  icono,
  titulo,
  descripcion,
  contiene,
  cta,
}: {
  href: string;
  activa?: boolean;
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  contiene: string[];
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3.5 rounded-[24px] border border-[#dceeec] bg-white p-7 pb-6 text-left shadow-[0_10px_36px_-18px_rgba(21,70,67,0.25)] transition-all duration-200 hover:-translate-y-1.5 hover:border-[#5dc4be] hover:shadow-[0_22px_48px_-20px_rgba(21,70,67,0.35)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-aventurea-orange"
    >
      {!activa && (
        <span className="absolute right-5 top-5 rounded-full bg-[#e6f6f5] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[#2b8a84]">
          Muy pronto
        </span>
      )}
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f6f5] text-[#1f7a74] [&_svg]:h-6 [&_svg]:w-6">
        {icono}
      </span>
      <h2 className="text-[21px] font-extrabold tracking-[-0.4px] text-aventurea-ink">
        {titulo}
      </h2>
      <p className="text-[13.5px] font-medium leading-relaxed text-aventurea-ink-soft">
        {descripcion}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {contiene.map((c) => (
          <span
            key={c}
            className="rounded-full border border-[#dceeec] bg-[#f4fbfa] px-2.5 py-1 text-[11.5px] font-bold text-aventurea-ink-soft"
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-[#e8f3f2] pt-4">
        <span
          className={`text-[13.5px] font-extrabold ${activa ? "text-aventurea-orange" : "text-aventurea-ink-soft"}`}
        >
          {cta}
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-1 ${
            activa ? "bg-aventurea-orange text-white" : "bg-[#e6f6f5] text-[#1f7a74]"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
