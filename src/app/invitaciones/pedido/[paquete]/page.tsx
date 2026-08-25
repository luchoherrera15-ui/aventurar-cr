import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import FormularioAuth from "@/app/cuenta/formulario-auth";
import { createClient } from "@/lib/supabase/server";
import { IconWhatsapp } from "@/components/icons";
import {
  montoEnColones,
  precioPaquete,
  resolverPaquete,
} from "@/lib/paquetes-invitaciones";
import FormularioPedido from "./formulario-pedido";

/**
 * La línea de WhatsApp para quien quiere algo a medida en vez de un
 * paquete fijo (pedido del dueño, ago 2026) — un número propio para
 * esto, DISTINTO del de ventas general (`NEXT_PUBLIC_ASSIST_WHATSAPP`
 * en cta-llamada.tsx).
 */
const WHATSAPP_PERSONALIZADO = "50687103739";

export const metadata = {
  title: "Pedí tu invitación digital",
};

/**
 * El pedido de una invitación: primero la cuenta (así el pedido queda
 * amarrado a la persona y su panel funciona solo), después los datos
 * de la fiesta y al final el pago.
 */
export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ paquete: string }>;
  /** `?album=1` cuando ya marcó el álbum en la página de paquetes. Es
   *  solo para premarcar el checkbox: el precio no sale de acá. */
  searchParams: Promise<{ album?: string }>;
}) {
  const { paquete: paqueteId } = await params;
  const { album } = await searchParams;
  const paquete = resolverPaquete(paqueteId);
  if (!paquete) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = user
    ? await supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle()
    : { data: null };

  const colones = montoEnColones(paquete);

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Pedí tu invitación" />

      <section className="mx-auto max-w-[720px] px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/invitaciones#paquetes"
            className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
          >
            ← Ver los otros paquetes
          </Link>

          {/* Escape para quien no encuentra su caso en ningún paquete
              fijo: habla directo con una persona, no con el formulario. */}
          <a
            href={`https://wa.me/${WHATSAPP_PERSONALIZADO}?text=${encodeURIComponent(
              "Hola, quiero algo más personalizado para mi invitación digital.",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-aventurea-line bg-white px-4 py-2 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
          >
            <IconWhatsapp className="h-4 w-4 text-[#25D366]" />
            Quiero algo más personalizado
          </a>
        </div>

        {/* Lo que está comprando, siempre a la vista */}
        <div className="mt-3 rounded-2xl bg-aventurea-navy px-6 py-5 text-white">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#f5b98a]">
            Paso {user ? "2 de 3" : "1 de 3"} · Tu pedido
          </p>
          <h1 className="mt-1.5 text-[22px] font-black">
            Invitación {paquete.nombre}
            <span className="ml-2 text-[20px] font-extrabold">{paquete.etiqueta}</span>
          </h1>
          <p className="mt-1 text-[12.5px] text-white/70">
            {paquete.precioUSD !== null
              ? `≈${precioPaquete(colones)} · pagás en colones por SINPE o transferencia`
              : "Pago único por evento"}
            {paquete.tienePanel
              ? " · incluye panel de confirmaciones en tu cuenta"
              : " · confirmaciones por WhatsApp"}
          </p>
        </div>

        {!user ? (
          <div className="mt-5">
            <p className="mb-4 rounded-2xl border border-aventurea-sky/25 bg-aventurea-sky/5 px-4 py-3 text-[13px] leading-relaxed text-aventurea-ink">
              Entrá primero con tu cuenta: así tu pedido queda guardado a tu
              nombre y después ves tu invitación (y tu panel) sin buscar nada.
            </p>
            <FormularioAuth
              destino={`/invitaciones/pedido/${paqueteId}`}
              titulo="Entrá para seguir"
              intro="Con Google es un toque. También podés entrar con tu correo: si es tu primera vez te creamos la cuenta ahí mismo."
            />
          </div>
        ) : (
          <FormularioPedido
            paqueteId={paqueteId}
            nombreSugerido={(perfil?.nombre as string) || ""}
            correoSugerido={user.email ?? ""}
            albumSugerido={album === "1"}
          />
        )}
      </section>
    </div>
  );
}
