"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  ESTADO_AVISO,
  ROTULO_CAMPO,
} from "@/components/panel/sistema";
import Telefono from "@/components/solutions/telefono";
import VistaPagina from "@/components/solutions/vista-pagina";
import {
  ALINEACIONES,
  ANIMACIONES,
  BOTONES,
  DENSIDADES,
  DISENO_OPCION,
  EFECTO,
  EFECTOS,
  ESTILOS_LINKS,
  FONDOS,
  FUENTE,
  FUENTES,
  HOVERS,
  PIEZAS,
  PRESETS,
  RADIOS,
  REDES,
  REDONDEOS,
  TEMAS,
  conAlfa,
  estiloDePieza,
  fondoDePagina,
  paletaDelTema,
  pilaFuente,
  type Diseno,
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
import { IDIOMA, IDIOMAS_EXTRA, type IdiomaExtra } from "@/lib/solutions/idiomas";
import {
  banderaDe,
  ejemploTelefono,
  MONEDA,
  MONEDAS,
  monedaDelPais,
  PAIS,
  PAISES,
  pasoDePrecio,
  type Moneda,
  type Pais,
} from "@/lib/monedas";
import { esDeComida, GRUPO_RUBRO, RUBRO, RUBROS, vocabDe, type Rubro } from "@/lib/solutions/rubros";
import { elegirDominioMarcaSolutions, guardarLinksSolutions, guardarPaginaSolutions } from "./actions";
import { HOST_MARCA, HOSTS_MARCA, TEMAS_GRATIS, esPro } from "@/lib/solutions/planes";
import SeccionLinks, { type FilaEnlace } from "./seccion-links";
import SeccionDominio from "./seccion-dominio";
import { LP_BOTON_CHICO, LP_BOTON_CHICO_SUAVE } from "./sistema-linksy";
import EncabezadoEditor, { type ValoresEncabezado } from "./encabezado-editor";
import { Control, Fichas, Grupo, PildoraPro, Segmentos, opcionesDe } from "./piezas-estudio";

/**
 * MI PÁGINA — el editor, con la página de verdad al lado.
 *
 * Pedido del dueño (4 sep 2026): «que seamos casi un creador de
 * mini-websites… editar las cosas en tiempo real». Y el 6 sep 2026:
 * «que sea MUY personalizable: más opciones, animaciones, tipo
 * Linktree; para cualquier negocio, en la moneda de su país».
 *
 * ── LA PREVIA NO ES UNA IMITACIÓN ──────────────────────────────────
 * El teléfono de la derecha monta `VistaPagina`, EL MISMO componente
 * que sirve /s/<slug>. No hay una maqueta del editor y otra cosa en la
 * calle: se repinta con cada tecla porque recibe el estado del
 * formulario, y lo que se ve es lo que se publica.
 *
 * Por eso el orden de los controles es el del recorrido visual —
 * primero el vestido (tema, letra, forma, efecto, botones, encabezado,
 * fondo, movimiento), después el negocio (rubro, país, moneda) y el
 * contenido: cada cambio se ve al lado antes de guardar.
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
  addons,
  esDueno,
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
  /** El dominio propio es del dueño: un colaborador admin no lo toca. */
  esDueno: boolean;
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
    idiomasMenu: negocio.idiomas_menu as IdiomaExtra[],
    // 0236
    pais: negocio.pais as Pais,
    moneda: negocio.moneda as Moneda,
    rubro: negocio.rubro as Rubro,
    diseno: negocio.diseno as Diseno,
  });
  const [msg, setMsg] = useState<{ tono: "exito" | "alerta"; texto: string } | null>(null);
  const [guardando, arrancar] = useTransition();

  // ── LA VISTA: Enlaces, Diseño o Ajustes (8 sep 2026, como Linktree) ──
  // Las tres pestañas del panel muestran ESTE mismo componente —la misma
  // instancia: PanelLinksy las apunta al mismo contenido— y acá se elige
  // qué parte se ve. Así lo que se edita en una pestaña sigue vivo en la
  // otra hasta que se guarda.
  const tab = useSearchParams().get("tab");
  const vista: "diseno" | "enlaces" | "ajustes" = tab === "enlaces" || tab === "links" ? "enlaces" : tab === "ajustes" ? "ajustes" : "diseno";
  const router = useRouter();

  // ── EL PLAN (0239): lo Pro se ve con candado si el negocio no lo tiene ──
  const pro = esPro(negocio.plan);
  const hrefPro = `/solutions/panel/${negocio.id}/plan`;

  // ── EL DOMINIO DE MARCA (0239): se guarda al elegirlo ──────────────
  const [hostMarca, setHostMarca] = useState(negocio.host_marca);
  const [cambiandoHost, arrancarHost] = useTransition();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const setDiseno = <K extends keyof Diseno>(k: K, v: Diseno[K]) =>
    setF((p) => ({ ...p, diseno: { ...p.diseno, [k]: v } }));
  /** Lo que cambia el editor del encabezado: campos planos + tres del `diseno`. */
  const cambiarEncabezado = (c: Partial<ValoresEncabezado>) =>
    setF((p) => {
      const { logoForma, logoTamano, titulo, encabezado, ...planos } = c;
      return {
        ...p,
        ...planos,
        diseno: {
          ...p.diseno,
          ...(logoForma ? { logoForma } : {}),
          ...(logoTamano ? { logoTamano } : {}),
          ...(titulo ? { titulo } : {}),
          ...(encabezado ? { encabezado } : {}),
        },
      };
    });

  const vocab = vocabDe(f.rubro);
  const comida = esDeComida(f.rubro);
  const paleta = paletaDelTema(f.tema, f.colorFondo, f.colorAcento);

  /**
   * LAS ETIQUETAS DE LOS ENLACES TAMBIÉN SE EDITAN EN EL TELÉFONO.
   *
   * Viven en su propia tabla y tienen su sección («Enlaces», abajo), así
   * que acá se guarda una copia local que el teléfono edita en el lugar.
   * Al guardar se manda por la MISMA action que usa esa sección — no hay
   * un segundo camino de escritura, que es lo que convierte dos
   * editores en dos verdades. Se mandan TODAS las columnas del enlace
   * (foto, formato, descripción): la action reemplaza la lista entera,
   * y mandar solo la etiqueta borraba el resto.
   */
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>({});
  /** Las filas tal como están en «Tus enlaces» ahora mismo (guardadas o no). */
  const [linksVivos, setLinksVivos] = useState<FilaEnlace[] | null>(null);
  const linksParaPrevia = (
    linksVivos
      ? linksVivos.map((f, i) => ({ id: f.id ?? `nuevo-${i}`, etiqueta: f.etiqueta, url: f.url, icono: f.icono, visible: f.visible, fondoUrl: f.fondoUrl || null, formato: f.formato, descripcion: f.descripcion }))
      : links.map((l) => ({ id: l.id, etiqueta: l.etiqueta, url: l.url, icono: l.icono, visible: l.visible, fondoUrl: l.fondo_url, formato: l.formato, descripcion: l.descripcion }))
  )
    .filter((l) => l.visible)
    .map((l) => ({ id: l.id, etiqueta: etiquetas[l.id] ?? l.etiqueta, url: l.url, icono: l.icono, fondoUrl: l.fondoUrl, formato: l.formato, descripcion: l.descripcion }));
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

  /** Elegir un país trae su moneda, salvo que la moneda ya sea otra a propósito. */
  const elegirPais = (pais: Pais) =>
    setF((p) => ({
      ...p,
      pais,
      moneda: p.moneda === monedaDelPais(p.pais) ? monedaDelPais(pais) : p.moneda,
      // Sin mesas fuera de la comida: el QR de mesa es de restaurante.
    }));

  const elegirRubro = (rubro: Rubro) =>
    setF((p) => ({ ...p, rubro, aceptaPedidos: esDeComida(rubro) ? p.aceptaPedidos : false }));

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
            fondoUrl: l.fondo_url,
            formato: l.formato,
            descripcion: l.descripcion,
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
    diseno: f.diseno,
    moneda: f.moneda,
    pais: f.pais,
    rubro: f.rubro,
  };

  /** «Guardar la página» + «Ver como cliente»: en Diseño y en Ajustes. */
  const barraGuardar = (
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
  );

  const simbolo = MONEDA[f.moneda].simbolo;
  const grupos = Array.from(new Set(RUBROS.map((r) => RUBRO[r].grupo)));

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── LOS CONTROLES ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {recienCreado && (
          <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
            ¡Tu negocio ya existe! Elegí abajo cómo se ve —lo mirás al lado mientras tocás. El{" "}
            {vocab.catalogo.toLowerCase()} y los pedidos se agregan desde «Inicio».
          </p>
        )}

        {vista === "diseno" && (
          <>
        {/* ── EL ENCABEZADO (7 sep 2026): el «Header» de Linktree ── */}
        <EncabezadoEditor
          valores={{
            nombre: f.nombre,
            bajada: f.bajada,
            logoUrl: f.logoUrl,
            fotoPortadaUrl: f.fotoPortadaUrl,
            estiloPortada: f.estiloPortada,
            logoForma: f.diseno.logoForma,
            logoTamano: f.diseno.logoTamano,
            titulo: f.diseno.titulo,
            encabezado: f.diseno.encabezado,
            tema: f.tema,
            colorFondo: f.colorFondo,
            colorAcento: f.colorAcento,
          }}
          paleta={paleta}
          ejemploBajada={RUBRO[f.rubro].ejemploBajada}
          alCambiar={cambiarEncabezado}
          plan={negocio.plan}
          hrefPro={hrefPro}
        />

        {/* ── EL ESTUDIO ─────────────────────────────────────────
            Grupos siempre en el mismo orden, del más global al más
            fino: TEMA, TIPOGRAFÍA, FORMA, EFECTO, BOTONES, ENCABEZADO,
            FONDO, MOVIMIENTO. Cada grupo tiene UNA fila de controles del
            mismo tamaño, y la píldora de arriba resume la elección. */}
        <span id="estudio" className="block scroll-mt-24" aria-hidden />
        <Card
          eyebrow="El diseño"
          titulo="Tu estilo"
          accion={
            <PildoraEstado estado="neutro">
              {PRESETS[f.tema].nombre} · {FUENTE[f.fuente].nombre} · {EFECTO[f.efecto].nombre}
            </PildoraEstado>
          }
        >
          {/* 1 · TEMA — trece fichas del mismo tamaño. La miniatura se
              pinta con la MISMA paleta que la página. */}
          <Grupo titulo="Tema" pie={pro ? "La paleta de tu página" : "Tres temas gratis; los demás con Pro"} primero>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
              {TEMAS.map((t) => {
                const pal = paletaDelTema(t, f.colorFondo, f.colorAcento);
                const activo = f.tema === t;
                const bloqueado = !pro && !TEMAS_GRATIS.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => !bloqueado && elegirTema(t)}
                    aria-pressed={activo}
                    aria-disabled={bloqueado || undefined}
                    title={bloqueado ? "Con el plan Pro" : PRESETS[t].pie}
                    className={`presionable relative overflow-hidden rounded-xl border text-left transition-colors ${
                      activo ? "border-aventurea-navy ring-2 ring-aventurea-navy/20" : bloqueado ? "cursor-not-allowed border-aventurea-line opacity-60" : "border-aventurea-line hover:border-aventurea-navy/40"
                    }`}
                  >
                    {bloqueado && (
                      <span className="absolute right-1.5 top-1.5">
                        <PildoraPro />
                      </span>
                    )}
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

          {/* 2 · TIPOGRAFÍA — cada ficha escrita con su propia cara. */}
          <Grupo titulo="Tipografía" pie="Cada opción, escrita con su propia letra" pro bloqueado={!pro} hrefPro={hrefPro}>
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

          {/* 3 · FORMA — controles segmentados, iguales. */}
          <Grupo titulo="Forma" pie="Cómo se acomodan las piezas">
            <div className="grid gap-4 sm:grid-cols-2">
              <Control rotulo="Tus puertas">
                <Segmentos
                  etiqueta="Cómo se ven las puertas"
                  bloqueadas={pro ? [] : (["grilla"] as const)}
                  valor={f.estiloLinks}
                  alCambiar={(v) => set("estiloLinks", v)}
                  opciones={ESTILOS_LINKS.map((e) => ({ id: e, nombre: ETIQUETA_ESTILO[e].nombre, pie: ETIQUETA_ESTILO[e].pie }))}
                />
              </Control>
              <Control rotulo="Las piezas" nota={f.diseno.piezas === "suelta" ? "Botones y catálogo sin tarjeta, directo sobre el fondo. El encabezado tiene su propia opción arriba." : undefined}>
                <Segmentos
                  etiqueta="Las piezas"
                  bloqueadas={pro ? [] : (["suelta"] as const)}
                  valor={f.diseno.piezas}
                  alCambiar={(v) => setDiseno("piezas", v)}
                  opciones={opcionesDe(PIEZAS, DISENO_OPCION.piezas)}
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
              <Control rotulo="Espacio entre piezas">
                <Segmentos
                  etiqueta="Densidad"
                  valor={f.diseno.densidad}
                  alCambiar={(v) => setDiseno("densidad", v)}
                  opciones={opcionesDe(DENSIDADES, DISENO_OPCION.densidad)}
                />
              </Control>
              <Control rotulo="Alineación">
                <Segmentos
                  etiqueta="Alineación"
                  valor={f.diseno.alineacion}
                  alCambiar={(v) => setDiseno("alineacion", v)}
                  opciones={opcionesDe(ALINEACIONES, DISENO_OPCION.alineacion)}
                />
              </Control>
            </div>
          </Grupo>

          {/* 4 · EFECTO — fichas con una VISTA PREVIA real: la misma
              función que viste la página (`estiloDePieza`). */}
          {/* Las fichas muestran el EFECTO puro (botón «Del efecto») sobre
              manchas de color: el vidrio necesita algo detrás para verse
              vidrio. Y elegir un efecto devuelve el botón a «Del efecto»:
              con «Sólido» puesto, el dueño elegía Vidrio y no veía nada
              cambiar (7 sep 2026). */}
          <Grupo
            titulo="Efecto de las tarjetas"
            pro
            bloqueado={!pro}
            hrefPro={hrefPro}
            pie={
              f.diseno.boton === "acabado"
                ? "Así se ven con tu tema de ahora"
                : `Tu botón está en «${DISENO_OPCION.boton[f.diseno.boton].nombre}» y tapa el efecto; al elegir uno, vuelve a «Del efecto»`
            }
          >
            <Fichas
              etiqueta="Efecto"
              valor={f.efecto}
              alCambiar={(v) => setF((p) => ({ ...p, efecto: v, diseno: { ...p.diseno, boton: "acabado" } }))}
              opciones={EFECTOS.map((x) => ({ id: x, nombre: EFECTO[x].nombre, pie: EFECTO[x].pie }))}
              vista={(x) => (
                <span aria-hidden className="relative flex h-[64px] items-center justify-center overflow-hidden p-3" style={{ background: `linear-gradient(135deg, ${paleta.fondo}, ${paleta.fondo2})` }}>
                  <span className="absolute -left-3 -top-5 h-12 w-12 rounded-full" style={{ background: conAlfa(paleta.acento, 0.85) }} />
                  <span className="absolute -bottom-6 right-2 h-12 w-12 rounded-full" style={{ background: conAlfa(paleta.tinta, 0.35) }} />
                  <span className="relative flex h-10 w-full items-center gap-2 px-2.5" style={estiloDePieza(x, paleta, { radio: Math.min(RADIOS[f.redondeo].pieza, 12), boton: "acabado" })}>
                    <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: paleta.acento }} />
                    <span className="h-1.5 flex-1 rounded-full" style={{ background: paleta.tinta, opacity: 0.55 }} />
                  </span>
                </span>
              )}
            />
          </Grupo>

          {/* 5 · BOTONES — por encima del efecto (0236). */}
          <Grupo titulo="Botones" pie="El estilo de las puertas y de la fila de redes">
            <div className="grid gap-4 sm:grid-cols-2">
              <Control rotulo="Estilo del botón">
                <Segmentos
                  etiqueta="Estilo del botón"
                  bloqueadas={pro ? [] : (["solido", "contorno", "sombra"] as const)}
                  valor={f.diseno.boton}
                  alCambiar={(v) => setDiseno("boton", v)}
                  opciones={opcionesDe(BOTONES, DISENO_OPCION.boton)}
                />
              </Control>
              <Control rotulo="Fila de redes" nota="Los enlaces marcados como «ícono de red», abajo en Enlaces.">
                <Segmentos
                  etiqueta="Dónde va la fila de redes"
                  valor={f.diseno.redes}
                  alCambiar={(v) => setDiseno("redes", v)}
                  opciones={opcionesDe(REDES, DISENO_OPCION.redes)}
                />
              </Control>
            </div>
          </Grupo>

          {/* 6 · ENCABEZADO — logo y titular (0236). */}
          {/* 7 · FONDO — fichas con la trama de verdad (0236). Aurora y
              burbujas se muestran quietas en la ficha; se mueven en la
              previa. */}
          <Grupo titulo="Fondo" pie="Detrás de todo. Aurora y burbujas se mueven" pro bloqueado={!pro} hrefPro={hrefPro}>
            <Fichas
              etiqueta="Fondo"
              valor={f.diseno.fondo}
              alCambiar={(v) => setDiseno("fondo", v)}
              opciones={opcionesDe(FONDOS, DISENO_OPCION.fondo)}
              columnas="grid-cols-3 sm:grid-cols-4 lg:grid-cols-7"
              vista={(x) => (
                <span aria-hidden className="relative block h-[52px] overflow-hidden" style={fondoDePagina(x, paleta)}>
                  {(x === "aurora" || x === "burbujas") && (
                    <>
                      <span className="absolute -left-3 -top-3 h-10 w-10 rounded-full" style={{ background: conAlfa(paleta.acento, 0.6), filter: x === "aurora" ? "blur(8px)" : undefined }} />
                      <span className="absolute -bottom-4 right-2 h-9 w-9 rounded-full" style={{ background: conAlfa(paleta.acento, 0.35), filter: x === "aurora" ? "blur(8px)" : undefined }} />
                    </>
                  )}
                </span>
              )}
            />
          </Grupo>

          {/* 8 · MOVIMIENTO — animación de entrada y hover (0236). */}
          <Grupo titulo="Movimiento" pie="Cómo entra la página y qué hacen los botones al pasar el mouse" pro bloqueado={!pro} hrefPro={hrefPro}>
            <div className="grid gap-4">
              <Control rotulo="Al abrir la página" nota="Con «reducir movimiento» activado en el teléfono, todo aparece quieto.">
                <Fichas
                  etiqueta="Animación de entrada"
                  valor={f.diseno.animacion}
                  alCambiar={(v) => setDiseno("animacion", v)}
                  opciones={opcionesDe(ANIMACIONES, DISENO_OPCION.animacion)}
                />
              </Control>
              <Control rotulo="Al pasar el mouse por un botón">
                <Fichas
                  etiqueta="Efecto al pasar el mouse"
                  valor={f.diseno.hover}
                  alCambiar={(v) => setDiseno("hover", v)}
                  opciones={opcionesDe(HOVERS, DISENO_OPCION.hover)}
                />
              </Control>
            </div>
          </Grupo>
        </Card>

        {/* ── EL NEGOCIO: rubro, país y moneda (0236) ───────────── */}
        {barraGuardar}
          </>
        )}

        {vista === "ajustes" && (
          <>
        <Card
          eyebrow="Tu negocio"
          titulo="Rubro, país y moneda"
          accion={
            <PildoraEstado estado="neutro">
              {banderaDe(f.pais)} {PAIS[f.pais].nombre} · {simbolo} {f.moneda}
            </PildoraEstado>
          }
        >
          <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
            El rubro decide cómo se llaman las cosas —{vocab.catalogo.toLowerCase()}, {vocab.items}, {vocab.pedir.toLowerCase()}— y qué formas
            de pedir tienen sentido. El país pone el prefijo del WhatsApp y sugiere la moneda; la moneda es en la que escribís tus
            precios.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="rubro" className={ROTULO_CAMPO}>Rubro</label>
              <select id="rubro" value={f.rubro} onChange={(e) => elegirRubro(e.target.value as Rubro)} className={`mt-1.5 ${CAMPO_PANEL}`}>
                {grupos.map((g) => (
                  <optgroup key={g} label={GRUPO_RUBRO[g]}>
                    {RUBROS.filter((r) => RUBRO[r].grupo === g).map((r) => (
                      <option key={r} value={r}>{RUBRO[r].nombre}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">{RUBRO[f.rubro].pie}</p>
            </div>
            <div>
              <label htmlFor="pais" className={ROTULO_CAMPO}>País</label>
              <select id="pais" value={f.pais} onChange={(e) => elegirPais(e.target.value as Pais)} className={`mt-1.5 ${CAMPO_PANEL}`}>
                {PAISES.map((p) => (
                  <option key={p} value={p}>{banderaDe(p)} {PAIS[p].nombre}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">WhatsApp con +{PAIS[f.pais].telefono}</p>
            </div>
            <div>
              <label htmlFor="moneda" className={ROTULO_CAMPO}>Moneda de tus precios</label>
              <select id="moneda" value={f.moneda} onChange={(e) => set("moneda", e.target.value as Moneda)} className={`mt-1.5 ${CAMPO_PANEL}`}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>{MONEDA[m].simbolo} · {MONEDA[m].nombre} ({m})</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
                {MONEDA[f.moneda].decimales === 0 ? "Sin centavos" : "Con dos decimales"}
              </p>
            </div>
          </div>
        </Card>

        {/* ── EL CONTENIDO ─────────────────────────────────────── */}
        <Card eyebrow="Para que te encuentren" titulo="Contacto">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="whatsapp" className={ROTULO_CAMPO}>WhatsApp (solo números, sin el +{PAIS[f.pais].telefono})</label>
              <input id="whatsapp" type="tel" value={f.whatsapp} placeholder={ejemploTelefono(f.pais)} onChange={(e) => set("whatsapp", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
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
          {/* EL DOMINIO DE MARCA (8 sep 2026): linksy.lat o bookea.lat. Se
              guarda al tocarlo; el enlace de arriba se actualiza al instante. */}
          {esDueno && (
            <div className="mt-3">
              <Control rotulo="Tu dirección" nota={cambiandoHost ? "Guardando…" : `${HOST_MARCA[hostMarca].ejemplo} · ${HOST_MARCA[hostMarca].pie}`}>
                <Segmentos
                  etiqueta="Dominio de tu página"
                  valor={hostMarca}
                  alCambiar={(h) => {
                    setHostMarca(h);
                    arrancarHost(async () => {
                      const r = await elegirDominioMarcaSolutions(negocio.id, h);
                      if (!r.ok) {
                        setMsg({ tono: "alerta", texto: r.motivo });
                        setHostMarca(negocio.host_marca);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                  opciones={HOSTS_MARCA.map((h) => ({ id: h, nombre: HOST_MARCA[h].nombre, pie: HOST_MARCA[h].ejemplo }))}
                />
              </Control>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label htmlFor="slug" className={ROTULO_CAMPO}>Cambiar el enlace ({HOST_MARCA[hostMarca].nombre}/…)</label>
              <input id="slug" type="text" value={f.slug} onChange={(e) => set("slug", e.target.value)} className={`mt-1.5 ${CAMPO_PANEL}`} />
            </div>
            <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
              <input type="checkbox" checked={f.publicado} onChange={(e) => set("publicado", e.target.checked)} className="h-4 w-4" />
              Publicada
            </label>
          </div>
        </Card>

        <Card eyebrow="Lo que vendés" titulo={`${vocab.catalogoLargo} y ${vocab.pedidosNombre.toLowerCase()}`}>
          {/* ── EL CATÁLOGO: solo con su add-on ────────────────── */}
          {addons.menu ? (
            <>
              <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
                <input type="checkbox" checked={f.mostrarMenu} onChange={(e) => set("mostrarMenu", e.target.checked)} className="h-4 w-4" />
                Mostrar {vocab.catalogo === "Servicios" ? "los servicios" : `el ${vocab.catalogo.toLowerCase()}`} en la página
              </label>

              {/* ── LOS IDIOMAS DEL CATÁLOGO (0235) ─────────────── */}
              <div className="mt-4">
                <p className={ROTULO_CAMPO}>Idiomas {vocab.catalogo === "Servicios" ? "de los servicios" : `del ${vocab.catalogo.toLowerCase()}`} (además del español)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {IDIOMAS_EXTRA.map((i) => {
                    const activo = f.idiomasMenu.includes(i);
                    return (
                      <label
                        key={i}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-bold ${
                          activo ? "border-aventurea-navy bg-aventurea-navy/5 text-aventurea-navy" : "border-aventurea-line text-aventurea-ink-soft"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={activo}
                          onChange={(e) =>
                            set("idiomasMenu", e.target.checked ? [...f.idiomasMenu, i] : f.idiomasMenu.filter((x) => x !== i))
                          }
                          className="h-4 w-4"
                        />
                        {IDIOMA[i].nombre}
                        <span className="text-[11px] font-medium text-aventurea-ink-soft">{IDIOMA[i].propio}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
                  Tus clientes cambian el idioma arriba. Las traducciones se cargan en «{vocab.catalogoLargo}», a mano o con IA de
                  una vez.
                </p>
              </div>
            </>
          ) : (
            <p className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
              {vocab.catalogoLargo} es un add-on.{" "}
              <Link href="?tab=inicio" className="font-bold underline">Agregalo desde Inicio</Link> y acá aparecen
              sus opciones.
            </p>
          )}

          {/* ── LOS PEDIDOS: cada modalidad, con lo suyo ───────────
              Todas caen en el tablero (Modo restaurante / Ventas en
              línea / Reservas). La mesa con QR es solo de comida. */}
          {addons.pedidos ? (
            <div className="mt-4 border-t border-aventurea-line pt-4">
              <p className={ROTULO_CAMPO}>{vocab.decidir}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ...(comida ? [{ k: "aceptaPedidos" as const, t: "En la mesa", d: `Desde el QR de cada mesa. Llega al ${vocab.tablero}.` }] : []),
                    { k: "pedidosLlevar" as const, t: vocab.modalidades.llevar.rotulo, d: `${vocab.modalidades.llevar.pie} Llega a ${vocab.tablero}.` },
                    { k: "pedidosExpress" as const, t: vocab.modalidades.express.rotulo, d: `${vocab.modalidades.express.pie} Llega a ${vocab.tablero} con la dirección.` },
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

              {comida && f.aceptaPedidos && (
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
                      <label htmlFor="costoExpress" className={ROTULO_CAMPO}>Costo de {vocab.modalidades.express.rotulo.toLowerCase()} ({simbolo})</label>
                      <input id="costoExpress" type="number" min={0} step={pasoDePrecio(f.moneda)} value={f.costoExpress} onChange={(e) => set("costoExpress", Math.max(0, Number(e.target.value) || 0))} className={`mt-1.5 w-[150px] ${CAMPO_PANEL}`} />
                      <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">Se suma al pedido. 0 = sin costo.</p>
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
              {vocab.pedidosNombre} es un add-on.{" "}
              <Link href="?tab=inicio" className="font-bold underline">Agregalo desde Inicio</Link>.
            </p>
          )}
        </Card>

        {barraGuardar}

        {/* ── TU PROPIO DOMINIO (0234) — solo el dueño ─────────── */}
        {esDueno && <SeccionDominio negocio={negocio} />}
          </>
        )}

        {vista === "enlaces" && (
          <>
        {/* ── LOS ENLACES, ACÁ MISMO (dueño, 5 sep 2026) ──────────
            «Mi página y Enlaces, ¿no es lo mismo?». Lo es: los enlaces
            SON la página. Antes tenían pestaña propia; ahora viven acá
            abajo, con su propio botón de guardar porque van a otra
            tabla y por otra action. `scroll-mt` para que los atajos
            del tablero (#enlaces) no queden tapados por el header. */}
        <div id="enlaces" className="scroll-mt-24">
          <SeccionLinks negocioId={negocio.id} links={links} alCambiar={setLinksVivos} />
        </div>
          </>
        )}
      </div>

      {/* ── LA PREVIA EN VIVO ────────────────────────────────────── */}
      {/* EL ESCENARIO (7 sep 2026, «el mockup de la derecha, 100 % profesional,
          para cualquier rubro»): el teléfono va sobre un fondo que sale de
          LA PALETA DEL NEGOCIO —su fondo, su acento— así la previa se ve como
          una pieza de su marca y no como un widget del panel. Sirve igual
          para una tienda, un DJ o un restaurante: los colores son los suyos. */}
      <aside className="mt-6 lg:sticky lg:top-[92px] lg:mt-0">
        <div
          className="relative overflow-hidden rounded-[28px] p-5 pb-7 shadow-elevado"
          style={{ background: `linear-gradient(165deg, ${conAlfa(paleta.acento, 0.32)} 0%, ${paleta.fondo} 48%, ${paleta.fondo2} 100%)` }}
        >
          <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl" style={{ background: conAlfa(paleta.acento, 0.6) }} />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl" style={{ background: conAlfa(paleta.acento, 0.28) }} />
          <div className="relative mb-4 flex items-center justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.tinta }}>
              Así se ve ahora
            </p>
            <span className="max-w-[62%] truncate rounded-full px-3 py-1 text-[11.5px] font-extrabold" style={{ background: paleta.superficie, color: paleta.tinta, border: `1px solid ${paleta.borde}` }}>
              {urlPublica.replace(/^https?:[/][/]/, "")}
            </span>
          </div>
        <Telefono
          ancho={300}
          className="relative mx-auto"
          tinta={paleta.tinta}
        >
          {/* `inerte`: la previa no navega. Tocar un enlace acá sacaría al
              dueño de su panel a mitad de la edición.
              `edicion`: los textos se escriben ACÁ ADENTRO.
              `key`: cambiar la animación de entrada vuelve a montar la
              página, así se ve entrar de nuevo con la opción elegida. */}
          <VistaPagina
            key={f.diseno.animacion}
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
        </div>
        {/* Las cards se agregan, quitan y editan en «Enlaces», más abajo.
            El atajo va acá porque es donde el dueño las está mirando. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={vista === "enlaces" ? "#enlaces" : "?tab=enlaces"} className={vista === "enlaces" ? LP_BOTON_CHICO_SUAVE : LP_BOTON_CHICO}>
            {vista === "enlaces" ? "Tus cards ↑" : "Agregar o editar cards →"}
          </a>
          <a href={vista === "diseno" ? "#estudio" : "?tab=diseno"} className={vista === "diseno" ? LP_BOTON_CHICO_SUAVE : LP_BOTON_CHICO}>
            {vista === "diseno" ? "Cambiar el estilo ↑" : "Cambiar el diseño →"}
          </a>
          {vista !== "ajustes" && (
            <a href="?tab=ajustes" className={LP_BOTON_CHICO_SUAVE}>
              Dirección y contacto →
            </a>
          )}
        </div>
        <p className="mt-3 text-center text-[11.5px] leading-snug text-aventurea-ink-soft lg:text-left">
          <strong className="text-aventurea-ink">Tocá el texto en el teléfono para escribirlo ahí.</strong>{" "}
          Es tu página de verdad, no un dibujo. Guardá para que la vean tus clientes.
        </p>
      </aside>
    </div>
  );
}
