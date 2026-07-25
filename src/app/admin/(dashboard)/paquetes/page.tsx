import Link from "next/link";

export default function AdminPaquetesPage() {
  return (
    <div>
      <Link
        href="/admin"
        className="text-[13px] font-bold text-zinc-400 hover:text-white"
      >
        ← Volver
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-white">
        Paquete Turístico
      </h1>
      <p className="mt-2 max-w-md text-[13.5px] text-zinc-400">
        Todavía no conectamos el calendario de Casa Puntaleona y Chalet
        Alajuela — es el próximo paso del plan. Cuando esté listo, vas a
        poder gestionar sus reservas acá.
      </p>
    </div>
  );
}
