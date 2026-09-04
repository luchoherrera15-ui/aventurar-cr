import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavSolutions from "../nav-solutions";
import { negociosDeLaCuenta } from "@/lib/solutions/acceso";
import FormularioCrear from "./formulario-crear";

export const metadata: Metadata = {
  title: "Creá tu negocio · Bookea Solutions",
  description: "Tu página de links y tu menú digital con pedidos desde la mesa, en cinco minutos.",
  alternates: { canonical: "/solutions/crear" },
};

/**
 * /solutions/crear — el alta. Pide UNA cosa: el nombre. Todo lo demás
 * se arma en el panel, donde se ve al instante cómo queda.
 *
 * Sin sesión, a /cuenta con `next` para volver acá. Con negocios ya
 * creados se ofrece entrar a ellos: crear dos por accidente es el
 * error más fácil de cometer en un alta de un solo campo.
 */
export default async function CrearSolutionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta?volver=solutions");

  const mios = await negociosDeLaCuenta();

  return (
    <main className="min-h-svh bg-[#f7f9fc]">
      <NavSolutions logueado nombre={null} />
      <section className="mx-auto w-[min(560px,92vw)] py-12">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accion)" }}>
          Bookea Solutions
        </p>
        <h1 className="titulo mt-2 text-[clamp(28px,4vw,40px)] leading-tight text-aventurea-navy">
          ¿Cómo se llama tu negocio?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-aventurea-ink-soft">
          Con eso te creamos tu página <strong className="text-aventurea-navy">bookea.lat/s/…</strong> y tu
          panel. Tu link hub es gratis; el menú, los pedidos y la tarjeta de lealtad se agregan
          desde ahí, con esta misma cuenta.
        </p>

        <div className="mt-6 rounded-[18px] border border-aventurea-line bg-white p-6 shadow-plano">
          <FormularioCrear />
        </div>

        {mios.length > 0 && (
          <div className="mt-6 rounded-[18px] border border-aventurea-line bg-white p-5">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
              Ya tenés
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {mios.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/solutions/panel/${n.id}`}
                    className="flex items-center justify-between rounded-xl border border-aventurea-line px-3.5 py-2.5 text-[14px] font-bold text-aventurea-navy hover:border-bookea-azul/40"
                  >
                    <span>{n.nombre}</span>
                    <span className="text-[12px] font-medium text-aventurea-ink-soft">/s/{n.slug} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
