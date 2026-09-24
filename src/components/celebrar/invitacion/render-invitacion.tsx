import type { DatosSeccion, Documento, Estilo, Seccion, TipoSeccion } from "@/lib/celebrar/invitacion/esquema";
import { NOMBRE_SECCION, ratioContraste } from "@/lib/celebrar/invitacion/esquema";
import { alfa, mezclar } from "@/lib/celebrar/invitacion/colores";
import { pilaDe, urlGoogleFonts } from "@/lib/celebrar/invitacion/fuentes";
import { fechaLargaCR } from "@/lib/fechas";
import CuentaRegresiva from "./cuenta-regresiva";
import { patronDecoracion } from "./decoracion";
import Escena, { type EscenaEditable } from "./escena";
import EsquinasDecorativas from "./esquinas";
import FondoVivoCapa from "./fondo-vivo";
import FormularioRsvp from "./formulario-rsvp";
import Musica from "./musica";
import { BordeEscena, Icono, Ornamento } from "./ornamentos";
import Particulas from "./particulas";
import { ProveedorEdicionTexto, Texto, type EditarTexto } from "./texto-editable";
import AperturaInvitacion from "./apertura-invitacion";
import Escenografia, { Cruce } from "./tema";
import "./invitacion.css";

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL RENDERIZADOR DE LA INVITACIÓN
 * ══════════════════════════════════════════════════════════════════
 *
 * Dibuja un `Documento` (estilo + secciones) con los datos de la
 * celebración, al estándar de las invitaciones de Bookea: a pantalla
 * completa, contada por ESCENAS que entran al scrollear, con ornamentos,
 * texturas, bordes con personalidad entre escenas y un ambiente vivo de
 * partículas. Es UN solo componente para la previa del editor (dentro
 * del teléfono) y para la página pública: lo que la persona ve al editar
 * es exactamente lo que van a recibir sus invitados.
 *
 * Todo texto se pinta como texto (React escapa): el documento nunca se
 * interpreta como HTML. Colores y letras entran por variables CSS en el
 * nodo raíz; la hoja de estilos vive en invitacion.css y mide en `cqi`
 * para que la previa de 390 px sea fiel al teléfono.
 */

export type CelebracionParaRender = {
  nombre: string;
  fecha: string | null;
  hora: string | null;
  lugarNombre: string | null;
  direccion: string | null;
  mapsUrl: string | null;
  /** La dirección pública: con ella el formulario de confirmación guarda de verdad. */
  slug?: string;
  /** El partner (planner, agencia) que la diseñó, si lo hay y quiere firmarla. */
  partner?: { nombre: string; url: string | null; logoUrl: string | null } | null;
};

const RADIO = { rectos: "0px", suaves: "14px", redondos: "26px" } as const;

/**
 * En el editor las secciones vacías muestran una pista («las fotos van
 * a aparecer acá»); en la página pública se omiten: la persona invitada
 * no tiene que ver huecos ni botones que no llevan a ningún lado.
 */
/**
 * «demo» es la invitación de muestra de la portada: como la pública, pero
 * la confirmación es el formulario en la página (lo que llega en la Fase
 * 6) y responde sin guardar nada.
 */
export type ModoRender = "editor" | "publico" | "demo";

/** El rótulo chico sobre el título de cada escena (el «AGENDÁ LA FECHA»). */
const KICKER: Record<Exclude<TipoSeccion, "hero">, string> = {
  countdown: "Cuenta regresiva",
  detalles: "Agendá la fecha",
  ubicacion: "El lugar",
  historia: "Capítulo uno",
  galeria: "Momentos",
  dress_code: "Cómo vestir",
  itinerario: "El programa",
  rsvp: "La confirmación",
  regalos: "Muestras de cariño",
  mensaje: "Con amor",
  faq: "Preguntas",
};

type Tono = { bg: string; tinta: string };

export default function RenderInvitacion({
  documento,
  celebracion,
  conFuentes = true,
  className = "",
  modo = "publico",
  altoPantalla,
  soloPortada = false,
  edicion,
  escenario = false,
  apertura = false,
}: {
  documento: Documento;
  celebracion: CelebracionParaRender;
  /** Inyecta el <link> de Google Fonts (React lo sube al <head>). */
  conFuentes?: boolean;
  className?: string;
  modo?: ModoRender;
  /** El alto de «una pantalla» (la portada lo llena). Por defecto 100svh; el editor pasa el alto del teléfono. */
  altoPantalla?: string;
  /** Solo la portada, sin partículas ni pista: para las miniaturas del catálogo. */
  soloPortada?: boolean;
  /** En el editor: la sección seleccionada y qué hacer al tocar una escena. */
  edicion?: Pick<EscenaEditable, "alSeleccionar" | "alOcultar" | "alDisenar"> & { activa: string | null; alEditarTexto?: EditarTexto };
  /**
   * A pantalla completa (la página pública, la vista previa). Desde el
   * 23 sep 2026 la invitación ocupa TODO el navegador también en PC y
   * iPad (lo pidió el dueño): las escenas van de borde a borde y el
   * contenido se recompone a lo ancho (columnas, programa horizontal,
   * galería a cuatro) con medidas topadas por `--u` — ver invitacion.css.
   */
  escenario?: boolean;
  /**
   * Con la capa de apertura (la carta que se abre, el destello…): la
   * página pública y los demos a pantalla completa. Nunca en el editor
   * ni dentro del teléfono del héroe.
   */
  apertura?: boolean;
}) {
  const { estilo } = documento;
  const p = estilo.paleta;
  const visibles = documento.secciones.filter((s) =>
    modo === "editor" ? true : (s.visible || s.tipo === "hero") && !estaVacia(s, modo),
  );
  const secciones = soloPortada ? visibles.slice(0, 1) : visibles;
  // El motivo es un susurro, no un empapelado: a más opacidad el diseño se
  // vuelve difícil de leer (lo pidió el dueño el 21 sep 2026, mirando fiestly).
  const OPACIDAD_MOTIVO = { sutil: 0.1, media: 0.19, fuerte: 0.32 } as const;

  // El tono de cada escena según el ritmo. La portada va siempre sobre
  // el fondo (o su foto).
  const fondo: Tono = { bg: p.fondo, tinta: p.tinta };
  const escena: Tono = { bg: p.escena, tinta: p.tintaEscena };
  const tonoDe = (i: number): Tono => {
    const propio = secciones[i]?.diseno.tono;
    if (propio === "fondo") return fondo;
    if (propio === "escena") return escena;
    if (i === 0) return fondo;
    if (estilo.ritmo === "uniforme") return fondo;
    if (estilo.ritmo === "escena") return escena;
    return i % 2 === 1 ? escena : fondo;
  };
  const ultimo = tonoDe(secciones.length - 1);
  const sobreAcento = ratioContraste(p.acento, "#ffffff") >= ratioContraste(p.acento, "#1a1a1a") ? "#ffffff" : "#1a1a1a";

  // La foto de ambiente del escenario: la de la portada, si hay.
  const portada = documento.secciones[0];
  const fotoEscenario = portada?.tipo === "hero" ? portada.datos.fotoUrl || portada.diseno.fondoUrl || "" : "";

  // Con un título «display» (condensadas, muy negras) el lema en cursiva del
  // título grita; va en la letra de texto.
  const lemaEnTexto = ["bebas", "oswald", "abril", "fredoka", "baloo"].includes(estilo.fuenteTitulo);

  const articulo = (
    <article
      className={`inv ${estilo.tema !== "ninguno" ? `inv-tema-${estilo.tema}` : ""} ${estilo.marco && !soloPortada ? "inv-con-filete" : ""} ${lemaEnTexto ? "inv-lema-texto" : ""} ${className}`}
      data-anima={estilo.animaciones ? "1" : "0"}
      data-entrada={estilo.entrada}
      style={
        {
          "--inv-fondo": p.fondo,
          "--inv-tinta": p.tinta,
          "--inv-acento": p.acento,
          "--inv-suave": p.suave,
          "--inv-superficie": p.superficie,
          "--inv-escena": p.escena,
          "--inv-tinta-escena": p.tintaEscena,
          "--inv-sobre-acento": sobreAcento,
          "--inv-acento-55": alfa(p.acento, 0.55),
          "--inv-escena-oscura": mezclar(p.escena, "#000000", 0.6),
          "--inv-fondo-82": alfa(p.fondo, 0.82),
          "--inv-radio": RADIO[estilo.bordes],
          "--inv-titulo": pilaDe(estilo.fuenteTitulo),
          "--inv-texto": pilaDe(estilo.fuenteTexto),
          // Los colores de la escenografía temática, sacados de la paleta.
          "--tema-silueta": mezclar(p.fondo, "#000000", 0.4),
          "--tema-lejos": mezclar(p.tinta, p.fondo, 0.13),
          "--tema-muro": p.superficie,
          "--tema-techo": p.acento,
          "--tema-sombra": mezclar(p.tinta, p.escena, 0.4),
          ...(altoPantalla ? { "--inv-alto": altoPantalla } : {}),
        } as React.CSSProperties
      }
    >
      {conFuentes && (
        <link rel="stylesheet" href={urlGoogleFonts([estilo.fuenteTitulo, estilo.fuenteTexto])} precedence="default" />
      )}
      {estilo.marco && !soloPortada && <span className="inv-filete" aria-hidden="true" />}

      <ProveedorEdicionTexto editar={edicion?.alEditarTexto ?? null}>
      {secciones.map((s, i) => {
        const tono = tonoDe(i);
        const anterior = i === 0 ? null : tonoDe(i - 1);
        // Tras una portada de foto no hay borde: el color anterior es la foto.
        const trasFoto = i === 1 && secciones[0].tipo === "hero" && estilo.heroe === "foto";
        const borde = anterior && anterior.bg !== tono.bg && !trasFoto ? anterior.bg : null;
        const esUltima = i === secciones.length - 1;
        const dis = s.diseno;
        // Con foto de fondo la escena se lee sobre un velo oscuro: tinta blanca.
        // La PORTADA es distinta: su foto de fondo va bajo un velo del color
        // de la paleta, así conserva sus letras y sus colores (es lo que hace
        // que el catálogo se vea como una invitación de verdad).
        const conFoto = s.tipo !== "hero" && !!dis.fondoUrl;
        const portadaConFondo = s.tipo === "hero" && !!dis.fondoUrl && estilo.heroe !== "foto";
        const tinta = conFoto ? "#ffffff" : tono.tinta;
        // El acento sobre ESTA escena: si no contrasta con su fondo (un
        // coral sobre rojo), los rótulos y botones usan la tinta de la escena.
        const acento = conFoto ? "#ffffff" : ratioContraste(p.acento, tono.bg) >= 2.3 ? p.acento : tinta;
        const sobreAcentoEsc = ratioContraste(acento, "#ffffff") >= ratioContraste(acento, "#1a1a1a") ? "#ffffff" : "#1a1a1a";
        const clases = [
          "inv-esc",
          s.tipo === "hero" ? `inv-hero inv-hero-${estilo.heroe}${estilo.esquinas !== "ninguna" ? " inv-con-esquinas" : ""}` : `inv-esc-${s.tipo}`,
          dis.tamano !== "normal" ? `inv-esc-${dis.tamano}` : "",
          dis.alineacion === "izquierda" ? "inv-esc-izq" : "",
          conFoto ? "inv-esc-foto" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <Escena
            key={s.id}
            className={clases}
            borde={!!borde}
            editable={
              edicion
                ? {
                    id: s.id,
                    nombre: NOMBRE_SECCION[s.tipo],
                    activa: edicion.activa === s.id,
                    fija: s.tipo === "hero",
                    visible: s.visible || s.tipo === "hero",
                    alSeleccionar: edicion.alSeleccionar,
                    alOcultar: edicion.alOcultar,
                    alDisenar: edicion.alDisenar,
                  }
                : undefined
            }
            style={
              {
                "--esc-bg": tono.bg,
                "--esc-tinta": tinta,
                "--esc-acento": acento,
                "--esc-sobre-acento": sobreAcentoEsc,
                "--esc-suave": conFoto ? "rgba(255,255,255,.82)" : mezclar(tono.tinta, tono.bg, 0.72),
                // Mezclas planas (sin color-mix en CSS): ver colores.ts.
                "--esc-tinta-05": alfa(tinta, 0.05),
                "--esc-tinta-12": alfa(tinta, 0.12),
                "--esc-tinta-18": alfa(tinta, 0.18),
                "--esc-tinta-22": alfa(tinta, 0.22),
                "--esc-tinta-25": alfa(tinta, 0.25),
                "--esc-tinta-40": alfa(tinta, 0.4),
                "--esc-acento-45": alfa(acento, 0.45),
                "--esc-acento-50": alfa(acento, 0.5),
                "--esc-acento-55": alfa(acento, 0.55),
                "--esc-acento-60": alfa(acento, 0.6),
                "--esc-acento-sombra": alfa(mezclar(acento, "#000000", 0.7), 0.5),
                "--vivo-a": conFoto ? "rgba(255,255,255,.25)" : mezclar(acento, tono.bg, 0.55),
                "--vivo-b": conFoto ? "rgba(255,255,255,.18)" : mezclar(tinta, tono.bg, 0.22),
                "--vivo-c": conFoto ? "rgba(255,255,255,.3)" : mezclar(p.escena, tono.bg, 0.6),
              } as React.CSSProperties
            }
          >
            {conFoto && (
              <div className="inv-fondo-foto" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dis.fondoUrl} alt="" loading="lazy" />
              </div>
            )}
            {portadaConFondo && (
              <div
                className="inv-fondo-foto inv-fondo-paleta"
                // El velo deja respirar la foto arriba y se cierra detrás del
                // texto: con 0,55 parejo la portada salía lavada.
                style={{ "--velo-a": alfa(tono.bg, 0.3), "--velo-b": alfa(tono.bg, 0.93) } as React.CSSProperties}
                aria-hidden="true"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dis.fondoUrl} alt="" />
              </div>
            )}
            {!conFoto && (
              <FondoVivoCapa
                tipo={fondoVivoDe(dis.fondoVivo === "auto" ? estilo.fondoVivo : dis.fondoVivo, portadaConFondo)}
                intensidad={estilo.fondoIntensidad}
                velocidad={estilo.fondoVelocidad}
                atenuado={portadaConFondo}
              />
            )}
            {borde && <BordeEscena tipo={estilo.transicion} color={borde} />}
            {!conFoto && (
              <Textura
                estilo={estilo}
                patron={
                  llevaMotivo(s, estilo, portadaConFondo)
                    ? patronDecoracion(estilo.decoracion, mezclar(tinta, tono.bg, 0.55), tono.bg, estilo.decoracionEscala)
                    : null
                }
                opacidad={OPACIDAD_MOTIVO[estilo.decoracionIntensidad]}
                bordes={estilo.decoracionDisposicion === "bordes"}
              />
            )}
            {(s.tipo === "hero" || (esUltima && s.tipo === "mensaje")) && <EsquinasDecorativas tipo={estilo.esquinas} />}
            {s.tipo === "hero" && estilo.tema !== "ninguno" && <Escenografia tema={estilo.tema} />}
            {!soloPortada && s.tipo !== "hero" && estilo.tema !== "ninguno" && estilo.animaciones && <Cruce tema={estilo.tema} />}
            {!soloPortada && (s.tipo === "hero" || esUltima) && estilo.particulas !== "ninguna" && (
              <Particulas tipo={estilo.particulas} cantidad={s.tipo === "hero" ? 18 : 10} semilla={i + 3} />
            )}
            <SeccionRender s={s} doc={documento} c={celebracion} modo={modo} hayMas={!soloPortada && secciones.length > 1} />
          </Escena>
        );
      })}
      </ProveedorEdicionTexto>

      {!soloPortada && documento.musica.url && (
        <Musica url={documento.musica.url} titulo={documento.musica.titulo} autoplay={documento.musica.autoplay && modo === "publico"} />
      )}
      {!soloPortada && (
        <footer className="inv-credito" style={{ background: ultimo.bg, color: ultimo.tinta }}>
          {celebracion.partner && (
            <p className="inv-credito-partner">
              {celebracion.partner.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={celebracion.partner.logoUrl} alt="" />
              )}
              <span>
                Diseñada por{" "}
                {celebracion.partner.url ? (
                  <a href={celebracion.partner.url} target="_blank" rel="noopener noreferrer">
                    {celebracion.partner.nombre}
                  </a>
                ) : (
                  <strong>{celebracion.partner.nombre}</strong>
                )}
              </span>
            </p>
          )}
          <p style={{ margin: 0 }}>
            Hecho con <a href="https://celebrar.lat">celebrar.lat</a>
          </p>
        </footer>
      )}
    </article>
  );

  const capaApertura =
    apertura && !soloPortada && modo !== "editor" && estilo.apertura !== "directa" ? (
      <AperturaInvitacion
        tipo={estilo.apertura}
        nombre={(portada?.tipo === "hero" && portada.datos.titulo) || celebracion.nombre}
        saludo={(portada?.tipo === "hero" && portada.datos.saludo) || "Tenés una invitación"}
        paleta={p}
        fuenteTitulo={pilaDe(estilo.fuenteTitulo)}
        fuenteTexto={pilaDe(estilo.fuenteTexto)}
      />
    ) : null;

  if (!escenario)
    return (
      <>
        {capaApertura}
        {articulo}
      </>
    );
  return (
    <div
      className="inv-escenario"
      style={
        {
          "--escn-a": p.escena,
          "--escn-b": mezclar(p.escena, "#000000", 0.35),
          "--escn-acento": alfa(p.acento, 0.35),
          "--escn-fondo": alfa(p.fondo, 0.18),
        } as React.CSSProperties
      }
    >
      <div className="inv-escenario-fondo" aria-hidden="true">
        {fotoEscenario && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoEscenario} alt="" />
        )}
      </div>
      {capaApertura}
      {articulo}
    </div>
  );
}

/**
 * Sobre una foto de ambiente los fondos vivos de borde duro (las líneas,
 * la malla) se ven como rayones; solo pasan los blandos (aurora, ondas,
 * degradado, destello, círculos).
 */
function fondoVivoDe(tipo: Estilo["fondoVivo"], sobreFoto: boolean): Estilo["fondoVivo"] {
  if (sobreFoto && (tipo === "lineas" || tipo === "malla")) return "ninguno";
  return tipo;
}

/**
 * Dónde SÍ va el motivo. Nunca sobre una foto (la portada con foto de
 * ambiente o la portada-foto): encima de una imagen el patrón solo
 * ensucia. Y en la portada con adornos de esquina, tampoco: las esquinas
 * ya son el adorno, y tres capas de ornamento en la misma pantalla es lo
 * que hacía los diseños «difíciles de entender».
 */
function llevaMotivo(s: Seccion, estilo: Estilo, portadaConFondo: boolean): boolean {
  if (estilo.decoracion === "ninguna") return false;
  if (s.tipo === "hero") {
    if (portadaConFondo || estilo.heroe === "foto") return false;
    if (estilo.esquinas !== "ninguna") return false;
    return true;
  }
  return estilo.decoracionDisposicion !== "portada";
}

/** La capa de textura de una escena (y el motivo decorativo, si hay). */
function Textura({
  estilo,
  patron,
  opacidad,
  bordes,
}: {
  estilo: Estilo;
  patron: { backgroundImage: string; backgroundSize: string } | null;
  opacidad: number;
  /** El motivo solo como guirnalda arriba y abajo. */
  bordes: boolean;
}) {
  return (
    <>
      {estilo.textura === "seda" && (
        <div className="inv-seda" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
      {estilo.textura === "papel" && <div className="inv-tex inv-tex-papel" aria-hidden="true" />}
      {estilo.textura === "grano" && <div className="inv-tex inv-tex-grano" aria-hidden="true" />}
      {estilo.textura === "vineta" && <div className="inv-tex inv-tex-vineta" aria-hidden="true" />}
      {patron && <div className={`inv-tex ${bordes ? "inv-tex-bordes" : ""}`} style={{ ...patron, opacity: opacidad }} aria-hidden="true" />}
    </>
  );
}

/** Sin contenido que mostrarle a un invitado: en la pública se omite. */
function estaVacia(s: Seccion, modo: ModoRender = "publico"): boolean {
  switch (s.tipo) {
    case "galeria":
      return s.datos.fotos.length === 0;
    case "historia":
      return !s.datos.texto.trim() && !s.datos.fotoUrl;
    case "dress_code":
      return !s.datos.texto.trim() && s.datos.grupos.length === 0;
    case "itinerario":
      return s.datos.items.length === 0;
    case "regalos":
      return !s.datos.texto.trim() && s.datos.items.length === 0 && !s.datos.sinpe.trim();
    case "mensaje":
      return !s.datos.texto.trim() && !s.datos.firma.trim();
    case "faq":
      return s.datos.items.length === 0;
    case "rsvp":
      // Con el formulario en la página siempre hay algo que hacer. Por
      // WhatsApp, sin número el botón no lleva a ningún lado: se omite.
      return modo !== "demo" && s.datos.modo !== "panel" && !s.datos.whatsapp.replace(/\D/g, "");
    default:
      return false;
  }
}

/** Retraso de entrada en cascada, en segundos, para el elemento i. */
const rev = (i: number, base = 0.15) => ({ "--d": `${(base + i * 0.12).toFixed(2)}s` }) as React.CSSProperties;

/* ── Las escenas ───────────────────────────────────────────────── */

function SeccionRender({ s, doc, c, modo, hayMas }: { s: Seccion; doc: Documento; c: CelebracionParaRender; modo: ModoRender; hayMas: boolean }) {
  const orn: Estilo["ornamento"] = s.diseno.ornamento ? doc.estilo.ornamento : "ninguno";
  switch (s.tipo) {
    case "hero":
      return <Hero sid={s.id} d={s.datos} doc={doc} c={c} hayMas={hayMas} modo={modo} />;
    case "countdown":
      return (
        <Cabecera sid={s.id} kicker={KICKER.countdown} titulo={s.datos.titulo} orn={orn}>
          <CuentaRegresiva fecha={c.fecha} hora={c.hora} />
          {s.datos.texto && <Texto sid={s.id} ruta="texto" valor={s.datos.texto} className="inv-lema inv-rev" style={{ marginTop: "calc(5 * var(--u))", ...rev(3) }} />}
        </Cabecera>
      );
    case "detalles":
      return <Detalles sid={s.id} d={s.datos} c={c} orn={orn} />;
    case "itinerario":
      return (
        <Cabecera sid={s.id} kicker={KICKER.itinerario} titulo={s.datos.titulo} orn={orn}>
          {s.datos.items.length === 0 ? (
            <Vacio>Agregá los momentos del día en Secciones → Programa del día.</Vacio>
          ) : (
            <ol className="inv-tiempo" style={{ listStyle: "none" }}>
              {s.datos.items.map((m, i) => (
                <li key={i} className="inv-momento inv-rev inv-rev-lado" style={rev(i, 0.2)}>
                  {m.hora && <Texto sid={s.id} ruta={`items.${i}.hora`} valor={m.hora} className="inv-momento-hora" style={{ margin: 0 }} />}
                  <Texto sid={s.id} ruta={`items.${i}.titulo`} valor={m.titulo} className="inv-momento-titulo" style={{ margin: 0 }} />
                  {m.detalle && <Texto sid={s.id} ruta={`items.${i}.detalle`} valor={m.detalle} className="inv-p inv-p-suave" style={{ marginTop: 4 }} />}
                </li>
              ))}
            </ol>
          )}
        </Cabecera>
      );
    case "ubicacion":
      return <Ubicacion sid={s.id} d={s.datos} c={c} orn={orn} modo={modo} />;
    case "historia":
      return (
        <Cabecera sid={s.id} kicker={KICKER.historia} titulo={s.datos.titulo} orn={orn}>
          {s.datos.texto && (
            <Texto sid={s.id} ruta="texto" valor={s.datos.texto} multilinea className="inv-p inv-rev inv-ancho" style={{ marginTop: "calc(6 * var(--u))", whiteSpace: "pre-line", maxWidth: "46ch", ...rev(2) }} />
          )}
          {s.datos.fotoUrl && (
            <div className="inv-polas">
              <Polaroid url={s.datos.fotoUrl} rot="-2.5deg" d=".4s" pie={c.nombre} />
            </div>
          )}
        </Cabecera>
      );
    case "galeria":
      return (
        <Cabecera sid={s.id} kicker={KICKER.galeria} titulo={s.datos.titulo} orn={orn}>
          {s.datos.fotos.length === 0 ? (
            <Vacio>Las fotos que subás van a aparecer acá, como polaroids.</Vacio>
          ) : (
            <div className="inv-polas inv-galeria">
              {s.datos.fotos.map((f, i) => (
                <Polaroid key={`${f}-${i}`} url={f} rot={`${[-3, 2, -1.5, 2.5, -2, 1.5][i % 6]}deg`} d={`${(0.15 + (i % 4) * 0.1).toFixed(2)}s`} />
              ))}
            </div>
          )}
        </Cabecera>
      );
    case "dress_code":
      return <DressCode sid={s.id} d={s.datos} orn={orn} tema={doc.estilo.tema} />;
    case "rsvp":
      return <Rsvp sid={s.id} d={s.datos} c={c} modo={modo} orn={orn} />;
    case "regalos":
      return <Regalos sid={s.id} d={s.datos} orn={orn} />;
    case "mensaje":
      return (
        <div className="inv-cont inv-cierre">
          <Ornamento tipo={orn} className="inv-orn inv-rev" />
          {s.datos.titulo && <Texto sid={s.id} ruta="titulo" valor={s.datos.titulo} className="inv-kicker inv-rev" style={{ marginTop: "calc(6 * var(--u))", ...rev(1) }} />}
          {s.datos.texto && (
            <Texto sid={s.id} ruta="texto" valor={s.datos.texto} multilinea className="inv-lema inv-rev inv-ancho" style={{ marginTop: "calc(4 * var(--u))", whiteSpace: "pre-line", ...rev(2) }} />
          )}
          <Texto sid={s.id} ruta="firma" valor={s.datos.firma || c.nombre} className="inv-firma inv-rev inv-rev-sumerge" style={{ margin: 0, marginTop: "calc(5 * var(--u))", ...rev(3) }}>
            <Nombres texto={s.datos.firma || c.nombre} enLinea />
          </Texto>
          {c.fecha && (
            <p className="inv-caps inv-rev" style={{ marginTop: "calc(5 * var(--u))", color: "var(--esc-suave)", ...rev(4) }}>
              {fechaLargaCR(c.fecha)}
              {c.lugarNombre ? ` · ${c.lugarNombre}` : ""}
            </p>
          )}
        </div>
      );
    case "faq":
      return (
        <Cabecera sid={s.id} kicker={KICKER.faq} titulo={s.datos.titulo} orn={orn}>
          <div className="inv-faq">
            {s.datos.items.map((q, i) => (
              <details key={i} className="inv-rev" style={rev(i, 0.2)}>
                <summary>
                  <Texto sid={s.id} ruta={`items.${i}.pregunta`} valor={q.pregunta} as="span" />
                </summary>
                <Texto sid={s.id} ruta={`items.${i}.respuesta`} valor={q.respuesta} multilinea className="inv-p inv-p-suave" />
              </details>
            ))}
          </div>
        </Cabecera>
      );
  }
}

/* ── Piezas ─────────────────────────────────────────────────────── */

/** Kicker + título + ornamento, en cascada; el contenido debajo. */
function Cabecera({ sid, kicker, titulo, orn, children }: { sid: string; kicker: string; titulo: string; orn: Estilo["ornamento"]; children: React.ReactNode }) {
  const mostrarKicker = kicker.toLowerCase() !== titulo.trim().toLowerCase();
  return (
    <div className="inv-cont">
      {mostrarKicker && <p className="inv-kicker inv-rev">{kicker}</p>}
      {titulo && (
        <Texto sid={sid} ruta="titulo" valor={titulo} as="h2" className="inv-h2 inv-rev inv-rev-sumerge" style={{ marginTop: mostrarKicker ? "calc(3 * var(--u))" : 0, ...rev(1, 0) }} />
      )}
      <Ornamento tipo={orn} className="inv-orn inv-rev inv-rev-crece" />
      {children}
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="inv-vacio">{children}</p>;
}

function Polaroid({ url, rot, d, pie }: { url: string; rot: string; d: string; pie?: string }) {
  return (
    <figure className="inv-pola" style={{ "--rot": rot, "--d": d, margin: 0 } as React.CSSProperties}>
      {/* <img> a propósito: el documento puede traer cualquier https válido (Cloudflare Images ya optimiza). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" loading="lazy" />
      {pie && <figcaption className="inv-pola-pie">{pie}</figcaption>}
    </figure>
  );
}

/** Las piezas de una fecha ISO para la fecha monumental. */
function piezasFecha(fecha: string): { diaSemana: string; dia: string; mes: string; anio: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const d = new Date(`${fecha}T12:00:00-06:00`);
  if (Number.isNaN(d.getTime())) return null;
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", ...o }).format(d);
  return { diaSemana: f({ weekday: "long" }), dia: f({ day: "numeric" }), mes: f({ month: "long" }), anio: f({ year: "numeric" }) };
}

function horaBonita(hora: string | null): string {
  if (!hora || !/^\d{2}:\d{2}/.test(hora)) return "";
  const [h, m] = hora.split(":").map(Number);
  const sufijo = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** Un evento de 3 horas en Google Calendar (sin API): abre el borrador ya lleno. */
function urlCalendario(c: CelebracionParaRender): string | null {
  if (!c.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) return null;
  const hora = /^\d{2}:\d{2}/.test(c.hora ?? "") ? (c.hora as string).slice(0, 5) : "18:00";
  const inicio = new Date(`${c.fecha}T${hora}:00-06:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  const fin = new Date(inicio.getTime() + 3 * 3600 * 1000);
  const marca = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: c.nombre,
    dates: `${marca(inicio)}/${marca(fin)}`,
    location: [c.lugarNombre, c.direccion].filter(Boolean).join(", "),
    ctz: "America/Costa_Rica",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/* ── El héroe, en sus seis disposiciones ───────────────────────── */

/** «Sofía & Andrés» → Sofía / & / Andrés, con el «&» en acento. */
function Nombres({ texto, enLinea = false }: { texto: string; enLinea?: boolean }) {
  const m = texto.match(/^(.{1,60}?)\s+(&|y|e|and)\s+(.{1,60})$/i);
  if (!m) return <>{texto}</>;
  const amp = m[2].toLowerCase() === "and" ? "&" : m[2];
  return (
    <>
      {m[1]}
      <span className="inv-amp" style={enLinea ? { display: "inline", margin: "0 0.15em", fontSize: "0.7em" } : undefined}>
        {amp}
      </span>
      {m[3]}
    </>
  );
}

function Hero({ sid, d, doc, c, hayMas, modo }: { sid: string; d: DatosSeccion["hero"]; doc: Documento; c: CelebracionParaRender; hayMas: boolean; modo: ModoRender }) {
  const titulo = d.titulo || c.nombre;
  const h = doc.estilo.heroe;
  const orn: Estilo["ornamento"] = doc.secciones[0]?.diseno.ornamento === false ? "ninguno" : doc.estilo.ornamento;
  const fecha = d.mostrarFecha && c.fecha ? `${fechaLargaCR(c.fecha)}${c.hora ? ` · ${horaBonita(c.hora)}` : ""}` : "";
  const desliza = hayMas ? <p className="inv-desliza">Deslizá ↓</p> : null;

  const cuerpo = (
    <>
      {d.saludo && <Texto sid={sid} ruta="saludo" valor={d.saludo} className="inv-kicker inv-rev" style={rev(0)} />}
      <Texto sid={sid} ruta="titulo" valor={titulo} as="h1" className="inv-h1 inv-rev inv-rev-sumerge" style={{ marginTop: d.saludo ? "calc(4 * var(--u))" : 0, ...rev(1) }}>
        <Nombres texto={titulo} />
      </Texto>
      <Ornamento tipo={orn} className="inv-orn inv-rev inv-rev-crece" />
      {d.subtitulo && <Texto sid={sid} ruta="subtitulo" valor={d.subtitulo} className="inv-lema inv-rev inv-ancho" style={{ marginTop: "calc(4.5 * var(--u))", ...rev(2) }} />}
      {fecha && <p className="inv-caps inv-rev" style={{ marginTop: "calc(6 * var(--u))", color: "var(--esc-suave)", ...rev(3) }}>{fecha}</p>}
    </>
  );

  if (h === "foto") {
    return (
      <>
        <div className="inv-fondo-foto" aria-hidden="true">
          {d.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.fotoUrl} alt="" />
          ) : (
            <div className="inv-fondo-degradado" />
          )}
        </div>
        {!d.fotoUrl && modo === "editor" && <span className="inv-pista-foto" style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", zIndex: 3 }}>Tu foto acá · pestaña «Fotos»</span>}
        <div className="inv-cont">{cuerpo}</div>
        {desliza}
      </>
    );
  }

  if (h === "tarjeta") {
    return (
      <>
        <div className="inv-fondo-degradado" aria-hidden="true" />
        <div className="inv-cont">
          <div className="inv-carta inv-carta-llena inv-rev inv-rev-sumerge" style={{ padding: "calc(12 * var(--u)) calc(7 * var(--u))", width: "100%" }}>
            {d.fotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.fotoUrl} alt="" className="inv-redonda" style={{ margin: "0 auto calc(6 * var(--u))" }} />
            )}
            {cuerpo}
          </div>
        </div>
        {desliza}
      </>
    );
  }

  if (h === "marco") {
    return (
      <>
        <div className="inv-cont">
          <div className="inv-marco-doble inv-rev inv-rev-crece">
            <div className="inv-esquinas">{cuerpo}</div>
          </div>
        </div>
        {desliza}
      </>
    );
  }

  if (h === "dividido") {
    return (
      <>
        <div className="inv-cont">
          {cuerpo}
          {d.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.fotoUrl} alt="" className="inv-arco inv-rev inv-rev-sumerge" style={rev(4)} />
          ) : (
            <div className="inv-arco inv-fondo-degradado inv-rev inv-rev-sumerge" style={{ position: "relative", inset: "auto", display: "grid", placeItems: "center", ...rev(4) }} aria-hidden="true">
              {modo === "editor" && <span className="inv-pista-foto">Tu foto acá · pestaña «Fotos»</span>}
            </div>
          )}
        </div>
        {desliza}
      </>
    );
  }

  if (h === "editorial") {
    return (
      <>
        <div className="inv-cont">
          {d.saludo && <Texto sid={sid} ruta="saludo" valor={d.saludo} className="inv-kicker inv-rev" style={rev(0)} />}
          <Texto sid={sid} ruta="titulo" valor={titulo} as="h1" className="inv-h1 inv-rev inv-rev-lado" style={{ marginTop: "calc(4 * var(--u))", fontSize: "clamp(40px, calc(16 * var(--u)), 110px)", ...rev(1) }}>
            <Nombres texto={titulo} />
          </Texto>
          <span className="inv-rev" style={{ display: "block", width: "calc(22 * var(--u))", height: 1, background: "var(--inv-acento)", margin: "calc(6 * var(--u)) 0 0", ...rev(2) }} aria-hidden="true" />
          {d.subtitulo && <Texto sid={sid} ruta="subtitulo" valor={d.subtitulo} className="inv-lema inv-rev" style={{ marginTop: "calc(4 * var(--u))", maxWidth: "36ch", ...rev(2) }} />}
          {fecha && <p className="inv-caps inv-rev" style={{ marginTop: "calc(5 * var(--u))", color: "var(--esc-suave)", ...rev(3) }}>{fecha}</p>}
          {d.fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.fotoUrl} alt="" className="inv-foto-editorial inv-rev inv-rev-sumerge" style={rev(4)} />
          )}
        </div>
        {desliza}
      </>
    );
  }

  // clásica
  return (
    <>
      <div className="inv-cont">
        {d.fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.fotoUrl} alt="" className="inv-redonda inv-rev inv-rev-crece" style={{ marginBottom: "calc(7 * var(--u))" }} />
        )}
        {cuerpo}
      </div>
      {desliza}
    </>
  );
}

/* ── La fecha monumental ───────────────────────────────────────── */

function Detalles({ sid, d, c, orn }: { sid: string; d: DatosSeccion["detalles"]; c: CelebracionParaRender; orn: Estilo["ornamento"] }) {
  const f = c.fecha ? piezasFecha(c.fecha) : null;
  const cal = urlCalendario(c);
  const tituloPropio = d.titulo && d.titulo.toLowerCase() !== KICKER.detalles.toLowerCase();
  return (
    <div className="inv-cont">
      <Texto sid={sid} ruta="titulo" valor={tituloPropio ? d.titulo : KICKER.detalles} className="inv-kicker inv-rev" />
      {f ? (
        <div className="inv-fecha inv-esquinas inv-rev inv-rev-crece" style={rev(1)}>
          <span className="inv-fecha-dia-sem">{f.diaSemana}</span>
          <span className="inv-fecha-dia">{f.dia}</span>
          <span className="inv-fecha-mes">{f.mes}</span>
          <span className="inv-fecha-anio">{f.anio}</span>
        </div>
      ) : (
        <p className="inv-h3 inv-rev" style={{ marginTop: "calc(6 * var(--u))" }}>Fecha por confirmar</p>
      )}
      {c.hora && (
        <p className="inv-hora inv-rev" style={rev(2)}>
          {Icono.reloj}
          {horaBonita(c.hora)}
        </p>
      )}
      {d.texto && <Texto sid={sid} ruta="texto" valor={d.texto} className="inv-lema inv-rev inv-ancho" style={{ marginTop: "calc(5 * var(--u))", ...rev(3) }} />}
      <Ornamento tipo={orn} className="inv-orn inv-rev" />
      {cal && (
        <div className="inv-botones inv-rev" style={{ marginTop: "calc(6 * var(--u))", ...rev(4) }}>
          <a href={cal} target="_blank" rel="noopener noreferrer" className="inv-btn inv-btn-solido">
            {Icono.calendario}
            Agregar al calendario
          </a>
        </div>
      )}
    </div>
  );
}

/* ── Ubicación ─────────────────────────────────────────────────── */

function Ubicacion({ sid, d, c, orn, modo }: { sid: string; d: DatosSeccion["ubicacion"]; c: CelebracionParaRender; orn: Estilo["ornamento"]; modo: ModoRender }) {
  // Sin lugares propios se muestran los de la celebración (esos se editan en Esencial, no acá).
  const propios = d.lugares.length > 0;
  const lugares = propios
    ? d.lugares
    : [{ titulo: "", lugar: c.lugarNombre ?? "", direccion: c.direccion ?? "", hora: c.hora?.slice(0, 5) ?? "", mapsUrl: c.mapsUrl ?? "" }];
  return (
    <Cabecera sid={sid} kicker={KICKER.ubicacion} titulo={d.titulo} orn={orn}>
      {lugares.map((l, i) => {
        const consulta = [l.lugar, l.direccion].filter(Boolean).join(", ");
        const mapa = l.mapsUrl || (consulta ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}` : "");
        const waze = consulta ? `https://waze.com/ul?q=${encodeURIComponent(consulta)}&navigate=yes` : "";
        return (
          <div key={i} className="inv-lugar">
            {l.titulo && (propios ? <Texto sid={sid} ruta={`lugares.${i}.titulo`} valor={l.titulo} className="inv-kicker inv-rev" style={rev(1)} /> : <p className="inv-kicker inv-rev" style={rev(1)}>{l.titulo}</p>)}
            {propios ? (
              <Texto sid={sid} ruta={`lugares.${i}.lugar`} valor={l.lugar} className="inv-h3 inv-rev inv-rev-sumerge" style={{ marginTop: "calc(2 * var(--u))", ...rev(2) }}>
                {l.lugar || "Lugar por confirmar"}
              </Texto>
            ) : (
              <p className="inv-h3 inv-rev inv-rev-sumerge" style={{ marginTop: "calc(2 * var(--u))", ...rev(2) }}>
                {l.lugar || "Lugar por confirmar"}
              </p>
            )}
            {l.direccion && (propios ? <Texto sid={sid} ruta={`lugares.${i}.direccion`} valor={l.direccion} className="inv-p inv-p-suave inv-rev" style={{ marginTop: "calc(1.5 * var(--u))", ...rev(2) }} /> : <p className="inv-p inv-p-suave inv-rev" style={{ marginTop: "calc(1.5 * var(--u))", ...rev(2) }}>{l.direccion}</p>)}
            {l.hora && <p className="inv-caps inv-rev" style={{ marginTop: "calc(2 * var(--u))", ...rev(3) }}>{l.hora}</p>}
            {consulta && modo !== "demo" && (
              <iframe
                title={`Mapa: ${l.lugar}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(consulta)}&output=embed`}
                className="inv-mapa inv-rev"
                style={rev(3)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
            {(mapa || waze) && (
              <div className="inv-botones inv-rev" style={{ marginTop: "calc(5 * var(--u))", ...rev(4) }}>
                {mapa && (
                  <a href={mapa} target="_blank" rel="noopener noreferrer" className="inv-btn inv-btn-solido">
                    {Icono.pin}
                    Cómo llegar
                  </a>
                )}
                {waze && (
                  <a href={waze} target="_blank" rel="noopener noreferrer" className="inv-btn inv-btn-linea">
                    {Icono.waze}
                    Waze
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Cabecera>
  );
}

/* ── Código de vestimenta ──────────────────────────────────────── */

/**
 * El ícono de cada grupo de vestimenta. Primero manda lo que dice el
 * grupo («Pilotos» → casco, «Princesas» → corona, «Damas» → vestido);
 * si no dice nada reconocible, el tema de la fiesta; y si tampoco hay
 * tema, un gancho de ropa neutro. Antes todo lo que no era «Caballeros»
 * salía con vestido, también «Pilotos» o «Equipo de pits» (lo vio el
 * dueño el 24 sep 2026).
 */
function iconoGrupo(titulo: string, tema: Estilo["tema"]): React.ReactNode {
  const t = titulo.toLowerCase();
  const reglas: [RegExp, React.ReactNode][] = [
    [/pilot|corredor|conductor/, Icono.casco],
    [/pits|mec[aá]nic|escuder/, Icono.llave],
    [/aprendi|\bmag[oa]s?\b|brujo|bruja|hechicer/, Icono.sombreroMago],
    [/profesor|maestr|docente/, Icono.libro],
    [/princes|pr[ií]ncipe|reina|\brey|realeza|hada/, Icono.corona],
    [/explorador|guardaparque|aventurer/, Icono.sombreroExplorador],
    [/damas|mujer|ellas|señoras|chicas/, Icono.vestido],
    [/caballer|hombre|ellos|\bél\b|var[oó]n|señores|chicos/, Icono.corbata],
    [/niñ|chiquit|peque|invitad|cumpleañer/, Icono.camiseta],
    [/pap[aá]|mam[aá]|padres|familia|adult|acompañ|tribuna|equipo/, Icono.camisa],
  ];
  for (const [re, icono] of reglas) if (re.test(t)) return icono;
  if (tema === "magia") return Icono.sombreroMago;
  if (tema === "carreras") return Icono.casco;
  if (tema === "cuento") return Icono.corona;
  return Icono.gancho;
}

function DressCode({ sid, d, orn, tema }: { sid: string; d: DatosSeccion["dress_code"]; orn: Estilo["ornamento"]; tema: Estilo["tema"] }) {
  return (
    <Cabecera sid={sid} kicker={KICKER.dress_code} titulo={d.titulo} orn={orn}>
      {d.grupos.length > 0 && (
        <div className="inv-grupos">
          {d.grupos.map((g, i) => (
            <div key={i} className="inv-carta inv-rev inv-rev-brinco" style={rev(i, 0.25)}>
              <div className="inv-grupo-icono">{iconoGrupo(g.titulo, tema)}</div>
              <Texto sid={sid} ruta={`grupos.${i}.titulo`} valor={g.titulo} className="inv-grupo-quien" style={{ margin: 0 }} />
              {g.texto && <Texto sid={sid} ruta={`grupos.${i}.texto`} valor={g.texto} className="inv-p" style={{ marginTop: "calc(2 * var(--u))" }} />}
            </div>
          ))}
        </div>
      )}
      {d.colores.length > 0 && (
        <div className="inv-colores inv-rev" style={rev(3)} aria-label="Paleta sugerida">
          {d.colores.map((col, i) => (
            <span key={`${col}-${i}`} style={{ background: col }} title={col} />
          ))}
        </div>
      )}
      {d.texto && <Texto sid={sid} ruta="texto" valor={d.texto} multilinea className="inv-lema inv-rev inv-ancho" style={{ marginTop: "calc(6 * var(--u))", whiteSpace: "pre-line", ...rev(4) }} />}
    </Cabecera>
  );
}

/* ── RSVP ──────────────────────────────────────────────────────── */

function Rsvp({ sid, d, c, modo, orn }: { sid: string; d: DatosSeccion["rsvp"]; c: CelebracionParaRender; modo: ModoRender; orn: Estilo["ornamento"] }) {
  const numero = d.whatsapp.replace(/\D/g, "");
  const texto = encodeURIComponent(`Hola, confirmo mi asistencia a ${c.nombre}.`);
  const href = numero ? `https://wa.me/${numero.length <= 8 ? `506${numero}` : numero}?text=${texto}` : "";
  return (
    <Cabecera sid={sid} kicker={KICKER.rsvp} titulo={d.titulo} orn={orn}>
      {d.texto && <Texto sid={sid} ruta="texto" valor={d.texto} multilinea className="inv-p inv-rev inv-ancho" style={{ marginTop: "calc(5 * var(--u))", ...rev(2) }} />}
      {d.fechaLimite && /^\d{4}-\d{2}-\d{2}$/.test(d.fechaLimite) && (
        <p className="inv-lema inv-rev" style={{ marginTop: "calc(3 * var(--u))", ...rev(3) }}>Antes del {fechaLargaCR(d.fechaLimite)}</p>
      )}
      {modo === "demo" || d.modo === "panel" ? (
        <div className="inv-rev" style={rev(4)}>
          <FormularioRsvp
            boton={d.boton || "Enviar confirmación"}
            nombreCelebracion={c.nombre}
            slug={modo === "publico" ? c.slug : undefined}
            preguntas={d.preguntas}
            pedirPersonas={d.pedirPersonas}
            pedirContacto={d.pedirContacto}
          />
          {modo === "editor" && (
            <p className="inv-p inv-p-suave" style={{ marginTop: "calc(3 * var(--u))", fontSize: 12 }}>
              Las confirmaciones llegan a Invitados en tu panel. Acá en el editor el formulario no guarda.
            </p>
          )}
        </div>
      ) : (
      <div className="inv-botones inv-rev inv-rev-brinco" style={{ marginTop: "calc(7 * var(--u))", ...rev(4) }}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inv-btn inv-btn-solido">
            {Icono.whatsapp}
            {d.boton || "Confirmar asistencia"}
          </a>
        ) : modo === "editor" ? (
          <span className="inv-btn inv-btn-solido" style={{ opacity: 0.6 }}>
            {Icono.whatsapp}
            {d.boton || "Confirmar asistencia"}
          </span>
        ) : null}
      </div>
      )}
      {!href && modo === "editor" && (
        <p className="inv-p inv-p-suave" style={{ marginTop: "calc(3 * var(--u))", fontSize: 12 }}>
          Agregá tu WhatsApp en Secciones → Confirmación para que el botón funcione.
        </p>
      )}
    </Cabecera>
  );
}

/* ── Regalos ───────────────────────────────────────────────────── */

function Regalos({ sid, d, orn }: { sid: string; d: DatosSeccion["regalos"]; orn: Estilo["ornamento"] }) {
  return (
    <Cabecera sid={sid} kicker={KICKER.regalos} titulo={d.titulo} orn={orn}>
      {d.texto && <Texto sid={sid} ruta="texto" valor={d.texto} multilinea className="inv-p inv-rev inv-ancho" style={{ marginTop: "calc(5 * var(--u))", ...rev(2) }} />}
      {d.items.length > 0 && (
        <ul className="inv-regalos" style={{ listStyle: "none", padding: 0 }}>
          {d.items.map((r, i) => {
            const contenido = (
              <>
                <span style={{ display: "inline-flex", width: 22, height: 22, flex: "none", color: "var(--inv-acento)" }}>{r.url ? Icono.enlace : Icono.regalo}</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <Texto sid={sid} ruta={`items.${i}.titulo`} valor={r.titulo} as="span" style={{ display: "block", fontWeight: 600 }} />
                  {r.detalle && <Texto sid={sid} ruta={`items.${i}.detalle`} valor={r.detalle} as="span" className="inv-p-suave" style={{ display: "block", fontSize: 14, marginTop: 2 }} />}
                </span>
              </>
            );
            const estilo: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "calc(4 * var(--u)) calc(5 * var(--u))", textAlign: "left" };
            return (
              <li key={i} className="inv-rev inv-rev-brinco" style={rev(i, 0.3)}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inv-carta" style={{ ...estilo, color: "inherit", textDecoration: "none" }}>
                    {contenido}
                  </a>
                ) : (
                  <div className="inv-carta" style={estilo}>
                    {contenido}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {d.sinpe && (
        <div className="inv-carta inv-sinpe inv-rev inv-rev-brinco" style={rev(4)}>
          <p className="inv-kicker" style={{ margin: 0 }}>SINPE Móvil</p>
          <Texto sid={sid} ruta="sinpe" valor={d.sinpe} className="inv-sinpe-num" style={{ margin: 0 }} />
        </div>
      )}
    </Cabecera>
  );
}
