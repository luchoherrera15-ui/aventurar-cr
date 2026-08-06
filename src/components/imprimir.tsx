"use client";

import { useSyncExternalStore } from "react";

/**
 * Las dos piezas de "Imprimir / PDF" que comparten el panel real de
 * confirmaciones (/cuenta/evento/[id]) y su demo pública
 * (/invitaciones/ejemplo/confirmaciones): el botón que dispara
 * window.print() y el membrete que SOLO existe en el papel.
 *
 * La hoja la diseñan los estilos de `@media print` en globals.css
 * (clases hoja-*): marca Bookea arriba, título navy, regla naranja,
 * banda navy en la tabla. Este archivo solo pone el contenido.
 */

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="sin-imprimir rounded-xl border border-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
    >
      Imprimir / PDF
    </button>
  );
}

export function EncabezadoImpresion({
  titulo,
  invitaciones,
  asistiran,
  noAsistiran,
  personas,
}: {
  titulo: string;
  invitaciones: number;
  asistiran: number;
  noAsistiran: number;
  personas: number;
}) {
  // La fecha del navegador, no la del servidor: calcularla en los dos
  // lados puede dar días distintos y React se queja del cambio. Con
  // useSyncExternalStore el servidor manda vacío y el cliente la pone.
  const hoy = useSyncExternalStore(
    () => () => {},
    () =>
      new Date().toLocaleDateString("es-CR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    () => "",
  );

  return (
    <header className="solo-imprimir">
      <div className="hoja-marca">
        Bookea <small>bookea.lat</small>
      </div>
      <p className="hoja-titulo">{titulo}</p>
      <p className="hoja-sub">
        Lista de confirmaciones{hoy ? ` · impresa el ${hoy}` : ""}
      </p>
      <hr className="hoja-regla" />
      <p className="hoja-resumen">
        <b>{invitaciones}</b> invitaciones · <b>{asistiran}</b> asistirán ·{" "}
        <b>{noAsistiran}</b> no asistirán · <b>{personas}</b> personas en total
      </p>
    </header>
  );
}

/** El remate de la hoja — también solo sale impreso. */
export function PieImpresion() {
  return (
    <p className="solo-imprimir hoja-pie">
      Generado con Bookea · bookea.lat · Reservá espacios y servicios
    </p>
  );
}
