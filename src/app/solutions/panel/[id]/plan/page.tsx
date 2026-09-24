import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { negocioPorId } from "@/lib/solutions/datos";
import { PLAN_LINKSY, PLANES_LINKSY, esPro } from "@/lib/solutions/planes";
import { IconCheck } from "@/components/icons";
import MarcoLinksy from "../marco-linksy";
import { navDelPanel } from "../nav-datos";
import { LP_BAJADA, LP_BOTON, LP_BOTON_LIMA, LP_BOTON_SUAVE, LP_CIFRA, LP_DETALLE, LP_EYEBROW, LP_PILDORA_LIMA, LP_PILDORA_VELO, LP_TILE, LP_TITULO_TILE, bloque } from "../sistema-linksy";

export const metadata: Metadata = { title: "Plan · Bookea" };

/**
 * /solutions/panel/[id]/plan — LAS DOS MEMBRESÍAS, LADO A LADO.
 *
 * Como la página de precios de Linktree, pero con dos escalones y con
 * el plan del negocio marcado. «Pasar a Pro» abre el chat de ayuda:
 * hoy Pro lo activa Bookea a mano (no hay pasarela); cuando la haya,
 * ese botón será el checkout. Solo el dueño: el plan es plata.
 */
export default async function PlanLinksyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await verificarAccesoSolutions(id);
  if (!acceso.user) redirect("/cuenta?volver=solutions");
  if (!acceso.ok) redirect("/solutions/panel");
  if (!acceso.esDueno) redirect(`/solutions/panel/${id}`);

  const admin = createAdminClient();
  if (!admin) notFound();
  const negocio = await negocioPorId(admin, id);
  if (!negocio) notFound();
  const marco = await navDelPanel(admin, negocio, acceso);
  const pro = esPro(negocio.plan);
  const mensajeAyuda = encodeURIComponent(`Hola, quiero activar el plan Pro para «${negocio.nombre}» (${negocio.slug}).`);

  return (
    <MarcoLinksy negocio={marco.barra} items={marco.items} activo="plan" titulo="Tu plan" bajada="Gratis para estar en la calle hoy. Pro para que tu página sea exactamente como la imaginás.">
      <div className="grid gap-5 lg:grid-cols-2">
        {PLANES_LINKSY.map((p) => {
          const def = PLAN_LINKSY[p];
          const esEste = negocio.plan === p;
          const esProTile = p === "pro";
          return (
            <section key={p} className={`${LP_TILE} flex flex-col`} style={bloque(esProTile ? "carbon" : "celeste")}>
              <div className="flex items-start justify-between gap-3">
                <p className={LP_EYEBROW}>Plan {def.nombre}</p>
                {esEste ? <span className={LP_PILDORA_LIMA}>Tu plan</span> : esProTile ? <span className={LP_PILDORA_VELO}>Recomendado</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className={LP_CIFRA}>{def.precioMes === 0 ? "US$0" : `US$${def.precioMes}`}</span>
                <span className="text-[15px] font-extrabold opacity-70">/ mes</span>
              </div>
              <p className={`mt-3 ${LP_BAJADA}`}>{def.bajada}</p>
              <ul className="mt-5 flex flex-col gap-2">
                {def.incluye.map((x) => (
                  <li key={x} className="flex items-start gap-2.5 text-[14px] font-semibold">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={esProTile ? bloque("lima") : { background: "rgba(255,255,255,.7)", color: "var(--linksy-tinta)" }}>
                      <IconCheck className="h-3 w-3" />
                    </span>
                    {x}
                  </li>
                ))}
                {esProTile && <li className={`mt-1 ${LP_DETALLE}`}>Y todo lo del plan Gratis.</li>}
              </ul>
              <div className="mt-auto pt-6">
                {esEste ? (
                  <span className={`${LP_BOTON_SUAVE} cursor-default`}>{esProTile ? "Ya tenés Pro" : "Es tu plan de ahora"}</span>
                ) : esProTile ? (
                  <Link href={`/ayuda?mensaje=${mensajeAyuda}`} className={LP_BOTON_LIMA}>
                    Quiero Pro →
                  </Link>
                ) : (
                  <Link href={`/ayuda?mensaje=${encodeURIComponent(`Hola, quiero volver al plan Gratis para «${negocio.nombre}».`)}`} className={LP_BOTON}>
                    Volver a Gratis
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className={`${LP_TILE} mt-5`} style={bloque("papel")}>
        <h2 className={LP_TITULO_TILE}>Cómo se activa Pro</h2>
        <p className={`mt-2 ${LP_BAJADA}`}>
          {pro
            ? "Tu plan Pro está activo. Si querés cambiar algo del cobro o volver a Gratis, escribinos desde el chat de ayuda."
            : "Tocá «Quiero Pro» y se abre el chat de ayuda con el mensaje listo. El equipo de Bookea lo activa el mismo día y te confirma por ahí. Los add-ons (catálogo, ventas, lealtad) van aparte y hoy son gratis en prueba."}
        </p>
        <p className={`mt-3 ${LP_DETALLE}`}>Los precios son de lista en dólares, iguales para toda Latinoamérica.</p>
      </section>
    </MarcoLinksy>
  );
}
