"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FormularioSolicitud, {
  type DatosPago,
  type NegocioElegible,
} from "./formulario-solicitud";
import { grillaDePaquetes } from "@/lib/lealtad/grilla-paquetes";

/**
 * Las tarjetas de los tres paquetes. Elegir una abre el paso de
 * solicitud EN UNA VENTANA sobre la grilla — el "proceso de compra" no
 * navega a ningún lado: pasa acá mismo.
 *
 * Antes el formulario se montaba DEBAJO de la grilla y empujaba la
 * página hacia abajo: había que scrollear para encontrarlo y, ya
 * escribiendo, el paquete elegido quedaba fuera de pantalla. Ahora es
 * un diálogo: la grilla se queda quieta detrás, atenuada, con la
 * tarjeta elegida marcada.
 *
 * Sin precios a la vista A PROPÓSITO: el precio lo confirma Bookea al
 * contactar (y no está definido en el producto todavía — inventarlo
 * acá sería peor que no mostrarlo).
 */

/**
 * Esta pantalla entera vive sobre navy profundo (`planes/page.tsx`), y
 * eso decide el par de color: el azul de acción de fondo claro da
 * 1,44:1 acá y desaparecería. Todos los botones usan el par OSCURO
 * —relleno claro, letra navy—, y el naranja queda solo en las dos
 * piezas que marcan lo que se gana: la insignia del plan destacado y
 * la palomita de cada beneficio.
 */
const BOTON_ACCION =
  "bg-[color:var(--accion-claro)] text-[color:var(--accion-claro-tinta)] hover:bg-[color:var(--accion-claro-hover)]";

/**
 * El diálogo se pinta con el MISMO navy del fondo de la pantalla
 * (`NAVY_PROFUNDO` en planes/page.tsx). Va como literal y no como token
 * porque es una superficie de página, no un color semántico — igual que
 * en page.tsx y que en burbuja-contacto.tsx. Y va OPACO porque debajo
 * queda la grilla: con un fondo translúcido las tarjetas se leerían a
 * través del formulario.
 *
 * Elegir exactamente ese navy tiene una segunda razón, práctica: el
 * formulario se pinta con blancos translúcidos, así que dentro del
 * diálogo compone contra el mismo color contra el que componía suelto
 * debajo de la grilla. Ni un contraste del formulario cambia al mudarse.
 */
const NAVY_DIALOGO = "#0a1226";

/** Lo que el navegador considera una parada de tabulación. */
const FOCOSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export type TarjetaPlan = {
  id: string;
  nombre: string;
  limite: number | null;
  /**
   * Ya formateado con su símbolo por `precioDe()`. String y no número
   * a propósito: el catálogo tiene planes en dólares y planes viejos
   * en colones (0133), y una pantalla que reciba `9.99` no tiene cómo
   * saber cuál es — pintaría «₡9,99».
   * null = a convenir.
   */
  precio: string | null;
  esGratis: boolean;
  /** El precio va en dólares pero el depósito SINPE se hace en colones. */
  enDolares: boolean;
  beneficios: string[];
  destacado: boolean;
};

export default function PlanesCliente({
  planes,
  negocios,
  negocioInicial,
  conSesion,
  pago,
  conTarjeta,
}: {
  planes: TarjetaPlan[];
  negocios: NegocioElegible[];
  negocioInicial: string | null;
  conSesion: boolean;
  pago: DatosPago;
  /**
   * Qué paquetes se pueden pagar con tarjeta y con qué períodos. Lo
   * calcula el servidor leyendo las variables STRIPE_PRICE_… — lista
   * vacía = no hay Stripe y esta pantalla es la de siempre, solo SINPE.
   */
  conTarjeta: { plan: string; periodos: string[] }[];
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const plan = planes.find((p) => p.id === elegido) ?? null;
  const periodosConTarjeta = plan
    ? (conTarjeta.find((c) => c.plan === plan.id)?.periodos ?? [])
    : [];

  const raiz = useRef<HTMLDivElement>(null);
  /** El botón de cada paquete, para devolverle el foco al cerrar. */
  const disparadores = useRef<Map<string, HTMLButtonElement>>(new Map());
  const ultimoAbierto = useRef<string | null>(null);
  const [destinoPortal, setDestinoPortal] = useState<HTMLElement | null>(null);

  /**
   * DÓNDE SE MONTA EL DIÁLOGO, Y POR QUÉ NO ES DONDE LO ESCRIBIMOS.
   *
   * Un `fixed inset-0` deja de ser "toda la pantalla" apenas un
   * ancestro crea un CONTEXTO DE APILADO — y en este repo eso ya pasó:
   * la utilidad `organico` trae `isolation: isolate`, y por eso la hoja
   * del buscador quedaba tapada por las secciones de abajo por más
   * z-index que tuviera (ver `HojaPortal` en components/buscador-home).
   * Hoy la cadena de /lealtad/planes está limpia, pero la pantalla vive
   * dentro del módulo que usa `organico` en su landing: portarlo no
   * cuesta nada y deja el diálogo inmune a que mañana alguien envuelva
   * la grilla en una sección con fondo.
   *
   * Ahora bien: el destino NO es `document.body`. Lealtad re-declara
   * sus siete variables de color y su tipografía en el contenedor
   * `.lealtad` (layout.tsx + globals.css); portar a `body` sacaría el
   * diálogo de ese scope y los botones perderían `--accion-claro`
   * —quedarían sin relleno— y la letra volvería a Figtree. Así que se
   * porta al contenedor `.lealtad` más cercano, que está por ENCIMA de
   * cualquier sección que pueda aislarse y por DEBAJO del scope de
   * color. Sin `.lealtad` (si esto se reusara fuera del módulo) cae a
   * `body`, que es el comportamiento clásico.
   *
   * En un efecto y no en el render: `document` no existe en el
   * servidor, y el diálogo arranca cerrado, así que el render de más no
   * se ve.
   */
  useEffect(() => {
    setDestinoPortal(raiz.current?.closest<HTMLElement>(".lealtad") ?? document.body);
  }, []);

  const cerrar = useCallback(() => setElegido(null), []);

  /**
   * Al cerrar, el foco vuelve al botón del paquete que abrió el
   * diálogo. Se hace acá y no dentro del diálogo porque este efecto
   * corre DESPUÉS de que React lo desmontó: si se llamara antes,
   * el navegador movería el foco al `body` justo después.
   */
  useEffect(() => {
    if (elegido) {
      ultimoAbierto.current = elegido;
      return;
    }
    const previo = ultimoAbierto.current;
    ultimoAbierto.current = null;
    if (previo) disparadores.current.get(previo)?.focus();
  }, [elegido]);

  return (
    <div ref={raiz}>
      {/* Las columnas siguen a la cantidad de paquetes (ver
          `grillaDePaquetes`): con un número fijo, retirar uno deja
          una columna vacía y descentra la grilla entera. */}
      <div className={`gap-4 ${grillaDePaquetes(planes.length)}`}>
        {planes.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-2xl border p-5"
            style={{
              background: p.destacado ? "rgba(157,180,255,.14)" : "rgba(255,255,255,.045)",
              borderColor: p.destacado ? "rgba(157,180,255,.45)" : "rgba(255,255,255,.12)",
            }}
          >
            {/* «El más popular» y no «el más completo»: el destacado es
                el del medio, y el más completo es el de arriba. */}
            {p.destacado && (
              <span
                className="mb-2 self-start rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: "var(--orange)", color: "#0a1226" }}
              >
                El más popular
              </span>
            )}
            <h2 className="text-[18px] font-extrabold text-white">{p.nombre}</h2>
            <p className="mt-1 text-[26px] font-extrabold leading-none text-white">
              {p.precio === null ? (
                "A convenir"
              ) : p.esGratis ? (
                "Gratis"
              ) : (
                <>
                  {p.precio}
                  <span className="text-[13px] font-bold text-white/50"> /mes</span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-[12.5px] text-white/55">
              {/* El «Hasta» solo tiene sentido con un número detrás:
                  «Hasta miembros ilimitados» no se entiende. Sin tope,
                  la frase entera cambia. */}
              {p.limite === null
                ? "Miembros ilimitados"
                : `Hasta ${p.limite.toLocaleString("es-CR")} miembros`}
            </p>

            <ul className="mt-3 flex-1 space-y-1.5">
              {p.beneficios.map((b) => (
                <li key={b} className="flex gap-2 text-[12.5px] leading-snug text-white/75">
                  <span style={{ color: "var(--orange)" }} aria-hidden>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            {/* ── A DÓNDE LLEVA TOCAR UN PAQUETE ──────────────────
                Pedido del dueño (1 sep 2026): «que lo lleve directo
                a donde se comienza el proceso de creación de la
                tarjeta».

                Quien NO tiene ningún negocio va derecho a
                `/lealtad/crear` — sin sesión también, porque el
                creador funciona sin cuenta («mirala en el teléfono
                antes de crear cuenta»). Antes había DOS barreras
                antes de ver nada: sin sesión mandaba a registrarse,
                y con sesión abría un diálogo donde el enlace al
                creador era una tarjeta más adentro.

                ⚠️ QUIEN YA TIENE NEGOCIOS SIGUE VIENDO EL DIÁLOGO, y
                   no es un olvido: ese botón para él significa
                   «subir de paquete», y ahí hay que elegir a CUÁL de
                   sus negocios y pagar. Mandarlo al creador le
                   armaría un segundo negocio que no pidió. */}
            {negocios.length === 0 ? (
              <Link
                href={`/lealtad/crear?plan=${p.id}`}
                className={`mt-4 rounded-xl px-4 py-3 text-center text-[13.5px] font-extrabold ${BOTON_ACCION}`}
              >
                {p.esGratis ? "Empezar gratis" : "Llevar este plan"}
              </Link>
            ) : conSesion ? (
              /* El relleno blanco marca cuál está elegido mientras el
                 diálogo está abierto: la grilla se ve atenuada detrás y
                 así se sabe de un vistazo sobre cuál se está trabajando.
                 Ya no dice «Elegido ↓»: no hay nada abajo que mirar. */
              <button
                type="button"
                ref={(el) => {
                  if (el) disparadores.current.set(p.id, el);
                  else disparadores.current.delete(p.id);
                }}
                onClick={() => setElegido(p.id)}
                aria-haspopup="dialog"
                aria-expanded={elegido === p.id}
                className={`mt-4 rounded-xl px-4 py-3 text-[13.5px] font-extrabold transition-colors ${
                  elegido === p.id ? "bg-white text-[#0a1226]" : BOTON_ACCION
                }`}
              >
                {p.esGratis
                  ? "Empezar gratis"
                  : conTarjeta.some((c) => c.plan === p.id)
                    ? "Llevar este plan"
                    : "Solicitar este plan"}
              </button>
            ) : (
              <Link
                href="/cuenta?volver=lealtad"
                className={`mt-4 rounded-xl px-4 py-3 text-center text-[13.5px] font-extrabold ${BOTON_ACCION}`}
              >
                Entrá para solicitarlo
              </Link>
            )}
          </div>
        ))}
      </div>

      {plan &&
        conSesion &&
        destinoPortal &&
        createPortal(
          <DialogoPaquete key={plan.id} paquete={plan.nombre} alCerrar={cerrar}>
            {/* ── NEGOCIO NUEVO: el configurador de la primera tarjeta ──
                Quien todavía no tiene nada en Bookea puede armar la
                tarjeta COMPLETA (tipo, beneficio, colores, vista previa)
                en /lealtad/crear con el paquete ya elegido (0163: antes
                mandaba a /lealtad/nuevo, el wizard viejo — se dejó de
                enlazar en todo el sitio, sigue vivo sin enlaces). El
                formulario de abajo sigue intacto: con tarjeta se paga
                primero y el configurador espera del otro lado del
                cobro; con SINPE la solicitud es la de siempre.

                Viaja DENTRO del diálogo desde que el formulario dejó de
                montarse debajo de la grilla: suelto en la página quedaba
                detrás del velo, visible pero imposible de tocar. */}
            {negocios.length === 0 && (
              <div className="rounded-2xl border border-white/15 bg-white/[.06] p-4">
                <p className="text-[13.5px] font-extrabold text-white">
                  ¿Negocio nuevo? Armá tu tarjeta de una vez
                </p>
                <p className="mt-1 max-w-[520px] text-[12.5px] leading-snug text-white/65">
                  Elegís el tipo de tarjeta, el beneficio y tus colores viendo la tarjeta
                  mientras la armás{plan.esGratis ? " — sin pagar nada" : ""}.
                </p>
                <Link
                  href={`/lealtad/crear?plan=${plan.id}`}
                  className={`mt-3 inline-block rounded-xl px-4 py-2.5 text-[13px] font-extrabold ${BOTON_ACCION}`}
                >
                  Armar mi tarjeta con {plan.nombre} →
                </Link>
              </div>
            )}

            <FormularioSolicitud
              plan={plan.id}
              planNombre={plan.nombre}
              precio={plan.precio}
              esGratis={plan.esGratis}
              enDolares={plan.enDolares}
              negocios={negocios}
              negocioInicial={negocioInicial}
              pago={pago}
              periodosConTarjeta={periodosConTarjeta}
              alCerrar={cerrar}
            />
          </DialogoPaquete>,
          destinoPortal,
        )}
    </div>
  );
}

/**
 * LA VENTANA DE COMPRA.
 *
 * Diálogo modal de verdad, no una capa que solo tapa: cierra con
 * Escape, con el velo y con el «Cancelar» del formulario; bloquea el
 * scroll de la página de atrás; y ATRAPA el foco adentro — sin la
 * trampa, el siguiente Tab se va a la grilla que el velo solo tapa a la
 * vista, y se termina escribiendo en un formulario que no se ve.
 *
 * En teléfono es una hoja pegada abajo y casi a pantalla completa: el
 * formulario de solicitud es largo y en 390 px una ventanita centrada
 * no da. El scroll es SUYO (`max-h` + `overflow-y-auto`), así que lo
 * que se mueve es el contenido del diálogo y no la página de atrás.
 */
function DialogoPaquete({
  paquete,
  alCerrar,
  children,
}: {
  paquete: string;
  alCerrar: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cuerpo = document.body;
    const overflowPrevio = cuerpo.style.overflow;
    cuerpo.style.overflow = "hidden";

    // El foco entra al panel, no a un campo: cuál es el primer control
    // útil depende del paquete (con tarjeta es un botón de pago, sin
    // tarjeta es el selector de negocio), y aterrizar en el panel deja
    // que la lectura de pantalla anuncie el diálogo —su nombre y su
    // contenido— antes de que nada se mueva.
    const nodo = panel.current;
    nodo?.focus();

    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        alCerrar();
        return;
      }
      if (e.key !== "Tab" || !nodo) return;

      // `offsetParent === null` deja fuera lo que está dentro del
      // plegable de SINPE cuando está cerrado: el navegador lo esconde
      // con display:none pero sigue en el DOM, y sin este filtro el Tab
      // saltaría a campos invisibles.
      const paradas = Array.from(nodo.querySelectorAll<HTMLElement>(FOCOSABLES)).filter(
        (el) => el.offsetParent !== null,
      );
      if (paradas.length === 0) {
        e.preventDefault();
        return;
      }
      const primero = paradas[0];
      const ultimo = paradas[paradas.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === nodo)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alTeclado);
    return () => {
      // También al desmontar por cualquier otra vía: si el scroll
      // quedara bloqueado, la página de atrás se vuelve inservible.
      cuerpo.style.overflow = overflowPrevio;
      document.removeEventListener("keydown", alTeclado);
    };
  }, [alCerrar]);

  return (
    <div
      role="presentation"
      /* `pointerdown` y no `click`: seleccionando texto de un campo se
         suelta el botón fuera del panel a cada rato, y con `click` eso
         cerraba el diálogo en medio de escribir. */
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
      className="anim-velo-entrar fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-[2px] sm:items-center sm:p-6"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Solicitar el paquete ${paquete}`}
        tabIndex={-1}
        /* El borde va al 25 % y no al 15 % de la casa: sobre el velo
           casi negro, un navy contra otro navy da 1,09:1 y el canto del
           panel desaparece. Ningún azul de la paleta arregla eso —para
           llegar a 3:1 contra el velo haría falta una luminancia de
           0,110, o sea un gris medio—, así que lo que separa el diálogo
           del fondo es este canto, la sombra y el desenfoque, no el
           relleno. Subirlo al 25 % lleva la línea de 1,43:1 a 2,08:1
           contra el fondo atenuado sin que parezca un marco. */
        className="anim-panel-entrar sobre-oscuro flex max-h-[92svh] w-full flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-3xl border border-white/25 p-3 shadow-2xl sm:max-h-[86svh] sm:max-w-[560px] sm:rounded-3xl sm:p-5"
        style={{ background: NAVY_DIALOGO }}
      >
        {children}
      </div>
    </div>
  );
}
