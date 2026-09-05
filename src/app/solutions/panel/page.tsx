import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import NavSolutions from "../nav-solutions";
import { negociosDeLaCuenta } from "@/lib/solutions/acceso";
import { ADDON, ADDONS, addonsDeVarios } from "@/lib/solutions/addons";
import { estadoDelPerfil } from "@/lib/solutions/perfil";
import CompletarPerfil from "./completar-perfil";

export const metadata: Metadata = { title: "Mis negocios · Bookea Solutions" };

/** /solutions/panel — la lista de negocios de la cuenta (propios y donde colabora). */
export default async function PanelSolutionsIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta?volver=solutions");

  // El primer ingreso (5 sep 2026): nombre y teléfono antes de todo.
  const perfil = await estadoDelPerfil(user);
  if (perfil.falta && !perfil.esAdmin) {
    return <CompletarPerfil correo={user.email ?? ""} nombreInicial={perfil.nombre} />;
  }

  const negocios = await negociosDeLaCuenta();
  if (negocios.length === 0) redirect("/solutions/crear");
  if (negocios.length === 1) redirect(`/solutions/panel/${negocios[0].id}`);

  // Qué tiene prendido cada uno (0233), para que la lista diga algo
  // más que el nombre.
  const admin = createAdminClient();
  const addons = admin ? await addonsDeVarios(admin, negocios.map((n) => n.id)) : {};

  return (
    <main className="min-h-svh bg-[#f7f9fc]">
      <NavSolutions logueado nombre={null} />
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
                <p className="mt-2 text-[12px] font-bold text-aventurea-ink-soft">
                  {ADDONS.filter((a) => addons[n.id]?.[a]).map((a) => ADDON[a].nombre).join(" · ")}
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
