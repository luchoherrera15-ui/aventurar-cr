import { IconPin, IconWhatsapp } from "@/components/icons";
import IconoLinkSVG from "./icono-link";
import TextoEditable from "./texto-editable";
import { type IconoLink } from "@/lib/solutions/tipos";
import {
  estiloDePieza,
  paletaDelTema,
  pilaFuente,
  RADIOS,
  veloDeFoto,
  type Efecto,
  type EstiloLinks,
  type EstiloPortada,
  type Fuente,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";

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
 */

export type LinkVista = {
  id: string;
  etiqueta: string;
  url: string;
  icono: IconoLink;
  /** Foto detrás de ESTA puerta (0232). El velo lo pone el sistema. */
  fondoUrl?: string | null;
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
}: {
  href: string;
  inerte: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  if (inerte) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
    </a>
  );
}

/**
 * La foto de fondo de UNA puerta, con su velo (0232).
 *
 * Vive en el módulo por la misma razón que `Ancla` justo arriba: un
 * componente declarado dentro del render es un tipo nuevo en cada
 * pasada y React remonta el subárbol, que en la vista previa del panel
 * es perder el foco del campo que se está escribiendo.
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
      <img src={url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <span aria-hidden className="absolute inset-0" style={{ background: velo }} />
    </>
  );
}

export default function VistaPagina({
  datos,
  inerte = false,
  edicion,
  className = "",
}: {
  datos: DatosPagina;
  /** true = los enlaces no navegan (previa del panel, mockup). */
  inerte?: boolean;
  /** Presente = se escribe encima de la página (solo el panel). */
  edicion?: EdicionPagina;
  className?: string;
}) {
  const p = paletaDelTema(datos.tema, datos.colorFondo, datos.colorAcento);
  const r = RADIOS[datos.redondeo] ?? RADIOS.suave;
  const inicial = (datos.nombre.trim().charAt(0) || "•").toUpperCase();
  const grilla = datos.estiloLinks === "grilla";
  const velo = veloDeFoto(p);
  /* La portada solo «cuenta» si además hay foto: elegir «completa» sin
     haber subido nada no puede dejar un banner vacío arriba. */
  const portada: EstiloPortada = datos.fotoPortadaUrl ? datos.estiloPortada : "sin";
  /** El acabado de una pieza, ya resuelto. Un solo lugar decide. */
  const pieza = (opts: { destacada?: boolean; radio: number; conFoto?: boolean }) =>
    estiloDePieza(datos.efecto, p, opts);

  const linkWhatsapp = datos.whatsapp
    ? `https://wa.me/${datos.whatsapp.length === 8 ? "506" : ""}${datos.whatsapp}`
    : null;
  const linkMapa = datos.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(datos.direccion)}`
    : null;

  // Las puertas: el menú primero (es el producto), después las del dueño.
  const puertas: {
    clave: string;
    icono: IconoLink;
    titulo: string;
    pie?: string;
    href: string;
    fondoUrl?: string | null;
  }[] = [];
  if (datos.hayMenu) {
    puertas.push({
      clave: "menu",
      icono: "menu",
      titulo: datos.aceptaPedidos && datos.mesa ? "Ver el menú y pedir" : "Ver el menú",
      pie: datos.seccionesMenu.slice(0, 3).join(" · "),
      href: datos.hrefMenu ?? "#",
    });
  }
  for (const l of datos.links) {
    puertas.push({
      clave: l.id,
      icono: l.icono,
      titulo: l.etiqueta,
      href: l.url,
      fondoUrl: l.fondoUrl ?? null,
    });
  }

  return (
    <div
      /* `@container`: la grilla de puertas se acomoda al ancho de ESTA
         página, no al de la ventana. Importa porque el mismo componente
         se monta a 236 px (un mockup del héroe), a 288 px (la previa del
         panel) y a pantalla completa — y un breakpoint de viewport
         mentiría en los dos primeros. */
      className={`@container relative flex min-h-full w-full flex-col ${
        portada === "completa" ? "pb-8 pt-0" : "px-5 pb-8 pt-6"
      } ${className}`}
      style={{
        background: `linear-gradient(180deg, ${p.fondo} 0%, ${p.fondo2} 100%)`,
        color: p.tinta,
        /* La cara la pone el contenedor y todo hereda. Las seis
           variables las declara el envoltorio de la página (ver
           src/app/solutions/fuentes.ts); acá solo se elige cuál. */
        fontFamily: pilaFuente(datos.fuente),
      }}
    >
      {/* ── Portada «de fondo»: viste la página entera ──────────────
          Va en el contenedor y no en el <header> para que las puertas
          y el contacto también queden encima de la foto — que es lo
          que distingue este modo de «completa». */}
      {portada === "fondo" && datos.fotoPortadaUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={datos.fotoPortadaUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: velo }} />
        </>
      )}

      {/* ── Portada «completa»: banner de borde a borde ─────────────
          Sale del contenedor de 440 px a propósito: si respetara el
          ancho máximo dejaría de ser «completa» en pantalla grande. */}
      {portada === "completa" && datos.fotoPortadaUrl && (
        <div className="relative h-[124px] w-full overflow-hidden @[320px]:h-[168px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={datos.fotoPortadaUrl} alt="" className="h-full w-full object-cover" />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, transparent 30%, ${p.fondo} 100%)` }}
          />
        </div>
      )}

      <div
        className={`relative mx-auto flex w-full max-w-[440px] flex-col gap-5 ${
          portada === "completa" ? "-mt-10 px-5" : ""
        }`}
      >
        {/* ── La cabecera: foto, logo, nombre ─────────────────── */}
        {/* ── La cabecera ─────────────────────────────────────────
            La foto solo vive acá adentro en modo «card»; en «completa»
            ya salió arriba de borde a borde y en «fondo» viste la
            página, así que repetirla sería la misma imagen dos veces. */}
        <header
          className="relative overflow-hidden"
          style={pieza({ radio: r.tarjeta, conFoto: portada === "card" })}
        >
          {portada === "card" && datos.fotoPortadaUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={datos.fotoPortadaUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
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
            <div className={`flex items-center gap-3.5 ${grilla ? "flex-col text-center" : ""}`}>
              {datos.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={datos.logoUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 object-cover @[320px]:h-14 @[320px]:w-14"
                  style={{ borderRadius: grilla ? 999 : r.foto }}
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center text-[20px] font-extrabold @[320px]:h-14 @[320px]:w-14 @[320px]:text-[26px]"
                  style={{
                    background: p.acento,
                    color: p.tintaSobreAcento,
                    borderRadius: grilla ? 999 : r.foto,
                  }}
                >
                  {inicial}
                </span>
              )}
              <div className="min-w-0">
                {/* El tamaño sigue al CONTENEDOR: en un mockup de 268 px
                    el titular de 24 px partía «Casa Nostra» en dos
                    renglones y empujaba todo hacia abajo. */}
                <h1 className="text-[19px] font-extrabold leading-tight tracking-[-0.02em] @[320px]:text-[24px]">
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
                </h1>
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
                    <p className="mt-0.5 text-[11.5px] @[320px]:text-[13px]" style={{ color: p.suave }}>
                      {datos.bajada}
                    </p>
                  )
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Las puertas ─────────────────────────────────────── */}
        {puertas.length > 0 && (
          <nav
            aria-label={`Secciones de ${datos.nombre}`}
            className={grilla ? "grid grid-cols-2 gap-2.5 @[300px]:grid-cols-3" : "flex flex-col gap-3"}
          >
            {puertas.map((x) =>
              grilla ? (
                <Ancla
                  inerte={inerte}
                  key={x.clave}
                  href={x.href}
                  className="relative flex min-h-[92px] flex-col items-center justify-center gap-2 overflow-hidden p-3 text-center transition-opacity hover:opacity-90"
                  style={pieza({
                    destacada: x.clave === "menu",
                    radio: r.pieza,
                    conFoto: Boolean(x.fondoUrl),
                  })}
                >
                  <FondoDePieza url={x.fondoUrl} velo={velo} />
                  <span
                    aria-hidden
                    className="relative grid h-9 w-9 place-items-center text-[18px]"
                    style={{
                      background: x.clave === "menu" ? p.acento : "transparent",
                      borderRadius: 999,
                    }}
                  >
                    <IconoLinkSVG icono={x.icono} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="relative line-clamp-2 text-[11px] font-extrabold leading-tight @[300px]:text-[11.5px]">
                    {edicion && x.clave !== "menu" ? (
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
                  className="relative flex min-h-[64px] items-center gap-4 overflow-hidden p-4 transition-opacity hover:opacity-90"
                  style={pieza({
                    destacada: x.clave === "menu",
                    radio: r.pieza,
                    conFoto: Boolean(x.fondoUrl),
                  })}
                >
                  <FondoDePieza url={x.fondoUrl} velo={velo} />
                  <span
                    aria-hidden
                    className="relative grid h-9 w-9 shrink-0 place-items-center text-[17px] @[320px]:h-11 @[320px]:w-11 @[320px]:text-[20px]"
                    style={{
                      background: x.clave === "menu" ? p.acento : p.superficie,
                      border: x.clave === "menu" ? "none" : `1px solid ${p.borde}`,
                      borderRadius: r.foto,
                    }}
                  >
                    <IconoLinkSVG icono={x.icono} className="h-[18px] w-[18px] @[320px]:h-5 @[320px]:w-5" />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    {/* `line-clamp-2` y no `truncate`: a 268 px «Reservar
                        con descuento» se cortaba en «Reservar con…» y la
                        puerta dejaba de decir a dónde lleva. */}
                    <span className="line-clamp-2 text-[13.5px] font-extrabold leading-tight @[320px]:text-[16px]">
                      {edicion && x.clave !== "menu" ? (
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
                      <span className="mt-0.5 block truncate text-[11px] @[320px]:text-[12.5px]" style={{ color: p.suave }}>
                        {x.pie}
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="relative" style={{ color: p.suave }}>
                    ›
                  </span>
                </Ancla>
              ),
            )}
          </nav>
        )}

        {/* ── Contacto ────────────────────────────────────────── */}
        {(linkWhatsapp || linkMapa) && (
          <section className="flex flex-col gap-2 text-[12.5px] @[320px]:text-[13px]" style={{ color: p.suave }}>
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

        <footer className="mt-auto pt-4 text-center text-[11px]" style={{ color: p.suave }}>
          Hecho con <span className="font-bold">Bookea</span>
        </footer>
      </div>
    </div>
  );
}
