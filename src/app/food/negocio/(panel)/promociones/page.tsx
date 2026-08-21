import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import { hoyISOCR } from "@/lib/fechas";
import { PROMOS_DEMO } from "@/lib/food/panel-demo";
import {
  EncabezadoPagina,
  InsigniaEstado,
  NotaDemo,
  TarjetaPanel,
} from "@/components/food/panel";
import { BOTON_PANEL_PRIMARIO, ENLACE_CARD } from "@/components/panel/sistema";
import { agruparPromociones, type FranjaDescuento } from "./agrupar";
import CardsPromociones, { type PromoParaCard, type RendimientoDemoPromo } from "./cards-promociones";

/**
 * PROMOCIONES — la vista de dueño sobre algo que YA existe en la base:
 * sus franjas con descuento. No hay tabla nueva ni estado nuevo; esta
 * pantalla agrupa las franjas vigentes en "promos" legibles (ver
 * agrupar.ts), deja pausarlas/reactivarlas en bloque (action real
 * sobre food_franjas.activa) y les cuelga el rendimiento estimado de
 * la utilería de demo, marcado como tal, hasta que haya analítica
 * real de promociones.
 *
 * Si el restaurante todavía no abrió franjas con descuento, la
 * pantalla explica el mecanismo y muestra las promos DE EJEMPLO del
 * módulo central — nunca una página blanca vacía.
 */

/** El embudo de utilería que se le cuelga a cada promo real, por turno. */
function rendimientoDemo(i: number): RendimientoDemoPromo {
  const d = PROMOS_DEMO[i % PROMOS_DEMO.length];
  return {
    visualizaciones: d.visualizaciones,
    reservas: d.reservas,
    checkIns: d.checkIns,
    // Derivada del embudo, no declarada — misma regla que en Rendimiento.
    conversion:
      d.visualizaciones > 0 ? Math.round((d.reservas / d.visualizaciones) * 1000) / 10 : 0,
  };
}

export default async function PromocionesFoodPage() {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  // Solo las franjas VIGENTES (de hoy en adelante) cuentan como
  // promoción: una franja de la semana pasada ya no es una oferta,
  // es historia. hoyISOCR() y no new Date(): el servidor corre en UTC
  // y desde las 6 p.m. de CR creería que ya es mañana.
  const hoy = hoyISOCR();
  const { data: franjas, error } = await supabase
    .from("food_franjas")
    .select("id, fecha, hora, capacidad, reservado, descuento_porcentaje, activa")
    .eq("business_id", negocio.id)
    .gt("descuento_porcentaje", 0)
    .gte("fecha", hoy)
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true })
    .limit(400);
  if (error) console.error("[food/promociones] no se pudo cargar:", error.message);

  const filas: FranjaDescuento[] = franjas ?? [];
  const promos: PromoParaCard[] = agruparPromociones(filas).map((p, i) => ({
    ...p,
    demo: rendimientoDemo(i),
  }));

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Promociones"
        descripcion="Tus franjas con descuento son tus promociones: el público las ve destacadas y vos las medís acá."
        acciones={
          <Link href="/food/negocio/franjas" className={BOTON_PANEL_PRIMARIO}>
            Abrir franjas con descuento
          </Link>
        }
      />

      {promos.length > 0 ? (
        <>
          <CardsPromociones negocioId={negocio.id} promos={promos} />

          <TarjetaPanel
            kicker="Medición"
            titulo="¿Cuánto te generan?"
            accion={
              <Link href="/food/negocio/rendimiento" className={ENLACE_CARD}>
                Ver el rendimiento completo →
              </Link>
            }
          >
            <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink">
              En <span className="font-bold">Rendimiento</span> está el detalle de cada
              promoción — vistas, reservas, check-ins y cuál convierte mejor — junto a los
              horarios donde tu demanda se concentra, para decidir dónde abrir la próxima.
            </p>
          </TarjetaPanel>
        </>
      ) : (
        <>
          {/* ── Sin promos: explicar el mecanismo, nunca página blanca ── */}
          <TarjetaPanel kicker="Cómo funciona" titulo="Tu primera promoción en tres pasos">
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  paso: "1",
                  texto: "Abrí franjas con descuento en Disponibilidad — el % que elijás es la promo.",
                },
                {
                  paso: "2",
                  texto: "El público las ve destacadas en tu perfil y reserva con el descuento aplicado.",
                },
                {
                  paso: "3",
                  texto: "Acá las pausás o reactivás en bloque, y medís cuántas reservas te generan.",
                },
              ].map((p) => (
                <li key={p.paso} className="rounded-xl bg-aventurea-cream-2 p-3.5">
                  <span
                    className="grid h-6 w-6 place-items-center rounded-lg bg-aventurea-navy text-[12px] font-extrabold text-white"
                    aria-hidden
                  >
                    {p.paso}
                  </span>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-aventurea-ink">{p.texto}</p>
                </li>
              ))}
            </ol>
            {filas.length === 0 && (
              <p className="mt-3.5 text-[12.5px] text-aventurea-ink-soft">
                Todavía no tenés franjas vigentes con descuento
                {" — "}
                <Link href="/food/negocio/franjas" className="font-bold text-aventurea-navy hover:underline">
                  abrí la primera
                </Link>
                .
              </p>
            )}
          </TarjetaPanel>

          {/* Las promos de EJEMPLO del módulo central: enseñan cómo se
              va a ver la pantalla con datos, y lo dicen. */}
          <section aria-label="Promociones de ejemplo">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft">
                Así se ve una promoción
              </h2>
              <NotaDemo />
            </div>
            <ul className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
              {PROMOS_DEMO.map((p) => {
                const conversion =
                  p.visualizaciones > 0
                    ? Math.round((p.reservas / p.visualizaciones) * 1000) / 10
                    : 0;
                return (
                  <li
                    key={p.id}
                    className="rounded-3xl border border-aventurea-line bg-white p-4 shadow-[var(--shadow-plano)] sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold leading-snug text-aventurea-navy">
                          {p.nombre}
                        </h3>
                        <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">{p.detalle}</p>
                      </div>
                      <InsigniaEstado estado={p.estado} className="shrink-0" />
                    </div>
                    <p className="mt-3 text-[12.5px] tabular-nums text-aventurea-ink-soft">
                      <span className="font-bold text-aventurea-ink">
                        {p.visualizaciones.toLocaleString("es-CR")}
                      </span>{" "}
                      vistas ·{" "}
                      <span className="font-bold text-aventurea-ink">{p.reservas}</span> reservas ·{" "}
                      <span className="font-bold text-aventurea-ink">{p.checkIns}</span> check-ins ·{" "}
                      <span className="font-bold text-aventurea-ink">
                        {conversion.toLocaleString("es-CR", { maximumFractionDigits: 1 })}%
                      </span>{" "}
                      de conversión
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
