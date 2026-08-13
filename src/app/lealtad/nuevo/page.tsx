import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { datosDePagoBookea } from "@/lib/pagos-bookea";
import {
  ETIQUETAS_CAPACIDAD,
  PLANES,
  PLANES_OFRECIDOS,
  PLAN_DESTACADO,
  precioDe,
} from "@/lib/lealtad/planes";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import WizardAlta, { type PlanWizard } from "./wizard-alta";

/**
 * El alta COMPLETA en un solo camino (0130): cuenta → negocio (con
 * «otro» como tipo) → paquete → depósito con comprobante → solicitud.
 * El negocio NO se crea acá: nace cuando Bookea acepta la solicitud —
 * si se rechaza, no queda nada.
 *
 * Sin sesión, el primer paso es el formulario de siempre (correo, y
 * nombre solo si el correo es nuevo): crea la cuenta y vuelve
 * exactamente acá.
 */

const NAVY_PROFUNDO = "#0a1226";

export const metadata = { title: "Tu programa de lealtad · Bookea" };

export default async function NuevoNegocioLealtadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const planes: PlanWizard[] = PLANES_OFRECIDOS.map((id) => {
    const def = PLANES[id];
    return {
      id,
      nombre: def.nombre,
      limite: def.limites.clientesActivos,
      precio: precioDe(def),
      esGratis: def.precioMensual === 0,
      enDolares: def.precioMensual !== null && def.precioMensual !== 0,
      beneficios: def.capacidades.slice(0, 4).map((c) => ETIQUETAS_CAPACIDAD[c]),
      masBeneficios: Math.max(0, def.capacidades.length - 4),
      destacado: id === PLAN_DESTACADO,
    };
  });

  return (
    // Centrado vertical y sin scroll: un onboarding de una pregunta por
    // pantalla no debe hacer scrollear — si la página se estira a lo
    // alto, el formato pierde justo lo que lo hace ligero.
    <main
      className="flex min-h-svh flex-col px-5 py-5 sm:py-6"
      style={{ background: NAVY_PROFUNDO }}
    >
      <header className="mx-auto flex w-full max-w-[1060px] shrink-0 items-center justify-between">
        <Link href="/lealtad">
          <Image
            src="/logo-bookea-blanco-v3.png"
            alt="Bookea"
            width={110}
            height={28}
            className="h-[24px] w-auto"
          />
        </Link>
        <Link href="/lealtad" className="text-[12.5px] font-bold text-white/50 hover:text-white">
          ← Volver
        </Link>
      </header>

      {/* El wizard manda: sin titulón ni párrafo de intro compitiendo con
          la pregunta de turno — el título de cada pantalla ES el mensaje. */}
      <div className="mx-auto flex w-full max-w-[1060px] flex-1 items-center py-6">
        <div className="w-full">
          {user ? (
            <WizardAlta planes={planes} pago={datosDePagoBookea()} />
          ) : (
            <div className="mx-auto w-[min(520px,94vw)] rounded-2xl bg-white p-6">
              {/* El paso 0: la cuenta. El MISMO login de /cuenta — crea
                  la cuenta con correo y nombre si es nueva, y vuelve
                  exactamente acá para seguir con el negocio. */}
              <FormularioAuth
                destino="/lealtad/nuevo"
                intro="Primero tu cuenta: escribí tu correo — si ya tenés cuenta entrás directo, y si es tu primera vez te la creamos ahí mismo, solo hace falta tu nombre. Después seguís con tu negocio."
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
