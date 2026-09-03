"use client";

import { useState } from "react";
import type { ConfigBeneficio } from "@/lib/lealtad/tipos-tarjeta";
import {
  DIAS_DE_AVISO,
  MESES_MAX,
  MESES_MIN,
  sumarMesesISO,
} from "@/lib/lealtad/vencimiento-sellos";
import { fmtFechaCorta, sumarDiasISO } from "@/lib/fechas";

/**
 * PASO 3 DEL CREADOR: qué se gana.
 *
 * Ocho tipos, ocho formularios distintos. Se resuelve con un `switch`
 * sobre el tipo y no con un formulario genérico de campos opcionales:
 * un formulario que sirve para todo muestra «capacidad» en una tarjeta
 * de sellos y «sellos requeridos» en una gift card, y el negocio tiene
 * que adivinar cuáles le tocan.
 *
 * La validación de verdad NO está acá: está en `validarBeneficio()`
 * (src/lib/lealtad/tipos-tarjeta.ts), que corre en el servidor antes
 * de guardar. Esto solo ayuda a llegar bien — una petición armada a
 * mano se saltaría cualquier cosa que haga este archivo.
 */

const campo =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70";
const etiqueta = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris";
const ayuda = "mt-1.5 text-[12px] leading-relaxed text-bookea-gris";

/** Number input que no convierte "" en 0 mientras se escribe. */
function num(valor: string, porDefecto = 0): number {
  const n = Number(valor);
  return valor.trim() === "" || Number.isNaN(n) ? porDefecto : n;
}

export default function PasoBeneficio({
  config,
  alCambiar,
  vencenMeses = null,
  alCambiarVencimiento,
}: {
  config: ConfigBeneficio;
  alCambiar: (c: ConfigBeneficio) => void;
  /**
   * Meses de inactividad tras los cuales los sellos se reinician
   * (0180). null = no vencen, que es lo de siempre.
   *
   * Es la ÚNICA parte de este formulario que no vive en el jsonb del
   * beneficio: la lee un motor que le quita sellos a alguien, así que
   * va en una columna con su CHECK (misma regla que las de la 0136).
   * Se pinta acá igual porque acá es donde el dueño está pensando en
   * sellos — mandarlo a otra pestaña a configurar «cuándo se pierden»
   * es cómo se llega a que nadie la encuentre.
   */
  vencenMeses?: number | null;
  /**
   * Sin esto el bloque no se pinta. Las pantallas que arman un
   * `PasoBeneficio` para otra cosa (una vista previa, un formulario de
   * solo lectura) no tienen dónde guardar la regla, y ofrecer un
   * interruptor que no guarda nada es peor que no ofrecerlo.
   */
  alCambiarVencimiento?: (meses: number | null) => void;
}) {
  switch (config.tipo) {
    case "sellos":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-req">
                Sellos para la regalía
              </label>
              <input
                id="b-req"
                type="number"
                min={1}
                max={15}
                value={config.requeridos}
                onChange={(e) => alCambiar({ ...config, requeridos: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-ini">
                Sellos de regalo al afiliarse
              </label>
              <input
                id="b-ini"
                type="number"
                min={0}
                value={config.inicial}
                onChange={(e) => alCambiar({ ...config, inicial: num(e.target.value) })}
                className={campo}
              />
              <p className={ayuda}>
                Arrancar con uno o dos hace que la tarjeta se sienta empezada — y las
                empezadas se terminan más.
              </p>
            </div>
          </Fila>
          <div>
            <label className={etiqueta} htmlFor="b-rec">
              Qué se gana
            </label>
            <input
              id="b-rec"
              value={config.recompensa}
              onChange={(e) => alCambiar({ ...config, recompensa: e.target.value })}
              placeholder="Tu bebida favorita gratis"
              className={campo}
            />
          </div>

          {/* LA REGLA DE ACUMULACIÓN (0197). «Por compra» es lo de
              siempre y es el valor por defecto: una tarjeta guardada
              antes de esta opción no cambia de comportamiento. La
              cuenta la hace el SERVIDOR (sellosPorCompra): esto solo
              elige la regla. */}
          <div>
            <span className={etiqueta}>¿Cómo gana sellos tu cliente?</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Regla de sellos">
              {(
                [
                  ["compra", "1 sello por compra"],
                  ["monto", "1 sello por monto"],
                ] as const
              ).map(([regla, label]) => (
                <button
                  key={regla}
                  type="button"
                  aria-pressed={(config.sellosPor ?? "compra") === regla}
                  onClick={() =>
                    alCambiar({
                      ...config,
                      sellosPor: regla,
                      montoPorSello:
                        regla === "monto" ? (config.montoPorSello ?? 4500) : null,
                    })
                  }
                  className={`presionable rounded-xl border px-3.5 py-2 text-[12.5px] font-bold ${
                    (config.sellosPor ?? "compra") === regla
                      ? "border-bookea-azul bg-bookea-azul text-white"
                      : "border-bookea-linea bg-white text-bookea-gris"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {(config.sellosPor ?? "compra") === "monto" ? (
              <div className="mt-3">
                <label className={etiqueta} htmlFor="b-monto-sello">
                  Monto requerido (₡ por sello)
                </label>
                <input
                  id="b-monto-sello"
                  type="number"
                  min={100}
                  max={10_000_000}
                  step={100}
                  value={config.montoPorSello ?? ""}
                  onChange={(e) =>
                    alCambiar({
                      ...config,
                      montoPorSello:
                        e.target.value.trim() === "" ? null : num(e.target.value, 100),
                    })
                  }
                  placeholder="4500"
                  className={campo}
                />
                <p className={ayuda}>
                  Con ₡{(config.montoPorSello ?? 4500).toLocaleString("es-CR")} por sello,
                  una compra de ₡
                  {((config.montoPorSello ?? 4500) * 2).toLocaleString("es-CR")} suma 2
                  sellos. El monto se teclea en el mostrador al escanear; sin monto, entra
                  1 sello como siempre.
                </p>
              </div>
            ) : (
              <p className={ayuda}>
                Cada compra escaneada suma un sello, gaste lo que gaste — lo de siempre.
              </p>
            )}
          </div>

          <Interruptor
            id="b-rep"
            titulo="Se puede repetir"
            detalle="Al completarla, arranca otra vuelta en vez de quedar terminada."
            activo={config.repetible}
            alCambiar={(v) => alCambiar({ ...config, repetible: v })}
          />
          {alCambiarVencimiento && (
            <VencimientoDeSellos meses={vencenMeses} alCambiar={alCambiarVencimiento} />
          )}
        </div>
      );

    case "puntos":
      return (
        <div className="space-y-4">
          <div>
            <label className={etiqueta} htmlFor="b-nom">
              Cómo se llaman
            </label>
            <input
              id="b-nom"
              value={config.nombre}
              onChange={(e) => alCambiar({ ...config, nombre: e.target.value })}
              placeholder="puntos, estrellas, granos…"
              className={campo}
            />
          </div>
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-visita">
                Por cada visita
              </label>
              <input
                id="b-visita"
                type="number"
                min={0}
                value={config.porVisita}
                onChange={(e) => alCambiar({ ...config, porVisita: num(e.target.value) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-colon">
                Por cada colón gastado
              </label>
              <input
                id="b-colon"
                type="number"
                min={0}
                step="0.01"
                value={config.porMoneda}
                onChange={(e) => alCambiar({ ...config, porMoneda: num(e.target.value) })}
                placeholder="0.05"
                className={campo}
              />
            </div>
          </Fila>
          <p className={ayuda}>
            Se combinan. Una barbería usa 1 por visita y 0 por colón; una cafetería usa 0
            por visita y 0.05 por colón.
          </p>
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-min">
                Mínimo para canjear
              </label>
              <input
                id="b-min"
                type="number"
                min={1}
                value={config.minimoCanje}
                onChange={(e) => alCambiar({ ...config, minimoCanje: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-max">
                Tope acumulable
              </label>
              <input
                id="b-max"
                type="number"
                min={1}
                value={config.maximo ?? ""}
                onChange={(e) =>
                  alCambiar({
                    ...config,
                    maximo: e.target.value.trim() === "" ? null : num(e.target.value, 1),
                  })
                }
                placeholder="Vacío = sin tope"
                className={campo}
              />
            </div>
          </Fila>
        </div>
      );

    case "cupon":
    case "descuento": {
      const b = config.beneficio;
      return (
        <div className="space-y-4">
          <div>
            <span className={etiqueta}>Qué da</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Forma del beneficio">
              {(
                [
                  ["porcentaje", "Porcentaje"],
                  ["monto", "Monto fijo"],
                  ["gratis", "Producto gratis"],
                ] as const
              ).map(([forma, label]) => (
                <button
                  key={forma}
                  type="button"
                  aria-pressed={b.forma === forma}
                  onClick={() =>
                    alCambiar({
                      ...config,
                      beneficio:
                        forma === "gratis"
                          ? { forma, que: "" }
                          : { forma, valor: forma === "porcentaje" ? 10 : 1000 },
                    })
                  }
                  className={`presionable rounded-xl border px-3.5 py-2 text-[12.5px] font-bold ${
                    b.forma === forma
                      ? "border-bookea-azul bg-bookea-azul text-white"
                      : "border-bookea-linea bg-white text-bookea-gris"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {b.forma === "gratis" ? (
            <div>
              <label className={etiqueta} htmlFor="b-que">
                Qué va gratis
              </label>
              <input
                id="b-que"
                value={b.que}
                onChange={(e) =>
                  alCambiar({ ...config, beneficio: { forma: "gratis", que: e.target.value } })
                }
                placeholder="Un postre"
                className={campo}
              />
            </div>
          ) : (
            <div>
              <label className={etiqueta} htmlFor="b-val">
                {b.forma === "porcentaje" ? "Porcentaje de descuento" : "Monto del descuento (₡)"}
              </label>
              <input
                id="b-val"
                type="number"
                min={1}
                max={b.forma === "porcentaje" ? 100 : undefined}
                value={b.valor}
                onChange={(e) =>
                  alCambiar({
                    ...config,
                    beneficio: { forma: b.forma, valor: num(e.target.value, 1) },
                  })
                }
                className={campo}
              />
            </div>
          )}

          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-cmin">
                Compra mínima (₡)
              </label>
              <input
                id="b-cmin"
                type="number"
                min={0}
                value={config.compraMinima}
                onChange={(e) => alCambiar({ ...config, compraMinima: num(e.target.value) })}
                placeholder="0 = sin mínimo"
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-usos">
                Usos por cliente
              </label>
              <input
                id="b-usos"
                type="number"
                min={1}
                value={config.usosPorCliente}
                onChange={(e) => alCambiar({ ...config, usosPorCliente: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
          </Fila>
        </div>
      );
    }

    case "membresia":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-niv">
                Nombre del nivel
              </label>
              <input
                id="b-niv"
                value={config.nivel}
                onChange={(e) => alCambiar({ ...config, nivel: e.target.value })}
                placeholder="Gold, Socio, VIP…"
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-vig">
                Vigencia (meses)
              </label>
              <input
                id="b-vig"
                type="number"
                min={1}
                value={config.vigenciaMeses}
                onChange={(e) => alCambiar({ ...config, vigenciaMeses: num(e.target.value, 1) })}
                className={campo}
              />
            </div>
          </Fila>
          <ListaEditable
            titulo="Beneficios del socio"
            items={config.beneficios}
            marcador="10% en todo, prioridad de horario…"
            alCambiar={(beneficios) => alCambiar({ ...config, beneficios })}
          />
          <Interruptor
            id="b-ren"
            titulo="Se renueva sola"
            detalle="Al vencer, la membresía se extiende otro período."
            activo={config.renovacionAutomatica}
            alCambiar={(v) => alCambiar({ ...config, renovacionAutomatica: v })}
          />
        </div>
      );

    case "giftcard":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-valor">
                Valor
              </label>
              <input
                id="b-valor"
                type="number"
                min={1}
                value={config.valor || ""}
                onChange={(e) => alCambiar({ ...config, valor: num(e.target.value) })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-mon">
                Moneda
              </label>
              <select
                id="b-mon"
                value={config.moneda}
                onChange={(e) =>
                  alCambiar({ ...config, moneda: e.target.value as "CRC" | "USD" })
                }
                className={campo}
              >
                <option value="CRC">Colones (₡)</option>
                <option value="USD">Dólares ($)</option>
              </select>
            </div>
          </Fila>
          <Interruptor
            id="b-parc"
            titulo="Se puede gastar de a poco"
            detalle="El saldo baja con cada uso en vez de consumirse entero de una."
            activo={config.canjeParcial}
            alCambiar={(v) => alCambiar({ ...config, canjeParcial: v })}
          />
          <Interruptor
            id="b-tra"
            titulo="Se puede regalar"
            detalle="Quien la compra puede pasársela a otra persona."
            activo={config.transferible}
            alCambiar={(v) => alCambiar({ ...config, transferible: v })}
          />
        </div>
      );

    case "evento":
      return (
        <div className="space-y-4">
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-fecha">
                Fecha
              </label>
              <input
                id="b-fecha"
                type="date"
                value={config.fecha}
                onChange={(e) => alCambiar({ ...config, fecha: e.target.value })}
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-hora">
                Hora
              </label>
              <input
                id="b-hora"
                type="time"
                value={config.hora}
                onChange={(e) => alCambiar({ ...config, hora: e.target.value })}
                className={campo}
              />
            </div>
          </Fila>
          <div>
            <label className={etiqueta} htmlFor="b-ubi">
              Dónde
            </label>
            <input
              id="b-ubi"
              value={config.ubicacion}
              onChange={(e) => alCambiar({ ...config, ubicacion: e.target.value })}
              placeholder="Café Aroma, Alajuela"
              className={campo}
            />
          </div>
          <div>
            <label className={etiqueta} htmlFor="b-cap">
              Entradas disponibles
            </label>
            <input
              id="b-cap"
              type="number"
              min={1}
              value={config.capacidad ?? ""}
              onChange={(e) =>
                alCambiar({
                  ...config,
                  capacidad: e.target.value.trim() === "" ? null : num(e.target.value, 1),
                })
              }
              placeholder="Vacío = sin tope"
              className={campo}
            />
          </div>
        </div>
      );

    case "cashback":
      return (
        <div className="space-y-4">
          <div>
            <label className={etiqueta} htmlFor="b-pct">
              Porcentaje que devolvés
            </label>
            <input
              id="b-pct"
              type="number"
              min={1}
              max={100}
              value={config.porcentaje}
              onChange={(e) => alCambiar({ ...config, porcentaje: num(e.target.value, 1) })}
              className={campo}
            />
            <p className={ayuda}>
              De cada compra vuelve ese porcentaje como saldo, y el cliente lo gasta en su
              próxima visita.
            </p>
          </div>
          <Fila>
            <div>
              <label className={etiqueta} htmlFor="b-cbmin">
                Compra mínima (₡)
              </label>
              <input
                id="b-cbmin"
                type="number"
                min={0}
                value={config.compraMinima}
                onChange={(e) => alCambiar({ ...config, compraMinima: num(e.target.value) })}
                placeholder="0 = sin mínimo"
                className={campo}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="b-tope">
                Tope por compra (₡)
              </label>
              <input
                id="b-tope"
                type="number"
                min={1}
                value={config.topePorCompra ?? ""}
                onChange={(e) =>
                  alCambiar({
                    ...config,
                    topePorCompra: e.target.value.trim() === "" ? null : num(e.target.value, 1),
                  })
                }
                placeholder="Vacío = sin tope"
                className={campo}
              />
            </div>
          </Fila>
        </div>
      );
  }
}

// ── Piezas ─────────────────────────────────────────────────────────

function Fila({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

/**
 * Interruptor accesible: es un `<button role="switch">` y no un div
 * con onClick, así que el teclado y los lectores de pantalla lo
 * entienden sin que haya que explicarles nada.
 */
export function Interruptor({
  id,
  titulo,
  detalle,
  activo,
  alCambiar,
}: {
  id: string;
  titulo: string;
  detalle?: string;
  activo: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={activo}
      onClick={() => alCambiar(!activo)}
      className="presionable flex w-full items-start gap-3 rounded-2xl border border-bookea-linea bg-white p-3.5 text-left"
    >
      <span
        aria-hidden
        className="relative mt-0.5 h-[22px] w-[40px] shrink-0 rounded-full transition-colors"
        style={{ background: activo ? "var(--accion)" : "var(--line)" }}
      >
        {/* Encendido va en el azul de acción y no en el naranja: en este
            mismo formulario «elegido» ya era azul (los chips de arriba),
            así que convivían dos colores para la misma idea de estado.

            La perilla se pinta con `style` y no con `bg-white` porque
            dentro del panel oscuro `.lealtad-oscuro .bg-white` se
            re-mapea a un blanco al 5% y la perilla desaparecía — el
            interruptor se veía apagado estando encendido. Encendida usa
            la tinta del par: blanca sobre el azul claro, navy sobre el
            azul del panel oscuro. */}
        <span
          style={{ background: activo ? "var(--accion-tinta)" : "#ffffff" }}
          className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full transition-transform duration-200 ${
            activo ? "translate-x-[18px]" : ""
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-bookea-tinta">{titulo}</span>
        {detalle && (
          <span className="mt-0.5 block text-[11.5px] leading-snug text-bookea-gris">
            {detalle}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * LOS SELLOS QUE VENCEN POR INACTIVIDAD (0180).
 *
 * ------------------------------------------------------------------
 * SE TIENE QUE ENTENDER SIN LEER UN MANUAL
 * ------------------------------------------------------------------
 * «Vencimiento: 6 meses» no le dice a nadie qué le va a pasar a su
 * clienta. Así que abajo del número va la línea de tiempo de UNA
 * clienta concreta, con fechas de verdad recalculadas mientras el
 * dueño mueve el número: cuándo fue su última visita, cuándo le llega
 * el aviso, y qué día arranca de cero.
 *
 * El ejemplo usa una fecha FIJA y no «hoy» a propósito: este
 * componente se pinta también en el servidor, y una fecha leída del
 * reloj daría un HTML distinto en cada lado (el aviso de hidratación
 * de React) sin que el ejemplo gane nada — lo que se está mostrando es
 * la FORMA de la regla, no el calendario.
 *
 * ------------------------------------------------------------------
 * TRES ATAJOS Y UN CAMPO
 * ------------------------------------------------------------------
 * 3, 6 y 12 cubren casi todo lo real (una cafetería, una barbería, un
 * taller). El campo queda igual porque el CHECK de la base acepta de 1
 * a 60 y alguien va a querer 18.
 *
 * Y arranca APAGADO, como todas las reglas de este módulo: una tarjeta
 * sin regla es la que más se entiende, y cada regla encendida es una
 * forma más de que alguien pierda algo que creía tener.
 */
function VencimientoDeSellos({
  meses,
  alCambiar,
}: {
  meses: number | null;
  alCambiar: (meses: number | null) => void;
}) {
  const encendido = meses !== null;
  // Lo último que el dueño escribió, para que apagar y volver a
  // encender no le pierda el número.
  const [ultimo, setUltimo] = useState(meses ?? 6);

  // La clienta del ejemplo. Fecha fija: ver el encabezado.
  const ultimaVisita = "2026-03-03";
  const reinicio = sumarMesesISO(ultimaVisita, meses ?? ultimo);
  const aviso = sumarDiasISO(reinicio, -DIAS_DE_AVISO);

  return (
    <div className="space-y-3">
      <Interruptor
        id="b-venc"
        titulo="Los sellos vencen si el cliente no vuelve"
        detalle="Apagado, los sellos no vencen nunca: quien junta 3 y vuelve en dos años, sigue con 3."
        activo={encendido}
        alCambiar={(v) => alCambiar(v ? ultimo : null)}
      />
      <div className="desplegable" data-abierto={encendido ? "true" : "false"}>
        <div>
          <div className="px-1 pb-1">
            <label className={etiqueta} htmlFor="b-venc-meses">
              Meses sin volver
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[3, 6, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={meses === n}
                  onClick={() => {
                    setUltimo(n);
                    alCambiar(n);
                  }}
                  className={`presionable rounded-lg border px-3 py-1.5 text-[12px] font-bold ${
                    meses === n
                      ? "border-bookea-azul bg-bookea-azul text-white"
                      : "border-bookea-linea bg-white text-bookea-gris"
                  }`}
                >
                  {n} meses
                </button>
              ))}
              <input
                id="b-venc-meses"
                type="number"
                min={MESES_MIN}
                max={MESES_MAX}
                value={meses ?? ""}
                onChange={(e) => {
                  const n = num(e.target.value, 0);
                  if (n < MESES_MIN) return;
                  const acotado = Math.min(n, MESES_MAX);
                  setUltimo(acotado);
                  alCambiar(acotado);
                }}
                className={`${campo} w-[110px]`}
                aria-label="Meses sin volver antes de reiniciar los sellos"
              />
            </div>

            {/* ── Qué le pasa a una clienta que deja de venir ──────── */}
            <div className="mt-3 rounded-2xl border border-bookea-linea bg-bookea-azul-suave/40 p-3.5">
              <p className="text-[12px] font-bold text-bookea-tinta">
                Una clienta con 3 sellos, si deja de venir:
              </p>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-snug text-bookea-gris">
                <li>
                  <strong className="text-bookea-tinta">{fmtFechaCorta(ultimaVisita)}</strong> —
                  su última visita. Sigue con sus 3 sellos.
                </li>
                <li>
                  <strong className="text-bookea-tinta">{fmtFechaCorta(aviso)}</strong> — le
                  avisamos: en su tarjeta del teléfono y por correo, una sola vez.
                </li>
                <li>
                  <strong className="text-bookea-tinta">{fmtFechaCorta(reinicio)}</strong> — si
                  no volvió, arranca de cero.
                </li>
              </ul>
              <p className="mt-2.5 text-[11.5px] leading-snug text-bookea-gris">
                Si vuelve en el medio, la fecha se corre sola: cada visita renueva el plazo. Lo
                que ya tenía nunca se pierde por venir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lista de textos que crece: los beneficios de una membresía. */
function ListaEditable({
  titulo,
  items,
  marcador,
  alCambiar,
}: {
  titulo: string;
  items: string[];
  marcador: string;
  alCambiar: (items: string[]) => void;
}) {
  return (
    <div>
      <span className={etiqueta}>{titulo}</span>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => {
                const copia = [...items];
                copia[i] = e.target.value;
                alCambiar(copia);
              }}
              placeholder={marcador}
              className={`${campo} flex-1`}
              aria-label={`${titulo} ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => alCambiar(items.filter((_, j) => j !== i))}
              className="presionable shrink-0 rounded-xl border border-bookea-linea px-3 text-[12.5px] font-bold text-bookea-gris"
              aria-label={`Quitar ${titulo} ${i + 1}`}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => alCambiar([...items, ""])}
        className="presionable mt-2 rounded-xl border border-dashed border-bookea-linea px-3.5 py-2 text-[12.5px] font-bold text-bookea-gris"
      >
        + Agregar
      </button>
    </div>
  );
}
