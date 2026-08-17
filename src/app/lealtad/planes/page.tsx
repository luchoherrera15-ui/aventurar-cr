import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  etiquetasDeCapacidades,
  PLANES,
  PLANES_OFRECIDOS,
  PLAN_DESTACADO,
  precioDe,
} from "@/lib/lealtad/planes";
import { datosDePagoBookea } from "@/lib/pagos-bookea";
import { planesConPrecio } from "@/lib/pagos/precios";
import PlanesCliente, { type TarjetaPlan } from "./planes-cliente";
import type { NegocioElegible } from "./formulario-solicitud";

/**
 * Los paquetes del programa de lealtad — donde empieza la compra.
 *
 * Hay DOS caminos para comprar, y la diferencia se dice en pantalla:
 *
 *  · CON TARJETA (Stripe): el paquete queda activo al instante, sin que
 *    nadie revise nada. Si la persona todavía no tiene negocio en
 *    Bookea, el negocio se crea solo cuando el cobro se confirma.
 *  · POR SINPE o transferencia: deposita, adjunta la captura, deja la
 *    solicitud (0126/0130) y el equipo la atiende desde
 *    /admin/complementos. Es el camino de siempre y no se toca: muchas
 *    tarjetas costarricenses vienen bloqueadas para compras
 *    internacionales y la LLC cobra desde Estados Unidos.
 *
 * Sin llaves de Stripe configuradas, `planesConPrecio()` devuelve vacío
 * y esta pantalla se ve y funciona EXACTAMENTE como antes: solo SINPE.
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
  searchParams: Promise<{ negocio?: string; pago?: string }>;
}) {
  const { negocio, pago } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── De vuelta de Stripe con el negocio YA creado ──────────────────
  // A /lealtad/planes solo vuelve el checkout de un negocio NUEVO (el
  // upgrade vuelve a su panel). Si el webhook ya corrió, la solicitud
  // de alta quedó atendida y apuntando al rancho que creó — y ese
  // negocio pagó pero todavía no tiene NINGUNA tarjeta, porque el pago
  // con tarjeta no arma programa (a diferencia del alta del creador).
  // En ese caso el siguiente paso no es esta pantalla: es armar la
  // primera tarjeta, y el wizard lo hace con /lealtad/nuevo?rancho=….
  // Si el webhook todavía no terminó, no hay rancho que buscar y se
  // queda el aviso de siempre («en unos segundos»).
  if (pago === "listo" && user) {
    const admin = createAdminClient();
    if (admin) {
      const { data: solicitud } = await admin
        .from("solicitudes_lealtad")
        .select("rancho_id")
        .eq("solicitante_id", user.id)
        .eq("estado", "atendida")
        .not("rancho_id", "is", null)
        .order("atendida_en", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ranchoPagado = (solicitud?.rancho_id as string | null) ?? null;
      if (ranchoPagado) {
        const { data: programa } = await admin
          .from("programa_lealtad")
          .select("id")
          .eq("rancho_id", ranchoPagado)
          .limit(1)
          .maybeSingle();
        // Con programa ya armado NO se redirige: sería mandar a crear
        // una tarjeta que ya existe (o pisar la de una compra vieja).
        if (!programa) redirect(`/lealtad/nuevo?rancho=${ranchoPagado}`);
      }
    }
  }

  // Los negocios del que mira (propios + donde colabora), para el
  // selector del formulario. El filtro real de seguridad es
  // `owner_id`/colaborador, calculado acá mismo — la llave de servicio
  // (desde la 0155) es solo para poder pedir `*` sobre `ranchos` sin
  // mantener una lista de columnas a mano (`authenticated` ya no tiene
  // permiso de tabla completa, y Postgres no deja `select("*")` con
  // permiso por columna). Nunca se le muestra nada de otro negocio: la
  // consulta sigue acotada a `owner_id`/`idsColab` de este usuario.
  let negocios: NegocioElegible[] = [];
  if (user) {
    const db = createAdminClient() ?? supabase;
    // `select *`: lealtad_aprobado_en es de la 0129 y puede no existir.
    const [{ data: propios }, { data: colaboraciones }] = await Promise.all([
      db.from("ranchos").select("*").eq("owner_id", user.id),
      supabase.from("rancho_colaboradores").select("rancho_id").eq("usuario_id", user.id),
    ]);
    const idsColab = ((colaboraciones ?? []) as { rancho_id: string }[]).map((c) => c.rancho_id);
    const { data: colaborados } = idsColab.length
      ? await db.from("ranchos").select("*").in("id", idsColab)
      : { data: [] };

    type Fila = { id: string; nombre: string; lealtad_aprobado_en?: string | null };
    const candidatos = [
      ...new Map(
        [...((propios ?? []) as Fila[]), ...((colaborados ?? []) as Fila[])]
          // Un negocio en revisión (0129) no puede solicitar plan: ni
          // siquiera aparece en el selector — la acción lo re-verifica.
          .filter((n) => !("lealtad_aprobado_en" in n) || n.lealtad_aprobado_en !== null)
          .map((n) => [n.id, { id: n.id, nombre: n.nombre }] as const),
      ).values(),
    ];

    // Lealtad se separó por completo del resto del sitio (14 ago 2026):
    // acá solo aparecen negocios que YA TIENEN programa (el upgrade que
    // el banner "mejorá tu paquete" promete). Un negocio de Citas,
    // Eventos o Restaurantes que nunca tuvo lealtad ya NO se ofrece acá
    // — eso era lo que mezclaba negocios reales del directorio con
    // pases (el caso de Rancho Las Torres). Para arrancar de cero, el
    // camino es el nombre nuevo (alta en frío), más abajo en esta misma
    // pantalla.
    if (candidatos.length) {
      const { data: conPrograma } = await supabase
        .from("programa_lealtad")
        .select("rancho_id")
        .in(
          "rancho_id",
          candidatos.map((n) => n.id),
        );
      const idsConPrograma = new Set(
        ((conPrograma ?? []) as { rancho_id: string }[]).map((p) => p.rancho_id),
      );
      negocios = candidatos.filter((n) => idsConPrograma.has(n.id));
    }
  }

  const planes: TarjetaPlan[] = PLANES_OFRECIDOS.map((id) => {
    const def = PLANES[id];
    return {
      id,
      nombre: def.nombre,
      limite: def.limites.clientesActivos,
      precio: precioDe(def),
      esGratis: def.precioMensual === 0,
      enDolares: def.precioMensual !== null && def.precioMensual !== 0,
      // Plan por plan y no `ETIQUETAS_CAPACIDAD` suelto: la viñeta de
      // los tipos de tarjeta depende del paquete desde el reparto de la
      // 0142 («Tarjetas de sellos y puntos» ≠ «Los 8 tipos»).
      beneficios: etiquetasDeCapacidades(def),
      destacado: id === PLAN_DESTACADO,
    };
  });

  // Qué se puede cobrar con tarjeta HOY en este servidor. Un paquete sin
  // su variable STRIPE_PRICE_… puesta no muestra botón, en vez de
  // mostrar uno que lleva a un error. Lista vacía = no hay Stripe y la
  // pantalla queda como siempre.
  const conTarjeta = planesConPrecio().map(({ plan, periodos }) => ({
    plan,
    periodos: [...periodos] as string[],
  }));

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[1040px]">
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
          {conTarjeta.length > 0
            ? "Pagás con tarjeta y tu programa queda activo al instante. Si preferís SINPE, depositás y el equipo de Bookea te lo deja andando."
            : "Dejás la solicitud y el equipo de Bookea genera el programa y la tarjeta por vos — con tus colores, tu logo y tu regalía, bien hecho desde el día uno."}
        </p>

        {/* ── De vuelta de Stripe ────────────────────────────────────
            «En unos segundos» y no «listo»: el paquete lo confirma el
            webhook con un evento firmado, no esta página —que se abre
            escribiendo la URL—. Decir que ya está y que después no
            aparezca es peor que pedir diez segundos. */}
        {pago === "listo" && (
          <p className="mt-6 rounded-2xl bg-emerald-500/15 px-4 py-3.5 text-[13.5px] font-bold leading-relaxed text-emerald-200">
            Recibimos tu pago. Tu programa queda listo en unos segundos, apenas Stripe lo
            confirme — te llega un correo y lo vas a ver en{" "}
            <Link href="/lealtad/panel" className="underline">
              Mis negocios
            </Link>
            .
          </p>
        )}
        {pago === "cancelado" && (
          <p className="mt-6 rounded-2xl bg-white/10 px-4 py-3.5 text-[13.5px] font-bold leading-relaxed text-white/80">
            No se cobró nada: se cerró el pago antes de terminar. Podés volver a intentarlo o
            pagar por SINPE.
          </p>
        )}

        <div className="mt-8">
          <PlanesCliente
            planes={planes}
            negocios={negocios}
            negocioInicial={negocio ?? null}
            conSesion={!!user}
            pago={datosDePagoBookea()}
            conTarjeta={conTarjeta}
          />
        </div>

        {/* Ya NO dice «crealo primero»: desde acá se compra sin tener
            negocio, con tarjeta o con SINPE. Lo que sigue ofreciendo
            /lealtad/nuevo es OTRA cosa —elegir color, logo, regalía y
            meta de sellos en el mismo trámite—, así que queda como
            alternativa y no como requisito. */}
        <p className="mt-8 text-center text-[12px] text-white/35">
          ¿Preferís armar la tarjeta de una vez?{" "}
          <Link href="/lealtad/nuevo" className="font-bold underline">
            Elegí color, logo y regalía acá
          </Link>{" "}
          — sin publicarte en el marketplace.
        </p>
      </div>
    </main>
  );
}
