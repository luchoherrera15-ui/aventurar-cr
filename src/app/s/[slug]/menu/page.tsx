import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaPublica, mesaDeBusqueda } from "@/lib/solutions/datos";
import MenuConCarrito from "./menu-con-carrito";
import { idiomaDeBusqueda, textoEn, type Idioma } from "@/lib/solutions/idiomas";
import { nombreDeMoneda } from "@/lib/monedas";
import { rotulosDe, vocabDe } from "@/lib/solutions/rubros";
import { conVariante } from "@/lib/solutions/fotos";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import ElegirMesa from "./elegir-mesa";
import { ajustesMenuDe, estiloDeAjustes } from "@/lib/solutions/menu-estilos";
import { FUENTES } from "@/lib/solutions/temas";
import { pintaDeEstilo } from "@/lib/solutions/menu-pinta";

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

  // EL DISEÑO DEL CATÁLOGO (8 sep 2026): una carta aparte del link hub,
  // con su papel, su letra y su forma de apilar los platos. Se guarda
  // en `diseno.menu` y el plan ya lo hizo cumplir AL GUARDAR
  // (`sanearParaPlan`), así que acá se pinta lo que hay.
  // LA PREVIA DEL PANEL. `?previa=` solo cambia cómo se PINTA esta
  // página; no escribe nada y no cambia ningún dato. El panel la usa
  // dentro de un teléfono para que el dueño vea el diseño de verdad
  // —el mismo renderizador, la misma carta— antes de guardarlo.
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const previa = uno(busqueda.previa) === "1";
  const crudoPrevia = previa ? uno(busqueda.ajustes) : undefined;
  let ajustes = negocio.diseno.menuAjustes;
  if (crudoPrevia) {
    // El panel manda los ajustes sin guardar para que el dueño VEA lo
    // que está tocando. Pasan por el mismo saneo que los guardados: un
    // parámetro roto no puede romper la página.
    try {
      ajustes = ajustesMenuDe(JSON.parse(crudoPrevia), FUENTES);
    } catch {
      // Un JSON inválido no vale un 500: se pinta lo guardado.
    }
  }
  const portadaComo = ajustes.portada;
  const estilo = estiloDeAjustes(ajustes);
  const pinta = pintaDeEstilo(
    estilo,
    {
    fondo: paleta.fondo,
    tinta: paleta.tinta,
    suave: paleta.suave,
    superficie: paleta.superficie,
    borde: paleta.borde,
    acento: paleta.acento,
      sobreAcento: paleta.tintaSobreAcento,
    },
    ajustes.tamano,
  );
  const c = pinta.paleta;

  return (
    <main
      className={`min-h-svh pb-32 ${CLASES_FUENTES}`}
      style={{ background: c.fondo, color: c.tinta, fontFamily: pinta.familia, ["--ancho-menu" as string]: pinta.ancho }}
    >
      <div className="mx-auto w-full max-w-[var(--ancho-menu)] px-5 pt-5">
        {/* EL NEGOCIO, ARRIBA DE TODO (9 sep 2026). El catálogo es una
            página aparte del link hub —se llega por un link, se comparte
            sola y tiene su propio QR—, así que tiene que presentarse:
            logo, nombre y a dónde volver. Sin esto se leía como una
            lista de precios sin dueño. */}
        <header className="flex items-center justify-between gap-3">
          <Link
            href={`/s/${negocio.slug}${mesa ? `?mesa=${mesa}` : ""}`}
            className="flex min-w-0 items-center gap-2.5"
            aria-label={`Volver a ${negocio.nombre}`}
          >
            {negocio.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={conVariante(negocio.logo_url, "thumb") ?? negocio.logo_url}
                alt=""
                className="h-11 w-11 shrink-0 object-cover"
                style={{
                  borderRadius: negocio.diseno.logoForma === "cuadrado" ? 8 : negocio.diseno.logoForma === "redondeado" ? 12 : 999,
                  border: `1px solid ${c.borde}`,
                }}
              />
            ) : (
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center text-[17px] font-extrabold"
                style={{ background: c.acento, color: c.sobreAcento, borderRadius: 999 }}
              >
                {negocio.nombre.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-extrabold leading-tight" style={{ color: c.tinta }}>
                {negocio.nombre}
              </span>
              <span className="block text-[11.5px] font-bold" style={{ color: c.suave }}>
                ← Volver a los enlaces
              </span>
            </span>
          </Link>
          {mesa && (
            <span
              className="rounded-full px-3 py-1 text-[12px] font-bold"
              style={{ background: c.superficie, border: `1px solid ${c.borde}` }}
            >
              Mesa {mesa}
            </span>
          )}
        </header>

        {/* ── «¿ESTÁS EN EL LOCAL?» (24 sep 2026) ───────────────────
            Hasta hoy el número de mesa SOLO podía venir en la URL, o
            sea que cada mesa necesitaba su propio QR impreso. Con esto
            alcanza un QR para todo el local: quien lo escanea escribe
            el número que ve en su mesa.

            Solo aparece si el negocio recibe pedidos, tiene mesas
            declaradas y la URL todavía no trae una: con `?mesa=` ya
            resuelto no hay nada que preguntar. */}
        {addons.pedidos && negocio.acepta_pedidos && negocio.mesas > 0 && mesa === null && (
          <ElegirMesa
            slug={negocio.slug}
            mesas={negocio.mesas}
            paleta={c}
            radio={pinta.def.radio}
          />
        )}

        {/* LA PORTADA, en el tratamiento que el negocio eligió (0241):
            tarjeta recortada, a sangre con el título encima, fundida con
            el fondo, o ninguna. */}
        {portada && portadaComo === "tarjeta" && (
          <div className="relative -mx-5 mt-4 h-[150px] overflow-hidden sm:mx-0 sm:rounded-2xl" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {portada && portadaComo === "degradado" && (
          <div className="relative -mx-5 mt-4 h-[190px] overflow-hidden" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, ${c.fondo} 100%)` }} />
          </div>
        )}

        {portada && portadaComo === "completa" ? (
          // A sangre y con el título ENCIMA: la foto es el encabezado.
          <div className="relative -mx-5 mt-4 h-[260px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portada} alt="" className="h-full w-full object-cover" aria-hidden />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.72) 100%)" }} aria-hidden />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.02em]">{rotulos.titulo}</h1>
              <p className="mt-1 text-[12.5px] opacity-85">
                {puedePedir ? `${b.mesa} · ${precios.toLowerCase()}` : paraLlevar ? `${b.llevar} · ${precios.toLowerCase()}` : precios}
              </p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em]">{rotulos.titulo}</h1>
            <p className="mt-0.5 text-[12.5px]" style={{ color: c.suave }}>
              {puedePedir ? `${b.mesa} · ${precios.toLowerCase()}` : paraLlevar ? `${b.llevar} · ${precios.toLowerCase()}` : precios}
            </p>
          </>
        )}
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
            personalizacion: it.personalizacion,
          })),
        }))}
        paleta={paleta}
        estilo={estilo}
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
