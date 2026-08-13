import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { datosDePagoBookea } from "@/lib/pagos-bookea";
import { ETIQUETAS_CAPACIDAD, PLANES, PLANES_ID } from "@/lib/lealtad/planes";
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

  const planes: PlanWizard[] = PLANES_ID.map((id) => {
    const def = PLANES[id];
    return {
      id,
      nombre: def.nombre,
      limite: def.limiteMiembros,
      precio: def.precioMensual,
      beneficios: def.capacidades.slice(0, 4).map((c) => ETIQUETAS_CAPACIDAD[c]),
      masBeneficios: Math.max(0, def.capacidades.length - 4),
      destacado: id === "enterprise",
    };
  });

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-[min(720px,94vw)]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v3.png"
              alt="Bookea"
              width={132}
              height={33}
              className="h-[30px] w-auto"
            />
          </Link>
          <Link href="/lealtad" className="text-[12.5px] font-bold text-white/50 hover:text-white">
            ← Volver
          </Link>
        </header>

        <h1 className="mt-10 text-[26px] font-extrabold leading-tight text-white">
          Tu programa de lealtad, en cuatro pasos
        </h1>
        <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-white/60">
          Contanos de tu negocio, elegí el paquete y dejá tu depósito. El equipo de
          Bookea revisa la solicitud: si la acepta, tu negocio y tu programa quedan
          creados — te avisamos al correo.
        </p>

        <div className="mt-8">
          {user ? (
            <WizardAlta planes={planes} pago={datosDePagoBookea()} />
          ) : (
            <div className="rounded-2xl bg-white p-6">
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
