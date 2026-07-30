"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * El fondo de la portada: una de tres fotos (evento, spa, playa)
 * elegida al azar en cada recarga. El sorteo vive fuera de React
 * (useSyncExternalStore): el servidor no puede sortear sin
 * desincronizar la hidratación, así que ahí no rinde nada y el
 * cliente resuelve la foto apenas hidrata. Mientras la foto llega se
 * ve la base navy del main — nunca hay un flash blanco.
 */
const FONDOS = [
  "/fondos/portada-eventos.jpg",
  "/fondos/portada-citas.jpg",
  "/fondos/portada-hospedajes.jpg",
];

let fondoSorteado: string | null = null;

function elegirFondo() {
  fondoSorteado ??= FONDOS[Math.floor(Math.random() * FONDOS.length)];
  return fondoSorteado;
}

const sinSuscripcion = () => () => {};

export default function FondoPortada() {
  const fondo = useSyncExternalStore(sinSuscripcion, elegirFondo, () => null);
  const [cargado, setCargado] = useState(false);

  if (!fondo) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto decorativa local; el sorteo en cliente necesita un <img> simple
    <img
      src={fondo}
      alt=""
      aria-hidden
      onLoad={() => setCargado(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
        cargado ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
