import Link from "next/link";

// Reemplazar por: "url(/images/paquetes-promocionales.jpg)" cuando tengamos la foto real.
const PAQUETES_BG =
  "linear-gradient(135deg, #0a4d6e 0%, #14856b 55%, #d9c48f 100%)";
const EVENTOS_BG =
  "linear-gradient(135deg, #7a1f3d 0%, #c9922f 60%, #3d2b1f 100%)";

export default function Home() {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050807] px-4 py-16">
      {/* Fondo general oscuro */}
      <div className="absolute inset-0 -z-10 bg-[#050807]" />
      <div
        className="absolute inset-0 -z-10 scale-110 bg-cover bg-center opacity-45 blur-3xl"
        style={{ backgroundImage: PAQUETES_BG }}
      />
      <div className="absolute inset-0 -z-10 bg-black/60" />

      <div className="mb-12 text-center text-white">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-white/70">
          Costa Rica
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Aventurar CR</h1>
        <p className="mt-4 max-w-xl text-white/80">
          Escogé la experiencia que estás buscando
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-10 sm:grid-cols-2">
        <Link href="/paquetes-promocionales" className="group relative h-72">
          {/* Glow ambiental: copia difuminada del fondo detrás de la card */}
          <div
            aria-hidden
            className="absolute -inset-8 -z-10 rounded-[2rem] bg-cover bg-center opacity-80 blur-[50px] saturate-150 transition-opacity duration-500 group-hover:opacity-100"
            style={{ backgroundImage: PAQUETES_BG }}
          />
          <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-transform duration-300 group-hover:-translate-y-1">
            <div
              className="absolute inset-0 bg-cover bg-center brightness-[0.55] saturate-125 transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: PAQUETES_BG }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
            <div className="relative z-10 p-6">
              <h2 className="text-2xl font-semibold text-white">
                Paquetes Promocionales
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Casa vacacional en Puntaleona + tours en bote, jetski y CANAM
              </p>
            </div>
          </div>
        </Link>

        <Link href="/salon-eventos" className="group relative h-72">
          <div
            aria-hidden
            className="absolute -inset-8 -z-10 rounded-[2rem] bg-cover bg-center opacity-80 blur-[50px] saturate-150 transition-opacity duration-500 group-hover:opacity-100"
            style={{ backgroundImage: EVENTOS_BG }}
          />
          <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-transform duration-300 group-hover:-translate-y-1">
            <div
              className="absolute inset-0 bg-cover bg-center brightness-[0.45] saturate-125 transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: EVENTOS_BG }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
            <div className="relative z-10 p-6">
              <h2 className="text-2xl font-semibold text-white">
                Salón para Eventos
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Rancho de alquiler en Alajuela: piscina, parrilla y parqueo
              </p>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
