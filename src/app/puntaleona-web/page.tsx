import Link from "next/link";

export default function PuntaleonaWebPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-aventurea-cream px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(240,120,42,0.10),transparent)]" />
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-aventurea-sky opacity-[0.08] blur-[100px]" />

      <Link href="/eventos" className="relative mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- el
            logo oficial es un PNG estático: next/image no aporta nada
            acá. */}
        <img src="/logo-bookea.png" alt="Bookear" className="h-7 w-auto" />
      </Link>
      <h1 className="relative text-2xl font-bold text-aventurea-ink">Paquetes Vacacionales</h1>
      <p className="relative mx-auto mt-3 max-w-md text-[14px] text-aventurea-ink-soft">
        Casa Puntaleona y Chalet Alajuela — estamos armando el calendario de
        disponibilidad y el cotizador. Muy pronto vas a poder reservar
        directamente acá.
      </p>
      <Link
        href="/eventos"
        className="relative mt-6 rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
