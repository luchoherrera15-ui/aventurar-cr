"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { sumarDiasISO } from "@/lib/fechas";
import { fechaCorta, horaCorta, type FoodFranja, type FoodLocation } from "@/lib/food/tipos";
import {
  EncabezadoPagina,
  GraficoBarras,
  InsigniaEstado,
  TarjetaPanel,
  type BarraGrafico,
} from "@/components/food/panel";
import { useToastFood, type TonoToast } from "@/components/food/panel/toast";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  ESTADO_PILDORA,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import { IconPlus, IconTrash, IconX } from "@/components/icons";
import {
  alternarFranja,
  borrarFranja,
  crearFranja,
  crearFranjasRecurrentes,
  type EstadoFranja,
} from "./actions";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  DISPONIBILIDAD — el panel de franjas al lenguaje "centro de control"
 * ═══════════════════════════════════════════════════════════════════
 *
 * Evolución de la lista plana anterior, SIN tocar las server actions
 * (actions.ts sigue igual): mismo modelo de datos (cada franja es una
 * fecha + hora + cupo concreta en food_franjas), otra presentación:
 *
 *   1. Tres números REALES arriba (franjas abiertas, cupos libres,
 *      reservas tomadas) — esta pantalla es operativa, acá no entra
 *      utilería.
 *   2. "Esta semana": tira de 7 días (hoy → +6) y las franjas del día
 *      elegido, con barra de ocupación, descuento y estado. Apagar es
 *      el "bloqueo" del producto (la franja existe pero no recibe);
 *      borrar solo se ofrece con confirmación en línea.
 *   3. "Más adelante": los días especiales — franjas puntuales más
 *      allá de la semana, agrupadas por fecha.
 *   4. Las pasadas, plegadas: son historial, no administración.
 *   5. La curva de demanda por hora (utilería, marcada "Datos de
 *      ejemplo"): la guía de a qué hora conviene abrir.
 *
 * Los formularios viven en un <dialog> nativo (mismo patrón que el
 * cajón móvil del shell: showModal() da foco atrapado, Esc y backdrop
 * gratis). En vez de useActionState, las actions se llaman DIRECTO
 * dentro de una transición: el resultado se recibe en la misma
 * función y con él se decide cerrar + toast o mostrar el error en
 * línea — el `if (estado.ok) alCerrar()` en pleno render que había
 * antes era un setState del padre durante el render del hijo, justo
 * lo que React advierte. El comportamiento de las actions no cambió:
 * ellas siguen validando y revalidando la ruta, y esa revalidación es
 * la que refresca la lista sin ningún router.refresh() a mano.
 *
 * `hoy` llega del SERVIDOR (hora de Costa Rica): si el cliente
 * calculara el suyo, un reloj adelantado pintaría la semana corrida
 * respecto de lo que el servidor valida al guardar.
 */

type Franja = Omit<FoodFranja, "business_id">;
type Sede = Pick<FoodLocation, "id" | "nombre">;

/** Qué formulario está abierto, y con qué fecha pre-cargada. */
type Dialogo = { modo: "simple" | "recurrente"; fecha?: string } | null;

const INICIAL: EstadoFranja = { error: null };

/** El rótulo de un campo de los formularios del diálogo. */
const etiqueta = "mb-1.5 block text-[12.5px] font-bold text-aventurea-ink";

const DOW_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Día de semana de una fecha ISO sin pasar por zonas horarias. */
function diaSemanaDe(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Días de la semana en el orden de acá (lun→dom), con el valor que
 *  espera Date#getUTCDay() (0 = domingo) — igual que en actions.ts. */
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
  hoy,
  demanda,
}: {
  negocioId: string;
  sedes: Sede[];
  franjas: Franja[];
  /** "YYYY-MM-DD" en hora de Costa Rica, calculado por el servidor. */
  hoy: string;
  /** La demanda demo por hora, ya en % (la arma el page en servidor). */
  demanda: BarraGrafico[];
}) {
  const { avisar, toast } = useToastFood();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [diaSel, setDiaSel] = useState(hoy);

  const nombreSede = useMemo(() => new Map(sedes.map((s) => [s.id, s.nombre])), [sedes]);

  // Un solo recorrido que parte las franjas en las tres secciones y
  // saca los números reales de arriba. Todo derivado de props: cuando
  // una action revalida la ruta, esto se recalcula solo.
  const { semana, masAdelante, pasadas, stats } = useMemo(() => {
    const semana = new Map<string, Franja[]>();
    for (let i = 0; i < 7; i++) semana.set(sumarDiasISO(hoy, i), []);

    const finSemana = sumarDiasISO(hoy, 6);
    const futurasLejos: Franja[] = [];
    const pasadas: Franja[] = [];
    const futuras: Franja[] = [];

    for (const f of franjas) {
      if (f.fecha < hoy) {
        pasadas.push(f); // ya vienen de la base ordenadas desc
        continue;
      }
      futuras.push(f);
      if (f.fecha <= finSemana) semana.get(f.fecha)?.push(f);
      else futurasLejos.push(f);
    }

    for (const lista of semana.values()) lista.sort((a, b) => a.hora.localeCompare(b.hora));
    futurasLejos.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

    // Agrupar "más adelante" por fecha para pintarlas con su título.
    const masAdelante: [string, Franja[]][] = [];
    for (const f of futurasLejos) {
      const ultimo = masAdelante[masAdelante.length - 1];
      if (ultimo && ultimo[0] === f.fecha) ultimo[1].push(f);
      else masAdelante.push([f.fecha, [f]]);
    }

    const activas = futuras.filter((f) => f.activa);
    const stats = {
      abiertas: activas.length,
      cuposLibres: activas.reduce((a, f) => a + Math.max(0, f.capacidad - f.reservado), 0),
      reservados: futuras.reduce((a, f) => a + f.reservado, 0),
    };

    return { semana, masAdelante, pasadas, stats };
  }, [franjas, hoy]);

  // % que concentran las horas destacadas del gráfico de demanda — el
  // argumento del texto de abajo se calcula de las MISMAS barras que
  // se pintan, no se afirma aparte.
  const picoCena = demanda.filter((b) => b.destacada).reduce((a, b) => a + b.valor, 0);

  const franjasDelDia = semana.get(diaSel) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Disponibilidad"
        descripcion="Abrí y administrá las franjas en las que recibís reservas: vos ponés el cupo, la hora y el descuento."
        acciones={
          sedes.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setDialogo({ modo: "recurrente" })}
                className={BOTON_PANEL}
              >
                Abrir varias
              </button>
              <button
                type="button"
                onClick={() => setDialogo({ modo: "simple", fecha: diaSel })}
                className={BOTON_PANEL_PRIMARIO}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Abrir franja
              </button>
            </>
          ) : undefined
        }
      />

      {sedes.length === 0 ? (
        // Sin sede no hay dónde colgar una franja: el camino corto a
        // Configuración, en una tarjeta del sistema (nada de bordes
        // punteados ni páginas en blanco).
        <TarjetaPanel>
          <div className="flex flex-col items-start gap-3 py-4 sm:items-center sm:text-center">
            <p className="text-[14px] font-bold text-aventurea-ink">
              Te falta crear tu primera sede
            </p>
            <p className="max-w-[46ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
              Las franjas se abren por sede (tu local y su dirección). Creala una vez y volvé
              acá a abrir tus horarios.
            </p>
            <Link href="/food/negocio/configuracion" className={BOTON_PANEL_PRIMARIO}>
              Ir a Configuración
            </Link>
          </div>
        </TarjetaPanel>
      ) : (
        <>
          {/* ── Números reales de la operación ─────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat valor={stats.abiertas} rotulo="Franjas abiertas" />
            <MiniStat valor={stats.cuposLibres} rotulo="Cupos libres" />
            <MiniStat valor={stats.reservados} rotulo="Ya reservados" acento />
          </div>

          {/* ── Esta semana ────────────────────────────────────────── */}
          <TarjetaPanel kicker="Esta semana" titulo="Franjas por día">
            {/* La tira de días: scrollea horizontal en el teléfono en
                vez de partirse — 7 botones no caben en 390px. */}
            <div
              role="tablist"
              aria-label="Días de la semana"
              className="flex gap-2 overflow-x-auto pb-1"
            >
              {[...semana.entries()].map(([fecha, lista]) => {
                const activo = fecha === diaSel;
                const abiertas = lista.filter((f) => f.activa).length;
                return (
                  <button
                    key={fecha}
                    type="button"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => setDiaSel(fecha)}
                    className={`flex min-w-[86px] shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      activo
                        ? "border-aventurea-navy bg-aventurea-navy text-white"
                        : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
                    }`}
                  >
                    <span className="text-[12.5px] font-extrabold leading-none">
                      {fecha === hoy
                        ? "Hoy"
                        : fecha === sumarDiasISO(hoy, 1)
                          ? "Mañana"
                          : DOW_CORTO[diaSemanaDe(fecha)]}
                    </span>
                    <span
                      className={`text-[11px] leading-none ${activo ? "text-white/70" : "text-aventurea-ink-soft"}`}
                    >
                      {fechaCorta(fecha)}
                    </span>
                    <span
                      className={`mt-1 text-[10.5px] font-bold leading-none ${
                        activo
                          ? "text-white/85"
                          : lista.length > 0
                            ? "text-aventurea-navy"
                            : "text-aventurea-ink-soft"
                      }`}
                    >
                      {lista.length === 0 ? "Sin franjas" : `${abiertas}/${lista.length} abiertas`}
                    </span>
                  </button>
                );
              })}
            </div>

            {franjasDelDia.length === 0 ? (
              <div
                className={`mt-3 flex flex-col items-center gap-2.5 ${SUPERFICIE_HUNDIDA} rounded-xl px-6 py-8 text-center`}
              >
                <p className="text-[13px] text-aventurea-ink-soft">
                  Este día no tiene franjas — para el público estás cerrado.
                </p>
                <button
                  type="button"
                  onClick={() => setDialogo({ modo: "simple", fecha: diaSel })}
                  className={BOTON_PANEL}
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  Abrir franja este día
                </button>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {franjasDelDia.map((f) => (
                  <FilaFranja
                    key={f.id}
                    negocioId={negocioId}
                    franja={f}
                    sede={sedes.length > 1 ? nombreSede.get(f.location_id) : undefined}
                    avisar={avisar}
                  />
                ))}
              </ul>
            )}
          </TarjetaPanel>

          {/* ── Días especiales más allá de la semana ──────────────── */}
          {masAdelante.length > 0 && (
            <TarjetaPanel
              kicker="Más adelante"
              titulo="Días especiales"
              accion={
                <span className="text-[12px] text-aventurea-ink-soft">
                  {masAdelante.reduce((a, [, l]) => a + l.length, 0)} franjas
                </span>
              }
            >
              <div className="flex flex-col gap-4">
                {masAdelante.map(([fecha, lista]) => (
                  <div key={fecha}>
                    <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
                      {DOW_CORTO[diaSemanaDe(fecha)]} {fechaCorta(fecha)}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {lista.map((f) => (
                        <FilaFranja
                          key={f.id}
                          negocioId={negocioId}
                          franja={f}
                          sede={sedes.length > 1 ? nombreSede.get(f.location_id) : undefined}
                          avisar={avisar}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </TarjetaPanel>
          )}

          {/* ── Historial plegado: se consulta, no se administra ───── */}
          {pasadas.length > 0 && (
            <details className="group rounded-3xl border border-aventurea-line bg-white p-4 shadow-[var(--shadow-plano)] sm:p-5">
              <summary className="flex cursor-pointer select-none items-center justify-between text-[13.5px] font-bold text-aventurea-ink [&::-webkit-details-marker]:hidden">
                Franjas pasadas ({pasadas.length})
                <span className="text-[12px] font-bold text-aventurea-navy group-open:hidden">
                  Ver
                </span>
                <span className="hidden text-[12px] font-bold text-aventurea-navy group-open:inline">
                  Ocultar
                </span>
              </summary>
              <ul className="mt-3 flex flex-col gap-1.5">
                {pasadas.slice(0, 20).map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-aventurea-cream-2 px-3.5 py-2.5 text-[12.5px] text-aventurea-ink-soft"
                  >
                    <span className="font-bold text-aventurea-ink">
                      {fechaCorta(f.fecha)} · {horaCorta(f.hora)}
                    </span>
                    <span>
                      {f.reservado}/{f.capacidad} reservados
                    </span>
                    {f.descuento_porcentaje > 0 && <span>−{f.descuento_porcentaje}%</span>}
                    {sedes.length > 1 && <span>{nombreSede.get(f.location_id)}</span>}
                  </li>
                ))}
              </ul>
              {pasadas.length > 20 && (
                <p className="mt-2 text-[12px] text-aventurea-ink-soft">
                  Se muestran las últimas 20.
                </p>
              )}
            </details>
          )}

          {/* ── La guía comercial: cuándo conviene abrir (demo) ────── */}
          <TarjetaPanel kicker="Demanda" titulo="¿A qué horas reserva la gente?" notaDemo>
            <GraficoBarras
              barras={demanda}
              serie="Reservas por hora"
              alto={200}
              formatearValor={(v) => `${v}% de las reservas`}
              formatearTick={(v) => `${v}%`}
            />
            <p className="mt-2.5 max-w-[62ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              Entre 7:00 p.m. y 9:00 p.m. se concentra ~{picoCena}% de las reservas en Bookea.
              Si vas a abrir pocas franjas, empezá por ahí — y usá el descuento en las horas
              valle para llenarlas.
            </p>
          </TarjetaPanel>
        </>
      )}

      <DialogoAbrir
        negocioId={negocioId}
        sedes={sedes}
        hoy={hoy}
        dialogo={dialogo}
        alCambiarModo={(modo) => setDialogo((d) => (d ? { ...d, modo } : { modo }))}
        alCerrar={() => setDialogo(null)}
        avisar={avisar}
      />

      {toast}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  El número real de arriba
// ───────────────────────────────────────────────────────────────────

function MiniStat({
  valor,
  rotulo,
  acento = false,
}: {
  valor: number;
  rotulo: string;
  acento?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-white p-3.5 text-center shadow-[var(--shadow-plano)] sm:p-4">
      <p
        className={`text-[22px] font-extrabold leading-none tracking-tight sm:text-[24px] ${
          acento ? "text-aventurea-orange-dark" : "text-aventurea-ink"
        }`}
      >
        {valor.toLocaleString("es-CR")}
      </p>
      <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft sm:text-[11px]">
        {rotulo}
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  Una franja administrable
// ───────────────────────────────────────────────────────────────────

function FilaFranja({
  negocioId,
  franja,
  sede,
  avisar,
}: {
  negocioId: string;
  franja: Franja;
  /** Nombre de la sede — solo llega cuando el negocio tiene más de una. */
  sede?: string;
  avisar: (tono: TonoToast, texto: string) => void;
}) {
  const [pendiente, iniciar] = useTransition();
  // Optimista: el interruptor responde al toque y se revierte si la
  // action falla — mismo patrón que FilaReservaHoy en el dashboard.
  const [activaLocal, setActivaLocal] = useState(franja.activa);
  const [confirmando, setConfirmando] = useState(false);

  const libres = Math.max(0, franja.capacidad - franja.reservado);
  const llena = libres === 0;
  const ocupacion =
    franja.capacidad > 0
      ? Math.min(100, Math.round((franja.reservado / franja.capacidad) * 100))
      : 0;

  function alternar() {
    const objetivo = !activaLocal;
    setActivaLocal(objetivo);
    iniciar(async () => {
      const r = await alternarFranja(negocioId, franja.id, objetivo);
      if (r?.error) {
        setActivaLocal(!objetivo);
        avisar("error", r.error);
        return;
      }
      avisar(
        "exito",
        objetivo
          ? "Franja prendida: vuelve a recibir reservas."
          : "Franja apagada: deja de recibir reservas.",
      );
    });
  }

  function borrar() {
    iniciar(async () => {
      const r = await borrarFranja(negocioId, franja.id);
      if (r?.error) {
        setConfirmando(false);
        avisar("error", r.error);
        return;
      }
      avisar("exito", "Franja borrada.");
    });
  }

  return (
    <li
      className={`rounded-2xl border border-aventurea-line bg-white p-3.5 transition-shadow hover:shadow-[var(--shadow-plano)] ${
        activaLocal ? "" : "opacity-75"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="w-24 shrink-0">
          <p className="text-[15px] font-extrabold leading-tight text-aventurea-navy">
            {horaCorta(franja.hora)}
          </p>
          {sede && (
            <p className="mt-0.5 truncate text-[11.5px] text-aventurea-ink-soft">{sede}</p>
          )}
        </div>

        {/* La ocupación: el dato que decide si abrís otra franja. */}
        <div className="min-w-[150px] flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[12.5px] text-aventurea-ink">
              <span className="font-bold">{franja.reservado}</span>/{franja.capacidad} reservados
            </p>
            <p className="text-[11.5px] text-aventurea-ink-soft">
              {llena ? "sin cupo" : `${libres} ${libres === 1 ? "cupo libre" : "cupos libres"}`}
            </p>
          </div>
          <div
            role="progressbar"
            aria-valuenow={ocupacion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Ocupación ${ocupacion}%`}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-aventurea-cream-2"
          >
            <div
              className="h-full rounded-full bg-aventurea-sky transition-[width] duration-500"
              style={{ width: `${ocupacion}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {franja.descuento_porcentaje > 0 && (
            <span className="inline-flex items-center rounded-lg bg-bookea-naranja-suave px-2.5 py-1 text-[11.5px] font-bold text-bookea-naranja-fuerte">
              −{franja.descuento_porcentaje}%
            </span>
          )}
          {llena && (
            <span
              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${ESTADO_PILDORA.aviso}`}
            >
              Llena
            </span>
          )}
          {!activaLocal && <InsigniaEstado estado="pausada" />}

          <button
            type="button"
            disabled={pendiente}
            onClick={alternar}
            className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50"
          >
            {activaLocal ? "Apagar" : "Prender"}
          </button>

          {confirmando ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pendiente}
                onClick={borrar}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Sí, borrar
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-lg px-2 py-1.5 text-[12px] font-bold text-aventurea-ink-soft"
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label={`Borrar la franja de las ${horaCorta(franja.hora)}`}
              className="grid h-8 w-8 place-items-center rounded-lg border border-aventurea-line text-aventurea-ink-soft transition-colors hover:border-red-400 hover:text-red-700"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────────
//  El diálogo de abrir franjas (una fecha / recurrente)
// ───────────────────────────────────────────────────────────────────

function DialogoAbrir({
  negocioId,
  sedes,
  hoy,
  dialogo,
  alCambiarModo,
  alCerrar,
  avisar,
}: {
  negocioId: string;
  sedes: Sede[];
  hoy: string;
  dialogo: Dialogo;
  alCambiarModo: (modo: "simple" | "recurrente") => void;
  alCerrar: () => void;
  avisar: (tono: TonoToast, texto: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const abierto = dialogo !== null;

  // Sincronizar el <dialog> nativo con el estado del padre. Solo toca
  // el DOM (showModal/close), sin setState — la regla del repo.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-label="Abrir franjas"
      onClose={alCerrar}
      onClick={(ev) => {
        // Click en el backdrop (el dialog mismo, no su contenido) =
        // cerrar. Mismo criterio que el cajón móvil del shell.
        if (ev.target === ev.currentTarget) ev.currentTarget.close();
      }}
      className="m-auto w-[min(600px,calc(100vw-2rem))] rounded-3xl border border-aventurea-line bg-white p-0 shadow-[var(--shadow-flotante)] backdrop:bg-black/45"
    >
      {dialogo && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase leading-none tracking-[0.14em] text-bookea-naranja-fuerte">
                Disponibilidad
              </p>
              <h2 className="titulo mt-1 text-[19px] leading-tight tracking-[-0.02em] text-aventurea-navy">
                {dialogo.modo === "simple" ? "Abrir una franja" : "Abrir varias franjas"}
              </h2>
            </div>
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-aventurea-line text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          {/* Cambiar de modo sin cerrar: el control segmentado. */}
          <div
            className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-aventurea-cream-2 p-1"
            role="tablist"
            aria-label="Tipo de apertura"
          >
            {(
              [
                { modo: "simple", label: "Una fecha" },
                { modo: "recurrente", label: "Recurrente" },
              ] as const
            ).map((t) => (
              <button
                key={t.modo}
                type="button"
                role="tab"
                aria-selected={dialogo.modo === t.modo}
                onClick={() => alCambiarModo(t.modo)}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-bold transition-colors ${
                  dialogo.modo === t.modo
                    ? "bg-white text-aventurea-navy shadow-[var(--shadow-plano)]"
                    : "text-aventurea-ink-soft hover:text-aventurea-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* key: cada apertura (modo o fecha distinta) monta un
              formulario fresco — sin arrastrar valores del anterior. */}
          {dialogo.modo === "simple" ? (
            <FormularioSimple
              key={`s-${dialogo.fecha ?? ""}`}
              negocioId={negocioId}
              sedes={sedes}
              hoy={hoy}
              fechaInicial={dialogo.fecha}
              alListo={alCerrar}
              avisar={avisar}
            />
          ) : (
            <FormularioRecurrente
              key="r"
              negocioId={negocioId}
              sedes={sedes}
              hoy={hoy}
              alListo={alCerrar}
              avisar={avisar}
            />
          )}
        </div>
      )}
    </dialog>
  );
}

/** El select de sede, u oculto si hay una sola (no hay nada que elegir). */
function CampoSede({ sedes }: { sedes: Sede[] }) {
  if (sedes.length === 1) {
    return <input type="hidden" name="location_id" value={sedes[0].id} />;
  }
  return (
    <label className="block">
      <span className={etiqueta}>Sede</span>
      <select name="location_id" required className={CAMPO_PANEL} defaultValue={sedes[0]?.id}>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormularioSimple({
  negocioId,
  sedes,
  hoy,
  fechaInicial,
  alListo,
  avisar,
}: {
  negocioId: string;
  sedes: Sede[];
  hoy: string;
  fechaInicial?: string;
  alListo: () => void;
  avisar: (tono: TonoToast, texto: string) => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // La action se llama directo con el FormData: el resultado llega a
  // esta misma función y acá se decide (cerrar + toast, o error en
  // línea). crearFranja no se tocó — se le pasa el estado inicial en
  // el lugar del `_previo` que useActionState le pasaba antes.
  function alEnviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const datos = new FormData(ev.currentTarget);
    iniciar(async () => {
      const r = await crearFranja(negocioId, INICIAL, datos);
      if (r.error) {
        setError(r.error);
        return;
      }
      avisar("exito", "Franja abierta.");
      alListo();
    });
  }

  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSede sedes={sedes} />
        <label className="block">
          <span className={etiqueta}>Fecha</span>
          <input
            name="fecha"
            type="date"
            min={hoy}
            defaultValue={fechaInicial ?? hoy}
            required
            className={CAMPO_PANEL}
          />
        </label>
        <label className="block">
          <span className={etiqueta}>Hora</span>
          <input name="hora" type="time" required className={CAMPO_PANEL} />
        </label>
        <label className="block">
          <span className={etiqueta}>Capacidad (personas)</span>
          <input
            name="capacidad"
            type="number"
            min={1}
            max={500}
            defaultValue={20}
            required
            className={CAMPO_PANEL}
          />
        </label>
        <label className="block">
          <span className={etiqueta}>Descuento (%)</span>
          <input
            name="descuento_porcentaje"
            type="number"
            min={0}
            max={90}
            defaultValue={20}
            className={CAMPO_PANEL}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendiente} className={BOTON_PANEL_PRIMARIO}>
          {pendiente ? "Guardando…" : "Abrir franja"}
        </button>
        <button type="button" onClick={alListo} className={BOTON_PANEL}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * El modo recurrente: genera TODAS las combinaciones de fecha (rango
 * filtrado por día de semana) × hora — abrir mediodía y noche de
 * martes a sábado por varias semanas en un solo envío. La action
 * (crearFranjasRecurrentes) es la misma de siempre; los chips de días
 * y horas también (checkbox oculto + hidden inputs con name=dias /
 * name=horas, que es lo que ella espera con getAll).
 */
function FormularioRecurrente({
  negocioId,
  sedes,
  hoy,
  alListo,
  avisar,
}: {
  negocioId: string;
  sedes: Sede[];
  hoy: string;
  alListo: () => void;
  avisar: (tono: TonoToast, texto: string) => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState<number[]>([]);
  const [horas, setHoras] = useState<string[]>([]);
  const [horaNueva, setHoraNueva] = useState("");

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

  function alEnviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const datos = new FormData(ev.currentTarget);
    iniciar(async () => {
      const r = await crearFranjasRecurrentes(negocioId, INICIAL, datos);
      if (r.error) {
        setError(r.error);
        return;
      }
      avisar("exito", r.cantidad ? `Se abrieron ${r.cantidad} franjas.` : "Franjas abiertas.");
      alListo();
    });
  }

  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSede sedes={sedes} />
        <label className="block">
          <span className={etiqueta}>Capacidad (para todas)</span>
          <input
            name="capacidad"
            type="number"
            min={1}
            max={500}
            defaultValue={20}
            required
            className={CAMPO_PANEL}
          />
        </label>
        <label className="block">
          <span className={etiqueta}>Desde</span>
          <input name="desde" type="date" min={hoy} defaultValue={hoy} required className={CAMPO_PANEL} />
        </label>
        <label className="block">
          <span className={etiqueta}>Hasta</span>
          <input name="hasta" type="date" min={hoy} required className={CAMPO_PANEL} />
        </label>
        <label className="block sm:col-span-2">
          <span className={etiqueta}>Descuento (%) (para todas)</span>
          <input
            name="descuento_porcentaje"
            type="number"
            min={0}
            max={90}
            defaultValue={20}
            className={CAMPO_PANEL}
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
            aria-label="Hora a agregar"
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
            Agregá al menos una hora, ej. 12:00 y 19:00.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente || dias.length === 0 || horas.length === 0}
          className={BOTON_PANEL_PRIMARIO}
        >
          {pendiente ? "Generando…" : "Generar franjas"}
        </button>
        <button type="button" onClick={alListo} className={BOTON_PANEL}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
