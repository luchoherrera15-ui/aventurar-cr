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
 * este clic (ver el comentario de `editor-tarjeta-completo.tsx`).
 * Armar la tarjeta sigue siendo gratis siempre, sin importar qué card se
 * haya tocado acá; el único momento honesto para pedir plata sigue
 * siendo cuando la persona ya decidió publicar (la sección «Revisar y
 * crear» del editor, con el mismo aviso ámbar de siempre).
 */
export default function PanelPaquetesLealtad({
  tipoElegido,
  alSeguir,
}: {
  tipoElegido: TipoTarjeta;
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
 */
function bulletsDe(def: DefinicionPlan): string[] {
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
    <div
      className={`flex flex-col rounded-2xl border p-3.5 ${
        resaltado
          ? "border-bookea-azul bg-bookea-azul-suave"
          : destacado
            ? "border-bookea-linea bg-bookea-fondo"
            : "border-bookea-linea bg-white"
      }`}
    >
      {resaltado ? (
        <span
          className="mb-1.5 self-start rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          Con lo que elegiste
        </span>
      ) : destacado ? (
        <span className="mb-1.5 self-start rounded-full bg-orange-50 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-orange-700">
          El más popular
        </span>
      ) : (
        <span className="mb-1.5 h-[19px]" aria-hidden />
      )}

      <h3 className="text-[14.5px] font-extrabold text-bookea-tinta">{def.nombre}</h3>
      <p className="mt-0.5 text-[17px] font-extrabold leading-none text-bookea-tinta">
        {precio === null ? "A convenir" : esGratis ? "Gratis" : precio}
        {!esGratis && precio !== null && (
          <span className="text-[11px] font-bold text-bookea-gris"> /mes</span>
        )}
      </p>

      <ul className="mt-2.5 flex-1 space-y-1">
        {beneficios.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-[11px] leading-snug text-bookea-gris">
            <Icono nombre="listo" className="mt-0.5 h-3 w-3 shrink-0 text-bookea-azul" />
            {b}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onElegir}
        className={`presionable mt-3 w-full rounded-full px-3 py-2.5 text-[12px] font-extrabold ${
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
 * La respuesta a «¿y con qué pago?», pedida textual por el dueño:
 * Stripe con tarjeta (más wallets del dispositivo) o SINPE/transferencia
 * a mano. Chips de TEXTO y no íconos de marca — no hay ningún SVG de
 * Visa/Mastercard/Apple Pay/Stripe en `public/` y no se fabrican acá
 * (son marcas registradas de terceros).
 *
 * Apple Pay y Google Pay SÍ se prometen: el checkout de Stripe que ya
 * usa Lealtad (`checkout.ts`, `mode: "subscription"`) es el Checkout
 * hospedado sin `payment_method_types` fijado a solo tarjeta, así que
 * activa wallets del navegador/OS solas, sin nada que configurar acá —
 * por eso el copy dice «según tu dispositivo» y no lo garantiza a
 * ciegas, mismo criterio que ya sigue la etiqueta de «cercanía» en
 * `planes.ts` (SOLO EN iPHONE, y lo dice).
 */
function SeccionConfianzaPago() {
  return (
    <div className="mt-5 rounded-2xl border border-bookea-linea bg-bookea-fondo p-3.5">
      <p className="text-[12.5px] font-extrabold text-bookea-tinta">
        Pagás como prefieras, siempre seguro
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-bookea-gris">
        Con tarjeta a través de Stripe —Visa, Mastercard, Apple Pay o Google Pay según tu
        dispositivo—, 100&nbsp;% cifrado y seguro. ¿Preferís depositar? También podés pagar por
        transferencia SINPE Móvil: subís el comprobante y activamos tu paquete apenas lo
        confirmamos.
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-bookea-tinta">
        <Icono nombre="listo" className="h-3.5 w-3.5 shrink-0 text-bookea-azul" />
        100&nbsp;% seguro, sin guardar tu tarjeta en Bookea
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {["Stripe", "Visa", "Mastercard", "Apple Pay", "Google Pay", "SINPE Móvil"].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-bookea-linea bg-white px-2.5 py-1 text-[10px] font-bold text-bookea-tinta"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
