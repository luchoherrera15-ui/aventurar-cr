import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { hiloAbiertoDeAyuda } from "@/lib/lealtad/ayuda-hilo";
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
    .select("nombre, plan_lealtad")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) redirect("/lealtad/panel");

  // EL PAQUETE, para saber qué tipos de tarjeta se pueden elegir (0142).
  // Se resuelve igual que en `crear-actions.ts` —cuenta primero, rancho
  // de respaldo— para que la pantalla muestre exactamente lo que el
  // servidor va a aceptar. Dos criterios distintos serían un dueño
  // eligiendo un tipo que después le rebota.
  const admin = createAdminClient();
  const { data: cuenta } = admin
    ? await admin.from("cuentas").select("id").eq("rancho_id", id).maybeSingle()
    : { data: null };
  const { plan } = admin
    ? await contextoDeCuenta(admin, cuenta?.id ? { cuenta_id: cuenta.id as string } : {}, {
        planRancho: (rancho.plan_lealtad as string | null) ?? null,
      })
    : { plan: (rancho.plan_lealtad as string | null) ?? null };

  // EL HILO DE AYUDA (0149), si ya hay uno abierto. Se trae acá y no se
  // pide desde el navegador para que el bloque abra mostrando la
  // conversación de una: recargar la página no puede hacer parecer que
  // el pedido nunca se mandó.
  const ayuda = admin ? await hiloAbiertoDeAyuda(admin, id) : null;

  // La cuenta de la 0134 ya NO se busca acá. Se buscaba para pasársela
  // al asistente y que él la devolviera al guardar — un rodeo por el
  // navegador que abría el agujero: el servidor terminaba confiando en
  // un `cuenta_id` que había salido de la pantalla. Ahora `crearTarjeta`
  // la deriva del `ranchoId` que ya verificó.

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
        {/* Las dos mitades de este texto eran falsas y se corrigieron.
            «Nace en borrador» dejó de ser cierto cuando la tarjeta pasó
            a nacer activa (`estado-inicial.ts`), y «podés cambiar todo
            después» no lo era todavía: el beneficio y las reglas solo
            se escribían al crear. Ahora se cambian desde el editor de
            la tarjeta, y lo único que se congela es el tipo — en cuanto
            hay un cliente adentro. Eso es lo que dice el texto. */}
        <p className="mt-1.5 max-w-[560px] text-[14px] leading-relaxed text-bookea-gris">
          Cinco pasos y queda publicada: apenas termines, tus clientes ya la pueden llevar en
          el teléfono. Después podés cambiarle el beneficio, las reglas, las regalías y el
          diseño — el tipo de tarjeta queda fijo en cuanto se afilie el primer cliente.
        </p>

        <div className="mt-7">
          <CreadorTarjeta
            ranchoId={id}
            negocioNombre={rancho.nombre as string}
            plan={plan}
            ayudaInicial={ayuda}
          />
        </div>
      </div>
    </main>
  );
}
