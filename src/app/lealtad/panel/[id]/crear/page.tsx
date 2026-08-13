import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CreadorTarjeta from "../creador-tarjeta";

/**
 * EL CREADOR DE TARJETAS — pantalla propia y no una sección del panel.
 *
 * Es una decisión de foco: el asistente necesita el ancho entero para
 * el formulario más la vista previa pegada al costado, y el menú
 * lateral del panel le comería justo esa columna. Además, crear una
 * tarjeta es una tarea con principio y fin — no un lugar donde uno se
 * queda.
 *
 * La puerta de acceso la pone `verificarAccesoLealtad`, y la server
 * action la vuelve a poner por su cuenta: llegar a esta URL sin
 * permiso pinta la pantalla pero no guarda nada.
 */

export const metadata = { title: "Crear tarjeta · Lealtad Bookea" };

export default async function CrearTarjetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  // Crear tarjetas es del DUEÑO: define la identidad y la plata del
  // programa. El colaborador de mostrador opera, no diseña.
  if (!acceso.ok || !(acceso.esDueno || acceso.esAdmin)) {
    redirect(`/lealtad/panel/${id}`);
  }

  const { data: rancho } = await acceso.supabase
    .from("ranchos")
    .select("nombre")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) redirect("/lealtad/panel");

  // La cuenta de la 0134, si ya existe. `maybeSingle` y no `single`:
  // mientras la migración no esté corrida, la tabla no existe y esto
  // devuelve null sin romper la pantalla.
  const admin = createAdminClient();
  const { data: cuenta } = admin
    ? await admin.from("cuentas").select("id").eq("rancho_id", id).maybeSingle()
    : { data: null };

  return (
    <main className="min-h-svh" style={{ background: "var(--grey)" }}>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/lealtad/panel/${id}`}
          className="text-[12.5px] font-bold text-bookea-gris hover:text-bookea-azul"
        >
          ← Volver al panel
        </Link>

        <h1 className="mt-4 text-[26px] font-extrabold leading-tight text-bookea-tinta sm:text-[30px]">
          Crear una tarjeta
        </h1>
        <p className="mt-1.5 max-w-[560px] text-[14px] leading-relaxed text-bookea-gris">
          Cinco pasos y queda lista para que tus clientes la lleven en el teléfono. Podés
          cambiar todo después — nace en borrador.
        </p>

        <div className="mt-7">
          <CreadorTarjeta
            cuentaId={(cuenta?.id as string | undefined) ?? null}
            ranchoId={id}
            negocioNombre={rancho.nombre as string}
          />
        </div>
      </div>
    </main>
  );
}
