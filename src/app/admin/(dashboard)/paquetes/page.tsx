import Link from "next/link";

export default function AdminPaquetesPage() {
  return (
    <div>
      <Link
        href="/admin"
        className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
      >
        ← Volver
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-aventurea-orange-dark">
        Paquete Turístico
      </h1>
      <p className="mt-2 max-w-md text-[13.5px] text-aventurea-ink-soft">
        Todavía no conectamos el calendario de Casa Puntaleona y Chalet
        Alajuela — es el próximo paso del plan. Cuando esté listo, vas a
        poder gestionar sus reservas acá.
      </p>
    </div>
  );
}
