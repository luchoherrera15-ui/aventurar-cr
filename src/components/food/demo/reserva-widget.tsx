"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fechaCorta } from "@/lib/food/tipos";
import { hoyISOCR, sumarDiasISO, TZ_CR } from "@/lib/fechas";
import {
  CRC_DEMO,
  horaBonita,
  type RestauranteDemo,
} from "@/lib/food/demo/tipos";
import {
  crearReserva,
  mesasDisponibles,
  registrarUsuario,
  useReservasDemo,
  useUsuarioDemo,
} from "@/lib/food/demo/estado";

/**
 * El panel de reserva de la DEMO — el recorrido completo: fecha →
 * personas → franja (con disponibilidad real de la sesión) → descuento
 * → precio estimado → confirmar. La reserva se guarda en localStorage
 * (ver ../../../lib/food/demo/estado.ts) y baja la disponibilidad de
 * esa franja, para que en una reunión de venta el estado CAMBIE de
 * verdad — nada toca la base de producción.
 */

/** "HH:MM" de ahora en Costa Rica — para ocultar franjas ya pasadas de
 *  hoy (mismo criterio que la ficha real de /food/restaurante). */
function horaActualCR(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ_CR,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function ReservaWidget({
  r,
  horaInicial,
}: {
  r: RestauranteDemo;
  horaInicial?: string;
}) {
  const router = useRouter();
  const reservas = useReservasDemo();
  const usuario = useUsuarioDemo();
  const hoy = hoyISOCR();

  const fechas = useMemo(
    () => Array.from({ length: 7 }, (_, i) => sumarDiasISO(hoy, i)),
    [hoy],
  );

  const [fecha, setFecha] = useState(hoy);
  const [personas, setPersonas] = useState(2);
  const [hora, setHora] = useState<string | null>(
    horaInicial && r.promociones.some((p) => p.hora === horaInicial) ? horaInicial : null,
  );
  const [confirmando, setConfirmando] = useState(false);

  const ahora = horaActualCR();
  const franjas = r.promociones.filter((p) => fecha !== hoy || p.hora > ahora);
  const elegida = franjas.find((p) => p.hora === hora) ?? null;
  const mesasElegida = elegida ? mesasDisponibles(reservas, r.slug, fecha, elegida.hora) : 0;

  const precioEstimado = r.precioPromedio * personas;
  const precioFinal = elegida
    ? Math.round(precioEstimado * (1 - elegida.descuento / 100))
    : precioEstimado;

  function confirmar() {
    if (!elegida || mesasElegida <= 0 || confirmando || !usuario) return;
    setConfirmando(true);
    const reserva = crearReserva({
      titular: usuario.nombre,
      slug: r.slug,
      nombre: r.nombre,
      zona: r.zona,
      fotoPrincipal: r.fotoPrincipal,
      fecha,
      hora: elegida.hora,
      personas,
      descuento: elegida.descuento,
      precioEstimado,
      precioFinal,
    });
    router.push(`/food/demo/reserva/${reserva.codigo}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Fecha */}
      <div>
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
          ¿Cuándo?
        </p>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {fechas.map((f, i) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFecha(f);
                setHora(null);
              }}
              aria-pressed={fecha === f}
              className={`presionable shrink-0 rounded-xl border px-3 py-2 text-[12.5px] font-bold transition-colors ${
                fecha === f
                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                  : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
              }`}
            >
              {i === 0 ? "Hoy" : i === 1 ? "Mañana" : fechaCorta(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Personas */}
      <div>
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
          ¿Cuántas personas?
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPersonas(n)}
              aria-pressed={personas === n}
              className={`presionable h-10 w-10 rounded-xl border text-[13.5px] font-bold transition-colors ${
                personas === n
                  ? "border-aventurea-navy bg-aventurea-navy text-white"
                  : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Franjas */}
      <div>
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
          Horarios disponibles
        </p>
        {franjas.length === 0 ? (
          <p className="mt-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-5 text-center text-[13px] text-aventurea-ink-soft">
            Las franjas de hoy ya pasaron — probá con otra fecha.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {franjas.map((p) => {
              const mesas = mesasDisponibles(reservas, r.slug, fecha, p.hora);
              const agotada = mesas <= 0;
              const activa = hora === p.hora;
              return (
                <button
                  key={p.hora}
                  type="button"
                  disabled={agotada}
                  onClick={() => setHora(activa ? null : p.hora)}
                  aria-pressed={activa}
                  className={`presionable flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                    activa
                      ? "border-aventurea-orange bg-aventurea-orange text-white shadow-elevado"
                      : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-orange/60"
                  }`}
                >
                  <span className="text-[13.5px] font-extrabold">{horaBonita(p.hora)}</span>
                  <span className={`text-[12px] font-extrabold ${activa ? "text-white/90" : "text-aventurea-orange-dark"}`}>
                    −{p.descuento}%
                  </span>
                  <span className={`mt-0.5 text-[10.5px] font-bold ${activa ? "text-white/75" : "text-aventurea-ink-soft"}`}>
                    {agotada ? "Agotado" : `${mesas} ${mesas === 1 ? "mesa" : "mesas"}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumen + CTA */}
      {elegida && (
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-aventurea-ink">
              {fecha === hoy ? "Hoy" : fechaCorta(fecha)} · {horaBonita(elegida.hora)} ·{" "}
              {personas} {personas === 1 ? "persona" : "personas"}
            </p>
            <p className="rounded-lg bg-aventurea-orange px-2.5 py-1 text-[13px] font-extrabold text-white">
              Tu descuento: {elegida.descuento}%
            </p>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-aventurea-line pt-3">
            <p className="text-[12.5px] font-bold text-aventurea-ink-soft">
              Precio estimado{" "}
              <span className="line-through">{CRC_DEMO.format(precioEstimado)}</span>
            </p>
            <p className="text-[20px] font-extrabold text-aventurea-navy">
              {CRC_DEMO.format(precioFinal)}
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-aventurea-ink-soft">
            Consumo promedio por persona según el menú ({CRC_DEMO.format(r.precioPromedio)}) ×{" "}
            {personas} — el descuento aplica a toda tu cuenta.
          </p>

          {usuario ? (
            <>
              <button
                type="button"
                onClick={confirmar}
                disabled={confirmando || mesasElegida <= 0}
                className="btn-naranja presionable mt-4 w-full disabled:opacity-50"
              >
                {confirmando ? "Confirmando…" : `Reservar ${horaBonita(elegida.hora)}`}
              </button>
              <p className="mt-2 text-center text-[11px] text-aventurea-ink-soft">
                Reservando como <strong className="text-aventurea-ink">{usuario.nombre}</strong>
              </p>
            </>
          ) : (
            <RegistroDemo alListo={() => {/* el CTA aparece al re-render */}} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * El registro de la demo — reservar exige cuenta (pedido del dueño:
 * el recorrido de venta muestra el flujo completo, incluido este
 * paso). Guarda en localStorage vía `registrarUsuario`; jamás crea
 * una cuenta real ni toca producción.
 */
function RegistroDemo({ alListo }: { alListo: () => void }) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);

  function crearCuenta() {
    const n = nombre.trim();
    const c = correo.trim();
    if (n.length < 2) {
      setError("Escribí tu nombre.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
      setError("Ese correo no se ve bien.");
      return;
    }
    setError(null);
    registrarUsuario({ nombre: n, correo: c, telefono: telefono.trim() });
    alListo();
  }

  const campo =
    "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] text-aventurea-ink outline-none focus:border-aventurea-navy placeholder:text-zinc-400";

  return (
    <div className="mt-4 border-t border-aventurea-line pt-4">
      <p className="text-[13.5px] font-extrabold text-aventurea-navy">
        Creá tu cuenta para reservar
      </p>
      <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
        Solo una vez — tus próximas reservas salen directo.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          autoComplete="name"
          className={campo}
        />
        <input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="Tu correo"
          autoComplete="email"
          className={campo}
        />
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Tu teléfono (opcional)"
          autoComplete="tel"
          className={campo}
        />
      </div>
      {error && <p className="mt-2 text-[12px] font-bold text-red-700">{error}</p>}
      <button type="button" onClick={crearCuenta} className="btn-naranja presionable mt-3 w-full">
        Crear cuenta y continuar
      </button>
    </div>
  );
}
