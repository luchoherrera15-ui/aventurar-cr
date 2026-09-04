import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaPublica, mesaDeBusqueda } from "@/lib/solutions/datos";
import MenuConCarrito from "./menu-con-carrito";

/**
 * /s/<slug>/menu — LA CARTA, y desde la mesa, EL PEDIDO.
 *
 * El servidor arma los datos y decide si se puede pedir (el negocio
 * lo tiene prendido Y hay número de mesa en el QR). El componente
 * cliente pinta la carta, el carrito y manda la comanda. Sin mesa la
 * carta es solo lectura — así el mismo link sirve para mirar desde
 * casa sin que nadie «pida» a una mesa que no existe.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await paginaPublica(slug);
  if (!datos) return { title: "Página no encontrada" };
  return { title: `El menú · ${datos.negocio.nombre}`, description: `Platos y precios de ${datos.negocio.nombre}.` };
}

export default async function MenuSolutionsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const busqueda = await searchParams;
  const datos = await paginaPublica(slug);
  if (!datos || !datos.addons.menu || !datos.negocio.mostrar_menu || datos.menu.length === 0) notFound();

  const { negocio, menu, paleta, addons } = datos;
  const mesa = mesaDeBusqueda(busqueda.mesa, negocio.mesas);
  // Desde la mesa: el add-on de pedidos, el interruptor y el número de
  // mesa del QR. Por WhatsApp (0233): el add-on, alguna modalidad
  // prendida y un número a dónde mandarlo — y SIN mesa, porque desde la
  // mesa se pide a la cocina, no por chat.
  const puedePedir = addons.pedidos && negocio.acepta_pedidos && mesa !== null;
  const whatsappPedidos = negocio.whatsapp_pedidos ?? negocio.whatsapp;
  const llevar = addons.pedidos && negocio.pedidos_llevar && Boolean(whatsappPedidos);
  const express = addons.pedidos && negocio.pedidos_express && Boolean(whatsappPedidos);
  const porWhatsapp = mesa === null && (llevar || express);

  return (
    <main className="min-h-svh pb-32" style={{ background: paleta.fondo, color: paleta.tinta }}>
      <div className="mx-auto w-full max-w-[520px] px-5 pt-5">
        <header className="flex items-center justify-between gap-3">
          <Link
            href={`/s/${negocio.slug}${mesa ? `?mesa=${mesa}` : ""}`}
            className="rounded-xl border px-3 py-1.5 text-[12.5px] font-bold"
            style={{ borderColor: paleta.borde, color: paleta.suave }}
          >
            ← {negocio.nombre}
          </Link>
          {mesa && (
            <span
              className="rounded-full px-3 py-1 text-[12px] font-bold"
              style={{ background: paleta.superficie, border: `1px solid ${paleta.borde}` }}
            >
              Mesa {mesa}
            </span>
          )}
        </header>

        {negocio.foto_portada_url && (
          <div className="relative -mx-5 mt-4 h-[150px] overflow-hidden sm:mx-0 sm:rounded-2xl" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={negocio.foto_portada_url} alt="" className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(180deg, transparent 40%, ${paleta.fondo} 100%)` }}
            />
          </div>
        )}

        <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em]">El menú</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: paleta.suave }}>
          {puedePedir
            ? "Elegí y pedí desde tu mesa · precios en colones"
            : porWhatsapp
              ? "Elegí y pedí por WhatsApp · precios en colones"
              : "Precios en colones"}
        </p>
      </div>

      <MenuConCarrito
        negocioId={negocio.id}
        slug={negocio.slug}
        mesa={mesa}
        puedePedir={puedePedir}
        grupos={menu.map((g) => ({
          nombre: g.seccion?.nombre ?? "Otros",
          items: g.items.map((it) => ({
            id: it.id,
            nombre: it.nombre,
            descripcion: it.descripcion,
            precio: it.precio,
            foto_url: it.foto_url,
          })),
        }))}
        paleta={paleta}
        llevar={llevar}
        express={express}
        costoExpress={negocio.costo_express}
        metodosPago={negocio.metodos_pago}
        whatsappPedidos={whatsappPedidos}
      />
    </main>
  );
}
