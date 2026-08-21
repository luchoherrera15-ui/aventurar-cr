"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { IconX } from "@/components/icons";
import { EYEBROW_NEUTRO, ROTULO_CAMPO } from "@/components/panel/sistema";
import { fechaCorta, horaCorta } from "@/lib/food/tipos";
import { crearReservaManual, type EstadoNuevaReserva } from "./actions";
import type { FranjaDisponible } from "./tipos";

/**
 * "+ NUEVA RESERVA" — anotar a mano la reserva que entró por teléfono.
 *
 * Un formulario corto (nombre, teléfono, personas, fecha, hora, nota)
 * dentro de un <dialog> nativo, igual que el cajón del shell: foco
 * atrapado, Esc y backdrop sin librerías. El padre lo monta solo
 * cuando está abierto — desmontarlo al cerrar es lo que resetea
 * useActionState sin necesidad de un "reset" artesanal.
 *
 * La fecha y la hora NO son inputs libres: son las franjas que el
 * restaurante ya abrió en Disponibilidad, porque la reserva manual
 * pasa por el MISMO control de cupo que una online
 * (crear_reserva_food, ver actions.ts). Inventar acá una hora sin
 * franja crearía reservas que el cupo no respalda.
 */

const INICIAL: EstadoNuevaReserva = { error: null };

const campo =
  "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] " +
  "text-aventurea-ink outline-none transition-colors focus:border-aventurea-navy";

export default function NuevaReserva({
  negocioId,
  franjas,
  alCerrar,
}: {
  negocioId: string;
  franjas: FranjaDisponible[];
  alCerrar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Solo franjas con cupo libre: ofrecer una llena solo para que el
  // RPC la rechace sería frustrar al dueño con un error evitable.
  const conCupo = useMemo(() => franjas.filter((f) => f.capacidad - f.reservado > 0), [franjas]);
  const fechas = useMemo(() => [...new Set(conCupo.map((f) => f.fecha))], [conCupo]);

  const [fechaSel, setFechaSel] = useState(fechas[0] ?? "");
  const franjasDelDia = conCupo.filter((f) => f.fecha === fechaSel);
  const [franjaSel, setFranjaSel] = useState(franjasDelDia[0]?.id ?? "");

  // Si la franja elegida no pertenece a la fecha elegida (el usuario
  // cambió de día), se cae a la primera del día nuevo — derivado en
  // render, sin efecto ni setState escondido.
  const franjaValida = franjasDelDia.some((f) => f.id === franjaSel)
    ? franjaSel
    : franjasDelDia[0]?.id ?? "";

  const accion = crearReservaManual.bind(null, negocioId);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      aria-label="Nueva reserva manual"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) ev.currentTarget.close();
      }}
      className="m-auto w-[min(92vw,460px)] rounded-3xl bg-white p-0 shadow-[var(--shadow-flotante)] backdrop:bg-black/45"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={EYEBROW_NEUTRO}>Reserva manual</p>
            <h2 className="titulo mt-1 text-[20px] leading-tight tracking-[-0.02em] text-aventurea-navy">
              Nueva reserva
            </h2>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Cerrar formulario"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-aventurea-line text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {estado.ok ? (
          // Éxito: el código en grande para dictarlo por teléfono.
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-aventurea-cream-2 px-5 py-7 text-center">
            <p className="text-[13.5px] font-bold text-aventurea-ink">Reserva registrada.</p>
            {estado.codigo && (
              <p className="rounded-xl bg-white px-5 py-3 font-mono text-[22px] font-extrabold tracking-[0.14em] text-aventurea-navy">
                {estado.codigo}
              </p>
            )}
            <p className="max-w-[36ch] text-[12px] leading-relaxed text-aventurea-ink-soft">
              Ese es el código de confirmación — dictáselo al cliente para el check-in.
            </p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              Listo
            </button>
          </div>
        ) : conCupo.length === 0 ? (
          <div className="rounded-2xl bg-aventurea-cream-2 px-5 py-7 text-center">
            <p className="text-[13.5px] font-bold text-aventurea-ink">
              No hay franjas con cupo disponible.
            </p>
            <p className="mx-auto mt-1.5 max-w-[38ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              Para anotar una reserva primero abrí franjas horarias con capacidad en
              Disponibilidad.
            </p>
            <Link
              href="/food/negocio/franjas"
              className="mt-4 inline-block rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              Abrir franjas
            </Link>
          </div>
        ) : (
          <form action={enviar} className="flex flex-col gap-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={`${ROTULO_CAMPO} mb-1 block`}>A nombre de</span>
                <input
                  type="text"
                  name="nombre"
                  required
                  maxLength={80}
                  placeholder="Nombre del cliente"
                  className={campo}
                />
              </label>
              <label className="block">
                <span className={`${ROTULO_CAMPO} mb-1 block`}>Teléfono (opcional)</span>
                <input
                  type="tel"
                  name="telefono"
                  maxLength={25}
                  placeholder="8888-8888"
                  className={campo}
                />
              </label>
              <label className="block">
                <span className={`${ROTULO_CAMPO} mb-1 block`}>Personas</span>
                <input
                  type="number"
                  name="personas"
                  required
                  min={1}
                  max={30}
                  defaultValue={2}
                  className={campo}
                />
              </label>
              <label className="block">
                <span className={`${ROTULO_CAMPO} mb-1 block`}>Fecha</span>
                <select
                  value={fechaSel}
                  onChange={(ev) => setFechaSel(ev.target.value)}
                  className={campo}
                  aria-label="Fecha de la reserva"
                >
                  {fechas.map((f) => (
                    <option key={f} value={f}>
                      {fechaCorta(f)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={`${ROTULO_CAMPO} mb-1 block`}>Hora (franja abierta)</span>
                <select
                  name="franja_id"
                  value={franjaValida}
                  onChange={(ev) => setFranjaSel(ev.target.value)}
                  className={campo}
                  aria-label="Franja horaria de la reserva"
                >
                  {franjasDelDia.map((f) => (
                    <option key={f.id} value={f.id}>
                      {horaCorta(f.hora)}
                      {f.descuento > 0 ? ` · −${f.descuento}%` : ""} · quedan{" "}
                      {f.capacidad - f.reservado}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className={`${ROTULO_CAMPO} mb-1 block`}>Ocasión o nota (opcional)</span>
                <textarea
                  name="nota"
                  rows={2}
                  maxLength={240}
                  placeholder="Cumpleaños, mesa junto a la ventana…"
                  className={`${campo} resize-none`}
                />
              </label>
            </div>

            {estado.error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
                {estado.error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => ref.current?.close()}
                className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pendiente}
                className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
              >
                {pendiente ? "Registrando…" : "Registrar reserva"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
