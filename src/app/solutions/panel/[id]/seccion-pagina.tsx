"use client";

import { useState, useTransition } from "react";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  ESTADO_AVISO,
  ROTULO_CAMPO,
} from "@/components/panel/sistema";
import SubirImagen from "@/components/subir-imagen";
import Telefono from "@/components/solutions/telefono";
import VistaPagina from "@/components/solutions/vista-pagina";
import {
  ESTILOS_LINKS,
  PRESETS,
  REDONDEOS,
  TEMAS,
  paletaDelTema,
  type EstiloLinks,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";
import { TOPES, type LinkSolutions, type NegocioSolutions } from "@/lib/solutions/tipos";
import { guardarLinksSolutions, guardarPaginaSolutions } from "./actions";

/**
 * MI PÁGINA — el editor, con la página de verdad al lado.
 *
 * Pedido del dueño (4 sep 2026): «que seamos casi un creador de
 * mini-websites… editar las cosas en tiempo real».
 *
 * ── LA PREVIA NO ES UNA IMITACIÓN ──────────────────────────────────
 * El teléfono de la derecha monta `VistaPagina`, EL MISMO componente
 * que sirve /s/<slug>. No hay una maqueta del editor y otra cosa en la
 * calle: se repinta con cada tecla porque recibe el estado del
 * formulario, y lo que se ve es lo que se publica.
 *
 * Por eso el orden de los controles es el del recorrido visual —
 * primero el vestido (tema, forma, colores), después el contenido:
 * cada cambio se ve al lado antes de guardar.
 */

const ETIQUETA_ESTILO: Record<EstiloLinks, { nombre: string; pie: string }> = {
  lista: { nombre: "Lista", pie: "Filas anchas, con descripción" },
  grilla: { nombre: "Cuadrícula", pie: "Íconos, más puertas a la vista" },
};
const ETIQUETA_REDONDEO: Record<Redondeo, string> = {
  recto: "Recto",
  suave: "Suave",
  redondo: "Redondo",
};

export default function SeccionPagina({
  negocio,
  links,
  seccionesMenu,
  hayMenu,
  urlPublica,
  recienCreado,
}: {
  negocio: NegocioSolutions;
  /** Para que la previa muestre las puertas de verdad. */
  links: LinkSolutions[];
  seccionesMenu: string[];
  hayMenu: boolean;
  urlPublica: string;
  recienCreado: boolean;
}) {
  const [f, setF] = useState({
    nombre: negocio.nombre,
    slug: negocio.slug,
    bajada: negocio.bajada,
    colorFondo: negocio.color_fondo,
    colorAcento: negocio.color_acento,
    logoUrl: negocio.logo_url ?? "",
    fotoPortadaUrl: negocio.foto_portada_url ?? "",
    whatsapp: negocio.whatsapp ?? "",
    direccion: negocio.direccion ?? "",
    publicado: negocio.publicado,
    mostrarMenu: negocio.mostrar_menu,
    aceptaPedidos: negocio.acepta_pedidos,
    mesas: negocio.mesas,
    tema: negocio.tema as Tema,
    estiloLinks: negocio.estilo_links as EstiloLinks,
    redondeo: negocio.redondeo as Redondeo,
  });
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [guardando, arrancar] = useTransition();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  /**
   * LAS ETIQUETAS DE LOS ENLACES TAMBIÉN SE EDITAN EN EL TELÉFONO.
   *
   * Viven en su propia tabla y tienen su pantalla («Enlaces»), así que
   * acá se guarda una copia local que el teléfono edita en el lugar. Al
   * guardar se manda por la MISMA action que usa esa pantalla — no hay
   * un segundo camino de escritura, que es lo que convierte dos
   * editores en dos verdades.
   *
   * Solo la ETIQUETA: la dirección, el ícono, el orden y el interruptor
   * de visible siguen en «Enlaces», donde hay lugar para todo eso.
   */
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>({});
  const linksParaPrevia = links.map((l) => ({
    id: l.id,
    etiqueta: etiquetas[l.id] ?? l.etiqueta,
    url: l.url,
    icono: l.icono,
  }));
  const hayEtiquetasTocadas = links.some(
    (l) => etiquetas[l.id] !== undefined && etiquetas[l.id] !== l.etiqueta,
  );

  /** Elegir un tema trae su acento sugerido, salvo que ya lo hayan tocado. */
  const elegirTema = (t: Tema) =>
    setF((p) => ({
      ...p,
      tema: t,
      colorAcento:
        p.colorAcento === PRESETS[p.tema].acentoSugerido || !p.colorAcento
          ? PRESETS[t].acentoSugerido
          : p.colorAcento,
    }));

  const guardar = () => {
    setMsg(null);
    arrancar(async () => {
      const r = await guardarPaginaSolutions(negocio.id, f);
      if (!r.ok) {
        setMsg({ tono: "alerta", texto: r.motivo });
        return;
      }
      if (hayEtiquetasTocadas) {
        const rl = await guardarLinksSolutions(
          negocio.id,
          links.map((l) => ({
            etiqueta: etiquetas[l.id] ?? l.etiqueta,
            url: l.url,
            icono: l.icono,
            visible: l.visible,
          })),
        );
        if (!rl.ok) {
          setMsg({ tono: "alerta", texto: rl.motivo });
          return;
        }
      }
      setMsg({ tono: "exito", texto: "Guardado. Ya está en tu página." });
    });
  };

  const datosPrevia = {
    nombre: f.nombre,
    bajada: f.bajada,
    logoUrl: f.logoUrl || null,
    fotoPortadaUrl: f.fotoPortadaUrl || null,
    whatsapp: f.whatsapp || null,
    direccion: f.direccion || null,
    colorFondo: f.colorFondo,
    colorAcento: f.colorAcento,
    tema: f.tema,
    estiloLinks: f.estiloLinks,
    redondeo: f.redondeo,
    links: linksParaPrevia,
    seccionesMenu,
    hayMenu: f.mostrarMenu && hayMenu,
    aceptaPedidos: f.aceptaPedidos,
    mesa: null,
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      {/* ── LOS CONTROLES ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {recienCreado && (
          <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
            ¡Tu negocio ya existe! Elegí abajo cómo se ve —lo mirás al lado mientras tocás— y
            cargá tu carta en «La carta».
          </p>
        )}

        {/* ── EL VESTIDO, PRIMERO ──────────────────────────────── */}
        <Card eyebrow="El diseño" titulo="Cómo se ve tu página">
          <p className={ROTULO_CAMPO}>Tema</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMAS.map((t) => {
              const pal = paletaDelTema(t, f.colorFondo, f.colorAcento);
              const activo = f.tema === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => elegirTema(t)}
                  aria-pressed={activo}
                  className={`presionable overflow-hidden rounded-xl border text-left transition-colors ${
                    activo ? "border-aventurea-navy ring-2 ring-aventurea-navy/25" : "border-aventurea-line"
                  }`}
                >
                  {/* La miniatura se pinta con la MISMA paleta que la
                      página: no es un swatch dibujado aparte. */}
                  <span
                    aria-hidden
                    className="flex h-12 items-center gap-1.5 px-3"
                    style={{ background: `linear-gradient(135deg, ${pal.fondo}, ${pal.fondo2})` }}
                  >
                    <span className="h-5 w-5 rounded-full" style={{ background: pal.acento }} />
                    <span className="h-2 flex-1 rounded-full" style={{ background: pal.superficie, border: `1px solid ${pal.borde}` }} />
                  </span>
                  <span className="block px-3 py-2">
                    <span className="block text-[12.5px] font-extrabold text-aventurea-ink">
                      {PRESETS[t].nombre}
                    </span>
                    <span className="block text-[11px] text-aventurea-ink-soft">{PRESETS[t].pie}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className={ROTULO_CAMPO}>Tus puertas se ven como…</p>
              <div className="mt-2 flex gap-2">
                {ESTILOS_LINKS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => set("estiloLinks", e)}
                    aria-pressed={f.estiloLinks === e}
                    className={`presionable flex-1 rounded-xl border px-3 py-2.5 text-left ${
                      f.estiloLinks === e
                        ? "border-aventurea-navy bg-aventurea-navy/5"
                        : "border-aventurea-line"
                    }`}
                  >
                    <span className="block text-[13px] font-extrabold text-aventurea-ink">
                      {ETIQUETA_ESTILO[e].nombre}
                    </span>
                    <span className="block text-[11px] leading-snug text-aventurea-ink-soft">
                      {ETIQUETA_ESTILO[e].pie}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={ROTULO_CAMPO}>Bordes</p>
              <div className="mt-2 flex gap-2">
                {REDONDEOS.map((rd) => (
                  <button
                    key={rd}
                    type="button"
                    onClick={() => set("redondeo", rd)}
                    aria-pressed={f.redondeo === rd}
                    className={`presionable flex-1 rounded-xl border px-2 py-2.5 text-[12.5px] font-bold ${
                      f.redondeo === rd
                        ? "border-aventurea-navy bg-aventurea-navy/5 text-aventurea-navy"
                        : "border-aventurea-line text-aventurea-ink-soft"
                    }`}
                  >
                    {ETIQUETA_REDONDEO[rd]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {f.tema === "marca" && (
              <div>
                <label htmlFor="colorFondo" className={ROTULO_CAMPO}>
                  Color de fondo
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input id="colorFondo" type="color" value={f.colorFondo} onChange={(e) => set("colorFondo", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-aventurea-line" />
                  <input type="text" value={f.colorFondo} onChange={(e) => set("colorFondo", e.target.value)} className={`w-[120px] ${CAMPO_PANEL}`} />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="colorAcento" className={ROTULO_CAMPO}>
                Color de acento (botones)
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input id="colorAcento" type="color" value={f.colorAcento} onChange={(e) => set("colorAcento", e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-aventurea-line" />
                <input type="text" value={f.colorAcento} onChange={(e) => set("colorAcento", e.target.value)} className={`w-[120px] ${CAMPO_PANEL}`} />
              </div>
            </div>
          </div>
        </Card>

        {/* ── EL CONTENIDO ─────────────────────────────────────── */}
        <Card eyebrow="Tu marca" titulo="Nombre, logo y portada">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nombre" className={ROTULO_CAMPO}>Nombre</label>
              <input id="nombre" type="text" value={f.nombre} maxLength={TOPES.nombre} onChange={(e) => set("nombre", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
            </div>
            <div>
              <label htmlFor="bajada" className={ROTULO_CAMPO}>La línea bajo el nombre</label>
              <input id="bajada" type="text" value={f.bajada} maxLength={TOPES.bajada} placeholder="Café de especialidad · Escazú" onChange={(e) => set("bajada", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
            </div>
            <SubirImagen valor={f.logoUrl} alCambiar={(u) => set("logoUrl", u)} destino="logo" etiqueta="Logo" carpeta="solutions/logos" bucket="solutions-fotos" />
            <SubirImagen valor={f.fotoPortadaUrl} alCambiar={(u) => set("fotoPortadaUrl", u)} destino="banner" etiqueta="Foto de portada" carpeta="solutions/portadas" bucket="solutions-fotos" />
          </div>
        </Card>

        <Card eyebrow="Para que te encuentren" titulo="Contacto">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="whatsapp" className={ROTULO_CAMPO}>WhatsApp (solo números)</label>
              <input id="whatsapp" type="tel" value={f.whatsapp} placeholder="88887777" onChange={(e) => set("whatsapp", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
            </div>
            <div>
              <label htmlFor="direccion" className={ROTULO_CAMPO}>Dirección (abre en Google Maps)</label>
              <input id="direccion" type="text" value={f.direccion} maxLength={TOPES.direccion} onChange={(e) => set("direccion", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
            </div>
          </div>
        </Card>

        <Card
          eyebrow="Tu página en la calle"
          titulo="Enlace y publicación"
          accion={<PildoraEstado estado={f.publicado ? "info" : "neutro"}>{f.publicado ? "Publicada" : "Apagada"}</PildoraEstado>}
        >
          <p className="break-all text-[13.5px] font-bold text-aventurea-ink">{urlPublica}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label htmlFor="slug" className={ROTULO_CAMPO}>Cambiar el enlace (bookea.lat/s/…)</label>
              <input id="slug" type="text" value={f.slug} onChange={(e) => set("slug", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
            </div>
            <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
              <input type="checkbox" checked={f.publicado} onChange={(e) => set("publicado", e.target.checked)} className="h-4 w-4" />
              Publicada
            </label>
          </div>
        </Card>

        <Card eyebrow="Las puertas" titulo="Menú y pedidos">
          <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
            <input type="checkbox" checked={f.mostrarMenu} onChange={(e) => set("mostrarMenu", e.target.checked)} className="h-4 w-4" />
            Mostrar la carta en la página
          </label>
          <label className="mt-3 flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
            <input type="checkbox" checked={f.aceptaPedidos} onChange={(e) => set("aceptaPedidos", e.target.checked)} className="h-4 w-4" />
            Recibir pedidos desde la mesa
          </label>
          <p className="mt-1.5 text-[12.5px] leading-snug text-aventurea-ink-soft">
            Con esto prendido, quien escanee el QR de su mesa arma el pedido desde el teléfono y te
            llega a «Comandas». El pago sigue siendo en tu caja.
          </p>
          <div className="mt-4 border-t border-aventurea-line pt-4">
            <label htmlFor="mesas" className={ROTULO_CAMPO}>Cuántas mesas tenés</label>
            <input id="mesas" type="number" min={0} max={TOPES.mesas} value={f.mesas} onChange={(e) => set("mesas", Math.max(0, Math.min(TOPES.mesas, Number(e.target.value) || 0)))} className={`mt-1.5 w-[110px] ${CAMPO_PANEL}`} />
            <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">Cada mesa tiene su QR. Se imprimen en «QR de mesas».</p>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={guardar} disabled={guardando} className={BOTON_PANEL_PRIMARIO}>
            {guardando ? "Guardando…" : "Guardar la página"}
          </button>
          <a href={urlPublica} target="_blank" rel="noopener noreferrer" className={BOTON_PANEL}>
            Ver como cliente →
          </a>
          {msg && (
            <p className={`text-[13px] font-bold ${msg.tono === "exito" ? "text-green-700" : "text-red-700"}`}>
              {msg.texto}
            </p>
          )}
        </div>
      </div>

      {/* ── LA PREVIA EN VIVO ────────────────────────────────────── */}
      <aside className="mt-6 lg:sticky lg:top-20 lg:mt-0">
        <p className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft lg:text-left">
          Así se ve ahora
        </p>
        <Telefono ancho={288} className="mx-auto lg:mx-0">
          {/* `inerte`: la previa no navega. Tocar un enlace acá sacaría al
              dueño de su panel a mitad de la edición.
              `edicion`: los textos se escriben ACÁ ADENTRO. */}
          <VistaPagina
            datos={datosPrevia}
            inerte
            className="min-h-full"
            edicion={{
              alCambiarNombre: (v) => set("nombre", v),
              alCambiarBajada: (v) => set("bajada", v),
              alCambiarEtiquetaLink: (id, v) =>
                setEtiquetas((p) => ({ ...p, [id]: v })),
            }}
          />
        </Telefono>
        <p className="mt-3 text-center text-[11.5px] leading-snug text-aventurea-ink-soft lg:text-left">
          <strong className="text-aventurea-ink">Tocá el texto en el teléfono para escribirlo ahí.</strong>{" "}
          Es tu página de verdad, no un dibujo. Guardá para que la vean tus clientes.
        </p>
      </aside>
    </div>
  );
}
