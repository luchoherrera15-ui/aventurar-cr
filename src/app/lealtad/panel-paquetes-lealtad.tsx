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
import { grillaDePaquetes } from "@/lib/lealtad/grilla-paquetes";

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
    <div className="p-5 sm:px-7 sm:py-5">
      <span className="inline-flex rounded-full bg-bookea-azul-suave px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-bookea-azul">
        Paso 1 · Elegí tu plan
      </span>
      <h2 className="titulo mt-2 text-[26px] leading-tight text-bookea-tinta">
        Empezá con el plan que te sirva hoy
      </h2>
      <p className="mt-1.5 text-[13px] text-bookea-gris">
        Armar tu tarjeta de {TIPOS_TARJETA[tipoElegido].nombre.toLowerCase()} es gratis con
        cualquiera, y podés cambiar de plan cuando quieras.
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
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-bookea-linea bg-bookea-fondo px-3.5 py-2.5">
        <label htmlFor="paquetes-referido" className="text-[12.5px] font-bold text-bookea-tinta">
          ¿Te atendió un agente de Bookea?
        </label>
        <input
          id="paquetes-referido"
          value={codigoReferido}
          onChange={(e) => alCambiarReferido(e.target.value.toUpperCase())}
          placeholder="Su código (opcional)"
          maxLength={24}
          autoCapitalize="characters"
          className="min-w-0 flex-1 rounded-xl border border-bookea-linea bg-white px-3 py-2 text-[13px] text-bookea-tinta placeholder:text-bookea-gris/70 sm:max-w-[260px]"
        />
      </div>

      {/* Ídem: las columnas salen del catálogo (`grillaDePaquetes`). */}
      <div className={`mt-4 gap-3.5 ${grillaDePaquetes(PLANES_VIGENTES.length)}`}>
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
    /* ⚠️ SIN `scale` Y SIN `will-change`: ASÍ SE VEÍA BORROSO.

       Acá había `hover:scale-[1.045]` junto a `will-change-transform`,
       con un comentario que afirmaba que el `will-change` "mantiene el
       texto nítido". Es exactamente al revés, y está documentado en el
       sistema de diseño del repo: `will-change` sube el elemento a su
       propia capa, el navegador la rasteriza UNA vez a tamaño 1× y
       escalarla después estira esos píxeles — el texto se nubla. Y como
       el `will-change` era permanente (no solo en hover), las cuatro
       tarjetas vivían siempre en una capa aparte: por eso los paquetes
       se veían sin filo incluso sin pasar el mouse.

       El realce ahora lo hace `elevar` (globals.css), que es el patrón
       del sistema para esto: sube 3 px y gana sombra, con la duración y
       la curva del repo. Se levanta igual y el texto queda nítido. */
    <div
      /* Borde de 1,5 px y no 1: a cuatro tarjetas juntas, un borde de
         un píxel se pierde y las columnas dejan de leerse separadas.
         El elegido lleva 2 px, que es lo que lo hace saltar sin
         necesidad de otro color de fondo. */
      className={`elevar relative flex flex-col rounded-[18px] p-5 hover:z-10 ${
        resaltado
          ? "border-2 border-bookea-azul bg-white shadow-[0_18px_40px_-24px_rgba(15,40,90,.4)]"
          : destacado
            ? "border-[1.5px] border-orange-200 bg-white"
            : "border-[1.5px] border-bookea-linea bg-white hover:border-bookea-azul/50"
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

      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-bookea-gris">
        {esGratis ? "Para empezar" : "Plan"}
      </p>
      <h3 className="mt-1 text-[19px] font-extrabold leading-tight text-bookea-tinta">
        {def.nombre}
      </h3>

      {/* El precio, en grande: es el dato que se compara entre las
          cuatro columnas y estaba en 20 px, apenas más que el nombre. */}
      <p className="mt-3 flex items-baseline gap-1.5 text-bookea-tinta">
        <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em]">
          {precio === null ? "A convenir" : esGratis ? "Gratis" : precio}
        </span>
        {!esGratis && precio !== null && (
          <span className="text-[13px] font-bold text-bookea-gris">/mes</span>
        )}
      </p>

      <button
        type="button"
        onClick={onElegir}
        className={`presionable mt-4 min-h-[44px] w-full rounded-xl px-3 text-[13px] font-extrabold ${
          botonDestacado
            ? ""
            : "border-[1.5px] border-bookea-linea text-bookea-azul hover:border-bookea-azul"
        }`}
        style={botonDestacado ? { background: "var(--accion)", color: "var(--accion-tinta)" } : undefined}
      >
        {esGratis ? "Empezar gratis →" : `Elegir ${def.nombre} →`}
      </button>

      <p className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-bookea-gris">
        Incluye
      </p>
      <ul className="mt-2 flex-1 space-y-1.5">
        {beneficios.map((b, i) => (
          <li key={b} className="flex items-start gap-2 text-[12px] leading-snug text-bookea-gris">
            <Icono nombre="listo" className="mt-0.5 h-4 w-4 shrink-0 text-bookea-azul" />
            <span>
              {b}
              {i === 0 && <BotonVerTipos tipos={def.tipos} />}
            </span>
          </li>
        ))}
      </ul>
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
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-bookea-linea bg-bookea-fondo px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
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
      <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] leading-snug text-bookea-gris">
        <Icono nombre="listo" className="h-3.5 w-3.5 shrink-0 text-bookea-azul" />
        <span>
          Pago cifrado, sin guardar tu tarjeta.{" "}
          <Link href="/lealtad/planes" className="font-bold text-bookea-azul underline">
            Ver el detalle de los paquetes →
          </Link>
        </span>
      </p>
    </div>
  );
}
