import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* Fondo con blur */}
      <div
        className="absolute inset-0 -z-10 scale-110 bg-cover bg-center blur-md"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #0a3d62 0%, #1e8a6e 45%, #f5e6c8 100%)",
        }}
      />
      <div className="absolute inset-0 -z-10 bg-black/40" />

      <div className="mb-12 text-center text-white">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-white/70">
          Costa Rica
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Aventurar CR</h1>
        <p className="mt-4 max-w-xl text-white/80">
          Escogé la experiencia que estás buscando
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-8 sm:grid-cols-2">
        <Link
          href="/paquetes-promocionales"
          className="group relative flex h-72 flex-col justify-end overflow-hidden rounded-2xl border border-white/20 shadow-2xl transition-transform duration-300 hover:-translate-y-1"
        >
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #0a4d6e 0%, #14856b 55%, #d9c48f 100%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="relative z-10 p-6">
            <h2 className="text-2xl font-semibold text-white">
              Paquetes Promocionales
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Casa vacacional en Puntaleona + tours en bote, jetski y CANAM
            </p>
          </div>
        </Link>

        <Link
          href="/salon-eventos"
          className="group relative flex h-72 flex-col justify-end overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md transition-transform duration-300 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent transition-transform duration-500 group-hover:scale-105" />
          <div className="relative z-10 p-6">
            <h2 className="text-2xl font-semibold text-white">
              Salón para Eventos
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Rancho de alquiler en Alajuela: piscina, parrilla y parqueo
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}
