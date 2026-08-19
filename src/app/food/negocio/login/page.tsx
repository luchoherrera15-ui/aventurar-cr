import type { Metadata } from "next";
import FormularioCodigoAcceso from "@/components/formulario-codigo-acceso";

export const metadata: Metadata = { title: "Iniciá sesión · FOOD.BOOKEA", robots: { index: false } };

export default function LoginNegocioFoodPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden p-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(240,120,42,0.10),transparent)]" />

      <div className="relative w-full max-w-sm rounded-2xl border border-aventurea-line bg-aventurea-surface p-9 shadow-2xl">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
          FOOD.BOOKEA — restaurantes
        </p>
        <h1 className="mt-2.5 text-xl font-bold text-aventurea-ink">Iniciá sesión</h1>
        <p className="mt-1.5 text-sm text-aventurea-ink-soft">
          Entrá con tu correo para administrar tu restaurante.
        </p>

        <FormularioCodigoAcceso
          destino="/food/negocio"
          acento="orange"
          crearCuenta
          pedirNombreSiNuevo
        />
      </div>
    </main>
  );
}
