import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaPublica, mesaDeBusqueda } from "@/lib/solutions/datos";
import MenuConCarrito from "./menu-con-carrito";
import { idiomaDeBusqueda, textoEn, type Idioma } from "@/lib/solutions/idiomas";
import { nombreDeMoneda } from "@/lib/monedas";
import { rotulosDe, vocabDe } from "@/lib/solutions/rubros";
import { conVariante } from "@/lib/solutions/fotos";

/**
 * La bajada bajo el título, en el idioma del cliente. El título viene
 * del rubro (`rotulosDe`: «El menú» / «Nuestros servicios» /
 * «Catálogo») y la moneda del negocio (0236): antes decía «precios en
 * colones» aunque el negocio estuviera en Lima.
 */
const BAJADA: Record<Idioma, { mesa: string; llevar: string; precios: string }> = {
  es: { mesa: "Elegí y pedí desde tu mesa", llevar: "Elegí y pedí desde acá", precios: "Precios en" },
  en: { mesa: "Choose and order from your table", llevar: "Choose and order right here", precios: "Prices in" },
  fr: { mesa: "Choisissez et commandez depuis votre table", llevar: "Choisissez et commandez ici", precios: "Prix en" },
  it: { mesa: "Scegli e ordina dal tuo tavolo", llevar: "Scegli e ordina da qui", precios: "Prezzi in" },
  pt: { mesa: "Escolha e peça da sua mesa", llevar: "Escolha e peça por aqui", precios: "Preços em" },
  de: { mesa: "Wähle und bestelle von deinem Tisch", llevar: "Wähle und bestelle hier", precios: "Preise in" },
};

/**
 * /s/<slug>/menu — EL CATÁLOGO (menú, servicios o productos), y desde
 * la mesa o desde la página, EL PEDIDO.
 *
 * El servidor arma los datos y decide si se puede pedir (el negocio
 * lo tiene prendido Y hay número de mesa en el QR, o To go / envío
 * prendidos). El componente cliente pinta el catálogo, el carrito y
 * manda el pedido. Sin nada de eso el catálogo es solo lectura — y si
 * el negocio tiene WhatsApp, cada ítem se consulta por ahí.
 *
 * `?item=<id>` (0236) abre la ficha de ese ítem al entrar: es a donde
 * lleva cada tarjeta de la vitrina del link hub.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await paginaPublica(slug);
  if (!datos) return { title: "Página no encontrada" };
  const v = vocabDe(datos.negocio.rubro);
  return { title: `${v.catalogo} · ${datos.negocio.nombre}`, description: `${v.Items} y precios de ${datos.negocio.nombre}.` };
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
  // Todas caen en el tablero del panel.
  const puedePedir = addons.pedidos && negocio.acepta_pedidos && mesa !== null;
  const llevar = addons.pedidos && negocio.pedidos_llevar;
  const express = addons.pedidos && negocio.pedidos_express;
  const paraLlevar = mesa === null && (llevar || express);
  // El idioma viene en ?idioma= y solo vale si el negocio lo ofrece (0235).
  const idioma = idiomaDeBusqueda(busqueda.idioma, negocio.idiomas_menu);
  const rotulos = rotulosDe(negocio.rubro, idioma);
  const b = BAJADA[idioma];
  const precios = `${b.precios} ${nombreDeMoneda(negocio.moneda, idioma)}`;
  const itemCrudo = Array.isArray(busqueda.item) ? busqueda.item[0] : busqueda.item;
  const itemInicial = itemCrudo && /^[0-9a-f-]{36}$/i.test(itemCrudo) ? itemCrudo : null;
  const portada = conVariante(negocio.foto_portada_url, "hero");

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

        {portada && (
          <div className="relative -mx-5 mt-4 h-[150px] overflow-hidden sm:mx-0 sm:rounded-2xl" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada} alt="" className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(180deg, transparent 40%, ${paleta.fondo} 100%)` }}
            />
          </div>
        )}

        <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em]">{rotulos.titulo}</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: paleta.suave }}>
          {puedePedir ? `${b.mesa} · ${precios.toLowerCase()}` : paraLlevar ? `${b.llevar} · ${precios.toLowerCase()}` : precios}
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
        moneda={negocio.moneda}
        pais={negocio.pais}
        rotulos={rotulos}
        negocioNombre={negocio.nombre}
        whatsapp={negocio.whatsapp}
        itemInicial={itemInicial}
      />
    </main>
  );
}
