"use client";

import { useState, useTransition } from "react";
import type { ModoPrograma } from "@/lib/wallet/tarjeta";
import {
  eliminarRecompensa,
  guardarPrograma,
  guardarRecompensa,
  type ProgramaFila,
  type ProgramaInput,
  type RecompensaFila,
} from "./pases-actions";
import dynamic from "next/dynamic";

/**
 * El escáner se carga aparte y SOLO en el navegador.
 *
 * Arrastra `jsqr` y pide la cámara: nada de eso puede correr en el
 * servidor, y sobre todo, nada de eso puede tener la posibilidad de
 * tumbar el resto del panel. Cargándolo así, si la librería falla o el
 * dispositivo no tiene cámara, lo único que se pierde es el escáner —
 * la configuración del programa sigue en pie.
 */
const EscanerPanel = dynamic(() => import("./escaner-panel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <p className="text-[13px] font-bold text-aventurea-ink-soft">
        Preparando el escáner…
      </p>
    </div>
  ),
});

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";
const ayudaCls = "mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft";

const MODOS: { id: ModoPrograma; label: string; ayuda: string }[] = [
  {
    id: "sellos",
    label: "Sellos",
    ayuda: "«5 de 10» con círculos que se encienden. Cuántos hacen falta lo define la recompensa.",
  },
  {
    id: "cashback",
    label: "Cashback",
    ayuda: "«₡3.400 acumulados». Se usa con puntos por colón — 0.05 es devolver el 5%.",
  },
  { id: "puntos", label: "Puntos", ayuda: "«340 puntos». El clásico, sin meta visible." },
];

type Borrador = {
  nombre: string;
  modo: ModoPrograma;
  puntosPorVisita: string;
  puntosPorColon: string;
  colorFondo: string;
  colorSello: string;
  logoUrl: string;
  activo: boolean;
};

function num(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : 0;
}

function dePrograma(p: ProgramaFila | null): Borrador {
  return {
    nombre: p?.nombre ?? "Programa de lealtad",
    modo: p?.modo ?? "sellos",
    puntosPorVisita: String(p?.puntos_por_visita ?? 1),
    puntosPorColon: String(p?.puntos_por_colon ?? 0),
    colorFondo: p?.pase_color_fondo ?? "#002472",
    colorSello: p?.pase_color_sello ?? "#F39200",
    logoUrl: p?.pase_logo_url ?? "",
    activo: p?.activo ?? true,
  };
}

/**
 * Pases de lealtad: el programa, su tarjeta de Wallet y las
 * recompensas.
 *
 * Lo que NO se edita acá es a propósito: cuántos sellos hacen falta y
 * qué regalía espera salen de la recompensa activa más barata. Si
 * fueran campos aparte, cambiar la recompensa dejaría la tarjeta
 * prometiendo lo viejo.
 */
export default function PasesPanel({
  ranchoId,
  programaInicial,
  recompensasIniciales,
  tieneCercania,
}: {
  ranchoId: string;
  programaInicial: ProgramaFila | null;
  recompensasIniciales: RecompensaFila[];
  /** Complemento de pago (0123): el aviso en pantalla bloqueada. */
  tieneCercania: boolean;
}) {
  const [programa, setPrograma] = useState(programaInicial);
  const [recompensas, setRecompensas] = useState(
    [...recompensasIniciales].sort((a, b) => a.costo_puntos - b.costo_puntos),
  );
  const [borrador, setBorrador] = useState<Borrador>(dePrograma(programaInicial));
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pending, startTransition] = useTransition();

  const [nuevaRecompensa, setNuevaRecompensa] = useState({ nombre: "", costo: "" });

  const meta = recompensas.find((r) => r.activo) ?? null;

  function guardar() {
    setError(null);
    setGuardado(false);
    const entrada: ProgramaInput = {
      nombre: borrador.nombre,
      modo: borrador.modo,
      puntosPorVisita: Math.round(num(borrador.puntosPorVisita)),
      puntosPorColon: num(borrador.puntosPorColon),
      colorFondo: borrador.colorFondo,
      colorSello: borrador.colorSello,
      logoUrl: borrador.logoUrl,
      activo: borrador.activo,
    };
    startTransition(async () => {
      const res = await guardarPrograma(ranchoId, entrada);
      if (res.error) setError(res.error);
      else if (res.programa) {
        setPrograma(res.programa);
        setGuardado(true);
      }
    });
  }

  function agregarRecompensa() {
    if (!programa) {
      setError("Guardá el programa antes de agregar recompensas.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await guardarRecompensa(ranchoId, programa.id, {
        nombre: nuevaRecompensa.nombre,
        descripcion: "",
        costoPuntos: Math.round(num(nuevaRecompensa.costo)),
        activo: true,
      });
      if (res.error) setError(res.error);
      else if (res.recompensa) {
        setRecompensas((prev) =>
          [...prev, res.recompensa!].sort((a, b) => a.costo_puntos - b.costo_puntos),
        );
        setNuevaRecompensa({ nombre: "", costo: "" });
      }
    });
  }

  function borrarRecompensa(id: string) {
    if (!programa) return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarRecompensa(ranchoId, programa.id, id);
      if (res.error) setError(res.error);
      else setRecompensas((prev) => prev.filter((r) => r.id !== id));
    });
  }

  const modoActual = MODOS.find((m) => m.id === borrador.modo)!;

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
          {error}
        </p>
      )}

      {/* Primero lo que se usa a diario: sumar el sello del cliente que
          está en el mostrador. La configuración se toca una vez. */}
      <EscanerPanel ranchoId={ranchoId} />
      {guardado && (
        <p className="rounded-xl bg-aventurea-green-light px-3 py-2 text-[12.5px] font-bold text-aventurea-green">
          Guardado. Las tarjetas nuevas ya salen con estos cambios.
        </p>
      )}

      {/* ── Cómo se gana ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <h3 className="text-[15px] font-bold text-aventurea-ink">Cómo se gana</h3>

        <div className="mt-4">
          <label className={labelCls}>Modo de la tarjeta</label>
          <div className="flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setBorrador({ ...borrador, modo: m.id })}
                className={`rounded-xl border px-3 py-2 text-[12.5px] font-bold ${
                  borrador.modo === m.id
                    ? "border-aventurea-navy bg-aventurea-navy text-white"
                    : "border-aventurea-line bg-white text-aventurea-ink-soft"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className={ayudaCls}>{modoActual.ayuda}</p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              {borrador.modo === "sellos" ? "Sellos por visita" : "Puntos por visita"}
            </label>
            <input
              type="number"
              min={0}
              value={borrador.puntosPorVisita}
              onChange={(e) => setBorrador({ ...borrador, puntosPorVisita: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Puntos por cada colón</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={borrador.puntosPorColon}
              onChange={(e) => setBorrador({ ...borrador, puntosPorColon: e.target.value })}
              placeholder="0.05 = 5% de vuelta"
              className={inputCls}
            />
          </div>
        </div>
        <p className={ayudaCls}>
          Se pueden combinar. Una barbería de sellos usa 1 por visita y 0 por colón; una
          cafetería de cashback usa 0 por visita y 0.05 por colón.
        </p>
      </div>

      {/* ── La recompensa: es la meta ───────────────────────────── */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <h3 className="text-[15px] font-bold text-aventurea-ink">Qué se gana</h3>
        <p className={ayudaCls}>
          La recompensa <strong>más barata</strong> es la que marca la meta de la tarjeta. Si
          cuesta 10, la tarjeta muestra «5 de 10» y promete esa regalía.
        </p>

        {recompensas.length > 0 && (
          <ul className="mt-4 space-y-2">
            {recompensas.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-aventurea-line bg-white px-3 py-2"
              >
                <span className="flex-1 text-[13.5px] font-bold text-aventurea-ink">
                  {r.nombre}
                  {r.id === meta?.id && (
                    <span className="ml-2 rounded-lg bg-aventurea-green-light px-2 py-0.5 text-[10.5px] font-bold text-aventurea-green">
                      meta de la tarjeta
                    </span>
                  )}
                </span>
                <span className="text-[12.5px] text-aventurea-ink-soft">
                  {r.costo_puntos} {borrador.modo === "sellos" ? "sellos" : "puntos"}
                </span>
                <button
                  type="button"
                  onClick={() => borrarRecompensa(r.id)}
                  disabled={pending}
                  className="text-[12.5px] font-bold text-red-700 underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={nuevaRecompensa.nombre}
            onChange={(e) => setNuevaRecompensa({ ...nuevaRecompensa, nombre: e.target.value })}
            placeholder="Tu bebida favorita gratis"
            className={`${inputCls} flex-1`}
          />
          <input
            type="number"
            min={1}
            value={nuevaRecompensa.costo}
            onChange={(e) => setNuevaRecompensa({ ...nuevaRecompensa, costo: e.target.value })}
            placeholder="10"
            className={`${inputCls} w-28`}
          />
          <button
            type="button"
            onClick={agregarRecompensa}
            disabled={pending || !nuevaRecompensa.nombre.trim() || !nuevaRecompensa.costo}
            className="shrink-0 rounded-[10px] bg-aventurea-ink px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
      </div>

      {/* ── Cómo se ve ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <h3 className="text-[15px] font-bold text-aventurea-ink">Cómo se ve la tarjeta</h3>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Color de fondo</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={borrador.colorFondo}
                onChange={(e) => setBorrador({ ...borrador, colorFondo: e.target.value })}
                className="h-[42px] w-14 shrink-0 rounded-[10px] border border-aventurea-line"
              />
              <input
                value={borrador.colorFondo}
                onChange={(e) => setBorrador({ ...borrador, colorFondo: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Color del sello</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={borrador.colorSello}
                onChange={(e) => setBorrador({ ...borrador, colorSello: e.target.value })}
                className="h-[42px] w-14 shrink-0 rounded-[10px] border border-aventurea-line"
              />
              <input
                value={borrador.colorSello}
                onChange={(e) => setBorrador({ ...borrador, colorSello: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Logo del negocio (URL https)</label>
            <input
              value={borrador.logoUrl}
              onChange={(e) => setBorrador({ ...borrador, logoUrl: e.target.value })}
              placeholder="Vacío = se escribe el nombre del negocio"
              className={inputCls}
            />
            <p className={ayudaCls}>
              Va arriba a la izquierda y dentro de cada sello. Sin logo, la tarjeta escribe el
              nombre del negocio.
            </p>
          </div>
        </div>

        {/* Vista previa aproximada: la de verdad la dibuja Apple. */}
        <div
          className="mt-4 overflow-hidden rounded-2xl p-4"
          style={{ backgroundColor: borrador.colorFondo }}
        >
          <p className="text-[15px] font-light text-white">
            {borrador.logoUrl ? "· logo del negocio ·" : borrador.nombre}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(meta?.costo_puntos ?? 10, 20) }, (_, i) => (
              <span
                key={i}
                className="h-6 w-6 rounded-full"
                style={{
                  backgroundColor: borrador.colorSello,
                  opacity: i < Math.ceil((meta?.costo_puntos ?? 10) / 2) ? 1 : 0.26,
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-right text-[10px] text-white/60">Powered by Bookea.lat</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-[10px] bg-aventurea-ink px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          Guardar
        </button>
        <label className="flex items-center gap-2 text-[12.5px] font-bold text-aventurea-ink-soft">
          <input
            type="checkbox"
            checked={borrador.activo}
            onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })}
          />
          Programa activo
        </label>
      </div>

      <p className={ayudaCls}>
        {tieneCercania
          ? "Aviso por cercanía activo: la tarjeta aparece sola en la pantalla bloqueada cuando el cliente pasa cerca del local."
          : "El aviso por cercanía —que la tarjeta salga sola cuando el cliente pasa cerca— es un complemento aparte."}
      </p>
    </div>
  );
}
