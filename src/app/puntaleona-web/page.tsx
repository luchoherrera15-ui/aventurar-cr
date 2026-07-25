import Link from "next/link";

export default function PuntaleonaWebPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-aventurea-navy px-6 text-center">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-aventurea-orange text-sm font-bold text-aventurea-navy">
          A
        </span>
        <span className="text-base font-bold tracking-wide text-white">
          AVENTUREA CR
        </span>
      </Link>
      <h1 className="text-2xl font-bold text-white">Paquetes Vacacionales</h1>
      <p className="mx-auto mt-3 max-w-md text-[14px] text-[#C6D3E8]">
        Casa Puntaleona y Chalet Alajuela — estamos armando el calendario de
        disponibilidad y el cotizador. Muy pronto vas a poder reservar
        directamente acá.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
