import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import {
  ALBUM_ADICIONAL,
  albumEnColones,
  montoEnColones,
  precioPaquete,
  resolverPaquete,
} from "@/lib/paquetes-invitaciones";
import { datosDePagoBookea } from "@/lib/pagos-bookea";
import OpcionesPago from "./opciones-pago";

export const metadata = { title: "Pagá tu invitación" };

/** Lo que dice la barra de arriba cuando el navegador vuelve de Stripe. */
function leerParam(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/**
 * El pago del pedido: tarjeta (Stripe Checkout, con Apple Pay y Google
 * Pay incluidos) o SINPE Móvil / transferencia con comprobante.
 *
 * Con `?listo=1` —el depósito recién enviado— y con `?pago=listo` —la
 * vuelta de Stripe— esta misma página muestra el "ya casi" con lo que
 * sigue. Ojo con la diferencia: `?pago=listo` NO significa que el pago
 * esté confirmado, solo que el navegador volvió. Quien confirma es el
 * webhook, y por eso lo que se lee abajo es el ESTADO del pedido, no la
 * query.
 */
export default async function PagoPage({
  params,
  searchParams,
}: {
  params: Promise<{ pedidoId: string }>;
  searchParams: Promise<{ listo?: string | string[]; pago?: string | string[] }>;
}) {
  const { pedidoId } = await params;
  const { listo, pago } = await searchParams;
  const vueltaDeStripe = leerParam(pago);
  const yaPago = leerParam(listo) === "1" || vueltaDeStripe === "listo";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/cuenta?next=/invitaciones/pago/${pedidoId}`);

  const { data: pedido } = await supabase
    .from("pedidos_invitacion")
    // Una sola cadena literal, sin concatenar: Supabase infiere el tipo
    // de la fila a partir del TEXTO del select, y partirlo en dos deja
    // todas las columnas como `GenericStringError`.
    .select(
      "id, paquete, nombre_evento, fecha_evento, estado, contacto_correo, monto_crc, con_album, metodo_pago",
    )
    .eq("id", pedidoId)
    .maybeSingle();

  if (!pedido) notFound();

  const paquete = resolverPaquete(pedido.paquete as string);
  if (!paquete) notFound();

  // EL MONTO SALE DEL PEDIDO, no del catálogo. Es el número que la base
  // calculó al crearlo (0087) con el álbum ya sumado si lo lleva (0091),
  // y es exactamente lo que se le cobra a la tarjeta y lo que se le pide
  // depositar por SINPE. Calcularlo acá con el catálogo mostraba el
  // precio del paquete SOLO: quien había marcado el álbum veía un total
  // y se le cobraba otro.
  //
  // El cálculo del catálogo queda de respaldo para los pedidos viejos
  // que no tienen `monto_crc`, con el álbum sumado como corresponde.
  const guardado = Number(pedido.monto_crc);
  const colones =
    Number.isFinite(guardado) && guardado > 0
      ? guardado
      : montoEnColones(paquete) + (pedido.con_album ? albumEnColones() : 0);

  // Los datos de cobro viven en UN solo lugar (lib/pagos-bookea) para
  // que corregir el número no deje una copia vieja cobrando por ahí —
  // acá había un duplicado con un SINPE desactualizado.
  const { sinpe, banco } = datosDePagoBookea();
  const stripeListo = Boolean(process.env.STRIPE_SECRET_KEY);

  if (yaPago || pedido.estado !== "pendiente_pago") {
    // ¿El cobro ya está confirmado, o todavía se está verificando? Sale
    // del ESTADO del pedido y no de la query: cuando alguien vuelve de
    // Stripe, el webhook puede tardar un par de segundos en escribir, y
    // decirle «confirmado» antes de que lo esté sería prometer con la
    // barra de direcciones — que es justo lo que este flujo no hace.
    const cobroConfirmado =
      pedido.metodo_pago === "stripe" &&
      ["pagado", "en_diseno", "entregado"].includes(String(pedido.estado));

    return (
      <div className="min-h-screen bg-aventurea-cream">
        <SiteHeader breadcrumb="Pedido recibido" />
        <section className="mx-auto max-w-[640px] px-5 py-10">
          <div className="rounded-3xl bg-aventurea-navy px-7 py-9 text-white">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#f5b98a]">
              Paso 3 de 3 · Listo
            </p>
            <h1 className="mt-2 text-[26px] font-black leading-tight">
              {cobroConfirmado ? "¡Pago confirmado!" : "¡Recibimos tu pedido!"}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/80">
              {cobroConfirmado ? (
                <>
                  Tu pago con tarjeta quedó confirmado y el equipo ya arranca con
                  la invitación de{" "}
                  <strong className="text-white">{pedido.nombre_evento}</strong>.
                </>
              ) : (
                <>
                  Estamos verificando tu pago. Apenas quede confirmado, el equipo
                  empieza a diseñar la invitación de{" "}
                  <strong className="text-white">{pedido.nombre_evento}</strong>.
                </>
              )}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-aventurea-line bg-white p-6">
            <h2 className="text-[15px] font-extrabold text-aventurea-ink">
              ¿Qué sigue?
            </h2>
            <ol className="mt-3 grid gap-3 text-[13.5px] leading-relaxed text-aventurea-ink">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[11.5px] font-extrabold text-white">
                  1
                </span>
                Te llega un correo de confirmación a{" "}
                <strong>{pedido.contacto_correo}</strong>.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[11.5px] font-extrabold text-white">
                  2
                </span>
                Cuando tu invitación esté lista te avisamos por correo con el
                link para compartir.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[11.5px] font-extrabold text-white">
                  3
                </span>
                <span>
                  Entrá con <strong>la misma cuenta</strong> con la que hiciste
                  este pedido para ver tu invitación
                  {paquete.tienePanel ? (
                    <>
                      {" "}
                      y abrir tu <strong>panel de confirmaciones</strong>, donde
                      vas a ver en vivo quién asiste y quién no.
                    </>
                  ) : (
                    "."
                  )}
                </span>
              </li>
            </ol>

            <Link
              href="/cuenta"
              className="mt-5 inline-block rounded-xl bg-aventurea-sky px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark"
            >
              Ir a mi cuenta
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Pagá tu invitación" />
      <section className="mx-auto max-w-[640px] px-5 py-8">
        <div className="rounded-2xl bg-aventurea-navy px-6 py-5 text-white">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#f5b98a]">
            Paso 3 de 3 · Pago
          </p>
          <h1 className="mt-1.5 text-[22px] font-black">
            Invitación {paquete.nombre}
          </h1>
          <p className="mt-1 text-[13px] text-white/75">
            {pedido.nombre_evento} · {pedido.fecha_evento}
          </p>
          <p className="mt-3 text-[28px] font-black text-[#f5b98a]">
            {precioPaquete(colones)}
            {/* La equivalencia en dólares solo cuando el total ES el del
                paquete: con el álbum sumado, `etiqueta` sería el precio
                de una parte y quedaría al lado del total como si fuera
                lo mismo. */}
            {paquete.precioUSD !== null && !pedido.con_album && (
              <span className="ml-2 text-[13px] font-semibold text-white/60">
                ({paquete.etiqueta} USD)
              </span>
            )}
          </p>
          {pedido.con_album ? (
            <p className="mt-1 text-[12.5px] text-white/70">
              Incluye el {ALBUM_ADICIONAL.nombre.toLowerCase()}.
            </p>
          ) : null}
        </div>

        {/* Volvió de Stripe sin pagar. No es un error: cerró la pestaña o
            se arrepintió, y el pedido lo sigue esperando igual. */}
        {vueltaDeStripe === "cancelado" && (
          <p className="mt-4 rounded-2xl border border-aventurea-line bg-white px-5 py-4 text-[13px] leading-relaxed text-aventurea-ink">
            No se hizo ningún cobro — tu pedido sigue guardado. Podés intentar de
            nuevo con la tarjeta o pagar por SINPE.
          </p>
        )}

        <OpcionesPago
          pedidoId={pedidoId}
          sinpe={sinpe}
          banco={banco}
          stripeListo={stripeListo}
          monto={precioPaquete(colones)}
        />
      </section>
    </div>
  );
}
