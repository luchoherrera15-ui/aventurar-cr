import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaPublica, mesaDeBusqueda } from "@/lib/solutions/datos";
import MenuConCarrito from "./menu-con-carrito";
import { idiomaDeBusqueda, textoEn, type Idioma } from "@/lib/solutions/idiomas";

/** El título y la bajada del menú, en el idioma del cliente. */
const TITULO: Record<Idioma, { titulo: string; mesa: string; llevar: string; solo: string }> = {
  es: { titulo: "El menú", mesa: "Elegí y pedí desde tu mesa · precios en colones", llevar: "Elegí y pedí To go o Exprés · precios en colones", solo: "Precios en colones" },
  en: { titulo: "The menu", mesa: "Choose and order from your table · prices in colones", llevar: "Choose and order to go or for delivery · prices in colones", solo: "Prices in colones" },
  fr: { titulo: "Le menu", mesa: "Choisissez et commandez depuis votre table · prix en colones", llevar: "Choisissez et commandez à emporter ou en livraison · prix en colones", solo: "Prix en colones" },
  it: { titulo: "Il menù", mesa: "Scegli e ordina dal tuo tavolo · prezzi in colones", llevar: "Scegli e ordina da asporto o a domicilio · prezzi in colones", solo: "Prezzi in colones" },
  pt: { titulo: "O menu", mesa: "Escolha e peça da sua mesa · preços em colones", llevar: "Escolha e peça para viagem ou entrega · preços em colones", solo: "Preços em colones" },
  de: { titulo: "Die Speisekarte", mesa: "Wähle und bestelle von deinem Tisch · Preise in Colones", llevar: "Wähle und bestelle zum Mitnehmen oder liefern · Preise in Colones", solo: "Preise in Colones" },
};

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
  // mesa del QR. To go / exprés (0233): el add-on y la modalidad
  // prendida — y SIN mesa, porque desde la mesa se pide a la cocina.
  // Las tres caen en el Modo restaurante del panel.
  const puedePedir = addons.pedidos && negocio.acepta_pedidos && mesa !== null;
  const llevar = addons.pedidos && negocio.pedidos_llevar;
  const express = addons.pedidos && negocio.pedidos_express;
  const paraLlevar = mesa === null && (llevar || express);
  // El idioma viene en ?idioma= y solo vale si el negocio lo ofrece (0235).
  const idioma = idiomaDeBusqueda(busqueda.idioma, negocio.idiomas_menu);
  const tt = TITULO[idioma];

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

        <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em]">{tt.titulo}</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: paleta.suave }}>
          {puedePedir ? tt.mesa : paraLlevar ? tt.llevar : tt.solo}
        </p>
      </div>

      <MenuConCarrito
        negocioId={negocio.id}
        slug={negocio.slug}
        mesa={mesa}
        puedePedir={puedePedir}
        grupos={menu.map((g) => ({
          // Los textos ya van en el idioma del cliente; lo que no esté
          // traducido sale en español (textoEn).
          nombre: g.seccion ? textoEn(g.seccion, idioma).nombre : "Otros",
          items: g.items.map((it) => ({
            id: it.id,
            ...textoEn(it, idioma),
            precio: it.precio,
            foto_url: it.foto_url,
            nutricion: it.nutricion,
          })),
        }))}
        paleta={paleta}
        idioma={idioma}
        idiomas={negocio.idiomas_menu}
        llevar={llevar}
        express={express}
        costoExpress={negocio.costo_express}
        metodosPago={negocio.metodos_pago}
      />
    </main>
  );
}
