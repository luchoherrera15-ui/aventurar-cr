import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETAS_CAPACIDAD, PLANES, PLANES_ID } from "@/lib/lealtad/planes";
import { datosDePagoBookea } from "@/lib/pagos-bookea";
import PlanesCliente, { type TarjetaPlan } from "./planes-cliente";
import type { NegocioElegible } from "./formulario-solicitud";

/**
 * Los paquetes del programa de lealtad — donde empieza la compra.
 *
 * El negocio NO se activa solo: elige paquete, deja la solicitud
 * (0126), a Bookea le llega el correo con los datos, y el equipo lo
 * genera desde /admin/complementos. Por eso no hay botón "pagar":
 * hay botón "solicitar".
 *
 * Llegan acá desde el dashboard de lealtad (negocio sin activar), del
 * banner "mejorá tu paquete" (upgrade — por eso los negocios YA activos
 * también aparecen en el selector), y de /lealtad/nuevo recién creado.
 */

const NAVY_PROFUNDO = "#0a1226";

export const metadata = { title: "Paquetes · Lealtad Bookea" };

export default async function PlanesLealtadPage({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>;
}) {
  const { negocio } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Los negocios del que mira (propios + donde colabora), para el
  // selector del formulario. Con la RLS de siempre — sin llave de
  // servicio: si no puede verlos, no puede pedir por ellos.
  let negocios: NegocioElegible[] = [];
  if (user) {
    const [{ data: propios }, { data: colaboraciones }] = await Promise.all([
      supabase.from("ranchos").select("id, nombre").eq("owner_id", user.id),
      supabase.from("rancho_colaboradores").select("rancho_id").eq("usuario_id", user.id),
    ]);
    const idsColab = ((colaboraciones ?? []) as { rancho_id: string }[]).map((c) => c.rancho_id);
    const { data: colaborados } = idsColab.length
      ? await supabase.from("ranchos").select("id, nombre").in("id", idsColab)
      : { data: [] };

    negocios = [
      ...new Map(
        [
          ...((propios ?? []) as NegocioElegible[]),
          ...((colaborados ?? []) as NegocioElegible[]),
        ].map((n) => [n.id, n] as const),
      ).values(),
    ];
  }

  const planes: TarjetaPlan[] = PLANES_ID.map((id) => {
    const def = PLANES[id];
    return {
      id,
      nombre: def.nombre,
      limite: def.limiteMiembros,
      precio: def.precioMensual,
      beneficios: def.capacidades.map((c) => ETIQUETAS_CAPACIDAD[c]),
      destacado: id === "enterprise",
    };
  });

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-[min(1040px,94vw)]">
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
          {user && (
            <Link
              href="/lealtad/panel"
              className="text-[12.5px] font-bold text-white/50 hover:text-white"
            >
              Mis negocios →
            </Link>
          )}
        </header>

        <h1 className="mt-10 text-[28px] font-extrabold leading-tight text-white">
          Elegí el paquete de tu programa
        </h1>
        <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-white/60">
          Dejás la solicitud y el equipo de Bookea genera el programa y la tarjeta por vos —
          con tus colores, tu logo y tu regalía, bien hecho desde el día uno.
        </p>

        <div className="mt-8">
          <PlanesCliente
            planes={planes}
            negocios={negocios}
            negocioInicial={negocio ?? null}
            conSesion={!!user}
            pago={datosDePagoBookea()}
          />
        </div>

        <p className="mt-8 text-center text-[12px] text-white/35">
          ¿Todavía no tenés el negocio en Bookea?{" "}
          <Link href="/lealtad/nuevo" className="font-bold underline">
            Crealo en dos campos
          </Link>{" "}
          — sin publicarte en el marketplace.
        </p>
      </div>
    </main>
  );
}
