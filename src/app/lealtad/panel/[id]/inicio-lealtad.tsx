import type { ReactNode } from "react";
import { Icono, type NombreIcono } from "./iconos";

/**
 * EL TABLERO DE INICIO del panel de lealtad.
 *
 * Dos piezas, y en este orden a propósito:
 *
 * 1. «Cómo funciona tu programa» — el recorrido del cliente y lo que
 *    hace el equipo, en siete pasos dibujados. Un dueño que acaba de
 *    contratar lealtad no sabe qué se supone que pase; explicárselo una
 *    vez, en la primera pantalla, ahorra la llamada de soporte.
 *
 * 2. «Primeros pasos» — la lista con barra de avance. Cada casilla se
 *    marca con una SEÑAL REAL de la base (¿hay recompensa activa?, ¿hay
 *    tarjeta publicada?, ¿hay miembros?), nunca con un booleano que
 *    alguien tocó: una lista que se auto-completa sin que nada haya
 *    pasado es peor que no tenerla.
 *
 * Los botones son anclas `#seccion`: el shell escucha el hash y cambia
 * de sección. Por eso este componente puede vivir en el servidor.
 */

const NARANJA = "#ee7420";

export type PasoPrimero = {
  titulo: string;
  detalle: string;
  listo: boolean;
  cta: { texto: string; href: string } | null;
};

type Tarjeta = { icono: NombreIcono; titulo: string; detalle: string };

export default function InicioLealtad({
  nombre,
  modo,
  regalia,
  pasos,
  accion,
}: {
  nombre: string;
  modo: "sellos" | "puntos" | "cashback";
  /** La recompensa que marca la meta. null = todavía no hay ninguna. */
  regalia: { nombre: string; costo: number } | null;
  pasos: PasoPrimero[];
  /** El botón de escanear, si quien mira puede acreditar. */
  accion?: ReactNode;
}) {
  const unidad = modo === "sellos" ? "sello" : "punto";
  const unidades = modo === "sellos" ? "sellos" : "puntos";

  const recorrido: Tarjeta[] = [
    {
      icono: "qr",
      titulo: "Escanea el QR",
      detalle: "Tu cliente apunta la cámara al código de tu mostrador.",
    },
    {
      icono: "afiliar",
      titulo: "Se afilia",
      detalle: "Pone su nombre una sola vez y queda adentro del programa.",
    },
    {
      icono: "movil",
      titulo: "Guarda su tarjeta",
      detalle: "Le queda en el Wallet del teléfono. Sin apps que instalar.",
    },
    {
      icono: "regalo",
      titulo: "Reclama su regalía",
      detalle: regalia
        ? `Al llegar a ${regalia.costo} ${unidades}: ${regalia.nombre}.`
        : `Al completar sus ${unidades} se gana lo que vos definas.`,
    },
  ];

  const equipo: Tarjeta[] = [
    {
      icono: "escanear",
      titulo: "Escaneás su tarjeta",
      detalle: "Abrís el escáner del panel y leés el código del cliente.",
    },
    {
      icono: "sumar",
      titulo: `Le sumás el ${unidad}`,
      detalle:
        modo === "sellos"
          ? "Un toque y el sello queda en su cuenta."
          : "Escribís el monto de la compra y se acreditan los puntos.",
    },
    {
      icono: "listo",
      titulo: "Listo",
      detalle: "La tarjeta del cliente se actualiza sola en su teléfono.",
    },
  ];

  const listos = pasos.filter((p) => p.listo).length;
  const avance = pasos.length ? Math.round((listos / pasos.length) * 100) : 0;
  // El primero que falta es el que se resalta: una lista con cuatro
  // llamados a la acción a la vez no dice por dónde empezar.
  const siguiente = pasos.findIndex((p) => !p.listo);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[21px] font-extrabold leading-tight text-white sm:text-[24px]">
          Hola de nuevo, {nombre}
        </h2>
        <p className="mt-1 text-[13.5px] text-white/55">
          Esto es lo que está pasando con tu programa de lealtad.
        </p>
      </div>

      {accion}

      {/* ── Cómo funciona ──────────────────────────────────────── */}
      <Card>
        <h3 className="text-[16px] font-extrabold text-aventurea-ink">
          Cómo funciona tu programa
        </h3>

        <Rotulo>Lo que hace tu cliente</Rotulo>
        <Flujo tarjetas={recorrido} columnas={4} />

        <Rotulo className="mt-5">Lo que hace tu equipo</Rotulo>
        <Flujo tarjetas={equipo} columnas={3} />
      </Card>

      {/* ── Primeros pasos ─────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 className="text-[16px] font-extrabold text-aventurea-ink">
            Primeros pasos con Bookea
          </h3>
          <span className="text-[12.5px] font-bold text-aventurea-ink-soft">
            {listos} de {pasos.length} listos
          </span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${avance}%`, background: NARANJA }}
          />
        </div>

        <ol className="mt-4 space-y-2">
          {pasos.map((paso, i) => {
            const destacado = i === siguiente;
            return (
              <li
                key={paso.titulo}
                className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border bg-white px-4 py-3.5"
                style={
                  destacado
                    ? { borderColor: NARANJA, background: "rgba(238,116,32,.07)" }
                    : undefined
                }
              >
                {paso.listo ? (
                  <span className="shrink-0 text-aventurea-green">
                    <Icono nombre="listo" className="h-[22px] w-[22px]" />
                  </span>
                ) : (
                  <span
                    className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11px] font-extrabold"
                    style={{
                      borderColor: destacado ? NARANJA : "rgba(255,255,255,.25)",
                      color: destacado ? NARANJA : "rgba(255,255,255,.5)",
                    }}
                  >
                    {i + 1}
                  </span>
                )}

                <span className="min-w-0 flex-1 basis-[min(100%,240px)]">
                  <span
                    className={`block text-[13.5px] font-bold ${
                      paso.listo ? "text-aventurea-ink-soft" : "text-aventurea-ink"
                    }`}
                  >
                    {paso.titulo}
                  </span>
                  <span className="block text-[12px] leading-snug text-aventurea-ink-soft">
                    {paso.detalle}
                  </span>
                </span>

                {paso.cta && (
                  <a
                    href={paso.cta.href}
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                      destacado
                        ? "text-white"
                        : "border border-aventurea-line text-aventurea-ink-soft hover:text-aventurea-ink"
                    }`}
                    style={destacado ? { background: NARANJA } : undefined}
                  >
                    {paso.cta.texto} →
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl border p-4 sm:p-6"
      style={{ background: "rgba(255,255,255,.035)", borderColor: "rgba(255,255,255,.09)" }}
    >
      {children}
    </div>
  );
}

function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`mb-2.5 mt-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft ${className}`}
    >
      {children}
    </p>
  );
}

/**
 * La fila de pasos con la flecha en el canal entre tarjetas. La flecha
 * sale SOLO en la fila de una línea (lg): apilado, una flecha
 * horizontal entre cosas que van hacia abajo miente.
 */
function Flujo({ tarjetas, columnas }: { tarjetas: Tarjeta[]; columnas: 3 | 4 }) {
  return (
    <div className={`grid gap-2.5 sm:grid-cols-2 ${columnas === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {tarjetas.map((t, i) => (
        <div
          key={t.titulo}
          className="relative flex items-start gap-3 rounded-2xl border border-aventurea-line bg-white px-3.5 py-3"
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ background: "rgba(238,116,32,.15)", color: NARANJA }}
          >
            <Icono nombre={t.icono} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-aventurea-ink">{t.titulo}</span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-aventurea-ink-soft">
              {t.detalle}
            </span>
          </span>

          {i < tarjetas.length - 1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-[15px] top-1/2 hidden -translate-y-1/2 text-[13px] text-white/25 lg:block"
            >
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
