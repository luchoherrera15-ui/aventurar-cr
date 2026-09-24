import { IconPin, IconWhatsapp } from "@/components/icons";
import { numeroInternacional, type Moneda, type Pais } from "@/lib/monedas";
import Link from "next/link";
import IconoLinkSVG from "./icono-link";
import TextoEditable from "./texto-editable";
import { type FormatoLink, type IconoLink } from "@/lib/solutions/tipos";
import {
  conAlfa,
  DISENO_BASE,
  estiloDePieza,
  fondoDePagina,
  paletaDelTema,
  pilaFuente,
  pilaFuenteCuerpo,
  RADIOS,
  veloDeFoto,
  type Diseno,
  type Efecto,
  type EstiloLinks,
  type EstiloPortada,
  type Fuente,
  type Paleta,
  type Redondeo,
  type Tema,
  relieveDelTitulo,
} from "@/lib/solutions/temas";
import { vocabDe, type Rubro } from "@/lib/solutions/rubros";
import { conVariante } from "@/lib/solutions/fotos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PÁGINA DEL NEGOCIO — UN SOLO RENDERIZADOR, TRES CONSUMIDORES
 * ════════════════════════════════════════════════════════════════════
 *
 * Lo usan:
 *   1. /s/<slug>            — la página pública de verdad;
 *   2. el panel             — la vista previa en vivo mientras se edita;
 *   3. /solutions           — los mockups de la landing.
 *
 * UNO solo, y no una copia por pantalla, por la misma razón que
 * `vista-pase.tsx` lo dice de la tarjeta de Lealtad: dos maquetas del
 * mismo objeto se separan en cuanto alguien toca una, y a partir de ahí
 * el negocio ve una cosa mientras edita y otra cuando publica. Acá la
 * vista previa no se PARECE a la página: es la página.
 *
 * Es puro: sin hooks, sin estado, sin `"use client"`. Por eso puede
 * montarse tanto en un Server Component (la pública) como dentro de uno
 * de cliente (la previa que se repinta con cada tecla).
 *
 * Los `<a>` se apagan con `inerte` cuando esto es una previa o un
 * mockup: nadie quiere que tocar un mockup de la landing lo saque del
 * sitio, ni que el dueño navegue fuera del panel al tocar su propia
 * previa.
 *
 * ── LO QUE CAMBIÓ EL 6 SEP 2026 (0236) ──────────────────────────────
 * «Que sea 100 % customizable, tipo Linktree, hasta un sistema de
 * ventas tipo catálogo». La página ahora lee `diseno` (animación de
 * entrada, hover, fondo, estilo de botón, logo, alineación, densidad,
 * vitrina, redes, titular), pinta los precios en la MONEDA del negocio,
 * arma el WhatsApp con el prefijo de su PAÍS, dice «menú», «servicios»
 * o «catálogo» según su RUBRO, y puede mostrar el catálogo ADENTRO del
 * catálogo, con foto y precio — que desde el 9 sep 2026 vive en SU
 * Linktree. Los enlaces ya no son solo botones: hay íconos de redes,
 * títulos y textos.
 *
 * Todos los campos nuevos de `DatosPagina` son OPCIONALES con el
 * default de antes: los mockups de la landing y cualquier página
 * anterior a la 0236 se ven exactamente igual.
 */

export type LinkVista = {
  id: string;
  etiqueta: string;
  url: string;
  icono: IconoLink;
  /** Foto detrás de ESTA puerta (0232). El velo lo pone el sistema. */
  fondoUrl?: string | null;
  /** Botón, ícono de red, título o texto (0236). Default: botón. */
  formato?: FormatoLink;
  /** La línea chica bajo el botón (0236). */
  descripcion?: string;
};

/** Un ítem del catálogo. Lo usa el catálogo, no el hub. */
export type ItemVitrina = {
  id: string;
  nombre: string;
  precio: number | null;
  fotoUrl: string | null;
  /** El nombre de su sección, para agrupar en «todo». */
  seccion: string;
};

export type DatosPagina = {
  nombre: string;
  bajada: string;
  logoUrl: string | null;
  fotoPortadaUrl: string | null;
  whatsapp: string | null;
  direccion: string | null;
  colorFondo: string;
  colorAcento: string;
  tema: Tema;
  estiloLinks: EstiloLinks;
  redondeo: Redondeo;
  /** El vestido fino (0232). */
  fuente: Fuente;
  estiloPortada: EstiloPortada;
  efecto: Efecto;
  /** Las puertas del dueño, ya ordenadas y filtradas por visibles. */
  links: LinkVista[];
  /** Nombres de las primeras secciones de la carta — [] = sin menú. */
  seccionesMenu: string[];
  /** El tile del menú solo existe si hay carta y está prendida. */
  hayMenu: boolean;
  /** Se puede pedir: cambia el texto del tile del menú. */
  aceptaPedidos: boolean;
  /** Número de mesa del QR, si viene. */
  mesa: number | null;
  /** A dónde va el tile del menú (la pública lo pasa; la previa no). */
  hrefMenu?: string;
  /** Las opciones finas (0236). Sin esto, la página de siempre. */
  diseno?: Diseno;
  /** En qué moneda se escriben los precios de la vitrina (0236). */
  moneda?: Moneda;
  /** El país, para el prefijo del WhatsApp (0236). */
  pais?: Pais;
  /** El rubro, para decir «menú», «servicios» o «catálogo» (0236). */
  rubro?: Rubro;

};

/**
 * Los callbacks que vuelven la página EDITABLE en el lugar.
 *
 * Solo los pasa el panel. Sin esto —la página pública y los mockups—
 * los textos se pintan planos y ni siquiera se importa el editor.
 */
export type EdicionPagina = {
  alCambiarNombre: (v: string) => void;
  alCambiarBajada: (v: string) => void;
  alCambiarEtiquetaLink: (id: string, v: string) => void;
};

/**
 * El nombre del negocio, con la etiqueta que le corresponda.
 *
 * En `/s/<slug>` es el titular de la página y va como `<h1>`. Cuando
 * esta misma vista se incrusta como demostración en una página que ya
 * tiene su `<h1>` —el home—, baja a `<p>`: dos `h1` en un documento
 * rompen el esquema de encabezados para Google y para quien navega con
 * lector de pantalla.
 *
 * Vive en el módulo y no dentro de `VistaPagina` por la misma razón que
 * `Ancla`: un componente declarado adentro de otro es un tipo nuevo en
 * cada render y hace que React remonte el subárbol.
 */
function TituloNegocio({
  as,
  className,
  style,
  children,
}: {
  as: "h1" | "p";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const Etiqueta = as;
  return (
    <Etiqueta className={className} style={style}>
      {children}
    </Etiqueta>
  );
}

/**
 * Un ancla que, en modo inerte, es un `<span>` con la misma pinta.
 *
 * Vive en el MÓDULO y no adentro de `VistaPagina` (que es donde nació):
 * un componente declarado dentro de otro es un tipo NUEVO en cada
 * render, así que React desmonta y vuelve a montar el subárbol entero.
 * En la página pública eso es solo desperdicio; en la vista previa del
 * panel —que se repinta con cada tecla— es perder el foco del campo
 * que se está escribiendo.
 */
function Ancla({
  href,
  inerte,
  children,
  style,
  className,
  ariaLabel,
  mismaPestana = false,
}: {
  href: string;
  inerte: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
  /** El catálogo del mismo negocio se abre en la misma pestaña. */
  mismaPestana?: boolean;
}) {
  if (inerte) {
    return (
      <span className={className} style={style} aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      target={mismaPestana ? undefined : "_blank"}
      rel={mismaPestana ? undefined : "noopener noreferrer"}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/**
 * La foto de fondo de UNA puerta, con su velo (0232).
 *
 * Vive en el módulo por la misma razón que `Ancla` justo arriba.
 *
 * El velo NO es opcional ni configurable. Con una foto detrás, el
 * texto puede quedar ilegible con cualquier combinación de colores, y
 * eso no es una preferencia del negocio: el negocio elige la foto, el
 * sistema garantiza que se siga leyendo.
 */
function FondoDePieza({ url, velo }: { url?: string | null; velo: string }) {
  if (!url) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={conVariante(url, "card") ?? url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <span aria-hidden className="absolute inset-0" style={{ background: velo }} />
    </>
  );
}

/**
 * Los fondos que se mueven (0236): aurora (tres manchas desenfocadas)
 * y burbujas (seis círculos que suben). Las clases y los keyframes
 * viven en globals.css; acá solo se ponen los colores del tema. Con
 * `prefers-reduced-motion` quedan quietos (aurora) o se van (burbujas).
 */
function FondoAnimado({ tipo, p }: { tipo: Diseno["fondo"]; p: Paleta }) {
  if (tipo === "aurora") {
    return (
      <div className="sol-aurora" aria-hidden>
        <span style={{ background: conAlfa(p.acento, 0.7) }} />
        <span style={{ background: conAlfa(p.tinta, 0.22) }} />
        <span style={{ background: conAlfa(p.acento, 0.45) }} />
      </div>
    );
  }
  if (tipo === "burbujas") {
    return (
      <div className="sol-burbujas" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <span key={k} style={{ background: conAlfa(p.acento, 0.3), border: `1px solid ${conAlfa(p.acento, 0.5)}` }} />
        ))}
      </div>
    );
  }
  return null;
}

/** El índice de entrada de una pieza, para la cascada (ver globals.css). */
const pieza = (i: number) => ({ "--i": i } as React.CSSProperties);


export default function VistaPagina({
  datos,
  inerte = false,
  edicion,
  className = "",
  nivelTitulo = "h1",
  credito = "Hecho con Bookea",
}: {
  datos: DatosPagina;
  /** true = los enlaces no navegan (previa del panel, mockup). */
  inerte?: boolean;
  /** Presente = se escribe encima de la página (solo el panel). */
  edicion?: EdicionPagina;
  className?: string;
  /**
   * Con qué etiqueta sale el nombre del negocio. `h1` —el default— es
   * lo correcto en `/s/<slug>`, donde ES el titular de la página. Se
   * baja a `p` cuando esta vista se incrusta como demostración en una
   * página que ya tiene su propio `h1`, como el home.
   */
  nivelTitulo?: "h1" | "p";
  /**
   * Qué dice el crédito del pie. El default es el de siempre, así que
   * las páginas publicadas no cambian; el home lo pisa para no nombrar
   * una marca retirada dentro de una demostración.
   */
  credito?: string;
}) {
  const p = paletaDelTema(datos.tema, datos.colorFondo, datos.colorAcento);
  const r = RADIOS[datos.redondeo] ?? RADIOS.suave;
  const d = datos.diseno ?? DISENO_BASE;
  const pais = datos.pais ?? "CR";
  const vocab = vocabDe(datos.rubro ?? "restaurante");
  const inicial = (datos.nombre.trim().charAt(0) || "•").toUpperCase();
  const grilla = datos.estiloLinks === "grilla";
  const velo = veloDeFoto(p);
  /* La portada solo «cuenta» si además hay foto: elegir «completa» sin
     haber subido nada no puede dejar un banner vacío arriba. */
  const portadaElegida: EstiloPortada = datos.fotoPortadaUrl ? datos.estiloPortada : "sin";
  /**
   * ── EL ENCABEZADO «CARTEL» (24 sep 2026) ──────────────────────────
   *
   * Pedido del dueño: «un rectángulo, que es una tarjeta, y en el
   * centro un círculo con el logo — la mitad sobre la tarjeta y la
   * mitad en el aire. Abajo, los cards».
   *
   * Cuando está elegido, la portada la dibuja el encabezado con su
   * propia forma, así que las cuatro de siempre se apagan: si no, la
   * foto saldría dos veces.
   */
  const cartel = d.encabezado === "cartel" && Boolean(datos.fotoPortadaUrl);
  const portada: EstiloPortada = cartel ? "sin" : portadaElegida;
  /** El acabado de una pieza, ya resuelto. Un solo lugar decide. */
  const estilo = (opts: { destacada?: boolean; radio: number; conFoto?: boolean; suelta?: boolean }) =>
    estiloDePieza(datos.efecto, p, { ...opts, boton: d.boton, suelta: opts.suelta ?? d.piezas === "suelta" });

  // ── Las decisiones del diseño fino (0236) ─────────────────────────
  const centrado = d.alineacion === "centro" || (d.alineacion === "auto" && grilla);
  const logoRadio =
    d.logoForma === "circulo" ? 999 : d.logoForma === "cuadrado" ? 6 : d.logoForma === "redondeado" ? r.foto : grilla ? 999 : r.foto;
  const logoClase =
    d.logoTamano === "chico"
      ? "h-9 w-9 text-[16px] @[320px]:h-11 @[320px]:w-11 @[320px]:text-[20px]"
      : d.logoTamano === "grande"
        ? "h-16 w-16 text-[26px] @[320px]:h-20 @[320px]:w-20 @[320px]:text-[34px]"
        : "h-11 w-11 text-[20px] @[320px]:h-14 @[320px]:w-14 @[320px]:text-[26px]";
  const separacion = d.densidad === "compacta" ? "gap-2" : d.densidad === "amplia" ? "gap-4" : "gap-3";
  const altoFila = d.densidad === "compacta" ? "min-h-[52px] p-3" : d.densidad === "amplia" ? "min-h-[74px] p-5" : "min-h-[64px] p-4";
  const altoCelda = d.densidad === "compacta" ? "min-h-[80px] p-2.5" : d.densidad === "amplia" ? "min-h-[104px] p-3.5" : "min-h-[92px] p-3";
  const hoverClase = d.hover === "elevar" ? "elevar" : d.hover === "ninguno" ? "" : `sol-hover-${d.hover}`;
  const claseEntrada = d.animacion === "ninguna" ? "" : `sol-entra-${d.animacion}`;
  const tituloClase =
    d.titulo === "grande"
      ? "text-[24px] @[320px]:text-[32px]"
      : d.titulo === "mayusculas"
        ? "text-[16px] uppercase tracking-[0.1em] @[320px]:text-[20px]"
        : "text-[19px] @[320px]:text-[24px]";
  /**
   * ── DÓNDE VUELVE LA CARA ELEGIDA (24 sep 2026) ──────────────────
   * El contenedor viste la página con la cara de LEER; esta vuelve a
   * poner la de TITULAR, y solo donde el tamaño la sostiene: el
   * nombre del negocio, los rótulos de sección y el título de cada
   * puerta. Todo lo demás —bajadas, pies, textos, contacto, pie de
   * página— se queda con la de leer. El porqué está en
   * `pilaFuenteCuerpo` (temas.ts).
   */
  const caraTitular: React.CSSProperties = { fontFamily: pilaFuente(datos.fuente) };
  /* El disco del ícono adentro de un botón sólido: no puede ser el
     acento sobre el acento. Un velo de la tinta que va encima. */
  const discoSolido = d.boton === "solido" || d.boton === "sombra";
  const foto = conVariante(datos.fotoPortadaUrl, "hero") ?? datos.fotoPortadaUrl;
  const logo = conVariante(datos.logoUrl, "thumb") ?? datos.logoUrl;

  const linkWhatsapp = datos.whatsapp ? `https://wa.me/${numeroInternacional(datos.whatsapp, pais)}` : null;
  const linkMapa = datos.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(datos.direccion)}`
    : null;

  // ── Los enlaces, por formato (0236) ───────────────────────────────
  const redes = datos.links.filter((l) => l.formato === "icono");
  const enFlujo = datos.links.filter((l) => l.formato !== "icono");
  const hrefCatalogo = datos.hrefMenu ?? "#";

  // Las puertas: el catálogo primero (es el producto), después las del
  // dueño en su orden — con títulos y textos intercalados donde los puso.
  type Pieza =
    | { tipo: "puerta"; clave: string; icono: IconoLink; titulo: string; pie?: string; href: string; fondoUrl?: string | null; destacada: boolean; catalogo: boolean }
    | { tipo: "titulo"; clave: string; texto: string }
    | { tipo: "texto"; clave: string; texto: string };
  const piezas: Pieza[] = [];
  // El catálogo va PRIMERO y destacado, y va como PUERTA: esta página
  // es un link hub y nada más. El catálogo es una página aparte, con su
  // dirección y su QR — meterlo acá adentro convertía el hub en dos
  // cosas a la vez (9 sep 2026).
  if (datos.hayMenu) {
    piezas.push({
      tipo: "puerta",
      clave: "menu",
      icono: "menu",
      titulo: datos.aceptaPedidos && datos.mesa ? vocab.verYPedir : vocab.verCatalogo,
      pie: datos.seccionesMenu.slice(0, 3).join(" · "),
      href: hrefCatalogo,
      destacada: true,
      catalogo: true,
    });
  }
  for (const l of enFlujo) {
    if (l.formato === "titulo") piezas.push({ tipo: "titulo", clave: l.id, texto: l.etiqueta });
    else if (l.formato === "texto") piezas.push({ tipo: "texto", clave: l.id, texto: l.etiqueta });
    else
      piezas.push({
        tipo: "puerta",
        clave: l.id,
        icono: l.icono,
        titulo: l.etiqueta,
        pie: l.descripcion || undefined,
        href: l.url,
        fondoUrl: l.fondoUrl ?? null,
        destacada: false,
        catalogo: false,
      });
  }

  /** Un contador que avanza por cada pieza dibujada, para la cascada.
   *  Las piezas de abajo son FUNCIONES y se llaman desde el JSX en el
   *  orden visual: así el índice sigue lo que se ve, y la cascada no
   *  entra la fila de redes antes que el encabezado. */
  let indice = 0;
  const siguiente = () => indice++;

  const filaRedes = () => redes.length > 0 && d.redes !== "ocultas" && (
    <nav aria-label="Redes" className={`sol-pieza flex flex-wrap gap-2 ${centrado ? "justify-center" : ""}`} style={pieza(siguiente())}>
      {redes.map((l) => (
        <Ancla
          key={l.id}
          inerte={inerte}
          href={l.url}
          ariaLabel={l.etiqueta}
          className={`grid h-10 w-10 place-items-center ${hoverClase}`}
          style={{
            ...estilo({ radio: 999 }),
            ...(d.boton === "sombra" ? { boxShadow: `2px 2px 0 ${p.tinta}` } : {}),
          }}
        >
          <IconoLinkSVG icono={l.icono} className="h-[18px] w-[18px]" />
        </Ancla>
      ))}
    </nav>
  );

  return (
    <div
      /* `@container`: la grilla de puertas se acomoda al ancho de ESTA
         página, no al de la ventana. Importa porque el mismo componente
         se monta a 236 px (un mockup del héroe), a 288 px (la previa del
         panel) y a pantalla completa — y un breakpoint de viewport
         mentiría en los dos primeros. */
      className={`@container relative flex min-h-full w-full flex-col px-5 pb-8 pt-6 ${claseEntrada} ${className}`}
      style={{
        ...fondoDePagina(d.fondo, p),
        color: p.tinta,
        /* La cara de LEER la pone el contenedor y todo hereda; la de
           TITULAR se pide pieza por pieza (ver `caraTitular`). Las seis
           variables las declara el envoltorio de la página (ver
           src/app/solutions/fuentes.ts); acá solo se elige cuál. */
        fontFamily: pilaFuenteCuerpo(datos.fuente),
      }}
    >
      {/* ── Fondo animado (0236): detrás de todo, sin clics ──────── */}
      <FondoAnimado tipo={d.fondo} p={p} />

      {/* ── Portada «de fondo»: viste la página entera ──────────────
          Va en el contenedor y no en el <header> para que las puertas
          y el contacto también queden encima de la foto — que es lo
          que distingue este modo de «completa». */}
      {portada === "fondo" && foto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: velo }} />
        </>
      )}

      <div
        className={`relative mx-auto flex w-full max-w-[440px] flex-col ${d.densidad === "compacta" ? "gap-4" : d.densidad === "amplia" ? "gap-6" : "gap-5"}`}
      >
        {/* ── Portada «completa»: la foto de portada, tipo Facebook ───
            (24 sep 2026) Pedido del dueño: «una imagen simplemente de
            portada ahí, y abajo los cards; que no sea todo y que no
            tenga degradado».

            Antes era un banner de borde a borde que se desvanecía en el
            fondo de la página. Eso hacía dos cosas que el dueño no
            quería: se comía la pantalla entera en un monitor —la foto
            de un local no aguanta 1 920 px de ancho— y el degradado le
            robaba la mitad de abajo a la foto.

            Ahora es lo que dice el nombre: una foto, del ancho de la
            columna, con el mismo redondeo de las tarjetas y su borde
            abajo bien marcado. Nada encima. */}
        {portada === "completa" && foto && (
          <div className="sol-pieza relative overflow-hidden" style={{ ...pieza(siguiente()), borderRadius: r.tarjeta }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt="" className="block h-[132px] w-full object-cover @[380px]:h-[164px]" />
          </div>
        )}

        {/* ── La cabecera ─────────────────────────────────────────
            La foto solo vive acá adentro en modo «card»; en «completa»
            ya salió justo arriba y en «fondo» viste la página, así que
            repetirla sería la misma imagen dos veces. */}
        {/* ── EL CARTEL (24 sep 2026) ────────────────────────────
            La portada como tarjeta contenida y el logo montado a
            caballo de su borde inferior: mitad adentro, mitad afuera.

            El círculo NO va dentro del <img>: va en un contenedor
            aparte con margen negativo, porque la tarjeta lleva
            `overflow-hidden` para redondear la foto y cualquier cosa
            que sobresalga se cortaría justo en el borde.

            El `margin-bottom` del bloque compensa la mitad que se
            asoma: sin él, el círculo se comería el aire del nombre. */}
        {cartel && foto && (
          <div className="relative">
            <div
              className="overflow-hidden"
              style={{ borderRadius: r.tarjeta, ...estilo({ radio: r.tarjeta, conFoto: true, suelta: false }) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto}
                alt=""
                className="block h-[180px] w-full object-cover @[380px]:h-[210px]"
              />
            </div>
            <div className="-mt-[46px] flex justify-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  className="h-[92px] w-[92px] object-cover"
                  style={{
                    borderRadius: 999,
                    border: `4px solid ${p.fondo}`,
                    background: p.fondo,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-[92px] w-[92px] place-items-center text-[34px] font-extrabold"
                  style={{
                    borderRadius: 999,
                    border: `4px solid ${p.fondo}`,
                    background: p.acento,
                    color: p.tintaSobreAcento,
                  }}
                >
                  {inicial}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Encabezado LIBRE o GRABADO (7 sep 2026): sin tarjeta, salvo con
            la portada «Banner», donde la foto vive dentro de la tarjeta. */}
        <header
          className="sol-pieza relative overflow-hidden"
          style={{
            ...pieza(siguiente()),
            ...(d.encabezado === "tarjeta" || portada === "card" ? estilo({ radio: r.tarjeta, conFoto: portada === "card", suelta: false }) : { borderRadius: r.tarjeta }),
          }}
        >
          {portada === "card" && foto && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: `linear-gradient(180deg, transparent 18%, ${p.fondo} 97%)` }}
              />
            </>
          )}
          <div
            className={`relative flex flex-col justify-end gap-3 p-4 @[320px]:p-5 ${
              portada === "card" ? "min-h-[132px] @[320px]:min-h-[168px]" : ""
            } ${
              // Con «cartel» el círculo del logo ya dejó su propio aire
              // debajo. El relleno de arriba del encabezado se sumaba a
              // ese y el nombre terminaba flotando lejos de su logo.
              cartel ? "pt-0 @[320px]:pt-0" : ""
            }`}
          >
            {datos.mesa && (
              <span
                className="absolute right-4 top-4 px-3 py-1 text-[12px] font-bold"
                style={{
                  background: p.superficie,
                  border: `1px solid ${p.borde}`,
                  borderRadius: 999,
                }}
              >
                Mesa {datos.mesa}
              </span>
            )}
            {/* Con «cartel» el logo YA se dibujó montado en el borde de
                la portada, y el nombre va centrado debajo: repetirlo acá
                serían dos logos en diez centímetros. */}
            <div className={`flex items-center gap-3.5 ${centrado || cartel ? "flex-col text-center" : ""}`}>
              {cartel ? null : logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className={`shrink-0 object-cover ${logoClase}`} style={{ borderRadius: logoRadio }} />
              ) : (
                <span
                  aria-hidden
                  className={`grid shrink-0 place-items-center font-extrabold ${logoClase}`}
                  style={{ background: p.acento, color: p.tintaSobreAcento, borderRadius: logoRadio }}
                >
                  {inicial}
                </span>
              )}
              <div className="min-w-0">
                {/* El tamaño sigue al CONTENEDOR: en un mockup de 268 px
                    el titular de 24 px partía «Casa Nostra» en dos
                    renglones y empujaba todo hacia abajo.

                    ── POR QUÉ LA ETIQUETA ES VARIABLE ────────────────
                    En `/s/<slug>` el nombre del negocio ES el titular
                    de la página y tiene que ser `<h1>`. Pero esta misma
                    vista se incrusta como DEMOSTRACIÓN en otras páginas
                    que ya tienen su propio `<h1>` (el home), y dos `h1`
                    en un documento es un error de SEO y de lectores de
                    pantalla. `nivelTitulo` deja bajarlo a `<p>` en esos
                    casos; el default no cambia para nadie. */}
                <TituloNegocio
                  as={nivelTitulo}
                  className={`font-extrabold leading-tight tracking-[-0.02em] ${tituloClase}`}
                  style={{
                    ...caraTitular,
                    ...(d.encabezado === "grabado" && portada !== "card" ? relieveDelTitulo(p) : {}),
                  }}
                >
                  {edicion ? (
                    <TextoEditable
                      valor={datos.nombre}
                      alCambiar={edicion.alCambiarNombre}
                      placeholder="Tu negocio"
                      maxLength={80}
                      etiqueta="Nombre del negocio"
                    />
                  ) : (
                    datos.nombre || "Tu negocio"
                  )}
                </TituloNegocio>
                {edicion ? (
                  <p className="mt-0.5 text-[13px]" style={{ color: p.suave }}>
                    <TextoEditable
                      valor={datos.bajada}
                      alCambiar={edicion.alCambiarBajada}
                      placeholder="La línea bajo tu nombre"
                      maxLength={140}
                      etiqueta="La línea bajo el nombre"
                    />
                  </p>
                ) : (
                  datos.bajada && (
                    <p className="mt-0.5 text-[12px] @[320px]:text-[13.5px]" style={{ color: p.suave }}>
                      {datos.bajada}
                    </p>
                  )
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── La fila de redes, bajo el nombre (0236) ─────────────── */}
        {d.redes === "arriba" && filaRedes()}

        {/* ── Las puertas ─────────────────────────────────────── */}
        {piezas.length > 0 && (
          <nav
            aria-label={`Secciones de ${datos.nombre}`}
            className={grilla ? `grid grid-cols-2 ${separacion} @[300px]:grid-cols-3` : `flex flex-col ${separacion}`}
          >
            {piezas.map((x) => {
              if (x.tipo === "titulo") {
                return (
                  <h2
                    key={x.clave}
                    className={`sol-pieza pt-2 text-[11.5px] font-extrabold uppercase tracking-[0.14em] ${grilla ? "col-span-full" : ""} ${centrado ? "text-center" : ""}`}
                    style={{ ...pieza(siguiente()), ...caraTitular, color: p.suave }}
                  >
                    {edicion ? (
                      <TextoEditable valor={x.texto} alCambiar={(v) => edicion.alCambiarEtiquetaLink(x.clave, v)} placeholder="Título" maxLength={40} etiqueta="Título" />
                    ) : (
                      x.texto
                    )}
                  </h2>
                );
              }
              if (x.tipo === "texto") {
                return (
                  <p
                    key={x.clave}
                    className={`sol-pieza text-[13px] leading-relaxed ${grilla ? "col-span-full" : ""} ${centrado ? "text-center" : ""}`}
                    style={{ ...pieza(siguiente()), color: p.suave }}
                  >
                    {edicion ? (
                      <TextoEditable valor={x.texto} alCambiar={(v) => edicion.alCambiarEtiquetaLink(x.clave, v)} placeholder="Texto" maxLength={160} etiqueta="Texto" />
                    ) : (
                      x.texto
                    )}
                  </p>
                );
              }
              const editable = edicion && !x.catalogo;
              return grilla ? (
                <Ancla
                  inerte={inerte}
                  key={x.clave}
                  href={x.href}
                  mismaPestana={x.catalogo}
                  className={`sol-pieza relative flex flex-col items-center justify-center gap-2 overflow-hidden text-center ${altoCelda} ${hoverClase}`}
                  style={{
                    ...pieza(siguiente()),
                    ...estilo({ destacada: x.destacada, radio: r.pieza, conFoto: Boolean(x.fondoUrl) }),
                  }}
                >
                  <FondoDePieza url={x.fondoUrl} velo={velo} />
                  <span
                    aria-hidden
                    className="relative grid h-9 w-9 place-items-center text-[18px]"
                    style={{
                      background: x.destacada && !discoSolido ? p.acento : discoSolido ? conAlfa(p.tintaSobreAcento, 0.16) : "transparent",
                      color: x.destacada && !discoSolido ? p.tintaSobreAcento : undefined,
                      borderRadius: 999,
                    }}
                  >
                    <IconoLinkSVG icono={x.icono} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="relative line-clamp-2 text-[11.5px] font-extrabold leading-tight @[300px]:text-[12px]" style={caraTitular}>
                    {editable ? (
                      <TextoEditable
                        valor={x.titulo}
                        alCambiar={(v) => edicion.alCambiarEtiquetaLink(x.clave, v)}
                        placeholder="Texto"
                        maxLength={40}
                        etiqueta={`Texto del botón ${x.titulo}`}
                      />
                    ) : (
                      x.titulo
                    )}
                  </span>
                </Ancla>
              ) : (
                <Ancla
                  inerte={inerte}
                  key={x.clave}
                  href={x.href}
                  mismaPestana={x.catalogo}
                  className={`sol-pieza relative flex items-center gap-4 overflow-hidden ${altoFila} ${hoverClase}`}
                  style={{
                    ...pieza(siguiente()),
                    ...estilo({ destacada: x.destacada, radio: r.pieza, conFoto: Boolean(x.fondoUrl) }),
                  }}
                >
                  <FondoDePieza url={x.fondoUrl} velo={velo} />
                  <span
                    aria-hidden
                    className="relative grid h-9 w-9 shrink-0 place-items-center text-[17px] @[320px]:h-11 @[320px]:w-11 @[320px]:text-[20px]"
                    style={{
                      background: x.destacada && !discoSolido ? p.acento : discoSolido ? conAlfa(p.tintaSobreAcento, 0.16) : p.superficie,
                      color: x.destacada && !discoSolido ? p.tintaSobreAcento : undefined,
                      border: x.destacada || discoSolido ? "none" : `1px solid ${p.borde}`,
                      borderRadius: d.logoForma === "circulo" ? 999 : r.foto,
                    }}
                  >
                    <IconoLinkSVG icono={x.icono} className="h-[18px] w-[18px] @[320px]:h-5 @[320px]:w-5" />
                  </span>
                  <span className={`relative min-w-0 flex-1 ${centrado ? "text-center" : ""}`}>
                    {/* `line-clamp-2` y no `truncate`: a 268 px «Reservar
                        con descuento» se cortaba en «Reservar con…» y la
                        puerta dejaba de decir a dónde lleva. */}
                    <span className="line-clamp-2 text-[13.5px] font-extrabold leading-tight @[320px]:text-[16px]" style={caraTitular}>
                      {editable ? (
                        <TextoEditable
                          valor={x.titulo}
                          alCambiar={(v) => edicion.alCambiarEtiquetaLink(x.clave, v)}
                          placeholder="Texto del botón"
                          maxLength={40}
                          etiqueta={`Texto del botón ${x.titulo}`}
                        />
                      ) : (
                        x.titulo
                      )}
                    </span>
                    {x.pie && (
                      <span className="mt-0.5 block truncate text-[12px] @[320px]:text-[13px]" style={{ color: discoSolido ? undefined : p.suave, opacity: discoSolido ? 0.8 : 1 }}>
                        {x.pie}
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="relative" style={{ color: discoSolido ? undefined : p.suave }}>
                    ›
                  </span>
                </Ancla>
              );
            })}
          </nav>
        )}

        {/* ── La fila de redes, al pie (0236) ──────────────────────── */}
        {d.redes === "abajo" && filaRedes()}

        {/* ── Contacto ────────────────────────────────────────── */}
        {(linkWhatsapp || linkMapa) && (
          <section
            className={`sol-pieza flex flex-col gap-2 text-[12.5px] @[320px]:text-[13px] ${centrado ? "items-center" : ""}`}
            style={{ ...pieza(siguiente()), color: p.suave }}
          >
            {linkMapa && (
              <Ancla inerte={inerte} href={linkMapa} className="flex items-center gap-2 underline-offset-2 hover:underline">
                <IconPin className="h-[15px] w-[15px] shrink-0" />
                <span className="min-w-0 truncate">{datos.direccion}</span>
              </Ancla>
            )}
            {linkWhatsapp && (
              <Ancla inerte={inerte} href={linkWhatsapp} className="flex items-center gap-2 underline-offset-2 hover:underline">
                <IconWhatsapp className="h-[15px] w-[15px] shrink-0" />
                <span>Escribinos por WhatsApp</span>
              </Ancla>
            )}
          </section>
        )}

        {/* La marca al pie, como Linktree: cada página de un cliente es
            la puerta al producto. Relativo a propósito — bajo linksy.lat
            el proxy resuelve `/linksy` a la landing, y bajo bookea.lat la
            ruta existe tal cual.

            ── POR QUÉ EL CRÉDITO ES CONFIGURABLE ────────────────────
            El home de bookea.lat monta esta misma vista como
            demostración, y ahí el pie NO puede decir «Linksy»: esa
            marca se retiró y, de cara al cliente, la página es «tu
            página de Bookea» (ver docs/arquitectura.md §2).

            El default no cambia: las páginas publicadas de los
            negocios siguen diciendo exactamente lo que decían. Cambiar
            el crédito de TODAS es la mudanza de marca completa, que
            tiene su propio momento y su propio orden. */}
        <footer className="mt-auto pt-4 text-center text-[11.5px]" style={{ color: p.suave }}>
          {inerte ? (
            <span className="font-bold">{credito}</span>
          ) : (
            <Link href="/solutions" className="font-bold" style={{ color: p.suave }}>
              {credito}
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
