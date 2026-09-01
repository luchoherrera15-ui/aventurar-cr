import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { datosDePagoBookea } from "@/lib/pagos-bookea";
import { esPlanOfrecido, PLANES, PLANES_ID, precioDe } from "@/lib/lealtad/planes";
import WizardAlta, { type PlanElegido } from "@/app/lealtad/nuevo/wizard-alta";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /admin/lealtad/nuevo — CREARLE EL PASE A UN CLIENTE
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 sep 2026): «poder crearle pases de lealtad a
 * usuarios desde la administración; mismos pasos, uno elige qué tipo de
 * plan quiere y le configura la tarjeta, y al final pone el correo de la
 * persona que será el administrador de ese pase».
 *
 * ------------------------------------------------------------------
 * ES EL MISMO ASISTENTE, NO UNA COPIA PARA ADMIN
 * ------------------------------------------------------------------
 * `WizardAlta` es literalmente el componente de `/lealtad/nuevo`, con
 * `admin` prendido. Eso es lo que hace verdadera la frase «mismos
 * pasos»: los cinco pasos de armar la tarjeta —nombre, rubro y tipo,
 * beneficio, apariencia, revisar— son EL MISMO CÓDIGO, con las mismas
 * validaciones y las mismas opciones. Una pantalla aparte para el admin
 * se habría separado del creador real en la primera semana.
 *
 * En modo admin el asistente agrega un paso («¿A nombre de quién
 * queda?») y saca el bloque de pago. Nada más.
 *
 * ------------------------------------------------------------------
 * EL PAQUETE SE ELIGE ACÁ, ANTES DE ENTRAR
 * ------------------------------------------------------------------
 * Igual que en el alta pública, el paquete viaja en `?plan=`: es lo que
 * decide qué TIPOS de tarjeta se pueden elegir después (Starter no
 * incluye membresías ni gift cards). Elegirlo al final habría dejado al
 * admin armando una tarjeta que el paquete no admite.
 */

export const metadata = { title: "Crear pase · Lealtad" };

export default async function NuevoPaseAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { ok } = await requireAdmin();
  if (!ok) redirect("/admin");

  const { plan: planParam } = await searchParams;

  // ── Paso 0: el paquete ──────────────────────────────────────────
  const elegido = planParam ?? null;
  if (!esPlanOfrecido(elegido)) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <Encabezado />
        <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
          Elegí con qué paquete nace el pase. Eso decide qué tipos de tarjeta vas a poder
          armar en el paso siguiente.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {PLANES_ID.filter((id) => PLANES[id].vigente).map((id) => {
            const def = PLANES[id];
            return (
              <Link
                key={id}
                href={`/admin/lealtad/nuevo?plan=${id}`}
                className="elevar rounded-2xl border border-aventurea-line bg-white p-5"
              >
                <p className="text-[15px] font-extrabold text-aventurea-navy">{def.nombre}</p>
                <p className="mt-0.5 text-[13px] font-bold text-aventurea-ink-soft">
                  {precioDe(def) ?? "A convenir"}
                </p>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                  {def.limites.programas === null
                    ? "Tarjetas ilimitadas"
                    : `Hasta ${def.limites.programas} tarjeta${def.limites.programas === 1 ? "" : "s"}`}
                </p>
              </Link>
            );
          })}
        </div>

        {/* Dicho antes de elegir, no después de crear: este formulario
            no cobra nada. */}
        <p className="mt-5 rounded-xl border border-aventurea-line bg-aventurea-cream-2/60 px-4 py-3 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          <span className="font-bold text-aventurea-ink">Ojo:</span> el pase nace con el
          paquete puesto y <span className="font-bold">sin suscripción de Stripe</span>. La
          plata se cobra por fuera; acá solo se le deja el pase listo.
        </p>
      </div>
    );
  }

  const def = PLANES[elegido];
  const plan: PlanElegido = {
    id: elegido,
    nombre: def.nombre,
    precio: precioDe(def),
    esGratis: def.precioMensual === 0,
    enDolares: def.precioMensual !== null && def.precioMensual !== 0,
  };

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <Encabezado />
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] text-aventurea-ink-soft">
        <span>
          Paquete: <span className="font-bold text-aventurea-ink">{plan.nombre}</span>
        </span>
        <Link
          href="/admin/lealtad/nuevo"
          className="text-[12.5px] font-bold underline"
          style={{ color: "var(--accion)" }}
        >
          cambiar
        </Link>
      </p>

      {/* `lealtad` es lo que le da al asistente la paleta del módulo: el
          mismo contenedor que envuelve /lealtad/nuevo. Sin él, los
          `var(--accion)` del wizard resuelven a los del marketplace y la
          pantalla sale de otro color. */}
      <div className="lealtad mt-6">
        <WizardAlta plan={plan} pago={datosDePagoBookea()} admin />
      </div>
    </div>
  );
}

function Encabezado() {
  return (
    <>
      <Link
        href="/admin/lealtad"
        className="text-[12.5px] font-bold text-aventurea-ink-soft hover:underline"
      >
        ← Lealtad
      </Link>
      <h1 className="mt-2 text-[24px] font-extrabold text-aventurea-navy">
        Crearle el pase a un cliente
      </h1>
    </>
  );
}
