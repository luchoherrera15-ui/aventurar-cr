import Link from "next/link";

export default function SalonEventos() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Volver al inicio
      </Link>
      <h1 className="text-3xl font-bold">Salón para Eventos</h1>
      <p className="text-zinc-600">
        Próximamente: reserva por calendario, información del rancho
        (parrilla, piscina, parqueo, mesas y sillas) y alquiler de habitación
        para estadía.
      </p>
    </main>
  );
}
