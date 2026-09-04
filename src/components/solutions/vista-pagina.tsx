import TextoEditable from "./texto-editable";
import { ICONO_LINK, type IconoLink } from "@/lib/solutions/tipos";
import {
  paletaDelTema,
  RADIOS,
  type EstiloLinks,
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

  const linkWhatsapp = datos.whatsapp
    ? `https://wa.me/${datos.whatsapp.length === 8 ? "506" : ""}${datos.whatsapp}`
    : null;
  const linkMapa = datos.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(datos.direccion)}`
    : null;

  // Las puertas: el menú primero (es el producto), después las del dueño.
  const puertas: { clave: string; glifo: string; titulo: string; pie?: string; href: string }[] = [];
  if (datos.hayMenu) {
    puertas.push({
      clave: "menu",
      glifo: "🍽",
      titulo: datos.aceptaPedidos && datos.mesa ? "Ver el menú y pedir" : "Ver el menú",
      pie: datos.seccionesMenu.slice(0, 3).join(" · "),
      href: datos.hrefMenu ?? "#",
    });
  }
  for (const l of datos.links) {
    puertas.push({
      clave: l.id,
      glifo: ICONO_LINK[l.icono]?.glifo ?? "🔗",
      titulo: l.etiqueta,
      href: l.url,
    });
  }

  return (
    <div
      /* `@container`: la grilla de puertas se acomoda al ancho de ESTA
         página, no al de la ventana. Importa porque el mismo componente
         se monta a 236 px (un mockup del héroe), a 288 px (la previa del
         panel) y a pantalla completa — y un breakpoint de viewport
         mentiría en los dos primeros. */
      className={`@container flex min-h-full w-full flex-col px-5 pb-8 pt-6 ${className}`}
      style={{
        background: `linear-gradient(180deg, ${p.fondo} 0%, ${p.fondo2} 100%)`,
        color: p.tinta,
      }}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5">
        {/* ── La cabecera: foto, logo, nombre ─────────────────── */}
        <header
          className="relative overflow-hidden border"
          style={{ borderColor: p.borde, borderRadius: r.tarjeta }}
        >
          {datos.fotoPortadaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={datos.fotoPortadaUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-50"
            />
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, transparent 18%, ${p.fondo} 97%)` }}
          />
          <div className="relative flex min-h-[168px] flex-col justify-end gap-3 p-5">
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
                  className="h-14 w-14 shrink-0 object-cover"
                  style={{ borderRadius: grilla ? 999 : r.foto }}
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-14 w-14 shrink-0 place-items-center text-[26px] font-extrabold"
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
                <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">
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
                    <p className="mt-0.5 text-[13px]" style={{ color: p.suave }}>
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
                  className="flex min-h-[92px] flex-col items-center justify-center gap-2 border p-3 text-center transition-opacity hover:opacity-90"
                  style={{
                    background: p.superficie,
                    borderColor: x.clave === "menu" ? p.acento : p.borde,
                    borderRadius: r.pieza,
                  }}
                >
                  <span
                    aria-hidden
                    className="grid h-9 w-9 place-items-center text-[18px]"
                    style={{
                      background: x.clave === "menu" ? p.acento : "transparent",
                      borderRadius: 999,
                    }}
                  >
                    {x.glifo}
                  </span>
                  <span className="line-clamp-2 text-[11px] font-extrabold leading-tight @[300px]:text-[11.5px]">
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
                  className="flex min-h-[64px] items-center gap-4 border p-4 transition-opacity hover:opacity-90"
                  style={{
                    background: p.superficie,
                    borderColor: x.clave === "menu" ? p.acento : p.borde,
                    borderRadius: r.pieza,
                  }}
                >
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center text-[20px]"
                    style={{
                      background: x.clave === "menu" ? p.acento : p.superficie,
                      border: x.clave === "menu" ? "none" : `1px solid ${p.borde}`,
                      borderRadius: r.foto,
                    }}
                  >
                    {x.glifo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-extrabold leading-tight">
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
                      <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: p.suave }}>
                        {x.pie}
                      </span>
                    )}
                  </span>
                  <span aria-hidden style={{ color: p.suave }}>
                    ›
                  </span>
                </Ancla>
              ),
            )}
          </nav>
        )}

        {/* ── Contacto ────────────────────────────────────────── */}
        {(linkWhatsapp || linkMapa) && (
          <section className="flex flex-col gap-2 text-[13px]" style={{ color: p.suave }}>
            {linkMapa && (
              <Ancla inerte={inerte} href={linkMapa} className="underline-offset-2 hover:underline">
                📍 {datos.direccion}
              </Ancla>
            )}
            {linkWhatsapp && (
              <Ancla inerte={inerte} href={linkWhatsapp} className="underline-offset-2 hover:underline">
                💬 Escribinos por WhatsApp
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
