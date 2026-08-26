"use client";

import { useActionState, useState } from "react";
import { reclamarNegocio, type ResultadoReclamo } from "@/app/reclamar/actions";
import { IconCheck, IconX } from "@/components/icons";

const INICIAL: ResultadoReclamo = { error: null };

/**
 * ════════════════════════════════════════════════════════════════════
 *  «¿ESTE NEGOCIO ES TUYO?» — el enlace para reclamar una ficha
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): que quien reconozca su negocio pueda
 * avisarnos, nos llegue un correo, y podamos pasarle la ficha para que
 * termine de personalizarla.
 *
 * ── SE MUESTRA EN TODAS LAS FICHAS, NO SOLO EN LAS SEMBRADAS ────────
 *
 * Se podría mostrar únicamente donde sabemos que la cuenta todavía es
 * nuestra. No se hace, por dos razones:
 *
 *   · Para saberlo habría que exponer `owner_id` del lado del cliente,
 *     y este repo tiene la regla contraria escrita con todas las letras
 *     (ver `ranchos-publicos.ts`).
 *   · El caso «mi socio publicó el negocio y se fue» o «lo subió un
 *     empleado que ya no está» es real, y esconderles el enlace los
 *     deja sin ningún camino.
 *
 * Nada se entrega solo: el reclamo es una SOLICITUD que un admin
 * revisa. Que lo pueda mandar cualquiera no le da el negocio a nadie.
 *
 * ── VA DISCRETO Y ABAJO, A PROPÓSITO ────────────────────────────────
 *
 * No es un llamado a la acción: es una salida para quien la anda
 * buscando. Arriba y en grande le restaría aire a lo que la mayoría
 * viene a hacer, que es reservar.
 */
export default function ReclamarNegocio({
  ranchoId,
  nombreNegocio,
}: {
  ranchoId: string;
  nombreNegocio: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState(reclamarNegocio, INICIAL);

  // `estado.error === null` con el formulario ya enviado = salió bien.
  // Se distingue del arranque con `enviado`, que solo pasa a true
  // cuando la acción ya contestó al menos una vez.
  const [enviado, setEnviado] = useState(false);
  if (!enviado && !enviando && estado !== INICIAL && estado.error === null) {
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="mt-6 flex items-start gap-2 rounded-2xl border border-emerald-600/20 bg-emerald-50 px-4 py-3 text-[13.5px] text-emerald-900">
        <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          Recibimos tu solicitud. Te escribimos al correo que dejaste para confirmar que el
          negocio es tuyo y pasarte la ficha.
        </span>
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-6 text-[13px] font-bold text-aventurea-ink-soft underline underline-offset-4 transition-colors hover:text-aventurea-navy"
      >
        ¿Este negocio es tuyo? Reclamalo
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-extrabold text-aventurea-ink">
            Reclamá {nombreNegocio}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-aventurea-ink-soft">
            Si sos el dueño, contanos cómo confirmarlo y te pasamos la ficha para que la
            edites: fotos, servicios, precios y horarios.
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => setAbierto(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink transition-colors hover:border-aventurea-navy"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      </div>

      <form action={accion} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="ranchoId" value={ranchoId} />

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-bold text-aventurea-ink-soft">Tu nombre</span>
          <input
            name="nombre"
            required
            maxLength={120}
            className="h-11 rounded-xl border border-aventurea-line bg-white px-3 text-[14px] text-aventurea-ink"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[12px] font-bold text-aventurea-ink-soft">Correo</span>
            <input
              name="correo"
              type="email"
              required
              maxLength={160}
              className="h-11 rounded-xl border border-aventurea-line bg-white px-3 text-[14px] text-aventurea-ink"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[12px] font-bold text-aventurea-ink-soft">
              Teléfono <span className="font-semibold">(opcional)</span>
            </span>
            <input
              name="telefono"
              type="tel"
              maxLength={40}
              className="h-11 rounded-xl border border-aventurea-line bg-white px-3 text-[14px] text-aventurea-ink"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-bold text-aventurea-ink-soft">
            ¿Cómo confirmamos que es tuyo?
          </span>
          <textarea
            name="mensaje"
            rows={3}
            maxLength={1200}
            placeholder="Tu Instagram, la cédula jurídica con la que facturás, un teléfono que aparezca en el local…"
            className="rounded-xl border border-aventurea-line bg-white px-3 py-2 text-[14px] leading-relaxed text-aventurea-ink"
          />
        </label>

        {estado.error && (
          <p role="alert" className="text-[13px] font-semibold text-red-700">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="presionable flex h-11 items-center justify-center rounded-xl bg-aventurea-navy text-[14px] font-extrabold text-white disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </button>

        <p className="text-[12px] leading-relaxed text-aventurea-ink-soft">
          Lo revisa una persona de Bookea antes de traspasar nada. Nadie recibe el acceso a
          un negocio solo por completar este formulario.
        </p>
      </form>
    </div>
  );
}
