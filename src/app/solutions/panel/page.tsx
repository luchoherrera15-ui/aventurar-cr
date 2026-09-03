import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavLealtad from "@/app/lealtad/nav-lealtad";
import { negociosDeLaCuenta } from "@/lib/solutions/acceso";

export const metadata: Metadata = { title: "Mis negocios · Bookea Solutions" };

/** /solutions/panel — la lista de negocios de la cuenta (propios y donde colabora). */
export default async function PanelSolutionsIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta?volver=solutions");

  const negocios = await negociosDeLaCuenta();
  if (negocios.length === 0) redirect("/solutions/crear");
  if (negocios.length === 1) redirect(`/solutions/panel/${negocios[0].id}`);

  return (
    <main className="min-h-svh bg-[#f7f9fc]">
      <NavLealtad logueado nombre={null} />
      <section className="mx-auto w-[min(720px,92vw)] py-12">
        <h1 className="titulo text-[clamp(26px,3.5vw,36px)] text-aventurea-navy">Tus negocios</h1>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {negocios.map((n) => (
            <li key={n.id}>
              <Link
                href={`/solutions/panel/${n.id}`}
                className="elevar block rounded-[18px] border border-aventurea-line bg-white p-5"
              >
                <p className="text-[16px] font-extrabold text-aventurea-navy">{n.nombre}</p>
                <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                  /s/{n.slug} · {n.publicado ? "Publicado" : "Apagado"}
                  {!n.esDueno && " · Colaborás"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/solutions/crear" className="mt-6 inline-flex text-[13.5px] font-bold text-aventurea-navy underline">
          + Crear otro negocio
        </Link>
      </section>
    </main>
  );
}
