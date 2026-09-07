"use client";

import { useState } from "react";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, CAMPO_PANEL, ROTULO_CAMPO } from "@/components/panel/sistema";
import SubirImagen from "@/components/subir-imagen";
import type { PropuestaColores } from "@/lib/colores-imagen";
import { coloresDeUrl } from "@/lib/colores-imagen-navegador";
import { DISENO_OPCION, LOGO_FORMAS, LOGO_TAMANOS, TITULOS, conAlfa, type Diseno, type EstiloPortada, type Paleta, type Tema } from "@/lib/solutions/temas";
import { TOPES } from "@/lib/solutions/tipos";
import { prepararSubidaSolutions } from "../../subida-actions";
import { coloresDeImagenSolutions } from "./colores-actions";
import { Control, Fichas, Grupo, Segmentos, opcionesDe } from "./piezas-estudio";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL ENCABEZADO — el «Header» de Linktree, con nuestras piezas
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026), con el editor de Linktree abierto:
 * «un configurador de esta forma, que a la derecha vayamos viendo cómo
 * queda; recortar al subir; y cuando se agregue una imagen, algo que
 * detecte el color y diga AUTO AGREGAR COLOR DE TEMA».
 *
 * ── QUÉ HAY ACÁ ────────────────────────────────────────────────────
 *   Diseño      las cuatro formas del encabezado, con una miniatura
 *               pintada con la paleta real (y con la portada de verdad
 *               si ya hay una). Son los `estilo_portada` de siempre con
 *               los nombres de Linktree: Clásico, Héroe, Banner, De fondo.
 *   Imágenes    la de perfil (logo) y la portada, las dos con recorte
 *               al subir (`SubirImagen recortar`), y debajo los colores
 *               que se leyeron de cada una con el botón «Auto».
 *   Nombre      el nombre, la bajada y el estilo del titular.
 *
 * ── «AUTO: AGREGAR COLOR DE TEMA» ──────────────────────────────────
 * Aplicar = poner el tema «marca» con el fondo y el acento propuestos.
 * No es un tema nuevo ni un color a escondidas: son los mismos dos
 * campos que el dueño puede escribir a mano en «Tema». Y se puede
 * deshacer: se guarda lo que había antes hasta que se aplique o se
 * salga.
 *
 * Los cambios salen por UN callback (`alCambiar`) hacia el estado del
 * editor: la previa de la derecha es la de siempre.
 */

export type ValoresEncabezado = {
  nombre: string;
  bajada: string;
  logoUrl: string;
  fotoPortadaUrl: string;
  estiloPortada: EstiloPortada;
  logoForma: Diseno["logoForma"];
  logoTamano: Diseno["logoTamano"];
  titulo: Diseno["titulo"];
  tema: Tema;
  colorFondo: string;
  colorAcento: string;
};

type Origen = "logo" | "portada";
type Respaldo = Pick<ValoresEncabezado, "tema" | "colorFondo" | "colorAcento">;

/** Los `estilo_portada` con los nombres de Linktree, en su orden. */
const DISENOS: { id: EstiloPortada; nombre: string; pie: string }[] = [
  { id: "sin", nombre: "Clásico", pie: "Logo y nombre" },
  { id: "completa", nombre: "Héroe", pie: "Foto de borde a borde" },
  { id: "card", nombre: "Banner", pie: "Foto dentro de la tarjeta" },
  { id: "fondo", nombre: "De fondo", pie: "La foto viste toda la página" },
];

/** La miniatura de un diseño: pintada con la paleta, con la portada si hay. */
function MiniEncabezado({ id, p, foto }: { id: EstiloPortada; p: Paleta; foto: string | null }) {
  const fotoCss: React.CSSProperties = foto
    ? { backgroundImage: `url("${foto}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(135deg, ${p.acento}, ${p.fondo2})` };
  const avatar = <span aria-hidden className="shrink-0 rounded-full" style={{ width: 22, height: 22, background: p.acento, boxShadow: `0 0 0 2px ${p.fondo}` }} />;
  const lineas = (
    <>
      <span aria-hidden style={{ width: 34, height: 5, borderRadius: 3, background: p.tinta, opacity: 0.9 }} />
      <span aria-hidden style={{ width: 22, height: 4, borderRadius: 3, background: p.tinta, opacity: 0.45 }} />
    </>
  );
  const base = "relative flex aspect-[4/5] w-full flex-col items-center overflow-hidden";
  if (id === "sin") {
    return (
      <div className={`${base} justify-center gap-1.5`} style={{ background: p.fondo }}>
        {avatar}
        {lineas}
      </div>
    );
  }
  if (id === "completa") {
    return (
      <div className={base} style={{ background: p.fondo }}>
        <div className="w-full" style={{ height: "42%", ...fotoCss }} />
        <div className="-mt-3 flex flex-col items-center gap-1.5">
          {avatar}
          {lineas}
        </div>
      </div>
    );
  }
  if (id === "card") {
    return (
      <div className={`${base} justify-center p-2`} style={{ background: p.fondo }}>
        <div className="flex w-full flex-col items-center gap-1.5 overflow-hidden rounded-md pb-2" style={{ background: p.superficie, border: `1px solid ${p.borde}` }}>
          <div className="w-full" style={{ height: 34, ...fotoCss }} />
          {avatar}
          {lineas}
        </div>
      </div>
    );
  }
  return (
    <div className={`${base} justify-center`} style={fotoCss}>
      <span aria-hidden className="absolute inset-0" style={{ background: conAlfa(p.fondo, 0.62) }} />
      <div className="relative flex flex-col items-center gap-1.5">
        {avatar}
        {lineas}
      </div>
    </div>
  );
}

function Muestra({ color, grande = false }: { color: string; grande?: boolean }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full border border-black/10 ${grande ? "h-7 w-7" : "h-4 w-4"}`} style={{ background: color }} />;
}

export default function EncabezadoEditor({
  valores: v,
  paleta,
  ejemploBajada,
  alCambiar,
}: {
  valores: ValoresEncabezado;
  paleta: Paleta;
  ejemploBajada: string;
  alCambiar: (cambios: Partial<ValoresEncabezado>) => void;
}) {
  const [propuestas, setPropuestas] = useState<Record<Origen, PropuestaColores | null>>({ logo: null, portada: null });
  const [detectando, setDetectando] = useState<Origen | null>(null);
  const [errorColor, setErrorColor] = useState<string | null>(null);
  const [respaldo, setRespaldo] = useState<Respaldo | null>(null);
  const [aplicadoDe, setAplicadoDe] = useState<Origen | null>(null);

  const setPropuesta = (origen: Origen, c: PropuestaColores | null) => {
    setPropuestas((p) => ({ ...p, [origen]: c }));
    if (c === null && aplicadoDe === origen) setAplicadoDe(null);
  };

  const urlDe = (origen: Origen) => (origen === "logo" ? v.logoUrl : v.fotoPortadaUrl);

  /** Leer los colores de una imagen que ya estaba guardada. */
  const detectar = async (origen: Origen) => {
    const url = urlDe(origen);
    if (!url) return;
    setErrorColor(null);
    setDetectando(origen);
    try {
      // Primero el navegador (gratis y al instante); si el origen no deja
      // leer los píxeles, el servidor la baja y la analiza con sharp.
      let c = await coloresDeUrl(url);
      if (!c) {
        const r = await coloresDeImagenSolutions(url);
        if (!r.ok) {
          setErrorColor(r.motivo);
          return;
        }
        c = r.colores;
      }
      setPropuesta(origen, c);
    } finally {
      setDetectando(null);
    }
  };

  const aplicar = (origen: Origen) => {
    const c = propuestas[origen];
    if (!c) return;
    if (!respaldo) setRespaldo({ tema: v.tema, colorFondo: v.colorFondo, colorAcento: v.colorAcento });
    alCambiar({ tema: "marca", colorFondo: c.fondo, colorAcento: c.acento });
    setAplicadoDe(origen);
  };

  const deshacer = () => {
    if (respaldo) alCambiar(respaldo);
    setRespaldo(null);
    setAplicadoDe(null);
  };

  const origenes: { id: Origen; rotulo: string }[] = [
    { id: "portada", rotulo: "De tu portada" },
    { id: "logo", rotulo: "De tu logo" },
  ].filter((o) => !!urlDe(o.id as Origen)) as { id: Origen; rotulo: string }[];

  const disenoActual = DISENOS.find((d) => d.id === v.estiloPortada) ?? DISENOS[0];

  return (
    <Card eyebrow="El encabezado" titulo="Diseño, imagen y nombre" accion={<PildoraEstado estado="neutro">{disenoActual.nombre}</PildoraEstado>}>
      {/* 1 · DISEÑO — las cuatro formas, con miniatura de la paleta real. */}
      <Grupo titulo="Diseño" pie="Cómo se arma la parte de arriba" primero>
        <Fichas
          etiqueta="Diseño del encabezado"
          valor={v.estiloPortada}
          alCambiar={(id) => alCambiar({ estiloPortada: id })}
          opciones={DISENOS}
          columnas="grid-cols-2 sm:grid-cols-4"
          vista={(id) => <MiniEncabezado id={id} p={paleta} foto={v.fotoPortadaUrl || null} />}
        />
        {v.estiloPortada !== "sin" && !v.fotoPortadaUrl && (
          <p className="mt-2 text-[11.5px] leading-snug text-aventurea-ink-soft">
            «{disenoActual.nombre}» usa la foto de portada: subila acá abajo. Mientras tanto la página se ve como «Clásico».
          </p>
        )}
      </Grupo>

      {/* 2 · IMÁGENES — con recorte al subir y los colores leídos. */}
      <Grupo titulo="Imágenes" pie="Se recortan al subirlas, como en Linktree">
        <div className="grid gap-4 sm:grid-cols-2">
          <SubirImagen
            valor={v.logoUrl}
            alCambiar={(u) => alCambiar({ logoUrl: u })}
            destino="logo"
            etiqueta="Imagen de perfil (logo)"
            carpeta="solutions/logos"
            bucket="solutions-fotos"
            subidaDirecta={prepararSubidaSolutions}
            recortar
            alColores={(c) => setPropuesta("logo", c)}
          />
          <SubirImagen
            valor={v.fotoPortadaUrl}
            alCambiar={(u) => alCambiar({ fotoPortadaUrl: u })}
            destino="banner"
            etiqueta="Foto de portada"
            carpeta="solutions/portadas"
            bucket="solutions-fotos"
            subidaDirecta={prepararSubidaSolutions}
            recortar
            alColores={(c) => setPropuesta("portada", c)}
          />
        </div>

        {/* ── LOS COLORES DE TUS IMÁGENES ──────────────────────── */}
        {origenes.length > 0 && (
          <div className="mt-4 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-aventurea-navy">Colores de tus imágenes</p>
              {respaldo && (
                <button type="button" onClick={deshacer} className="text-[12px] font-bold text-aventurea-ink-soft underline underline-offset-2 hover:text-aventurea-ink">
                  Deshacer y volver a mi tema
                </button>
              )}
            </div>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {origenes.map((o) => {
                const c = propuestas[o.id];
                const aplicado = aplicadoDe === o.id;
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-plano">
                    <span className="w-[110px] shrink-0 text-[12.5px] font-bold text-aventurea-ink">{o.rotulo}</span>
                    {c ? (
                      <>
                        <span className="flex items-center gap-1.5" title={`Fondo ${c.fondo} · acento ${c.acento}`}>
                          <Muestra color={c.fondo} grande />
                          <Muestra color={c.acento} grande />
                        </span>
                        <span className="flex items-center gap-1" aria-label="Lo que más hay en la imagen">
                          {c.muestras.map((m, i) => (
                            <Muestra key={`${m}-${i}`} color={m} />
                          ))}
                        </span>
                        <button
                          type="button"
                          onClick={() => aplicar(o.id)}
                          disabled={aplicado}
                          className={`presionable ml-auto inline-flex min-h-[36px] items-center rounded-full px-4 text-[12.5px] font-extrabold ${
                            aplicado ? "bg-green-50 text-green-800" : "bg-aventurea-navy text-white"
                          }`}
                        >
                          {aplicado ? "Aplicado ✓" : "Auto: agregar color de tema"}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => void detectar(o.id)} disabled={detectando !== null} className={`${BOTON_PANEL} ml-auto`}>
                        {detectando === o.id ? "Leyendo los colores…" : "Detectar los colores"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11.5px] leading-snug text-aventurea-ink-soft">
              «Auto» pone el tema <strong>Tu marca</strong> con el fondo y el acento de la imagen; el resto de la página (texto, bordes, botones) se deriva
              de esos dos. Después podés afinar cualquiera en «Tema».
            </p>
            {errorColor && <p className="mt-1.5 text-[12px] font-bold text-red-700">{errorColor}</p>}
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Control rotulo="Forma del logo">
            <Segmentos
              etiqueta="Forma del logo"
              valor={v.logoForma}
              alCambiar={(x) => alCambiar({ logoForma: x })}
              opciones={LOGO_FORMAS.map((x) => ({ id: x, nombre: x === "auto" ? "Automática" : DISENO_OPCION.logoForma[x].nombre, pie: DISENO_OPCION.logoForma[x].pie || undefined }))}
            />
          </Control>
          <Control rotulo="Tamaño del logo">
            <Segmentos etiqueta="Tamaño del logo" valor={v.logoTamano} alCambiar={(x) => alCambiar({ logoTamano: x })} opciones={opcionesDe(LOGO_TAMANOS, DISENO_OPCION.logoTamano)} />
          </Control>
        </div>
      </Grupo>

      {/* 3 · NOMBRE — también se escribe tocando el teléfono. */}
      <Grupo titulo="Nombre y bajada" pie="También se escriben tocando el teléfono">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="enc-nombre" className={ROTULO_CAMPO}>
              Nombre
            </label>
            <input id="enc-nombre" type="text" value={v.nombre} maxLength={TOPES.nombre} onChange={(e) => alCambiar({ nombre: e.target.value })} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div>
            <label htmlFor="enc-bajada" className={ROTULO_CAMPO}>
              La línea bajo el nombre
            </label>
            <input id="enc-bajada" type="text" value={v.bajada} maxLength={TOPES.bajada} placeholder={ejemploBajada} onChange={(e) => alCambiar({ bajada: e.target.value })} className={`mt-1.5 ${CAMPO_PANEL}`} />
          </div>
          <div className="sm:col-span-2">
            <Control rotulo="Titular">
              <Segmentos etiqueta="Titular" valor={v.titulo} alCambiar={(x) => alCambiar({ titulo: x })} opciones={opcionesDe(TITULOS, DISENO_OPCION.titulo)} />
            </Control>
          </div>
        </div>
      </Grupo>
    </Card>
  );
}
