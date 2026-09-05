"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
  EFECTO,
  EFECTOS,
  ESTILOS_LINKS,
  FUENTE,
  FUENTES,
  PORTADA,
  PORTADAS,
  PRESETS,
  RADIOS,
  REDONDEOS,
  TEMAS,
  estiloDePieza,
  paletaDelTema,
  pilaFuente,
  type Efecto,
  type EstiloLinks,
  type EstiloPortada,
  type Fuente,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";
import {
  METODOS_PAGO,
  METODO_PAGO,
  TOPES,
  type LinkSolutions,
  type MetodoPago,
  type NegocioSolutions,
} from "@/lib/solutions/tipos";
import type { EstadoAddons } from "@/lib/solutions/addons";
import { guardarLinksSolutions, guardarPaginaSolutions } from "./actions";
import SeccionLinks from "./seccion-links";

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

/**
 * ── LAS PIEZAS DEL ESTUDIO ──────────────────────────────────────────
 * Rediseño del editor (4 sep 2026): «más ordenado, como de diseñador
 * profesional». Lo que se lee como desorden en un editor no es la
 * cantidad de opciones: es que cada una tenga su propio tamaño y su
 * propia forma. Así que hay TRES piezas y todo el estudio se arma con
 * ellas: un grupo (rótulo + ayuda + raya), un control con su rótulo
 * chico, y el control segmentado para las listas de 2 a 4 opciones.
 *
 * Viven en el módulo y no adentro del componente por lo de siempre:
 * un componente declarado dentro del render es un tipo nuevo en cada
 * pasada y React remonta el subárbol — acá, con la previa repintando
 * en cada tecla, eso es perder el foco de lo que se está escribiendo.
 */
function Grupo({
  titulo,
  pie,
  primero = false,
  children,
}: {
  titulo: string;
  pie?: string;
  primero?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={primero ? "" : "mt-6 border-t border-aventurea-line pt-5"}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-navy">{titulo}</h3>
        {pie && <p className="text-[12px] text-aventurea-ink-soft">{pie}</p>}
      </div>
      {children}
    </section>
  );
}

function Control({ rotulo, nota, children }: { rotulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={ROTULO_CAMPO}>{rotulo}</p>
      <div className="mt-1.5">{children}</div>
      {nota && <p className="mt-1.5 text-[11.5px] leading-snug text-aventurea-ink-soft">{nota}</p>}
    </div>
  );
}

/**
 * El control segmentado: de 2 a 4 opciones del MISMO ancho, una activa.
 * Es el mismo control para las puertas, los bordes y la portada, y por
 * eso las tres filas se leen como una sola cosa.
 */
function Segmentos<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
}: {
  opciones: { id: T; nombre: string; pie?: string }[];
  valor: T;
  alCambiar: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="grid gap-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => alCambiar(o.id)}
            aria-pressed={activo}
            title={o.pie}
            className={`presionable min-h-[40px] truncate rounded-lg px-2 text-[12.5px] font-bold transition-colors ${
              activo ? "bg-white text-aventurea-navy shadow-plano" : "text-aventurea-ink-soft hover:text-aventurea-navy"
            }`}
          >
            {o.nombre}
          </button>
        );
      })}
    </div>
  );
}

export default function SeccionPagina({
  negocio,
  links,
  seccionesMenu,
  hayMenu,
  urlPublica,
  recienCreado,
  addons,
}: {
  negocio: NegocioSolutions;
  /** Para que la previa muestre las puertas de verdad. */
  links: LinkSolutions[];
  seccionesMenu: string[];
  hayMenu: boolean;
  urlPublica: string;
  recienCreado: boolean;
  /** Qué tiene prendido el negocio (0233): decide qué controles se muestran. */
  addons: EstadoAddons;
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
    fuente: negocio.fuente as Fuente,
    estiloPortada: negocio.estilo_portada as EstiloPortada,
    efecto: negocio.efecto as Efecto,
    pedidosLlevar: negocio.pedidos_llevar,
    pedidosExpress: negocio.pedidos_express,
    costoExpress: negocio.costo_express,
    metodosPago: negocio.metodos_pago as MetodoPago[],
    whatsappPedidos: negocio.whatsapp_pedidos ?? "",
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
  const linksParaPrevia = links.filter((l) => l.visible).map((l) => ({
    id: l.id,
    etiqueta: etiquetas[l.id] ?? l.etiqueta,
    url: l.url,
    icono: l.icono,
    fondoUrl: l.fondo_url,
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
    fuente: f.fuente,
    estiloPortada: f.estiloPortada,
    efecto: f.efecto,
    links: linksParaPrevia,
    seccionesMenu,
    hayMenu: addons.menu && f.mostrarMenu && hayMenu,
    aceptaPedidos: f.aceptaPedidos,
    mesa: null,
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
      {/* ── LOS CONTROLES ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {recienCreado && (
          <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
            ¡Tu negocio ya existe! Elegí abajo cómo se ve —lo mirás al lado mientras tocás. El menú
            y los pedidos se agregan desde «Inicio».
          </p>
        )}

        {/* ── EL VESTIDO, PRIMERO ──────────────────────────────── */}
        {/* ── EL ESTUDIO ─────────────────────────────────────────
            Cuatro grupos, siempre en el mismo orden, del más global al
            más fino: el TEMA (la paleta), la TIPOGRAFÍA, la FORMA
            (puertas, bordes, portada) y el EFECTO. Cada grupo tiene UNA
            fila de controles del mismo tamaño, y la píldora de arriba
            resume la elección para que se lea sin recorrer la card. */}
        <Card
          eyebrow="El diseño"
          titulo="Tu estilo"
          accion={
            <PildoraEstado estado="neutro">
              {PRESETS[f.tema].nombre} · {FUENTE[f.fuente].nombre} · {EFECTO[f.efecto].nombre}
            </PildoraEstado>
          }
        >
          {/* 1 · TEMA — seis fichas del mismo tamaño, en una fila. La
              miniatura se pinta con la MISMA paleta que la página. */}
          <Grupo titulo="Tema" pie="La paleta de tu página" primero>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TEMAS.map((t) => {
                const pal = paletaDelTema(t, f.colorFondo, f.colorAcento);
                const activo = f.tema === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => elegirTema(t)}
                    aria-pressed={activo}
                    title={PRESETS[t].pie}
                    className={`presionable overflow-hidden rounded-xl border text-left transition-colors ${
                      activo ? "border-aventurea-navy ring-2 ring-aventurea-navy/20" : "border-aventurea-line hover:border-aventurea-navy/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex h-11 items-end gap-1 p-2"
                      style={{ background: `linear-gradient(135deg, ${pal.fondo}, ${pal.fondo2})` }}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: pal.acento }} />
                      <span className="h-1.5 flex-1 rounded-full" style={{ background: pal.superficie, border: `1px solid ${pal.borde}` }} />
                    </span>
                    <span className="block truncate px-2 py-1.5 text-[11.5px] font-extrabold text-aventurea-ink">
                      {PRESETS[t].nombre}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              {f.tema === "marca" && (
                <Control rotulo="Color de fondo">
                  <div className="flex items-center gap-2">
                    <input id="colorFondo" aria-label="Color de fondo" type="color" value={f.colorFondo} onChange={(e) => set("colorFondo", e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-aventurea-line" />
                    <input type="text" aria-label="Color de fondo en hexadecimal" value={f.colorFondo} onChange={(e) => set("colorFondo", e.target.value)} className={`w-[112px] ${CAMPO_PANEL}`} />
                  </div>
                </Control>
              )}
              <Control rotulo="Color de acento" nota="Botones, precios y el disco del logo.">
                <div className="flex items-center gap-2">
                  <input id="colorAcento" aria-label="Color de acento" type="color" value={f.colorAcento} onChange={(e) => set("colorAcento", e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-aventurea-line" />
                  <input type="text" aria-label="Color de acento en hexadecimal" value={f.colorAcento} onChange={(e) => set("colorAcento", e.target.value)} className={`w-[112px] ${CAMPO_PANEL}`} />
                </div>
              </Control>
            </div>
          </Grupo>

          {/* 2 · TIPOGRAFÍA — cada ficha escrita con su propia cara:
              elegir una letra por el nombre no le dice nada a quien
              tiene un restaurante; verla escrita, sí. */}
          <Grupo titulo="Tipografía" pie="Cada opción, escrita con su propia letra">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FUENTES.map((x) => {
                const activo = f.fuente === x;
                return (
                  <button
                    key={x}
                    type="button"
                    onClick={() => set("fuente", x)}
                    aria-pressed={activo}
                    className={`presionable rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      activo ? "border-aventurea-navy bg-aventurea-navy/5 ring-2 ring-aventurea-navy/20" : "border-aventurea-line hover:border-aventurea-navy/40"
                    }`}
                  >
                    <span className="block truncate text-[17px] font-bold leading-tight text-aventurea-ink" style={{ fontFamily: pilaFuente(x) }}>
                      {f.nombre || "Tu negocio"}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-aventurea-ink-soft">
                      {FUENTE[x].nombre} · {FUENTE[x].pie}
                    </span>
                  </button>
                );
              })}
            </div>
          </Grupo>

          {/* 3 · FORMA — tres controles segmentados, iguales, en una fila. */}
          <Grupo titulo="Forma" pie="Cómo se acomodan las piezas">
            {/* Puertas y bordes comparten fila; la portada va sola
                abajo porque tiene cuatro opciones y en un tercio de
                ancho se cortaban («En l…», «Co…»). */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Control rotulo="Tus puertas">
                <Segmentos
                  etiqueta="Cómo se ven las puertas"
                  valor={f.estiloLinks}
                  alCambiar={(v) => set("estiloLinks", v)}
                  opciones={ESTILOS_LINKS.map((e) => ({ id: e, nombre: ETIQUETA_ESTILO[e].nombre, pie: ETIQUETA_ESTILO[e].pie }))}
                />
              </Control>
              <Control rotulo="Bordes">
                <Segmentos
                  etiqueta="Bordes de las piezas"
                  valor={f.redondeo}
                  alCambiar={(v) => set("redondeo", v)}
                  opciones={REDONDEOS.map((r) => ({ id: r, nombre: ETIQUETA_REDONDEO[r] }))}
                />
              </Control>
              <div className="sm:col-span-2">
              <Control
                rotulo="Foto de portada"
                nota={f.fotoPortadaUrl ? undefined : "Todavía no subiste una: cargala abajo, en «Nombre, logo y portada»."}
              >
                <Segmentos
                  etiqueta="Qué hace la foto de portada"
                  valor={f.estiloPortada}
                  alCambiar={(v) => set("estiloPortada", v)}
                  opciones={PORTADAS.map((x) => ({ id: x, nombre: PORTADA[x].nombre, pie: PORTADA[x].pie }))}
                />
              </Control>
              </div>
            </div>
          </Grupo>

          {/* 4 · EFECTO — cinco fichas con una VISTA PREVIA real: la
              misma función que viste la página (`estiloDePieza`) pinta
              una tarjeta chica con el tema y los bordes de ahora. Una
              descripción («translúcido, con desenfoque») no le dice a
              nadie cómo se ve; esto sí. */}
          <Grupo titulo="Efecto de las tarjetas" pie="Así se ven con tu tema de ahora">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {EFECTOS.map((x) => {
                const pal = paletaDelTema(f.tema, f.colorFondo, f.colorAcento);
                const activo = f.efecto === x;
                return (
                  <button
                    key={x}
                    type="button"
                    onClick={() => set("efecto", x)}
                    aria-pressed={activo}
                    title={EFECTO[x].pie}
                    className={`presionable overflow-hidden rounded-xl border text-left transition-colors ${
                      activo ? "border-aventurea-navy ring-2 ring-aventurea-navy/20" : "border-aventurea-line hover:border-aventurea-navy/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex h-[68px] items-center justify-center p-3"
                      style={{ background: `linear-gradient(135deg, ${pal.fondo}, ${pal.fondo2})` }}
                    >
                      <span
                        className="flex h-10 w-full items-center gap-2 px-2.5"
                        style={estiloDePieza(x, pal, { radio: Math.min(RADIOS[f.redondeo].pieza, 12) })}
                      >
                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: pal.acento }} />
                        <span className="h-1.5 flex-1 rounded-full" style={{ background: pal.tinta, opacity: 0.55 }} />
                      </span>
                    </span>
                    <span className="block px-2 py-1.5">
                      <span className="block truncate text-[12px] font-extrabold text-aventurea-ink">{EFECTO[x].nombre}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Grupo>
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
          {/* ── EL MENÚ: solo con su add-on ────────────────────── */}
          {addons.menu ? (
            <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
              <input type="checkbox" checked={f.mostrarMenu} onChange={(e) => set("mostrarMenu", e.target.checked)} className="h-4 w-4" />
              Mostrar el menú en la página
            </label>
          ) : (
            <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
              El menú digital es un add-on.{" "}
              <Link href="?tab=inicio" className="font-bold underline">Agregalo desde Inicio</Link> y acá aparecen
              sus opciones.
            </p>
          )}

          {/* ── LOS PEDIDOS: tres modalidades, cada una con lo suyo ─
              Las tres caen en el Modo restaurante (5 sep 2026); To go
              y exprés traen los datos del cliente. Cada modalidad se
              prende aparte porque un local puede tener mesas sin
              exprés o exprés sin mesas. */}
          {addons.pedidos ? (
            <div className="mt-4 border-t border-aventurea-line pt-4">
              <p className={ROTULO_CAMPO}>Cómo recibís pedidos</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { k: "aceptaPedidos", t: "En la mesa", d: "Desde el QR de cada mesa. Llega al Modo restaurante." },
                    { k: "pedidosLlevar", t: "To go", d: "Pasa a recogerlo. Llega al Modo restaurante." },
                    { k: "pedidosExpress", t: "Exprés", d: "Se lo llevás. Llega al Modo restaurante con la dirección." },
                  ] as const
                ).map((m) => (
                  <label
                    key={m.k}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${
                      f[m.k] ? "border-aventurea-navy bg-aventurea-navy/5" : "border-aventurea-line"
                    }`}
                  >
                    <input type="checkbox" checked={f[m.k]} onChange={(e) => set(m.k, e.target.checked)} className="mt-0.5 h-4 w-4" />
                    <span>
                      <span className="block text-[13px] font-extrabold text-aventurea-ink">{m.t}</span>
                      <span className="block text-[11.5px] leading-snug text-aventurea-ink-soft">{m.d}</span>
                    </span>
                  </label>
                ))}
              </div>

              {f.aceptaPedidos && (
                <div className="mt-4">
                  <label htmlFor="mesas" className={ROTULO_CAMPO}>Cuántas mesas tenés</label>
                  <input id="mesas" type="number" min={0} max={TOPES.mesas} value={f.mesas} onChange={(e) => set("mesas", Math.max(0, Math.min(TOPES.mesas, Number(e.target.value) || 0)))} className={`mt-1.5 w-[110px] ${CAMPO_PANEL}`} />
                  <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">Cada mesa tiene su QR. Se imprimen en «QR de mesas». El pago sigue siendo en tu caja.</p>
                </div>
              )}

              {(f.pedidosLlevar || f.pedidosExpress) && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {f.pedidosExpress && (
                    <div>
                      <label htmlFor="costoExpress" className={ROTULO_CAMPO}>Costo del envío (₡)</label>
                      <input id="costoExpress" type="number" min={0} step={100} value={f.costoExpress} onChange={(e) => set("costoExpress", Math.max(0, Number(e.target.value) || 0))} className={`mt-1.5 w-[150px] ${CAMPO_PANEL}`} />
                      <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">Se suma al pedido exprés. 0 = envío gratis.</p>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <p className={ROTULO_CAMPO}>Con qué se puede pagar</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {METODOS_PAGO.map((m) => {
                        const activo = f.metodosPago.includes(m);
                        return (
                          <label
                            key={m}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-bold ${
                              activo ? "border-aventurea-navy bg-aventurea-navy/5 text-aventurea-navy" : "border-aventurea-line text-aventurea-ink-soft"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={activo}
                              onChange={(e) => {
                                const lista = e.target.checked ? [...f.metodosPago, m] : f.metodosPago.filter((x) => x !== m);
                                // Al menos una: sin forma de pago no hay pedido posible.
                                set("metodosPago", lista.length > 0 ? lista : ["efectivo"]);
                              }}
                              className="h-4 w-4"
                            />
                            {METODO_PAGO[m]}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">El cliente elige una al pedir y te llega con el pedido. El cobro es tuyo: acá no hay pasarela.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className={`mt-4 rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
              Los pedidos (mesa, para llevar y exprés) son un add-on.{" "}
              <Link href="?tab=inicio" className="font-bold underline">Agregalo desde Inicio</Link>.
            </p>
          )}
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

        {/* ── LOS ENLACES, ACÁ MISMO (dueño, 5 sep 2026) ──────────
            «Mi página y Enlaces, ¿no es lo mismo?». Lo es: los enlaces
            SON la página. Antes tenían pestaña propia; ahora viven acá
            abajo, con su propio botón de guardar porque van a otra
            tabla y por otra action. `scroll-mt` para que los atajos
            del tablero (#enlaces) no queden tapados por el header. */}
        <div id="enlaces" className="scroll-mt-24">
          <SeccionLinks negocioId={negocio.id} links={links} />
        </div>
      </div>

      {/* ── LA PREVIA EN VIVO ────────────────────────────────────── */}
      <aside className="mt-6 lg:sticky lg:top-20 lg:mt-0">
        <p className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft lg:text-left">
          Así se ve ahora
        </p>
        <Telefono
          ancho={288}
          className="mx-auto lg:mx-0"
          tinta={paletaDelTema(f.tema, f.colorFondo, f.colorAcento).tinta}
        >
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
