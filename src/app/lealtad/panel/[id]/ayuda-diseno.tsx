"use client";

import { useState, useTransition } from "react";
import type { IconoSello } from "@/lib/lealtad/iconos-sello";
import type { TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import type { HiloAyuda } from "@/lib/lealtad/ayuda-hilo";
import HiloAyudaDiseno from "@/components/hilo-ayuda-diseno";
import { pedirAyudaDeDiseno, responderAyudaDeDiseno } from "./ayuda-actions";

/**
 * «NO ME GUSTA CÓMO ME ESTÁ QUEDANDO» — la puerta, del lado del dueño.
 *
 * Va en el creador y en el editor de la tarjeta, que es donde aparece
 * el problema: alguien mirando su propia tarjeta y sin saber cómo
 * arreglarla. Mandarlo a buscar un correo en otra pantalla es perderlo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO SE VACÍA DESPUÉS DE MANDAR
 * ------------------------------------------------------------------
 * Un «¡gracias, ya te contactamos!» que desaparece al recargar deja al
 * dueño sin saber si mandó algo, y a la semana manda otro. Acá, una vez
 * que hay hilo, el bloque queda mostrando el estado y la conversación
 * entera: se abre, se lee lo que contestó Bookea y se le responde.
 *
 * Los datos VISUALES llegan por props desde la pantalla que lo monta —y
 * no de la base— porque en el creador la tarjeta todavía no existe y en
 * el editor puede haber cambios sin guardar. Se pide ayuda por lo que
 * se está viendo.
 */

export default function AyudaDeDiseno({
  ranchoId,
  programaId = null,
  hiloInicial,
  tipo,
  colorFondo,
  colorSello,
  iconoSello,
  tieneLogo,
  tieneBanda,
}: {
  ranchoId: string;
  /** La tarjeta, si ya existe. null = está en el creador. */
  programaId?: string | null;
  hiloInicial: HiloAyuda | null;
  tipo: TipoTarjeta;
  colorFondo: string;
  colorSello: string;
  iconoSello: IconoSello | null;
  tieneLogo: boolean;
  tieneBanda: boolean;
}) {
  const [hilo, setHilo] = useState<HiloAyuda | null>(hiloInicial);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const respuestas = hilo?.mensajes.filter((m) => m.deBookea).length ?? 0;

  function pedir() {
    setError(null);
    iniciar(async () => {
      const res = await pedirAyudaDeDiseno({
        ranchoId,
        programaId,
        texto,
        tipo,
        colorFondo,
        colorSello,
        iconoSello,
        tieneLogo,
        tieneBanda,
      });
      if (!res.ok) setError(res.motivo);
      else {
        setTexto("");
        setHilo(res.hilo);
      }
    });
  }

  function responder(respuesta: string) {
    if (!hilo) return;
    setError(null);
    iniciar(async () => {
      const res = await responderAyudaDeDiseno(ranchoId, hilo.id, respuesta);
      if (!res.ok) setError(res.motivo);
      else if (res.hilo) setHilo(res.hilo);
    });
  }

  return (
    <section className="rounded-2xl border border-aventurea-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-extrabold text-aventurea-ink">
            {hilo ? "Le pediste una mano al equipo" : "¿No te está quedando como querés?"}
          </h3>
          <p className="mt-1 max-w-[520px] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            {hilo
              ? respuestas > 0
                ? `Bookea te contestó (${respuestas} ${respuestas === 1 ? "respuesta" : "respuestas"}). Abrí la conversación para seguirla.`
                : "Ya lo tenemos. Te contestamos por acá mismo — no hace falta que vuelvas a escribir."
              : "Escribinos qué buscás y lo vemos con vos. Le llega al equipo con tu tarjeta tal como la tenés ahora: el tipo, los colores y el icono, para no hacerte repetir nada."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="presionable shrink-0 rounded-xl border border-aventurea-navy px-4 py-2.5 text-[12.5px] font-bold text-aventurea-navy"
          aria-expanded={abierto}
        >
          {abierto ? "Cerrar" : hilo ? "Ver la conversación" : "Pedir ayuda"}
        </button>
      </div>

      {abierto && (
        <div className="mt-4 border-t border-aventurea-line pt-4">
          {hilo ? (
            <HiloAyudaDiseno
              hilo={hilo}
              alResponder={responder}
              ocupado={ocupado}
              error={error}
            />
          ) : (
            <>
              <label
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                htmlFor="ayuda-pedido"
              >
                ¿Qué querés lograr?
              </label>
              <textarea
                id="ayuda-pedido"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Ej.: quiero que se vea más elegante y seria, tengo el logo en vector si les sirve."
                className="w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={pedir}
                  disabled={ocupado || texto.trim().length < 5}
                  className="presionable rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                >
                  {ocupado ? "Enviando…" : "Enviar el pedido"}
                </button>
                {error && (
                  <p role="alert" className="text-[12.5px] font-bold text-red-700">
                    {error}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
