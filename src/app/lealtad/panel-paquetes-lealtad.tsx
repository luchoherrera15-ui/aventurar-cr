"use client";

import Link from "next/link";
import {
  PLANES_VIGENTES,
  PLAN_DESTACADO,
  precioDe,
  tiposDelPlan,
  planQueDesbloquea,
  etiquetaTiposDe,
  etiquetaNotificacionesDe,
  puede,
  ETIQUETAS_CAPACIDAD,
  type DefinicionPlan,
  type PlanId,
} from "@/lib/lealtad/planes";
import { TIPOS_TARJETA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { Icono } from "./panel/[id]/iconos";
import BotonVerTipos from "./boton-ver-tipos";

/**
 * MODO 2 — «al hacer clic en el botón se abren los paquetes que
 * ofrecemos para que vean lo que están creando y al crear gratis lo que
 * obtendrán luego».
 *
 * Los datos salen de `src/lib/lealtad/planes.ts` DEL LADO DEL CLIENTE,
 * igual que ya hacía `configurador-lealtad.tsx` hasta hoy — no de
 * `catalogoPublico()` traído por el servidor. No hay ninguna red de por
 * medio (es JS que ya viaja al cliente en este mismo módulo) y agregar
 * el viaje por `page.tsx` solo suma un archivo tocado y un prop más sin
 * ganar nada real. Si mañana esto se expone por HTTP a la app móvil, ahí
 * sí aplica el criterio de blindar "la última puerta antes de la red" —
 * hoy no hay puerta que blindar.
 *
 * Es una vista de SOLO LECTURA en cuanto a datos (nadie paga ni crea
 * cuenta acá) pero YA NO es de un solo CTA: cada card tiene su propio
 * botón «Elegir este paquete», porque el pedido del dueño fue textual
 * -«la idea es que ahí se escoja y de una vez la cuenta quede seteado
 * con el TIPO DE SUSCRIPCIÓN»-. Elegir una card guarda `planElegido` en
 * el estado del configurador (ver `configurador-lealtad.tsx`) y pasa a
 * Modo 3 — es cosmético nada más: el servidor sigue revalidando el
 * paquete real contra el TIPO de tarjeta elegido en Modo 1, nunca contra
 * este clic (ver el comentario de `tarjeta-formulario.tsx`).
 * Armar la tarjeta sigue siendo gratis siempre, sin importar qué card se
 * haya tocado acá; el único momento honesto para pedir plata sigue
 * siendo cuando la persona ya decidió publicar (la sección «Revisar y
 * crear» del editor, con el mismo aviso ámbar de siempre).
 */
export default function PanelPaquetesLealtad({
  tipoElegido,
  codigoReferido,
  alCambiarReferido,
  alSeguir,
}: {
  tipoElegido: TipoTarjeta;
  /** El código del moderador que refirió — vive en el estado del
   *  configurador (y su respaldo en sessionStorage), no acá, para
   *  sobrevivir la recarga del alta de cuenta. */
  codigoReferido: string;
  alCambiarReferido: (codigo: string) => void;
  alSeguir: (planId: PlanId) => void;
}) {
  const esGratis = tiposDelPlan("prueba").includes(tipoElegido);
  const planQueAbre = esGratis ? null : planQueDesbloquea(tipoElegido);
  const idResaltado = esGratis ? "prueba" : (planQueAbre?.id ?? null);

  return (
    <div className="p-4 lg:p-5">
      <h2 className="titulo text-[18px] text-bookea-tinta">Elegí tu paquete</h2>
      <p className="mt-0.5 text-[12px] text-bookea-gris">
        Armar tu tarjeta de {TIPOS_TARJETA[tipoElegido].nombre.toLowerCase()} es gratis con
        cualquiera de estos — vas a ver todo antes de crear cuenta.
      </p>

      {/* ── El código de referido, ARRIBA DE LAS CARDS ──────────────
          Pedido del dueño (30 ago 2026): capturarlo en el primer paso,
          «antes de armar nada».

          ⚠️ VA ANTES DE LA GRILLA Y NO DESPUÉS. Cada card tiene su
          propio botón que salta al editor de una: puesto debajo, en
          teléfono (una sola columna, con el paquete gratis arriba del
          todo) la persona toca «Empezar gratis» sin haber scrolleado
          nunca hasta el campo, y el alta sale sin agente que acreditar.

          El valor viaja con `solicitarAltaConPlan`, que lo valida
          contra `agentes_lealtad` — mismo campo que ya tiene el wizard
          de /lealtad/nuevo en «Revisar». */}
      <div className="mt-4 rounded-2xl border border-bookea-linea bg-bookea-fondo p-3.5">
        <label
          htmlFor="paquetes-referido"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris"
        >
          Código de referido (opcional)
        </label>
        <input
          id="paquetes-referido"
          value={codigoReferido}
          onChange={(e) => alCambiarReferido(e.target.value.toUpperCase())}
          placeholder="El código de tu agente"
          maxLength={24}
          autoCapitalize="characters"
          className="w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70 sm:max-w-[340px]"
        />
        <p className="mt-1.5 text-[12px] leading-snug text-bookea-gris">
          ¿Te atendió un agente o moderador de Bookea? Poné su código acá y tu cuenta queda
          asociada a esa persona.
        </p>
      </div>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {PLANES_VIGENTES.map((def) => (
          <TarjetaPlanLectura
            key={def.id}
            def={def}
            resaltado={def.id === idResaltado}
            onElegir={() => alSeguir(def.id)}
          />
        ))}
      </div>

      <SeccionConfianzaPago />

      <p className="mt-4 text-center text-[11.5px]">
        <Link href="/lealtad/planes" className="font-bold text-bookea-azul underline">
          Ver el detalle completo de los paquetes →
        </Link>
      </p>
    </div>
  );
}

/**
 * Las cuatro viñetas de cada card, FIJAS y en este orden — no genéricas
 * vía `etiquetasDeCapacidades().slice(0, 4)` como antes: desde que
 * "notificaciones" y "proyeccion_metricas" entraron al catálogo real
 * (0183), un `slice` de las primeras cuatro capacidades del array ya no
 * garantiza que el número de notificaciones o la distinción de
 * proyección aparezcan en pantalla, y esas dos son justo lo que el
 * dueño pidió exponer «bien, con sus detalles»: el cupo real por
 * paquete (1/1/20/50) y que Prueba/Starter NO llevan proyección de
 * crecimiento.
 *
 * Exportada porque `precios-landing.tsx` (la tabla de precios de la
 * portada) la reusa tal cual: dos curadurías de "qué viñeta mostrar"
 * para la misma lista de planes se desincronizan la primera vez que
 * alguien retoque una sola.
 */
export function bulletsDe(def: DefinicionPlan): string[] {
  return [
    etiquetaTiposDe(def),
    etiquetaNotificacionesDe(def),
    puede(def.id, "proyeccion_metricas")
      ? "Métricas con proyección de crecimiento"
      : "Métricas de altas, activos, sellos y canjes",
    ETIQUETAS_CAPACIDAD.wallet,
  ];
}

function TarjetaPlanLectura({
  def,
  resaltado,
  onElegir,
}: {
  def: DefinicionPlan;
  resaltado: boolean;
  onElegir: () => void;
}) {
  const precio = precioDe(def);
  const esGratis = def.precioMensual === 0;
  const destacado = def.id === PLAN_DESTACADO;
  const beneficios = bulletsDe(def);
  // El botón se destaca (relleno, acento) en la card resaltada por el
  // tipo elegido en Modo 1 y en la más popular — en las otras dos va en
  // contorno, para que las 4 cards no compitan todas por el mismo
  // primer plano visual.
  const botonDestacado = resaltado || destacado;

  return (
    // La card ENTERA se anima al pasar el mouse (pedido del rediseño
    // SaaS): crece un poco, se levanta y gana sombra — `hover:z-10`
    // para que al agrandarse pase por ENCIMA de sus vecinas y no se
    // recorte contra ellas. `will-change-transform` mantiene el texto
    // nítido durante la transición de escala.
    <div
      className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-300 ease-out will-change-transform hover:z-10 hover:-translate-y-1.5 hover:scale-[1.045] hover:shadow-[0_26px_60px_-20px_rgba(15,40,90,0.35)] ${
        resaltado
          ? "border-bookea-azul bg-bookea-azul-suave"
          : destacado
            ? "border-bookea-linea bg-bookea-fondo hover:border-bookea-azul/50"
            : "border-bookea-linea bg-white hover:border-bookea-azul/50"
      }`}
    >
      {resaltado ? (
        <span
          className="mb-2 self-start rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          Con lo que elegiste
        </span>
      ) : destacado ? (
        // El punto verde "en vivo" —mismo tono que el de la barra de
        // "Armá tu tarjeta acá mismo" (configurador-lealtad.tsx)— llama
        // la atención sin competir con el naranja de la píldora.
        <span className="mb-2 flex w-fit items-center gap-1.5 self-start rounded-full bg-orange-50 py-1 pl-2 pr-2.5 text-[10px] font-extrabold uppercase tracking-wide text-orange-700">
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: "#20ae74" }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "#20ae74" }} />
          </span>
          El más popular
        </span>
      ) : (
        <span className="mb-2 h-[21px]" aria-hidden />
      )}

      <h3 className="text-[15px] font-extrabold text-bookea-tinta">{def.nombre}</h3>
      <p className="mt-1 text-[20px] font-extrabold leading-none text-bookea-tinta">
        {precio === null ? "A convenir" : esGratis ? "Gratis" : precio}
        {!esGratis && precio !== null && (
          <span className="text-[11.5px] font-bold text-bookea-gris"> /mes</span>
        )}
      </p>

      <ul className="mt-3.5 flex-1 space-y-1.5">
        {beneficios.map((b, i) => (
          <li key={b} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-bookea-gris">
            <Icono nombre="listo" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bookea-azul" />
            <span>
              {b}
              {i === 0 && <BotonVerTipos tipos={def.tipos} />}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onElegir}
        className={`presionable mt-4 w-full rounded-full px-3 py-3 text-[12.5px] font-extrabold ${
          botonDestacado ? "" : "border border-bookea-linea text-bookea-azul"
        }`}
        style={botonDestacado ? { background: "var(--accion)", color: "var(--accion-tinta)" } : undefined}
      >
        {esGratis ? "Empezar gratis y personalizar →" : `Elegir ${def.nombre} →`}
      </button>
    </div>
  );
}

/**
 * La respuesta a «¿y con qué pago?»: tarjeta (más wallets del
 * dispositivo) o SINPE/transferencia a mano.
 *
 * Con LOGOS de marca desde ago 2026 (pedido del dueño): Visa,
 * Mastercard, Amex, Apple Pay y Google Pay como SVG oficiales en
 * `public/pagos/` (marcas de aceptación — el uso estándar de una
 * página de cobro). Stripe procesa pero su logo NO va (pedido
 * textual); SINPE Móvil se queda como chip de texto porque no hay una
 * marca de aceptación oficial que mostrar.
 *
 * Apple Pay y Google Pay SÍ se prometen: el checkout de Stripe que ya
 * usa Lealtad (`checkout.ts`, `mode: "subscription"`) es el Checkout
 * hospedado sin `payment_method_types` fijado a solo tarjeta, así que
 * activa wallets del navegador/OS solas — por eso el copy dice «según
 * tu dispositivo» y no lo garantiza a ciegas.
 */
const LOGOS_PAGO: { archivo: string; nombre: string }[] = [
  { archivo: "visa.svg", nombre: "Visa" },
  { archivo: "mastercard.svg", nombre: "Mastercard" },
  { archivo: "amex.svg", nombre: "American Express" },
  { archivo: "apple-pay.svg", nombre: "Apple Pay" },
  { archivo: "google-pay.svg", nombre: "Google Pay" },
];

function SeccionConfianzaPago() {
  return (
    <div className="mt-5 rounded-2xl border border-bookea-linea bg-bookea-fondo p-3.5">
      <p className="text-[12.5px] font-extrabold text-bookea-tinta">
        Pagás como prefieras, siempre seguro
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-bookea-gris">
        Con tarjeta —Visa, Mastercard, American Express, Apple Pay o Google Pay según tu
        dispositivo—, 100&nbsp;% cifrado y seguro. ¿Preferís depositar? También podés pagar por
        transferencia SINPE Móvil: subís el comprobante y activamos tu paquete apenas lo
        confirmamos.
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-bookea-tinta">
        <Icono nombre="listo" className="h-3.5 w-3.5 shrink-0 text-bookea-azul" />
        100&nbsp;% seguro, sin guardar tu tarjeta en Bookea
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {LOGOS_PAGO.map((l) => (
          <span
            key={l.archivo}
            className="flex h-8 items-center rounded-lg border border-bookea-linea bg-white px-2.5"
            title={l.nombre}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- SVGs
                estáticos de marca; next/image no aporta nada acá. */}
            <img src={`/pagos/${l.archivo}`} alt={l.nombre} className="h-4 w-auto" loading="lazy" />
          </span>
        ))}
        <span className="flex h-8 items-center rounded-lg border border-bookea-linea bg-white px-2.5 text-[10.5px] font-extrabold text-bookea-tinta">
          SINPE Móvil
        </span>
      </div>
    </div>
  );
}
