"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTieneMouse } from "@/lib/use-movimiento-reducido";
import { TIPOS_TARJETA_LISTA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { Icono, type NombreIcono } from "@/app/lealtad/panel/[id]/iconos";
import TelefonoMockup, { PantallaWallet } from "./telefono-mockup";
import { FICHAS } from "./contenido-tipos";

/**
 * LOS OCHO TIPOS DE PASE: fila de pestañas + un panel que cambia.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO ES UN ACORDEÓN HORIZONTAL
 * ------------------------------------------------------------------
 * Lo fue, y se veía mal. Ocho columnas de 92px que solo caben un icono
 * dejan siete cajas altas y vacías al lado de la abierta: parecen
 * bloques rotos, no opciones. Y como todas se ven iguales, no invitan
 * a tocarlas.
 *
 * Acá las ocho pestañas son legibles —icono Y nombre— y ocupan una
 * franja baja. Debajo, UN panel grande con el pase. Nada queda a medio
 * mostrar, y cambiar de tipo es un fundido, no un acordeón abriéndose
 * a los tirones.
 *
 * ------------------------------------------------------------------
 * CADA TIPO TIENE SU PROPIO NEGOCIO
 * ------------------------------------------------------------------
 * Antes los ocho pases decían «Café La Esquina» sobre el mismo navy, y
 * el conjunto se leía como la misma tarjeta ocho veces. Ahora cada
 * mecánica se muestra con el negocio al que de verdad le sirve —el
 * gimnasio para membresía, el rancho para entradas— y con su color.
 * Ocho tarjetas distintas cuentan la variedad; ocho iguales la niegan.
 */

const NARANJA = "#ee7420";

export default function AcordeonTipos() {
  const [activo, setActivo] = useState<TipoTarjeta>("sellos");
  const conMouse = useTieneMouse();
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const espera = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (espera.current) window.clearTimeout(espera.current);
    };
  }, []);

  /**
   * Al pasar el mouse, con 110 ms de respiro.
   *
   * Sin ese respiro, cruzar la fila de pestañas dispara ocho cambios de
   * panel al paso — el contenido parpadea y no se alcanza a leer nada.
   * Con él, pasar de largo no cambia nada; detenerse, sí.
   */
  function alEntrar(id: TipoTarjeta) {
    if (!conMouse) return;
    if (espera.current) window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => setActivo(id), 110);
  }

  function alSalir() {
    if (espera.current) window.clearTimeout(espera.current);
  }

  const indice = TIPOS_TARJETA_LISTA.findIndex((t) => t.id === activo);

  function alTeclado(e: React.KeyboardEvent) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const i = (indice + delta + TIPOS_TARJETA_LISTA.length) % TIPOS_TARJETA_LISTA.length;
    setActivo(TIPOS_TARJETA_LISTA[i].id);
    botones.current[i]?.focus();
  }

  const ficha = FICHAS[activo];
  const def = TIPOS_TARJETA_LISTA[indice];

  return (
    <div>
      {/* ── Las ocho pestañas ─────────────────────────────────────
          ANTES SE DESLIZABA, Y ESTABA MAL.

          Era `overflow-x-auto` con la barra de desplazamiento ESCONDIDA
          (`scrollbar-width:none` y el `::-webkit-scrollbar` en display
          none). En el teléfono se veían cuatro chips y un borde: cero
          señal de que hubiera cuatro más. El dueño lo reportó como «queda
          cortado y no se desliza» — y las dos mitades son ciertas. Sí
          deslizaba; nada le decía que se podía.

          La salida no es ponerle una flecha ni devolverle la barra: es que
          NO HAGA FALTA DESLIZAR. Ocho chips cortos entran en dos o tres
          filas hasta en 320px, y ahí no hay nada que descubrir — las ocho
          opciones se ven a la vez, que es lo que un selector tiene que
          hacer.

          De paso se van el `-mx-5 px-5`: ese truco existía solo para que
          la franja sangrara al borde de la pantalla. Sin deslizamiento no
          tiene sentido, y era justo el par que desbordaba el viewport. */}
      <div
        role="tablist"
        aria-label="Tipos de pase"
        onKeyDown={alTeclado}
        onMouseLeave={alSalir}
        className="flex flex-wrap justify-center gap-2"
      >
        {TIPOS_TARJETA_LISTA.map((tipo, i) => {
          const esta = tipo.id === activo;
          return (
            <button
              key={tipo.id}
              ref={(el) => {
                botones.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={esta}
              tabIndex={esta ? 0 : -1}
              onMouseEnter={() => alEntrar(tipo.id)}
              onClick={() => setActivo(tipo.id)}
              className="presionable flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[13.5px] font-bold transition-colors duration-300"
              style={{
                background: esta ? NARANJA : "rgba(255,255,255,.04)",
                borderColor: esta ? NARANJA : "rgba(255,255,255,.12)",
                color: esta ? "#0a1226" : "rgba(255,255,255,.72)",
              }}
            >
              <Icono nombre={tipo.icono as NombreIcono} className="h-[17px] w-[17px]" />
              {tipo.nombre}
            </button>
          );
        })}
      </div>

      {/* ── El panel ──────────────────────────────────────────────
          `key={activo}` reinicia la animación de entrada en cada
          cambio: sin eso React reusa el nodo, no hay montaje, y el
          contenido salta de golpe en vez de aparecer. */}
      {/* El fondo orgánico va en el BOX COMPLETO, no en la tarjeta: las
          manchas necesitan área para respirar. En 230px se veían como
          un degradado apretado; acá tiñen la sección entera con el
          color del tipo elegido, y cambian cuando cambia la pestaña. */}
      <div
        key={activo}
        className="organico entra-suave mt-8 rounded-[32px] border border-white/10 p-6 sm:p-10"
        style={
          {
            background: "#0d1730",
            "--c1": `${ficha.colores[0]}cc`,
            "--c2": `${ficha.colores[1]}99`,
            "--c3": `${ficha.colores[2]}66`,
          } as React.CSSProperties
        }
      >
        <div className="flex flex-wrap items-start gap-8 lg:flex-nowrap lg:gap-12">
          <div className="mx-auto shrink-0 lg:mx-0">
            {/* `key` para que los sellos vuelvan a animarse en cada
                cambio de pestaña: sin él React reusa los nodos, no hay
                montaje, y la tarjeta nueva aparece ya completa. */}
            <TelefonoMockup key={activo}>
              <PantallaWallet
                negocio={ficha.negocio}
                colores={ficha.colores}
                arriba={ficha.arriba}
                valor={ficha.valor}
                abajo={ficha.abajo}
                foto={ficha.foto}
                detalle={ficha.detalle}
                movimientos={ficha.movimientos}
                sellos={activo === "sellos" ? [7, 10] : undefined}
              />
            </TelefonoMockup>
          </div>

          {/* `min-w` con `min(280px,100%)` y no `280px` a secas.
              El 280 está para FORZAR EL SALTO: mientras no quepa al
              lado del teléfono, la columna se baja entera en vez de
              espicharse a un renglón por palabra.

              Pero un mínimo fijo no se puede achicar cuando ni el
              contenedor llega a 280 —en 320px la caja del panel da
              232— y entonces la columna sobresalía 27px, que el
              `overflow:hidden` de `.organico` recortaba: título y
              párrafos cortados por la derecha.

              `min(280px,100%)` conserva el salto donde hay lugar y se
              rinde al ancho del panel donde no lo hay. */}
          <div className="min-w-[min(280px,100%)] flex-1">
            <h3 className="text-[26px] font-extrabold leading-tight text-white">
              {def.nombre}
            </h3>
            <p className="mt-2 text-[15.5px] leading-relaxed text-white/70">{ficha.gancho}</p>
            <p className="mt-1.5 text-[13px] text-white/40">{ficha.paraQuien}</p>

            {/* Grilla y no lista: seis capacidades en una columna dejan
                media caja vacía al lado del teléfono. En dos columnas
                el bloque llena el ancho y se lee de a pares. */}
            <div className="mt-7 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {ficha.puede.map((c) => (
                <div key={c.titulo} className="flex gap-3">
                  <span
                    className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: "rgba(238,116,32,.13)", color: NARANJA }}
                  >
                    <Icono nombre={c.icono} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-extrabold leading-snug text-white">
                      {c.titulo}
                    </span>
                    <span className="mt-1 block text-[12.5px] leading-snug text-white/55">
                      {c.texto}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/lealtad/nuevo"
              className="presionable mt-8 inline-block rounded-full px-6 py-3 text-[14px] font-extrabold"
              style={{ background: NARANJA, color: "#0a1226" }}
            >
              Armar mi {def.nombre.toLowerCase()} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
