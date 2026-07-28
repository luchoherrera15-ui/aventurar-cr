import Link from "next/link";
import AccionesSesion from "@/components/acciones-sesion";

/**
 * La portada de Bookea: pantalla completa sobre la foto de Costa Rica
 * con dos "puertas" de vidrio para elegir qué se quiere reservar. La
 * de eventos entra al directorio (el marketplace que ya funciona); la
 * de escapadas es la próxima vertical y por ahora se muestra como
 * "muy pronto" para no mandar a nadie a un callejón sin salida.
 */

const chipCls =
  "rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[12px] font-bold text-white";

function FlechaCta() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aventurea-orange transition-transform duration-200 group-hover:translate-x-1">
      <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-white" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export default function PortadaPage() {
  return (
    <main className="relative flex min-h-svh flex-col bg-[url('/portada-bookea.jpg')] bg-cover bg-[position:center_35%]">
      {/* Velo para que el texto blanco se lea sobre cualquier zona de la foto */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,20,0.42)_0%,rgba(10,14,20,0.10)_26%,rgba(10,14,20,0.10)_48%,rgba(10,14,20,0.62)_100%)]" />

      {/* ---------- Header sobre la foto ---------- */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10">
        <Link href="/" className="flex items-center">
          {/* Sobre la foto el logo va en blanco: el navy original se
              perdería contra el velo oscuro del hero. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
          <img
            src="/logo-bookea-blanco.png"
            alt="Bookea"
            className="h-8 w-auto drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] sm:h-9"
          />
        </Link>
        <div className="flex items-center gap-3.5">
          <Link
            href="/publicar"
            className="rounded-full border border-white/25 bg-white/15 px-4 py-2.5 text-[14px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            Publicá tu espacio
          </Link>
          <AccionesSesion />
        </div>
      </header>

      {/* ---------- Centro ---------- */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-6 text-center sm:px-10">
        <p className="mb-4 flex items-center gap-3 text-[12.5px] font-extrabold uppercase tracking-[0.22em] text-[#FFD9B8] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)] before:block before:h-0.5 before:w-6 before:rounded before:bg-aventurea-orange after:block after:h-0.5 after:w-6 after:rounded after:bg-aventurea-orange">
          Directorio nacional · Costa Rica
        </p>
        <h1 className="max-w-[14ch] text-[clamp(38px,6vw,68px)] font-black leading-[1.04] tracking-[-1.5px] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
          Viví Costa Rica a tu manera
        </h1>
        <p className="mt-3.5 max-w-[52ch] text-[clamp(15px,1.6vw,19px)] font-semibold leading-normal text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.4)]">
          Escapadas, restaurantes, aventuras y todo para tu evento — compará
          opciones reales y reservá directo, sin cadenas de WhatsApp.
        </p>

        {/* ---------- Puertas ---------- */}
        <div className="mt-8 grid w-full justify-center gap-5 sm:mt-11 md:grid-cols-[repeat(2,minmax(0,440px))]">
          {/* Escapadas: la próxima vertical — todavía sin directorio */}
          <div className="relative flex flex-col gap-3 rounded-[22px] border border-white/30 border-t-4 border-t-white/30 bg-white/10 p-6 pb-5 text-left text-white opacity-90 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-[18px]">
            <span className="absolute right-4 top-4 rounded-full bg-aventurea-orange px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
              Muy pronto
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/30 bg-white/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-[#FFC28A]" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20h20" />
                <path d="M12 3c-3 3.5-3 8 0 12 3-4 3-8.5 0-12z" />
                <path d="M5 20c0-4 2.5-7 7-7s7 3 7 7" />
              </svg>
            </span>
            <h2 className="text-[clamp(21px,2.2vw,26px)] font-extrabold leading-tight tracking-[-0.5px] [text-shadow:0_1px_10px_rgba(0,0,0,0.3)]">
              Escapadas y experiencias
            </h2>
            <p className="text-[14.5px] font-medium leading-normal text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.28)]">
              Descubrí dónde quedarte, dónde comer y qué vivir en todo el país.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={chipCls}>Casas y villas</span>
              <span className={chipCls}>Hoteles</span>
              <span className={chipCls}>Restaurantes</span>
              <span className={chipCls}>Aventuras</span>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-white/25 pt-3.5">
              <span className="text-[14.5px] font-extrabold text-white/70">
                Estamos preparando esta sección
              </span>
            </div>
          </div>

          {/* Eventos: el marketplace que ya funciona */}
          <Link
            href="/ranchos-eventos"
            className="group flex flex-col gap-3 rounded-[22px] border border-white/30 border-t-4 border-t-white/30 bg-white/[0.13] p-6 pb-5 text-left text-white shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-[18px] transition-all duration-200 hover:-translate-y-1.5 hover:border-t-aventurea-orange hover:bg-white/20 hover:shadow-[0_26px_60px_rgba(0,0,0,0.36)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-aventurea-orange"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/30 bg-white/20">
              <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-[#FFC28A]" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21V10l8-6 8 6v11" />
                <path d="M9 21v-6h6v6" />
              </svg>
            </span>
            <h2 className="text-[clamp(21px,2.2vw,26px)] font-extrabold leading-tight tracking-[-0.5px] [text-shadow:0_1px_10px_rgba(0,0,0,0.3)]">
              Todo para tu evento
            </h2>
            <p className="text-[14.5px] font-medium leading-normal text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.28)]">
              Encontrá el lugar y los proveedores para hacerlo inolvidable.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={chipCls}>Lugares</span>
              <span className={chipCls}>Alimentación</span>
              <span className={chipCls}>Animación</span>
              <span className={chipCls}>Decoración</span>
              <span className={chipCls}>Y más</span>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-white/25 pt-3.5">
              <span className="text-[14.5px] font-extrabold text-[#FFC28A] [text-shadow:0_1px_8px_rgba(0,0,0,0.3)]">
                Planear mi evento
              </span>
              <FlechaCta />
            </div>
          </Link>
        </div>
      </div>

      {/* ---------- Barra inferior ---------- */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-2 px-5 pb-6 pt-4 sm:px-10">
        {[
          "7 provincias, un solo lugar",
          "Reservá directo con el proveedor",
          "Publicá tu negocio gratis",
        ].map((t) => (
          <span
            key={t}
            className="flex items-center gap-2 text-[13.5px] font-bold text-white/95 [text-shadow:0_1px_8px_rgba(0,0,0,0.45)] before:block before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-aventurea-orange"
          >
            {t}
          </span>
        ))}
      </div>
    </main>
  );
}
