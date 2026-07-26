import Link from "next/link";

export default function PuntaleonaWebPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-aventurea-cream px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(240,120,42,0.10),transparent)]" />
      <div className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-aventurea-orange opacity-[0.08] blur-[100px]" />

      <Link href="/" className="relative mb-6 flex items-center gap-2">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-aventurea-orange text-sm font-bold text-zinc-950">
          A
        </span>
        <span className="text-base font-bold tracking-wide text-aventurea-ink">
          AVENTUREA CR
        </span>
      </Link>
      <h1 className="relative text-2xl font-bold text-aventurea-orange-dark">Paquetes Vacacionales</h1>
      <p className="relative mx-auto mt-3 max-w-md text-[14px] text-aventurea-ink-soft">
        Casa Puntaleona y Chalet Alajuela — estamos armando el calendario de
        disponibilidad y el cotizador. Muy pronto vas a poder reservar
        directamente acá.
      </p>
      <Link
        href="/"
        className="relative mt-6 rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
