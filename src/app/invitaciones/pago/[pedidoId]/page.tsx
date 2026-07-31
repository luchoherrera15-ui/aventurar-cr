import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import {
  montoEnColones,
  precioPaquete,
  resolverPaquete,
} from "@/lib/paquetes-invitaciones";
import OpcionesPago from "./opciones-pago";

export const metadata = { title: "Pagá tu invitación" };

/**
 * El pago del pedido: SINPE Móvil o transferencia (con comprobante) y,
 * cuando el dueño configure Stripe, también tarjeta. Con `?listo=1`
 * esta misma página muestra el "ya casi" con lo que sigue.
 */
export default async function PagoPage({
  params,
  searchParams,
}: {
  params: Promise<{ pedidoId: string }>;
  searchParams: Promise<{ listo?: string | string[] }>;
}) {
  const { pedidoId } = await params;
  const { listo } = await searchParams;
  const yaPago = (Array.isArray(listo) ? listo[0] : listo) === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/cuenta?next=/invitaciones/pago/${pedidoId}`);

  const { data: pedido } = await supabase
    .from("pedidos_invitacion")
    .select("id, paquete, nombre_evento, fecha_evento, estado, contacto_correo")
    .eq("id", pedidoId)
    .maybeSingle();

  if (!pedido) notFound();

  const paquete = resolverPaquete(pedido.paquete as string);
  if (!paquete) notFound();
  const colones = montoEnColones(paquete);

  // Los datos de cobro son públicos (el cliente tiene que verlos para
  // pagar), así que van con valor por defecto y se pueden cambiar sin
  // tocar código con las variables de entorno.
  const sinpe = {
    numero: process.env.SINPE_NUMERO ?? "8689 3939",
    titular: process.env.SINPE_TITULAR ?? "José Pablo Herrera Ovares",
  };
  const banco = {
    nombre: process.env.BANCO_NOMBRE ?? "Banco Nacional",
    // Pendiente: se llena con BANCO_CUENTA_IBAN sin tocar código.
    cuenta: process.env.BANCO_CUENTA_IBAN ?? "",
    titular: process.env.BANCO_TITULAR ?? "José Pablo Herrera Ovares",
  };
  const stripeListo = Boolean(process.env.STRIPE_SECRET_KEY);

  if (yaPago || pedido.estado !== "pendiente_pago") {
    return (
      <div className="min-h-screen bg-aventurea-cream">
        <SiteHeader breadcrumb="Pedido recibido" />
        <section className="mx-auto max-w-[640px] px-5 py-10">
          <div className="rounded-3xl bg-aventurea-navy px-7 py-9 text-white">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#f5b98a]">
              Paso 3 de 3 · Listo
            </p>
            <h1 className="mt-2 text-[26px] font-black leading-tight">
              ¡Recibimos tu pedido!
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-white/80">
              Estamos verificando tu pago. Apenas quede confirmado, el equipo
              empieza a diseñar la invitación de{" "}
              <strong className="text-white">{pedido.nombre_evento}</strong>.
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
              className="mt-5 inline-block rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
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
            {paquete.precioUSD !== null && (
              <span className="ml-2 text-[13px] font-semibold text-white/60">
                ({paquete.etiqueta} USD)
              </span>
            )}
          </p>
        </div>

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
