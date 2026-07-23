import Link from "next/link";

export default function PaquetesPromocionales() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Volver al inicio
      </Link>
      <h1 className="text-3xl font-bold">Paquetes Promocionales</h1>
      <p className="text-zinc-600">
        Próximamente: casa vacacional en Puntaleona, chalets en Alajuela y
        add-ons (tour en bote, jetski, CANAM y servicio de comida).
      </p>
    </main>
  );
}
