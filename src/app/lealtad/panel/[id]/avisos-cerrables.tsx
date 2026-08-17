"use client";

import { useState, type ReactNode } from "react";
import {
  COOKIE_AVISOS,
  VIDA_COOKIE_AVISOS,
  avisosOcultosDe,
  conAvisoCerrado,
  sinAvisosCerrados,
} from "@/lib/lealtad/avisos-ocultos";
import { Icono } from "./iconos";

/**
 * LOS AVISOS DE PUESTA EN MARCHA, CON SU X.
 *
 * El tablero de Inicio abría siempre con lo que falta hacer, y eso
 * seguía ahí cuando ya no faltaba nada urgente: quien entra a mirar sus
 * números tenía que pasar por encima de una guía que ya leyó. Ahora
 * cada aviso se cierra, y debajo queda el tablero.
 *
 * TRES DECISIONES QUE VALE LA PENA CONOCER:
 *
 * 1. CERRAR PERSISTE, y persiste en una COOKIE (ver el porqué completo
 *    en src/lib/lealtad/avisos-ocultos.ts). El servidor la lee y manda
 *    `ocultosIniciales`, así que el primer render —el del servidor y el
 *    de la hidratación— ya sale sin el aviso cerrado: no parpadea.
 *
 * 2. NADA SE PIERDE. Un aviso cerrado sigue contando en la barrita de
 *    abajo, que los devuelve todos de un toque. Los avisos dicen lo que
 *    todavía hay que hacer para que el programa funcione: esconderlos
 *    para siempre y sin rastro sería esconderle al dueño la razón por
 *    la que su tarjeta no anda.
 *
 * 3. LOS NODOS LLEGAN YA PINTADOS desde el servidor. Este componente no
 *    sabe qué dice cada aviso —solo lo muestra o no—, así que los
 *    textos, los enlaces y los permisos siguen resolviéndose donde
 *    siempre y nada de eso cruza al navegador como lógica.
 */

export type AvisoCerrable = {
  /** Estable y sin puntos: es lo que se guarda en la cookie. */
  clave: string;
  /** Cómo se lo nombra en el botón de cerrar, para el lector de pantalla. */
  etiqueta: string;
  nodo: ReactNode;
};

/**
 * Lo que hay en la cookie AHORA, no lo que había al cargar la página.
 *
 * Se lee y se escribe SIN codificar: el valor son ids y claves con el
 * alfabeto de `avisos-ocultos.ts` —letras, números, guiones y los dos
 * separadores—, todo válido en una cookie tal cual. Codificarlo no
 * cambiaría un carácter y sí agregaría un `decodeURIComponent` que
 * revienta con un `%` suelto si alguien edita la cookie a mano.
 */
function cookieActual(): string {
  const prefijo = `${COOKIE_AVISOS}=`;
  const par = document.cookie.split("; ").find((c) => c.startsWith(prefijo));
  return par ? par.slice(prefijo.length) : "";
}

/**
 * Se lee antes de escribir A PROPÓSITO: el panel puede estar abierto en
 * dos pestañas, y reescribir desde la foto que trajo el servidor
 * borraría lo que se cerró en la otra.
 *
 * `path=/lealtad` y no `/`: esta preferencia no le sirve a ninguna otra
 * pantalla del sitio, y una cookie viaja en cada request de su ruta.
 */
function guardar(valor: string) {
  const seguro = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE_AVISOS}=${valor}; path=/lealtad; max-age=${VIDA_COOKIE_AVISOS}; samesite=lax${seguro}`;
}

export default function AvisosCerrables({
  negocioId,
  avisos,
  ocultosIniciales,
}: {
  negocioId: string;
  avisos: AvisoCerrable[];
  /** Las claves que el servidor leyó de la cookie. */
  ocultosIniciales: string[];
}) {
  const [ocultos, setOcultos] = useState<string[]>(ocultosIniciales);

  if (avisos.length === 0) return null;

  const visibles = avisos.filter((a) => !ocultos.includes(a.clave));
  const cerrados = avisos.length - visibles.length;

  function cerrar(clave: string) {
    const valor = conAvisoCerrado(cookieActual(), negocioId, clave);
    guardar(valor);
    setOcultos(avisosOcultosDe(valor, negocioId));
  }

  function reabrir() {
    const valor = sinAvisosCerrados(cookieActual(), negocioId);
    guardar(valor);
    setOcultos(avisosOcultosDe(valor, negocioId));
  }

  return (
    <div className="space-y-3">
      {visibles.map((aviso) => (
        <div key={aviso.clave} className="relative">
          {aviso.nodo}
          <button
            type="button"
            onClick={() => cerrar(aviso.clave)}
            aria-label={`Cerrar «${aviso.etiqueta}»`}
            title="Cerrar y ver el tablero"
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white sm:right-3.5 sm:top-3.5"
          >
            <Icono nombre="cerrar" className="h-[17px] w-[17px]" />
          </button>
        </div>
      ))}

      {cerrados > 0 && (
        <button
          type="button"
          onClick={reabrir}
          className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-dashed px-4 py-2.5 text-left transition-colors hover:bg-white/[.04]"
          style={{ borderColor: "rgba(255,255,255,.16)" }}
        >
          <span className="text-[12.5px] text-white/45">
            {cerrados === 1
              ? "Cerraste 1 aviso de puesta en marcha"
              : `Cerraste ${cerrados} avisos de puesta en marcha`}
          </span>
          <span className="text-[12.5px] font-bold text-white/70">
            {cerrados === 1 ? "Volver a mostrarlo" : "Volver a mostrarlos"} →
          </span>
        </button>
      )}
    </div>
  );
}
