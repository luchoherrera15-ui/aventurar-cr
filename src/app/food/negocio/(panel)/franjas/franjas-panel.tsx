"use client";

import { useActionState, useState, useTransition } from "react";
import { hoyISOCR } from "@/lib/fechas";
import { fechaCorta, horaCorta, type FoodFranja, type FoodLocation } from "@/lib/food/tipos";
import { IconX } from "@/components/icons";
import {
  alternarFranja,
  borrarFranja,
  crearFranja,
  crearFranjasRecurrentes,
  type EstadoFranja,
} from "./actions";

const INICIAL: EstadoFranja = { error: null };
const campo =
  "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] " +
  "text-aventurea-ink outline-none focus:border-aventurea-navy";
const etiqueta = "mb-1.5 block text-[12.5px] font-bold text-aventurea-ink";

/** Días de la semana en el orden en que se usan en Costa Rica (lun→dom),
 *  con el valor que espera Date#getUTCDay() (0 = domingo). */
const DIAS_SEMANA: { valor: number; label: string }[] = [
  { valor: 1, label: "Lun" },
  { valor: 2, label: "Mar" },
  { valor: 3, label: "Mié" },
  { valor: 4, label: "Jue" },
  { valor: 5, label: "Vie" },
  { valor: 6, label: "Sáb" },
  { valor: 0, label: "Dom" },
];

export default function FranjasPanel({
  negocioId,
  sedes,
  franjas,
}: {
  negocioId: string;
  sedes: Pick<FoodLocation, "id" | "nombre">[];
  franjas: Omit<FoodFranja, "business_id">[];
}) {
  const [modo, setModo] = useState<"cerrado" | "simple" | "recurrente">("cerrado");

  if (sedes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-10 text-center text-[13.5px] text-aventurea-ink-soft">
        Necesitás al menos una sede antes de crear franjas. Configurala en Configuración.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {modo === "cerrado" ? (
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setModo("simple")}
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
          >
            Abrir una franja
          </button>
          <button
            type="button"
            onClick={() => setModo("recurrente")}
            className="rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[14px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
          >
            Abrir varias (recurrente)
          </button>
        </div>
      ) : modo === "simple" ? (
        <Formulario negocioId={negocioId} sedes={sedes} alCerrar={() => setModo("cerrado")} />
      ) : (
        <FormularioRecurrente negocioId={negocioId} sedes={sedes} alCerrar={() => setModo("cerrado")} />
      )}

      {franjas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-10 text-center text-[13.5px] text-aventurea-ink-soft">
          Todavía no abriste ninguna franja horaria.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {franjas.map((f) => (
            <Fila key={f.id} negocioId={negocioId} franja={f} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Formulario({
  negocioId,
  sedes,
  alCerrar,
}: {
  negocioId: string;
  sedes: Pick<FoodLocation, "id" | "nombre">[];
  alCerrar: () => void;
}) {
  const accion = crearFranja.bind(null, negocioId);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  if (estado.ok) alCerrar();

  return (
    <form action={enviar} className="flex flex-col gap-4 rounded-2xl border border-aventurea-line bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Sede</span>
          <select name="location_id" required className={campo} defaultValue={sedes[0]?.id}>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={etiqueta}>Capacidad</span>
          <input name="capacidad" type="number" min={1} max={500} defaultValue={20} required className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Fecha</span>
          <input name="fecha" type="date" min={hoyISOCR()} required className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Hora</span>
          <input name="hora" type="time" required className={campo} />
        </label>
        <label className="block sm:col-span-2">
          <span className={etiqueta}>Descuento (%)</span>
          <input
            name="descuento_porcentaje"
            type="number"
            min={0}
            max={90}
            defaultValue={20}
            className={campo}
          />
        </label>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Abrir franja"}
        </button>
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-xl border border-aventurea-line px-5 py-2.5 text-[14px] font-bold text-aventurea-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * El modo recurrente: en vez de una franja, genera TODAS las
 * combinaciones de fecha (dentro de un rango, filtrado por día de
 * semana) × hora elegidas — abrir mediodía y noche de martes a sábado
 * durante varias semanas de una sola vez, en vez de decenas de envíos
 * manuales del formulario simple de arriba (que sigue existiendo tal
 * cual, sin tocar).
 */
function FormularioRecurrente({
  negocioId,
  sedes,
  alCerrar,
}: {
  negocioId: string;
  sedes: Pick<FoodLocation, "id" | "nombre">[];
  alCerrar: () => void;
}) {
  const accion = crearFranjasRecurrentes.bind(null, negocioId);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [dias, setDias] = useState<number[]>([]);
  const [horas, setHoras] = useState<string[]>([]);
  const [horaNueva, setHoraNueva] = useState("");

  if (estado.ok) alCerrar();

  function alternarDia(v: number) {
    setDias((actual) => (actual.includes(v) ? actual.filter((x) => x !== v) : [...actual, v]));
  }

  function agregarHora() {
    if (!horaNueva) return;
    setHoras((actual) => (actual.includes(horaNueva) ? actual : [...actual, horaNueva].sort()));
    setHoraNueva("");
  }

  function quitarHora(h: string) {
    setHoras((actual) => actual.filter((x) => x !== h));
  }

  return (
    <form action={enviar} className="flex flex-col gap-4 rounded-2xl border border-aventurea-line bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Sede</span>
          <select name="location_id" required className={campo} defaultValue={sedes[0]?.id}>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={etiqueta}>Capacidad (para todas)</span>
          <input name="capacidad" type="number" min={1} max={500} defaultValue={20} required className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Desde</span>
          <input name="desde" type="date" min={hoyISOCR()} required className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Hasta</span>
          <input name="hasta" type="date" min={hoyISOCR()} required className={campo} />
        </label>
        <label className="block sm:col-span-2">
          <span className={etiqueta}>Descuento (%) (para todas)</span>
          <input
            name="descuento_porcentaje"
            type="number"
            min={0}
            max={90}
            defaultValue={20}
            className={campo}
          />
        </label>
      </div>

      <div>
        <span className={etiqueta}>Días de la semana</span>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((d) => (
            <label
              key={d.valor}
              className={`cursor-pointer select-none rounded-lg border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                dias.includes(d.valor)
                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                  : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
              }`}
            >
              <input
                type="checkbox"
                name="dias"
                value={d.valor}
                checked={dias.includes(d.valor)}
                onChange={() => alternarDia(d.valor)}
                className="sr-only"
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={etiqueta}>Horas</span>
        <div className="flex flex-wrap items-center gap-2">
          {horas.map((h) => (
            <span
              key={h}
              className="flex items-center gap-1.5 rounded-lg bg-aventurea-cream-2 px-3 py-1.5 text-[13px] font-bold text-aventurea-ink"
            >
              <input type="hidden" name="horas" value={h} />
              {horaCorta(h)}
              <button
                type="button"
                onClick={() => quitarHora(h)}
                aria-label={`Quitar ${horaCorta(h)}`}
                className="text-aventurea-ink-soft hover:text-red-700"
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="time"
            value={horaNueva}
            onChange={(e) => setHoraNueva(e.target.value)}
            className="rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[13px] text-aventurea-ink outline-none focus:border-aventurea-navy"
          />
          <button
            type="button"
            onClick={agregarHora}
            className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-navy transition-colors hover:border-aventurea-navy"
          >
            + Agregar hora
          </button>
        </div>
        {horas.length === 0 && (
          <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
            Agregá al menos una hora, ej. 12:00, 19:00.
          </p>
        )}
      </div>

      {estado.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente || dias.length === 0 || horas.length === 0}
          className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
        >
          {pendiente ? "Generando…" : "Generar franjas"}
        </button>
        <button
          type="button"
          onClick={alCerrar}
          className="rounded-xl border border-aventurea-line px-5 py-2.5 text-[14px] font-bold text-aventurea-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Fila({ negocioId, franja }: { negocioId: string; franja: Omit<FoodFranja, "business_id"> }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-aventurea-line bg-white p-3.5">
      <div className="w-28 shrink-0">
        <p className="text-[13.5px] font-bold text-aventurea-ink">{fechaCorta(franja.fecha)}</p>
        <p className="text-[12px] text-aventurea-ink-soft">{horaCorta(franja.hora)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-aventurea-ink">
          {franja.reservado}/{franja.capacidad} reservados · {franja.descuento_porcentaje}% OFF
        </p>
        {!franja.activa && (
          <span className="mt-0.5 inline-block rounded-md bg-aventurea-cream-2 px-2 py-0.5 text-[11px] font-bold text-aventurea-ink-soft">
            Apagada
          </span>
        )}
        {error && <p className="mt-0.5 text-[12px] font-bold text-red-700">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await alternarFranja(negocioId, franja.id, !franja.activa);
              setError(r?.error ?? null);
            })
          }
          className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy"
        >
          {franja.activa ? "Apagar" : "Prender"}
        </button>
        {confirmando ? (
          <>
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await borrarFranja(negocioId, franja.id);
                  setError(r?.error ?? null);
                  if (!r?.error) setConfirmando(false);
                })
              }
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-bold text-white"
            >
              Sí, borrar
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="text-[12.5px] font-bold text-aventurea-ink-soft">
              No
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-red-700 transition-colors hover:border-red-400"
          >
            Borrar
          </button>
        )}
      </div>
    </li>
  );
}
