import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import FormularioNuevoNegocioFood from "./formulario";

export const metadata: Metadata = { title: "Sumá tu restaurante · FOOD.BOOKEA", robots: { index: false } };

export default async function NuevoNegocioFoodPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/food/negocio/login");

  const yaTiene = await miNegocioFood();
  if (yaTiene) redirect("/food/negocio");

  return (
    <main className="mx-auto max-w-[560px] px-4 py-10 sm:px-6">
      <p className="text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
        FOOD.BOOKEA
      </p>
      <h1 className="mt-2 text-2xl font-bold text-aventurea-ink">Sumá tu restaurante</h1>
      <p className="mt-2 text-[13.5px] text-aventurea-ink-soft">
        Publicalo, armá tu menú y abrí franjas horarias con descuento. Es
        independiente de tu ficha en el marketplace de Bookea, si la tenés.
      </p>

      <div className="mt-6">
        <FormularioNuevoNegocioFood />
      </div>
    </main>
  );
}
