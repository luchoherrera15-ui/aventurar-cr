import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { datosDePagoBookea } from "@/lib/pagos-bookea";
import { definicionDe, esPlanOfrecido, PLANES, precioDe } from "@/lib/lealtad/planes";
import { minutoISOCR } from "@/lib/fechas";
import {
  cupoLleno,
  lasQueOcupanCupo,
  tarjetaDelCupo,
} from "@/app/lealtad/panel/[id]/cupo-tarjetas";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import WizardAlta, { type PlanElegido, type RanchoWizard } from "./wizard-alta";

/**
 * EL ALTA EN CINCO PASOS, con la tarjeta formándose al lado.
 *
 * Dos entradas a la misma pantalla:
 *
 *   · `/lealtad/nuevo` (o `?plan=arranque|impulso|ilimitado`) — MODO
 *     COMPLETO: crea cuenta → negocio → tarjeta. El plan se valida con
 *     `esPlanOfrecido` y NUNCA con `esPlan`: los retirados dan
 *     SIN_TOPES, y elegir es distinto de tener. Sin plan (o con uno
 *     inválido) se cae al de Prueba.
 *
 *   · `/lealtad/nuevo?rancho={id}` — MODO SOLO-TARJETA: el negocio ya
 *     existe (por ejemplo, recién pagado por Stripe). Se comprueba acá,
 *     con la sesión, que el rancho sea DEL usuario; el plan sale de
 *     `plan_lealtad` de la base, no de la URL.
 *
 * Sin sesión, el primer paso es el formulario de siempre (correo, y
 * nombre solo si el correo es nuevo): crea la cuenta y vuelve
 * exactamente acá — con los mismos parámetros, para no perder ni el
 * plan elegido ni el negocio.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Tu programa de lealtad · Bookea" };

export default async function NuevoNegocioLealtadPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; rancho?: string }>;
}) {
  const { plan: planParam, rancho: ranchoParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── El paquete elegido (modo completo) ──────────────────────────
  const planPedido = planParam ?? null;
  const planId = esPlanOfrecido(planPedido) ? planPedido : "prueba";
  const def = PLANES[planId];
  const plan: PlanElegido = {
    id: planId,
    nombre: def.nombre,
    precio: precioDe(def),
    esGratis: def.precioMensual === 0,
    enDolares: def.precioMensual !== null && def.precioMensual !== 0,
  };

  // El destino del login conserva los parámetros: perder `?rancho=` en
  // la vuelta del correo mandaría a crear un negocio que ya existe.
  const parametros = new URLSearchParams();
  if (esPlanOfrecido(planPedido)) parametros.set("plan", planPedido);
  if (ranchoParam) parametros.set("rancho", ranchoParam);
  const consulta = parametros.toString();
  const destino = `/lealtad/nuevo${consulta ? `?${consulta}` : ""}`;

  // ── El negocio, si ya existe (modo solo-tarjeta) ────────────────
  // La consulta va con la SESIÓN del usuario y se exige `owner_id`
  // propio: un id ajeno en la URL simplemente cae al modo completo.
  // (Y `crearTarjeta` vuelve a verificar todo en el servidor.)
  let rancho: RanchoWizard | null = null;
  if (user && ranchoParam && UUID.test(ranchoParam)) {
    const { data } = await supabase
      .from("ranchos")
      .select("id, nombre, slug, plan_lealtad, owner_id")
      .eq("id", ranchoParam)
      .maybeSingle();
    if (data && data.owner_id === user.id) {
      const planRancho = (data.plan_lealtad as string | null) ?? null;

      // El tope de tarjetas, con el MISMO criterio que el panel y que
      // `crear-actions.ts` (cupo-tarjetas.ts): si ya está lleno, el
      // asistente muestra el upsell en vez de un formulario que va a
      // rebotar al final.
      let tarjetasLlenas = false;
      const tope = definicionDe(planRancho)?.limites.programas ?? null;
      if (tope !== null) {
        const { data: filas } = await supabase
          .from("programa_lealtad")
          .select("*")
          .eq("rancho_id", data.id as string);
        const ocupadas = lasQueOcupanCupo(
          ((filas ?? []) as Record<string, unknown>[]).map(tarjetaDelCupo),
          minutoISOCR(),
        );
        tarjetasLlenas = cupoLleno({ ocupadas: ocupadas.length, tope });
      }

      rancho = {
        id: data.id as string,
        nombre: (data.nombre as string) ?? "Tu negocio",
        slug: (data.slug as string | null) ?? null,
        plan: planRancho,
        tarjetasLlenas,
      };
    }
  }

  return (
    // Fondo claro con los tokens de `.lealtad` (los pone el layout del
    // módulo): es la misma gramática visual del creador del panel.
    <main className="min-h-svh px-5 py-5 sm:py-6" style={{ background: "var(--bg)" }}>
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between">
        <Link href="/lealtad">
          <Image
            src="/logo-bookea-nav-v3.png"
            alt="Bookea"
            width={110}
            height={34}
            className="h-[24px] w-auto"
          />
        </Link>
        <Link
          href={rancho ? `/lealtad/panel/${rancho.id}` : "/lealtad"}
          className="text-[12.5px] font-bold text-bookea-gris hover:text-bookea-tinta"
        >
          ← Volver
        </Link>
      </header>

      {/* El asistente manda: sin titulón compitiendo con la pregunta de
          turno — el título de cada paso ES el mensaje. */}
      <div className="mx-auto w-full max-w-[1100px] py-8">
        {user ? (
          <WizardAlta plan={plan} pago={datosDePagoBookea()} rancho={rancho} />
        ) : (
          <div className="mx-auto w-[min(520px,94vw)] rounded-3xl border border-bookea-linea bg-white p-6">
            {/* El paso 0: la cuenta. El MISMO login de /cuenta — crea
                la cuenta con correo y nombre si es nueva, y vuelve
                exactamente acá para seguir con el negocio. */}
            <FormularioAuth
              destino={destino}
              intro="Primero tu cuenta: escribí tu correo — si ya tenés cuenta entrás directo, y si es tu primera vez te la creamos ahí mismo, solo hace falta tu nombre. Después seguís con tu negocio."
            />
          </div>
        )}
      </div>
    </main>
  );
}
