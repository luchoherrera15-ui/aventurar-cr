"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ACCION, ACCION_TINTA, BOTON_ACCION } from "../sistema-lealtad";
import { Icono } from "./iconos";

/**
 * «¡MEMBRESÍA VENCIDA!» — el aviso que no se cierra.
 *
 * No tiene X, no se cierra con Escape ni tocando afuera: la única salida
 * es renovar o irse a otro negocio. Lo que se ve atrás es un dibujo
 * vacío del panel, no el panel: `layout.tsx` no lo manda al navegador.
 *
 * ── LOS CUATRO CASOS ────────────────────────────────────────────────
 *   · El dueño: el aviso y el botón de renovar.
 *   · Un colaborador: el mismo aviso, sin botón — pagar es del dueño
 *     (`verificarAccesoRancho`), y un botón que termina en «Solo el
 *     dueño puede pagar» sería un callejón sin salida.
 *   · Dejó un comprobante de SINPE: ya no se le pide pagar. Se le dice
 *     que se está revisando.
 *   · Volvió de Stripe (`?pago=listo`): Stripe confirma por webhook unos
 *     segundos después, así que el panel se vuelve a pedir solo hasta
 *     que el cobro entre. Esa URL se puede escribir a mano y no abre
 *     nada: solo cambia el texto, porque quien decide sigue siendo
 *     `layout.tsx` contra la base.
 */

const NAVY_PROFUNDO = "#0a1226";
const SUPERFICIE = "#151d30";
/** Cada cuánto se pregunta si Stripe ya confirmó. */
const MS_ENTRE_INTENTOS = 4_000;
/** Dos minutos: lo que tarda de sobra un webhook sano. */
const INTENTOS_MAXIMOS = 30;

export default function PopupMembresiaVencida({
  ranchoId,
  negocio,
  paquete,
  fecha,
  esDueno,
  comprobanteEnRevision,
}: {
  ranchoId: string;
  negocio: string;
  /** Nombre del paquete. null = no se sabe, y entonces dice «membresía». */
  paquete: string | null;
  /** Ya en texto: «sábado 31 de octubre de 2026». */
  fecha: string;
  esDueno: boolean;
  comprobanteEnRevision: boolean;
}) {
  const router = useRouter();
  const volvioDePagar = useSearchParams().get("pago") === "listo";
  const [seAgotoLaEspera, setSeAgotoLaEspera] = useState(false);
  const confirmando = volvioDePagar && !seAgotoLaEspera && !comprobanteEnRevision;

  useEffect(() => {
    if (!confirmando) return;
    let intentos = 0;
    const reloj = setInterval(() => {
      intentos += 1;
      if (intentos > INTENTOS_MAXIMOS) {
        clearInterval(reloj);
        setSeAgotoLaEspera(true);
        return;
      }
      router.refresh();
    }, MS_ENTRE_INTENTOS);
    return () => clearInterval(reloj);
  }, [confirmando, router]);

  const lista = !confirmando && !comprobanteEnRevision;
  const titulo = confirmando
    ? "Estamos confirmando tu pago"
    : comprobanteEnRevision
      ? "Estamos revisando tu pago"
      : "¡MEMBRESÍA VENCIDA!";
  const que = paquete ? `paquete ${paquete}` : "membresía";

  return (
    <main className="relative min-h-svh overflow-hidden" style={{ background: NAVY_PROFUNDO }}>
      <PanelDeFondo />

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070d1c]/75 p-4 backdrop-blur-[6px]">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="membresia-titulo"
          aria-describedby="membresia-texto"
          className="max-h-[calc(100svh-2rem)] w-full max-w-[440px] overflow-y-auto rounded-3xl border border-white/10 px-6 pb-6 pt-8 text-center shadow-[0_24px_70px_rgba(0,0,0,.55)] sm:px-8 sm:pt-9"
          style={{ background: SUPERFICIE }}
        >
          <span
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
              lista ? "bg-[#ff8a7a]/15 text-[#ffb3a8]" : "bg-white/10 text-white/80"
            }`}
          >
            <Icono nombre={lista ? "candado" : "reloj"} className="h-7 w-7" />
          </span>

          <p className="mt-5 truncate text-[12.5px] font-bold text-white/60">{negocio}</p>
          <h1
            id="membresia-titulo"
            className="mt-1 text-[24px] font-extrabold leading-tight tracking-tight text-white sm:text-[26px]"
          >
            {titulo}
          </h1>

          <div id="membresia-texto">
            {confirmando ? (
              <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                Recibimos tu pago. El panel se abre solo en unos segundos, en cuanto Stripe lo
                confirme.
              </p>
            ) : comprobanteEnRevision ? (
              <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                Recibimos tu comprobante. El panel se abre apenas el equipo de Bookea lo apruebe.
              </p>
            ) : esDueno ? (
              <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                Tu {que} venció el {fecha}. Por ahora no se pueden dar sellos ni canjear premios.
              </p>
            ) : (
              <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                La membresía de este negocio venció el {fecha}. Solo el dueño puede renovarla:
                avísale para volver a dar sellos y canjear premios.
              </p>
            )}

            {lista && (
              <p className="mt-4 rounded-2xl bg-white/[.06] px-4 py-3 text-[13px] font-semibold leading-relaxed text-white/85">
                No se borró nada. Los clientes, sus sellos y sus tarjetas siguen igual: al renovar,
                todo vuelve como estaba.
              </p>
            )}

            {seAgotoLaEspera && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-white/60">
                ¿Ya pagaste? La confirmación se está tardando más de lo normal: vuelve a abrir esta
                página en unos minutos antes de intentar pagar de nuevo.
              </p>
            )}
          </div>

          {lista && esDueno && (
            <Link
              href={`/lealtad/planes?negocio=${ranchoId}`}
              autoFocus
              className={`${BOTON_ACCION} mt-6 h-12 w-full text-[15px]`}
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              Renueva tu membresía →
            </Link>
          )}

          <Link
            href="/lealtad/panel"
            // Sin botón de renovar, esta es la única salida: el foco de un
            // diálogo tiene que quedar adentro del diálogo.
            autoFocus={!(lista && esDueno)}
            className="mt-4 inline-block text-[12.5px] font-bold text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            Mis negocios
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * El panel, dibujado y vacío: sin datos del negocio y sin nada que se
 * pueda enfocar. Solo está para que el aviso se lea como lo que es, un
 * popup encima de su panel.
 */
function PanelDeFondo() {
  return (
    <div aria-hidden className="absolute inset-0 flex">
      <div className="hidden w-[248px] shrink-0 flex-col gap-3 bg-[#070d1c] p-4 md:flex">
        <div className="h-16 rounded-xl bg-white/[.06]" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-9 rounded-lg bg-white/[.04]" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <div className="h-10 w-48 rounded-xl bg-white/[.06]" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/[.05]" />
          ))}
        </div>
        <div className="mt-4 h-72 rounded-2xl bg-white/[.04]" />
      </div>
    </div>
  );
}
