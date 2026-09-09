"use client";

import type { CSSProperties, ReactNode } from "react";
import { conVariante } from "@/lib/solutions/fotos";
import type { DefEstiloMenu, PapelMenu } from "@/lib/solutions/menu-estilos";
import type { PintaMenu } from "@/lib/solutions/menu-pinta";

export type { PintaMenu };

/**
 * ════════════════════════════════════════════════════════════════════
 *  CÓMO SE VE UN PLATO EN CADA DISEÑO
 * ════════════════════════════════════════════════════════════════════
 *
 * Un solo renderizador para los veintiséis diseños de
 * `menu-estilos.ts`. Acá vive lo VISUAL y nada más: el carrito, los
 * idiomas, la ficha nutricional y el pedido siguen en
 * `menu-con-carrito.tsx`, que le pasa a cada plato sus botones ya
 * armados (`acciones`). Así, agregar un diseño no toca ni una línea de
 * la lógica que mueve plata.
 *
 * Las seis disposiciones cubren cómo se imprimen las cartas de verdad:
 *
 *   guia       Nombre … puntos … precio. La carta de restaurante.
 *   columnas   Lo mismo, en dos columnas: cartas largas sin fotos.
 *   lista      Renglón con foto chica al lado. La de siempre.
 *   tarjetas   Foto grande arriba, texto debajo. Estilo app de reparto.
 *   cuadricula Dos o tres fotos por fila. Vitrina y tienda.
 *   revista    Foto ancha y titular grande. Cada plato, una página.
 */

// ── Piezas sueltas ──────────────────────────────────────────────────

const RADIO: Record<DefEstiloMenu["radio"], string> = {
  recto: "rounded-none",
  suave: "rounded-2xl",
  redondo: "rounded-3xl",
};

const AIRE: Record<DefEstiloMenu["aire"], string> = {
  compacto: "gap-1.5",
  normal: "gap-3",
  amplio: "gap-6",
};

/** El aire ENTRE secciones, que es siempre mayor que el de los platos. */
export const AIRE_SECCION: Record<DefEstiloMenu["aire"], string> = {
  compacto: "gap-6",
  normal: "gap-9",
  amplio: "gap-14",
};

/** El nombre de la sección: «Entradas», «Postres», «Cortes». */
export function TituloSeccion({ pinta, nombre }: { pinta: PintaMenu; nombre: string }) {
  const { paleta, def } = pinta;
  if (def.titulo === "centrado") {
    return (
      <div className="mb-4 text-center">
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: paleta.tinta }}>
          {nombre}
        </h2>
        <span
          aria-hidden
          className="mx-auto mt-2 block h-px w-10"
          style={{ background: paleta.acento, opacity: 0.6 }}
        />
      </div>
    );
  }
  if (def.titulo === "serif") {
    return (
      <h2 className="mb-3 text-[24px] font-bold leading-tight tracking-tight" style={{ color: paleta.tinta }}>
        {nombre}
      </h2>
    );
  }
  if (def.titulo === "alta") {
    return (
      <h2
        className="mb-3 text-[15px] font-extrabold uppercase tracking-[0.2em]"
        style={{ color: paleta.acento }}
      >
        {nombre}
      </h2>
    );
  }
  if (def.titulo === "normal") {
    return (
      <h2 className="mb-3 text-[17px] font-extrabold tracking-tight" style={{ color: paleta.tinta }}>
        {nombre}
      </h2>
    );
  }
  // versalitas
  return (
    <h2
      className="mb-3 text-[12.5px] font-extrabold uppercase tracking-[0.16em]"
      style={{ color: paleta.suave }}
    >
      {nombre}
    </h2>
  );
}

/** La caja que agrupa los platos de una sección, con su disposición. */
export function ListaPlatos({ pinta, children }: { pinta: PintaMenu; children: ReactNode }) {
  const { def } = pinta;
  if (def.disposicion === "cuadricula") {
    const cols = def.columnas === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2";
    return <ul className={`grid ${cols} ${AIRE[def.aire]}`}>{children}</ul>;
  }
  if (def.disposicion === "columnas") {
    // Multi-columna del navegador: los platos fluyen y no se parten.
    return <ul className={`columns-1 sm:columns-2 ${def.aire === "compacto" ? "gap-8" : "gap-10"}`}>{children}</ul>;
  }
  return <ul className={`flex flex-col ${AIRE[def.aire]}`}>{children}</ul>;
}

type Plato = {
  nombre: string;
  descripcion: string;
  fotoUrl: string | null;
  /** Ya formateado («₡3.500») o el texto de «a consultar». */
  precio: string;
  tieneNutricion: boolean;
};

/**
 * Un plato, en el diseño que el negocio eligió.
 *
 * `acciones` son los botones que dependen del carrito y del WhatsApp;
 * llegan armados de afuera y acá solo se los ubica.
 */
export function PlatoEnEstilo({
  pinta,
  plato,
  destacado,
  acciones,
  alAbrir,
}: {
  pinta: PintaMenu;
  plato: Plato;
  /** Ya está en el carrito: el borde se pinta con el acento. */
  destacado: boolean;
  acciones: ReactNode;
  alAbrir: () => void;
}) {
  const { paleta, def } = pinta;
  const borde = destacado ? paleta.acento : paleta.borde;
  /** Un cuerpo de letra, ya multiplicado por el tamaño elegido. */
  const T = (n: number) => `${Math.round(n * pinta.escala * 10) / 10}px`;

  const precio = (
    <span
      className={
        def.precio === "pildora"
          ? "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-extrabold tabular-nums"
          : "shrink-0 whitespace-nowrap font-bold tabular-nums"
      }
      style={
        def.precio === "pildora"
          ? { background: paleta.acento, color: paleta.sobreAcento, fontSize: T(12.5) }
          : { color: paleta.acento, fontSize: T(14) }
      }
    >
      {plato.precio}
      {plato.tieneNutricion && (
        <span className="ml-1.5 text-[11px] font-bold" style={{ color: paleta.suave }} aria-hidden>
          ⓘ
        </span>
      )}
    </span>
  );

  const nombre = (
    <span
      className={
        def.titulo === "alta" && def.disposicion !== "revista"
          ? "block font-extrabold uppercase leading-tight tracking-[0.06em]"
          : "block font-extrabold leading-tight"
      }
      style={{ color: paleta.tinta, fontSize: T(def.titulo === "alta" ? 13.5 : 14.5) }}
    >
      {plato.nombre}
    </span>
  );

  const descripcion = plato.descripcion ? (
    <span
      className={`mt-1 block leading-snug ${def.disposicion === "guia" || def.disposicion === "columnas" ? "" : "line-clamp-2"}`}
      style={{ color: paleta.suave, fontSize: T(11.8) }}
    >
      {plato.descripcion}
    </span>
  ) : null;

  const foto = plato.fotoUrl ? conVariante(plato.fotoUrl, "thumb") ?? plato.fotoUrl : null;
  const fotoGrande = plato.fotoUrl ? conVariante(plato.fotoUrl, "gallery") ?? plato.fotoUrl : null;

  // ── Guía y columnas: nombre … puntos … precio, sin foto ──────────
  if (def.disposicion === "guia" || def.disposicion === "columnas") {
    const conPuntos = def.precio === "puntos";
    return (
      <li
        className={`${def.disposicion === "columnas" ? "mb-5 break-inside-avoid" : ""} ${separadorClase(def)}`}
        style={separadorEstilo(def, paleta)}
      >
        <div className="flex items-start gap-3">
          <button type="button" onClick={alAbrir} className="min-w-0 flex-1 text-left">
            <span className="flex items-baseline gap-2">
              {nombre}
              {conPuntos && (
                <span
                  aria-hidden
                  className="mt-auto h-px min-w-[18px] flex-1"
                  style={{
                    backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
                    backgroundSize: "5px 1px",
                    color: paleta.suave,
                    transform: "translateY(-4px)",
                  }}
                />
              )}
              {conPuntos && precio}
            </span>
            {descripcion}
          </button>
          {!conPuntos && precio}
          {acciones}
        </div>
      </li>
    );
  }

  // ── Cuadrícula: foto arriba, texto abajo ─────────────────────────
  if (def.disposicion === "cuadricula") {
    return (
      <li
        className={`overflow-hidden ${RADIO[def.radio]} ${def.separador === "tarjeta" ? "border" : ""}`}
        style={def.separador === "tarjeta" ? { background: paleta.superficie, borderColor: borde } : undefined}
      >
        <button type="button" onClick={alAbrir} className="block w-full text-left">
          {fotoGrande ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoGrande}
              alt=""
              loading="lazy"
              className={`aspect-square w-full object-cover ${def.separador === "tarjeta" ? "" : RADIO[def.radio]}`}
            />
          ) : null}
          <span className="block px-3 pb-3 pt-2.5">
            {nombre}
            {descripcion}
            <span className="mt-1.5 block">{precio}</span>
          </span>
        </button>
        {acciones && <div className="flex justify-end gap-2 px-3 pb-3">{acciones}</div>}
      </li>
    );
  }

  // ── Tarjetas: la foto manda, el texto debajo ─────────────────────
  if (def.disposicion === "tarjetas") {
    return (
      <li
        className={`overflow-hidden border ${RADIO[def.radio]}`}
        style={{ background: paleta.superficie, borderColor: borde }}
      >
        <button type="button" onClick={alAbrir} className="block w-full text-left">
          {fotoGrande && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoGrande} alt="" loading="lazy" className="h-[190px] w-full object-cover" />
          )}
          <span className="block px-4 pb-3 pt-3">
            {nombre}
            {descripcion}
          </span>
        </button>
        <div className="flex items-center justify-between gap-3 px-4 pb-4">
          {precio}
          <span className="flex items-center gap-2">{acciones}</span>
        </div>
      </li>
    );
  }

  // ── Revista: foto ancha (o redonda) y titular grande ─────────────
  if (def.disposicion === "revista") {
    const redonda = def.foto === "circular";
    return (
      <li className={`${def.separador === "ninguno" ? "" : separadorClase(def)} pb-2`} style={separadorEstilo(def, paleta)}>
        <button type="button" onClick={alAbrir} className={`block w-full ${redonda ? "text-center" : "text-left"}`}>
          {fotoGrande && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoGrande}
              alt=""
              loading="lazy"
              className={
                redonda
                  ? "mx-auto h-[150px] w-[150px] rounded-full object-cover"
                  : `h-[220px] w-full object-cover ${RADIO[def.radio]}`
              }
            />
          )}
          <span className={`block ${fotoGrande ? "mt-3" : ""}`}>
            <span
              className={`block text-[21px] font-bold leading-tight tracking-tight ${def.titulo === "alta" ? "uppercase tracking-[0.08em]" : ""}`}
              style={{ color: paleta.tinta }}
            >
              {plato.nombre}
            </span>
            {plato.descripcion && (
              <span className="mt-1.5 block text-[13.5px] leading-relaxed" style={{ color: paleta.suave }}>
                {plato.descripcion}
              </span>
            )}
          </span>
        </button>
        <div className={`mt-2.5 flex items-center gap-3 ${redonda ? "justify-center" : "justify-between"}`}>
          {precio}
          <span className="flex items-center gap-2">{acciones}</span>
        </div>
      </li>
    );
  }

  // ── Lista: el renglón con foto al lado ───────────────────────────
  const conFoto = def.foto !== "ninguna" && foto !== null;
  // Base chica y crecen en pantalla ancha: el catálogo se ve en el
  // teléfono del cliente Y en la previa de 270 px del panel.
  const ladoFoto =
    def.foto === "circular"
      ? "h-[46px] w-[46px] sm:h-[62px] sm:w-[62px] rounded-full"
      : def.foto === "cuadrada"
        ? `h-[52px] w-[52px] sm:h-[76px] sm:w-[76px] ${def.radio === "recto" ? "rounded-none" : "rounded-xl"}`
        : "h-[46px] w-[46px] sm:h-[60px] sm:w-[60px] rounded-xl";

  return (
    <li
      className={`flex items-center gap-2 sm:gap-3 ${def.separador === "tarjeta" ? `border p-2.5 sm:p-3 ${RADIO[def.radio]}` : `${separadorClase(def)} py-3`}`}
      style={
        def.separador === "tarjeta"
          ? { background: paleta.superficie, borderColor: borde }
          : separadorEstilo(def, paleta)
      }
    >
      <button type="button" onClick={alAbrir} className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden text-left">
        {foto && def.foto !== "ninguna" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" loading="lazy" className={`shrink-0 object-cover ${ladoFoto}`} />
        )}
        <span className="min-w-0 flex-1">
          {nombre}
          {descripcion}
          {(def.precio !== "derecha" || conFoto) && <span className="mt-1 block">{precio}</span>}
        </span>
      </button>
      {def.precio === "derecha" && !conFoto && precio}
      {acciones}
    </li>
  );
}

// ── Los separadores ─────────────────────────────────────────────────

function separadorClase(def: DefEstiloMenu): string {
  if (def.separador === "linea") return "border-b pb-3";
  if (def.separador === "filete") return "border-b-[3px] border-double pb-3";
  if (def.separador === "puntos") return "pb-2.5";
  return "";
}

function separadorEstilo(def: DefEstiloMenu, paleta: PapelMenu): CSSProperties | undefined {
  if (def.separador === "linea" || def.separador === "filete") return { borderColor: paleta.borde };
  return undefined;
}
