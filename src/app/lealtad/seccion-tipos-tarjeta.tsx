"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TIPOS_TARJETA_LISTA,
  TIPOS_TARJETA,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { tiposDelPlan, planQueDesbloquea } from "@/lib/lealtad/planes";
import { demoDe, rutaDeAfiliacion } from "@/lib/lealtad/demos-wallet";
import { FICHAS } from "./contenido-tipos";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";
import { MarcoIPhone, PantallaWallet } from "./telefono-mockup";

/**
 * ════════════════════════════════════════════════════════════════════
 *  «TIPOS DE TARJETAS» — el teléfono fijo, el pase que cambia
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 sep 2026): «a la derecha fijo un mockup de
 * teléfono que cambiaría el pase interior, y adaptá lo que hicimos
 * antes que le hicimos demo a cada tipo de tarjeta».
 *
 * Reemplaza a «¿Cómo funciona?», que eran tres pasos en un slider. Los
 * tres mockups de aquel slider (`MockupCreacion`, `MockupEscaneo`,
 * `MockupFidelidad`) y el propio `PasosSlider` siguen enteros en el
 * repo, solo dejaron de importarse — borrarlos es otra pasada y
 * necesita el visto bueno del dueño.
 *
 * ------------------------------------------------------------------
 * NADA DE ESTO ES CONTENIDO NUEVO
 * ------------------------------------------------------------------
 * Los ocho tipos salen de `lib/lealtad/tipos-tarjeta.ts`, los textos y
 * las paletas de `contenido-tipos.ts`, el negocio de demostración de
 * `lib/lealtad/demos-wallet.ts` y el teléfono de `telefono-mockup.tsx`.
 * Esta sección solo los acomoda: cada pieza ya existía y ya se usa en
 * el creador, así que elegir un tipo acá enseña exactamente lo que el
 * dueño de negocio va a ver cuando lo elija de verdad.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EL TELÉFONO ES `sticky` Y NO SOLO «LA COLUMNA DE LA DERECHA»
 * ------------------------------------------------------------------
 * La columna izquierda mide más que la pantalla: ocho filas y el
 * detalle del tipo elegido. Sin `sticky`, al bajar a leer la tercera
 * capacidad el teléfono ya se fue para arriba — y el teléfono ES el
 * argumento: la frase «mirá cómo le queda» no funciona si hay que
 * volver a subir para mirar. Con `sticky` el pase acompaña la lectura.
 *
 * Solo desde `lg`: abajo de eso las dos columnas se apilan y el
 * teléfono va primero, que es lo que se quiere ver en un teléfono.
 *
 * ------------------------------------------------------------------
 * EL CAMBIO DE PASE ES UN CROSS-FADE, NO UN CORTE
 * ------------------------------------------------------------------
 * Mismo patrón de fase con `setTimeout` que ya usan los otros mockups
 * de esta página. Sin él, cambiar de tipo hace parpadear ocho colores
 * distintos y se lee como un error de carga, no como una transición.
 * La duración (`--duracion-card`) y la curva (`--ease-bookea`) son las
 * del sistema; no hay una librería de motion nueva.
 */

/** Lo que tarda el pase viejo en irse antes de que entre el nuevo. */
const CRUCE_MS = 180;

export default function SeccionTiposTarjeta() {
  const [tipo, setTipo] = useState<TipoTarjeta>("sellos");
  const [visible, setVisible] = useState(true);
  const tiposGratis = tiposDelPlan("prueba");

  function elegir(siguiente: TipoTarjeta) {
    if (siguiente === tipo) return;
    setVisible(false);
    window.setTimeout(() => {
      setTipo(siguiente);
      setVisible(true);
    }, CRUCE_MS);
  }

  const def = TIPOS_TARJETA[tipo];
  const ficha = FICHAS[tipo];
  const demo = demoDe(tipo);
  const puedeDestacado = ficha.puede.slice(0, 3);

  return (
    <section id="tipos-de-tarjeta" className="scroll-mt-20 px-5 py-14 sm:px-8 lg:py-20">
      <div className="mx-auto w-full max-w-[1120px]">
        <div data-reveal className="mx-auto max-w-[54ch] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[color:var(--accion)]">
            Uno para cada negocio
          </p>
          <h2 className="titulo mx-auto mt-3 max-w-[16ch] text-[clamp(26px,3.6vw,40px)] leading-[1.08] text-aventurea-navy">
            Tipos de tarjetas
          </h2>
          <p className="mx-auto mt-2.5 text-[15px] leading-relaxed text-aventurea-ink-soft">
            Ocho formas de que tu cliente vuelva. Elegí una y mirá cómo le queda en el
            teléfono — es el mismo pase que va a llevar.
          </p>
        </div>

        {/* El teléfono va PRIMERO en el DOM y se manda a la derecha con
            `lg:order-2`. En móvil, donde las columnas se apilan, eso lo
            deja arriba: lo primero que se ve es el pase, no una lista
            de ocho nombres. */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-14">
          {/* ── EL TELÉFONO, FIJO ─────────────────────────────────── */}
          <div className="lg:order-2 lg:sticky lg:top-24">
            <div
              className="flex justify-center transition-opacity"
              style={{
                opacity: visible ? 1 : 0,
                transitionDuration: "var(--duracion-card)",
                transitionTimingFunction: "var(--ease-bookea)",
              }}
            >
              {/* El MISMO chasis de toda la página. `conBrillo` apagado:
                  el reflejo diagonal es un loop infinito y acá hay un
                  cross-fade encima — las dos animaciones sobre la misma
                  capa se pelean y el pase entra parpadeando. */}
              <MarcoIPhone ancho="w-[min(272px,78vw)]" conBrillo={false}>
                <PantallaWallet
                  negocio={ficha.negocio}
                  colores={ficha.colores}
                  arriba={ficha.arriba}
                  valor={ficha.valor}
                  abajo={ficha.abajo}
                  foto={ficha.foto}
                  sellos={def.id === "sellos" ? [7, 10] : undefined}
                  detalle={ficha.detalle}
                  movimientos={ficha.movimientos}
                />
              </MarcoIPhone>
            </div>

            {/* ── PROBARLA DE VERDAD ────────────────────────────────
                Debajo del teléfono y no en la columna de texto: es la
                acción sobre lo que se está mirando.

                Y es EL formulario, no una imitación: `/tarjeta/<slug>`
                es la misma pantalla a la que llega quien escanea el QR
                en el mostrador de un negocio de verdad. Detrás de cada
                tipo hay un negocio de demostración sembrado, así que el
                pase que baja funciona en el teléfono.

                Un solo enlace para los dos botones a propósito: cuál de
                los dos wallets corresponde lo decide la ficha del
                cliente mirando el dispositivo, y adelantarnos acá sería
                ofrecerle Apple Wallet a quien entra con un Android. */}
            {demo && (
              <div className="mt-5">
                {/* Los dos en UNA fila y a mitad de ancho cada uno:
                    con `flex-wrap` y texto largo se partían en dos
                    renglones y parecían dos acciones distintas, no
                    dos formas de hacer la misma.

                    Los íconos son los PNG de la lámina que pasó el
                    dueño (`referencia/wallet.png`), los mismos que
                    usa «¿Por qué implementarlo?». Antes acá iba
                    `google-pay.svg`, que es otro producto: Google
                    Pay paga, Google Wallet guarda el pase. */}
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href={rutaDeAfiliacion(demo)}
                    className="presionable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-black px-3 text-[12.5px] font-bold text-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- PNG
                        estático de marca a tamaño fijo. */}
                    <img src="/wallets/apple-wallet.png" alt="" aria-hidden width={18} height={18} className="h-[18px] w-[18px] shrink-0" />
                    Apple Wallet
                  </Link>
                  <Link
                    href={rutaDeAfiliacion(demo)}
                    className="presionable inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-aventurea-line bg-white px-3 text-[12.5px] font-bold text-aventurea-ink"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- ídem. */}
                    <img src="/wallets/google-wallet.png" alt="" aria-hidden width={18} height={18} className="h-[18px] w-[18px] shrink-0" />
                    Google Wallet
                  </Link>
                </div>
                <p className="mt-2.5 text-center text-[12px] leading-relaxed text-aventurea-ink-soft">
                  Probala de verdad: es el mismo formulario que llena tu cliente, con{" "}
                  <span className="font-bold text-aventurea-ink">{demo.nombre}</span> de ejemplo.
                </p>
              </div>
            )}
          </div>

          {/* ── LA COLUMNA QUE CAMBIA ─────────────────────────────── */}
          <div className="lg:order-1">
            {/* La lista: ocho filas en una sola card con divisores
                finos. Cada fila cambia el pase de la derecha — no es
                una lista pasiva. */}
            <div
              role="radiogroup"
              aria-label="Tipo de tarjeta"
              className="overflow-hidden rounded-2xl border border-aventurea-line bg-white"
            >
              {TIPOS_TARJETA_LISTA.map((t) => {
                const elegido = t.id === tipo;
                const gratis = tiposGratis.includes(t.id);
                const abre = !gratis ? planQueDesbloquea(t.id) : null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    onClick={() => elegir(t.id)}
                    // `onFocus` y no `onMouseEnter`: pasar el mouse por
                    // encima ya no cambia el pase. Con el teléfono fijo
                    // al lado, barrer la lista con el cursor disparaba
                    // ocho cross-fades seguidos y el pase quedaba
                    // parpadeando sin que nadie hubiera elegido nada.
                    onFocus={() => elegir(t.id)}
                    className={`flex w-full items-center gap-3 border-b border-aventurea-line px-4 py-3 text-left transition-colors last:border-b-0 ${
                      elegido ? "bg-[color:var(--accion-suave)]" : "hover:bg-aventurea-cream-2/60"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors"
                      style={{
                        background: elegido ? "var(--accion)" : "var(--accion-suave)",
                        color: elegido ? "var(--accion-tinta)" : "var(--accion-fuerte)",
                      }}
                    >
                      <Icono nombre={t.icono as NombreIcono} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-extrabold text-aventurea-navy">
                        {t.nombre}
                      </span>
                      <span className="block truncate text-[12px] text-aventurea-ink-soft">
                        {t.descripcion}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                        gratis
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[color:var(--accion-suave)] text-[color:var(--accion-fuerte)]"
                      }`}
                    >
                      {gratis ? "Gratis" : `Desde ${abre?.nombre}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* El detalle del tipo elegido, con el mismo cross-fade que
                el pase: los dos cambian juntos o parecen dos cosas
                distintas cambiando por su cuenta. */}
            <div
              className="mt-5 transition-opacity"
              style={{
                opacity: visible ? 1 : 0,
                transitionDuration: "var(--duracion-card)",
                transitionTimingFunction: "var(--ease-bookea)",
              }}
            >
              <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--accion)]">
                {def.nombre}
              </p>
              <h3 className="titulo mt-2 text-[21px] leading-tight text-aventurea-navy sm:text-[24px]">
                {ficha.gancho}
              </h3>
              <p className="mt-2 text-[13.5px] font-bold text-aventurea-ink-soft">
                {ficha.paraQuien}
              </p>

              <ul className="mt-5 flex flex-col gap-3.5">
                {puedeDestacado.map((c) => (
                  <li key={c.titulo} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                      style={{
                        background: "var(--accion-suave)",
                        color: "var(--accion-fuerte)",
                      }}
                    >
                      <Icono nombre={c.icono as NombreIcono} className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <p className="text-[13px] font-extrabold text-aventurea-navy">{c.titulo}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-aventurea-ink-soft">
                        {c.texto}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
