import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { toString as qrATexto } from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta, horaCorta } from "@/lib/food/tipos";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import BottomNavFood from "@/components/food/bottom-nav-food";
import CancelarReserva from "./cancelar-reserva";

// Privada (una reserva ajena): fuera de cualquier índice.
export const metadata: Metadata = { title: "Tu reserva · FOOD.BOOKEA", robots: { index: false } };

/**
 * LA CONFIRMACIÓN — lo que el cliente le muestra al mesero para el
 * check-in. RLS de food_reservations (0190) ya limita esto a la
 * reserva del propio cliente: no hace falta comprobar dueño acá,
 * `.maybeSingle()` sobre el cliente autenticado alcanza.
 */
export default async function ConfirmacionReservaFoodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const { data: reserva } = await supabase
    .from("food_reservations")
    .select(
      "id, party_size, descuento_porcentaje, codigo_confirmacion, estado, franja_id, business_id, food_franjas(fecha, hora), food_businesses(nombre, telefono)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!reserva) notFound();

  const franja = Array.isArray(reserva.food_franjas) ? reserva.food_franjas[0] : reserva.food_franjas;
  const negocio = Array.isArray(reserva.food_businesses) ? reserva.food_businesses[0] : reserva.food_businesses;

  const ESTADO_LABEL: Record<string, string> = {
    confirmada: "Confirmada",
    check_in: "Ya hiciste check-in",
    no_show: "No te presentaste",
    cancelada: "Cancelada",
  };

  const puedeCancelar = reserva.estado === "confirmada";

  // El QR es el MISMO código de 6 caracteres que ya se lee a ojo y se
  // teclea a mano en /food/negocio/(panel)/check-in (Mostrador): no
  // existe hoy un escáner del lado del negocio, así que esto no es
  // "escaneable en el mostrador" — es una forma más de mostrar y
  // guardar el mismo código, y queda lista para el día en que el
  // check-in agregue una cámara. Mismo patrón que el póster de
  // Lealtad (toString de "qrcode", SVG inline, sin dependencia nueva).
  const qrSvg = await qrATexto(reserva.codigo_confirmacion, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#16295e", light: "#ffffff" },
  });

  return (
    <>
      <SiteHeader breadcrumb="FOOD.BOOKEA" />
      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[480px] flex-col items-center justify-center px-4 py-10 pb-24 text-center lg:pb-10">
      <p className="text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
        FOOD.BOOKEA
      </p>
      <h1 className="mt-2 text-2xl font-bold text-aventurea-ink">¡Reserva confirmada!</h1>
      {negocio && <p className="mt-1 text-[14px] text-aventurea-ink-soft">{negocio.nombre}</p>}

      <div className="mt-6 w-full rounded-3xl border border-aventurea-line bg-white p-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Código de confirmación
        </p>
        <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.15em] text-aventurea-navy">
          {reserva.codigo_confirmacion}
        </p>

        <div
          className="mx-auto mt-4 h-[132px] w-[132px] [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-aventurea-line pt-5 text-left">
          {franja && (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Fecha</p>
                <p className="text-[14px] font-bold text-aventurea-ink">{fechaCorta(franja.fecha)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Hora</p>
                <p className="text-[14px] font-bold text-aventurea-ink">{horaCorta(franja.hora)}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Personas</p>
            <p className="text-[14px] font-bold text-aventurea-ink">{reserva.party_size}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-aventurea-ink-soft">Descuento</p>
            <p className="text-[14px] font-bold text-aventurea-orange">
              {reserva.descuento_porcentaje}% OFF
            </p>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-aventurea-cream-2 px-3 py-2.5 text-[12.5px] font-bold text-aventurea-ink">
          Estado: {ESTADO_LABEL[reserva.estado] ?? reserva.estado}
        </p>

        {negocio?.telefono && (
          <p className="mt-4 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            ¿No podés venir? Llamá al restaurante al{" "}
            <a href={`tel:${negocio.telefono}`} className="font-bold text-aventurea-navy">
              {negocio.telefono}
            </a>{" "}
            para cancelar o cambiar tu reserva.
          </p>
        )}

        {puedeCancelar && <CancelarReserva reservaId={reserva.id} />}
      </div>

      <p className="mt-5 text-[12.5px] text-aventurea-ink-soft">
        Mostrá este código en el restaurante al llegar.
      </p>
      <div className="mt-4 flex gap-4">
        <Link href="/food" className="font-bold text-aventurea-navy hover:underline">
          ← Volver a FOOD.BOOKEA
        </Link>
        <Link href="/food/mis-reservas" className="font-bold text-aventurea-navy hover:underline">
          Ver todas mis reservas
        </Link>
      </div>
      </main>
      <SiteFooter />
      <BottomNavFood />
    </>
  );
}
