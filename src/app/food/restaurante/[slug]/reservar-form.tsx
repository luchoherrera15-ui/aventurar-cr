"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fechaCorta, horaCorta, type FoodFranja } from "@/lib/food/tipos";
import { reservarFood } from "./actions";

export default function ReservarForm({
  franjas,
  logueado,
  slug,
}: {
  franjas: FoodFranja[];
  logueado: boolean;
  /** El restaurante actual — para que el login sepa a dónde volver. */
  slug: string;
}) {
  const [franjaId, setFranjaId] = useState<string | null>(null);
  const [personas, setPersonas] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();

  const porFecha = useMemo(() => {
    const mapa = new Map<string, FoodFranja[]>();
    for (const f of franjas) {
      const lista = mapa.get(f.fecha) ?? [];
      lista.push(f);
      mapa.set(f.fecha, lista);
    }
    return [...mapa.entries()];
  }, [franjas]);

  const franjaElegida = franjas.find((f) => f.id === franjaId) ?? null;
  const cupoDisponible = franjaElegida ? franjaElegida.capacidad - franjaElegida.reservado : 0;

  function reservar() {
    if (!franjaId) {
      setError("Elegí un horario.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await reservarFood(franjaId, personas);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/food/reserva/${r.reservaId}`);
    });
  }

  if (franjas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-aventurea-line-fuerte bg-white px-4 py-6 text-center text-[13.5px] text-aventurea-ink-soft">
        No hay horarios disponibles por ahora.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        {porFecha.map(([fecha, lista]) => (
          <div key={fecha}>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              {fechaCorta(fecha)}
            </p>
            <div className="flex flex-wrap gap-2">
              {lista.map((f) => {
                const disponible = f.capacidad - f.reservado;
                const agotada = disponible <= 0;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={agotada}
                    onClick={() => {
                      setFranjaId(f.id);
                      setError(null);
                    }}
                    className={`flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      franjaId === f.id
                        ? "border-aventurea-navy bg-aventurea-navy text-white"
                        : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
                    }`}
                  >
                    <span className="text-[13.5px] font-bold">{horaCorta(f.hora)}</span>
                    <span
                      className={`text-[11px] font-bold ${
                        franjaId === f.id ? "text-white/85" : "text-aventurea-orange"
                      }`}
                    >
                      {f.descuento_porcentaje > 0
                        ? `${f.descuento_porcentaje}% OFF`
                        : "Sin descuento"}
                    </span>
                    {!agotada && (
                      <span
                        className={`mt-0.5 text-[10.5px] ${
                          franjaId === f.id ? "text-white/70" : "text-aventurea-ink-soft"
                        }`}
                      >
                        {disponible} lugares
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {franjaElegida && (
        <div className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4">
          {/* La respuesta inmediata a "¿cuánto ahorro y a qué hora?" —
              antes de pedir nada más. */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-aventurea-ink">
              {fechaCorta(franjaElegida.fecha)} · {horaCorta(franjaElegida.hora)}
            </p>
            {franjaElegida.descuento_porcentaje > 0 && (
              <p className="rounded-lg bg-aventurea-orange px-2.5 py-1 text-[13px] font-extrabold text-white">
                Tu descuento: {franjaElegida.descuento_porcentaje}%
              </p>
            )}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-aventurea-ink">
              ¿Cuántas personas?
            </span>
            <input
              type="number"
              min={1}
              max={Math.min(30, cupoDisponible)}
              value={personas}
              onChange={(e) => setPersonas(Number(e.target.value))}
              className="w-24 rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] text-aventurea-ink outline-none focus:border-aventurea-navy"
            />
          </label>

          {!logueado ? (
            <p className="text-[13px] text-aventurea-ink-soft">
              {/* `volver=food:{slug}` — mismo mecanismo que lealtad
                  (ver src/app/cuenta/page.tsx): tras loguearse vuelve
                  directo a esta ficha en vez de caer en el tablero
                  genérico, donde se perdía la franja/cantidad ya
                  elegida. */}
              <Link
                href={`/cuenta?volver=food:${slug}`}
                className="font-bold text-aventurea-navy hover:underline"
              >
                Iniciá sesión
              </Link>{" "}
              para confirmar tu reserva.
            </p>
          ) : (
            <button
              type="button"
              disabled={pendiente || personas < 1 || personas > cupoDisponible}
              onClick={reservar}
              className="btn-naranja presionable w-full disabled:opacity-50 sm:w-auto sm:self-start"
            >
              {pendiente ? "Reservando…" : `Reservar ${horaCorta(franjaElegida.hora)}`}
            </button>
          )}

          {error && <p className="text-[12.5px] font-bold text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
