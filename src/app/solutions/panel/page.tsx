import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { negociosDeLaCuenta } from "@/lib/solutions/acceso";
import { ADDON, ADDONS, addonsDeVarios } from "@/lib/solutions/addons";
import { estadoDelPerfil } from "@/lib/solutions/perfil";
import CompletarPerfil from "./completar-perfil";
import { BarraLinksy } from "./[id]/nav-linksy";
import { LP_BAJADA, LP_BOTON_CHICO, LP_EYEBROW, LP_PILDORA_LIMA, LP_PILDORA_VELO, LP_TILE, LP_TITULO, LP_TITULO_TILE, bloque, type Bloque } from "./[id]/sistema-linksy";

export const metadata: Metadata = { title: "Mis páginas · Linksy" };

/** Un color por negocio, rotando la paleta: así la lista se reconoce de un vistazo. */
const COLORES: Bloque[] = ["celeste", "lima", "lila", "amarillo", "menta", "coral"];

/**
 * /solutions/panel — MIS PÁGINAS: los negocios de la cuenta (propios y
 * donde colabora), en la línea de Linksy (7 sep 2026). Con un solo
 * negocio se entra directo a su panel; con ninguno, a crear.
 */
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
    <main className={`linksy linksy-panel min-h-svh bg-[var(--linksy-fondo-panel)] text-[var(--linksy-tinta)] ${CLASES_FUENTES}`}>
      <BarraLinksy />
      <section className="mx-auto w-[min(1200px,100%)] px-3 py-6 sm:px-5 lg:py-8">
        <div className="px-1">
          <p className={LP_EYEBROW}>Tu cuenta</p>
          <h1 className={`mt-3 ${LP_TITULO}`}>Tus páginas</h1>
          <p className={`mt-2 ${LP_BAJADA}`}>
            {negocios.length} negocios en esta cuenta. Entrá a cualquiera para editarlo, ver sus pedidos o su tarjeta de lealtad.
          </p>
        </div>

        <ul className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {negocios.map((n, i) => {
            const prendidos = ADDONS.filter((a) => a !== "linkhub" && addons[n.id]?.[a]).map((a) => ADDON[a].nombre);
            return (
              <li key={n.id}>
                <article className={`${LP_TILE} flex min-h-[250px] flex-col`} style={bloque(COLORES[i % COLORES.length])}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[20px] font-extrabold" style={{ background: "rgba(255,255,255,.6)", color: "var(--linksy-tinta)" }}>
                      {n.nombre.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className={n.publicado ? LP_PILDORA_LIMA : LP_PILDORA_VELO}>{n.publicado ? "Publicada" : "Apagada"}</span>
                  </div>
                  <h2 className={`mt-5 ${LP_TITULO_TILE}`}>{n.nombre}</h2>
                  <p className="mt-1.5 truncate text-[13.5px] font-bold opacity-75">
                    linksy.lat/{n.slug}
                    {!n.esDueno && " · colaborás"}
                  </p>
                  {prendidos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {prendidos.map((p) => (
                        <span key={p} className={LP_PILDORA_VELO}>
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-5">
                    <Link href={`/solutions/panel/${n.id}`} className={LP_BOTON_CHICO}>
                      Abrir el panel →
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
          <li>
            <Link href="/solutions/crear" className={`${LP_TILE} presionable flex min-h-[250px] flex-col items-start justify-between border-2 border-dashed border-black/15 text-[var(--linksy-tinta)] hover:border-black/40`}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--linksy-papel)] text-[26px] font-extrabold leading-none shadow-plano">+</span>
              <span>
                <span className={`block ${LP_TITULO_TILE}`}>Crear otra página</span>
                <span className="mt-1.5 block text-[13.5px] font-semibold opacity-70">Otro local, otra marca. Gratis.</span>
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
